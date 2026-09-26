# Deploy

Tre pezzi, in tre posti diversi:

| Pezzo                    | Dove vive | Come si aggiorna                   |
| ------------------------ | --------- | ---------------------------------- |
| Frontend (React)         | Vercel    | push su GitHub → deploy automatico |
| Database (tabelle, RLS)  | Supabase  | migration SQL                      |
| Edge Function (percorsi) | Supabase  | `supabase functions deploy`        |

## 1. GitHub

Crea un repository **privato** (l'app è per uso personale) e collegalo:

```bash
git remote add origin git@github.com:<utente>/walk-around.git
git branch -M main
git push -u origin main
```

Cosa **non** finisce nel repository (vedi `.gitignore`): `.env.local`,
`node_modules`, `dist`, lo stato locale di Supabase e della CLI Vercel.

Cosa invece c'è, ed è corretto che ci sia: `.env.example` (solo nomi delle
variabili, nessun valore), `supabase/migrations`, `supabase/functions`,
`vercel.json`.

## 2. Vercel

1. **Add New → Project** → importa il repository.
2. Il framework viene riconosciuto da `vercel.json`: build `npm run build`,
   output `dist`. Non serve toccare nulla.
3. **Environment Variables** — queste tre, per _Production_, _Preview_ e
   _Development_:

   | Nome                     | Valore                                  |
   | ------------------------ | --------------------------------------- |
   | `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → URL |
   | `VITE_SUPABASE_ANON_KEY` | la chiave `anon public`                 |
   | `VITE_APP_NAME`          | `Walk Around` (facoltativo)             |

4. **Deploy**.

> Le variabili `VITE_*` vengono scritte dentro il JavaScript **al momento della
> build**, non lette a ogni richiesta: dopo averle cambiate serve un nuovo
> deploy (Deployments → ⋯ → Redeploy), altrimenti resta il valore vecchio.

> La `anon key` sta nel bundle ed è visibile a chiunque apra gli strumenti di
> sviluppo: è previsto. Ciò che protegge i dati sono le policy RLS. La
> `service_role` key invece non va **mai** in una variabile `VITE_*`.

### Cosa fa `vercel.json`

- **rewrites**: ogni indirizzo che non corrisponde a un file viene servito con
  `index.html`. Senza questa regola, aprire direttamente `/day/2026-09-26` o
  ricaricare la pagina darebbe 404, perché il routing è lato browser.
- **headers**: cache di un anno per `/assets/*` (i nomi contengono un hash,
  quindi cambiano a ogni rilascio) più le intestazioni di sicurezza di base
  (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS).

## 3. Supabase: autorizzare il dominio Vercel

Senza questo passaggio il login funziona ma **il link di reset password viene
rifiutato** (`redirect_to not allowed`).

**Authentication → URL Configuration**:

- **Site URL**: `https://<tuo-progetto>.vercel.app`
- **Redirect URLs**, tutte e tre:
  - `https://<tuo-progetto>.vercel.app/reset-password`
  - `https://<tuo-progetto>-*.vercel.app/reset-password` — i deploy di
    anteprima hanno un indirizzo diverso a ogni commit
  - `http://localhost:5173/reset-password` — per lo sviluppo

## 4. Edge Function

Non passano da Vercel: vivono su Supabase. Vedi `docs/edge-functions.md`.
In breve, con la CLI:

```bash
npx supabase login
npx supabase functions deploy geocode --project-ref <ref>
npx supabase functions deploy calculate-route --project-ref <ref>
```

Oppure incollando `docs/edge-functions/*.ts` nell'editor della dashboard.

## Prova dopo il deploy

1. Apri l'indirizzo Vercel: deve comparire il login.
2. Accedi, poi **ricarica la pagina su `/day/<data>`**: se vedi la giornata e
   non un 404, il rewrite funziona.
3. Crea una tappa cercando "Colosseo": se compaiono i suggerimenti, le Edge
   Function sono attive.
4. "Calcola km": la tratta deve mostrare chilometri e il percorso sulla mappa.
5. Prova "Password dimenticata": l'email deve arrivare e il link aprire la
   pagina di scelta password sul dominio Vercel.

## Peso del primo caricamento

Circa 690 kB non compressi (~200 kB con gzip) per arrivare al login. Le
dipendenze grosse stanno in chunk separati (`react`, `supabase`, `query`,
`form`), così un rilascio dell'app non costringe a riscaricarle.

Leaflet (circa 280 kB) sta nel chunk della pagina del giorno, che è caricata
solo quando serve: chi apre il login non lo scarica. Va verificato dopo ogni
modifica al code splitting — basta controllare che `mappa`/`leaflet` non
compaia fra i `modulepreload` di `dist/index.html`.
