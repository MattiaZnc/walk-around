import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ModuloPercorsi from '@/features/itinerary/api/percorsi.api';
import type { Luogo } from '@/features/itinerary/api/percorsi.api';
import { RicercaLuogo } from '@/features/itinerary/components/ricerca-luogo';
import { renderConProvider } from '@/test/test-utils';

const cercaLuoghi = vi.fn<(testo: string, vicinoA?: unknown) => Promise<Luogo[]>>();

vi.mock('@/features/itinerary/api/percorsi.api', async () => {
  const reale = await vi.importActual<typeof ModuloPercorsi>(
    '@/features/itinerary/api/percorsi.api',
  );
  return {
    ...reale,
    cercaLuoghi: (testo: string, vicinoA?: unknown) => cercaLuoghi(testo, vicinoA),
  };
});

const COLOSSEO: Luogo = {
  nome: 'Colosseo',
  indirizzo: 'Piazza del Colosseo, Roma',
  etichetta: 'Colosseo, Piazza del Colosseo, Roma',
  lat: 41.8902572,
  lng: 12.4923841,
};

const COLOSSEO_METRO: Luogo = {
  nome: 'Colosseo (metro)',
  indirizzo: 'Via dei Fori Imperiali, Roma',
  etichetta: 'Colosseo (metro), Via dei Fori Imperiali, Roma',
  lat: 41.8915659,
  lng: 12.4902082,
};

describe('RicercaLuogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cercaLuoghi.mockResolvedValue([COLOSSEO, COLOSSEO_METRO]);
  });

  it('non cerca con meno di tre caratteri', async () => {
    const utente = userEvent.setup();
    renderConProvider(<RicercaLuogo onScelta={vi.fn()} />);

    await utente.type(screen.getByLabelText('Cerca il luogo'), 'co');

    await waitFor(() => {
      expect(cercaLuoghi).not.toHaveBeenCalled();
    });
  });

  it('mostra i risultati e restituisce nome, indirizzo e coordinate', async () => {
    const utente = userEvent.setup();
    const onScelta = vi.fn();
    renderConProvider(<RicercaLuogo onScelta={onScelta} />);

    await utente.type(screen.getByLabelText('Cerca il luogo'), 'colosseo');

    expect(await screen.findByText('Colosseo')).toBeInTheDocument();
    expect(screen.getByText('Piazza del Colosseo, Roma')).toBeInTheDocument();

    await utente.click(screen.getByText('Colosseo'));

    expect(onScelta).toHaveBeenCalledWith(COLOSSEO);
  });

  it('si può scegliere un risultato con le frecce e Invio', async () => {
    const utente = userEvent.setup();
    const onScelta = vi.fn();
    renderConProvider(<RicercaLuogo onScelta={onScelta} />);

    const campo = screen.getByLabelText('Cerca il luogo');
    await utente.type(campo, 'colosseo');
    await screen.findByText('Colosseo');

    // Prima freccia: primo risultato; seconda: secondo.
    await utente.type(campo, '{ArrowDown}{ArrowDown}{Enter}');

    expect(onScelta).toHaveBeenCalledWith(COLOSSEO_METRO);
  });

  it('dice chiaramente quando non trova nulla', async () => {
    cercaLuoghi.mockResolvedValue([]);
    const utente = userEvent.setup();
    renderConProvider(<RicercaLuogo onScelta={vi.fn()} />);

    await utente.type(screen.getByLabelText('Cerca il luogo'), 'qwertyuiop');

    expect(await screen.findByText(/Nessun luogo trovato/)).toBeInTheDocument();
  });

  it('se la ricerca non è disponibile invita a inserire i dati a mano', async () => {
    cercaLuoghi.mockRejectedValue(new Error('Servizio non raggiungibile'));
    const utente = userEvent.setup();
    renderConProvider(<RicercaLuogo onScelta={vi.fn()} />);

    await utente.type(screen.getByLabelText('Cerca il luogo'), 'colosseo');

    expect(await screen.findByText(/a mano qui sotto/)).toBeInTheDocument();
  });

  it('passa il punto di riferimento per privilegiare i luoghi vicini', async () => {
    const utente = userEvent.setup();
    renderConProvider(<RicercaLuogo vicinoA={{ lat: 41.9, lng: 12.49 }} onScelta={vi.fn()} />);

    await utente.type(screen.getByLabelText('Cerca il luogo'), 'stazione');

    await waitFor(() => {
      expect(cercaLuoghi).toHaveBeenCalledWith('stazione', { lat: 41.9, lng: 12.49 });
    });
  });
});
