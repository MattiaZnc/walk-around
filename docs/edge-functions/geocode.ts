// ============================================================================
// FILE GENERATO — non modificare a mano.
// Rigeneralo con:  npm run fn:bundle
// Sorgente: supabase/functions/geocode/ + supabase/functions/_shared/
//
// USO senza CLI: dashboard Supabase -> Edge Functions -> Deploy a new function
//                -> nome "geocode" -> incolla tutto questo file -> Deploy.
//
// Con la CLI non serve: npx supabase functions deploy geocode
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

// ─── da _shared/providers/luoghi.ts ───

export type ProviderLuoghi = {
  nome: string;
  disponibile: () => boolean;
  cerca: (testo: string, vicinoA?: { lat: number; lng: number }) => Promise<Luogo[]>;
};

const LIMITE_RISULTATI = 6;

/** Compone "Colosseo, Piazza del Colosseo, Roma" senza ripetizioni né virgole vuote. */
function componiEtichetta(parti: (string | undefined | null)[]): string {
  const pulite: string[] = [];
  for (const parte of parti) {
    const valore = parte?.trim();
    if (valore && !pulite.includes(valore)) pulite.push(valore);
  }
  return pulite.join(', ');
}

// ---------------------------------------------------------------------------
// Photon (komoot) — basato su OpenStreetMap, senza chiave, pensato per
// l'autocomplete: risponde bene anche a nomi parziali di luoghi ("colosse").
// ---------------------------------------------------------------------------

type RispostaPhoton = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?: string;
      street?: string;
      housenumber?: string;
      postcode?: string;
      city?: string;
      district?: string;
      county?: string;
      state?: string;
      country?: string;
      osm_key?: string;
      osm_value?: string;
    };
  }[];
};

export const providerPhoton: ProviderLuoghi = {
  nome: 'photon',

  disponibile: () => true,

  async cerca(testo, vicinoA) {
    const base = Deno.env.get('PHOTON_BASE_URL') ?? 'https://photon.komoot.io';
    const parametri = new URLSearchParams({
      q: testo,
      limit: String(LIMITE_RISULTATI),
      // Photon accetta solo default/de/en/fr: 'default' usa i nomi locali,
      // quindi in italiano per i luoghi italiani.
      lang: 'default',
    });

    // Dando un punto di riferimento, i risultati vicini vengono prima:
    // "stazione" deve proporre quella della città in cui si sta lavorando.
    if (vicinoA) {
      parametri.set('lat', String(vicinoA.lat));
      parametri.set('lon', String(vicinoA.lng));
    }

    const risposta = await fetchConTimeout(`${base}/api?${parametri.toString()}`, {
      headers: { 'User-Agent': 'walk-around/1.0 (app itinerari personali)' },
    });

    if (!risposta.ok) throw new Error(`Photon ha risposto ${risposta.status}`);

    const dati = (await risposta.json()) as RispostaPhoton;

    const luoghi: Luogo[] = [];
    for (const elemento of dati.features ?? []) {
      const coordinate = elemento.geometry?.coordinates;
      const proprieta = elemento.properties;
      if (!coordinate || coordinate.length < 2 || !proprieta) continue;

      const [lng, lat] = coordinate;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const via = componiEtichetta([
        proprieta.street
          ? componiEtichetta([`${proprieta.street} ${proprieta.housenumber ?? ''}`.trim()])
          : null,
      ]);
      const localita = componiEtichetta([
        proprieta.city ?? proprieta.district ?? proprieta.county,
        proprieta.state,
        proprieta.country,
      ]);

      const nome = proprieta.name ?? via ?? localita;
      const indirizzo = componiEtichetta([via, localita]);

      luoghi.push({
        nome,
        indirizzo,
        etichetta: componiEtichetta([nome, indirizzo]),
        lat,
        lng,
      });
    }

    return luoghi;
  },
};

// ---------------------------------------------------------------------------
// Nominatim — riserva. La politica d'uso chiede un massimo di una richiesta al
// secondo e un User-Agent identificabile: per questo è solo la riserva, usata
// quando Photon non risponde.
// ---------------------------------------------------------------------------

type RispostaNominatim = {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}[];

