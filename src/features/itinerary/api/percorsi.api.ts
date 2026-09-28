import { AppError, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';

/**
 * Client delle Edge Function `calculate-route` e `geocode`.
 * I tipi rispecchiano supabase/functions/_shared/tipi.ts: se cambiano lì,
 * vanno aggiornati anche qui.
 */

export type Coordinate = { lat: number; lng: number };

export type Geometria = {
  type: 'LineString';
  /** [lng, lat], ordine GeoJSON. Leaflet vuole l'opposto: si inverte in mappa. */
  coordinates: [number, number][];
};

/**
 * Mezzi previsti dall'app. La Edge Function conosce anche la bicicletta, ma
 * qui non serve: il vincolo sul database ammette solo questi due valori.
 */
export type ModalitaViaggio = 'auto' | 'piedi';

export const MODALITA: { valore: ModalitaViaggio; etichetta: string }[] = [
  { valore: 'auto', etichetta: 'In auto' },
  { valore: 'piedi', etichetta: 'A piedi' },
];

export function modalitaValida(valore: string): ModalitaViaggio {
  return valore === 'piedi' ? 'piedi' : 'auto';
}

export type Tratto = {
  distanceKm: number;
  durationMin: number | null;
  geometry: Geometria | null;
  isEstimate: boolean;
  provider: string;
};

type RispostaPercorso = {
  tratti: (Tratto | { errore: string })[];
};

export type Luogo = {
  etichetta: string;
  nome: string;
  indirizzo: string;
  lat: number;
  lng: number;
};

type RispostaGeocoding = {
  luoghi: Luogo[];
  provider: string;
};

export function isTratto(valore: Tratto | { errore: string }): valore is Tratto {
  return !('errore' in valore);
}

/** Massimo di coppie per richiesta: allineato al limite della Edge Function. */
export const MASSIMO_TRATTE_PER_RICHIESTA = 25;

export async function calcolaPercorsi(
  coppie: { from: Coordinate; to: Coordinate }[],
  profilo: ModalitaViaggio,
): Promise<(Tratto | { errore: string })[]> {
  if (coppie.length === 0) return [];

  // La firma di functions.invoke non è tipizzata con precisione: si annota
  // esplicitamente il risultato invece di destrutturare un valore `any`.
  const risultato: { data: RispostaPercorso | null; error: unknown } =
    await supabase.functions.invoke<RispostaPercorso>('calculate-route', {
      body: { coppie, profilo },
    });
  const { data, error } = risultato;

  if (error) throw toAppError(error);
  if (!data) throw new AppError('Risposta vuota dal calcolo percorsi.', 'no_data');
  return data.tratti;
}

export async function cercaLuoghi(testo: string, vicinoA?: Coordinate): Promise<Luogo[]> {
  const risultato: { data: RispostaGeocoding | null; error: unknown } =
    await supabase.functions.invoke<RispostaGeocoding>('geocode', {
      body: { testo, vicinoA },
    });
  const { data, error } = risultato;

  if (error) throw toAppError(error);
  return data?.luoghi ?? [];
}
