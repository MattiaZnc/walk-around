import type { Stop } from '@/types/models';

/**
 * Riconoscimento dell'arrivo a una tappa in base alla posizione.
 *
 * Tutto quello che decide "sono arrivato" vive qui, senza React e senza
 * geolocalizzazione: così si può provare con posizioni finte, che è il solo
 * modo sensato di verificare questa logica.
 */

export type Posizione = {
  lat: number;
  lng: number;
  /** Raggio di incertezza in metri dichiarato dal dispositivo. */
  accuratezza: number;
};

/**
 * Entro questa distanza si considera raggiunta la tappa.
 * 75 metri è un compromesso: in città il GPS sbaglia di 10-50 metri, e una
 * soglia più stretta non scatterebbe mai; una più larga segnerebbe come
 * raggiunte tappe di fronte alle quali non si è ancora passati.
 */
export const RAGGIO_ARRIVO_METRI = 75;

/**
 * Oltre questa incertezza la posizione non viene usata per marcare le tappe.
 * Con un'accuratezza di centinaia di metri (chiuso in un edificio, rete mobile
 * senza GPS) si segnerebbero tappe a caso: meglio non decidere.
 */
export const ACCURATEZZA_MASSIMA_METRI = 120;

const RAGGIO_TERRA_METRI = 6_371_000;

/** Distanza in metri fra due punti (formula dell'emisenoverso). */
export function distanzaMetri(da: Posizione | Coordinate, a: Coordinate): number {
  const radianti = (gradi: number) => (gradi * Math.PI) / 180;

  const deltaLat = radianti(a.lat - da.lat);
  const deltaLng = radianti(a.lng - da.lng);
  const latDa = radianti(da.lat);
  const latA = radianti(a.lat);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latDa) * Math.cos(latA) * Math.sin(deltaLng / 2) ** 2;

  return Math.round(2 * RAGGIO_TERRA_METRI * Math.asin(Math.min(1, Math.sqrt(h))));
}

export type Coordinate = { lat: number; lng: number };

export type TappaConDistanza = {
  tappa: Stop;
  metri: number;
};

function coordinateDi(tappa: Stop): Coordinate | null {
  if (tappa.lat === null || tappa.lng === null) return null;
  return { lat: tappa.lat, lng: tappa.lng };
}

/** Distanza dalle tappe geolocalizzate, dalla più vicina. */
export function tappeOrdinatePerDistanza(
  tappe: readonly Stop[],
  posizione: Posizione,
): TappaConDistanza[] {
  const risultato: TappaConDistanza[] = [];

  for (const tappa of tappe) {
    const coordinate = coordinateDi(tappa);
    if (!coordinate) continue;
    risultato.push({ tappa, metri: distanzaMetri(posizione, coordinate) });
  }

  return risultato.sort((primo, secondo) => primo.metri - secondo.metri);
}

/** La prossima tappa da raggiungere: la prima non ancora visitata, in ordine. */
export function prossimaTappa(tappe: readonly Stop[]): Stop | null {
  return tappe.find((tappa) => tappa.reached_at === null) ?? null;
}

export type EsitoVicinanza =
  | { tipo: 'posizione-imprecisa'; accuratezza: number }
  | { tipo: 'nessuna-tappa-vicina'; piuVicina: TappaConDistanza | null }
  | { tipo: 'arrivato'; tappe: TappaConDistanza[]; piuVicina: TappaConDistanza };

/**
 * Decide se la posizione corrente corrisponde all'arrivo a una o più tappe.
 *
 * Restituisce tutte le tappe entro il raggio, non solo la prima: due tappe
 * vicine (due negozi sulla stessa via) vengono raggiunte insieme, e segnalarne
 * una sola lascerebbe l'altra indietro senza motivo apparente.
 */
export function valutaVicinanza(
  tappe: readonly Stop[],
  posizione: Posizione,
  raggioMetri = RAGGIO_ARRIVO_METRI,
): EsitoVicinanza {
  if (posizione.accuratezza > ACCURATEZZA_MASSIMA_METRI) {
    return { tipo: 'posizione-imprecisa', accuratezza: posizione.accuratezza };
  }

  const daRaggiungere = tappe.filter((tappa) => tappa.reached_at === null);
  const ordinate = tappeOrdinatePerDistanza(daRaggiungere, posizione);
  const piuVicina = ordinate[0] ?? null;

  // Il raggio si allarga fino all'incertezza dichiarata: con accuratezza di 100
  // metri, essere "a 90 metri" può già significare essere sul posto.
  const soglia = Math.max(raggioMetri, posizione.accuratezza);
  const arrivate = ordinate.filter((voce) => voce.metri <= soglia);

  if (arrivate.length === 0 || !piuVicina) {
    return { tipo: 'nessuna-tappa-vicina', piuVicina };
  }

  return { tipo: 'arrivato', tappe: arrivate, piuVicina };
}

/** Testo della distanza: metri sotto il chilometro, poi chilometri. */
export function distanzaLeggibile(metri: number): string {
  if (metri < 1000) return `${String(Math.round(metri / 5) * 5)} m`;
  return `${(metri / 1000).toFixed(1).replace('.', ',')} km`;
}
