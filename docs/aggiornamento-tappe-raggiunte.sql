-- ============================================================================
-- AGGIORNAMENTO — tappe raggiunte
--
-- Da eseguire UNA VOLTA SOLA nell'SQL Editor, dopo docs/aggiornamento-partenza.sql.
--
-- Aggiunge stops.reached_at (il momento in cui si è arrivati a una tappa) e il
-- conteggio delle tappe raggiunte nella vista dei totali. Nessun dato esistente
-- viene toccato: le tappe già inserite risultano semplicemente non raggiunte.
-- ============================================================================

begin;

-- ============================================================================
-- Tappe raggiunte.
--
-- Durante il giro l'app segue la posizione e marca la tappa quando ci si
-- avvicina. Il momento viene salvato (non un semplice "sì/no") perché sapere
-- a che ora si è arrivati è l'informazione utile quando si riguarda la
-- giornata: permette di confrontare l'orario previsto con quello effettivo.
--
-- Null = non raggiunta. Così non serve un valore predefinito da interpretare.
-- ============================================================================

alter table public.stops
  add column if not exists reached_at timestamptz;

comment on column public.stops.reached_at is
  'Momento in cui la tappa è stata raggiunta; null se non lo è ancora.';

-- Le query filtrano spesso sulle tappe già raggiunte di una giornata.
create index if not exists stops_raggiunte_idx
  on public.stops (itinerary_id)
  where reached_at is not null;

-- ---------------------------------------------------------------------------
-- La vista espone quante tappe sono state raggiunte: serve alla dashboard per
-- mostrare l'avanzamento senza caricare tutte le tappe di ogni giornata.
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
  (select count(*) from public.stops s
    where s.itinerary_id = i.id and s.reached_at is not null)::integer as reached_count,
  (select count(*) > 0 from public.stops s where s.itinerary_id = i.id and s.is_start) as has_start,
  count(l.id) filter (where l.source = 'manual')::integer as manual_legs_count,
  count(l.id) filter (where l.is_estimate)::integer as estimated_legs_count
from public.itineraries i
left join public.legs l on l.itinerary_id = i.id
group by i.id, i.user_id, i.date, i.returns_to_start, i.travel_mode;

comment on view public.itinerary_totals is
  'Totali per giornata (km, durata, conteggi, tappe raggiunte). Rispetta le policy RLS.';

grant select on public.itinerary_totals to authenticated;

-- ---------------------------------------------------------------------------
-- Duplicando una giornata le tappe ripartono da "non raggiunte": si copia un
-- itinerario da percorrere, non il resoconto di uno già fatto.
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

  -- reached_at non viene copiato: la copia è un itinerario da percorrere.
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
  'Copia le tappe di una giornata su un''altra data, senza le tratte né i passaggi già effettuati.';

insert into supabase_migrations.schema_migrations (version, name)
values ('20260928160000', 'tappe_raggiunte')
on conflict (version) do nothing;

commit;

-- Controllo finale: la colonna deve esistere e ammettere il valore nullo.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'stops' and column_name = 'reached_at';
