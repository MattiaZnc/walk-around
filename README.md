# Ruolo
Sei un senior full-stack developer esperto di React, TypeScript e Supabase.
Costruisci un'applicazione web di produzione, seguendo le best practice di
sicurezza, accessibilità e manutenibilità. Lavora per fasi, e alla fine di
ogni fase fermati, riassumi cosa hai fatto e cosa va verificato.

# Obiettivo
Un'app per pianificare l'itinerario giornaliero (tappe in sequenza) e tenere
traccia dei chilometri percorsi. Ogni giorno ha un elenco ordinato di tappe;
tra due tappe consecutive c'è una "tratta" con i suoi km. L'utente deve poter,
anche a giorni di distanza, aggiungere, modificare, riordinare ed eliminare
tappe e tratte di qualsiasi giorno, e i totali devono ricalcolarsi.

# Stack (obbligatorio)
- React 18 + TypeScript (strict) + Vite
- Tailwind CSS + shadcn/ui (componenti accessibili), icone lucide-react
- React Router per il routing
- TanStack Query per fetch, cache e mutazioni (con optimistic updates)
- react-hook-form + zod per form e validazione
- @supabase/supabase-js v2, tipi generati con `supabase gen types typescript`
- Leaflet + react-leaflet con tile OpenStreetMap per la mappa
- Calcolo percorsi/km: OpenRouteService (o Google Directions, configurabile),
  chiamato SOLO da una Supabase Edge Function, così la API key non è esposta
- date-fns con locale italiano
- Vitest + Testing Library per i test

# Autenticazione
- Login esclusivamente con email e password tramite Supabase Auth.
- Gli account sono creati dall'amministratore nella dashboard di Supabase:
  NESSUNA pagina di registrazione nel frontend. Disabilita anche il signup
  pubblico nelle impostazioni di Supabase (documenta il passaggio nel README).
- Pagina "Password dimenticata" con reset via email.
- Sessione persistente, refresh automatico del token, logout.
- Tutte le route tranne /login e /reset-password sono protette
  (componente ProtectedRoute che reagisce a onAuthStateChange).

# Database (Supabase / Postgres)
Crea tutto tramite migration SQL versionate (cartella supabase/migrations),
mai modifiche manuali dalla dashboard.

Tabelle:
1. profiles
   - id uuid PK references auth.users on delete cascade
   - full_name text
   - default_start_address text, default_start_lat numeric, default_start_lng numeric
   - created_at, updated_at timestamptz
   - trigger che crea il profilo alla creazione dell'utente in auth.users

2. itineraries (un giorno)
   - id uuid PK default gen_random_uuid()
   - user_id uuid not null references auth.users, default auth.uid()
   - date date not null
   - notes text
   - created_at, updated_at
   - unique(user_id, date)

