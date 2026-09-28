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

  it('non mostra lo stato vuoto se almeno una tappa è geolocalizzata', () => {
    renderConProvider(
      <MappaGiornata tappe={[tappa('a', { lat: 41.89, lng: 12.49 })]} tratte={[]} />,
    );

    expect(screen.queryByText('Nessuna tappa sulla mappa')).not.toBeInTheDocument();
  });
});
