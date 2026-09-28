-- ============================================================================
-- Test delle funzioni RPC e dei vincoli di integrità.
-- Gira come utente applicativo (non come postgres) così anche le policy RLS
-- sono attraversate davvero.
--
-- Esecuzione: npm run db:test
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

\set utente '33333333-3333-3333-3333-333333333333'

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  :'utente', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'tester@esempio.it', '$2a$10$hashfittiziosolopertest333333333333333333333', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Tester"}'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- insert_stop_at: accodamento e inserimento in mezzo
-- ---------------------------------------------------------------------------
do $$
declare
  v_giornata uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_invalidate integer;
begin
  insert into public.itineraries (date) values ('2026-05-04') returning id into v_giornata;

  -- Tre tappe accodate: le posizioni devono essere 1, 2, 3.
  v_a := (public.insert_stop_at(v_giornata, 'Magazzino')).id;
  v_b := (public.insert_stop_at(v_giornata, 'Cliente 1')).id;
  v_c := (public.insert_stop_at(v_giornata, 'Cliente 2')).id;

  assert (select array_agg(s.label order by s.position) from public.stops s
          where s.itinerary_id = v_giornata)
         = array['Magazzino', 'Cliente 1', 'Cliente 2'],
    'FALLITO: ordine di accodamento errato';
  assert (select array_agg(s.position order by s.position) from public.stops s
          where s.itinerary_id = v_giornata) = array[1, 2, 3],
    'FALLITO: posizioni non contigue dopo l''accodamento';

  -- Due tratte consecutive, una corretta a mano.
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, source)
  values (v_giornata, v_a, v_b, 10.00, 'manual'),
         (v_giornata, v_b, v_c, 20.00, 'auto');

  -- Inserimento in posizione 2: spinge Cliente 1 e Cliente 2 in basso e
  -- rompe la tratta Magazzino -> Cliente 1 (non più consecutivi).
  perform public.insert_stop_at(v_giornata, 'Sosta carburante', null, null, null, null, null, 2);

  assert (select array_agg(s.label order by s.position) from public.stops s
          where s.itinerary_id = v_giornata)
         = array['Magazzino', 'Sosta carburante', 'Cliente 1', 'Cliente 2'],
    'FALLITO: inserimento in mezzo non ha spostato le tappe successive';

  -- La tratta manuale Magazzino->Cliente 1 va eliminata, quella Cliente1->Cliente2 resta.
  assert (select count(*) from public.legs l where l.itinerary_id = v_giornata) = 1,
    'FALLITO: le tratte non adiacenti non sono state invalidate';
  assert (select l.from_stop_id from public.legs l where l.itinerary_id = v_giornata) = v_b,
    'FALLITO: invalidata la tratta sbagliata';

  -- Posizione fuori intervallo: si accoda senza errore.
  perform public.insert_stop_at(v_giornata, 'Rientro sede', null, null, null, null, null, 99);
  assert (select s.position from public.stops s
          where s.itinerary_id = v_giornata and s.label = 'Rientro sede') = 5,
    'FALLITO: posizione fuori intervallo non accodata';

  v_invalidate := public.invalida_tratte_non_adiacenti(v_giornata);
  assert v_invalidate = 0, 'FALLITO: invalidazione non idempotente';
end $$;

-- ---------------------------------------------------------------------------
-- reorder_stops
-- ---------------------------------------------------------------------------
do $$
declare
  v_giornata uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_invalidate integer;
