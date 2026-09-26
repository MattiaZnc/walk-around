import { z } from 'zod';

/**
 * Gli schemi partono sempre da `string`, perché è ciò che contengono davvero i
 * campi HTML, e producono i valori finali con `transform` + `pipe`.
 * Così `z.input<typeof schema>` descrive i campi del form e `z.output<...>` i
 * dati da salvare: react-hook-form usa entrambi i tipi e non c'è modo di
 * confonderli (con `preprocess` il tipo diceva `number` dove a runtime c'era
 * una stringa).
 */

/** "12,5" o "12.5" → 12.5; testo non numerico → NaN, respinto da z.number(). */
function aNumero(valore: string): number {
  return Number(valore.trim().replace(',', '.'));
}

function aNumeroOppureNull(valore: string): number | null {
  return valore.trim() === '' ? null : aNumero(valore);
}

function aTestoOppureNull(valore: string): string | null {
  const pulito = valore.trim();
  return pulito === '' ? null : pulito;
}

const testoOpzionale = z.string().transform(aTestoOppureNull).pipe(z.string().nullable());

const latitudine = z
  .string()
  .transform(aNumeroOppureNull)
  .pipe(
    z
      .number({ invalid_type_error: 'Latitudine non valida' })
      .min(-90, 'La latitudine va da -90 a 90')
      .max(90, 'La latitudine va da -90 a 90')
      .nullable(),
  );

const longitudine = z
  .string()
  .transform(aNumeroOppureNull)
  .pipe(
    z
      .number({ invalid_type_error: 'Longitudine non valida' })
      .min(-180, 'La longitudine va da -180 a 180')
      .max(180, 'La longitudine va da -180 a 180')
      .nullable(),
  );

const orario = z
  .string()
  .transform(aTestoOppureNull)
  .pipe(
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa il formato HH:MM')
      .nullable(),
  );

export const tappaSchema = z
  .object({
    label: z.string().trim().min(1, 'Dai un nome alla tappa').max(120, 'Massimo 120 caratteri'),
    address: testoOpzionale,
    lat: latitudine,
    lng: longitudine,
    plannedTime: orario,
    notes: testoOpzionale,
  })
  // Mezza coordinata non serve a nulla e il database la rifiuterebbe.
  .refine((dati) => (dati.lat === null) === (dati.lng === null), {
    path: ['lng'],
    message: 'Servono entrambe le coordinate, oppure nessuna',
  });

/** Valori dei campi del form: tutte stringhe. */
export type CampiTappa = z.input<typeof tappaSchema>;
/** Valori validati, pronti per il database. */
export type TappaInput = z.output<typeof tappaSchema>;

export const trattaSchema = z.object({
  distanceKm: z
    .string()
    .trim()
    .min(1, 'Inserisci i chilometri')
    .transform(aNumero)
    .pipe(
      z
        .number({ invalid_type_error: 'Inserisci un numero (es. 12,5)' })
        .min(0, 'I chilometri non possono essere negativi')
        .max(99_999.99, 'Valore troppo grande'),
    ),
  durationMin: z
    .string()
    .transform(aNumeroOppureNull)
    .pipe(
      z
        .number({ invalid_type_error: 'Inserisci i minuti come numero intero' })
        .int('I minuti devono essere un numero intero')
        .min(0, 'I minuti non possono essere negativi')
        .max(10_080, 'Valore troppo grande')
        .nullable(),
    ),
});

export type CampiTratta = z.input<typeof trattaSchema>;
export type TrattaInput = z.output<typeof trattaSchema>;

export const duplicaGiornataSchema = z.object({
  dataDestinazione: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Scegli una data valida'),
});

export type DuplicaGiornataInput = z.infer<typeof duplicaGiornataSchema>;

/** Numero pronto per un campo di testo, con la virgola come separatore. */
export function numeroPerCampo(valore: number | null | undefined): string {
  if (valore === null || valore === undefined) return '';
  return String(valore).replace('.', ',');
}
