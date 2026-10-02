-- ============================================================================
-- Partenze salvate: ognuno vede e modifica soltanto le proprie.
-- Gira in una transazione con ROLLBACK finale: non lascia dati.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'partenze.a@esempio.it',
   '$2a$10$hashfittiziosolopertest000000000000000000000', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'partenze.b@esempio.it',
   '$2a$10$hashfittiziosolopertest111111111111111111111', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

-- Utente A salva due partenze; user_id arriva da auth.uid() per default.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

insert into public.saved_starts (label, address, lat, lng)
values ('Casa', 'Via Nazionale 5, Roma', 41.9009, 12.4946),
       ('Ufficio', null, null, null);

do $$
begin
  assert (select count(*) from public.saved_starts) = 2, 'FALLITO: A non vede le sue partenze';
  assert (select bool_and(user_id = '33333333-3333-3333-3333-333333333333')
          from public.saved_starts), 'FALLITO: user_id non impostato da auth.uid()';

  begin
    insert into public.saved_starts (label, lat) values ('Mezza', 41.9);
    raise exception 'FALLITO: accettata una coordinata senza l''altra';
  exception when check_violation then null;
  end;

  begin
    insert into public.saved_starts (label) values ('   ');
    raise exception 'FALLITO: accettato un nome vuoto';
  exception when check_violation then null;
  end;
end $$;

-- Utente B non vede, non modifica e non cancella le partenze di A.
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

do $$
declare
  toccate integer;
begin
  assert (select count(*) from public.saved_starts) = 0, 'FALLITO: B vede le partenze di A';

  update public.saved_starts set label = 'Rubata';
  get diagnostics toccate = row_count;
  assert toccate = 0, 'FALLITO: B ha modificato le partenze di A';

  delete from public.saved_starts;
  get diagnostics toccate = row_count;
  assert toccate = 0, 'FALLITO: B ha cancellato le partenze di A';

  begin
    insert into public.saved_starts (user_id, label)
    values ('33333333-3333-3333-3333-333333333333', 'Intrusa');
    raise exception 'FALLITO: B ha creato una partenza a nome di A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- anon: nessun accesso.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  begin
    assert (select count(*) from public.saved_starts) = 0, 'FALLITO: anon legge le partenze';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

rollback;

\echo 'OK — test partenze salvate superati'
