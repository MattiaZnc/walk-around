# Modello dati

## Tabelle

```
profiles (1:1 con auth.users)
  └─ default_start_address / lat / lng   punto di partenza suggerito e rientro

itineraries (una giornata)         unique (user_id, date)
  ├─ stops (tappe)                 position 1..n contigua, unique (itinerary_id, position) DEFERRABLE
  └─ legs (tratte)                 una per ogni coppia di tappe consecutive
```

Una **tratta** (`legs`) collega due tappe consecutive. La tratta di **rientro**
al punto di partenza ha `to_stop_id = null`: la destinazione è
`profiles.default_start_*`, e la giornata la richiede con
`itineraries.returns_to_start = true`.

## Invariante centrale

> Esiste una tratta **solo** fra tappe consecutive nell'ordine attuale
> (più eventualmente il rientro dall'ultima tappa).

È garantita dalla funzione `invalida_tratte_non_adiacenti(itinerary_id)`, che
elimina tutto ciò che non rispetta la regola. Ogni RPC che cambia la struttura
della giornata la richiama e restituisce quante tratte ha invalidato: il client
usa quel numero per sapere che deve ricalcolare.

Conseguenza voluta: una tratta `source = 'manual'` su una coppia che non è più
consecutiva **viene eliminata**. Il valore inserito a mano si riferiva a un
tragitto che non esiste più. Finché la coppia resta consecutiva, invece, nessun
riordino la tocca.

## Funzioni RPC

| Funzione                                                    | Cosa fa                                                | Ritorna              |
| ----------------------------------------------------------- | ------------------------------------------------------ | -------------------- |
| `reorder_stops(itinerary_id, ordered_ids[])`                | Riscrive le posizioni in una transazione, poi invalida | n. tratte invalidate |
| `insert_stop_at(itinerary_id, label, …, position)`          | Inserisce in coda o in mezzo spostando le successive   | la tappa creata      |
| `delete_stop(stop_id)`                                      | Elimina, richiude la numerazione, invalida             | n. tratte invalidate |
| `duplicate_itinerary(itinerary_id, target_date, overwrite)` | Copia le tappe su un'altra data (non le tratte)        | la giornata creata   |
| `invalida_tratte_non_adiacenti(itinerary_id)`               | Applica l'invariante                                   | n. tratte invalidate |

Perché RPC e non più chiamate dal client: `supabase-js` esegue ogni richiesta in
una transazione separata. Riordinare significa riscrivere più `position`
insieme, cosa possibile solo grazie al vincolo `DEFERRABLE INITIALLY DEFERRED`
all'interno di un'unica transazione.

Tutte le funzioni sono `SECURITY INVOKER`: passano dalle policy RLS di chi le
chiama, quindi non possono raggiungere i dati di un altro utente.

## Vista `itinerary_totals`

`security_invoker = true`, una riga per giornata (anche senza tratte):

`total_km`, `total_duration_min`, `legs_count`, `stops_count`,
`manual_legs_count`, `estimated_legs_count`.

Gli ultimi due servono all'UI per segnalare i valori corretti a mano e quelli
solo stimati (calcolo di riserva senza API key).

## Sicurezza

- RLS attiva **e forzata** (`force row level security`) su tutte le tabelle.
- Policy solo per il ruolo `authenticated`, filtro `user_id = auth.uid()`.
  `anon` non ha alcun `grant`.
- Per `stops` e `legs` la `WITH CHECK` richiede anche `owns_itinerary(...)`:
  senza quella condizione si potrebbero agganciare righe proprie alla giornata
  di un altro utente.
- Il trigger `legs_valida_estremi` impedisce tratte che puntano a tappe di
  un'altra giornata (cosa che le foreign key da sole non vietano).

## Test

`npm run db:test` esegue:

- `supabase/tests/rls.sql` — due utenti, verifica che B non possa leggere,
  modificare, eliminare né agganciarsi ai dati di A, nemmeno conoscendo gli id
  o passando dalle RPC; verifica anche che `anon` non veda nulla.
- `supabase/tests/rpc.sql` — riordino, inserimento in mezzo, eliminazione con
  ricompattazione, rientro, duplicazione, totali della vista e tutti i vincoli.

Entrambi girano in una transazione con `rollback`.