3. stops (tappe)
   - id uuid PK
   - itinerary_id uuid not null references itineraries on delete cascade
   - user_id uuid not null default auth.uid()
   - position int not null (ordine nella giornata)
   - label text not null, address text
   - lat numeric(9,6), lng numeric(9,6)
   - planned_time time, notes text
   - created_at, updated_at
   - unique(itinerary_id, position) DEFERRABLE INITIALLY DEFERRED
     (per consentire il riordino in un'unica transazione)

4. legs (tratte tra tappe consecutive)
   - id uuid PK
   - itinerary_id uuid not null references itineraries on delete cascade
   - user_id uuid not null default auth.uid()
   - from_stop_id, to_stop_id uuid references stops on delete cascade
   - distance_km numeric(8,2) not null check (distance_km >= 0)
   - duration_min int
   - source text check (source in ('auto','manual')) — se 'manual' il valore
     è stato corretto dall'utente e non va sovrascritto dal ricalcolo automatico
   - route_geometry jsonb (polyline per la mappa, opzionale)
   - created_at, updated_at

Viste / funzioni:
- vista itinerary_totals (itinerary_id, date, user_id, total_km, legs_count)
  con security_invoker = true
- funzione RPC reorder_stops(itinerary_id, ordered_ids uuid[]) che riordina in
  una transazione e invalida le tratte interessate
- trigger updated_at su tutte le tabelle
- indici su (user_id, date), (itinerary_id, position)

Sicurezza:
- Row Level Security ATTIVA su tutte le tabelle.
- Policy select/insert/update/delete: solo righe con user_id = auth.uid().
- Nessuna service_role key nel frontend; solo anon key tramite variabili
  d'ambiente (.env.local, con .env.example committato).

# Logica km
- Quando si aggiunge, sposta, modifica o elimina una tappa, l'app ricalcola
  solo le tratte coinvolte chiamando l'Edge Function `calculate-route`
  (input: coppie di coordinate; output: km, minuti, geometria).
- Le tratte con source = 'manual' non vengono sovrascritte; mostra un badge
  "manuale" e un pulsante "ricalcola automaticamente".
- Se una tappa non ha coordinate o l'API fallisce, la tratta resta modificabile
  a mano e viene segnalata in UI (mai bloccare l'utente).
- Geocoding degli indirizzi con autocompletamento (sempre via Edge Function).
- Opzione "ritorno al punto di partenza" che aggiunge l'ultima tratta verso
  l'indirizzo di default del profilo.

# Funzionalità e schermate
1. Login / Reset password
2. Dashboard: calendario o lista giorni con km totali per giorno,
   totale settimana e mese corrente
3. Dettaglio giorno (/day/:date):
   - elenco tappe ordinabile con drag & drop (dnd-kit, funzionante anche touch)
   - tra ogni coppia di tappe, la tratta con km e durata, modificabile inline
   - aggiunta/modifica/eliminazione tappa (dialog su desktop, drawer a tutto
     schermo su mobile), con conferma prima di eliminare
   - mappa con marker numerati e percorso
   - totale km del giorno sempre visibile (sticky su mobile)
   - "duplica giornata" su un'altra data
4. Report: filtro per intervallo di date, totale km, tabella per giorno,
   esportazione CSV (utile per rimborsi chilometrici)
5. Profilo: nome, indirizzo di partenza predefinito, cambio password

# Responsive e UX
- Design mobile-first; breakpoint Tailwind sm/md/lg.
- Su telefono: bottom navigation, target touch ≥ 44px, nessuno scroll
  orizzontale, form a campo singolo per riga.
- Su desktop: sidebar + lista tappe e mappa affiancate.
- Stati di loading (skeleton), errore e vuoto per ogni vista.
- Toast di conferma/errore; possibilità di annullare un'eliminazione.
- Tema chiaro/scuro, interfaccia in italiano, formati data e numeri it-IT.
- Accessibilità: label sui campi, focus visibile, contrasto AA.
- Configura l'app come PWA installabile (vite-plugin-pwa).

# Struttura del codice
src/
  lib/ (supabaseClient.ts, queryClient.ts, utils)
  types/ (database.types.ts generato)
  features/auth, features/itinerary, features/reports, features/profile
    ognuna con components/, hooks/ (useItinerary, useStops...), api/, schemas/
  components/ui (shadcn), components/layout
  routes/
- Nessuna chiamata a Supabase direttamente dai componenti: solo tramite hook
  in features/*/api.
- Gestione errori centralizzata; nessun `any`.
- ESLint + Prettier configurati.

# Test
- Unit test per calcolo totali, riordino e schemi zod.
- Test dei componenti principali (form tappa, lista tratte).
- Script SQL di test che verifichi che un utente NON possa leggere o
  modificare i dati di un altro (RLS).

# Fasi di consegna
1. Setup progetto, Supabase client, auth e route protette
2. Migration DB completa con RLS, viste, RPC e tipi generati
3. CRUD giorni/tappe/tratte con riordino
4. Edge Functions per percorsi e geocoding + mappa
5. Dashboard, report ed export CSV
6. Rifinitura responsive, PWA, test
7. README: setup locale, variabili d'ambiente, come creare gli utenti in
   Supabase, deploy (Vercel/Netlify per il frontend, `supabase functions
   deploy` per le Edge Functions)

Prima di iniziare, elenca le eventuali ambiguità che trovi e proponi la
scelta di default che adotterai.