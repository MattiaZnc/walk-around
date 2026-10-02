-- ============================================================================
-- FILE GENERATO — non modificare a mano.
-- Rigeneralo con:  npm run db:sql
-- Sorgente: supabase/migrations/*.sql (quelle restano la fonte di verità)
--
-- USO: dashboard Supabase -> SQL Editor -> New query -> incolla tutto -> Run.
--      Va eseguito UNA VOLTA SOLA: crea tabelle, policy, viste e funzioni.
--      Se lo esegui due volte la seconda si ferma con "already exists" senza
--      aver modificato nulla (gira tutto in un'unica transazione).
-- ============================================================================

begin;


-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260926170000_schema_iniziale.sql
-- └──────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Schema iniziale: profili, giorni (itineraries), tappe (stops), tratte (legs)
--
-- Convenzioni:
--  * ogni tabella porta user_id con default auth.uid(): le policy RLS della
--    migration successiva filtrano tutto su quella colonna;
--  * i timestamp sono timestamptz e updated_at è gestito da trigger;
--  * le coordinate usano numeric(9,6) (~11 cm di precisione, più che
--    sufficiente per indirizzi stradali).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Funzione condivisa: aggiorna updated_at ad ogni UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger BEFORE UPDATE: mantiene updated_at allineato senza fidarsi del client.';

-- ---------------------------------------------------------------------------
-- profiles: dati anagrafici e punto di partenza predefinito
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  default_start_address text,
  default_start_lat numeric(9, 6),
  default_start_lng numeric(9, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Latitudine e longitudine vanno sempre insieme: mezza coordinata è inutile.
  constraint profiles_start_coords_complete
    check ((default_start_lat is null) = (default_start_lng is null)),
  constraint profiles_start_lat_range
    check (default_start_lat is null or default_start_lat between -90 and 90),
  constraint profiles_start_lng_range
    check (default_start_lng is null or default_start_lng between -180 and 180)
);

comment on table public.profiles is
  'Un profilo per utente di auth.users, creato dal trigger on_auth_user_created.';
comment on column public.profiles.default_start_address is
  'Indirizzo di partenza suggerito e usato per la tratta di rientro.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creazione automatica del profilo quando l'amministratore aggiunge un utente
-- dalla dashboard. SECURITY DEFINER perché scrive su una tabella protetta da
-- RLS in un contesto (trigger su auth.users) senza auth.uid().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user is
  'Crea la riga in public.profiles per ogni nuovo utente in auth.users.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- itineraries: una riga per giornata pianificata
-- ---------------------------------------------------------------------------
create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  notes text,
  -- Se true l'ultima tratta torna all'indirizzo di partenza del profilo
  -- (tratta con to_stop_id null).
  returns_to_start boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint itineraries_user_date_key unique (user_id, date)
);

comment on table public.itineraries is 'Una giornata di itinerario per utente.';
comment on column public.itineraries.returns_to_start is
  'Aggiunge la tratta di rientro verso default_start_address del profilo.';

create index itineraries_user_date_idx on public.itineraries (user_id, date desc);

create trigger itineraries_set_updated_at
  before update on public.itineraries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stops: tappe ordinate dentro la giornata
-- ---------------------------------------------------------------------------
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  label text not null,
  address text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  planned_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stops_label_non_vuota check (btrim(label) <> ''),
  constraint stops_position_positive check (position >= 1),
  constraint stops_coords_complete check ((lat is null) = (lng is null)),
  constraint stops_lat_range check (lat is null or lat between -90 and 90),
  constraint stops_lng_range check (lng is null or lng between -180 and 180),

  -- DEFERRABLE: il riordino riscrive più position nella stessa transazione e
  -- passa per stati temporaneamente duplicati.
  constraint stops_itinerary_position_key unique (itinerary_id, position)
    deferrable initially deferred
);

comment on table public.stops is
  'Tappe della giornata. position è 1-based e contigua (garantita dalle RPC).';
comment on column public.stops.lat is
  'Null se la tappa non è geolocalizzata: in quel caso le tratte restano manuali.';

create index stops_itinerary_position_idx on public.stops (itinerary_id, position);
create index stops_user_idx on public.stops (user_id);

create trigger stops_set_updated_at
  before update on public.stops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- legs: tratte fra due tappe consecutive (o dall'ultima tappa al rientro)
-- ---------------------------------------------------------------------------
create table public.legs (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_stop_id uuid references public.stops (id) on delete cascade,
  to_stop_id uuid references public.stops (id) on delete cascade,
  distance_km numeric(8, 2) not null,
  duration_min integer,
  -- 'manual': valore corretto a mano, il ricalcolo automatico non lo sovrascrive.
  source text not null default 'auto',
  -- true quando la distanza è una stima (provider di riserva, nessuna API key).
  is_estimate boolean not null default false,
  route_geometry jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legs_distance_positive check (distance_km >= 0),
  constraint legs_duration_positive check (duration_min is null or duration_min >= 0),
  constraint legs_source_valid check (source in ('auto', 'manual')),
  -- Almeno un estremo deve esistere (to_stop_id null = rientro al punto di partenza).
  constraint legs_has_endpoint check (from_stop_id is not null or to_stop_id is not null),
  constraint legs_endpoints_distinct check (from_stop_id is distinct from to_stop_id)
);

comment on table public.legs is
  'Tratta fra due tappe consecutive; to_stop_id null indica il rientro al punto di partenza.';
comment on column public.legs.source is
  'auto = calcolata dalla Edge Function; manual = inserita o corretta dall''utente.';
comment on column public.legs.is_estimate is
  'true se la distanza è stimata (linea d''aria corretta) e non un percorso reale.';

-- Una sola tratta in uscita da ogni tappa: impedisce duplicati sia fra tappe
-- consecutive sia sul rientro. NULLS NOT DISTINCT tratta i null come uguali.
create unique index legs_itinerary_from_key
  on public.legs (itinerary_id, from_stop_id) nulls not distinct;

create index legs_itinerary_idx on public.legs (itinerary_id);
create index legs_user_idx on public.legs (user_id);

create trigger legs_set_updated_at
  before update on public.legs
  for each row execute function public.set_updated_at();

-- Coerenza referenziale che le FK non possono esprimere: le tappe di una
-- tratta devono appartenere alla stessa giornata della tratta.
create or replace function public.legs_valida_estremi()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  giornata_from uuid;
  giornata_to uuid;
begin
  if new.from_stop_id is not null then
    select s.itinerary_id into giornata_from from public.stops s where s.id = new.from_stop_id;
    if giornata_from is distinct from new.itinerary_id then
      raise exception 'La tappa di partenza appartiene a un''altra giornata'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.to_stop_id is not null then
    select s.itinerary_id into giornata_to from public.stops s where s.id = new.to_stop_id;
    if giornata_to is distinct from new.itinerary_id then
      raise exception 'La tappa di arrivo appartiene a un''altra giornata'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger legs_valida_estremi
  before insert or update of itinerary_id, from_stop_id, to_stop_id on public.legs
  for each row execute function public.legs_valida_estremi();

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260926170100_rls_policies.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260926170200_viste_e_funzioni.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260926190000_modalita_viaggio.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260928100000_partenza_giornata.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260928160000_tappe_raggiunte.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20260929100000_obiettivi.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ 20261002100000_partenze_salvate.sql
-- └──────────────────────────────────────────────────────────────────────

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

-- ┌──────────────────────────────────────────────────────────────────────
-- │ Registrazione delle migration applicate
-- │
-- │ Serve perché una futura `supabase db push` sappia che questo schema
-- │ c'è già e applichi soltanto le migration successive.
-- └──────────────────────────────────────────────────────────────────────

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

insert into supabase_migrations.schema_migrations (version, name)
values ('20260926170000', 'schema_iniziale')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260926170100', 'rls_policies')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260926170200', 'viste_e_funzioni')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260926190000', 'modalita_viaggio')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260928100000', 'partenza_giornata')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260928160000', 'tappe_raggiunte')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260929100000', 'obiettivi')
on conflict (version) do nothing;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261002100000', 'partenze_salvate')
on conflict (version) do nothing;

commit;

-- Controllo finale: le quattro tabelle devono avere RLS attiva.
select
  relname as tabella,
  relrowsecurity as rls_attiva,
  relforcerowsecurity as rls_forzata
from pg_class
where relname in ('profiles', 'itineraries', 'stops', 'legs')
  and relnamespace = 'public'::regnamespace
order by relname;
