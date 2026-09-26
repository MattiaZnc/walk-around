import { fetchConTimeout } from '../http.ts';
import type { Luogo } from '../tipi.ts';

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