begin
  insert into public.itineraries (date) values ('2026-05-05') returning id into v_giornata;

  v_a := (public.insert_stop_at(v_giornata, 'A')).id;
  v_b := (public.insert_stop_at(v_giornata, 'B')).id;
  v_c := (public.insert_stop_at(v_giornata, 'C')).id;

  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
  values (v_giornata, v_a, v_b, 5.00),
         (v_giornata, v_b, v_c, 7.00);

  -- A, C, B: la coppia A-B non è più consecutiva, B-C neppure (si invertono).
  v_invalidate := public.reorder_stops(v_giornata, array[v_a, v_c, v_b]);

  assert (select array_agg(s.label order by s.position) from public.stops s
          where s.itinerary_id = v_giornata) = array['A', 'C', 'B'],
    'FALLITO: reorder_stops non ha riscritto le posizioni';
  assert (select array_agg(s.position order by s.position) from public.stops s
          where s.itinerary_id = v_giornata) = array[1, 2, 3],
    'FALLITO: posizioni non contigue dopo il riordino';
  assert v_invalidate = 2, format('FALLITO: attese 2 tratte invalidate, ottenute %s', v_invalidate);
  assert (select count(*) from public.legs l where l.itinerary_id = v_giornata) = 0,
    'FALLITO: tratte non adiacenti sopravvissute al riordino';

  -- Scambio delle ultime due: la coppia iniziale A-C resta consecutiva e la
  -- sua tratta non va toccata.
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
  values (v_giornata, v_a, v_c, 3.00);
  v_invalidate := public.reorder_stops(v_giornata, array[v_a, v_c, v_b]);
  assert v_invalidate = 0, 'FALLITO: riordino identico ha invalidato tratte valide';
  assert (select distance_km from public.legs l where l.itinerary_id = v_giornata) = 3.00,
    'FALLITO: tratta ancora valida modificata dal riordino';
end $$;

-- reorder_stops rifiuta elenchi non validi
do $$
declare
  v_giornata uuid;
  v_a uuid;
  v_b uuid;
begin
  insert into public.itineraries (date) values ('2026-05-06') returning id into v_giornata;
  v_a := (public.insert_stop_at(v_giornata, 'A')).id;
  v_b := (public.insert_stop_at(v_giornata, 'B')).id;

  begin
    perform public.reorder_stops(v_giornata, array[v_a]);
    raise exception 'FALLITO: accettato un elenco incompleto';
  exception
    when check_violation then null;
  end;

  begin
    perform public.reorder_stops(v_giornata, array[v_a, v_a]);
    raise exception 'FALLITO: accettato un elenco con duplicati';
  exception
    when check_violation then null;
  end;

  begin
    perform public.reorder_stops(v_giornata, array[v_a, gen_random_uuid()]);
    raise exception 'FALLITO: accettata una tappa estranea alla giornata';
  exception
    when check_violation then null;
  end;

  -- Dopo i tentativi falliti l'ordine originale resta intatto.
  assert (select array_agg(s.label order by s.position) from public.stops s
          where s.itinerary_id = v_giornata) = array['A', 'B'],
    'FALLITO: un riordino rifiutato ha comunque modificato le tappe';
  assert v_b is not null, 'FALLITO: tappa B non creata';
end $$;

-- ---------------------------------------------------------------------------
-- delete_stop: ricompattazione e invalidazione
-- ---------------------------------------------------------------------------
do $$
declare
  v_giornata uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_invalidate integer;
begin
  insert into public.itineraries (date) values ('2026-05-07') returning id into v_giornata;
  v_a := (public.insert_stop_at(v_giornata, 'A')).id;
  v_b := (public.insert_stop_at(v_giornata, 'B')).id;
  v_c := (public.insert_stop_at(v_giornata, 'C')).id;

  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
  values (v_giornata, v_a, v_b, 5.00),
         (v_giornata, v_b, v_c, 7.00);

  -- Eliminando B, le due tratte spariscono per cascade e A-C resta da ricalcolare.
  v_invalidate := public.delete_stop(v_b);

  assert (select array_agg(s.label order by s.position) from public.stops s
          where s.itinerary_id = v_giornata) = array['A', 'C'],
    'FALLITO: tappa non eliminata';
  assert (select array_agg(s.position order by s.position) from public.stops s
          where s.itinerary_id = v_giornata) = array[1, 2],
    'FALLITO: posizioni non ricompattate dopo l''eliminazione';
  assert (select count(*) from public.legs l where l.itinerary_id = v_giornata) = 0,
    'FALLITO: tratte orfane rimaste dopo l''eliminazione';
  assert v_invalidate = 0,
    'FALLITO: il cascade ha già rimosso le tratte, nulla da invalidare';

  begin
    perform public.delete_stop(gen_random_uuid());
    raise exception 'FALLITO: delete_stop accetta una tappa inesistente';
  exception
    when no_data_found then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Tratta di rientro (returns_to_start) e vista dei totali
