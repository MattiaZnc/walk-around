import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Seguimi } from '@/features/itinerary/components/seguimi';
import { renderConProvider } from '@/test/test-utils';
import type { Stop } from '@/types/models';

const ADESSO = '2026-09-28T09:00:00Z';
const COLOSSEO = { lat: 41.8902, lng: 12.4924 };
const VILLA_BORGHESE = { lat: 41.9144, lng: 12.4848 };

function tappa(
  id: string,
  coordinate: { lat: number; lng: number },
  extra: Partial<Stop> = {},
): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position: 1,
    label: id,
    address: null,
    lat: coordinate.lat,
    lng: coordinate.lng,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

/** Geolocalizzazione finta: si decide quale posizione consegnare. */
function geolocalizzazioneFinta() {
  let callback: PositionCallback | null = null;
  let onErrore: PositionErrorCallback | null = null;
  const clearWatch = vi.fn();

  const watchPosition = vi.fn((successo: PositionCallback, errore?: PositionErrorCallback) => {
    callback = successo;
    onErrore = errore ?? null;
    return 1;
  });

  return {
    watchPosition,
    clearWatch,
    /** Simula un rilevamento. */
    invia(coordinate: { lat: number; lng: number }, accuratezza = 15) {
      callback?.({
        coords: {
          latitude: coordinate.lat,
          longitude: coordinate.lng,
          accuracy: accuratezza,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    },
    inviaErrore(code: number) {
      onErrore?.({ code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    },
    get attivata() {
      return watchPosition.mock.calls.length > 0;
    },
  };
}

describe('Seguimi', () => {
  let gps: ReturnType<typeof geolocalizzazioneFinta>;
  const originale = navigator.geolocation;

  beforeEach(() => {
    gps = geolocalizzazioneFinta();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: gps.watchPosition, clearWatch: gps.clearWatch },
    });
  });

  afterEach(() => {
    // Smontaggio esplicito prima di rimuovere la geolocalizzazione: la pulizia
    // dell'effetto chiama clearWatch, e senza questo ordine troverebbe
    // navigator.geolocation già sparito.
    cleanup();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originale });
  });

  it('non chiede la posizione finché non viene attivato', () => {
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo={false}
        onCambioAttivo={vi.fn()}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    // Il permesso e il GPS costano: si chiedono solo su richiesta esplicita.
    expect(gps.attivata).toBe(false);
  });

  it('il pulsante comunica lo stato a chi lo usa', async () => {
    const utente = userEvent.setup();
    const onCambioAttivo = vi.fn();
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo={false}
        onCambioAttivo={onCambioAttivo}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    const pulsante = screen.getByRole('button', { name: 'Seguimi' });
    expect(pulsante).toHaveAttribute('aria-pressed', 'false');

    await utente.click(pulsante);
    expect(onCambioAttivo).toHaveBeenCalledWith(true);
  });

  it('segnala l’arrivo quando la posizione coincide con una tappa', async () => {
    const onArrivo = vi.fn();
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO), tappa('Villa Borghese', VILLA_BORGHESE)]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={onArrivo}
        onPosizione={vi.fn()}
      />,
    );

    gps.invia(COLOSSEO);

    await waitFor(() => {
      expect(onArrivo).toHaveBeenCalledTimes(1);
    });
    const raggiunte = onArrivo.mock.calls[0]?.[0] as Stop[];
    expect(raggiunte.map((t) => t.label)).toEqual(['Colosseo']);
  });

  it('non ripete la segnalazione restando sul posto', async () => {
    const onArrivo = vi.fn();
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={onArrivo}
        onPosizione={vi.fn()}
      />,
    );

    gps.invia(COLOSSEO);
    await waitFor(() => {
      expect(onArrivo).toHaveBeenCalledTimes(1);
    });

    // Il GPS continua a mandare rilevamenti mentre si è fermi.
    gps.invia({ lat: 41.89021, lng: 12.49241 });
    gps.invia({ lat: 41.89019, lng: 12.49239 });

    await waitFor(() => {
      expect(onArrivo).toHaveBeenCalledTimes(1);
    });
  });

  it('mostra la distanza dalla prossima tappa quando è lontana', async () => {
    renderConProvider(
      <Seguimi
        tappe={[tappa('Villa Borghese', VILLA_BORGHESE)]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    gps.invia(COLOSSEO);

    expect(await screen.findByText(/Prossima tappa/)).toBeInTheDocument();
    expect(screen.getByText(/2,8 km/)).toBeInTheDocument();
  });

  it('con posizione imprecisa avvisa e non segnala arrivi', async () => {
    const onArrivo = vi.fn();
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={onArrivo}
        onPosizione={vi.fn()}
      />,
    );

    gps.invia(COLOSSEO, 400);

    expect(await screen.findByText(/Posizione imprecisa/)).toBeInTheDocument();
    expect(onArrivo).not.toHaveBeenCalled();
  });

  it('spiega in italiano il permesso negato', async () => {
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    gps.inviaErrore(1);

    expect(await screen.findByText(/Permesso negato/)).toBeInTheDocument();
  });

  it('quando tutte le tappe sono raggiunte lo dice', async () => {
    renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO, { reached_at: ADESSO })]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    gps.invia(COLOSSEO);

    expect(await screen.findByText('Tutte le tappe sono state raggiunte.')).toBeInTheDocument();
  });

  it('smette di ascoltare quando viene disattivato', async () => {
    const { rerender } = renderConProvider(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo
        onCambioAttivo={vi.fn()}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    expect(gps.attivata).toBe(true);

    rerender(
      <Seguimi
        tappe={[tappa('Colosseo', COLOSSEO)]}
        attivo={false}
        onCambioAttivo={vi.fn()}
        onArrivo={vi.fn()}
        onPosizione={vi.fn()}
      />,
    );

    // Il GPS resta acceso e consuma finché non si libera l'ascolto.
    await waitFor(() => {
      expect(gps.clearWatch).toHaveBeenCalled();
    });
  });
});
