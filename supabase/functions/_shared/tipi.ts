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

/**
 * Una manovra del percorso, in forma strutturata: il testo italiano lo compone
 * il client (src/features/itinerary/lib/navigazione.ts), così la formulazione
 * è la stessa qualunque provider abbia risposto.
 */
export type Manovra = {
  tipo: 'partenza' | 'svolta' | 'prosegui' | 'rotonda' | 'inversione' | 'arrivo';
  direzione:
    | 'sinistra'
    | 'destra'
    | 'leggermente-sinistra'
    | 'leggermente-destra'
    | 'nettamente-sinistra'
    | 'nettamente-destra'
    | 'dritto'
    | null;
  /** Nome della strada che si imbocca; stringa vuota se senza nome. */
  strada: string;
  /** Uscita da prendere, solo per le rotonde. */
  uscita: number | null;
  lat: number;
  lng: number;
  /** Metri dall'inizio del percorso al punto della manovra. */
  progressivaM: number;
};

export type Tratto = {
  distanceKm: number;
  durationMin: number | null;
  geometry: Geometria | null;
  /** true quando la distanza è stimata e non un percorso stradale reale. */
  isEstimate: boolean;
  /** Provider che ha risposto: utile in UI e nei log. */
  provider: string;
  /** Indicazioni svolta per svolta, solo se richieste con `istruzioni`. */
  manovre?: Manovra[];
};

export type RichiestaPercorso = {
  /** Coppie di punti: per ogni coppia viene restituito un tratto. */
  coppie: { from: Coordinate; to: Coordinate }[];
  /** Mezzo di trasporto. */
  profilo?: 'auto' | 'piedi' | 'bici';
  /** true per ricevere anche le manovre: servono al navigatore, non ai km. */
  istruzioni?: boolean;
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
