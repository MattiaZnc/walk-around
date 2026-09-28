import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import type { Itinerary, Leg, Stop } from '@/types/models';

/** Tutto ciò che serve alla pagina di una giornata, in una sola richiesta. */
export type GiornataCompleta = {
  itinerary: Itinerary;
  stops: Stop[];
  legs: Leg[];
};

export type DatiTappa = {
  label: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  plannedTime: string | null;
  notes: string | null;
};

export type DatiTratta = {
  distanceKm: number;
  durationMin: number | null;
};

function ordinaTappe(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

export async function caricaGiornata(data: string): Promise<GiornataCompleta | null> {
  const { data: riga, error } = await supabase
    .from('itineraries')
    .select('*, stops(*), legs(*)')
    .eq('date', data)
    .maybeSingle();

  if (error) throw toAppError(error);
  if (!riga) return null;

  const { stops, legs, ...itinerary } = riga;
  return { itinerary, stops: ordinaTappe(stops), legs };
}

/**
 * Restituisce la giornata per quella data creandola se manca.
 * Non viene chiamata all'apertura della pagina: solo quando l'utente compie
 * la prima azione (aggiungere una tappa, scrivere una nota), così non si
 * accumulano giornate vuote.
 */
export async function assicuraGiornata(data: string): Promise<Itinerary> {
  const esistente = await caricaGiornata(data);
  if (esistente) return esistente.itinerary;

  const { data: creata, error } = await supabase
    .from('itineraries')
    .insert({ date: data })
    .select()
    .single();

  if (error) {
    // Creazione in parallelo da due schede: la giornata ora esiste, la usiamo.
    if (toAppError(error).code === '23505') {
      const riletta = await caricaGiornata(data);
      if (riletta) return riletta.itinerary;
    }
    throw toAppError(error);
  }

  return creata;
}

export async function aggiornaGiornata(
  itineraryId: string,
  campi: { notes?: string | null; returnsToStart?: boolean; travelMode?: string },
): Promise<Itinerary> {
  const { data, error } = await supabase
    .from('itineraries')
    .update({
      ...(campi.notes !== undefined ? { notes: campi.notes } : {}),
      ...(campi.returnsToStart !== undefined ? { returns_to_start: campi.returnsToStart } : {}),
      ...(campi.travelMode !== undefined ? { travel_mode: campi.travelMode } : {}),
    })
    .eq('id', itineraryId)
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

export async function eliminaGiornata(itineraryId: string): Promise<void> {
  const { error } = await supabase.from('itineraries').delete().eq('id', itineraryId);
  if (error) throw toAppError(error);
}

/** Inserisce una tappa in coda o in una posizione precisa (RPC transazionale). */
export async function aggiungiTappa(
  itineraryId: string,
  tappa: DatiTappa,
  posizione?: number,
  /** true per la tappa di partenza: va in testa e sostituisce la precedente. */
  partenza = false,
): Promise<Stop> {
  const { data, error } = await supabase
    .rpc('insert_stop_at', {
      p_itinerary_id: itineraryId,
      p_label: tappa.label,
      p_address: tappa.address ?? undefined,
      p_lat: tappa.lat ?? undefined,
      p_lng: tappa.lng ?? undefined,
      p_planned_time: tappa.plannedTime ?? undefined,
      p_notes: tappa.notes ?? undefined,
      p_position: posizione,
      p_is_start: partenza,
    })
    .single();

  if (error) throw toAppError(error);
  return data;
}

export async function aggiornaTappa(stopId: string, tappa: DatiTappa): Promise<Stop> {
  const { data, error } = await supabase
    .from('stops')
    .update({
      label: tappa.label,
      address: tappa.address,
      lat: tappa.lat,
      lng: tappa.lng,
      planned_time: tappa.plannedTime,
      notes: tappa.notes,
    })
    .eq('id', stopId)
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

/** Elimina una tappa: la RPC richiude la numerazione e invalida le tratte. */
export async function eliminaTappa(stopId: string): Promise<number> {
  const { data, error } = await supabase.rpc('delete_stop', { p_stop_id: stopId });
  if (error) throw toAppError(error);
  return data;
}

/** Riordina in un'unica transazione. Restituisce quante tratte vanno ricalcolate. */
export async function riordinaTappe(itineraryId: string, idOrdinati: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('reorder_stops', {
    p_itinerary_id: itineraryId,
    p_ordered_ids: idOrdinati,
  });
  if (error) throw toAppError(error);
  return data;
}

/**
 * Salva una tratta inserita o corretta a mano (source = 'manual').
 * Se la tratta esiste si aggiorna, altrimenti si crea.
 */
export async function salvaTrattaManuale(parametri: {
  legId: string | null;
  itineraryId: string;
  fromStopId: string;
  toStopId: string | null;
  valori: DatiTratta;
}): Promise<Leg> {
  const { legId, itineraryId, fromStopId, toStopId, valori } = parametri;

  if (legId) {
    const { data, error } = await supabase
      .from('legs')
      .update({
        distance_km: valori.distanceKm,
        duration_min: valori.durationMin,
        source: 'manual',
        is_estimate: false,
      })
      .eq('id', legId)
      .select()
      .single();

    if (error) throw toAppError(error);
    return data;
  }

  const { data, error } = await supabase
    .from('legs')
    .insert({
      itinerary_id: itineraryId,
      from_stop_id: fromStopId,
      to_stop_id: toStopId,
      distance_km: valori.distanceKm,
      duration_min: valori.durationMin,
      source: 'manual',
      is_estimate: false,
    })
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

/**
 * Marca (o smarca) una tappa come raggiunta.
 * `quando` è il momento dell'arrivo, `null` annulla: si salva l'orario e non un
 * semplice sì/no, perché serve per confrontarlo con quello previsto.
 */
export async function segnaTappaRaggiunta(stopId: string, quando: string | null): Promise<Stop> {
  const { data, error } = await supabase
    .from('stops')
    .update({ reached_at: quando })
    .eq('id', stopId)
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

export async function eliminaTratta(legId: string): Promise<void> {
  const { error } = await supabase.from('legs').delete().eq('id', legId);
  if (error) throw toAppError(error);
}

export async function duplicaGiornata(
  itineraryId: string,
  dataDestinazione: string,
  sovrascrivi: boolean,
): Promise<Itinerary> {
  const { data, error } = await supabase
    .rpc('duplicate_itinerary', {
      p_itinerary_id: itineraryId,
      p_target_date: dataDestinazione,
      p_overwrite: sovrascrivi,
    })
    .single();

  if (error) throw toAppError(error);
  return data;
}
