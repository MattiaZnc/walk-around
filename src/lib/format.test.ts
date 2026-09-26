import { describe, expect, it } from 'vitest';

import { dataBreve, dataLunga, durata, isoDaData, km, numero, oraBreve } from '@/lib/format';

describe('formattazione numeri it-IT', () => {
  it('usa la virgola decimale e una cifra per i km', () => {
    expect(km(12.35)).toBe('12,4 km');
    expect(km(0)).toBe('0,0 km');
  });

  it('applica il raggruppamento italiano (min2: niente punto sotto le 5 cifre)', () => {
    expect(km(1234.5)).toBe('1234,5 km');
    expect(km(12345.6)).toBe('12.345,6 km');
  });

  it('formatta i numeri generici con al massimo due decimali', () => {
    expect(numero(1234.567)).toBe('1234,57');
    expect(numero(12345.678)).toBe('12.345,68');
  });
});

describe('durata', () => {
  it('mostra i minuti sotto l’ora', () => {
    expect(durata(45)).toBe('45 min');
    expect(durata(0)).toBe('0 min');
  });

  it('mostra ore e minuti oltre l’ora', () => {
    expect(durata(125)).toBe('2 h 5 min');
    expect(durata(120)).toBe('2 h');
  });

  it('gestisce il valore assente', () => {
    expect(durata(null)).toBe('—');
  });
});

describe('date in italiano', () => {
  it('formatta la data lunga', () => {
    expect(dataLunga('2025-01-06')).toBe('lunedì 6 gennaio 2025');
  });

  it('formatta la data breve', () => {
    expect(dataBreve('2025-01-06')).toBe('lun 6 gen');
  });

  it('non sposta il giorno per effetto del fuso orario', () => {
    // parseISO('2025-03-30') è mezzanotte locale: il round-trip deve tornare uguale.
    expect(isoDaData(new Date(2025, 2, 30))).toBe('2025-03-30');
    expect(dataLunga('2025-03-30')).toBe('domenica 30 marzo 2025');
  });
});

describe('oraBreve', () => {
  it('taglia i secondi', () => {
    expect(oraBreve('09:30:00')).toBe('09:30');
  });

  it('restituisce stringa vuota se l’ora manca', () => {
    expect(oraBreve(null)).toBe('');
  });
});
