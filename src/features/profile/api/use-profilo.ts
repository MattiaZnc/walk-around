import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { chiaviProfilo } from '@/features/itinerary/api/query-keys';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types/models';

async function caricaProfilo(): Promise<Profile | null> {
  // RLS limita già la tabella al solo profilo dell'utente autenticato.
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

export function useProfilo(): UseQueryResult<Profile | null> {
  return useQuery({
    queryKey: chiaviProfilo.corrente(),
    queryFn: caricaProfilo,
    // Il punto di partenza predefinito cambia raramente.
    staleTime: 5 * 60_000,
  });
}

export type PuntoDiPartenza = {
  indirizzo: string;
  lat: number | null;
  lng: number | null;
};

/** Punto di partenza predefinito, se il profilo ne ha uno utilizzabile. */
export function puntoDiPartenza(profilo: Profile | null | undefined): PuntoDiPartenza | null {
  if (!profilo?.default_start_address) return null;
  return {
    indirizzo: profilo.default_start_address,
    lat: profilo.default_start_lat,
    lng: profilo.default_start_lng,
  };
}
