import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useCacheGiornata, type CachePrecedente } from '@/features/itinerary/api/cache-giornata';
import {
  aggiornaGiornata,
  duplicaGiornata,
  eliminaGiornata,
  eliminaTratta,
  salvaTrattaManuale,
  type DatiTratta,
} from '@/features/itinerary/api/itinerary.api';
import type { ModalitaViaggio } from '@/features/itinerary/api/percorsi.api';
import { chiaviItinerario } from '@/features/itinerary/api/query-keys';
import { invalidaTratteNonAdiacenti } from '@/features/itinerary/lib/sequenza';
import type { AppError } from '@/lib/errors';
import type { Itinerary, Leg } from '@/types/models';

type Contesto = { precedente: CachePrecedente };

export type VariabiliTratta = {
  legId: string | null;
  itineraryId: string;
  fromStopId: string;
  toStopId: string | null;
  valori: DatiTratta;
};

/** Prefisso dell'id usato per la riga provvisoria dell'aggiornamento ottimistico. */
export const ID_PROVVISORIO = 'provvisoria:';

/**
 * Salva a mano i km (e i minuti) di una tratta.
 * Aggiornamento ottimistico: il totale della giornata si muove appena l'utente
 * conferma il valore, senza aspettare la risposta del server.
 */
export function useSalvaTrattaManuale(
  data: string,
): UseMutationResult<Leg, AppError, VariabiliTratta, Contesto> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'salva-tratta', data],
    mutationFn: salvaTrattaManuale,
    onMutate: async (variabili) => {
      const precedente = await cache.applica((giornata) => {
        const adesso = new Date().toISOString();
        const esistente = variabili.legId
          ? giornata.legs.find((leg) => leg.id === variabili.legId)
          : undefined;

        if (esistente) {
          return {
            ...giornata,
            legs: giornata.legs.map((leg) =>
              leg.id === esistente.id
                ? {
                    ...leg,
                    distance_km: variabili.valori.distanceKm,
                    duration_min: variabili.valori.durationMin,
                    source: 'manual',
                    is_estimate: false,
                    updated_at: adesso,
                  }
                : leg,
            ),
          };
        }

        const provvisoria: Leg = {
          // L'id definitivo arriva dal server; nel frattempo serve qualcosa di
          // stabile per il rendering, riconoscibile come non ancora salvato.
          id: `${ID_PROVVISORIO}${variabili.fromStopId}`,
          itinerary_id: variabili.itineraryId,
          user_id: giornata.itinerary.user_id,
          from_stop_id: variabili.fromStopId,
          to_stop_id: variabili.toStopId,
          distance_km: variabili.valori.distanceKm,
          duration_min: variabili.valori.durationMin,
          source: 'manual',
          is_estimate: false,
          route_geometry: null,
          created_at: adesso,
          updated_at: adesso,
        };

        return { ...giornata, legs: [...giornata.legs, provvisoria] };
      });

      return { precedente };
    },
    onError: (_errore, _variabili, contesto) => {
      cache.ripristina(contesto?.precedente);
    },
    onSettled: async () => {
      await cache.invalida();
    },
  });
}

/** Azzera una tratta: torna allo stato "da inserire". */
export function useEliminaTratta(
  data: string,
): UseMutationResult<void, AppError, { legId: string }, Contesto> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'elimina-tratta', data],
    mutationFn: ({ legId }) => eliminaTratta(legId),
    onMutate: async ({ legId }) => {
      const precedente = await cache.applica((giornata) => ({
        ...giornata,
        legs: giornata.legs.filter((leg) => leg.id !== legId),
      }));
      return { precedente };
    },
    onError: (_errore, _variabili, contesto) => {
      cache.ripristina(contesto?.precedente);
    },
    onSettled: async () => {
      await cache.invalida();
    },
  });
}

/** Note della giornata e opzione "ritorno al punto di partenza". */
export function useAggiornaGiornata(data: string): UseMutationResult<
  Itinerary,
  AppError,
  {
    itineraryId: string;
    notes?: string | null;
    returnsToStart?: boolean;
    travelMode?: ModalitaViaggio;
  },
  Contesto
> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'aggiorna-giornata', data],
    mutationFn: ({ itineraryId, notes, returnsToStart, travelMode }) =>
      aggiornaGiornata(itineraryId, { notes, returnsToStart, travelMode }),
    onMutate: async ({ notes, returnsToStart, travelMode }) => {
      const precedente = await cache.applica((giornata) => {
        const itinerary: Itinerary = {
          ...giornata.itinerary,
          ...(notes !== undefined ? { notes } : {}),
          ...(returnsToStart !== undefined ? { returns_to_start: returnsToStart } : {}),
          ...(travelMode !== undefined ? { travel_mode: travelMode } : {}),
        };

        // Cambiando mezzo, il trigger sul database elimina le tratte calcolate
        // automaticamente (i km dipendono dal percorso): qui si replica lo
        // stesso effetto, così l'interfaccia non mostra per un istante valori
        // che il server ha già scartato.
        const cambioMezzo =
          travelMode !== undefined && travelMode !== giornata.itinerary.travel_mode;
        const legs = cambioMezzo
          ? giornata.legs.filter((leg) => leg.source === 'manual')
          : giornata.legs;

        return {
          ...giornata,
          itinerary,
          // Disattivando il rientro, la tratta relativa non è più valida.
          legs: invalidaTratteNonAdiacenti(giornata.stops, legs, itinerary.returns_to_start),
        };
      });
      return { precedente };
    },
    onError: (_errore, _variabili, contesto) => {
      cache.ripristina(contesto?.precedente);
    },
    onSettled: async () => {
      await cache.invalida();
    },
  });
}

export function useEliminaGiornata(): UseMutationResult<void, AppError, { itineraryId: string }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['itinerario', 'elimina-giornata'],
    mutationFn: ({ itineraryId }) => eliminaGiornata(itineraryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chiaviItinerario.tutte });
    },
  });
}

export function useDuplicaGiornata(): UseMutationResult<
  Itinerary,
  AppError,
  { itineraryId: string; dataDestinazione: string; sovrascrivi: boolean }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['itinerario', 'duplica-giornata'],
    mutationFn: ({ itineraryId, dataDestinazione, sovrascrivi }) =>
      duplicaGiornata(itineraryId, dataDestinazione, sovrascrivi),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chiaviItinerario.tutte });
    },
  });
}
