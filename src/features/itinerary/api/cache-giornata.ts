import { useQueryClient } from '@tanstack/react-query';

import type { GiornataCompleta } from '@/features/itinerary/api/itinerary.api';
import { chiaviItinerario } from '@/features/itinerary/api/query-keys';

/** Contenuto della cache di una giornata: `null` = nessuna giornata salvata. */
export type DatiCache = GiornataCompleta | null;
/** `undefined` = query mai eseguita, quindi non c'è nulla da ripristinare. */
export type CachePrecedente = DatiCache | undefined;

export type CacheGiornata = {
  /**
   * Applica una modifica ottimistica e restituisce lo stato precedente da
   * usare in caso di errore. La modifica passa per la forma funzionale di
   * setQueryData: così parte sempre dal valore più recente in cache, anche se
   * un'altra mutazione l'ha cambiato nel frattempo.
   */
  applica: (modifica: (giornata: GiornataCompleta) => GiornataCompleta) => Promise<CachePrecedente>;
  ripristina: (precedente: CachePrecedente) => void;
  invalida: () => Promise<void>;
};

/** Accesso condiviso alla cache della giornata, usato da tutte le mutazioni. */
export function useCacheGiornata(data: string): CacheGiornata {
  const queryClient = useQueryClient();
  const chiave = chiaviItinerario.giornata(data);

  return {
    async applica(modifica) {
      // Un refetch in volo sovrascriverebbe la modifica ottimistica.
      await queryClient.cancelQueries({ queryKey: chiave });
      const precedente = queryClient.getQueryData<DatiCache>(chiave);
      queryClient.setQueryData<DatiCache>(chiave, (attuale) =>
        attuale ? modifica(attuale) : attuale,
      );
      return precedente;
    },

    ripristina(precedente) {
      if (precedente !== undefined) {
        queryClient.setQueryData<DatiCache>(chiave, () => precedente);
      }
    },

    async invalida() {
      await queryClient.invalidateQueries({ queryKey: chiaviItinerario.tutte });
    },
  };
}
