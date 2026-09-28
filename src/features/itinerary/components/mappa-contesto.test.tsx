import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/components/layout/theme-provider';
import type { Stop } from '@/types/models';

/**
 * Verifica che ogni componente di react-leaflet stia dentro <MapContainer>.
 *
 * Nasce da un guasto reale: il blocco della posizione corrente era finito due
 * volte nel file e la seconda copia stava fuori dalla mappa, dentro il
 * riepilogo per screen reader. A schermo l'intera pagina veniva sostituita da
 * "Qualcosa è andato storto — useLeafletContext() can only be used in a
 * descendant of <MapContainer>".
 *
 * Leaflet vero non si può montare in jsdom (disegna su SVG e ha bisogno di
 * dimensioni reali), quindi qui react-leaflet è sostituito da un finto che
 * riproduce l'unica regola che conta per questo errore: i figli devono trovare
 * il contesto del contenitore.
 */

const ContestoMappa = React.createContext(false);

function richiedeContesto(nome: string) {
  return function Finto(props: { children?: React.ReactNode }) {
    const dentroLaMappa = React.useContext(ContestoMappa);
    if (!dentroLaMappa) {
      throw new Error(
        `useLeafletContext() can only be used in a descendant of <MapContainer> (${nome})`,
      );
    }
    return <div data-finto={nome}>{props.children}</div>;
  };
}

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <ContestoMappa.Provider value={true}>
      <div data-finto="MapContainer">{children}</div>
    </ContestoMappa.Provider>
  ),
  TileLayer: richiedeContesto('TileLayer'),
  Marker: richiedeContesto('Marker'),
  Popup: richiedeContesto('Popup'),
  Polyline: richiedeContesto('Polyline'),
  Circle: richiedeContesto('Circle'),
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opzioni: unknown) => opzioni,
    latLngBounds: (punti: unknown) => punti,
  },
}));

const { MappaGiornata } = await import('@/features/itinerary/components/mappa-giornata');

const ADESSO = '2026-09-28T09:00:00Z';

function tappa(id: string, lat: number, lng: number, extra: Partial<Stop> = {}): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position: 1,
    label: id,
    address: null,
    lat,
    lng,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

describe('MappaGiornata: componenti dentro il contenitore', () => {
  it('con la posizione corrente non esce dal contesto della mappa', () => {
    // Prima della correzione questo render lanciava, perché Circle e Marker
    // della posizione comparivano anche fuori da <MapContainer>.
    expect(() => {
      render(
        <ThemeProvider>
          <MappaGiornata
            tappe={[tappa('a', 41.89, 12.49)]}
            tratte={[]}
            posizione={{ lat: 41.8901, lng: 12.4925, accuratezza: 18 }}
          />
        </ThemeProvider>,
      );
    }).not.toThrow();

    expect(screen.getByText(/precisione di circa/)).toBeInTheDocument();
  });

  it('senza posizione resta valido', () => {
    expect(() => {
      render(
        <ThemeProvider>
          <MappaGiornata tappe={[tappa('a', 41.89, 12.49)]} tratte={[]} />
        </ThemeProvider>,
      );
    }).not.toThrow();

    expect(screen.queryByText(/precisione di circa/)).not.toBeInTheDocument();
  });

  it('il finto riconosce davvero un componente fuori posto', () => {
    // Controprova: senza questa, il test sopra passerebbe anche se il vincolo
    // non fosse verificato affatto.
    const FuoriPosto = richiedeContesto('Circle');
    expect(() => {
      render(<FuoriPosto />);
    }).toThrow(/useLeafletContext/);
  });
});
