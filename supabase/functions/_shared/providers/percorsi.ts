import { distanzaAerea, FATTORE_STRADALE, VELOCITA_MEDIA_KMH } from '../geo.ts';
import { fetchConTimeout } from '../http.ts';
import type { Coordinate, Geometria, Tratto } from '../tipi.ts';

export type Profilo = 'auto' | 'piedi' | 'bici';

export type ProviderPercorsi = {
  nome: string;
  /** false quando manca la configurazione necessaria (es. API key). */
  disponibile: () => boolean;
  calcola: (da: Coordinate, a: Coordinate, profilo: Profilo) => Promise<Tratto>;
};

// ---------------------------------------------------------------------------
// OpenRouteService — richiede ORS_API_KEY (piano gratuito: 2000 richieste/giorno)
// ---------------------------------------------------------------------------

const PROFILI_ORS: Record<Profilo, string> = {
  auto: 'driving-car',
  bici: 'cycling-regular',
  piedi: 'foot-walking',
};

type RispostaOrs = {
  features?: {
    properties?: { summary?: { distance?: number; duration?: number } };
    geometry?: { type?: string; coordinates?: [number, number][] };
  }[];
};

export const providerOrs: ProviderPercorsi = {
  nome: 'openrouteservice',

  disponibile: () => !!Deno.env.get('ORS_API_KEY'),

  async calcola(da, a, profilo) {
    const chiave = Deno.env.get('ORS_API_KEY');
    if (!chiave) throw new Error('ORS_API_KEY non configurata');

    const risposta = await fetchConTimeout(
      `https://api.openrouteservice.org/v2/directions/${PROFILI_ORS[profilo]}/geojson`,
      {
        method: 'POST',
        headers: {
          Authorization: chiave,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [da.lng, da.lat],
            [a.lng, a.lat],
          ],
        }),
      },
    );

    if (!risposta.ok) {
      throw new Error(`OpenRouteService ha risposto ${risposta.status}`);
    }

    const dati = (await risposta.json()) as RispostaOrs;
    const percorso = dati.features?.[0];
    const metri = percorso?.properties?.summary?.distance;
    const secondi = percorso?.properties?.summary?.duration;

    if (typeof metri !== 'number') {
      throw new Error('Risposta di OpenRouteService senza distanza');
    }

    const coordinate = percorso?.geometry?.coordinates;
    const geometry: Geometria | null =
      coordinate && coordinate.length > 1 ? { type: 'LineString', coordinates: coordinate } : null;

    return {
      distanceKm: Math.round((metri / 1000) * 100) / 100,
      durationMin: typeof secondi === 'number' ? Math.round(secondi / 60) : null,
      geometry,
      isEstimate: false,
      provider: 'openrouteservice',
    };
  },
};

// ---------------------------------------------------------------------------
// OSRM su istanze pubbliche FOSSGIS, senza chiave.
//
// Attenzione: ogni profilo ha il proprio server. Il server dimostrativo
// router.project-osrm.org conosce SOLO l'automobile e, se gli si chiede un
// percorso a piedi, risponde comunque con quello in auto: Colosseo → Villa
// Borghese diventava "7,51 km in 12 minuti" a piedi, invece di 3,55 km in 47
// minuti. Meglio server distinti che un numero plausibile ma sbagliato.
//
// Per carichi superiori all'uso personale: chiave ORS oppure istanza propria
// (OSRM_BASE_URL_AUTO / _PIEDI / _BICI).
// ---------------------------------------------------------------------------

const SERVER_OSRM: Record<Profilo, { base: string; percorso: string }> = {
  auto: { base: 'https://routing.openstreetmap.de/routed-car', percorso: 'driving' },
  piedi: { base: 'https://routing.openstreetmap.de/routed-foot', percorso: 'foot' },
  bici: { base: 'https://routing.openstreetmap.de/routed-bike', percorso: 'bike' },
};

