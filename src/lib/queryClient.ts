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
      // Toast di ripiego per gli errori che nessuno mostra. Non scatta se la
      // mutazione ha un onError proprio, né se il componente mostra già
      // l'errore dentro il form (meta.erroreMostrato): il login lo presentava
      // due volte, nel riquadro rosso e in un toast.
      onError: (errore, _variabili, _contesto, mutazione) => {
        if (mutazione.options.onError) return;
        if (mutazione.meta?.erroreMostrato === true) return;
        toast.error(messaggioErrore(errore));
      },
    }),
  });
}

export const queryClient = createQueryClient();
