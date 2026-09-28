import { z } from 'zod';

/** Come per gli altri form: input sempre stringa, output tipizzato. */
const testoOpzionale = z
  .string()
  .transform((valore) => {
    const pulito = valore.trim();
    return pulito === '' ? null : pulito;
  })
  .pipe(z.string().nullable());

const coordinata = (minimo: number, massimo: number, messaggio: string) =>
  z
    .string()
    .transform((valore) => {
      const pulito = valore.trim().replace(',', '.');
      return pulito === '' ? null : Number(pulito);
    })
    .pipe(
      z
        .number({ invalid_type_error: messaggio })
        .min(minimo, messaggio)
        .max(massimo, messaggio)
        .nullable(),
    );

export const profiloSchema = z
  .object({
    fullName: testoOpzionale,
    defaultStartAddress: testoOpzionale,
    defaultStartLat: coordinata(-90, 90, 'Latitudine non valida'),
    defaultStartLng: coordinata(-180, 180, 'Longitudine non valida'),
  })
  .refine((dati) => (dati.defaultStartLat === null) === (dati.defaultStartLng === null), {
    path: ['defaultStartLng'],
    message: 'Servono entrambe le coordinate, oppure nessuna',
  });

export type CampiProfilo = z.input<typeof profiloSchema>;
export type ProfiloInput = z.output<typeof profiloSchema>;
