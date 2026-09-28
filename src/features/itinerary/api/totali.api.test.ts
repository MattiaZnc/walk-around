import { describe, expect, it } from 'vitest';

import { riepiloga, type TotaliGiorno } from '@/features/itinerary/api/totali.api';

function giorno(extra: Partial<TotaliGiorno> = {}): TotaliGiorno {
  return {
    itineraryId: 'g1',
    data: '2026-01-07',
    km: 10,
    minuti: 20,
    tappe: 3,
    tratte: 2,
    tratteManuali: 0,
    tratteStimate: 0,
    haPartenza: true,
    rientro: false,
    modalita: 'auto',
    ...extra,
  };
}

describe('riepiloga', () => {
  it('somma km, minuti e tappe', () => {
    const riepilogo = riepiloga([
      giorno({ km: 10.5, minuti: 20, tappe: 3 }),
      giorno({ itineraryId: 'g2', km: 4.25, minuti: 15, tappe: 2, tratte: 1 }),
    ]);

    expect(riepilogo.km).toBe(14.75);
    expect(riepilogo.minuti).toBe(35);
    expect(riepilogo.tappe).toBe(5);
    expect(riepilogo.giorni).toBe(2);
  });

  it('arrotonda al centesimo', () => {
    const riepilogo = riepiloga([giorno({ km: 0.1 }), giorno({ itineraryId: 'g2', km: 0.2 })]);
    expect(riepilogo.km).toBe(0.3);
  });

  it('conta come incompleta la giornata a cui mancano tratte', () => {
    // 3 tappe senza rientro: ne servono 2.
    expect(riepiloga([giorno({ tappe: 3, tratte: 2 })]).giorniIncompleti).toBe(0);
    expect(riepiloga([giorno({ tappe: 3, tratte: 1 })]).giorniIncompleti).toBe(1);
  });

  it('con il rientro attivo serve una tratta in più', () => {
    expect(riepiloga([giorno({ tappe: 3, tratte: 2, rientro: true })]).giorniIncompleti).toBe(1);
    expect(riepiloga([giorno({ tappe: 3, tratte: 3, rientro: true })]).giorniIncompleti).toBe(0);
  });

  it('una giornata con una sola tappa non è incompleta', () => {
    expect(riepiloga([giorno({ tappe: 1, tratte: 0, rientro: true })]).giorniIncompleti).toBe(0);
  });

  it('su un elenco vuoto restituisce zeri', () => {
    const riepilogo = riepiloga([]);
    expect(riepilogo).toEqual({ km: 0, minuti: 0, giorni: 0, tappe: 0, giorniIncompleti: 0 });
  });
});
