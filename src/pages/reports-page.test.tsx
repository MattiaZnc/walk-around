import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ModuloTotali from '@/features/itinerary/api/totali.api';
import type { TotaliGiorno } from '@/features/itinerary/api/totali.api';
import ReportsPage from '@/pages/reports-page';
import { renderConProvider } from '@/test/test-utils';

const caricaTotali = vi.fn<(da: string, a: string) => Promise<TotaliGiorno[]>>();

vi.mock('@/features/itinerary/api/totali.api', async () => {
  const reale = await vi.importActual<typeof ModuloTotali>('@/features/itinerary/api/totali.api');
  return { ...reale, caricaTotali: (da: string, a: string) => caricaTotali(da, a) };
});

// Il salvataggio del file non esiste in jsdom: si verifica che venga avviato.
const creaOggetto = vi.fn(() => 'blob:finto');
const revoca = vi.fn();

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

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    caricaTotali.mockResolvedValue([
      giorno(),
      giorno({ itineraryId: 'g2', data: '2026-01-09', km: 7.5, minuti: 15, modalita: 'piedi' }),
    ]);
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: creaOggetto });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revoca });
  });

  it('mostra la tabella per giorno e il totale del periodo', async () => {
    renderConProvider(<ReportsPage />);

    const tabella = await screen.findByRole('table');
    expect(within(tabella).getByText('a piedi')).toBeInTheDocument();
    expect(within(tabella).getByText('in auto')).toBeInTheDocument();

    // Totale in fondo alla tabella: 12,5 + 7,5.
    const piede = tabella.querySelector('tfoot');
    expect(piede?.textContent).toContain('20,0 km');
  });

  it('parte dal mese corrente e cambia intervallo con i pulsanti', async () => {
    const utente = userEvent.setup();
    renderConProvider(<ReportsPage />);
    await screen.findByRole('table');

    const primaChiamata = caricaTotali.mock.calls[0];
    expect(primaChiamata?.[0]).toMatch(/^\d{4}-\d{2}-01$/);

    await utente.click(screen.getByRole('button', { name: 'Mese scorso' }));

    await waitFor(() => {
      expect(caricaTotali.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('rifiuta un intervallo con le date invertite', async () => {
    const utente = userEvent.setup();
    renderConProvider(<ReportsPage />);
    await screen.findByRole('table');

    const dal = screen.getByLabelText('Dal');
    await utente.clear(dal);
    await utente.type(dal, '2026-03-31');
    const al = screen.getByLabelText('Al');
    await utente.clear(al);
    await utente.type(al, '2026-03-01');

    expect(
      await screen.findByText('La data iniziale deve precedere quella finale.'),
    ).toBeInTheDocument();
  });

  it('esporta il CSV con il nome del periodo', async () => {
    const utente = userEvent.setup();
    renderConProvider(<ReportsPage />);
    await screen.findByRole('table');

    await utente.click(screen.getByRole('button', { name: 'Esporta CSV' }));

    await waitFor(() => {
      expect(creaOggetto).toHaveBeenCalled();
    });
    // L'oggetto URL viene liberato: altrimenti il contenuto resta in memoria.
    expect(revoca).toHaveBeenCalled();
  });

  it('senza giornate non si può esportare nulla', async () => {
    caricaTotali.mockResolvedValue([]);
    renderConProvider(<ReportsPage />);

    expect(await screen.findByText('Nessuna giornata nel periodo scelto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esporta CSV' })).toBeDisabled();
  });

  it('mostra un errore riprovabile se il caricamento fallisce', async () => {
    caricaTotali.mockRejectedValue(new Error('Connessione non disponibile'));
    renderConProvider(<ReportsPage />);

    expect(await screen.findByText('Impossibile caricare il report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
  });
});
