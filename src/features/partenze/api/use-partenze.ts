import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { chiaviPartenze } from '@/features/itinerary/api/query-keys';
import type { NuovaPartenza } from '@/features/partenze/lib/partenze';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import type { PartenzaSalvata } from '@/types/models';

async function caricaPartenze(): Promise<PartenzaSalvata[]> {
  // RLS limita già la tabella alle partenze dell'utente autenticato.
  const { data, error } = await supabase
    .from('saved_starts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);
  return data;
}

export function usePartenze(): UseQueryResult<PartenzaSalvata[]> {
  return useQuery({
    queryKey: chiaviPartenze.tutte,
    queryFn: caricaPartenze,
    staleTime: 5 * 60_000,
  });
}

export function useSalvaPartenza() {
  const queryClient = useQueryClient();
  return useMutation({
    // L'errore lo mostra chi salva, con un messaggio più preciso del generico.
    meta: { erroreMostrato: true },
    mutationFn: async (partenza: NuovaPartenza): Promise<PartenzaSalvata> => {
      // user_id lo imposta il database (default auth.uid()).
      const { data, error } = await supabase
        .from('saved_starts')
        .insert({ ...partenza, label: partenza.label.trim() })
        .select()
        .single();
      if (error) throw toAppError(error);
      return data;
    },
    onSuccess: (salvata) => {
      queryClient.setQueryData<PartenzaSalvata[]>(chiaviPartenze.tutte, (attuali) => [
        ...(attuali ?? []),
        salvata,
      ]);
    },
  });
}

export function useEliminaPartenza() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_starts').delete().eq('id', id);
      if (error) throw toAppError(error);
      return id;
    },
    // Sparisce subito dall'elenco; se il database rifiuta, torna al suo posto.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: chiaviPartenze.tutte });
      const prima = queryClient.getQueryData<PartenzaSalvata[]>(chiaviPartenze.tutte);
      queryClient.setQueryData<PartenzaSalvata[]>(chiaviPartenze.tutte, (attuali) =>
        (attuali ?? []).filter((partenza) => partenza.id !== id),
      );
      return { prima };
    },
    onError: (_errore, _id, contesto) => {
      if (contesto?.prima) queryClient.setQueryData(chiaviPartenze.tutte, contesto.prima);
    },
  });
}
