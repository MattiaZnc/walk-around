import { describe, expect, it } from 'vitest';

import {
  ACCURATEZZA_MASSIMA_METRI,
  distanzaLeggibile,
  distanzaMetri,
  prossimaTappa,
  RAGGIO_ARRIVO_METRI,
  tappeOrdinatePerDistanza,
  valutaVicinanza,
} from '@/features/itinerary/lib/prossimita';
import type { Stop } from '@/types/models';

const ADESSO = '2026-09-28T09:00:00Z';

// Punti reali, per avere distanze verificabili.
const COLOSSEO = { lat: 41.8902, lng: 12.4924 };
const ARCO_COSTANTINO = { lat: 41.8896, lng: 12.4907 }; // ~155 m dal Colosseo
/** Circa 100 m dal Colosseo: fra il raggio (75 m) e l'incertezza massima (120 m). */
const A_CENTO_METRI = { lat: 41.8893, lng: 12.4924 };
const VILLA_BORGHESE = { lat: 41.9144, lng: 12.4848 }; // ~2,8 km

function tappa(
  id: string,
  coordinate: { lat: number; lng: number } | null,
  extra: Partial<Stop> = {},
): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position: 1,
    label: id,
    address: null,
    lat: coordinate?.lat ?? null,
    lng: coordinate?.lng ?? null,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

describe('distanzaMetri', () => {
  it('misura zero sullo stesso punto', () => {
    expect(distanzaMetri({ ...COLOSSEO, accuratezza: 10 }, COLOSSEO)).toBe(0);
  });

  it('misura distanze note con una tolleranza ragionevole', () => {
    const metri = distanzaMetri({ ...COLOSSEO, accuratezza: 10 }, VILLA_BORGHESE);
    // Colosseo → Villa Borghese in linea d'aria: circa 2,8 km.
    expect(metri).toBeGreaterThan(2500);
    expect(metri).toBeLessThan(3100);
  });

  it('è simmetrica', () => {
    const andata = distanzaMetri({ ...COLOSSEO, accuratezza: 5 }, VILLA_BORGHESE);
    const ritorno = distanzaMetri({ ...VILLA_BORGHESE, accuratezza: 5 }, COLOSSEO);
    expect(Math.abs(andata - ritorno)).toBeLessThanOrEqual(1);
  });
});

describe('tappeOrdinatePerDistanza', () => {
  it('ordina dalla più vicina e salta le tappe senza coordinate', () => {
    const ordinate = tappeOrdinatePerDistanza(
      [tappa('lontana', VILLA_BORGHESE), tappa('senza', null), tappa('vicina', ARCO_COSTANTINO)],
      { ...COLOSSEO, accuratezza: 10 },
    );

    expect(ordinate.map((voce) => voce.tappa.id)).toEqual(['vicina', 'lontana']);
  });
});

describe('prossimaTappa', () => {
  it('è la prima non ancora raggiunta, nell’ordine dell’itinerario', () => {
    const tappe = [
      tappa('a', COLOSSEO, { reached_at: ADESSO }),
      tappa('b', ARCO_COSTANTINO),
      tappa('c', VILLA_BORGHESE),
    ];
    expect(prossimaTappa(tappe)?.id).toBe('b');
  });

  it('è null quando sono tutte raggiunte', () => {
    expect(prossimaTappa([tappa('a', COLOSSEO, { reached_at: ADESSO })])).toBeNull();
  });
});

