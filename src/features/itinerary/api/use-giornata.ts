import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { caricaGiornata, type GiornataCompleta } from '@/features/itinerary/api/itinerary.api';
import { chiaviItinerario } from '@/features/itinerary/api/query-keys';
import {
  calcolaTotali,
  costruisciSequenza,
  type Sequenza,
  type TotaliGiornataCalcolati,
} from '@/features/itinerary/lib/sequenza';
import type { AppError } from '@/lib/errors';

/**
 * Dati della giornata. `null` significa "nessuna giornata salvata per questa
 * data": è uno stato normale, non un errore.
 */
export function useGiornata(data: string): UseQueryResult<GiornataCompleta | null, AppError> {
  return useQuery({
    queryKey: chiaviItinerario.giornata(data),
    queryFn: () => caricaGiornata(data),
  });
}

export type VistaGiornata = {
  sequenza: Sequenza;
  totali: TotaliGiornataCalcolati;
};

/** Sequenza e totali derivati, pronti per l'interfaccia. */
export function vistaGiornata(giornata: GiornataCompleta | null | undefined): VistaGiornata {
  if (!giornata) {
    return {
      sequenza: { tappe: [], tratte: [] },
      totali: {
        km: 0,
        minuti: null,
        tratteTotali: 0,
        tratteMancanti: 0,
        tratteManuali: 0,
        tratteStimate: 0,
      },
    };
  }

  const sequenza = costruisciSequenza(giornata);
  return { sequenza, totali: calcolaTotali(sequenza.tratte) };
}
