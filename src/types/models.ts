import type { Database } from '@/types/database.types';

/**
 * Alias comodi sui tipi generati: le feature importano da qui, così un
 * cambiamento di schema si propaga con `npm run db:types` senza toccare
 * i tipi a mano.
 */
type Schema = Database['public'];

export type Tabella<T extends keyof Schema['Tables']> = Schema['Tables'][T]['Row'];
export type Inserimento<T extends keyof Schema['Tables']> = Schema['Tables'][T]['Insert'];
export type Aggiornamento<T extends keyof Schema['Tables']> = Schema['Tables'][T]['Update'];

export type Profile = Tabella<'profiles'>;
export type Itinerary = Tabella<'itineraries'>;
export type Stop = Tabella<'stops'>;
export type Leg = Tabella<'legs'>;

export type ProfileUpdate = Aggiornamento<'profiles'>;
export type ItineraryInsert = Inserimento<'itineraries'>;
export type StopInsert = Inserimento<'stops'>;
export type StopUpdate = Aggiornamento<'stops'>;
export type LegInsert = Inserimento<'legs'>;
export type LegUpdate = Aggiornamento<'legs'>;

/**
 * La vista espone tutte le colonne come nullable (Postgres non garantisce il
 * contrario alle viste con aggregazioni): questo tipo riflette ciò che l'app
 * usa davvero, dopo la normalizzazione fatta negli hook.
 */
export type ItineraryTotalsRow = Schema['Views']['itinerary_totals']['Row'];

export type TotaliGiornata = {
  itineraryId: string;
  date: string;
  totalKm: number;
  totalDurationMin: number;
  legsCount: number;
  stopsCount: number;
  manualLegsCount: number;
  estimatedLegsCount: number;
  returnsToStart: boolean;
};

/** Origine del valore di una tratta: calcolata o corretta a mano. */
export type LegSource = 'auto' | 'manual';

/** Una tappa con coordinate valorizzate: precondizione per il calcolo percorsi. */
export type StopConCoordinate = Stop & { lat: number; lng: number };

export function haCoordinate(stop: Stop): stop is StopConCoordinate {
  return stop.lat !== null && stop.lng !== null;
}
