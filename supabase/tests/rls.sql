-- ============================================================================
-- Test di isolamento RLS: l'utente B non deve poter leggere né modificare i
-- dati dell'utente A, in nessun modo.
--
-- Esecuzione (DB locale):
--   npm run db:test
-- oppure:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- Lo script gira dentro una transazione con ROLLBACK finale: non lascia dati.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

-- ---------------------------------------------------------------------------
-- Preparazione: due utenti applicativi
-- ---------------------------------------------------------------------------
\set utente_a '11111111-1111-1111-1111-111111111111'
\set utente_b '22222222-2222-2222-2222-222222222222'

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (:'utente_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'utente.a@esempio.it', '$2a$10$hashfittiziosolopertest000000000000000000000', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Utente A"}'),
  (:'utente_b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'utente.b@esempio.it', '$2a$10$hashfittiziosolopertest111111111111111111111', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Utente B"}');

-- Il trigger on_auth_user_created deve aver creato i profili.
do $$
begin
  assert (select count(*) from public.profiles
          where id in ('11111111-1111-1111-1111-111111111111',
                       '22222222-2222-2222-2222-222222222222')) = 2,
    'FALLITO: il trigger non ha creato i profili';
  assert (select full_name from public.profiles
          where id = '11111111-1111-1111-1111-111111111111') = 'Utente A',
    'FALLITO: full_name non copiato dai metadati utente';
end $$;

-- ---------------------------------------------------------------------------
-- Utente A crea una giornata con due tappe e una tratta
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_giornata uuid;
  v_tappa1 uuid;
  v_tappa2 uuid;
begin
  insert into public.itineraries (date, notes) values ('2026-03-02', 'Giro di A')
  returning id into v_giornata;

  insert into public.stops (itinerary_id, position, label, lat, lng)
  values (v_giornata, 1, 'Ufficio A', 45.464200, 9.189600) returning id into v_tappa1;

  insert into public.stops (itinerary_id, position, label, lat, lng)
  values (v_giornata, 2, 'Cliente A', 45.070300, 7.686900) returning id into v_tappa2;

  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, duration_min)
  values (v_giornata, v_tappa1, v_tappa2, 142.50, 105);

  -- user_id deve essere stato compilato dal default auth.uid()
  assert (select user_id from public.itineraries where id = v_giornata)
         = '11111111-1111-1111-1111-111111111111',
    'FALLITO: user_id non valorizzato da auth.uid()';
  assert (select count(*) from public.stops where user_id is null) = 0,
    'FALLITO: stops.user_id non valorizzato';
end $$;

-- A vede i propri dati
do $$
begin
  assert (select count(*) from public.itineraries) = 1, 'FALLITO: A non vede la propria giornata';
  assert (select count(*) from public.stops) = 2, 'FALLITO: A non vede le proprie tappe';
  assert (select count(*) from public.legs) = 1, 'FALLITO: A non vede le proprie tratte';
  assert (select total_km from public.itinerary_totals) = 142.50,
    'FALLITO: totale km errato nella vista';
end $$;

-- L'id della giornata di A viene messo da parte: serve per simulare un
-- attaccante che lo conosce già.
do $$
begin
  perform set_config(
    'test.giornata_a',
    (select i.id::text from public.itineraries i where i.date = '2026-03-02'),
    true
  );
end $$;

-- ---------------------------------------------------------------------------
-- Utente B: non deve vedere nulla di A
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
begin
  assert (select count(*) from public.itineraries) = 0,
    'FALLITO: B vede le giornate di A';
  assert (select count(*) from public.stops) = 0,
    'FALLITO: B vede le tappe di A';
  assert (select count(*) from public.legs) = 0,
    'FALLITO: B vede le tratte di A';
  assert (select count(*) from public.itinerary_totals) = 0,
    'FALLITO: la vista itinerary_totals espone i dati di A';
  assert (select count(*) from public.profiles) = 1,
    'FALLITO: B vede più di un profilo';
  assert (select id from public.profiles) = '22222222-2222-2222-2222-222222222222',
    'FALLITO: B vede il profilo di A';
