import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { useCacheGiornata } from '@/features/itinerary/api/cache-giornata';
import {
  calcolaPercorsi,
  cercaLuoghi,
  isTratto,
  MASSIMO_TRATTE_PER_RICHIESTA,
  type Coordinate,
  type Luogo,
  type ModalitaViaggio,
} from '@/features/itinerary/api/percorsi.api';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import { toAppError, type AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import type { Leg } from '@/types/models';

/** Estremi di una tratta calcolabile: entrambe le coordinate sono note. */
export type TrattaCalcolabile = {
  chiave: string;
  legId: string | null;
  fromStopId: string;
  toStopId: string;
  from: Coordinate;
  to: Coordinate;
};

export type EsitoRicalcolo = {
  calcolate: number;
  stimate: number;
  nonCalcolabili: number;
  fallite: number;
};

/**
 * Seleziona le tratte che si possono calcolare automaticamente.
 * Vengono escluse:
 *  - quelle con `source = 'manual'` (valore scelto dall'utente, non si tocca);
 *  - quelle con una tappa senza coordinate (niente da dare al provider).
 *
 * Il rientro non è un caso particolare: punta alla tappa di partenza, quindi
 * ha due estremi come tutte le altre.
 */
export function tratteDaCalcolare(
  tratte: readonly Tratta[],
  soloMancanti: boolean,
): { calcolabili: TrattaCalcolabile[]; nonCalcolabili: number } {
  const calcolabili: TrattaCalcolabile[] = [];
  let nonCalcolabili = 0;

  for (const tratta of tratte) {
    if (tratta.leg?.source === 'manual') continue;
    if (soloMancanti && tratta.leg) continue;

    const from = coordinateDi(tratta.fromStop);
    const to = coordinateDi(tratta.toStop);

    if (!from || !to) {
      nonCalcolabili += 1;
      continue;
    }

    calcolabili.push({
      chiave: tratta.chiave,
      legId: tratta.leg?.id ?? null,
      fromStopId: tratta.fromStop.id,
      toStopId: tratta.toStop.id,
      from,
      to,
    });
  }

  return { calcolabili, nonCalcolabili };
}

function coordinateDi(tappa: { lat: number | null; lng: number | null }): Coordinate | null {
  if (tappa.lat === null || tappa.lng === null) return null;
  return { lat: tappa.lat, lng: tappa.lng };
}

type VariabiliRicalcolo = {
  itineraryId: string;
  modalita: ModalitaViaggio;
  tratte: TrattaCalcolabile[];
  nonCalcolabili?: number;
};

/**
 * Calcola i percorsi con la Edge Function e salva i risultati.
 * Le tratte vengono elaborate a blocchi: una giornata con molte tappe
 * supererebbe il limite di coppie per richiesta.
 */
export function useRicalcolaTratte(
  data: string,
): UseMutationResult<EsitoRicalcolo, AppError, VariabiliRicalcolo> {
  const cache = useCacheGiornata(data);

  return useMutation({
    mutationKey: ['itinerario', 'ricalcola', data],
    mutationFn: async ({ itineraryId, modalita, tratte, nonCalcolabili = 0 }) => {
      const esito: EsitoRicalcolo = {
        calcolate: 0,
        stimate: 0,
        nonCalcolabili,
        fallite: 0,
      };

      for (let inizio = 0; inizio < tratte.length; inizio += MASSIMO_TRATTE_PER_RICHIESTA) {
        const blocco = tratte.slice(inizio, inizio + MASSIMO_TRATTE_PER_RICHIESTA);
        const risultati = await calcolaPercorsi(
          blocco.map(({ from, to }) => ({ from, to })),
          modalita,
        );

        const daSalvare: Omit<Leg, 'created_at' | 'updated_at' | 'user_id'>[] = [];

        risultati.forEach((risultato, indice) => {
          const tratta = blocco[indice];
          if (!tratta) return;

          if (!isTratto(risultato)) {
            esito.fallite += 1;
            return;
          }

          if (risultato.isEstimate) esito.stimate += 1;
          else esito.calcolate += 1;

          daSalvare.push({
            id: tratta.legId ?? crypto.randomUUID(),
            itinerary_id: itineraryId,
            from_stop_id: tratta.fromStopId,
            to_stop_id: tratta.toStopId,
            distance_km: risultato.distanceKm,
            duration_min: risultato.durationMin,
            source: 'auto',
            is_estimate: risultato.isEstimate,
            route_geometry: risultato.geometry,
          });
        });

        if (daSalvare.length > 0) {
          // upsert per id: aggiorna le tratte automatiche esistenti e crea le mancanti.
          const { error } = await supabase.from('legs').upsert(daSalvare, { onConflict: 'id' });
          if (error) throw toAppError(error);
        }
      }

      return esito;
    },
    onSettled: async () => {
      await cache.invalida();
    },
  });
}

/**
 * Ricerca luoghi con debounce: l'hook è pensato per un campo di testo, quindi
 * la query parte solo quando il testo si ferma (gestito da `useDebounce`).
 */
export function useCercaLuoghi(testo: string, vicinoA?: Coordinate) {
  const testoPulito = testo.trim();

  return useQuery<Luogo[], AppError>({
    queryKey: ['geocoding', testoPulito, vicinoA?.lat ?? null, vicinoA?.lng ?? null],
    queryFn: () => cercaLuoghi(testoPulito, vicinoA),
    enabled: testoPulito.length >= 3,
    // I luoghi non cambiano: vale la pena tenerli in cache a lungo.
    staleTime: 30 * 60_000,
    retry: false,
  });
}

/** Riferimento stabile a una coordinata, per non invalidare la query a ogni render. */
export function useCoordinataStabile(coordinata: Coordinate | null): Coordinate | undefined {
  const riferimento = useRef<Coordinate | undefined>(undefined);

  return useMemo(() => {
    if (!coordinata) {
      riferimento.current = undefined;
      return undefined;
    }
    const precedente = riferimento.current;
    if (precedente && precedente.lat === coordinata.lat && precedente.lng === coordinata.lng) {
      return precedente;
    }
    riferimento.current = coordinata;
    return coordinata;
  }, [coordinata]);
}
