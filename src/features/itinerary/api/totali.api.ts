import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import type { ModalitaViaggio } from '@/features/itinerary/api/percorsi.api';
import { modalitaValida } from '@/features/itinerary/api/percorsi.api';

/**
 * Totali di una giornata, già normalizzati.
 * La vista `itinerary_totals` dichiara tutte le colonne come nullable, perché
 * Postgres non garantisce il contrario alle viste con aggregazioni: qui i
 * valori diventano quelli che l'interfaccia può usare senza controlli sparsi.
 */
export type TotaliGiorno = {
  itineraryId: string;
  data: string;
  km: number;
  minuti: number;
  tappe: number;
  tratte: number;
  tratteManuali: number;
  tratteStimate: number;
  haPartenza: boolean;
  rientro: boolean;
  modalita: ModalitaViaggio;
};

/** Giorni con un itinerario salvato nell'intervallo, dal più recente. */
export async function caricaTotali(da: string, a: string): Promise<TotaliGiorno[]> {
  const { data, error } = await supabase
    .from('itinerary_totals')
    .select('*')
    .gte('date', da)
    .lte('date', a)
    .order('date', { ascending: false });

  if (error) throw toAppError(error);

  const righe: TotaliGiorno[] = [];
  for (const riga of data) {
    // Senza id o data la riga non è utilizzabile: non dovrebbe accadere, ma il
    // tipo generato lo ammette e scartarla è meglio che mostrare "undefined".
    if (!riga.itinerary_id || !riga.date) continue;

    righe.push({
      itineraryId: riga.itinerary_id,
      data: riga.date,
      km: riga.total_km ?? 0,
      minuti: riga.total_duration_min ?? 0,
      tappe: riga.stops_count ?? 0,
      tratte: riga.legs_count ?? 0,
      tratteManuali: riga.manual_legs_count ?? 0,
      tratteStimate: riga.estimated_legs_count ?? 0,
      haPartenza: riga.has_start ?? false,
      rientro: riga.returns_to_start ?? false,
      modalita: modalitaValida(riga.travel_mode ?? 'auto'),
    });
  }

  return righe;
}

export type RiepilogoPeriodo = {
  km: number;
  minuti: number;
  giorni: number;
  tappe: number;
  /** Giorni che hanno almeno una tratta senza chilometri. */
  giorniIncompleti: number;
};

/** Somma i totali dei giorni indicati, arrotondando al centesimo. */
export function riepiloga(giorni: readonly TotaliGiorno[]): RiepilogoPeriodo {
  let km = 0;
  let minuti = 0;
  let tappe = 0;
  let incompleti = 0;

  for (const giorno of giorni) {
    km += giorno.km;
    minuti += giorno.minuti;
    tappe += giorno.tappe;

    // Le tratte previste sono le coppie consecutive più l'eventuale rientro.
    const tratteAttese =
      Math.max(0, giorno.tappe - 1) + (giorno.rientro && giorno.tappe > 1 ? 1 : 0);
    if (giorno.tratte < tratteAttese) incompleti += 1;
  }

  return {
    // I km arrivano da numeric(10,2): la somma può accumulare errori di
    // rappresentazione binaria, quindi si arrotonda.
    km: Math.round(km * 100) / 100,
    minuti,
    giorni: giorni.length,
    tappe,
    giorniIncompleti: incompleti,
  };
}
