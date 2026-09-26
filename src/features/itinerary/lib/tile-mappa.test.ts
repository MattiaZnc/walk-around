import { describe, expect, it, vi } from 'vitest';

import {
  ATTRIBUZIONE_OSM,
  configurazioneTile,
  TILE_OSM,
} from '@/features/itinerary/lib/tile-mappa';

describe('configurazioneTile', () => {
  it('usa OpenStreetMap, che non richiede chiavi', () => {
    const chiaro = configurazioneTile(false);

    expect(chiaro.url).toBe(TILE_OSM);
    expect(chiaro.url).not.toContain('cartocdn');
    expect(chiaro.attribuzione).toContain('OpenStreetMap');
  });

  it('non richiede parametri di autenticazione nell’URL', () => {
    const url = configurazioneTile(false).url;
    expect(url).not.toMatch(/api[_-]?key|apikey|access[_-]?token/i);
  });

  it('sul tema scuro chiede il filtro delle mattonelle', () => {
    expect(configurazioneTile(true).filtraPerTemaScuro).toBe(true);
    expect(configurazioneTile(false).filtraPerTemaScuro).toBe(false);
  });

  it('cita OpenStreetMap come richiesto dalla licenza', () => {
    expect(ATTRIBUZIONE_OSM).toContain('openstreetmap.org/copyright');
  });
});

describe('configurazioneTile con sorgente personalizzata', () => {
  it('usa l’URL configurato e non filtra i colori', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MAP_TILE_URL', 'https://tiles.esempio.it/{z}/{x}/{y}.png');
    vi.stubEnv('VITE_MAP_TILE_ATTRIBUTION', '&copy; Esempio');

    const modulo = await import('@/features/itinerary/lib/tile-mappa');
    const scuro = modulo.configurazioneTile(true);

    expect(scuro.url).toBe('https://tiles.esempio.it/{z}/{x}/{y}.png');
    expect(scuro.attribuzione).toBe('&copy; Esempio');
    // Un servizio scelto da chi installa potrebbe avere già la variante scura.
    expect(scuro.filtraPerTemaScuro).toBe(false);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
