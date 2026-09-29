import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AvvisoNuoviTraguardi } from '@/features/traguardi/components/avviso-nuovi-traguardi';
import type { Progressi } from '@/features/traguardi/lib/traguardi';
import { renderConProvider } from '@/test/test-utils';

const successo = vi.fn<(...argomenti: unknown[]) => void>();
vi.mock('sonner', () => ({
  toast: {
    success: (...argomenti: unknown[]) => {
      successo(...argomenti);
    },
  },
}));

let progressi: Progressi | undefined;
vi.mock('@/features/traguardi/api/use-traguardi', () => ({
  useProgressi: () => ({ data: progressi }),
}));

const CHIAVE = 'walk-around-traguardi-visti';

describe('AvvisoNuoviTraguardi', () => {
  beforeEach(() => {
    successo.mockReset();
    localStorage.clear();
  });

  it('al primo avvio registra i traguardi senza annunciarli', async () => {
    progressi = { tappe: 12, km: 30, giornate: 4 };
    renderConProvider(<AvvisoNuoviTraguardi />);

    await waitFor(() => {
      expect(localStorage.getItem(CHIAVE)).not.toBeNull();
    });
    expect(successo).not.toHaveBeenCalled();
  });

  it('annuncia un traguardo appena sbloccato', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(['tappe-1']));
    progressi = { tappe: 5, km: 0, giornate: 1 };
    renderConProvider(<AvvisoNuoviTraguardi />);

    await waitFor(() => {
      expect(successo).toHaveBeenCalledWith(
        'Nuovo traguardo: In cammino',
        expect.objectContaining({ description: '5 tappe raggiunte' }),
      );
    });
  });

  it('non ripete l’avviso per un traguardo già visto', async () => {
    localStorage.setItem(CHIAVE, JSON.stringify(['tappe-1', 'tappe-5']));
    progressi = { tappe: 6, km: 0, giornate: 1 };
    renderConProvider(<AvvisoNuoviTraguardi />);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CHIAVE) ?? '[]')).toEqual(['tappe-1', 'tappe-5']);
    });
    expect(successo).not.toHaveBeenCalled();
  });

  it('un valore salvato illeggibile non rompe nulla', async () => {
    localStorage.setItem(CHIAVE, '{non è json');
    progressi = { tappe: 1, km: 0, giornate: 1 };
    renderConProvider(<AvvisoNuoviTraguardi />);

    // Trattato come primo avvio: niente avvisi, e lo stato viene riscritto.
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CHIAVE) ?? '[]')).toEqual(['tappe-1']);
    });
    expect(successo).not.toHaveBeenCalled();
  });
});
