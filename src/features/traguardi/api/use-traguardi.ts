import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Progressi } from '@/features/traguardi/lib/traguardi';
import { toAppError, type AppError } from '@/lib/errors';
import { oggiISO } from '@/lib/format';
import { supabase } from '@/lib/supabaseClient';

/**
 * Chiave sotto 'itinerario': ogni mutazione su tappe e tratte invalida già
 * quel gruppo, quindi segnare una tappa raggiunta aggiorna anche i traguardi
 * senza collegamenti espliciti.
 */
export const chiaveTraguardi = (oggi: string) => ['itinerario', 'traguardi', oggi] as const;

async function caricaProgressi(oggi: string): Promise<Progressi> {
  const { data, error } = await supabase.rpc('riepilogo_obiettivi', { p_oggi: oggi }).single();
  if (error) throw toAppError(error);

  return {
    tappe: data.tappe_raggiunte,
    km: data.km_percorsi,
    giornate: data.giornate_attive,
  };
}

export function useProgressi(): UseQueryResult<Progressi, AppError> {
  // La data di oggi la decide il client: il database lavora in UTC e vicino
  // alla mezzanotte italiana indicherebbe il giorno sbagliato.
  const oggi = oggiISO();

  return useQuery({
    queryKey: chiaveTraguardi(oggi),
    queryFn: () => caricaProgressi(oggi),
    staleTime: 60_000,
  });
}
