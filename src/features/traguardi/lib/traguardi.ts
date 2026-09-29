/**
 * Traguardi: badge che si sbloccano superando una soglia di tappe raggiunte o
 * di chilometri percorsi.
 *
 * Qui stanno solo le definizioni e i calcoli, senza React né rete: i
 * conteggi arrivano da `riepilogo_obiettivi` sul database, che applica le
 * regole su cosa conta come "fatto".
 */

export type Categoria = 'tappe' | 'km';

export type Traguardo = {
  id: string;
  categoria: Categoria;
  soglia: number;
  titolo: string;
  descrizione: string;
};

export type Progressi = {
  tappe: number;
  km: number;
  giornate: number;
};

/**
 * Soglie scelte perché i primi traguardi arrivino presto (il primo giro ne
 * sblocca già qualcuno) e gli ultimi richiedano mesi di uso: una scala tutta
 * lontana non motiva, una tutta vicina si esaurisce in una settimana.
 */
export const TRAGUARDI: readonly Traguardo[] = [
  {
    id: 'tappe-1',
    categoria: 'tappe',
    soglia: 1,
    titolo: 'Primo passo',
    descrizione: 'La prima tappa raggiunta',
  },
  {
    id: 'tappe-5',
    categoria: 'tappe',
    soglia: 5,
    titolo: 'In cammino',
    descrizione: '5 tappe raggiunte',
  },
  {
    id: 'tappe-10',
    categoria: 'tappe',
    soglia: 10,
    titolo: 'Esploratore',
    descrizione: '10 tappe raggiunte',
  },
  {
    id: 'tappe-25',
    categoria: 'tappe',
    soglia: 25,
    titolo: 'Viaggiatore',
    descrizione: '25 tappe raggiunte',
  },
  {
    id: 'tappe-50',
    categoria: 'tappe',
    soglia: 50,
    titolo: 'Globetrotter',
    descrizione: '50 tappe raggiunte',
  },
  {
    id: 'tappe-100',
    categoria: 'tappe',
    soglia: 100,
    titolo: 'Centenario',
    descrizione: '100 tappe raggiunte',
  },
  {
    id: 'tappe-250',
    categoria: 'tappe',
    soglia: 250,
    titolo: 'Leggenda',
    descrizione: '250 tappe raggiunte',
  },
  {
    id: 'km-1',
    categoria: 'km',
    soglia: 1,
    titolo: 'Primo chilometro',
    descrizione: '1 km percorso',
  },
  {
    id: 'km-10',
    categoria: 'km',
    soglia: 10,
    titolo: 'Dieci di fila',
    descrizione: '10 km percorsi',
  },
  {
    id: 'km-42',
    categoria: 'km',
    soglia: 42,
    titolo: 'Maratoneta',
    descrizione: 'La distanza di una maratona',
  },
  {
    id: 'km-100',
    categoria: 'km',
    soglia: 100,
    titolo: 'Centurione',
    descrizione: '100 km percorsi',
  },
  {
    id: 'km-250',
    categoria: 'km',
    soglia: 250,
    titolo: 'Grande giro',
    descrizione: '250 km percorsi',
  },
  {
    id: 'km-500',
    categoria: 'km',
    soglia: 500,
    titolo: 'Mezzo migliaio',
    descrizione: '500 km percorsi',
  },
  {
    id: 'km-1000',
    categoria: 'km',
    soglia: 1000,
    titolo: 'Mille chilometri',
    descrizione: '1000 km percorsi',
  },
];

export type StatoTraguardo = Traguardo & {
  ottenuto: boolean;
  /** Valore attuale nella categoria del traguardo. */
  attuale: number;
  /** 0-100, arrotondato per difetto: un 100 deve voler dire davvero ottenuto. */
  percentuale: number;
  /** Quanto manca alla soglia; 0 se ottenuto. */
  mancante: number;
};

function valoreDi(progressi: Progressi, categoria: Categoria): number {
  return categoria === 'tappe' ? progressi.tappe : progressi.km;
}

export function statoTraguardi(progressi: Progressi): StatoTraguardo[] {
  return TRAGUARDI.map((traguardo) => {
    const attuale = valoreDi(progressi, traguardo.categoria);
    const ottenuto = attuale >= traguardo.soglia;
    return {
      ...traguardo,
      ottenuto,
      attuale,
      percentuale: ottenuto ? 100 : Math.floor((attuale / traguardo.soglia) * 100),
      // I km arrivano con due decimali: senza arrotondare comparirebbero code
      // come 0,30000000000000004.
      mancante: ottenuto ? 0 : Math.round((traguardo.soglia - attuale) * 100) / 100,
    };
  });
}

/** Il primo traguardo non ancora ottenuto della categoria, se ne restano. */
export function prossimoTraguardo(
  progressi: Progressi,
  categoria: Categoria,
): StatoTraguardo | null {
  return (
    statoTraguardi(progressi).find((stato) => stato.categoria === categoria && !stato.ottenuto) ??
    null
  );
}

export function idOttenuti(progressi: Progressi): string[] {
  return statoTraguardi(progressi)
    .filter((stato) => stato.ottenuto)
    .map((stato) => stato.id);
}

/**
 * Traguardi ottenuti ora che non lo erano prima.
 * `prima === null` significa "mai controllato su questo dispositivo": in quel
 * caso non si annuncia nulla, altrimenti al primo accesso partirebbe una
 * raffica di avvisi per traguardi raggiunti settimane fa.
 */
export function nuoviTraguardi(prima: readonly string[] | null, ora: readonly string[]): string[] {
  if (prima === null) return [];
  const giaVisti = new Set(prima);
  return ora.filter((id) => !giaVisti.has(id));
}

export function traguardoPerId(id: string): Traguardo | undefined {
  return TRAGUARDI.find((traguardo) => traguardo.id === id);
}
