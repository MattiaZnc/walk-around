-- ============================================================================
-- AGGIORNAMENTO — traguardi (tappe raggiunte e chilometri percorsi)
--
-- Da eseguire UNA VOLTA SOLA nell'SQL Editor, dopo
-- docs/aggiornamento-tappe-raggiunte.sql.
--
-- Aggiunge soltanto una funzione di lettura: nessuna tabella nuova, nessun
-- dato esistente viene modificato. Se va storto non lascia nulla a metà.
-- ============================================================================

begin;

create or replace function public.riepilogo_obiettivi(p_oggi date default current_date)
returns table (
  tappe_raggiunte integer,
  km_percorsi numeric,
  giornate_attive integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tappe_fatte as (
    select s.id, s.itinerary_id
    from public.stops s
    join public.itineraries i on i.id = s.itinerary_id
    where not s.is_start
      and (s.reached_at is not null or i.date < p_oggi)
  ),
  tratte_fatte as (
    select l.distance_km
    from public.legs l
    join public.stops arrivo on arrivo.id = l.to_stop_id
    join public.itineraries i on i.id = l.itinerary_id
    where i.date < p_oggi
       or (not arrivo.is_start and arrivo.reached_at is not null)
  )
  select
    (select count(*) from tappe_fatte)::integer,
    coalesce((select sum(t.distance_km) from tratte_fatte t), 0)::numeric(10, 2),
    (select count(distinct t.itinerary_id) from tappe_fatte t)::integer;
$$;

comment on function public.riepilogo_obiettivi is
  'Tappe raggiunte, km percorsi e giornate attive dell''utente corrente, per i traguardi.';

revoke all on function public.riepilogo_obiettivi(date) from public;
grant execute on function public.riepilogo_obiettivi(date) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260929100000', 'obiettivi')
on conflict (version) do nothing;

commit;

-- Controllo finale: deve restituire una riga. L'SQL Editor gira come
-- amministratore e non passa dalle policy RLS, quindi qui i totali sono quelli
-- di tutti gli utenti; nell'app ognuno vede solo i propri.
select * from public.riepilogo_obiettivi(current_date);
