// ============================================================================
// FILE GENERATO — non modificare a mano.
// Rigeneralo con:  npm run fn:bundle
// Sorgente: supabase/functions/calculate-route/ + supabase/functions/_shared/
//
// USO senza CLI: dashboard Supabase -> Edge Functions -> Deploy a new function
//                -> nome "calculate-route" -> incolla tutto questo file -> Deploy.
//
// Con la CLI non serve: npx supabase functions deploy calculate-route
// ============================================================================

// ─── da _shared/tipi.ts ───
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

// ─── da _shared/geo.ts ───

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

// ─── da _shared/http.ts ───
/** Utilità comuni alle Edge Function: CORS, risposte JSON, errori. */

export const intestazioniCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function rispostaPreflight(): Response {
  return new Response('ok', { headers: intestazioniCors });
}

export function rispostaJson(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...intestazioniCors, 'Content-Type': 'application/json' },
  });
}

export function rispostaErrore(messaggio: string, stato = 400): Response {
  return rispostaJson({ errore: messaggio }, stato);
}

/**
 * Timeout sulle chiamate esterne: senza questo una richiesta appesa consuma
 * tutto il tempo di esecuzione della funzione e l'utente resta a guardare.
 */
export async function fetchConTimeout(
  url: string,
  opzioni: RequestInit = {},
  millisecondi = 8000,
): Promise<Response> {
  const controllore = new AbortController();
  const timer = setTimeout(() => {
    controllore.abort();
  }, millisecondi);

  try {
    return await fetch(url, { ...opzioni, signal: controllore.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cache in memoria con scadenza. L'istanza della funzione è effimera, ma
 * durante una raffica di digitazioni (autocomplete) evita richieste ripetute
 * identiche al provider.
 */
export class CacheBreve<T> {
  private readonly voci = new Map<string, { valore: T; scadenza: number }>();

  constructor(
    private readonly durataMs = 5 * 60_000,
    private readonly massimo = 200,
  ) {}

  leggi(chiave: string): T | undefined {
    const voce = this.voci.get(chiave);
    if (!voce) return undefined;
    if (voce.scadenza < Date.now()) {
      this.voci.delete(chiave);
      return undefined;
    }
    return voce.valore;
  }

  scrivi(chiave: string, valore: T): void {
    if (this.voci.size >= this.massimo) {
      const piuVecchia = this.voci.keys().next().value;
      if (piuVecchia !== undefined) this.voci.delete(piuVecchia);
    }
    this.voci.set(chiave, { valore, scadenza: Date.now() + this.durataMs });
  }
}

// ─── da _shared/providers/percorsi.ts ───

export type Profilo = 'auto' | 'piedi' | 'bici';

export type ProviderPercorsi = {
  nome: string;
  /** false quando manca la configurazione necessaria (es. API key). */
  disponibile: () => boolean;
  /** `istruzioni` chiede anche le manovre: le usa solo il navigatore. */
  calcola: (
    da: Coordinate,
    a: Coordinate,
    profilo: Profilo,
    istruzioni?: boolean,
  ) => Promise<Tratto>;
};

type Direzione = Manovra['direzione'];

const DIREZIONI_OSRM: Record<string, Direzione> = {
  left: 'sinistra',
  right: 'destra',
  'slight left': 'leggermente-sinistra',
  'slight right': 'leggermente-destra',
  'sharp left': 'nettamente-sinistra',
  'sharp right': 'nettamente-destra',
  straight: 'dritto',
};

type PassoOsrm = {
  distance?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string; exit?: number; location?: [number, number] };
};

/**
 * Traduce i passi di OSRM in manovre. Si scartano quelli che non chiedono di
 * fare nulla (avvisi, corsie, uscita dalla rotonda già annunciata entrando).
 */
export function manovreDaOsrm(passi: PassoOsrm[]): Manovra[] {
  const manovre: Manovra[] = [];
  let progressiva = 0;

  for (const passo of passi) {
    const inizio = progressiva;
    progressiva += passo.distance ?? 0;

    const tipoOsrm = passo.maneuver?.type ?? '';
    const luogo = passo.maneuver?.location;
    if (!luogo) continue;
    if (['notification', 'use lane', 'exit roundabout', 'exit rotary'].includes(tipoOsrm)) {
      continue;
    }

    const modificatore = passo.maneuver?.modifier ?? '';
    const direzione = DIREZIONI_OSRM[modificatore] ?? null;

    let tipo: Manovra['tipo'];
    if (tipoOsrm === 'depart') tipo = 'partenza';
    else if (tipoOsrm === 'arrive') tipo = 'arrivo';
    else if (tipoOsrm.includes('roundabout') || tipoOsrm === 'rotary') tipo = 'rotonda';
    else if (modificatore === 'uturn') tipo = 'inversione';
    else if (direzione === 'dritto' || direzione === null) tipo = 'prosegui';
    else tipo = 'svolta';

    manovre.push({
      tipo,
      direzione: tipo === 'svolta' || tipo === 'partenza' ? direzione : null,
      strada: passo.name ?? '',
      uscita: tipo === 'rotonda' ? (passo.maneuver?.exit ?? null) : null,
      lng: luogo[0],
      lat: luogo[1],
      progressivaM: Math.round(inizio),
    });
  }

  return manovre;
}

type PassoOrs = {
  distance?: number;
  name?: string;
  type?: number;
  exit_number?: number;
  way_points?: [number, number];
};

/** Codici dei tipi di passo di OpenRouteService (documentazione ORS). */
const TIPI_ORS: Record<number, { tipo: Manovra['tipo']; direzione: Direzione }> = {
  0: { tipo: 'svolta', direzione: 'sinistra' },
  1: { tipo: 'svolta', direzione: 'destra' },
  2: { tipo: 'svolta', direzione: 'nettamente-sinistra' },
  3: { tipo: 'svolta', direzione: 'nettamente-destra' },
  4: { tipo: 'svolta', direzione: 'leggermente-sinistra' },
  5: { tipo: 'svolta', direzione: 'leggermente-destra' },
  6: { tipo: 'prosegui', direzione: null },
  7: { tipo: 'rotonda', direzione: null },
  9: { tipo: 'inversione', direzione: null },
  10: { tipo: 'arrivo', direzione: null },
  11: { tipo: 'partenza', direzione: null },
  12: { tipo: 'svolta', direzione: 'leggermente-sinistra' },
  13: { tipo: 'svolta', direzione: 'leggermente-destra' },
};

export function manovreDaOrs(passi: PassoOrs[], coordinate: [number, number][]): Manovra[] {
  const manovre: Manovra[] = [];
  let progressiva = 0;

  for (const passo of passi) {
    const inizio = progressiva;
    progressiva += passo.distance ?? 0;

    const voce = TIPI_ORS[passo.type ?? -1];
    const punto = coordinate[passo.way_points?.[0] ?? -1];
    if (!voce || !punto) continue;

    manovre.push({
      ...voce,
      strada: passo.name && passo.name !== '-' ? passo.name : '',
      uscita: voce.tipo === 'rotonda' ? (passo.exit_number ?? null) : null,
      lng: punto[0],
      lat: punto[1],
      progressivaM: Math.round(inizio),
    });
  }

  return manovre;
}

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
    properties?: {
      summary?: { distance?: number; duration?: number };
      segments?: { steps?: PassoOrs[] }[];
    };
    geometry?: { type?: string; coordinates?: [number, number][] };
  }[];
};

export const providerOrs: ProviderPercorsi = {
  nome: 'openrouteservice',

  disponibile: () => !!Deno.env.get('ORS_API_KEY'),

  async calcola(da, a, profilo, istruzioni = false) {
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
          instructions: istruzioni,
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
      ...(istruzioni && coordinate
        ? {
            manovre: manovreDaOrs(
              percorso?.properties?.segments?.flatMap((segmento) => segmento.steps ?? []) ?? [],
              coordinate,
            ),
          }
        : {}),
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
    legs?: { steps?: PassoOsrm[] }[];
  }[];
};

export const providerOsrm: ProviderPercorsi = {
  nome: 'osrm',

  disponibile: () => true,

  async calcola(da, a, profilo, istruzioni = false) {
    const predefinito = SERVER_OSRM[profilo];
    const base = Deno.env.get(VARIABILE_OSRM[profilo]) ?? predefinito.base;
    const url =
      `${base}/route/v1/${predefinito.percorso}/` +
      `${da.lng},${da.lat};${a.lng},${a.lat}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=${String(istruzioni)}`;

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
      ...(istruzioni
        ? { manovre: manovreDaOsrm(percorso?.legs?.flatMap((tappa) => tappa.steps ?? []) ?? []) }
        : {}),
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

// ─── calculate-route/index.ts ───
/**
 * calculate-route — distanza, durata e geometria fra coppie di coordinate.
 *
 * Perché sta qui e non nel browser:
 *  - l'eventuale ORS_API_KEY resta lato server (nel frontend finirebbe nel bundle);
 *  - il provider si può cambiare senza rilasciare una nuova versione dell'app.
 *
 * Non fallisce mai del tutto: se i provider esterni non rispondono, restituisce
 * una stima marcata con isEstimate, così l'utente può proseguire e correggere
 * il valore a mano.
 */

const MASSIMO_COPPIE = 25;
const cache = new CacheBreve<Tratto>(10 * 60_000, 300);

function chiaveCache(
  da: { lat: number; lng: number },
  a: { lat: number; lng: number },
  profilo: Profilo,
  istruzioni: boolean,
): string {
  const arrotonda = (valore: number) => valore.toFixed(5);
  return `${profilo}${istruzioni ? '+istruzioni' : ''}:${arrotonda(da.lat)},${arrotonda(da.lng)}->${arrotonda(a.lat)},${arrotonda(a.lng)}`;
}

function profiloValido(valore: string | undefined): Profilo {
  return valore === 'piedi' || valore === 'bici' ? valore : 'auto';
}

Deno.serve(async (richiesta) => {
  if (richiesta.method === 'OPTIONS') return rispostaPreflight();
  if (richiesta.method !== 'POST') return rispostaErrore('Metodo non consentito', 405);

  let corpo: RichiestaPercorso;
  try {
    corpo = (await richiesta.json()) as RichiestaPercorso;
  } catch {
    return rispostaErrore('Corpo della richiesta non è JSON valido');
  }

  const coppie = corpo.coppie;
  if (!Array.isArray(coppie) || coppie.length === 0) {
    return rispostaErrore('Serve almeno una coppia di coordinate');
  }
  if (coppie.length > MASSIMO_COPPIE) {
    return rispostaErrore(`Massimo ${MASSIMO_COPPIE} tratte per richiesta`);
  }

  const profilo = profiloValido(corpo.profilo);
  const istruzioni = corpo.istruzioni === true;
  const provider = providerInOrdine();

  const tratti = await Promise.all(
    coppie.map(async (coppia) => {
      if (!coordinataValida(coppia?.from) || !coordinataValida(coppia?.to)) {
        return { errore: 'Coordinate mancanti o non valide' };
      }

      const chiave = chiaveCache(coppia.from, coppia.to, profilo, istruzioni);
      const inCache = cache.leggi(chiave);
      if (inCache) return inCache;

      const problemi: string[] = [];

      // I provider vengono provati in ordine: il primo che risponde vince.
      for (const candidato of provider) {
        try {
          const tratto = await candidato.calcola(coppia.from, coppia.to, profilo, istruzioni);
          cache.scrivi(chiave, tratto);
          return tratto;
        } catch (errore) {
          problemi.push(
            `${candidato.nome}: ${errore instanceof Error ? errore.message : 'errore'}`,
          );
        }
      }

      console.error('Nessun provider ha risposto', problemi);
      return { errore: 'Nessun servizio di calcolo percorsi disponibile' };
    }),
  );

  const risposta: RispostaPercorso = { tratti };
  return rispostaJson(risposta);
});