-- ---------------------------------------------------------------------------
do $$
declare
  v_giornata uuid;
  v_a uuid;
  v_b uuid;
  v_invalidate integer;
begin
  insert into public.itineraries (date, returns_to_start)
  values ('2026-05-08', true) returning id into v_giornata;

  -- La partenza è una tappa marcata con is_start.
  v_a := (public.insert_stop_at(v_giornata, 'Sede', null, null, null, null, null, null, true)).id;
  v_b := (public.insert_stop_at(v_giornata, 'Cantiere')).id;

  assert (select s.is_start from public.stops s where s.id = v_a),
    'FALLITO: il flag di partenza non è stato salvato';
  assert (select s.position from public.stops s where s.id = v_a) = 1,
    'FALLITO: la partenza non è in prima posizione';

  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, duration_min)
  values (v_giornata, v_a, v_b, 12.30, 25);
  -- Rientro: dall'ultima tappa alla tappa di partenza.
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, duration_min, source)
  values (v_giornata, v_b, v_a, 11.70, 22, 'manual');

  v_invalidate := public.invalida_tratte_non_adiacenti(v_giornata);
  assert v_invalidate = 0, 'FALLITO: la tratta di rientro è stata invalidata per errore';

  assert (select total_km from public.itinerary_totals t where t.itinerary_id = v_giornata) = 24.00,
    'FALLITO: totale km errato con rientro';
  assert (select total_duration_min from public.itinerary_totals t
          where t.itinerary_id = v_giornata) = 47,
    'FALLITO: durata totale errata';
  assert (select legs_count from public.itinerary_totals t where t.itinerary_id = v_giornata) = 2,
    'FALLITO: conteggio tratte errato';
  assert (select stops_count from public.itinerary_totals t where t.itinerary_id = v_giornata) = 2,
    'FALLITO: conteggio tappe errato';
  assert (select manual_legs_count from public.itinerary_totals t
          where t.itinerary_id = v_giornata) = 1,
    'FALLITO: conteggio tratte manuali errato';

  assert (select has_start from public.itinerary_totals t where t.itinerary_id = v_giornata),
    'FALLITO: la vista non segnala la presenza della partenza';

  -- Con due tappe e rientro il giro è un anello: invertendole le coppie
  -- richieste restano (b,a) e (a,b), cioè esattamente le tratte esistenti.
  -- Nessuna invalidazione è la risposta giusta.
  v_invalidate := public.reorder_stops(v_giornata, array[v_b, v_a]);
  assert v_invalidate = 0,
    format('FALLITO: un anello di due tappe non va invalidato, ottenute %s', v_invalidate);
  assert (select total_km from public.itinerary_totals t where t.itinerary_id = v_giornata) = 24.00,
    'FALLITO: i totali non dovevano cambiare';

  -- Giornata senza tratte: la vista deve comunque restituire una riga a zero.
  assert (select count(*) from public.itinerary_totals t where t.itinerary_id = v_giornata) = 1,
    'FALLITO: la vista perde le giornate senza tratte';
end $$;

-- Con tre tappe e rientro, spostare una tappa cambia davvero le coppie.
do $$
declare
  v_giornata uuid;
  v_p uuid;
  v_x uuid;
  v_y uuid;
  v_invalidate integer;
