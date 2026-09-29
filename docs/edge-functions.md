# Edge Function: percorsi e ricerca luoghi

Due funzioni, entrambe in `supabase/functions`:

| Funzione          | Cosa fa                                                       |
| ----------------- | ------------------------------------------------------------- |
| `geocode`         | "Colosseo" → nome, indirizzo e coordinate (autocompletamento) |
| `calculate-route` | coppie di coordinate → km, minuti e tracciato del percorso    |

## Perché non chiamarle dal browser

1. Una eventuale API key resterebbe nel bundle JavaScript, quindi pubblica.
2. Il provider si cambia senza rilasciare una nuova versione dell'app.
3. La cache in memoria della funzione risparmia richieste durante la digitazione.

## Provider, in ordine di preferenza

**Percorsi** (`calculate-route`)

1. **OpenRouteService** — solo se è impostato il secret `ORS_API_KEY`.
2. **OSRM** su istanze pubbliche FOSSGIS, senza chiave. **Un server per
   profilo**: `routed-car`, `routed-foot`, `routed-bike`.
3. **Stima** — linea d'aria × 1,3 e velocità media. Non fallisce mai e marca il
   risultato con `is_estimate`, che in interfaccia diventa il badge "stimata".

Con `"istruzioni": true` nel corpo la risposta include anche `manovre`, le
indicazioni svolta per svolta usate dal navigatore ("Guidami"). Sono dati
strutturati (tipo, direzione, strada, punto, metri dall'inizio): il testo
italiano lo compone l'app in `src/features/itinerary/lib/navigazione.ts`. Una
Edge Function di versione precedente ignora il parametro: il navigatore
funziona lo stesso, ma mostra solo la linea del percorso senza indicazioni.

> Il server dimostrativo `router.project-osrm.org` conosce **solo
> l'automobile**: se gli si chiede un percorso a piedi risponde comunque con
> quello in auto. Fra Colosseo e Villa Borghese dava "7,51 km in 12 minuti" a
> piedi invece di 3,55 km in 47 minuti. Per questo si usano i server FOSSGIS,
> uno per profilo.

**Luoghi** (`geocode`)

1. **Photon** (komoot) — senza chiave, pensato per l'autocompletamento: risponde
   bene anche a testo parziale ("villa borgh" → Villa Borghese).
   Accetta solo `lang=default|de|en|fr`: con `default` restituisce i nomi locali,
   quindi in italiano per i luoghi italiani.
2. **Nominatim** — riserva. La sua politica d'uso chiede al massimo una
   richiesta al secondo, quindi non è adatto all'autocompletamento.

Entrambe le funzioni accettano un punto di riferimento (`vicinoA`): l'app passa
l'ultima tappa geolocalizzata, così "stazione" propone quella della zona in cui
si sta lavorando.

## Variabili d'ambiente (tutte facoltative)

| Variabile                                 | Effetto                                     |
| ----------------------------------------- | ------------------------------------------- |
| `ORS_API_KEY`                             | attiva OpenRouteService come primo provider |
| `ROUTE_PROVIDER`                          | forza `ors`, `osrm` o `stima`               |
| `GEOCODE_PROVIDER`                        | forza `photon` o `nominatim`                |
| `OSRM_BASE_URL_AUTO` / `_PIEDI` / `_BICI` | istanze OSRM proprie                        |
| `PHOTON_BASE_URL`, `NOMINATIM_BASE_URL`   | istanze proprie                             |

**La chiave ORS non va in `.env.local`.** Le variabili `VITE_*` finiscono nel
bundle del browser: sarebbero leggibili da chiunque. La chiave va nei secret
delle Edge Function:

```bash
npx supabase secrets set ORS_API_KEY=la-tua-chiave
```

## Sviluppo in locale

```bash
npx supabase functions serve --no-verify-jwt
```

Prova rapida:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/geocode \
  -H "Content-Type: application/json" \
  -d '{"testo":"Colosseo"}'

curl -X POST http://127.0.0.1:54321/functions/v1/calculate-route \
  -H "Content-Type: application/json" \
  -d '{"profilo":"piedi","coppie":[{"from":{"lat":41.8903,"lng":12.4924},"to":{"lat":41.9144,"lng":12.4848}}]}'
```

`--no-verify-jwt` serve solo in locale per provare con curl. In produzione la
verifica del token resta attiva: le funzioni sono raggiungibili solo da utenti
autenticati.

## Deploy sul progetto cloud

Le Edge Function **non** si installano dall'SQL Editor. Due strade.

### A — CLI (consigliata: aggiornare poi è un comando solo)

Non serve `link` né la password del database:

```bash
npx supabase login
npx supabase functions deploy geocode --project-ref <il-tuo-project-ref>
npx supabase functions deploy calculate-route --project-ref <il-tuo-project-ref>
```

### B — Copia-incolla dalla dashboard

`npm run fn:bundle` genera in `docs/edge-functions/` una versione di ogni
funzione in **un solo file**, con i moduli di `_shared` già inclusi:

1. dashboard → **Edge Functions** → **Deploy a new function** → _Via editor_
2. nome esatto `geocode`, incolla `docs/edge-functions/geocode.ts`, Deploy
3. ripeti con `calculate-route` e `docs/edge-functions/calculate-route.ts`

I nomi devono essere esattamente `geocode` e `calculate-route`: l'app li invoca
con quei nomi.

Quei due file sono **generati**: dopo una modifica a `supabase/functions/**` va
rilanciato `npm run fn:bundle`, altrimenti divergono dalla fonte.

Finché non sono deployate, l'app resta utilizzabile: la ricerca luoghi mostra
un avviso e invita a inserire nome e coordinate a mano, e i chilometri si
scrivono direttamente sulle tratte.

## Comportamento in caso di errore

Nessun errore di un servizio esterno blocca l'utente:

- geocoding non disponibile → avviso nel campo di ricerca, campi compilabili a mano;
- percorso non calcolabile (tappa senza coordinate) → la tratta resta modificabile
  e il riepilogo segnala "n tratte senza km";
- provider giù → subentra la stima, segnalata con il badge "stimata" e con il
  tracciato tratteggiato sulla mappa.
