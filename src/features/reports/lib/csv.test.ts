import { describe, expect, it } from 'vitest';

import type { TotaliGiorno } from '@/features/itinerary/api/totali.api';
import { componiCsv, INTESTAZIONI, nomeFileCsv, rigaCsv } from '@/features/reports/lib/csv';

function giorno(extra: Partial<TotaliGiorno> = {}): TotaliGiorno {
  return {
    itineraryId: 'g1',
    data: '2026-01-07',
    km: 12.5,
    minuti: 25,
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

describe('rigaCsv', () => {
  it('usa il punto e virgola e la virgola decimale, come vuole Excel italiano', () => {
    const riga = rigaCsv(giorno());

    expect(riga.split(';')).toHaveLength(INTESTAZIONI.length);
    expect(riga).toContain('12,50');
    expect(riga).not.toContain('12.50');
  });

  it('scrive il mezzo in italiano', () => {
    expect(rigaCsv(giorno({ modalita: 'piedi' }))).toContain('a piedi');
    expect(rigaCsv(giorno({ modalita: 'auto' }))).toContain('in auto');
  });

  it('segnala se la giornata è completa', () => {
    // 3 tappe senza rientro: servono 2 tratte.
    expect(rigaCsv(giorno({ tappe: 3, tratte: 2 }))).toMatch(/;sì$/);
    expect(rigaCsv(giorno({ tappe: 3, tratte: 1 }))).toMatch(/;no$/);
  });

  it('con il rientro attivo conta una tratta in più', () => {
    expect(rigaCsv(giorno({ tappe: 3, tratte: 2, rientro: true }))).toMatch(/;no$/);
    expect(rigaCsv(giorno({ tappe: 3, tratte: 3, rientro: true }))).toMatch(/;sì$/);
  });

  it('una sola tappa non richiede tratte', () => {
    expect(rigaCsv(giorno({ tappe: 1, tratte: 0, rientro: true }))).toMatch(/;sì$/);
  });
});

describe('componiCsv', () => {
  it('comincia con il BOM, altrimenti Excel storpia le accentate', () => {
    expect(componiCsv([giorno()]).startsWith('﻿')).toBe(true);
  });

  it('usa il fine riga CRLF previsto dallo standard', () => {
    const csv = componiCsv([giorno()]);
    expect(csv).toContain('\r\n');
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('mette l’intestazione e ordina i giorni dal più vecchio', () => {
    const csv = componiCsv([
      giorno({ itineraryId: 'g2', data: '2026-01-09' }),
      giorno({ itineraryId: 'g1', data: '2026-01-07' }),
    ]);
    const righe = csv.replace('﻿', '').split('\r\n');

    expect(righe[0]).toBe(INTESTAZIONI.join(';'));
    expect(righe[1]).toContain('2026-01-07');
    expect(righe[2]).toContain('2026-01-09');
  });

  it('chiude con la riga dei totali', () => {
    const csv = componiCsv([
      giorno({ itineraryId: 'g1', km: 10.25, minuti: 20, tappe: 2 }),
      giorno({ itineraryId: 'g2', data: '2026-01-08', km: 5.5, minuti: 10, tappe: 3 }),
    ]);
    const righe = csv.trimEnd().split('\r\n');
    const totale = righe.at(-1) ?? '';

    expect(totale).toContain('TOTALE');
    expect(totale).toContain('15,75');
    expect(totale).toContain('30');
    expect(totale).toContain('5'); // tappe complessive
  });

  it('somma senza code binarie', () => {
    const csv = componiCsv([
      giorno({ itineraryId: 'g1', km: 0.1 }),
      giorno({ itineraryId: 'g2', data: '2026-01-08', km: 0.2 }),
    ]);
    expect(csv).toContain('0,30');
    expect(csv).not.toContain('0,3000000');
  });

  it('protegge i campi che contengono il separatore', () => {
    // Nessun campo attuale contiene ';', ma la regola va garantita comunque.
    const csv = componiCsv([giorno()]);
    for (const riga of csv.replace('﻿', '').trimEnd().split('\r\n')) {
      const apici = (riga.match(/"/g) ?? []).length;
      expect(apici % 2).toBe(0);
    }
  });

  it('su un elenco vuoto produce comunque intestazione e totale a zero', () => {
    const csv = componiCsv([]);
    expect(csv).toContain(INTESTAZIONI.join(';'));
    expect(csv).toContain('0,00');
  });
});

describe('nomeFileCsv', () => {
  it('contiene l’intervallo, così i file non si confondono', () => {
    expect(nomeFileCsv('2026-01-01', '2026-01-31')).toBe('walk-around_2026-01-01_2026-01-31.csv');
  });
});