describe('valutaVicinanza', () => {
  it('segnala l’arrivo quando si è dentro il raggio', () => {
    const esito = valutaVicinanza([tappa('colosseo', COLOSSEO)], {
      ...COLOSSEO,
      accuratezza: 15,
    });

    expect(esito.tipo).toBe('arrivato');
    if (esito.tipo !== 'arrivato') return;
    expect(esito.tappe.map((voce) => voce.tappa.id)).toEqual(['colosseo']);
  });

  it('non segnala nulla quando la tappa è lontana', () => {
    const esito = valutaVicinanza([tappa('villa', VILLA_BORGHESE)], {
      ...COLOSSEO,
      accuratezza: 15,
    });

    expect(esito.tipo).toBe('nessuna-tappa-vicina');
    if (esito.tipo !== 'nessuna-tappa-vicina') return;
    // La distanza resta disponibile per mostrarla nell'interfaccia.
    expect(esito.piuVicina?.metri).toBeGreaterThan(2000);
  });

  it('non decide se la posizione è troppo imprecisa', () => {
    const esito = valutaVicinanza([tappa('colosseo', COLOSSEO)], {
      ...COLOSSEO,
      accuratezza: ACCURATEZZA_MASSIMA_METRI + 1,
    });

    // Con un'incertezza di centinaia di metri si marcherebbero tappe a caso.
    expect(esito.tipo).toBe('posizione-imprecisa');
  });

  it('ignora le tappe già raggiunte', () => {
    const esito = valutaVicinanza([tappa('colosseo', COLOSSEO, { reached_at: ADESSO })], {
      ...COLOSSEO,
      accuratezza: 10,
    });

    expect(esito.tipo).toBe('nessuna-tappa-vicina');
  });

  it('segnala insieme più tappe vicine fra loro', () => {
    // Due tappe a pochi metri: vengono raggiunte nello stesso momento.
    const esito = valutaVicinanza(
      [tappa('prima', COLOSSEO), tappa('seconda', { lat: 41.8903, lng: 12.4925 })],
      { ...COLOSSEO, accuratezza: 10 },
    );

    expect(esito.tipo).toBe('arrivato');
    if (esito.tipo !== 'arrivato') return;
    expect(esito.tappe).toHaveLength(2);
  });

  it('allarga il raggio fino all’incertezza dichiarata', () => {
    const tappe = [tappa('colosseo', COLOSSEO)];

    // Il punto dista circa 100 metri: con GPS preciso non si è arrivati.
    const preciso = { ...A_CENTO_METRI, accuratezza: 10 };
    expect(valutaVicinanza(tappe, preciso).tipo).toBe('nessuna-tappa-vicina');

    // Con un'incertezza di 110 metri quella distanza è compatibile con
    // l'essere sul posto, quindi la tappa si considera raggiunta.
    const incerto = { ...A_CENTO_METRI, accuratezza: 110 };
    expect(valutaVicinanza(tappe, incerto).tipo).toBe('arrivato');
  });

  it('oltre l’incertezza massima il raggio non si allarga più', () => {
    // A 155 metri nessuna incertezza accettabile basta: oltre 120 metri di
    // accuratezza la posizione viene scartata del tutto.
    const esito = valutaVicinanza([tappa('colosseo', COLOSSEO)], {
      ...ARCO_COSTANTINO,
      accuratezza: 119,
    });
    expect(esito.tipo).toBe('nessuna-tappa-vicina');
  });

  it('salta le tappe senza coordinate', () => {
    const esito = valutaVicinanza([tappa('senza', null)], { ...COLOSSEO, accuratezza: 10 });

    expect(esito.tipo).toBe('nessuna-tappa-vicina');
    if (esito.tipo !== 'nessuna-tappa-vicina') return;
    expect(esito.piuVicina).toBeNull();
  });

  it('il raggio predefinito è quello documentato', () => {
    expect(RAGGIO_ARRIVO_METRI).toBe(75);
  });
});

describe('distanzaLeggibile', () => {
  it('arrotonda i metri a multipli di cinque', () => {
    expect(distanzaLeggibile(63)).toBe('65 m');
    expect(distanzaLeggibile(12)).toBe('10 m');
  });

  it('passa ai chilometri oltre i mille metri', () => {
    expect(distanzaLeggibile(2840)).toBe('2,8 km');
    expect(distanzaLeggibile(1000)).toBe('1,0 km');
  });
});
