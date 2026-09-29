-- ============================================================================
-- Test della funzione riepilogo_obiettivi: le regole di conteggio dei
-- traguardi. Gira come utente applicativo, in una transazione annullata.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'traguardi@esempio.it',
   '$2a$10$hashfittiziosolopertest555555555555555555555', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'altro@esempio.it',
   '$2a$10$hashfittiziosolopertest666666666666666666666', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

do $$
declare
  v_ieri uuid;
  v_oggi uuid;
  p uuid; a uuid; b uuid;
  q uuid; c uuid; d uuid;
  r record;
begin
  -- Senza dati: tutto a zero.
  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 0 and r.km_percorsi = 0 and r.giornate_attive = 0,
    'FALLITO: senza dati i conteggi devono essere a zero';

  -- Giornata passata, con rientro: conta tutto, anche se nulla è segnato.
  insert into public.itineraries (date, returns_to_start) values ('2026-09-28', true)
    returning id into v_ieri;
  p := (public.insert_stop_at(v_ieri, 'Casa', null, null, null, null, null, null, true)).id;
  a := (public.insert_stop_at(v_ieri, 'A')).id;
  b := (public.insert_stop_at(v_ieri, 'B')).id;
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km) values
    (v_ieri, p, a, 2.0), (v_ieri, a, b, 3.0), (v_ieri, b, p, 4.0);

  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 2,
    format('FALLITO: giornata passata, attese 2 tappe (partenza esclusa), ottenute %s', r.tappe_raggiunte);
  assert r.km_percorsi = 9.00,
    format('FALLITO: giornata passata, attesi 9 km rientro compreso, ottenuti %s', r.km_percorsi);
  assert r.giornate_attive = 1, 'FALLITO: giornate attive errate';

  -- Giornata di oggi: contano solo le tappe raggiunte.
  insert into public.itineraries (date, returns_to_start) values ('2026-09-29', true)
    returning id into v_oggi;
  q := (public.insert_stop_at(v_oggi, 'Hotel', null, null, null, null, null, null, true)).id;
  c := (public.insert_stop_at(v_oggi, 'C')).id;
  d := (public.insert_stop_at(v_oggi, 'D')).id;
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km) values
    (v_oggi, q, c, 1.5), (v_oggi, c, d, 2.5), (v_oggi, d, q, 3.5);

  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 2 and r.km_percorsi = 9.00,
    'FALLITO: una giornata di oggi senza tappe raggiunte non deve contare';

  -- La partenza risulta raggiunta all'inizio del giro: il rientro NON deve
  -- contare per questo, e la partenza non è una tappa da contare.
  update public.stops set reached_at = now() where id = q;
  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 2 and r.km_percorsi = 9.00,
    format('FALLITO: la partenza raggiunta non deve contare né far contare il rientro (%s tappe, %s km)',
           r.tappe_raggiunte, r.km_percorsi);

  -- Arrivo a C: conta la tappa e la tratta che ci arriva.
  update public.stops set reached_at = now() where id = c;
  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 3,
    format('FALLITO: attese 3 tappe dopo l''arrivo a C, ottenute %s', r.tappe_raggiunte);
  assert r.km_percorsi = 10.50,
    format('FALLITO: attesi 10,5 km dopo l''arrivo a C, ottenuti %s', r.km_percorsi);
  assert r.giornate_attive = 2, 'FALLITO: la giornata di oggi ora è attiva';

  -- Arrivo a D.
  update public.stops set reached_at = now() where id = d;
  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 4 and r.km_percorsi = 13.00,
    format('FALLITO: dopo D attese 4 tappe e 13 km (%s, %s)', r.tappe_raggiunte, r.km_percorsi);

  -- Il giorno dopo, la giornata è passata: entra anche il rientro.
  select * into r from public.riepilogo_obiettivi('2026-09-30');
  assert r.km_percorsi = 16.50,
    format('FALLITO: a giornata conclusa il rientro va contato (%s km)', r.km_percorsi);

  -- Annullando un arrivo il conteggio scende: nessuno stato da riallineare.
  update public.stops set reached_at = null where id = d;
  select * into r from public.riepilogo_obiettivi('2026-09-29');
  assert r.tappe_raggiunte = 3 and r.km_percorsi = 10.50,
    'FALLITO: annullare un arrivo deve togliere tappa e km dal conteggio';
end $$;

-- Un altro utente non vede i traguardi del primo.
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

do $$
declare
  r record;
begin
  select * into r from public.riepilogo_obiettivi('2026-09-30');
  assert r.tappe_raggiunte = 0 and r.km_percorsi = 0,
    'FALLITO: i conteggi includono dati di un altro utente';
end $$;

rollback;

\echo 'OK — test traguardi superati'
