import type { Geometria, Manovra, ModalitaViaggio } from '@/features/itinerary/api/percorsi.api';
import {
  distanzaMetri,
  type Coordinate,
  type Posizione,
} from '@/features/itinerary/lib/prossimita';
import type { Stop } from '@/types/models';

/**
 * Navigatore verso la prossima tappa: dove sei lungo il percorso, qual è la
 * prossima manovra, se sei uscito di strada.
 *
 * Come prossimita.ts, niente React né rete: le decisioni si provano con
 * posizioni finte.
 */

export type PercorsoGuidato = {
  /** Punti [lat, lng] nell'ordine di Leaflet. */
  punti: [number, number][];
  /** Metri dall'inizio a ciascun punto: stessa lunghezza di `punti`. */
  progressive: number[];
  lunghezzaM: number;
  manovre: Manovra[];
  durataMin: number | null;
  /** Linea d'aria: nessuna strada, solo la direzione. */
  stimato: boolean;
};

export function preparaPercorso(
  geometria: Geometria,
  manovre: Manovra[] = [],
  durataMin: number | null = null,
  stimato = false,
): PercorsoGuidato {
  const punti = geometria.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  const progressive: number[] = [];
  let totale = 0;

  punti.forEach(([lat, lng], indice) => {
    const precedente = punti[indice - 1];
    if (precedente) {
      totale += distanzaEsatta({ lat: precedente[0], lng: precedente[1] }, { lat, lng });
    }
    progressive.push(totale);
  });

  return { punti, progressive, lunghezzaM: totale, manovre, durataMin, stimato };
}

/** Come distanzaMetri ma senza arrotondare: sommando centinaia di segmenti corti l'errore si accumula. */
function distanzaEsatta(da: Coordinate, a: Coordinate): number {
  const radianti = (gradi: number) => (gradi * Math.PI) / 180;
  const deltaLat = radianti(a.lat - da.lat);
  const deltaLng = radianti(a.lng - da.lng);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radianti(da.lat)) * Math.cos(radianti(a.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Proiezione = {
  /** Metri percorsi lungo il tracciato fino al punto più vicino. */
  progressivaM: number;
  /** Distanza dal tracciato in metri. */
  scostamentoM: number;
};

/**
 * Punto del tracciato più vicino alla posizione.
 *
 * `daM` esclude i tratti già percorsi: su un giro che ripassa per la stessa
 * strada (andata e ritorno) la posizione combacerebbe anche con il ritorno, e
 * il navigatore salterebbe avanti di chilometri. Si tiene un margine
 * all'indietro perché il GPS oscilla.
 */
export function proiettaSulPercorso(
  percorso: PercorsoGuidato,
  posizione: Coordinate,
  daM = 0,
): Proiezione {
  const { punti, progressive } = percorso;
  const primo = punti[0];
  if (!primo) return { progressivaM: 0, scostamentoM: Infinity };

  // Proiezione piana locale: su qualche centinaio di metri l'errore è
  // trascurabile e i conti restano semplici.
  const metriPerGradoLat = 111_320;
  const metriPerGradoLng = 111_320 * Math.cos((posizione.lat * Math.PI) / 180);
  const inMetri = ([lat, lng]: [number, number]) => ({
    x: (lng - posizione.lng) * metriPerGradoLng,
    y: (lat - posizione.lat) * metriPerGradoLat,
  });

  let migliore: Proiezione = {
    progressivaM: 0,
    scostamentoM: distanzaEsatta(posizione, { lat: primo[0], lng: primo[1] }),
  };
  const limite = Math.max(0, daM - 50);

  for (let indice = 1; indice < punti.length; indice++) {
    const inizio = punti[indice - 1];
    const fine = punti[indice];
    const progressivaInizio = progressive[indice - 1] ?? 0;
    const progressivaFine = progressive[indice] ?? 0;
    if (!inizio || !fine || progressivaFine < limite) continue;

    const a = inMetri(inizio);
    const b = inMetri(fine);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lunghezza2 = dx * dx + dy * dy;
    // Frazione del segmento più vicina all'origine (la posizione).
    const t = lunghezza2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lunghezza2));
    const scostamento = Math.hypot(a.x + t * dx, a.y + t * dy);

    if (scostamento < migliore.scostamentoM) {
      migliore = {
        progressivaM: progressivaInizio + t * (progressivaFine - progressivaInizio),
        scostamentoM: scostamento,
      };
    }
  }

  return migliore;
}

/**
 * Oltre questa distanza dal tracciato si è fuori percorso. A piedi si sta
 * più vicini alla linea, ma in auto il GPS sbanda di più alle alte velocità.
 * Mai sotto l'incertezza del segnale: sarebbe solo rumore.
 */
export function sogliaFuoriPercorso(modalita: ModalitaViaggio, accuratezza: number): number {
  return Math.max(modalita === 'piedi' ? 40 : 60, accuratezza);
}

export type StatoGuida = {
  progressivaM: number;
  prossimaManovra: Manovra | null;
  /** Metri alla prossima manovra; null se non ci sono manovre. */
  allaManovraM: number | null;
  rimanenteM: number;
  rimanenteMin: number | null;
  fuoriPercorso: boolean;
};

