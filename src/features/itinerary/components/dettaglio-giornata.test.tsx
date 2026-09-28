import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GiornataCompleta } from '@/features/itinerary/api/itinerary.api';
import type * as ModuloProfilo from '@/features/profile/api/use-profilo';
import { DettaglioGiornata } from '@/features/itinerary/components/dettaglio-giornata';
import { renderConProvider } from '@/test/test-utils';
import type { Itinerary, Leg, Profile, Stop } from '@/types/models';

const DATA = '2026-05-04';
const ADESSO = '2026-05-04T06:00:00Z';

// Si mocka il livello api (non supabase-js): il test copre hook, cache e
// componenti insieme, che è dove stanno gli aggiornamenti ottimistici.
const caricaGiornata = vi.fn<() => Promise<GiornataCompleta | null>>();
const salvaTrattaManuale = vi.fn<(...argomenti: unknown[]) => Promise<unknown>>();
const eliminaTappaApi = vi.fn<(...argomenti: unknown[]) => Promise<number>>();
const aggiungiTappa = vi.fn<(...argomenti: unknown[]) => Promise<unknown>>();
const assicuraGiornata = vi.fn<(...argomenti: unknown[]) => Promise<unknown>>();
const riordinaTappe = vi.fn<(...argomenti: unknown[]) => Promise<number>>();

vi.mock('@/features/itinerary/api/itinerary.api', () => ({
  caricaGiornata: () => caricaGiornata(),
  salvaTrattaManuale: (...argomenti: unknown[]) => salvaTrattaManuale(...argomenti),
  eliminaTappa: (...argomenti: unknown[]) => eliminaTappaApi(...argomenti),
  aggiungiTappa: (...argomenti: unknown[]) => aggiungiTappa(...argomenti),
  assicuraGiornata: (...argomenti: unknown[]) => assicuraGiornata(...argomenti),
  riordinaTappe: (...argomenti: unknown[]) => riordinaTappe(...argomenti),
  aggiornaTappa: vi.fn(),
  aggiornaGiornata: vi.fn(),
  eliminaGiornata: vi.fn(),
  eliminaTratta: vi.fn(),
  duplicaGiornata: vi.fn(),
}));

// Leaflet ha bisogno di un DOM con dimensioni reali (getBoundingClientRect,
// layout): in jsdom non funziona. Qui interessa il resto della pagina, quindi
// la mappa viene sostituita da un segnaposto; ha i suoi test a parte.
vi.mock('@/features/itinerary/components/mappa-giornata', () => ({
  MappaGiornata: ({ tappe }: { tappe: { id: string }[] }) => (
    <div data-testid="mappa">Mappa con {tappe.length} tappe</div>
  ),
}));

const profilo: Profile = {
  id: 'u1',
  full_name: 'Mario',
  default_start_address: 'Via Torino 5, Milano',
  default_start_lat: 45.46,
  default_start_lng: 9.18,
  created_at: ADESSO,
  updated_at: ADESSO,
};

vi.mock('@/features/profile/api/use-profilo', async () => {
  const reale = await vi.importActual<typeof ModuloProfilo>('@/features/profile/api/use-profilo');
  return {
    ...reale,
    useProfilo: () => ({ data: profilo, isSuccess: true, isPending: false, isError: false }),
  };
});

function tappa(id: string, label: string, position: number): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position,
    label,
    address: null,
    lat: 45.4,
    lng: 9.1,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
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
    distance_km: 10,
    duration_min: null,
    source: 'auto',
    is_estimate: false,
    route_geometry: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

const itinerary: Itinerary = {
  id: 'g1',
  user_id: 'u1',
  date: DATA,
  notes: null,
  returns_to_start: false,
  travel_mode: 'auto',
  created_at: ADESSO,
  updated_at: ADESSO,
};

function giornataConDueTappe(legs: Leg[] = [leg()]): GiornataCompleta {
  return { itinerary, stops: [tappa('s1', 'Deposito', 1), tappa('s2', 'Cliente', 2)], legs };
}

/** Il totale compare nel riepilogo; le stesse cifre stanno anche sulle tratte. */
function riepilogo(): HTMLElement {
  return screen.getByRole('region', { name: 'Totale della giornata' });
}

