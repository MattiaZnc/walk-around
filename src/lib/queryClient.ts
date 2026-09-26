import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { messaggioErrore, toAppError } from '@/lib/errors';

const CODICI_NON_RITENTABILI = new Set([
  '42501', // permission denied (RLS)
  'PGRST116', // nessuna riga
  'PGRST301', // JWT scaduto
  '23505', // unique violation
  '23503', // foreign key
  '23514', // check violation
]);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (tentativi, errore) => {
          if (CODICI_NON_RITENTABILI.has(toAppError(errore).code)) return false;
          return tentativi < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      // Errore su una query già popolata: l'UI mostra i dati vecchi, quindi
      // il toast è l'unico segnale che il refresh è fallito.
      onError: (errore, query) => {
        if (query.state.data !== undefined) {
          toast.error(messaggioErrore(errore));
        }
      },
    }),
    mutationCache: new MutationCache({
      // Le mutazioni con onError proprio gestiscono il messaggio da sole.
      onError: (errore, _variabili, _contesto, mutazione) => {
        if (!mutazione.options.onError) {
          toast.error(messaggioErrore(errore));
        }
      },
    }),
  });
}

export const queryClient = createQueryClient();
