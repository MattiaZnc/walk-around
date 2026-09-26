import { z } from 'zod';

/**
 * Validazione delle variabili d'ambiente al boot: se manca la configurazione
 * Supabase è meglio un errore chiaro subito che una schermata bianca.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL deve essere un URL valido'),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, 'VITE_SUPABASE_ANON_KEY mancante o troppo corta'),
  VITE_APP_NAME: z.string().default('Walk Around'),
  // Sorgente alternativa delle mattonelle della mappa (facoltativa).
  // Il valore predefinito è OpenStreetMap, che non richiede chiavi.
  VITE_MAP_TILE_URL: z.string().url().optional(),
  VITE_MAP_TILE_ATTRIBUTION: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const dettagli = parsed.error.issues.map((issue) => `- ${issue.message}`).join('\n');
  throw new Error(
    `Configurazione ambiente non valida.\n${dettagli}\n\n` +
      'Copia .env.example in .env.local e inserisci i valori del tuo progetto Supabase.',
  );
}

export const env: Env = parsed.data;
