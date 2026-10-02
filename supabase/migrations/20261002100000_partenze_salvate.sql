-- ============================================================================
-- Partenze salvate.
--
-- Chi gira spesso parte da pochi posti ricorrenti (casa, ufficio, un hotel
-- per qualche giorno). Prima ce n'era uno solo, nel profilo; ora l'utente ne
-- tiene un elenco e, aprendo una giornata nuova, sceglie con un tocco.
--
-- La giornata non punta alla partenza salvata: ne copia i dati nella tappa
-- `is_start`. Così modificare o cancellare una partenza salvata non cambia le
-- giornate già fatte, e i chilometri del passato restano quelli.
-- ============================================================================

create table if not exists public.saved_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  address text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  created_at timestamptz not null default now(),

  constraint saved_starts_label_valida check (length(btrim(label)) between 1 and 80),
  constraint saved_starts_coords_complete check ((lat is null) = (lng is null)),
  constraint saved_starts_lat_range check (lat is null or lat between -90 and 90),
  constraint saved_starts_lng_range check (lng is null or lng between -180 and 180)
);

comment on table public.saved_starts is
  'Punti di partenza ricorrenti dell''utente, proposti all''apertura di una giornata.';

create index if not exists saved_starts_utente_idx
  on public.saved_starts (user_id, created_at);

alter table public.saved_starts enable row level security;
alter table public.saved_starts force row level security;

drop policy if exists "saved_starts_select_proprie" on public.saved_starts;
create policy "saved_starts_select_proprie"
  on public.saved_starts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "saved_starts_insert_proprie" on public.saved_starts;
create policy "saved_starts_insert_proprie"
  on public.saved_starts for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "saved_starts_update_proprie" on public.saved_starts;
create policy "saved_starts_update_proprie"
  on public.saved_starts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "saved_starts_delete_proprie" on public.saved_starts;
create policy "saved_starts_delete_proprie"
  on public.saved_starts for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.saved_starts to authenticated;

-- L'indirizzo predefinito del profilo diventa la prima partenza salvata, così
-- chi lo aveva impostato non lo perde. Solo per chi non ha ancora partenze:
-- rieseguire lo script non crea doppioni.
insert into public.saved_starts (user_id, label, address, lat, lng)
select p.id, 'Casa', p.default_start_address, p.default_start_lat, p.default_start_lng
from public.profiles p
where p.default_start_address is not null
  and btrim(p.default_start_address) <> ''
  and not exists (select 1 from public.saved_starts s where s.user_id = p.id);
