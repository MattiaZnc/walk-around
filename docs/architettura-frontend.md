# Architettura del frontend

## Regola di dipendenza

```
componenti  →  hook (features/*/api)  →  funzioni API  →  supabaseClient
```

Nessun componente importa `supabaseClient`: chi lo fa rompe la regola e il
punto di accesso ai dati smette di essere uno solo. Gli errori vengono
tradotti in italiano una volta per tutte in `lib/errors.ts`.

## Struttura di una feature

```
features/itinerary/
  api/         query e mutazioni TanStack Query + funzioni API pure
  components/  interfaccia
  lib/         logica pura e testabile senza React
  schemas/     zod: validazione e conversione dei valori dei form
```

## Validazione dei form: due tipi, non uno

I campi HTML contengono **sempre stringhe**. Gli schemi partono da `z.string()`
e convertono con `transform` + `pipe`:

```ts
const latitudine = z
  .string()
  .transform(aNumeroOppureNull)
  .pipe(z.number().min(-90).max(90).nullable());

type CampiTappa = z.input<typeof tappaSchema>; // { lat: string, ... }  → il form
type TappaInput = z.output<typeof tappaSchema>; // { lat: number|null }  → il database
```

react-hook-form riceve entrambi i tipi:
`useForm<CampiTappa, unknown, TappaInput>`. Con `z.preprocess` il tipo avrebbe
detto `number` dove a runtime c'era una stringa, e ogni campo avrebbe avuto
bisogno di `value={field.value ?? ''}` per compensare.

I numeri accettano sia la virgola sia il punto: `"12,5"` e `"12.5"` valgono
entrambi 12,5.

## Sequenza della giornata

`lib/sequenza.ts` trasforma l'elenco piatto che arriva dal database
(`stops` + `legs`) in ciò che l'interfaccia mostra:

- `costruisciSequenza` → tappe ordinate e una `Tratta` per ogni coppia
  consecutiva (più il rientro, se previsto). `Tratta.leg === null` significa
  "chilometri da inserire": il database non tiene righe segnaposto, l'assenza
  è l'informazione.
- `calcolaTotali` → km, durata e conteggi (mancanti, manuali, stimate).
  I totali si calcolano sui dati in cache, così si aggiornano subito dopo una
  modifica ottimistica senza attendere la vista `itinerary_totals`.
- `invalidaTratteNonAdiacenti` → replica lato client la regola applicata dal
  database, per mostrare l'effetto di un riordino prima della risposta.

Le funzioni sono pure: i test in `sequenza.test.ts` non montano nulla.

## Aggiornamenti ottimistici

`api/cache-giornata.ts` concentra l'accesso alla cache. Ogni mutazione:

1. `cancelQueries` — un refetch in volo sovrascriverebbe la modifica;
2. `setQueryData` in **forma funzionale**, per partire dal valore più recente;
3. `onError` ripristina lo stato precedente;
4. `onSettled` invalida e riallinea al server.

Dove serve e dove no:

| Operazione      | Ottimistica | Perché                                                         |
| --------------- | ----------- | -------------------------------------------------------------- |
| Riordino tappe  | sì          | il drag & drop deve lasciare la tappa dove è stata rilasciata  |
| Modifica tappa  | sì          | i valori sono già noti al client                               |
| Elimina tappa   | sì          | rimozione, rinumerazione e invalidazione sono deterministiche  |
| Salva km a mano | sì          | il totale della giornata deve muoversi subito                  |
| **Crea** tappa  | no          | id e `position` li assegna la RPC: inventarli produce un salto |

## Drag & drop

dnd-kit con tre sensori: puntatore (soglia 6px), touch (pressione 180ms, così
lo scroll con il dito resta possibile) e **tastiera** (frecce sulla maniglia).
Durante il trascinamento le tratte vengono nascoste: dnd-kit calcola
l'anteprima assumendo altezze uniformi fra gli elementi ordinabili, e una
tratta in mezzo la falserebbe. Ogni spostamento è annunciato in un `aria-live`.

## Responsive

- Un pannello, due forme: `PannelloResponsive` monta un dialog su desktop
  (≥768px) e un drawer a tutto schermo su telefono — componenti diversi, non
  solo CSS diverso.
- Totale della giornata: appoggiato in basso su telefono (sopra la bottom
  navigation), in linea su desktop. È una `region` con etichetta, quindi
  raggiungibile anche da screen reader.
- Target touch ≥44px (`min-h-touch`), `text-base` sui campi per evitare lo
  zoom automatico di iOS Safari, un campo per riga.

## Mattonelle della mappa

Predefinito: **OpenStreetMap** (`tile.openstreetmap.org`), che non richiede
chiavi. L'attribuzione è obbligatoria ed è già nel componente.

Una versione precedente usava le basemap di CARTO, che hanno smesso di
funzionare senza registrazione. Il guasto era difficile da vedere: CARTO
risponde **HTTP 200** e restituisce un'immagine PNG che _dice_ "api key
required". Controllare lo stato della risposta non bastava; il modo per
accorgersene è confrontare due mattonelle di zone diverse — se sono identiche,
non è una mappa, è un cartello.

```bash
curl -s "https://<host>/15/17521/12177.png" | sha256sum   # Roma
curl -s "https://<host>/15/17220/11727.png" | sha256sum   # Milano
# hash uguali = errore travestito da immagine
```

Per usare un altro servizio (CARTO o Stadia con la propria chiave, o
un'istanza interna) bastano `VITE_MAP_TILE_URL` e
`VITE_MAP_TILE_ATTRIBUTION`, senza toccare il codice.

Il tema scuro si ottiene invertendo i colori delle mattonelle via CSS
(`.mappa-tema-scuro`), perché OpenStreetMap non ha una variante scura. Il
filtro è applicato al solo `leaflet-tile-pane`: marker e tracciato restano dei
loro colori.

## Tappe raggiunte

Durante il giro il pulsante **Seguimi** avvia `watchPosition` e confronta la
posizione con le tappe: entro 75 metri la tappa viene segnata come raggiunta
(`stops.reached_at`), la riga diventa verde chiarissimo e sulla mappa il numero
lascia il posto a una spunta.

La logica sta in `lib/prossimita.ts`, senza React né geolocalizzazione: è il
solo modo per provarla con posizioni finte invece di camminare.

Tre decisioni che valgono più della soglia:

- **La localizzazione non parte da sola.** `watchPosition` con alta precisione
  tiene il GPS accesso e la batteria si consuma in fretta: chiedere la posizione
  a chi sta solo pianificando la giornata sarebbe invadente e inutile.
- **Oltre 120 metri di incertezza non si decide.** Con un segnale debole
  (dentro un edificio, rete mobile senza GPS) si marcherebbero tappe a caso;
  l'app lo dice e lascia fare a mano.
- **Il raggio si allarga fino all'incertezza dichiarata.** Con accuratezza di
  100 metri, essere "a 90 metri" può già significare essere sul posto.

Le tappe già segnalate non vengono riproposte: restando nel raggio, ogni
rilevamento del GPS rifarebbe scattare l'avviso.

Si può sempre segnare o annullare a mano dalla riga della tappa: il GPS sbaglia,
e un dato che non si può correggere è peggio di un dato assente.
