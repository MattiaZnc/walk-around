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
