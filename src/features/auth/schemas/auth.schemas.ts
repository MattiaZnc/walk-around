import { z } from 'zod';

export const LUNGHEZZA_MINIMA_PASSWORD = 8;

// Normalizzazione prima della validazione: spazi e maiuscole non devono far
// fallire il formato (capita spesso incollando l'email dal gestionale).
// transform + pipe, non preprocess: così il tipo in ingresso resta `string`,
// come il campo HTML da cui arriva.
const email = z
  .string()
  .min(1, 'Inserisci la tua email')
  .transform((valore) => valore.trim().toLowerCase())
  .pipe(z.string().email('Indirizzo email non valido'));

const password = z.string().min(1, 'Inserisci la password');

const nuovaPassword = z
  .string()
  .min(
    LUNGHEZZA_MINIMA_PASSWORD,
    `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri`,
  )
  .max(72, 'La password non può superare i 72 caratteri')
  .regex(/[a-z]/, 'Serve almeno una lettera minuscola')
  .regex(/[A-Z]/, 'Serve almeno una lettera maiuscola')
  .regex(/\d/, 'Serve almeno un numero');

export const loginSchema = z.object({
  email,
  password,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const richiestaResetSchema = z.object({
  email,
});
export type RichiestaResetInput = z.infer<typeof richiestaResetSchema>;

export const nuovaPasswordSchema = z
  .object({
    password: nuovaPassword,
    conferma: z.string().min(1, 'Ripeti la password'),
  })
  .refine((dati) => dati.password === dati.conferma, {
    path: ['conferma'],
    message: 'Le password non coincidono',
  });
export type NuovaPasswordInput = z.infer<typeof nuovaPasswordSchema>;

export const cambioPasswordSchema = z
  .object({
    passwordAttuale: z.string().min(1, 'Inserisci la password attuale'),
    password: nuovaPassword,
    conferma: z.string().min(1, 'Ripeti la nuova password'),
  })
  .refine((dati) => dati.password === dati.conferma, {
    path: ['conferma'],
    message: 'Le password non coincidono',
  })
  .refine((dati) => dati.password !== dati.passwordAttuale, {
    path: ['password'],
    message: 'La nuova password deve essere diversa da quella attuale',
  });
export type CambioPasswordInput = z.infer<typeof cambioPasswordSchema>;
