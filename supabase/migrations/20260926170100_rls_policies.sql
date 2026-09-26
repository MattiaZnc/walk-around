-- ============================================================================
-- Row Level Security: ogni utente vede e modifica soltanto le proprie righe.
--
-- Note di implementazione:
--  * tutte le policy sono limitate al ruolo `authenticated`: il ruolo `anon`
--    (anon key senza login) non ha alcun accesso;
--  * auth.uid() è racchiuso in (select auth.uid()) così Postgres lo valuta una
--    volta sola per query invece che per ogni riga;
--  * per stops e legs non basta user_id = auth.uid(): serve anche che la
--    giornata collegata sia dell'utente, altrimenti si potrebbero attaccare
--    righe proprie alla giornata di un altro.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.itineraries enable row level security;
alter table public.stops enable row level security;
alter table public.legs enable row level security;

-- Nessuna eccezione per il proprietario delle tabelle: utile perché anche le
-- funzioni SECURITY DEFINER restano soggette alle policy dove non serve.
alter table public.profiles force row level security;
alter table public.itineraries force row level security;
alter table public.stops force row level security;
alter table public.legs force row level security;

-- ---------------------------------------------------------------------------
-- Helper: la giornata appartiene all'utente corrente?
-- SECURITY INVOKER + STABLE: la select interna passa a sua volta dalle policy
-- di itineraries, quindi non può rivelare giornate di altri utenti.
-- ---------------------------------------------------------------------------
create or replace function public.owns_itinerary(p_itinerary_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.itineraries i
    where i.id = p_itinerary_id
      and i.user_id = (select auth.uid())
  );
$$;

comment on function public.owns_itinerary is
  'true se la giornata indicata appartiene all''utente autenticato.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_proprio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- L'inserimento normalmente lo fa il trigger on_auth_user_created; la policy
-- serve come rete di sicurezza (es. profilo creato prima del trigger).
create policy "profiles_insert_proprio"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_proprio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Nessuna policy DELETE: il profilo si cancella solo con l'utente auth.users.

-- ---------------------------------------------------------------------------
-- itineraries
-- ---------------------------------------------------------------------------
create policy "itineraries_select_proprie"
  on public.itineraries for select to authenticated
  using (user_id = (select auth.uid()));

create policy "itineraries_insert_proprie"
  on public.itineraries for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "itineraries_update_proprie"
  on public.itineraries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "itineraries_delete_proprie"
  on public.itineraries for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- stops
-- ---------------------------------------------------------------------------
create policy "stops_select_proprie"
  on public.stops for select to authenticated
  using (user_id = (select auth.uid()));

create policy "stops_insert_proprie"
  on public.stops for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_itinerary(itinerary_id)
  );

create policy "stops_update_proprie"
  on public.stops for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.owns_itinerary(itinerary_id)
  );

create policy "stops_delete_proprie"
  on public.stops for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- legs
-- ---------------------------------------------------------------------------
create policy "legs_select_proprie"
  on public.legs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "legs_insert_proprie"
  on public.legs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_itinerary(itinerary_id)
  );

create policy "legs_update_proprie"
  on public.legs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.owns_itinerary(itinerary_id)
  );

create policy "legs_delete_proprie"
  on public.legs for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privilegi: senza GRANT le policy non entrano nemmeno in gioco.
-- `anon` non riceve nulla di proposito.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.itineraries to authenticated;
grant select, insert, update, delete on public.stops to authenticated;
grant select, insert, update, delete on public.legs to authenticated;
