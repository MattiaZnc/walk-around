import type { Coordinate } from './tipi.ts';

const RAGGIO_TERRA_KM = 6371;

/** Distanza in linea d'aria fra due punti (formula dell'emisenoverso). */
export function distanzaAerea(da: Coordinate, a: Coordinate): number {
  const radianti = (gradi: number) => (gradi * Math.PI) / 180;

  const deltaLat = radianti(a.lat - da.lat);
  const deltaLng = radianti(a.lng - da.lng);
  const latDa = radianti(da.lat);
  const latA = radianti(a.lat);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latDa) * Math.cos(latA) * Math.sin(deltaLng / 2) ** 2;

  return 2 * RAGGIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Fattore di tortuosità: le strade non vanno in linea retta.
 * 1.3 è il valore comunemente usato per la rete stradale europea; resta una
 * stima, per questo il risultato viene marcato con isEstimate.
 */
export const FATTORE_STRADALE = 1.3;

/** Velocità medie usate solo per stimare i tempi quando manca il provider. */
export const VELOCITA_MEDIA_KMH: Record<string, number> = {
  auto: 50,
  bici: 15,
  piedi: 4.5,
};

export function coordinataValida(punto: Coordinate | null | undefined): punto is Coordinate {
  return (
    !!punto &&
    Number.isFinite(punto.lat) &&
    Number.isFinite(punto.lng) &&
    punto.lat >= -90 &&
    punto.lat <= 90 &&
    punto.lng >= -180 &&
    punto.lng <= 180
  );
}
