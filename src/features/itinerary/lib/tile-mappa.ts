import { env } from '@/lib/env';

/**
 * Sorgente delle mattonelle della mappa.
 *
 * Predefinito: mappa vettoriale OpenFreeMap (vedi stileVettoriale), con le
 * mattonelle di OpenStreetMap come riserva. Nessuna delle due richiede chiavi.
 * Le basemap di CARTO, usate in una versione precedente, hanno smesso di
 * funzionare senza registrazione: rispondono con HTTP 200 ma restituiscono
 * un'immagine che dice "api key required", quindi il guasto non si vedeva
 * controllando lo stato della risposta.
 *
 * Con VITE_MAP_TILE_URL si può passare a un altro servizio (per esempio CARTO
 * o Stadia con la propria chiave, oppure un'istanza interna) senza toccare il
 * codice. L'attribuzione va cambiata di conseguenza: è una condizione d'uso,
 * non un dettaglio estetico.
 */

export const TILE_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const ATTRIBUZIONE_OSM =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const ATTRIBUZIONE_OPENFREEMAP =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ' +
  '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> ' +
  ATTRIBUZIONE_OSM;

/**
 * Mappa vettoriale di OpenFreeMap: gratuita, senza chiave né limiti dichiarati.
 * Rispetto alle mattonelle di OpenStreetMap assomiglia molto di più a Google
 * Maps (colori tenui, strade principali evidenziate, scritte nitide a ogni
 * zoom) ed esiste una variante scura vera, senza filtri CSS.
 */
export function stileVettoriale(temaScuro: boolean): string {
  return `https://tiles.openfreemap.org/styles/${temaScuro ? 'fiord' : 'liberty'}`;
}

/**
 * La mappa vettoriale richiede WebGL. Telefoni molto vecchi o browser con
 * l'accelerazione disattivata non lo hanno: lì si torna alle mattonelle.
 */
export function webglDisponibile(): boolean {
  try {
    const tela = document.createElement('canvas');
    return !!(tela.getContext('webgl2') ?? tela.getContext('webgl'));
  } catch {
    return false;
  }
}

export type ConfigurazioneTile = {
  url: string;
  attribuzione: string;
  maxZoom: number;
  /**
   * true quando il tema scuro va ottenuto filtrando le mattonelle.
   * Serve perché non esiste una variante scura di OpenStreetMap: si invertono
   * i colori via CSS, applicando il filtro alle sole mattonelle e non ai
   * marker né al tracciato.
   */
  filtraPerTemaScuro: boolean;
  /** URL dello stile vettoriale, quando si usa MapLibre al posto delle mattonelle. */
  stileVettoriale: string | null;
};

export function configurazioneTile(temaScuro: boolean): ConfigurazioneTile {
  const personalizzato = env.VITE_MAP_TILE_URL;

  if (personalizzato) {
    return {
      url: personalizzato,
      attribuzione: env.VITE_MAP_TILE_ATTRIBUTION ?? ATTRIBUZIONE_OSM,
      maxZoom: 19,
      // Un servizio scelto da chi installa l'app potrebbe avere già una
      // variante scura: in quel caso il filtro rovinerebbe i colori.
      filtraPerTemaScuro: false,
      stileVettoriale: null,
    };
  }

  if (webglDisponibile()) {
    return {
      url: TILE_OSM,
      attribuzione: ATTRIBUZIONE_OPENFREEMAP,
      maxZoom: 20,
      filtraPerTemaScuro: false,
      stileVettoriale: stileVettoriale(temaScuro),
    };
  }

  return {
    url: TILE_OSM,
    attribuzione: ATTRIBUZIONE_OSM,
    maxZoom: 19,
    filtraPerTemaScuro: temaScuro,
    stileVettoriale: null,
  };
}
