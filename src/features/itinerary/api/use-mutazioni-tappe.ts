import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useCacheGiornata, type CachePrecedente } from '@/features/itinerary/api/cache-giornata';
import {
  aggiornaTappa,
  aggiungiTappa,
  assicuraGiornata,
  eliminaTappa,
  riordinaTappe,
  type DatiTappa,
} from '@/features/itinerary/api/itinerary.api';
import {
  invalidaTratteNonAdiacenti,
  rinumera,
  spostaElemento,
} from '@/features/itinerary/lib/sequenza';
import { messaggioErrore, type AppError } from '@/lib/errors';
import type { Stop } from '@/types/models';

type Contesto = { precedente: CachePrecedente };

/**
 * Crea una tappa, creando la giornata se non esiste ancora.
 * Non è ottimistica: id e posizione li assegna la RPC, e inventarli lato
 * client produrrebbe un salto visivo al primo refetch.
 */
export function useCreaTappa(
  data: string,
): UseMutationResult<Stop, AppError, { tappa: DatiTappa; posizione?: number }> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'crea-tappa', data],
    mutationFn: async ({ tappa, posizione }) => {
      const giornata = await assicuraGiornata(data);
      return aggiungiTappa(giornata.id, tappa, posizione);
    },
    onSuccess: async () => {
      await cache.invalida();
    },
  });
}

/** Modifica una tappa esistente, con aggiornamento ottimistico. */
export function useAggiornaTappa(
  data: string,
): UseMutationResult<Stop, AppError, { stopId: string; tappa: DatiTappa }, Contesto> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'aggiorna-tappa', data],
    mutationFn: ({ stopId, tappa }) => aggiornaTappa(stopId, tappa),
    onMutate: async ({ stopId, tappa }) => {
      const precedente = await cache.applica((giornata) => ({
        ...giornata,
        stops: giornata.stops.map((esistente) =>
          esistente.id === stopId
            ? {
                ...esistente,
                label: tappa.label,
                address: tappa.address,
                lat: tappa.lat,
                lng: tappa.lng,
                planned_time: tappa.plannedTime,
                notes: tappa.notes,
              }
            : esistente,
        ),
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

/**
 * Elimina una tappa. L'aggiornamento ottimistico rimuove la tappa, rinumera le
 * altre e scarta le tratte che non collegano più tappe consecutive: le stesse
 * regole applicate dalla RPC `delete_stop`.
 */
export function useEliminaTappa(
  data: string,
): UseMutationResult<number, AppError, { stopId: string }, Contesto> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'elimina-tappa', data],
    mutationFn: ({ stopId }) => eliminaTappa(stopId),
    onMutate: async ({ stopId }) => {
      const precedente = await cache.applica((giornata) => {
        const tappe = rinumera(giornata.stops.filter((tappa) => tappa.id !== stopId));
        return {
          ...giornata,
          stops: tappe,
          legs: invalidaTratteNonAdiacenti(
            tappe,
            // Le tratte che toccavano la tappa sparirebbero per cascade lato DB.
            giornata.legs.filter((leg) => leg.from_stop_id !== stopId && leg.to_stop_id !== stopId),
            giornata.itinerary.returns_to_start,
          ),
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

/**
 * Riordina le tappe. Qui l'ottimismo è obbligatorio: il drag & drop deve
 * lasciare la tappa dove l'utente l'ha rilasciata, senza attendere la rete.
 */
export function useRiordinaTappe(
  data: string,
): UseMutationResult<number, AppError, { itineraryId: string; idOrdinati: string[] }, Contesto> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'riordina-tappe', data],
    mutationFn: ({ itineraryId, idOrdinati }) => riordinaTappe(itineraryId, idOrdinati),
    onMutate: async ({ idOrdinati }) => {
      const precedente = await cache.applica((giornata) => {
        const perId = new Map(giornata.stops.map((tappa) => [tappa.id, tappa]));
        const riordinate = idOrdinati
          .map((id) => perId.get(id))
          .filter((tappa): tappa is Stop => tappa !== undefined);
        const tappe = rinumera(riordinate);
        return {
          ...giornata,
          stops: tappe,
          legs: invalidaTratteNonAdiacenti(
            tappe,
            giornata.legs,
            giornata.itinerary.returns_to_start,
          ),
        };
      });
      return { precedente };
    },
    onError: (errore, _variabili, contesto) => {
      cache.ripristina(contesto?.precedente);
      toast.error(messaggioErrore(errore), { description: 'L’ordine è stato ripristinato.' });
    },
    onSettled: async () => {
      await cache.invalida();
    },
  });
}

/** Nuovo ordine di id dopo uno spostamento (usato anche dai test). */
export function ordineDopoSpostamento(tappe: readonly Stop[], da: number, a: number): string[] {
  return spostaElemento(tappe, da, a).map((tappa) => tappa.id);
}
