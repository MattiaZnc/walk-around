import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ModuloPercorsi from '@/features/itinerary/api/percorsi.api';
import type { Luogo } from '@/features/itinerary/api/percorsi.api';
import { SceltaPartenza } from '@/features/itinerary/components/scelta-partenza';
import { renderConProvider } from '@/test/test-utils';

const cercaLuoghi = vi.fn<(testo: string, vicinoA?: unknown) => Promise<Luogo[]>>();

vi.mock('@/features/itinerary/api/percorsi.api', async () => {
  const reale = await vi.importActual<typeof ModuloPercorsi>(
    '@/features/itinerary/api/percorsi.api',
  );
  return { ...reale, cercaLuoghi: (t: string, v?: unknown) => cercaLuoghi(t, v) };
});

const COLOSSEO: Luogo = {
  nome: 'Colosseo',
  indirizzo: 'Piazza del Colosseo, Roma',
  etichetta: 'Colosseo, Piazza del Colosseo, Roma',
  lat: 41.8902572,
  lng: 12.4923841,
};

const PROFILO = { indirizzo: 'Via Torino 5, Milano', lat: 45.46, lng: 9.18 };

describe('SceltaPartenza', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cercaLuoghi.mockResolvedValue([COLOSSEO]);
  });

  it('propone l’indirizzo del profilo come scorciatoia', async () => {
    const utente = userEvent.setup();
    const onConferma = vi.fn();
    renderConProvider(
      <SceltaPartenza
        data="2026-09-28"
        profilo={PROFILO}
        inCorso={false}
        onConferma={onConferma}
      />,
    );

    expect(screen.getByText('Da dove parti?')).toBeInTheDocument();
    await utente.click(screen.getByRole('button', { name: /Parti da Via Torino 5, Milano/ }));

    expect(onConferma).toHaveBeenCalledWith({
      label: 'Partenza',
      address: 'Via Torino 5, Milano',
      lat: 45.46,
      lng: 9.18,
    });
  });

  it('senza indirizzo nel profilo non mostra la scorciatoia', () => {
    renderConProvider(
      <SceltaPartenza data="2026-09-28" profilo={null} inCorso={false} onConferma={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /^Parti da/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cerca il luogo')).toBeInTheDocument();
  });

  it('cercando un luogo lo propone con le coordinate e un nome modificabile', async () => {
    const utente = userEvent.setup();
    const onConferma = vi.fn();
    renderConProvider(
      <SceltaPartenza data="2026-09-28" profilo={null} inCorso={false} onConferma={onConferma} />,
    );

    await utente.type(screen.getByLabelText('Cerca il luogo'), 'colosseo');
    await utente.click(await screen.findByText('Colosseo'));

    // Il nome proposto è quello del luogo, ma si può cambiare.
    const campoNome = screen.getByLabelText('Come vuoi chiamare questa tappa?');
    expect(campoNome).toHaveValue('Colosseo');
    await utente.clear(campoNome);
    await utente.type(campoNome, 'Hotel');

    await utente.click(screen.getByRole('button', { name: 'Parti da qui' }));

    expect(onConferma).toHaveBeenCalledWith({
      label: 'Hotel',
      address: 'Piazza del Colosseo, Roma',
      lat: 41.8902572,
      lng: 12.4923841,
    });
  });

  it('permette una partenza senza coordinate, avvisando delle conseguenze', async () => {
    const utente = userEvent.setup();
    const onConferma = vi.fn();
    renderConProvider(
      <SceltaPartenza data="2026-09-28" profilo={null} inCorso={false} onConferma={onConferma} />,
    );

    await utente.click(screen.getByText(/Non trovo il posto/));
    await utente.type(screen.getByLabelText('Nome del punto di partenza'), 'Casa di Anna');
    await utente.click(screen.getByRole('button', { name: /Usa questo nome, senza coordinate/ }));

    expect(onConferma).toHaveBeenCalledWith({
      label: 'Casa di Anna',
      address: null,
      lat: null,
      lng: null,
    });
    expect(screen.getByText(/i chilometri delle tratte vanno inseriti a mano/)).toBeInTheDocument();
  });

  it('non conferma con il nome vuoto', async () => {
    const utente = userEvent.setup();
    const onConferma = vi.fn();
    renderConProvider(
      <SceltaPartenza data="2026-09-28" profilo={null} inCorso={false} onConferma={onConferma} />,
    );

    await utente.click(screen.getByText(/Non trovo il posto/));
    expect(
      screen.getByRole('button', { name: /Usa questo nome, senza coordinate/ }),
    ).toBeDisabled();

    await waitFor(() => {
      expect(onConferma).not.toHaveBeenCalled();
    });
  });
});
