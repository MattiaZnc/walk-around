import { describe, expect, it } from 'vitest';

import { giaSalvata } from '@/features/partenze/lib/partenze';
import type { PartenzaSalvata } from '@/types/models';

function salvata(extra: Partial<PartenzaSalvata>): PartenzaSalvata {
  return {
    id: 'p1',
    user_id: 'u1',
    label: 'Casa',
    address: 'Via Nazionale 5, Roma',
    lat: 41.9009,
    lng: 12.4946,
    created_at: '2026-10-02T09:00:00Z',
    ...extra,
  };
}

describe('giaSalvata', () => {
  it('riconosce lo stesso punto anche con un nome diverso', () => {
    expect(
      giaSalvata([salvata({})], { label: 'Hotel', address: null, lat: 41.90095, lng: 12.49465 }),
    ).toBe(true);
  });

  it('distingue punti a più di qualche decina di metri', () => {
    expect(
      giaSalvata([salvata({})], { label: 'Casa', address: null, lat: 41.905, lng: 12.4946 }),
    ).toBe(false);
  });

  it('senza coordinate confronta il nome, senza badare a maiuscole e spazi', () => {
    const senza = salvata({ lat: null, lng: null, label: 'Ufficio' });
    expect(giaSalvata([senza], { label: ' ufficio ', address: null, lat: null, lng: null })).toBe(
      true,
    );
    expect(giaSalvata([senza], { label: 'Palestra', address: null, lat: null, lng: null })).toBe(
      false,
    );
  });

  it('con un elenco vuoto non è mai salvata', () => {
    expect(giaSalvata([], { label: 'Casa', address: null, lat: 1, lng: 1 })).toBe(false);
  });
});
