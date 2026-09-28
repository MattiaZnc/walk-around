import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { caricaTotali, type TotaliGiorno } from '@/features/itinerary/api/totali.api';
import { chiaviItinerario } from '@/features/itinerary/api/query-keys';
import type { AppError } from '@/lib/errors';

/**
 * Riferimento stabile per "nessun risultato": scrivere `data ?? []` nei
 * componenti crea un array nuovo a ogni render, e i useMemo che dipendono da
 * quell'array vengono ricalcolati sempre.
 */
export const NESSUN_GIORNO: readonly TotaliGiorno[] = [];

/** Giorni con itinerario in un intervallo di date (estremi inclusi). */
export function useTotaliPeriodo(
  da: string,
  a: string,
  attiva = true,
): UseQueryResult<TotaliGiorno[], AppError> {
  return useQuery({
    queryKey: chiaviItinerario.totali(da, a),
    queryFn: () => caricaTotali(da, a),
    enabled: attiva && da !== '' && a !== '' && da <= a,
    // I totali cambiano solo quando si modifica una giornata, e quelle
    // modifiche invalidano già l'intero gruppo di chiavi.
    staleTime: 60_000,
  });
}