describe('DettaglioGiornata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('su una giornata vuota chiede prima da dove si parte', async () => {
    caricaGiornata.mockResolvedValue(null);
    renderConProvider(<DettaglioGiornata data={DATA} />);

    expect(await screen.findByText('Da dove parti?')).toBeInTheDocument();
    // Scorciatoia con l'indirizzo del profilo.
    expect(
      screen.getByRole('button', { name: /Parti da Via Torino 5, Milano/ }),
    ).toBeInTheDocument();
    // La ricerca permette di scegliere un punto diverso.
    expect(screen.getByLabelText('Cerca il luogo')).toBeInTheDocument();
  });

  it('salva la partenza come prima tappa marcata is_start', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(null);
    assicuraGiornata.mockResolvedValue({ id: 'g1' });
    aggiungiTappa.mockResolvedValue({ id: 's1' });

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Da dove parti?');

    await utente.click(screen.getByRole('button', { name: /Parti da Via Torino 5, Milano/ }));

    await waitFor(() => {
      expect(aggiungiTappa).toHaveBeenCalled();
    });
    const argomenti = aggiungiTappa.mock.calls[0] ?? [];
    expect(argomenti[0]).toBe('g1');
    expect(argomenti[1]).toMatchObject({ address: 'Via Torino 5, Milano' });
    // Quarto argomento: il flag di partenza.
    expect(argomenti[3]).toBe(true);
  });

  it('elenca le tappe numerate con il totale della giornata', async () => {
    caricaGiornata.mockResolvedValue(giornataConDueTappe());
    renderConProvider(<DettaglioGiornata data={DATA} />);

    expect(await screen.findByText('Deposito')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(within(riepilogo()).getByText('10,0 km')).toBeInTheDocument();
    expect(within(riepilogo()).getByText('2 tappe')).toBeInTheDocument();
  });

  it('segnala quante tratte sono senza chilometri', async () => {
    caricaGiornata.mockResolvedValue(giornataConDueTappe([]));
    renderConProvider(<DettaglioGiornata data={DATA} />);

    expect(await screen.findByText('1 tratta senza km')).toBeInTheDocument();
    expect(within(riepilogo()).getByText('0,0 km')).toBeInTheDocument();
  });

  it('aggiorna subito il totale quando si inseriscono i km a mano', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(giornataConDueTappe([]));
    // Richiesta che non si conclude: così si osserva solo l'effetto ottimistico,
    // senza che un refetch successivo riporti i dati del server.
    salvaTrattaManuale.mockReturnValue(new Promise(() => {}));

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    await utente.click(screen.getByRole('button', { name: /Modifica i chilometri/ }));
    await utente.clear(screen.getByLabelText('Chilometri'));
    await utente.type(screen.getByLabelText('Chilometri'), '42,5');
    await utente.click(screen.getByRole('button', { name: 'Salva' }));

    // Aggiornamento ottimistico: il totale cambia senza attendere la rete.
    await waitFor(() => {
      expect(within(riepilogo()).getByText('42,5 km')).toBeInTheDocument();
    });
    // TanStack Query passa a mutationFn un secondo argomento di contesto:
    // si verifica solo il payload, che è ciò che finisce sul database.
    expect(salvaTrattaManuale.mock.calls[0]?.[0]).toEqual({
      legId: null,
      itineraryId: 'g1',
      fromStopId: 's1',
      toStopId: 's2',
      valori: { distanceKm: 42.5, durationMin: null },
    });
  });

  it('ripristina il valore precedente se il salvataggio della tratta fallisce', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(giornataConDueTappe());
    salvaTrattaManuale.mockRejectedValue(new Error('Rete non disponibile'));

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    await utente.click(screen.getByRole('button', { name: /Modifica i chilometri/ }));
    await utente.clear(screen.getByLabelText('Chilometri'));
    await utente.type(screen.getByLabelText('Chilometri'), '99');
    await utente.click(screen.getByRole('button', { name: 'Salva' }));

    // Il totale torna a 10 km: la modifica ottimistica è stata annullata.
    await waitFor(() => {
      expect(within(riepilogo()).getByText('10,0 km')).toBeInTheDocument();
    });
    expect(within(riepilogo()).queryByText('99,0 km')).not.toBeInTheDocument();
  });

  it('chiede conferma prima di eliminare una tappa', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(giornataConDueTappe());
    eliminaTappaApi.mockResolvedValue(1);

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    await utente.click(screen.getByRole('button', { name: 'Elimina Deposito' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText(/Eliminare “Deposito”/)).toBeInTheDocument();
    expect(eliminaTappaApi).not.toHaveBeenCalled();

    await utente.click(within(dialogo).getByRole('button', { name: 'Elimina' }));

    await waitFor(() => {
      expect(eliminaTappaApi).toHaveBeenCalledWith('s1');
    });
  });

  it('annullando la conferma non elimina nulla', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(giornataConDueTappe());

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    await utente.click(screen.getByRole('button', { name: 'Elimina Deposito' }));
    const dialogo = await screen.findByRole('alertdialog');
    await utente.click(within(dialogo).getByRole('button', { name: 'Annulla' }));

    expect(eliminaTappaApi).not.toHaveBeenCalled();
    expect(screen.getByText('Deposito')).toBeInTheDocument();
  });

  it('tiene le azioni rare in un menu, con l’eliminazione separata', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(giornataConDueTappe());

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    // Le due azioni frequenti restano in vista.
    expect(screen.getByRole('button', { name: 'Aggiungi tappa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calcola km' })).toBeInTheDocument();

    // Le altre, compresa quella distruttiva, stanno nel menu.
    expect(screen.queryByText('Elimina giornata')).not.toBeInTheDocument();

    await utente.click(screen.getByRole('button', { name: 'Altro' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Cambia partenza')).toBeInTheDocument();
    expect(within(menu).getByText('Duplica giornata')).toBeInTheDocument();
    expect(within(menu).getByText('Elimina giornata')).toBeInTheDocument();
  });

  it('eliminando la giornata chiede conferma', async () => {
    const utente = userEvent.setup();
    caricaGiornata.mockResolvedValue(giornataConDueTappe());

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    await utente.click(screen.getByRole('button', { name: 'Altro' }));
    await utente.click(await screen.findByText('Elimina giornata'));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText('Eliminare tutta la giornata?')).toBeInTheDocument();
  });

  it('mostra un errore recuperabile se il caricamento fallisce', async () => {
    caricaGiornata.mockRejectedValue(new Error('Connessione non disponibile'));
    renderConProvider(<DettaglioGiornata data={DATA} />);

    expect(await screen.findByText('Impossibile caricare la giornata')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
  });

  it('mostra la tratta di rientro quando la giornata la prevede', async () => {
    caricaGiornata.mockResolvedValue({
      ...giornataConDueTappe(),
      itinerary: { ...itinerary, returns_to_start: true },
    });

    renderConProvider(<DettaglioGiornata data={DATA} />);
    await screen.findByText('Deposito');

    // Il rientro torna alla prima tappa, cioè al punto di partenza.
    expect(
      screen.getByRole('button', {
        name: /Modifica i chilometri della tratta da Cliente a Deposito/,
      }),
    ).toBeInTheDocument();
  });
});
