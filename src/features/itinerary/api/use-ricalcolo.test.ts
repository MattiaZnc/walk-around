import { describe, expect, it } from 'vitest';

import { tratteDaCalcolare } from '@/features/itinerary/api/use-ricalcolo';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import type { Leg, Stop } from '@/types/models';

const ADESSO = '2026-05-04T08:00:00Z';

function tappa(id: string, coordinate: { lat: number; lng: number } | null): Stop {
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
  };
}

function leg(extra: Partial<Leg> = {}): Leg {
  return {
    id: 'l1',
    itinerary_id: 'g1',
    user_id: 'u1',
    from_stop_id: 'a',
    to_stop_id: 'b',
    distance_km: 10,
    duration_min: null,
    source: 'auto',
    is_estimate: false,
    route_geometry: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

const COLOSSEO = { lat: 41.8902572, lng: 12.4923841 };
const VILLA_BORGHESE = { lat: 41.9144111, lng: 12.4848439 };
const PARTENZA = { lat: 41.9028, lng: 12.4964 };

function tratta(extra: Partial<Tratta> = {}): Tratta {
  return {
    chiave: 'a->b',
    fromStop: tappa('a', COLOSSEO),
    toStop: tappa('b', VILLA_BORGHESE),
    leg: null,
    rientro: false,
    ...extra,
  };
}

describe('tratteDaCalcolare', () => {
  it('include le tratte con entrambe le coordinate', () => {
    const { calcolabili, nonCalcolabili } = tratteDaCalcolare([tratta()], true);

    expect(calcolabili).toHaveLength(1);
    expect(calcolabili[0]?.from).toEqual(COLOSSEO);
    expect(calcolabili[0]?.to).toEqual(VILLA_BORGHESE);
    expect(nonCalcolabili).toBe(0);
  });

  it('non tocca mai le tratte inserite a mano', () => {
    const { calcolabili } = tratteDaCalcolare([tratta({ leg: leg({ source: 'manual' }) })], false);
    expect(calcolabili).toHaveLength(0);
  });

  it('con soloMancanti salta le tratte già calcolate', () => {
    const tratte = [tratta({ chiave: 'a->b', leg: leg() }), tratta({ chiave: 'b->c', leg: null })];

    expect(tratteDaCalcolare(tratte, true).calcolabili.map((t) => t.chiave)).toEqual(['b->c']);
    // Ricalcolo completo: entrambe, perché nessuna delle due è manuale.
    expect(tratteDaCalcolare(tratte, false).calcolabili).toHaveLength(2);
  });

  it('conta come non calcolabile una tratta con una tappa senza coordinate', () => {
    const { calcolabili, nonCalcolabili } = tratteDaCalcolare(
      [tratta({ toStop: tappa('b', null) })],
      true,
    );
    expect(calcolabili).toHaveLength(0);
    expect(nonCalcolabili).toBe(1);
  });

  it('il rientro è una tratta come le altre: arriva alla tappa di partenza', () => {
    const arrivo = tappa('partenza', PARTENZA);
    const { calcolabili } = tratteDaCalcolare(
      [tratta({ chiave: 'b->rientro-partenza', toStop: arrivo, rientro: true })],
      true,
    );

    expect(calcolabili).toHaveLength(1);
    expect(calcolabili[0]?.to).toEqual(PARTENZA);
    expect(calcolabili[0]?.toStopId).toBe('partenza');
  });

  it('il rientro verso una partenza senza coordinate non è calcolabile', () => {
    const { calcolabili, nonCalcolabili } = tratteDaCalcolare(
      [tratta({ chiave: 'b->rientro', toStop: tappa('partenza', null), rientro: true })],
      true,
    );
    expect(calcolabili).toHaveLength(0);
    expect(nonCalcolabili).toBe(1);
  });

  it('conserva l’id della tratta esistente, per aggiornarla invece di duplicarla', () => {
    const { calcolabili } = tratteDaCalcolare([tratta({ leg: leg({ id: 'esistente' }) })], false);
    expect(calcolabili[0]?.legId).toBe('esistente');
  });

  it('su un elenco vuoto non produce nulla', () => {
    const { calcolabili, nonCalcolabili } = tratteDaCalcolare([], true);
    expect(calcolabili).toHaveLength(0);
    expect(nonCalcolabili).toBe(0);
  });
});
