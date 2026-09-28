-- ============================================================================
-- Punto di partenza della giornata, e solo due modalità di viaggio.
--
-- 1) La partenza diventa una tappa vera, marcata con is_start.
--    Prima il punto di partenza esisteva solo nel profilo e serviva al rientro:
--    i chilometri della giornata partivano dalla prima tappa inserita, non da
--    dove l'utente parte davvero. Modellandola come tappa, tutto il resto
--    (tratte, totali, mappa, ricalcolo) funziona senza casi particolari: una
--    tratta collega sempre due tappe.
--
-- 2) Il rientro non punta più a "null con le coordinate del profilo" ma alla
--    tappa di partenza: from = ultima tappa, to = prima tappa.
--
-- 3) travel_mode ammette solo 'auto' e 'piedi'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- travel_mode: la colonna può non esistere se la migration precedente non è
-- stata applicata, quindi si aggiunge in modo idempotente.
-- ---------------------------------------------------------------------------
alter table public.itineraries
  add column if not exists travel_mode text not null default 'auto';

alter table public.itineraries
  drop constraint if exists itineraries_travel_mode_valid;

alter table public.itineraries
  add constraint itineraries_travel_mode_valid
  check (travel_mode in ('auto', 'piedi'));

comment on column public.itineraries.travel_mode is
  'Mezzo usato nella giornata (auto o piedi): determina il profilo di calcolo dei percorsi.';

-- Le eventuali giornate in bici tornano in auto, altrimenti il nuovo vincolo
-- non potrebbe essere applicato.
update public.itineraries set travel_mode = 'auto' where travel_mode not in ('auto', 'piedi');

create or replace function public.itineraries_invalida_su_cambio_mezzo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.travel_mode is distinct from old.travel_mode then
    delete from public.legs l
    where l.itinerary_id = new.id
      and l.source = 'auto';
  end if;
  return new;
end;
$$;

comment on function public.itineraries_invalida_su_cambio_mezzo is
  'Al cambio di travel_mode elimina le tratte automatiche, che vanno ricalcolate.';

drop trigger if exists itineraries_cambio_mezzo on public.itineraries;

create trigger itineraries_cambio_mezzo
  after update of travel_mode on public.itineraries
  for each row execute function public.itineraries_invalida_su_cambio_mezzo();

-- ---------------------------------------------------------------------------
-- stops.is_start: la tappa da cui comincia la giornata
-- ---------------------------------------------------------------------------
alter table public.stops
  add column if not exists is_start boolean not null default false;

comment on column public.stops.is_start is
  'true per la tappa di partenza della giornata: una sola per itinerario.';

-- Una sola partenza per giornata.
create unique index if not exists stops_una_sola_partenza
  on public.stops (itinerary_id)
  where is_start;

-- ---------------------------------------------------------------------------
-- Le tratte "verso il profilo" (to_stop_id null) non esistono più: il rientro
-- punta alla tappa di partenza. Le righe vecchie vanno rimosse perché non
-- rispettano più l'invariante e falserebbero i totali.
-- ---------------------------------------------------------------------------
delete from public.legs where to_stop_id is null;

alter table public.legs
  drop constraint if exists legs_has_endpoint;

alter table public.legs
  add constraint legs_has_endpoint
  check (from_stop_id is not null and to_stop_id is not null);

comment on table public.legs is
  'Tratta fra due tappe consecutive; il rientro collega l''ultima tappa a quella di partenza.';