begin
  insert into public.itineraries (date, returns_to_start)
  values ('2026-05-11', true) returning id into v_giornata;

  v_p := (public.insert_stop_at(v_giornata, 'Partenza', null, null, null, null, null, null, true)).id;
  v_x := (public.insert_stop_at(v_giornata, 'X')).id;
  v_y := (public.insert_stop_at(v_giornata, 'Y')).id;

  -- Anello completo: P→X, X→Y, Y→P (rientro).
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
  values (v_giornata, v_p, v_x, 3), (v_giornata, v_x, v_y, 4), (v_giornata, v_y, v_p, 5);

  assert public.invalida_tratte_non_adiacenti(v_giornata) = 0,
    'FALLITO: un anello completo di tre tappe è stato invalidato';
  assert (select total_km from public.itinerary_totals t where t.itinerary_id = v_giornata) = 12.00,
    'FALLITO: totale errato sull''anello di tre tappe';

  -- Scambiando X e Y: le coppie diventano P→Y, Y→X, X→P. Nessuna delle tre
  -- tratte precedenti sopravvive.
  v_invalidate := public.reorder_stops(v_giornata, array[v_p, v_y, v_x]);
  assert v_invalidate = 3,
    format('FALLITO: attese 3 invalidazioni, ottenute %s', v_invalidate);
  assert (select count(*) from public.legs l where l.itinerary_id = v_giornata) = 0,
    'FALLITO: tratte non valide sopravvissute al riordino';
end $$;

-- Con una sola tappa non esiste rientro: sarebbe una tratta da A ad A.
do $$
declare
  v_giornata uuid;
  v_sola uuid;
begin
  insert into public.itineraries (date, returns_to_start)
  values ('2026-05-09', true) returning id into v_giornata;
  v_sola := (public.insert_stop_at(v_giornata, 'Unica', null, null, null, null, null, null, true)).id;

  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
    values (v_giornata, v_sola, v_sola, 5);
    raise exception 'FALLITO: accettata una tratta da una tappa a se stessa';
  exception when check_violation then null; end;

  assert public.invalida_tratte_non_adiacenti(v_giornata) = 0,
    'FALLITO: invalidazione inattesa su una giornata con una sola tappa';
end $$;

-- Una seconda partenza sposta il flag, non lo duplica.
do $$
declare
  v_giornata uuid;
  v_prima uuid;
  v_seconda uuid;
begin
  insert into public.itineraries (date) values ('2026-05-10') returning id into v_giornata;
  v_prima := (public.insert_stop_at(v_giornata, 'Casa', null, null, null, null, null, null, true)).id;
  v_seconda := (public.insert_stop_at(v_giornata, 'Ufficio', null, null, null, null, null, null, true)).id;

  assert (select count(*) from public.stops s
          where s.itinerary_id = v_giornata and s.is_start) = 1,
    'FALLITO: due tappe marcate come partenza';
  assert (select s.is_start from public.stops s where s.id = v_seconda),
    'FALLITO: la nuova partenza non ha il flag';
  assert not (select s.is_start from public.stops s where s.id = v_prima),
    'FALLITO: la vecchia partenza ha mantenuto il flag';
  assert (select s.position from public.stops s where s.id = v_seconda) = 1,
    'FALLITO: la nuova partenza non è in prima posizione';
end $$;

-- ---------------------------------------------------------------------------
-- duplicate_itinerary
-- ---------------------------------------------------------------------------
do $$
declare
  v_origine uuid;
  v_copia public.itineraries;
  v_a uuid;
  v_b uuid;
