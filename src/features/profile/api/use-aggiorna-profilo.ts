import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { chiaviProfilo } from '@/features/itinerary/api/query-keys';
import type { ProfiloInput } from '@/features/profile/schemas/profile.schemas';
import { toAppError, type AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types/models';

async function aggiornaProfilo(utenteId: string, valori: ProfiloInput): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: valori.fullName,
      default_start_address: valori.defaultStartAddress,
      default_start_lat: valori.defaultStartLat,
      default_start_lng: valori.defaultStartLng,
    })
    .eq('id', utenteId)
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

export function useAggiornaProfilo(
  utenteId: string,
): UseMutationResult<Profile, AppError, ProfiloInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['profilo', 'aggiorna'],
    mutationFn: (valori: ProfiloInput) => aggiornaProfilo(utenteId, valori),
    onSuccess: (profilo) => {
      // Il profilo appena salvato è già la verità: si scrive in cache senza
      // aspettare un nuovo giro sulla rete.
      queryClient.setQueryData(chiaviProfilo.corrente(), profilo);
    },
  });
}
