import { describe, expect, it } from 'vitest';

import {
  idOttenuti,
  nuoviTraguardi,
  prossimoTraguardo,
  statoTraguardi,
  TRAGUARDI,
} from '@/features/traguardi/lib/traguardi';

const NIENTE = { tappe: 0, km: 0, giornate: 0 };

describe('statoTraguardi', () => {
  it('senza progressi nessun traguardo è ottenuto', () => {
    expect(statoTraguardi(NIENTE).every((stato) => !stato.ottenuto)).toBe(true);
  });

  it('la soglia esatta basta per ottenere il traguardo', () => {
    const stati = statoTraguardi({ tappe: 10, km: 0, giornate: 1 });
    expect(stati.find((s) => s.id === 'tappe-10')?.ottenuto).toBe(true);
    expect(stati.find((s) => s.id === 'tappe-25')?.ottenuto).toBe(false);
  });

  it('calcola percentuale e quanto manca', () => {
    const stato = statoTraguardi({ tappe: 0, km: 30, giornate: 3 }).find((s) => s.id === 'km-42');
    expect(stato?.percentuale).toBe(71);
    expect(stato?.mancante).toBe(12);
  });

  it('la percentuale non arriva a 100 finché la soglia non è raggiunta', () => {
    // 99,9 su 100: arrotondare per eccesso mostrerebbe 100% su un traguardo
    // ancora bloccato.
    const stato = statoTraguardi({ tappe: 0, km: 99.9, giornate: 1 }).find(
      (s) => s.id === 'km-100',
    );
    expect(stato?.ottenuto).toBe(false);
    expect(stato?.percentuale).toBe(99);
  });

  it('i km mancanti non hanno code di aritmetica binaria', () => {
    const stato = statoTraguardi({ tappe: 0, km: 9.7, giornate: 1 }).find((s) => s.id === 'km-10');
    expect(stato?.mancante).toBe(0.3);
  });

  it('un traguardo ottenuto non ha nulla di mancante', () => {
    const stato = statoTraguardi({ tappe: 0, km: 150, giornate: 5 }).find((s) => s.id === 'km-100');
    expect(stato?.percentuale).toBe(100);
    expect(stato?.mancante).toBe(0);
  });
});

describe('prossimoTraguardo', () => {
  it('è il primo non ottenuto della categoria', () => {
    expect(prossimoTraguardo({ tappe: 7, km: 0, giornate: 1 }, 'tappe')?.id).toBe('tappe-10');
    expect(prossimoTraguardo({ tappe: 0, km: 0, giornate: 0 }, 'km')?.id).toBe('km-1');
  });

  it('è null quando la categoria è completa', () => {
    expect(prossimoTraguardo({ tappe: 1000, km: 0, giornate: 1 }, 'tappe')).toBeNull();
  });
});

describe('nuoviTraguardi', () => {
  it('al primo controllo non annuncia nulla', () => {
    // Altrimenti al primo accesso partirebbe una raffica di avvisi per
    // traguardi raggiunti settimane prima.
    expect(nuoviTraguardi(null, ['tappe-1', 'km-1'])).toEqual([]);
  });

  it('annuncia solo quelli che prima non c’erano', () => {
    expect(nuoviTraguardi(['tappe-1'], ['tappe-1', 'tappe-5'])).toEqual(['tappe-5']);
  });

  it('non annuncia nulla se non cambia niente', () => {
    expect(nuoviTraguardi(['tappe-1'], ['tappe-1'])).toEqual([]);
  });
});

describe('definizioni', () => {
  it('le soglie di ogni categoria sono in ordine crescente', () => {
    for (const categoria of ['tappe', 'km'] as const) {
      const soglie = TRAGUARDI.filter((t) => t.categoria === categoria).map((t) => t.soglia);
      expect([...soglie].sort((a, b) => a - b)).toEqual(soglie);
    }
  });

  it('gli identificativi sono unici', () => {
    const ids = TRAGUARDI.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('idOttenuti restituisce gli identificativi sbloccati', () => {
    expect(idOttenuti({ tappe: 5, km: 1, giornate: 1 })).toEqual(['tappe-1', 'tappe-5', 'km-1']);
  });
});