end $$;

-- B non può modificare né eliminare i dati di A (0 righe toccate, non errore:
-- le righe sono semplicemente invisibili alla USING della policy).
do $$
declare
  v_righe integer;
begin
  update public.stops set label = 'Manomessa' where label = 'Ufficio A';
  get diagnostics v_righe = row_count;
  assert v_righe = 0, 'FALLITO: B ha aggiornato una tappa di A';

  update public.legs set distance_km = 1 where distance_km = 142.50;
  get diagnostics v_righe = row_count;
  assert v_righe = 0, 'FALLITO: B ha aggiornato una tratta di A';

  delete from public.stops;
  get diagnostics v_righe = row_count;
  assert v_righe = 0, 'FALLITO: B ha eliminato tappe di A';

  delete from public.itineraries;
  get diagnostics v_righe = row_count;
  assert v_righe = 0, 'FALLITO: B ha eliminato giornate di A';

  update public.profiles set full_name = 'Manomesso';
  get diagnostics v_righe = row_count;
  assert v_righe <= 1, 'FALLITO: B ha aggiornato profili altrui';
end $$;

-- B non può agganciare righe proprie alla giornata di A
do $$
declare
  v_giornata_a uuid;
begin
  -- Recupera l'id bypassando RLS solo per costruire il test.
  v_giornata_a := (
    select i.id from public.itineraries i where i.date = '2026-03-02' limit 1
  );
  assert v_giornata_a is null, 'FALLITO: B legge la giornata di A';
end $$;

-- Stesso tentativo con l'id noto (come farebbe un attaccante che lo indovina).
do $$
declare
  v_giornata_a uuid;
  v_errore text;
begin
  -- L'id viene letto in un contesto privilegiato prima di tornare a B.
  v_giornata_a := current_setting('test.giornata_a', true)::uuid;

  begin
    insert into public.stops (itinerary_id, position, label)
    values (v_giornata_a, 99, 'Tappa intrusa');
    raise exception 'FALLITO: B ha inserito una tappa nella giornata di A';
  exception
    when insufficient_privilege then
      null; -- atteso: la policy WITH CHECK ha bloccato l'inserimento
  end;

  begin
    insert into public.legs (itinerary_id, distance_km, from_stop_id)
    values (v_giornata_a, 10, null);
    raise exception 'FALLITO: B ha inserito una tratta nella giornata di A';
  exception
    when insufficient_privilege then
      null;
    when check_violation then
      null; -- anche il vincolo sugli estremi è una difesa accettabile
  end;

  -- Le RPC passano dalle stesse policy.
  begin
    perform public.reorder_stops(v_giornata_a, array[]::uuid[]);
    raise exception 'FALLITO: B ha riordinato la giornata di A';
  exception
    when no_data_found then
      null; -- atteso: per B la giornata non esiste
  end;

  begin
    perform public.duplicate_itinerary(v_giornata_a, '2026-03-09');
    raise exception 'FALLITO: B ha duplicato la giornata di A';
  exception
    when no_data_found then
      null;
  end;
end $$;

-- B non può falsificare user_id
do $$
begin
  begin
    insert into public.itineraries (user_id, date)
    values ('11111111-1111-1111-1111-111111111111', '2026-04-01');
    raise exception 'FALLITO: B ha creato una giornata a nome di A';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Ruolo anon: nessun accesso
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  begin
    perform 1 from public.itineraries;
    -- Se la SELECT passa deve almeno non restituire righe.
    assert (select count(*) from public.itineraries) = 0,
      'FALLITO: anon legge le giornate';
  exception
    when insufficient_privilege then
      null; -- atteso: nessun GRANT per anon
  end;

  begin
    perform 1 from public.profiles;
    assert (select count(*) from public.profiles) = 0, 'FALLITO: anon legge i profili';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;

rollback;

\echo 'OK — test RLS superati'