-- ---------------------------------------------------------------------------
-- Invariante aggiornata: coppie consecutive più, se richiesto, il rientro
-- dall'ultima tappa alla prima.
-- ---------------------------------------------------------------------------
create or replace function public.invalida_tratte_non_adiacenti(p_itinerary_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_eliminate integer;
begin
  with ordinate as (
    select
      s.id,
      lead(s.id) over (order by s.position) as successiva,
      first_value(s.id) over (order by s.position) as prima,
      row_number() over (order by s.position) as riga,
      count(*) over () as totale
    from public.stops s
    where s.itinerary_id = p_itinerary_id
  ),
  attese as (
    select o.id as from_id, o.successiva as to_id
    from ordinate o
    where o.successiva is not null
    union all
    -- Rientro: dall'ultima tappa alla tappa di partenza. Serve almeno un
    -- percorso vero, quindi con una sola tappa non c'è rientro.
    select o.id as from_id, o.prima as to_id
    from ordinate o
    join public.itineraries i on i.id = p_itinerary_id
    where o.riga = o.totale
      and o.totale > 1
      and i.returns_to_start
  ),
  rimosse as (
    delete from public.legs l
    where l.itinerary_id = p_itinerary_id
      and not exists (
        select 1
        from attese a
        where a.from_id = l.from_stop_id
          and a.to_id = l.to_stop_id
      )
    returning 1
  )
  select count(*)::integer into v_eliminate from rimosse;

  return v_eliminate;
end;
$$;

comment on function public.invalida_tratte_non_adiacenti is
  'Elimina le tratte che non collegano più tappe consecutive (né il rientro all''inizio). Restituisce quante ne ha eliminate.';

-- ---------------------------------------------------------------------------
-- insert_stop_at accetta il flag di partenza.
--
-- La versione precedente va eliminata prima di creare la nuova: due funzioni
-- con lo stesso nome e firme diverse renderebbero ambigua ogni chiamata senza
-- p_is_start (e anche i comment e i grant).
-- ---------------------------------------------------------------------------
drop function if exists public.insert_stop_at(uuid, text, text, numeric, numeric, time, text, integer);

create or replace function public.insert_stop_at(
  p_itinerary_id uuid,
  p_label text,
  p_address text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_planned_time time default null,
  p_notes text default null,
  p_position integer default null,
  p_is_start boolean default false
)
returns public.stops
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_totale integer;
  v_posizione integer;
  v_tappa public.stops;
begin
  if not exists (select 1 from public.itineraries i where i.id = p_itinerary_id) then
    raise exception 'Giornata non trovata' using errcode = 'no_data_found';
  end if;

  select count(*)::integer into v_totale
  from public.stops s
  where s.itinerary_id = p_itinerary_id;

  -- La partenza va sempre in testa.
  if p_is_start then
    v_posizione := 1;
    -- Una sola partenza per giornata: la precedente perde il flag.
    update public.stops s set is_start = false
    where s.itinerary_id = p_itinerary_id and s.is_start;
  else
    v_posizione := coalesce(p_position, v_totale + 1);
    if v_posizione < 1 or v_posizione > v_totale + 1 then
      v_posizione := v_totale + 1;
    end if;
  end if;

  update public.stops s
  set position = s.position + 1
  where s.itinerary_id = p_itinerary_id
    and s.position >= v_posizione;

  insert into public.stops (
    itinerary_id, position, label, address, lat, lng, planned_time, notes, is_start
  )
  values (
    p_itinerary_id, v_posizione, p_label, p_address, p_lat, p_lng,
    p_planned_time, p_notes, p_is_start
  )
  returning * into v_tappa;

  perform public.invalida_tratte_non_adiacenti(p_itinerary_id);

  return v_tappa;
end;
$$;

comment on function public.insert_stop_at(uuid, text, text, numeric, numeric, time, text, integer, boolean) is
  'Inserisce una tappa (in coda, in mezzo o come partenza), sposta le successive e invalida le tratte interessate.';

revoke all on function public.insert_stop_at(uuid, text, text, numeric, numeric, time, text, integer, boolean) from public;
grant execute on function public.insert_stop_at(uuid, text, text, numeric, numeric, time, text, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- duplicate_itinerary copia anche il flag di partenza.
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_itinerary(
  p_itinerary_id uuid,
  p_target_date date,
  p_overwrite boolean default false
)
returns public.itineraries
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_origine public.itineraries;
  v_destinazione public.itineraries;
begin
  select * into v_origine
  from public.itineraries i
  where i.id = p_itinerary_id;

  if v_origine.id is null then
    raise exception 'Giornata di origine non trovata' using errcode = 'no_data_found';
  end if;

  if v_origine.date = p_target_date then
    raise exception 'La data di destinazione coincide con quella di origine'
      using errcode = 'check_violation';
  end if;

  select * into v_destinazione
  from public.itineraries i
  where i.user_id = v_origine.user_id
    and i.date = p_target_date;

  if v_destinazione.id is not null then
    if not p_overwrite then
      raise exception 'Esiste già una giornata per il %', p_target_date
        using errcode = 'unique_violation';
    end if;
    delete from public.stops s where s.itinerary_id = v_destinazione.id;
  else
    insert into public.itineraries (user_id, date, notes, returns_to_start, travel_mode)
    values (v_origine.user_id, p_target_date, v_origine.notes, v_origine.returns_to_start,
            v_origine.travel_mode)
    returning * into v_destinazione;
  end if;

  update public.itineraries i
  set notes = v_origine.notes,
      returns_to_start = v_origine.returns_to_start,
      travel_mode = v_origine.travel_mode
  where i.id = v_destinazione.id
  returning * into v_destinazione;

  insert into public.stops (
    itinerary_id, position, label, address, lat, lng, planned_time, notes, is_start
  )
  select v_destinazione.id, s.position, s.label, s.address, s.lat, s.lng,
         s.planned_time, s.notes, s.is_start
  from public.stops s
  where s.itinerary_id = v_origine.id
  order by s.position;

  return v_destinazione;
end;
$$;

comment on function public.duplicate_itinerary is
  'Copia le tappe di una giornata (partenza inclusa) su un''altra data. Le tratte vanno ricalcolate.';

-- ---------------------------------------------------------------------------
-- Vista dei totali: espone il mezzo e se la giornata ha una partenza.
-- ---------------------------------------------------------------------------
drop view if exists public.itinerary_totals;

create view public.itinerary_totals
with (security_invoker = true) as
select
  i.id as itinerary_id,
  i.user_id,
  i.date,
  i.returns_to_start,
  i.travel_mode,
  coalesce(sum(l.distance_km), 0)::numeric(10, 2) as total_km,
  coalesce(sum(l.duration_min), 0)::integer as total_duration_min,
  count(l.id)::integer as legs_count,
  (select count(*) from public.stops s where s.itinerary_id = i.id)::integer as stops_count,
  (select count(*) > 0 from public.stops s where s.itinerary_id = i.id and s.is_start) as has_start,
  count(l.id) filter (where l.source = 'manual')::integer as manual_legs_count,
  count(l.id) filter (where l.is_estimate)::integer as estimated_legs_count
from public.itineraries i
left join public.legs l on l.itinerary_id = i.id
group by i.id, i.user_id, i.date, i.returns_to_start, i.travel_mode;

comment on view public.itinerary_totals is
  'Totali per giornata (km, durata, conteggi). Rispetta le policy RLS: security_invoker.';

grant select on public.itinerary_totals to authenticated;
