import { describe, expect, it } from 'vitest';

import type { GiornataCompleta } from '@/features/itinerary/api/itinerary.api';
import {
  calcolaTotali,
  costruisciSequenza,
  invalidaTratteNonAdiacenti,
  rinumera,
  spostaElemento,
} from '@/features/itinerary/lib/sequenza';
import type { Itinerary, Leg, Stop } from '@/types/models';

const ADESSO = '2026-05-04T08:00:00Z';

function tappa(id: string, position: number, label = id.toUpperCase()): Stop {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    position,
    label,
    address: null,
    lat: null,
    lng: null,
    planned_time: null,
    notes: null,
    is_start: false,
    created_at: ADESSO,
    updated_at: ADESSO,
  };
}

function tratta(
  id: string,
  from: string | null,
  to: string | null,
  distance: number,
  extra: Partial<Leg> = {},
): Leg {
  return {
    id,
    itinerary_id: 'g1',
    user_id: 'u1',
    from_stop_id: from,
    to_stop_id: to,
    distance_km: distance,
    duration_min: null,
    source: 'auto',
    is_estimate: false,
    route_geometry: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

function giornata(stops: Stop[], legs: Leg[], returnsToStart = false): GiornataCompleta {
  const itinerary: Itinerary = {
    id: 'g1',
    user_id: 'u1',
    date: '2026-05-04',
    notes: null,
    returns_to_start: returnsToStart,
    travel_mode: 'auto',
    created_at: ADESSO,
    updated_at: ADESSO,
  };
  return { itinerary, stops, legs };
}

describe('costruisciSequenza', () => {
  it('crea una tratta per ogni coppia di tappe consecutive', () => {
    const sequenza = costruisciSequenza(
      giornata([tappa('a', 1), tappa('b', 2), tappa('c', 3)], [tratta('l1', 'a', 'b', 10)]),
    );

    expect(sequenza.tratte).toHaveLength(2);
    expect(sequenza.tratte[0]?.leg?.id).toBe('l1');
    // La seconda coppia non ha ancora una riga: va inserita o calcolata.
    expect(sequenza.tratte[1]?.leg).toBeNull();
    expect(sequenza.tratte[1]?.fromStop.id).toBe('b');
    expect(sequenza.tratte[1]?.toStop.id).toBe('c');
  });

  it('ordina le tappe per position anche se arrivano mescolate', () => {
    const sequenza = costruisciSequenza(
      giornata([tappa('c', 3), tappa('a', 1), tappa('b', 2)], []),
    );
    expect(sequenza.tappe.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('con una sola tappa non ci sono tratte', () => {
    const sequenza = costruisciSequenza(giornata([tappa('a', 1)], []));
    expect(sequenza.tratte).toHaveLength(0);
  });

  it('aggiunge la tratta di rientro solo se la giornata la prevede', () => {
    const senza = costruisciSequenza(giornata([tappa('a', 1), tappa('b', 2)], [], false));
    expect(senza.tratte).toHaveLength(1);

    const con = costruisciSequenza(giornata([tappa('a', 1), tappa('b', 2)], [], true));
    expect(con.tratte).toHaveLength(2);
    const rientro = con.tratte[1];
    expect(rientro?.rientro).toBe(true);
    // Il rientro torna alla prima tappa, che è il punto di partenza.
    expect(rientro?.fromStop.id).toBe('b');
    expect(rientro?.toStop.id).toBe('a');
  });

  it('con una sola tappa non c’è rientro, sarebbe una tratta verso se stessa', () => {
    const sequenza = costruisciSequenza(giornata([tappa('a', 1)], [], true));
    expect(sequenza.tratte).toHaveLength(0);
  });

  it('associa la tratta di rientro solo se parte dall’ultima tappa', () => {
    // Tratta di rientro rimasta agganciata a una tappa che non è più l'ultima:
    // qui punta da 'a' ad 'a', quindi non è la coppia attesa (b → a).
    const sequenza = costruisciSequenza(
      giornata([tappa('a', 1), tappa('b', 2)], [tratta('l-rientro', 'a', 'a', 5)], true),
    );
    const rientro = sequenza.tratte.at(-1);
    expect(rientro?.fromStop.id).toBe('b');
    expect(rientro?.toStop.id).toBe('a');
    expect(rientro?.leg).toBeNull();
  });

  it('ignora una tratta i cui estremi non sono più consecutivi', () => {
    const sequenza = costruisciSequenza(
      giornata(
        [tappa('a', 1), tappa('b', 2), tappa('c', 3)],
        // a -> c non è una coppia consecutiva
        [tratta('l1', 'a', 'c', 30)],
      ),
    );
    expect(sequenza.tratte[0]?.leg).toBeNull();
  });
});

describe('calcolaTotali', () => {
  it('somma i chilometri delle tratte presenti', () => {
    const { tratte } = costruisciSequenza(
      giornata(
        [tappa('a', 1), tappa('b', 2), tappa('c', 3)],
        [
          tratta('l1', 'a', 'b', 12.3, { duration_min: 25 }),
          tratta('l2', 'b', 'c', 7.7, { duration_min: 15 }),
        ],
      ),
    );

    const totali = calcolaTotali(tratte);
    expect(totali.km).toBe(20);
    expect(totali.minuti).toBe(40);
    expect(totali.tratteMancanti).toBe(0);
  });

  it('conta le tratte mancanti senza falsare il totale', () => {
    const { tratte } = costruisciSequenza(
      giornata([tappa('a', 1), tappa('b', 2), tappa('c', 3)], [tratta('l1', 'a', 'b', 10)]),
    );

    const totali = calcolaTotali(tratte);
    expect(totali.km).toBe(10);
    expect(totali.tratteTotali).toBe(2);
    expect(totali.tratteMancanti).toBe(1);
  });

  it('restituisce minuti null quando nessuna tratta ha una durata', () => {
    const { tratte } = costruisciSequenza(
      giornata([tappa('a', 1), tappa('b', 2)], [tratta('l1', 'a', 'b', 10)]),
    );
    expect(calcolaTotali(tratte).minuti).toBeNull();
  });

  it('somma i minuti solo delle tratte che li hanno', () => {
    const { tratte } = costruisciSequenza(
      giornata(
        [tappa('a', 1), tappa('b', 2), tappa('c', 3)],
        [
          tratta('l1', 'a', 'b', 10, { duration_min: 20 }),
          tratta('l2', 'b', 'c', 10, { duration_min: null }),
        ],
      ),
    );
    expect(calcolaTotali(tratte).minuti).toBe(20);
  });

  it('conta le tratte manuali e quelle stimate', () => {
    const { tratte } = costruisciSequenza(
      giornata(
        [tappa('a', 1), tappa('b', 2), tappa('c', 3)],
        [
          tratta('l1', 'a', 'b', 10, { source: 'manual' }),
          tratta('l2', 'b', 'c', 10, { is_estimate: true }),
        ],
      ),
    );
    const totali = calcolaTotali(tratte);
    expect(totali.tratteManuali).toBe(1);
    expect(totali.tratteStimate).toBe(1);
  });

  it('arrotonda al centesimo, senza code binarie', () => {
    const { tratte } = costruisciSequenza(
      giornata(
        [tappa('a', 1), tappa('b', 2), tappa('c', 3)],
        [tratta('l1', 'a', 'b', 0.1), tratta('l2', 'b', 'c', 0.2)],
      ),
    );
    // 0.1 + 0.2 = 0.30000000000000004 in aritmetica binaria
    expect(calcolaTotali(tratte).km).toBe(0.3);
  });

  it('una giornata vuota ha totale zero', () => {
    const totali = calcolaTotali([]);
    expect(totali.km).toBe(0);
    expect(totali.minuti).toBeNull();
    expect(totali.tratteTotali).toBe(0);
  });
});

describe('spostaElemento', () => {
  it('sposta in avanti', () => {
    expect(spostaElemento(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('sposta indietro', () => {
    expect(spostaElemento(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('non cambia nulla se gli indici coincidono o sono fuori intervallo', () => {
    expect(spostaElemento(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(spostaElemento(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    expect(spostaElemento(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('non modifica l’array originale', () => {
    const originale = ['a', 'b', 'c'];
    spostaElemento(originale, 0, 2);
    expect(originale).toEqual(['a', 'b', 'c']);
  });
});

describe('rinumera', () => {
  it('assegna position 1..n nell’ordine dell’array', () => {
    const risultato = rinumera([tappa('c', 7), tappa('a', 2), tappa('b', 5)]);
    expect(risultato.map((t) => [t.id, t.position])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3],
    ]);
  });
});

describe('invalidaTratteNonAdiacenti', () => {
  const tappe = [tappa('a', 1), tappa('b', 2), tappa('c', 3)];

  it('tiene solo le tratte fra tappe consecutive', () => {
    const risultato = invalidaTratteNonAdiacenti(
      tappe,
      [tratta('l1', 'a', 'b', 10), tratta('l2', 'a', 'c', 30)],
      false,
    );
    expect(risultato.map((leg) => leg.id)).toEqual(['l1']);
  });

  it('elimina anche le tratte manuali se la coppia non è più consecutiva', () => {
    const risultato = invalidaTratteNonAdiacenti(
      tappe,
      [tratta('l-manuale', 'c', 'a', 42, { source: 'manual' })],
      false,
    );
    expect(risultato).toHaveLength(0);
  });

  it('tiene il rientro quando è attivo e collega ultima e prima tappa', () => {
    const risultato = invalidaTratteNonAdiacenti(tappe, [tratta('l-r', 'c', 'a', 8)], true);
    expect(risultato.map((leg) => leg.id)).toEqual(['l-r']);
  });

  it('elimina il rientro quando l’opzione è disattivata', () => {
    const risultato = invalidaTratteNonAdiacenti(tappe, [tratta('l-r', 'c', 'a', 8)], false);
    expect(risultato).toHaveLength(0);
  });

  it('scarta le tratte con un estremo mancante, che il modello non prevede più', () => {
    const risultato = invalidaTratteNonAdiacenti(tappe, [tratta('vecchia', 'c', null, 8)], true);
    expect(risultato).toHaveLength(0);
  });

  it('coincide con il risultato dopo un riordino', () => {
    // Ordine a,b,c con tratte a->b e b->c; si sposta c in testa: c,a,b.
    const legs = [tratta('l1', 'a', 'b', 10), tratta('l2', 'b', 'c', 20)];
    const riordinate = rinumera([tappa('c', 3), tappa('a', 1), tappa('b', 2)]);
    const risultato = invalidaTratteNonAdiacenti(riordinate, legs, false);
    // a->b resta consecutiva, b->c no.
    expect(risultato.map((leg) => leg.id)).toEqual(['l1']);
  });
});
