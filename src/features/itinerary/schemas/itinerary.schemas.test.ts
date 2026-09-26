import { describe, expect, it } from 'vitest';

import { tappaSchema, trattaSchema } from '@/features/itinerary/schemas/itinerary.schemas';

const tappaValida = {
  label: 'Cliente Rossi',
  address: '',
  lat: '',
  lng: '',
  plannedTime: '',
  notes: '',
};

describe('tappaSchema', () => {
  it('accetta una tappa con solo il nome e normalizza i campi vuoti a null', () => {
    const esito = tappaSchema.safeParse(tappaValida);
    expect(esito.success).toBe(true);
    if (!esito.success) return;
    expect(esito.data.address).toBeNull();
    expect(esito.data.lat).toBeNull();
    expect(esito.data.plannedTime).toBeNull();
    expect(esito.data.notes).toBeNull();
  });

  it('richiede un nome non vuoto', () => {
    const esito = tappaSchema.safeParse({ ...tappaValida, label: '   ' });
    expect(esito.success).toBe(false);
  });

  it('accetta le coordinate con la virgola decimale', () => {
    const esito = tappaSchema.safeParse({ ...tappaValida, lat: '45,4642', lng: '9,1896' });
    expect(esito.success).toBe(true);
    if (!esito.success) return;
    expect(esito.data.lat).toBeCloseTo(45.4642, 4);
    expect(esito.data.lng).toBeCloseTo(9.1896, 4);
  });

  it('accetta anche il punto decimale', () => {
    const esito = tappaSchema.safeParse({ ...tappaValida, lat: '45.4642', lng: '9.1896' });
    expect(esito.success).toBe(true);
  });

  it('rifiuta mezza coordinata', () => {
    const esito = tappaSchema.safeParse({ ...tappaValida, lat: '45,4642' });
    expect(esito.success).toBe(false);
    const messaggi = esito.success ? [] : esito.error.issues.map((problema) => problema.message);
    expect(messaggi.join(' ')).toContain('entrambe le coordinate');
  });

  it('rifiuta coordinate fuori intervallo', () => {
    expect(tappaSchema.safeParse({ ...tappaValida, lat: '95', lng: '9' }).success).toBe(false);
    expect(tappaSchema.safeParse({ ...tappaValida, lat: '45', lng: '200' }).success).toBe(false);
  });

  it('rifiuta un orario in formato sbagliato', () => {
    expect(tappaSchema.safeParse({ ...tappaValida, plannedTime: '25:00' }).success).toBe(false);
    expect(tappaSchema.safeParse({ ...tappaValida, plannedTime: '9.30' }).success).toBe(false);
    expect(tappaSchema.safeParse({ ...tappaValida, plannedTime: '09:30' }).success).toBe(true);
  });

  it('taglia gli spazi da nome e indirizzo', () => {
    const esito = tappaSchema.safeParse({
      ...tappaValida,
      label: '  Deposito  ',
      address: '  Via Roma 1  ',
    });
    expect(esito.success).toBe(true);
    if (!esito.success) return;
    expect(esito.data.label).toBe('Deposito');
    expect(esito.data.address).toBe('Via Roma 1');
  });
});

describe('trattaSchema', () => {
  it('accetta i chilometri con la virgola', () => {
    const esito = trattaSchema.safeParse({ distanceKm: '12,5', durationMin: '' });
    expect(esito.success).toBe(true);
    if (!esito.success) return;
    expect(esito.data.distanceKm).toBe(12.5);
    expect(esito.data.durationMin).toBeNull();
  });

  it('accetta zero chilometri', () => {
    expect(trattaSchema.safeParse({ distanceKm: '0', durationMin: '' }).success).toBe(true);
  });

  it('rifiuta chilometri negativi o non numerici', () => {
    expect(trattaSchema.safeParse({ distanceKm: '-3', durationMin: '' }).success).toBe(false);
    expect(trattaSchema.safeParse({ distanceKm: 'abc', durationMin: '' }).success).toBe(false);
    expect(trattaSchema.safeParse({ distanceKm: '', durationMin: '' }).success).toBe(false);
  });

  it('accetta i minuti interi e rifiuta i decimali', () => {
    expect(trattaSchema.safeParse({ distanceKm: '10', durationMin: '25' }).success).toBe(true);
    expect(trattaSchema.safeParse({ distanceKm: '10', durationMin: '25,5' }).success).toBe(false);
  });

  it('rifiuta minuti negativi', () => {
    expect(trattaSchema.safeParse({ distanceKm: '10', durationMin: '-5' }).success).toBe(false);
  });
});
