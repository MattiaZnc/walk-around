import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MappaGiornata } from '@/features/itinerary/components/mappa-giornata';
import { renderConProvider } from '@/test/test-utils';
import type { Stop } from '@/types/models';

const ADESSO = '2026-05-04T08:00:00Z';

function tappa(id: string, coordinate: { lat: number; lng: number } | null): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position: 1,
    label: id,
    address: null,
    lat: coordinate?.lat ?? null,
    lng: coordinate?.lng ?? null,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
    created_at: ADESSO,
    updated_at: ADESSO,
  };
}

/**
 * Leaflet richiede un DOM con dimensioni reali, che jsdom non fornisce: qui si
 * verifica il solo ramo che non monta la mappa, cioè quando non c'è nulla da
 * mostrare. Il resto va provato nel browser.
 */
describe('MappaGiornata', () => {
  it('senza coordinate spiega come ottenerle invece di mostrare una mappa vuota', () => {
    renderConProvider(<MappaGiornata tappe={[tappa('a', null), tappa('b', null)]} tratte={[]} />);

    expect(screen.getByText('Nessuna tappa sulla mappa')).toBeInTheDocument();
    expect(screen.getByText(/Cerca il nome del luogo/)).toBeInTheDocument();
  });

  // Il caso con la posizione corrente sta in mappa-contesto.test.tsx: Leaflet
  // vero non disegna cerchi in jsdom, quindi là react-leaflet è sostituito da un
  // finto che verifica il vincolo del contenitore.
  it('senza posizione il riepilogo non parla di precisione', () => {
    renderConProvider(
      <MappaGiornata tappe={[tappa('a', { lat: 41.89, lng: 12.49 })]} tratte={[]} />,
    );

    expect(screen.queryByText(/precisione di circa/)).not.toBeInTheDocument();
  });

  it('segnala nel riepilogo le tappe raggiunte', () => {
    renderConProvider(
      <MappaGiornata
        tappe={[
          tappa('a', { lat: 41.89, lng: 12.49 }),
          { ...tappa('b', { lat: 41.9, lng: 12.5 }), reached_at: '2026-09-28T10:00:00Z' },
        ]}
        tratte={[]}
      />,
    );

    expect(screen.getByText(/Tappa 2: b \(raggiunta\)/)).toBeInTheDocument();
  });

  it('non mostra lo stato vuoto se almeno una tappa è geolocalizzata', () => {
    renderConProvider(
      <MappaGiornata tappe={[tappa('a', { lat: 41.89, lng: 12.49 })]} tratte={[]} />,
    );

    expect(screen.queryByText('Nessuna tappa sulla mappa')).not.toBeInTheDocument();
  });
});
