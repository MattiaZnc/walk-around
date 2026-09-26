import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TrattaInline } from '@/features/itinerary/components/tratta-inline';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import { renderConProvider } from '@/test/test-utils';
import type { Leg, Stop } from '@/types/models';

const ADESSO = '2026-05-04T08:00:00Z';

function tappa(id: string, label: string, position: number): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position,
    label,
    address: null,
    lat: null,
    lng: null,
    planned_time: null,
    notes: null,
    created_at: ADESSO,
    updated_at: ADESSO,
  };
}

function leg(extra: Partial<Leg> = {}): Leg {
  return {
    id: 'l1',
    itinerary_id: 'g1',
    user_id: 'u1',
    from_stop_id: 's1',
    to_stop_id: 's2',
    distance_km: 12.5,
    duration_min: 25,
    source: 'auto',
    is_estimate: false,
    route_geometry: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

function tratta(extra: Partial<Tratta> = {}): Tratta {
  return {
    chiave: 's1->s2',
    fromStop: tappa('s1', 'Deposito', 1),
    toStop: tappa('s2', 'Cliente', 2),
    leg: leg(),
    rientro: false,
    ...extra,
  };
}

describe('TrattaInline', () => {
  it('mostra chilometri e durata in formato italiano', () => {
    renderConProvider(
      <TrattaInline tratta={tratta()} inCorso={false} onSalva={vi.fn()} onAzzera={vi.fn()} />,
    );

    expect(screen.getByText('12,5 km')).toBeInTheDocument();
    expect(screen.getByText('25 min')).toBeInTheDocument();
  });

  it('segnala una tratta ancora da compilare e invita a inserirla', () => {
    renderConProvider(
      <TrattaInline
        tratta={tratta({ leg: null })}
        inCorso={false}
        onSalva={vi.fn()}
        onAzzera={vi.fn()}
      />,
    );

    expect(screen.getByText('Chilometri da inserire')).toBeInTheDocument();
    // Senza valori non c'è nulla da azzerare.
    expect(screen.queryByRole('button', { name: /Azzera/ })).not.toBeInTheDocument();
  });

  it('mostra il badge "manuale" sulle tratte corrette a mano', () => {
    renderConProvider(
      <TrattaInline
        tratta={tratta({ leg: leg({ source: 'manual' }) })}
        inCorso={false}
        onSalva={vi.fn()}
        onAzzera={vi.fn()}
      />,
    );
    expect(screen.getByText('manuale')).toBeInTheDocument();
  });

  it('mostra il badge "stimata" quando la distanza non è un percorso reale', () => {
    renderConProvider(
      <TrattaInline
        tratta={tratta({ leg: leg({ is_estimate: true }) })}
        inCorso={false}
        onSalva={vi.fn()}
        onAzzera={vi.fn()}
      />,
    );
    expect(screen.getByText('stimata')).toBeInTheDocument();
  });

  it('salva i chilometri scritti con la virgola', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(
      <TrattaInline
        tratta={tratta({ leg: null })}
        inCorso={false}
        onSalva={onSalva}
        onAzzera={vi.fn()}
      />,
    );

    await utente.click(screen.getByRole('button', { name: /Modifica i chilometri/ }));
    await utente.clear(screen.getByLabelText('Chilometri'));
    await utente.type(screen.getByLabelText('Chilometri'), '18,4');
    await utente.type(screen.getByLabelText('Minuti (facoltativo)'), '32');
    await utente.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => {
      expect(onSalva).toHaveBeenCalledWith({ distanceKm: 18.4, durationMin: 32 });
    });
  });

  it('rifiuta un valore non numerico senza chiamare il salvataggio', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(
      <TrattaInline
        tratta={tratta({ leg: null })}
        inCorso={false}
        onSalva={onSalva}
        onAzzera={vi.fn()}
      />,
    );

    await utente.click(screen.getByRole('button', { name: /Modifica i chilometri/ }));
    await utente.clear(screen.getByLabelText('Chilometri'));
    await utente.type(screen.getByLabelText('Chilometri'), 'tanti');
    await utente.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByText('Inserisci un numero (es. 12,5)')).toBeInTheDocument();
    expect(onSalva).not.toHaveBeenCalled();
  });

  it('annullando la modifica non salva nulla', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(
      <TrattaInline tratta={tratta()} inCorso={false} onSalva={onSalva} onAzzera={vi.fn()} />,
    );

    await utente.click(screen.getByRole('button', { name: /Modifica i chilometri/ }));
    await utente.clear(screen.getByLabelText('Chilometri'));
    await utente.type(screen.getByLabelText('Chilometri'), '99');
    await utente.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(onSalva).not.toHaveBeenCalled();
    expect(screen.getByText('12,5 km')).toBeInTheDocument();
  });

  it('per il rientro indica l’indirizzo di partenza come destinazione', () => {
    renderConProvider(
      <TrattaInline
        tratta={tratta({ toStop: null, rientro: true, chiave: 's2->rientro' })}
        indirizzoRientro="Via Torino 5"
        inCorso={false}
        onSalva={vi.fn()}
        onAzzera={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: /Modifica i chilometri della tratta da Deposito a Via Torino 5/,
      }),
    ).toBeInTheDocument();
  });

  it('permette di azzerare una tratta valorizzata', async () => {
    const utente = userEvent.setup();
    const onAzzera = vi.fn();
    renderConProvider(
      <TrattaInline tratta={tratta()} inCorso={false} onSalva={vi.fn()} onAzzera={onAzzera} />,
    );

    await utente.click(screen.getByRole('button', { name: /Azzera la tratta/ }));
    expect(onAzzera).toHaveBeenCalledTimes(1);
  });
});
