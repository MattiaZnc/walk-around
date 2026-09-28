import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ModuloTotali from '@/features/itinerary/api/totali.api';
import type { TotaliGiorno } from '@/features/itinerary/api/totali.api';
import DashboardPage from '@/pages/dashboard-page';
import { isoDaData, meseAnno } from '@/lib/format';
import { renderConProvider } from '@/test/test-utils';

const caricaTotali = vi.fn<(da: string, a: string) => Promise<TotaliGiorno[]>>();

vi.mock('@/features/itinerary/api/totali.api', async () => {
  const reale = await vi.importActual<typeof ModuloTotali>('@/features/itinerary/api/totali.api');
  return { ...reale, caricaTotali: (da: string, a: string) => caricaTotali(da, a) };
});

/** Data di oggi: i riepiloghi dipendono dal giorno corrente. */
const OGGI = isoDaData(new Date());

function giorno(extra: Partial<TotaliGiorno> = {}): TotaliGiorno {
  return {
    itineraryId: 'g1',
    data: OGGI,
    km: 18.4,
    minuti: 40,
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

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    caricaTotali.mockResolvedValue([giorno()]);
  });

  it('elenca le giornate del mese con i chilometri', async () => {
    renderConProvider(<DashboardPage />);

    const elenco = await screen.findByRole('list');
    expect(within(elenco).getByText('18,4 km')).toBeInTheDocument();
    expect(within(elenco).getByText('oggi')).toBeInTheDocument();
    expect(within(elenco).getByText('in auto')).toBeInTheDocument();
  });

  it('mostra il totale del mese e quello della settimana corrente', async () => {
    renderConProvider(<DashboardPage />);

    // I riquadri esistono già a zero mentre la richiesta è in volo: si attende
    // che il valore arrivi, non che l'elemento compaia.
    const mese = screen.getByRole('region', { name: `Totale ${meseAnno(new Date())}` });
    const settimana = screen.getByRole('region', { name: 'Questa settimana' });

    // La giornata di prova è oggi, quindi rientra in entrambi i periodi.
    await waitFor(() => {
      expect(within(mese).getByText('18,4 km')).toBeInTheDocument();
      expect(within(settimana).getByText('18,4 km')).toBeInTheDocument();
    });
  });

  it('carica il mese richiesto quando si cambia mese', async () => {
    const utente = userEvent.setup();
    renderConProvider(<DashboardPage />);
    await screen.findByRole('list');

    const primaChiamata = caricaTotali.mock.calls[0];
    await utente.click(screen.getByRole('button', { name: /Mese precedente/ }));

    await waitFor(() => {
      expect(caricaTotali.mock.calls.length).toBeGreaterThan(1);
    });
    const secondaChiamata = caricaTotali.mock.calls.at(-1);
    expect(secondaChiamata?.[0]).not.toBe(primaChiamata?.[0]);
    // Cambiando mese compare la scorciatoia per tornare indietro.
    expect(screen.getByRole('button', { name: 'Torna al mese corrente' })).toBeInTheDocument();
  });

  it('segnala le giornate con tratte senza chilometri', async () => {
    caricaTotali.mockResolvedValue([giorno({ tappe: 4, tratte: 1 })]);
    renderConProvider(<DashboardPage />);

    expect(await screen.findByText('tratte senza km')).toBeInTheDocument();
    const mese = screen.getByRole('region', { name: `Totale ${meseAnno(new Date())}` });
    expect(within(mese).getByText('1 giornata incompleta')).toBeInTheDocument();
  });

  it('su un mese vuoto invita a cominciare', async () => {
    caricaTotali.mockResolvedValue([]);
    renderConProvider(<DashboardPage />);

    expect(await screen.findByText(/Nessuna giornata in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comincia da oggi' })).toHaveAttribute(
      'href',
      `/day/${OGGI}`,
    );
  });

  it('ogni giornata porta al suo dettaglio', async () => {
    renderConProvider(<DashboardPage />);
    const elenco = await screen.findByRole('list');
    const collegamento = within(elenco).getAllByRole('link')[0];
    expect(collegamento).toHaveAttribute('href', `/day/${OGGI}`);
  });

  it('mostra un errore riprovabile se il caricamento fallisce', async () => {
    caricaTotali.mockRejectedValue(new Error('Rete non disponibile'));
    renderConProvider(<DashboardPage />);

    expect(await screen.findByText('Impossibile caricare le giornate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
  });
});
