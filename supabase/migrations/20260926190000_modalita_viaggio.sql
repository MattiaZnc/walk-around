-- ============================================================================
-- Modalità di viaggio per giornata.
--
-- Serve perché i chilometri dipendono dal mezzo: fra Colosseo e Villa Borghese
-- ci sono 3,55 km a piedi e 7,51 km in auto (i sensi unici del centro di Roma).
-- Senza questa informazione il ricalcolo non saprebbe quale percorso chiedere.
-- ============================================================================

alter table public.itineraries
  add column travel_mode text not null default 'auto';

alter table public.itineraries
  add constraint itineraries_travel_mode_valid
  check (travel_mode in ('auto', 'piedi', 'bici'));

comment on column public.itineraries.travel_mode is
  'Mezzo usato nella giornata: determina il profilo di calcolo dei percorsi.';

-- Cambiare mezzo rende le distanze esistenti non più valide: le tratte
-- calcolate automaticamente vanno rifatte, mentre quelle inserite a mano
-- restano (l'utente ha scritto un valore, decide lui se aggiornarlo).
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

create trigger itineraries_cambio_mezzo
  after update of travel_mode on public.itineraries
  for each row execute function public.itineraries_invalida_su_cambio_mezzo();

-- La vista espone il mezzo: serve al report e alla dashboard.
-- Serve drop + create: `create or replace view` può solo aggiungere colonne
-- in coda, non inserirne una in mezzo all'elenco.
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
  count(l.id) filter (where l.source = 'manual')::integer as manual_legs_count,
  count(l.id) filter (where l.is_estimate)::integer as estimated_legs_count
from public.itineraries i
left join public.legs l on l.itinerary_id = i.id
group by i.id, i.user_id, i.date, i.returns_to_start, i.travel_mode;

comment on view public.itinerary_totals is
  'Totali per giornata (km, durata, conteggi). Rispetta le policy RLS: security_invoker.';

grant select on public.itinerary_totals to authenticated;
