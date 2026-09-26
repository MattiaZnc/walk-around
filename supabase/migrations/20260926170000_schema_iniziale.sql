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
