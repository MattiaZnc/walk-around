-- ============================================================================
-- Vista dei totali e funzioni RPC che incapsulano le operazioni transazionali
-- (riordino, inserimento in mezzo, eliminazione con chiusura dei buchi).
--
-- Perché RPC e non più chiamate dal client: supabase-js manda ogni richiesta
-- in una transazione separata. Spostare una tappa richiede di riscrivere più
-- position insieme, cosa possibile solo grazie al vincolo DEFERRABLE dentro
-- un'unica transazione.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- itinerary_totals: km e conteggi per giornata.
-- security_invoker = true: la vista legge con i permessi di chi interroga,
-- quindi le policy RLS delle tabelle sottostanti restano valide.
-- ---------------------------------------------------------------------------
create view public.itinerary_totals
with (security_invoker = true) as
select
  i.id as itinerary_id,
  i.user_id,
  i.date,
  i.returns_to_start,
  coalesce(sum(l.distance_km), 0)::numeric(10, 2) as total_km,
  coalesce(sum(l.duration_min), 0)::integer as total_duration_min,
  count(l.id)::integer as legs_count,
  (select count(*) from public.stops s where s.itinerary_id = i.id)::integer as stops_count,
  -- Segnali per l'UI: tratte corrette a mano e tratte solo stimate.
  count(l.id) filter (where l.source = 'manual')::integer as manual_legs_count,
  count(l.id) filter (where l.is_estimate)::integer as estimated_legs_count
from public.itineraries i
left join public.legs l on l.itinerary_id = i.id
group by i.id, i.user_id, i.date, i.returns_to_start;

comment on view public.itinerary_totals is
  'Totali per giornata (km, durata, conteggi). Rispetta le policy RLS: security_invoker.';

grant select on public.itinerary_totals to authenticated;

-- ---------------------------------------------------------------------------
-- invalida_tratte_non_adiacenti: unica fonte di verità sulle tratte valide.
--
-- Una tratta è valida se collega due tappe consecutive nell'ordine attuale,
-- oppure se è il rientro (ultima tappa -> null) e la giornata lo prevede.
-- Tutto il resto viene eliminato e il client ricalcola ciò che manca.
--
-- Attenzione: una tratta 'manual' su una coppia che non è più consecutiva
-- viene eliminata come le altre. È voluto: il valore inserito a mano si
-- riferiva a un tragitto che non esiste più.
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
    select o.id as from_id, null::uuid as to_id
    from ordinate o
    join public.itineraries i on i.id = p_itinerary_id
    where o.riga = o.totale
      and i.returns_to_start
  ),
  rimosse as (
    delete from public.legs l
    where l.itinerary_id = p_itinerary_id
      and not exists (
        select 1
        from attese a
        where a.from_id is not distinct from l.from_stop_id
          and a.to_id is not distinct from l.to_stop_id
      )
    returning 1
  )
  select count(*)::integer into v_eliminate from rimosse;

  return v_eliminate;
end;
$$;

comment on function public.invalida_tratte_non_adiacenti is
  'Elimina le tratte che non collegano più tappe consecutive. Restituisce quante ne ha eliminate.';

-- ---------------------------------------------------------------------------
-- reorder_stops: riordina la giornata in una sola transazione.
-- Riceve gli id delle tappe nell'ordine desiderato (elenco completo).
-- ---------------------------------------------------------------------------
create or replace function public.reorder_stops(p_itinerary_id uuid, p_ordered_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_forniti integer := coalesce(array_length(p_ordered_ids, 1), 0);
  v_distinti integer;
  v_totale integer;
begin
  -- RLS: se la giornata non è dell'utente, la select non la trova.
  if not exists (select 1 from public.itineraries i where i.id = p_itinerary_id) then
    raise exception 'Giornata non trovata' using errcode = 'no_data_found';
  end if;

  select count(*)::integer into v_totale
  from public.stops s
  where s.itinerary_id = p_itinerary_id;

  select count(distinct t.id)::integer into v_distinti
  from unnest(p_ordered_ids) as t(id);

  if v_distinti <> v_forniti then
    raise exception 'L''elenco contiene tappe duplicate' using errcode = 'check_violation';
  end if;

  if v_forniti <> v_totale then
    raise exception 'Elenco incompleto: la giornata ha % tappe, ricevute %', v_totale, v_forniti
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) as t(id)
    where not exists (
      select 1 from public.stops s
      where s.id = t.id and s.itinerary_id = p_itinerary_id
    )
  ) then
    raise exception 'Una delle tappe indicate non appartiene a questa giornata'
      using errcode = 'check_violation';
  end if;

  -- Riscrittura delle posizioni: gli stati intermedi violano l'unicità, ma il
  -- vincolo è DEFERRABLE INITIALLY DEFERRED e viene verificato al commit.
  update public.stops s
  set position = t.ord
  from unnest(p_ordered_ids) with ordinality as t(id, ord)
  where s.id = t.id
    and s.itinerary_id = p_itinerary_id
    and s.position <> t.ord;

  return public.invalida_tratte_non_adiacenti(p_itinerary_id);