const VARIABILE_OSRM: Record<Profilo, string> = {
  auto: 'OSRM_BASE_URL_AUTO',
  piedi: 'OSRM_BASE_URL_PIEDI',
  bici: 'OSRM_BASE_URL_BICI',
};

type RispostaOsrm = {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { type?: string; coordinates?: [number, number][] };
  }[];
};

export const providerOsrm: ProviderPercorsi = {
  nome: 'osrm',

  disponibile: () => true,

  async calcola(da, a, profilo) {
    const predefinito = SERVER_OSRM[profilo];
    const base = Deno.env.get(VARIABILE_OSRM[profilo]) ?? predefinito.base;
    const url =
      `${base}/route/v1/${predefinito.percorso}/` +
      `${da.lng},${da.lat};${a.lng},${a.lat}` +
      '?overview=full&geometries=geojson&alternatives=false&steps=false';

    const risposta = await fetchConTimeout(url, {
      headers: { 'User-Agent': 'walk-around/1.0 (app itinerari personali)' },
    });

    if (!risposta.ok) {
      throw new Error(`OSRM ha risposto ${risposta.status}`);
    }

    const dati = (await risposta.json()) as RispostaOsrm;
    if (dati.code !== 'Ok') {
      throw new Error(`OSRM: ${dati.code ?? 'risposta non valida'}`);
    }

    const percorso = dati.routes?.[0];
    const metri = percorso?.distance;
    if (typeof metri !== 'number') {
      throw new Error('Risposta di OSRM senza distanza');
    }

    const coordinate = percorso?.geometry?.coordinates;
    const geometry: Geometria | null =
      coordinate && coordinate.length > 1 ? { type: 'LineString', coordinates: coordinate } : null;

    return {
      distanceKm: Math.round((metri / 1000) * 100) / 100,
      durationMin:
        typeof percorso?.duration === 'number' ? Math.round(percorso.duration / 60) : null,
      geometry,
      isEstimate: false,
      provider: 'osrm',
    };
  },
};

// ---------------------------------------------------------------------------
// Stima: ultima rete di sicurezza. Non fallisce mai, ma dichiara di essere
// una stima così l'interfaccia può segnalarlo.
// ---------------------------------------------------------------------------

export const providerStima: ProviderPercorsi = {
  nome: 'stima',

  disponibile: () => true,

  calcola(da, a, profilo) {
    const aerea = distanzaAerea(da, a);
    const km = Math.round(aerea * FATTORE_STRADALE * 100) / 100;
    const velocita = VELOCITA_MEDIA_KMH[profilo] ?? VELOCITA_MEDIA_KMH.auto ?? 50;

    return Promise.resolve({
      distanceKm: km,
      durationMin: Math.round((km / velocita) * 60),
      // Linea retta fra i due punti: meglio di niente per orientarsi sulla mappa.
      geometry: {
        type: 'LineString',
        coordinates: [
          [da.lng, da.lat],
          [a.lng, a.lat],
        ],
      },
      isEstimate: true,
      provider: 'stima',
    });
  },
};

/**
 * Ordine di preferenza: il provider configurato, poi quelli pubblici, infine
 * la stima. `ROUTE_PROVIDER` permette di forzarne uno.
 */
export function providerInOrdine(): ProviderPercorsi[] {
  const richiesto = Deno.env.get('ROUTE_PROVIDER');

  const catalogo: Record<string, ProviderPercorsi> = {
    openrouteservice: providerOrs,
    ors: providerOrs,
    osrm: providerOsrm,
    stima: providerStima,
  };

  if (richiesto) {
    const scelto = catalogo[richiesto.toLowerCase()];
    // Anche con un provider forzato la stima resta come riserva: l'utente non
    // deve mai trovarsi bloccato perché un servizio esterno è giù.
    if (scelto) return scelto === providerStima ? [scelto] : [scelto, providerStima];
  }

  return [providerOrs, providerOsrm, providerStima].filter((provider) => provider.disponibile());
}
