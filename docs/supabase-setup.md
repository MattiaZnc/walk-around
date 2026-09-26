# Configurazione del progetto Supabase

Questi passaggi si fanno **una volta sola**, dalla dashboard di Supabase.
Lo schema del database non si tocca da qui: arriva dalle migration versionate
in `supabase/migrations` (Fase 2).

## 1. Creare il progetto

1. Vai su <https://supabase.com/dashboard> → **New project**.
2. Nome: `walk-around` (o quello che preferisci), regione **Europe (Frankfurt/Milan)**
   per tenere bassa la latenza dall'Italia.
3. Salva la **Database password**: serve per `supabase db push`.

## 2. Prendere le chiavi per il frontend

**Project Settings → API**:

| Valore                        | Dove va                       |
| ----------------------------- | ----------------------------- |
| Project URL                   | `VITE_SUPABASE_URL`           |
| Project API key `anon public` | `VITE_SUPABASE_ANON_KEY`      |
| `service_role` key            | **da nessuna parte nell'app** |

Copia `.env.example` in `.env.local` e incolla i due valori.
La `anon key` è pubblica per definizione: ciò che protegge i dati sono le policy
RLS, non la segretezza della chiave. La `service_role` bypassa RLS: non deve
comparire in nessuna variabile `VITE_*` (finirebbe nel bundle del browser).

## 3. Disabilitare la registrazione pubblica

L'app non ha una pagina di registrazione, ma senza questo passaggio chiunque
conosca URL e anon key potrebbe creare un account via API.

**Authentication → Sign In / Providers → Email**:

- disattiva **Allow new users to sign up** (`Disable signup`);
- lascia attivo **Email** come provider;
- **Confirm email**: puoi disattivarlo, dato che gli account li crei tu.

Verifica: con signup disattivato, una chiamata `signUp` risponde
`422 signup_disabled`. L'app traduce questo errore in un messaggio in italiano.

## 4. Creare gli utenti

**Authentication → Users → Add user → Create new user**:

- inserisci email e una password provvisoria;
- spunta **Auto Confirm User**, altrimenti l'utente non può accedere;
- comunica le credenziali all'utente, che le cambierà da _Profilo_.

Alla creazione dell'utente un trigger (Fase 2) crea la riga in `profiles`.

## 5. URL per il link di reset password

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:5173` in sviluppo, il dominio pubblico in produzione.
- **Redirect URLs**: aggiungi entrambe le voci
  - `http://localhost:5173/reset-password`
  - `https://<tuo-dominio>/reset-password`

Senza queste voci il link ricevuto per email viene rifiutato con
`redirect_to not allowed`.

## 6. Applicare lo schema al progetto cloud

Le migration sono già scritte in `supabase/migrations` e verificate sul
database locale. Per portarle sul progetto cloud servono tre comandi
interattivi (chiedono token e password, quindi vanno lanciati da te):

```bash
npx supabase login                            # apre il browser per il token
npx supabase link --project-ref <project-ref> # lo trovi nell'URL della dashboard
npx supabase db push                          # applica le migration in ordine
```

Poi rigenera i tipi dal database remoto, per essere sicuro che coincidano:

```bash
npm run db:types:remote
```

`db push` è additivo e idempotente: applica solo le migration non ancora
registrate in `supabase_migrations.schema_migrations`.

### Sviluppo in locale (facoltativo)

Con Docker attivo si può lavorare su un database identico senza toccare il
cloud:

```bash
npm run db:start    # avvia Postgres, Auth, Studio (localhost:54323)
npm run db:reset    # ricrea il DB applicando tutte le migration da zero
npm run db:test     # esegue i test SQL (isolamento RLS + RPC)
npm run db:types    # rigenera i tipi dal DB locale
npm run db:stop     # ferma i container
```

I test SQL girano in transazioni con `rollback`: non lasciano dati.

## 7. Secret delle Edge Function (Fase 4)

La API key del servizio di routing/geocoding vive **solo** lato server:

```bash
npx supabase secrets set ORS_API_KEY=<la-tua-chiave>
npx supabase functions deploy calculate-route
```

Finché la chiave non è impostata, la Edge Function usa un calcolo di riserva
(distanza in linea d'aria con fattore di correzione stradale) e marca il
risultato come stimato, così l'app resta usabile.
