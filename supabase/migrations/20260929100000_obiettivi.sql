-- ============================================================================
-- Traguardi: tappe raggiunte e chilometri percorsi, in totale.
--
-- Una funzione invece di una tabella: i traguardi si ricavano dai dati che ci
-- sono già, e salvarli a parte vorrebbe dire tenerli allineati a mano ogni
-- volta che una tappa viene spostata, annullata o eliminata.
--
-- Regole di conteggio:
--  * una tappa conta quando è stata raggiunta (reached_at) oppure se la sua
--    giornata è passata: chi non usa "Seguimi" altrimenti non sbloccherebbe
--    mai nulla. La tappa di partenza non conta: da lì si parte, non ci si
--    arriva;
--  * una tratta conta quando la sua tappa di arrivo è raggiunta, oppure se la
--    giornata è passata;
--  * il rientro (tratta che arriva alla tappa di partenza) conta solo per le
--    giornate passate. La partenza risulta raggiunta fin dall'inizio del giro,
--    quindi con la regola generale il rientro verrebbe contato prima di
--    tornare davvero.
--
-- p_oggi arriva dal client: il database lavora in UTC, e vicino alla
-- mezzanotte italiana current_date indicherebbe il giorno sbagliato.
-- ============================================================================

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