export function statoGuida(
  percorso: PercorsoGuidato,
  posizione: Posizione,
  modalita: ModalitaViaggio,
  daM = 0,
): StatoGuida {
  const { progressivaM, scostamentoM } = proiettaSulPercorso(percorso, posizione, daM);

  // Una manovra si considera fatta poco prima di raggiungerla: con l'incertezza
  // del GPS "a 3 metri dalla svolta" è già girare.
  const prossimaManovra =
    percorso.manovre.find(
      (manovra) => manovra.tipo !== 'partenza' && manovra.progressivaM > progressivaM + 8,
    ) ??
    percorso.manovre.find((manovra) => manovra.tipo === 'arrivo') ??
    null;

  const rimanenteM = Math.max(0, percorso.lunghezzaM - progressivaM);

  return {
    progressivaM,
    prossimaManovra,
    allaManovraM: prossimaManovra ? Math.max(0, prossimaManovra.progressivaM - progressivaM) : null,
    rimanenteM,
    rimanenteMin:
      percorso.durataMin !== null && percorso.lunghezzaM > 0
        ? Math.max(1, Math.round((percorso.durataMin * rimanenteM) / percorso.lunghezzaM))
        : null,
    // Il percorso stimato è una linea retta: allontanarsene è normale.
    fuoriPercorso:
      !percorso.stimato && scostamentoM > sogliaFuoriPercorso(modalita, posizione.accuratezza),
  };
}

const DIREZIONI: Record<NonNullable<Manovra['direzione']>, string> = {
  sinistra: 'Gira a sinistra',
  destra: 'Gira a destra',
  'leggermente-sinistra': 'Tieni la sinistra',
  'leggermente-destra': 'Tieni la destra',
  'nettamente-sinistra': 'Svolta decisamente a sinistra',
  'nettamente-destra': 'Svolta decisamente a destra',
  dritto: 'Prosegui dritto',
};

/** Testo italiano della manovra: "Gira a destra in Via del Corso". */
export function testoManovra(manovra: Manovra): string {
  const strada = manovra.strada.trim();

  switch (manovra.tipo) {
    case 'arrivo':
      return 'Arrivo alla tappa';
    case 'partenza':
      return strada ? `Parti in ${strada}` : 'Parti';
    case 'inversione':
      return 'Fai inversione';
    case 'rotonda': {
      const base =
        manovra.uscita !== null
          ? `Alla rotonda prendi la ${String(manovra.uscita)}ª uscita`
          : 'Entra nella rotonda';
      return strada ? `${base} verso ${strada}` : base;
    }
    case 'prosegui':
      return strada ? `Prosegui su ${strada}` : 'Prosegui dritto';
    case 'svolta': {
      const base = DIREZIONI[manovra.direzione ?? 'dritto'];
      return strada ? `${base} in ${strada}` : base;
    }
  }
}

/**
 * Da quale tappa guidare: la prima non ancora raggiunta che abbia coordinate.
 * Finite le tappe, se la giornata prevede il rientro, si torna alla partenza.
 */
export function destinazioneGuida(
  tappe: readonly Stop[],
  rientro: boolean,
): { tappa: Stop & Coordinate; rientro: boolean } | null {
  const conCoordinate = (tappa: Stop): tappa is Stop & Coordinate =>
    tappa.lat !== null && tappa.lng !== null;

  const prossima = tappe.find((tappa) => tappa.reached_at === null && conCoordinate(tappa));
  if (prossima && conCoordinate(prossima)) return { tappa: prossima, rientro: false };

  // Il rientro ha senso solo se la giornata ha davvero delle tappe oltre la partenza.
  const partenza = tappe[0];
  if (rientro && tappe.length > 1 && partenza && conCoordinate(partenza)) {
    return { tappa: partenza, rientro: true };
  }
  return null;
}

/** Vero quando si è abbastanza vicini da considerare concluso il rientro. */
export function rientroCompletato(partenza: Coordinate, posizione: Posizione): boolean {
  return distanzaMetri(posizione, partenza) <= Math.max(75, Math.min(posizione.accuratezza, 120));
}

/**
 * Collegamento per aprire la destinazione nel navigatore del telefono.
 * Il formato universale di Google Maps apre l'app se installata, altrimenti il
 * sito: funziona su Android, iPhone e computer.
 */
export function linkGoogleMaps(destinazione: Coordinate, modalita: ModalitaViaggio): string {
  const parametri = new URLSearchParams({
    api: '1',
    destination: `${String(destinazione.lat)},${String(destinazione.lng)}`,
    travelmode: modalita === 'piedi' ? 'walking' : 'driving',
  });
  return `https://www.google.com/maps/dir/?${parametri.toString()}`;
}

/** Mappe di Apple: su iPhone apre l'app installata di serie. */
export function linkAppleMaps(destinazione: Coordinate, modalita: ModalitaViaggio): string {
  const parametri = new URLSearchParams({
    daddr: `${String(destinazione.lat)},${String(destinazione.lng)}`,
    dirflg: modalita === 'piedi' ? 'w' : 'd',
  });
  return `https://maps.apple.com/?${parametri.toString()}`;
}

export function dispositivoApple(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Macintosh/.test(userAgent);
}