export const providerNominatim: ProviderLuoghi = {
  nome: 'nominatim',

  disponibile: () => true,

  async cerca(testo) {
    const base = Deno.env.get('NOMINATIM_BASE_URL') ?? 'https://nominatim.openstreetmap.org';
    const parametri = new URLSearchParams({
      q: testo,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(LIMITE_RISULTATI),
      'accept-language': 'it',
    });

    const risposta = await fetchConTimeout(`${base}/search?${parametri.toString()}`, {
      headers: {
        'User-Agent': 'walk-around/1.0 (app itinerari personali)',
        'Accept-Language': 'it',
      },
    });

    if (!risposta.ok) throw new Error(`Nominatim ha risposto ${risposta.status}`);

    const dati = (await risposta.json()) as RispostaNominatim;

    const luoghi: Luogo[] = [];
    for (const elemento of dati) {
      const lat = Number(elemento.lat);
      const lng = Number(elemento.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const etichetta = elemento.display_name ?? '';
      const nome = elemento.name?.trim() || etichetta.split(',')[0]?.trim() || etichetta;
      const indirizzo = etichetta.startsWith(nome)
        ? etichetta.slice(nome.length).replace(/^,\s*/, '')
        : etichetta;

      luoghi.push({ nome, indirizzo, etichetta, lat, lng });
    }

    return luoghi;
  },
};

export function providerLuoghiInOrdine(): ProviderLuoghi[] {
  const richiesto = Deno.env.get('GEOCODE_PROVIDER');

  const catalogo: Record<string, ProviderLuoghi> = {
    photon: providerPhoton,
    nominatim: providerNominatim,
  };

  if (richiesto) {
    const scelto = catalogo[richiesto.toLowerCase()];
    if (scelto) return [scelto];
  }

  return [providerPhoton, providerNominatim];
}

// ─── geocode/index.ts ───
/**
 * geocode — cerca luoghi e indirizzi per l'autocompletamento.
 *
 * Risponde sia a nomi di luoghi ("Colosseo") sia a indirizzi
 * ("Via Roma 1, Milano"). La chiamata passa da qui e non dal browser così la
 * scelta del provider (ed eventuali chiavi) resta lato server.
 */

const LUNGHEZZA_MINIMA = 3;
const cache = new CacheBreve<{ luoghi: Luogo[]; provider: string }>(10 * 60_000, 200);

type RichiestaGeocoding = {
  testo?: string;
  /** Punto di riferimento facoltativo per dare priorità ai risultati vicini. */
  vicinoA?: { lat: number; lng: number };
};

Deno.serve(async (richiesta) => {
  if (richiesta.method === 'OPTIONS') return rispostaPreflight();
  if (richiesta.method !== 'POST') return rispostaErrore('Metodo non consentito', 405);

  let corpo: RichiestaGeocoding;
  try {
    corpo = (await richiesta.json()) as RichiestaGeocoding;
  } catch {
    return rispostaErrore('Corpo della richiesta non è JSON valido');
  }

  const testo = corpo.testo?.trim() ?? '';
  if (testo.length < LUNGHEZZA_MINIMA) {
    // Meno di tre caratteri produce risultati inutili e spreca richieste.
    const vuota: RispostaGeocoding = { luoghi: [], provider: 'nessuno' };
    return rispostaJson(vuota);
  }

  const vicinoA =
    corpo.vicinoA &&
    Number.isFinite(corpo.vicinoA.lat) &&
    Number.isFinite(corpo.vicinoA.lng)
      ? corpo.vicinoA
      : undefined;

  const chiave = `${testo.toLowerCase()}|${vicinoA ? `${vicinoA.lat.toFixed(2)},${vicinoA.lng.toFixed(2)}` : ''}`;
  const inCache = cache.leggi(chiave);
  if (inCache) return rispostaJson(inCache satisfies RispostaGeocoding);

  const problemi: string[] = [];

  for (const provider of providerLuoghiInOrdine()) {
    try {
      const luoghi = await provider.cerca(testo, vicinoA);
      const risposta: RispostaGeocoding = { luoghi, provider: provider.nome };
      // Anche un elenco vuoto va in cache: ripetere la stessa ricerca senza
      // risultati non cambierebbe nulla.
      cache.scrivi(chiave, risposta);
      return rispostaJson(risposta);
    } catch (errore) {
      problemi.push(`${provider.nome}: ${errore instanceof Error ? errore.message : 'errore'}`);
    }
  }

  console.error('Geocoding non disponibile', problemi);
  return rispostaErrore('Ricerca indirizzi momentaneamente non disponibile', 503);
});