end;
$$;

comment on function public.reorder_stops is
  'Riordina le tappe di una giornata e invalida le tratte coinvolte. Restituisce il numero di tratte da ricalcolare.';

-- ---------------------------------------------------------------------------
-- insert_stop_at: inserisce una tappa in una posizione qualsiasi, spostando
-- di uno le successive. p_position null = in coda.
-- ---------------------------------------------------------------------------
create or replace function public.insert_stop_at(
  p_itinerary_id uuid,
  p_label text,
  p_address text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_planned_time time default null,
  p_notes text default null,
  p_position integer default null
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

  -- Fuori intervallo o assente: si accoda.
  v_posizione := coalesce(p_position, v_totale + 1);
  if v_posizione < 1 or v_posizione > v_totale + 1 then
    v_posizione := v_totale + 1;
  end if;

  update public.stops s
  set position = s.position + 1
  where s.itinerary_id = p_itinerary_id
    and s.position >= v_posizione;

  insert into public.stops (
    itinerary_id, position, label, address, lat, lng, planned_time, notes
  )
  values (
    p_itinerary_id, v_posizione, p_label, p_address, p_lat, p_lng, p_planned_time, p_notes
  )
  returning * into v_tappa;

  perform public.invalida_tratte_non_adiacenti(p_itinerary_id);

  return v_tappa;
end;
$$;

comment on function public.insert_stop_at is
  'Inserisce una tappa (in coda o in mezzo), sposta le successive e invalida le tratte interessate.';

-- ---------------------------------------------------------------------------
-- delete_stop: elimina una tappa, richiude la numerazione e invalida le
-- tratte. Le tratte che toccavano la tappa spariscono per cascade; la coppia
-- che diventa consecutiva resterà senza tratta, da ricalcolare.
-- ---------------------------------------------------------------------------
create or replace function public.delete_stop(p_stop_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_itinerary_id uuid;
begin
  select s.itinerary_id into v_itinerary_id
  from public.stops s
  where s.id = p_stop_id;

  if v_itinerary_id is null then
    raise exception 'Tappa non trovata' using errcode = 'no_data_found';
  end if;

  delete from public.stops s where s.id = p_stop_id;

  -- Richiude eventuali buchi mantenendo position contigua da 1.
  update public.stops s
  set position = nuova.ord
  from (
    select s2.id, row_number() over (order by s2.position) as ord
    from public.stops s2
    where s2.itinerary_id = v_itinerary_id
  ) as nuova
  where s.id = nuova.id
    and s.position <> nuova.ord;

  return public.invalida_tratte_non_adiacenti(v_itinerary_id);
end;
$$;

comment on function public.delete_stop is
  'Elimina una tappa, ricompatta le posizioni e invalida le tratte non più valide.';

-- ---------------------------------------------------------------------------
-- duplicate_itinerary: copia le tappe di una giornata su un'altra data.
-- Le tratte non vengono copiate: le ricalcola il client (i km possono
-- cambiare e una copia con valori vecchi sarebbe fuorviante).
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
    -- Sostituzione: via le tappe esistenti (le tratte seguono per cascade).
    delete from public.stops s where s.itinerary_id = v_destinazione.id;
  else
    insert into public.itineraries (user_id, date, notes, returns_to_start)
    values (v_origine.user_id, p_target_date, v_origine.notes, v_origine.returns_to_start)
    returning * into v_destinazione;
  end if;

  update public.itineraries i
  set notes = v_origine.notes,
      returns_to_start = v_origine.returns_to_start
  where i.id = v_destinazione.id
  returning * into v_destinazione;

  insert into public.stops (
    itinerary_id, position, label, address, lat, lng, planned_time, notes
  )
  select v_destinazione.id, s.position, s.label, s.address, s.lat, s.lng, s.planned_time, s.notes
  from public.stops s
  where s.itinerary_id = v_origine.id
  order by s.position;

  return v_destinazione;
end;
$$;

comment on function public.duplicate_itinerary is
  'Copia le tappe di una giornata su un''altra data. Le tratte vanno ricalcolate.';

-- ---------------------------------------------------------------------------
-- Privilegi di esecuzione: solo utenti autenticati.
-- ---------------------------------------------------------------------------
revoke all on function public.reorder_stops(uuid, uuid[]) from public;
revoke all on function public.insert_stop_at(uuid, text, text, numeric, numeric, time, text, integer) from public;
revoke all on function public.delete_stop(uuid) from public;
revoke all on function public.duplicate_itinerary(uuid, date, boolean) from public;
revoke all on function public.invalida_tratte_non_adiacenti(uuid) from public;

grant execute on function public.reorder_stops(uuid, uuid[]) to authenticated;
grant execute on function public.insert_stop_at(uuid, text, text, numeric, numeric, time, text, integer) to authenticated;
grant execute on function public.delete_stop(uuid) to authenticated;
grant execute on function public.duplicate_itinerary(uuid, date, boolean) to authenticated;
grant execute on function public.owns_itinerary(uuid) to authenticated;
