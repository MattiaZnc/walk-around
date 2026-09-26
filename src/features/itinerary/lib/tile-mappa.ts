import { env } from '@/lib/env';

/**
 * Sorgente delle mattonelle della mappa.
 *
 * Predefinito: OpenStreetMap, che non richiede alcuna chiave.
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
    };
  }

  return {
    url: TILE_OSM,
    attribuzione: ATTRIBUZIONE_OSM,
    maxZoom: 19,
    filtraPerTemaScuro: temaScuro,
  };
}
