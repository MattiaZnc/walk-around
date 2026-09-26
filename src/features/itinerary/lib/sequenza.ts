import type { GiornataCompleta } from '@/features/itinerary/api/itinerary.api';
import type { Leg, Stop } from '@/types/models';

/**
 * Una tratta della giornata così come la vede l'interfaccia: la coppia di tappe
 * che collega e, se esiste, la riga `legs` corrispondente. `leg === null`
 * significa "tratta ancora da calcolare o da inserire a mano": il database non
 * tiene righe segnaposto, l'assenza è l'informazione.
 */
export type Tratta = {
  /** Chiave stabile per React, valida anche quando la riga non esiste ancora. */
  chiave: string;
  fromStop: Stop;
  /** null = rientro al punto di partenza del profilo. */
  toStop: Stop | null;
  leg: Leg | null;
  /** true se questa tratta è il rientro finale. */
  rientro: boolean;
};

export type Sequenza = {
  tappe: Stop[];
  tratte: Tratta[];
};

/**
 * Deriva la sequenza tappa → tratta → tappa dall'elenco piatto che arriva dal
 * database. È la stessa regola di adiacenza applicata dal DB
 * (`invalida_tratte_non_adiacenti`), qui usata per sapere cosa mostrare.
 */
export function costruisciSequenza(giornata: GiornataCompleta): Sequenza {
  const tappe = [...giornata.stops].sort((a, b) => a.position - b.position);

  // Indice per tappa di partenza: l'unicità è garantita dal DB.
  const perPartenza = new Map<string, Leg>();
  let legRientro: Leg | null = null;

  for (const leg of giornata.legs) {
    if (leg.to_stop_id === null) {
      legRientro = leg;
    } else if (leg.from_stop_id !== null) {
      perPartenza.set(leg.from_stop_id, leg);
    }
  }

  const tratte: Tratta[] = [];

  for (let indice = 0; indice < tappe.length - 1; indice += 1) {
    const partenza = tappe[indice];
    const arrivo = tappe[indice + 1];
    if (!partenza || !arrivo) continue;

    const leg = perPartenza.get(partenza.id) ?? null;
    tratte.push({
      chiave: `${partenza.id}->${arrivo.id}`,
      fromStop: partenza,
      toStop: arrivo,
      leg: leg?.to_stop_id === arrivo.id ? leg : null,
      rientro: false,
    });
  }

  const ultima = tappe.at(-1);
  if (giornata.itinerary.returns_to_start && ultima) {
    tratte.push({
      chiave: `${ultima.id}->rientro`,
      fromStop: ultima,
      toStop: null,
      leg: legRientro?.from_stop_id === ultima.id ? legRientro : null,
      rientro: true,
    });
  }

  return { tappe, tratte };
}

export type TotaliGiornataCalcolati = {
  km: number;
  /** null se nessuna tratta ha una durata: "0 minuti" sarebbe fuorviante. */
  minuti: number | null;
  tratteTotali: number;
  tratteMancanti: number;
  tratteManuali: number;
  tratteStimate: number;
};

/**
 * Totali calcolati sui dati già in cache: si aggiornano subito dopo una
 * modifica ottimistica, senza attendere il ricalcolo della vista sul server.
 */
export function calcolaTotali(tratte: Tratta[]): TotaliGiornataCalcolati {
  let km = 0;
  let minuti = 0;
  let conMinuti = 0;
  let mancanti = 0;
  let manuali = 0;
  let stimate = 0;

  for (const tratta of tratte) {
    if (!tratta.leg) {
      mancanti += 1;
      continue;
    }
    km += tratta.leg.distance_km;
    if (tratta.leg.duration_min !== null) {
      minuti += tratta.leg.duration_min;
      conMinuti += 1;
    }
    if (tratta.leg.source === 'manual') manuali += 1;
    if (tratta.leg.is_estimate) stimate += 1;
  }

  return {
    // I km arrivano da numeric(8,2): la somma può accumulare errori di
    // rappresentazione, quindi si arrotonda al centesimo.
    km: Math.round(km * 100) / 100,
    minuti: conMinuti > 0 ? minuti : null,
    tratteTotali: tratte.length,
    tratteMancanti: mancanti,
    tratteManuali: manuali,
    tratteStimate: stimate,
  };
}

/** Sposta un elemento da un indice a un altro restituendo un nuovo array. */
export function spostaElemento<T>(elenco: readonly T[], da: number, a: number): T[] {
  if (da === a || da < 0 || a < 0 || da >= elenco.length || a >= elenco.length) {
    return [...elenco];
  }
  const risultato = [...elenco];
  const [elemento] = risultato.splice(da, 1);
  if (elemento === undefined) return [...elenco];
  risultato.splice(a, 0, elemento);
  return risultato;
}

/**
 * Riassegna position 1..n dopo uno spostamento, così la cache resta coerente
 * con ciò che il database produrrà.
 */
export function rinumera(tappe: readonly Stop[]): Stop[] {
  return tappe.map((tappa, indice) => ({ ...tappa, position: indice + 1 }));
}

/**
 * Elimina dalla cache le tratte che non collegano più tappe consecutive.
 * Replica lato client `invalida_tratte_non_adiacenti` per far vedere subito
 * il risultato corretto di un riordino o di un'eliminazione.
 */
export function invalidaTratteNonAdiacenti(
  tappe: readonly Stop[],
  legs: readonly Leg[],
  rientroAttivo: boolean,
): Leg[] {
  const attese = new Set<string>();
  for (let indice = 0; indice < tappe.length - 1; indice += 1) {
    const partenza = tappe[indice];
    const arrivo = tappe[indice + 1];
    if (partenza && arrivo) attese.add(`${partenza.id}->${arrivo.id}`);
  }
  const ultima = tappe.at(-1);
  if (rientroAttivo && ultima) attese.add(`${ultima.id}->rientro`);

  return legs.filter((leg) => {
    if (leg.from_stop_id === null) return false;
    const chiave = `${leg.from_stop_id}->${leg.to_stop_id ?? 'rientro'}`;
    return attese.has(chiave);
  });
}
