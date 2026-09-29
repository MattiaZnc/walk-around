import * as React from 'react';

import {
  calcolaPercorsoGuidato,
  type ModalitaViaggio,
} from '@/features/itinerary/api/percorsi.api';
import {
  preparaPercorso,
  statoGuida,
  type PercorsoGuidato,
  type StatoGuida,
} from '@/features/itinerary/lib/navigazione';
import {
  ACCURATEZZA_MASSIMA_METRI,
  type Coordinate,
  type Posizione,
} from '@/features/itinerary/lib/prossimita';
import { toAppError } from '@/lib/errors';

type Destinazione = Coordinate & { id: string };

type Opzioni = {
  attiva: boolean;
  destinazione: Destinazione | null;
  posizione: Posizione | null;
  modalita: ModalitaViaggio;
};

export type Navigazione = {
  percorso: PercorsoGuidato | null;
  stato: StatoGuida | null;
  /** true mentre si calcola (o ricalcola) il percorso. */
  calcolo: boolean;
  errore: string | null;
};

/** Rilevamenti fuori percorso di fila prima di ricalcolare: uno solo può essere un salto del GPS. */
const FUORI_PERCORSO_PER_RICALCOLO = 3;
/** Pausa minima fra due richieste: il servizio di percorsi è pubblico e gratuito. */
const PAUSA_FRA_RICHIESTE_MS = 10_000;
/** Dopo un errore si riprova con calma, al prossimo rilevamento utile. */
const PAUSA_DOPO_ERRORE_MS = 20_000;

function chiaveDi(destinazione: Destinazione, modalita: ModalitaViaggio): string {
  return `${destinazione.id}:${modalita}:${String(destinazione.lat)},${String(destinazione.lng)}`;
}

/**
 * Guida verso `destinazione` dalla posizione corrente.
 *
 * Il percorso si chiede una volta sola e si segue sul telefono: la rete serve
 * di nuovo solo se cambia la destinazione o si esce di strada.
 */
export function useNavigazione({
  attiva,
  destinazione,
  posizione,
  modalita,
}: Opzioni): Navigazione {
  const [calcolato, setCalcolato] = React.useState<{
    chiave: string;
    percorso: PercorsoGuidato;
  } | null>(null);
  const [stato, setStato] = React.useState<{ chiave: string; stato: StatoGuida } | null>(null);
  const [calcolo, setCalcolo] = React.useState(false);
  const [errore, setErrore] = React.useState<string | null>(null);

  const ultimaRichiesta = React.useRef(0);
  const richiestaCorrente = React.useRef(0);
  const inCorso = React.useRef(false);
  const fuoriDiFila = React.useRef(0);
  const progressiva = React.useRef(0);

  const chiave = attiva && destinazione ? chiaveDi(destinazione, modalita) : null;

  // Spegnendo il navigatore si dimentica tutto: alla riaccensione si riparte
  // dalla posizione di quel momento.
  React.useEffect(() => {
    if (chiave !== null) return;
    richiestaCorrente.current += 1;
    inCorso.current = false;
    setCalcolato(null);
    setStato(null);
    setCalcolo(false);
    setErrore(null);
  }, [chiave]);

  React.useEffect(() => {
    if (chiave === null || !destinazione || !posizione) return;
    // Con un segnale così vago non si calcola né si giudica lo scostamento.
    if (posizione.accuratezza > ACCURATEZZA_MASSIMA_METRI) return;

    const calcola = (da: Posizione) => {
      const numero = ++richiestaCorrente.current;
      inCorso.current = true;
      ultimaRichiesta.current = Date.now();
      setCalcolo(true);

      calcolaPercorsoGuidato(
        { lat: da.lat, lng: da.lng },
        { lat: destinazione.lat, lng: destinazione.lng },
        modalita,
      )
        .then((tratto) => {
          if (numero !== richiestaCorrente.current) return;
          if (!tratto.geometry) throw new Error('Il servizio non ha restituito il percorso.');
          progressiva.current = 0;
          fuoriDiFila.current = 0;
          setCalcolato({
            chiave,
            percorso: preparaPercorso(
              tratto.geometry,
              tratto.manovre ?? [],
              tratto.durationMin,
              tratto.isEstimate,
            ),
          });
          setErrore(null);
        })
        .catch((problema: unknown) => {
          if (numero !== richiestaCorrente.current) return;
          setErrore(toAppError(problema).message);
        })
        .finally(() => {
          if (numero !== richiestaCorrente.current) return;
          inCorso.current = false;
          setCalcolo(false);
        });
    };

    const trascorso = Date.now() - ultimaRichiesta.current;

    if (calcolato?.chiave !== chiave) {
      // Destinazione nuova (tappa raggiunta, giro cambiato) o primo avvio.
      const pausa = errore ? PAUSA_DOPO_ERRORE_MS : 0;
      if (!inCorso.current && trascorso >= pausa) calcola(posizione);
      return;
    }

    const nuovo = statoGuida(calcolato.percorso, posizione, modalita, progressiva.current);
    progressiva.current = nuovo.progressivaM;
    setStato({ chiave, stato: nuovo });

    fuoriDiFila.current = nuovo.fuoriPercorso ? fuoriDiFila.current + 1 : 0;
    if (
      fuoriDiFila.current >= FUORI_PERCORSO_PER_RICALCOLO &&
      !inCorso.current &&
      trascorso >= PAUSA_FRA_RICHIESTE_MS
    ) {
      calcola(posizione);
    }
    // `destinazione` è rappresentata da `chiave`: l'oggetto cambia a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave, posizione, calcolato, modalita]);

  const percorsoAttuale = calcolato && calcolato.chiave === chiave ? calcolato.percorso : null;
  return {
    percorso: percorsoAttuale,
    stato: stato && stato.chiave === chiave && percorsoAttuale ? stato.stato : null,
    calcolo,
    errore,
  };
}