begin
  insert into public.itineraries (date, notes, returns_to_start)
  values ('2026-06-01', 'Giro settimanale', true) returning id into v_origine;

  v_a := (public.insert_stop_at(v_origine, 'Deposito', 'Via Roma 1', 45.4642, 9.1896, '08:30', 'Ritiro merce', null, true)).id;
  v_b := (public.insert_stop_at(v_origine, 'Cliente', 'Via Po 9', 45.0703, 7.6869)).id;

  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
  values (v_origine, v_a, v_b, 142.50);

  v_copia := public.duplicate_itinerary(v_origine, '2026-06-08');

  assert v_copia.date = '2026-06-08', 'FALLITO: data della copia errata';
  assert v_copia.notes = 'Giro settimanale', 'FALLITO: note non copiate';
  assert v_copia.returns_to_start, 'FALLITO: flag di rientro non copiato';
  assert (select array_agg(s.label order by s.position) from public.stops s
          where s.itinerary_id = v_copia.id) = array['Deposito', 'Cliente'],
    'FALLITO: tappe non copiate nell''ordine';
  assert (select s.address from public.stops s
          where s.itinerary_id = v_copia.id and s.position = 1) = 'Via Roma 1',
    'FALLITO: dettagli della tappa non copiati';
  assert (select s.planned_time from public.stops s
          where s.itinerary_id = v_copia.id and s.position = 1) = '08:30',
    'FALLITO: orario previsto non copiato';
  assert (select s.is_start from public.stops s
          where s.itinerary_id = v_copia.id and s.position = 1),
    'FALLITO: flag di partenza non copiato';
  -- Le tratte NON vengono copiate: i km vanno ricalcolati.
  assert (select count(*) from public.legs l where l.itinerary_id = v_copia.id) = 0,
    'FALLITO: le tratte non devono essere copiate';
  -- L'originale resta intatto.
  assert (select count(*) from public.legs l where l.itinerary_id = v_origine) = 1,
    'FALLITO: duplicazione ha toccato la giornata di origine';

  -- Duplicare su una data occupata senza overwrite deve fallire.
  begin
    perform public.duplicate_itinerary(v_origine, '2026-06-08');
    raise exception 'FALLITO: sovrascrittura silenziosa di una giornata esistente';
  exception
    when unique_violation then null;
  end;

  -- Con overwrite = true la giornata viene sostituita, non duplicata.
  perform public.insert_stop_at(v_copia.id, 'Tappa da sostituire');
  v_copia := public.duplicate_itinerary(v_origine, '2026-06-08', true);
  assert (select count(*) from public.stops s where s.itinerary_id = v_copia.id) = 2,
    'FALLITO: overwrite non ha sostituito le tappe esistenti';
  assert (select count(*) from public.itineraries i
          where i.date = '2026-06-08') = 1,
    'FALLITO: overwrite ha creato una giornata doppia';

  -- Stessa data di origine: rifiutato.
  begin
    perform public.duplicate_itinerary(v_origine, '2026-06-01');
    raise exception 'FALLITO: accettata la duplicazione sulla stessa data';
  exception
    when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Vincoli di integrità
-- ---------------------------------------------------------------------------
do $$
declare
  v_giornata uuid;
  v_altra uuid;
  v_a uuid;
  v_b uuid;
  v_estranea uuid;
begin
  insert into public.itineraries (date) values ('2026-07-01') returning id into v_giornata;
  insert into public.itineraries (date) values ('2026-07-02') returning id into v_altra;
  v_a := (public.insert_stop_at(v_giornata, 'A')).id;
  v_b := (public.insert_stop_at(v_giornata, 'B')).id;
  v_estranea := (public.insert_stop_at(v_altra, 'Estranea')).id;

  -- Etichetta vuota
  begin
    insert into public.stops (itinerary_id, position, label) values (v_giornata, 9, '   ');
    raise exception 'FALLITO: accettata un''etichetta vuota';
  exception when check_violation then null; end;

  -- Mezza coordinata
  begin
    insert into public.stops (itinerary_id, position, label, lat) values (v_giornata, 9, 'X', 45.1);
    raise exception 'FALLITO: accettata una coordinata incompleta';
  exception when check_violation then null; end;

  -- Coordinate fuori scala
  begin
    insert into public.stops (itinerary_id, position, label, lat, lng)
    values (v_giornata, 9, 'X', 95.0, 9.0);
    raise exception 'FALLITO: accettata una latitudine fuori intervallo';
  exception when check_violation then null; end;

  -- Distanza negativa
  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
    values (v_giornata, v_a, v_b, -1);
    raise exception 'FALLITO: accettata una distanza negativa';
  exception when check_violation then null; end;

  -- source non ammesso
  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, source)
    values (v_giornata, v_a, v_b, 1, 'stimato');
    raise exception 'FALLITO: accettato un source non previsto';
  exception when check_violation then null; end;

  -- Tratta con una tappa di un'altra giornata (trigger legs_valida_estremi)
  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
    values (v_giornata, v_a, v_estranea, 1);
    raise exception 'FALLITO: accettata una tratta verso la tappa di un''altra giornata';
  exception when check_violation then null; end;

  -- Tratta con gli stessi estremi
  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
    values (v_giornata, v_a, v_a, 1);
    raise exception 'FALLITO: accettata una tratta con partenza e arrivo uguali';
  exception when check_violation then null; end;

  -- Una tratta senza uno dei due estremi non è più ammessa: il rientro punta
  -- alla tappa di partenza, quindi entrambi gli estremi esistono sempre.
  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
    values (v_giornata, v_a, null, 4);
    raise exception 'FALLITO: accettata una tratta senza tappa di arrivo';
  exception when check_violation then null; end;

  -- Due tratte in uscita dalla stessa tappa
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
  values (v_giornata, v_a, v_b, 4);
  begin
    insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km)
    values (v_giornata, v_a, v_estranea, 4);
    raise exception 'FALLITO: accettate due tratte in uscita dalla stessa tappa';
  exception
    when unique_violation then null;
    when check_violation then null; -- il trigger sugli estremi può precedere l'indice
  end;

  -- Due giornate con la stessa data per lo stesso utente
  begin
    insert into public.itineraries (date) values ('2026-07-01');
    raise exception 'FALLITO: accettate due giornate con la stessa data';
  exception when unique_violation then null; end;

  -- updated_at è gestito dal trigger: un valore inviato dal client va ignorato.
  -- (dentro una transazione now() è costante, quindi non si può confrontare
  -- updated_at con created_at: si verifica invece che la falsificazione non passi)
  update public.stops s
  set label = 'A aggiornata', updated_at = '2000-01-01T00:00:00Z'
  where s.id = v_a;
  assert (select s.updated_at from public.stops s where s.id = v_a) = now(),
    'FALLITO: il trigger non ha sovrascritto updated_at inviato dal client';
