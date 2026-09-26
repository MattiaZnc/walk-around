/**
 * Contratti condivisi fra le Edge Function e il client.
 * Se cambiano qui, va aggiornato anche src/features/itinerary/api/percorsi.api.ts.
 */

export type Coordinate = {
  lat: number;
  lng: number;
};

/** Geometria del percorso in GeoJSON: è ciò che Leaflet disegna direttamente. */
export type Geometria = {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat], ordine GeoJSON
};

export type Tratto = {
  distanceKm: number;
  durationMin: number | null;
  geometry: Geometria | null;
  /** true quando la distanza è stimata e non un percorso stradale reale. */
  isEstimate: boolean;
  /** Provider che ha risposto: utile in UI e nei log. */
  provider: string;
};

export type RichiestaPercorso = {
  /** Coppie di punti: per ogni coppia viene restituito un tratto. */
  coppie: { from: Coordinate; to: Coordinate }[];
  /** Mezzo di trasporto. */
  profilo?: 'auto' | 'piedi' | 'bici';
};

export type RispostaPercorso = {
  tratti: (Tratto | { errore: string })[];
};

export type Luogo = {
  /** Etichetta completa, pronta da mostrare: "Colosseo, Roma". */
  etichetta: string;
  /** Nome breve del luogo: "Colosseo". */
  nome: string;
  /** Indirizzo leggibile senza il nome: "Piazza del Colosseo, Roma". */
  indirizzo: string;
  lat: number;
  lng: number;
};

export type RispostaGeocoding = {
  luoghi: Luogo[];
  provider: string;
};

export function isTratto(valore: Tratto | { errore: string }): valore is Tratto {
  return !('errore' in valore);
}