end $$;

rollback;

\echo 'OK — test RPC e vincoli superati'

-- ---------------------------------------------------------------------------
-- Modalità di viaggio: solo auto e piedi
-- ---------------------------------------------------------------------------
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mezzi@esempio.it',
  '$2a$10$hashfittiziosolopertest444444444444444444444', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Mezzi"}'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

do $$
declare
  v_giornata uuid;
  v_a uuid;
  v_b uuid;
begin
  insert into public.itineraries (date) values ('2026-08-01') returning id into v_giornata;

  assert (select i.travel_mode from public.itineraries i where i.id = v_giornata) = 'auto',
    'FALLITO: il mezzo predefinito non è auto';

  update public.itineraries i set travel_mode = 'piedi' where i.id = v_giornata;
  assert (select i.travel_mode from public.itineraries i where i.id = v_giornata) = 'piedi',
    'FALLITO: non è possibile passare ad a piedi';

  begin
    update public.itineraries i set travel_mode = 'bici' where i.id = v_giornata;
    raise exception 'FALLITO: accettata una modalità non prevista';
  exception when check_violation then null; end;

  -- Cambiando mezzo le tratte automatiche vanno rifatte, quelle manuali restano.
  v_a := (public.insert_stop_at(v_giornata, 'A', null, null, null, null, null, null, true)).id;
  v_b := (public.insert_stop_at(v_giornata, 'B')).id;
  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, source)
  values (v_giornata, v_a, v_b, 9.99, 'auto');

  update public.itineraries i set travel_mode = 'auto' where i.id = v_giornata;
  assert (select count(*) from public.legs l where l.itinerary_id = v_giornata) = 0,
    'FALLITO: le tratte automatiche non sono state invalidate al cambio di mezzo';

  insert into public.legs (itinerary_id, from_stop_id, to_stop_id, distance_km, source)
  values (v_giornata, v_a, v_b, 7.77, 'manual');
  update public.itineraries i set travel_mode = 'piedi' where i.id = v_giornata;
  assert (select count(*) from public.legs l
          where l.itinerary_id = v_giornata and l.source = 'manual') = 1,
    'FALLITO: una tratta manuale è stata eliminata al cambio di mezzo';
end $$;

rollback;

\echo 'OK — test modalità di viaggio superati'
