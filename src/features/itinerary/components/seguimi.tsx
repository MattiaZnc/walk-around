import { LocateFixed, LocateOff, Navigation, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  distanzaLeggibile,
  prossimaTappa,
  valutaVicinanza,
  type Posizione,
} from '@/features/itinerary/lib/prossimita';
import { useGeolocalizzazione } from '@/lib/use-geolocalizzazione';
import { cn } from '@/lib/utils';
import type { Stop } from '@/types/models';

type Props = {
  tappe: Stop[];
  attivo: boolean;
  onCambioAttivo: (attivo: boolean) => void;
  /** Chiamata quando una o più tappe risultano raggiunte. */
  onArrivo: (tappe: Stop[]) => void;
  onPosizione: (posizione: Posizione | null) => void;
  /**
   * true quando il pulsante galleggia sopra la mappa (angolo in alto a
   * destra, libero dai controlli di Leaflet). Il contenitore deve essere
   * `relative`: lo stato del giro scorre invece sotto la mappa.
   */
  sovrapposto?: boolean;
  /** Pulsanti aggiuntivi nella scheda di stato (Guidami, Google Maps). */
  azioni?: React.ReactNode;
  /**
   * false nasconde la scheda di stato ma continua a seguire la posizione e a
   * segnalare gli arrivi: durante la guida la sostituisce il navigatore.
   */
  mostraStato?: boolean;
};

/**
 * Segue la posizione durante il giro e segnala l'arrivo alle tappe.
 *
 * Si attiva con un pulsante e non da sola: chiedere la posizione senza che
 * l'utente l'abbia chiesto è invadente, e il GPS acceso consuma batteria in
 * modo evidente.
 */
export function Seguimi({
  tappe,
  attivo,
  onCambioAttivo,
  onArrivo,
  onPosizione,
  sovrapposto = false,
  azioni,
  mostraStato = true,
}: Props) {
  const { posizione, errore, inAttesa, supportata } = useGeolocalizzazione(attivo);

  // Le tappe già segnalate non vengono riproposte: senza questo, restando nel
  // raggio si richiamerebbe onArrivo a ogni rilevamento.
  const giaSegnalate = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!attivo) giaSegnalate.current.clear();
  }, [attivo]);

  React.useEffect(() => {
    onPosizione(posizione);
  }, [posizione, onPosizione]);

  const esito = posizione ? valutaVicinanza(tappe, posizione) : null;

  React.useEffect(() => {
    if (!esito || esito.tipo !== 'arrivato') return;

    const nuove = esito.tappe
      .map((voce) => voce.tappa)
      .filter((tappa) => !giaSegnalate.current.has(tappa.id));

    if (nuove.length === 0) return;
    for (const tappa of nuove) giaSegnalate.current.add(tappa.id);
    onArrivo(nuove);
  }, [esito, onArrivo]);

  if (!supportata) {
    return (
      <p className="text-sm text-muted-foreground">
        Questo browser non può rilevare la posizione: le tappe si segnano a mano.
      </p>
    );
  }

  const prossima = prossimaTappa(tappe);

  return (
    <div className="space-y-2">
      <Button
        variant={attivo ? 'default' : 'outline'}
        onClick={() => {
          onCambioAttivo(!attivo);
        }}
        aria-pressed={attivo}
        className={cn(
          sovrapposto &&
            // Sopra la mappa serve un fondo pieno e un'ombra, altrimenti il
            // pulsante si confonde con le strade disegnate sotto.
            'absolute right-3 top-3 z-10 h-10 min-h-0 rounded-full px-4 shadow-md',
          sovrapposto && !attivo && 'bg-background',
        )}
      >
        {attivo ? <LocateFixed aria-hidden /> : <LocateOff aria-hidden />}
        {attivo ? 'Seguimi attivo' : 'Seguimi'}
      </Button>

      {attivo && mostraStato ? (
        <div className="space-y-3 rounded-md border bg-card p-3 text-sm">
          <div role="status" aria-live="polite">
            {errore ? (
              <p className="flex items-start gap-2 text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {errore}
              </p>
            ) : inAttesa ? (
              <p className="text-muted-foreground">Ricerca della posizione…</p>
            ) : esito?.tipo === 'posizione-imprecisa' ? (
              <p className="flex items-start gap-2 text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Posizione imprecisa (±{distanzaLeggibile(esito.accuratezza)}): le tappe non vengono
                segnate da sole.
              </p>
            ) : prossima ? (
              <p className="flex items-center gap-2">
                <Navigation className="size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Prossima tappa: <strong>{prossima.label}</strong>
                  {esito?.tipo === 'nessuna-tappa-vicina' && esito.piuVicina ? (
                    <span className={cn('tabular ml-1 text-muted-foreground')}>
                      a {distanzaLeggibile(esito.piuVicina.metri)}
                    </span>
                  ) : null}
                </span>
              </p>
            ) : (
              <p className="font-medium text-primary">Tutte le tappe sono state raggiunte.</p>
            )}

            {posizione && !errore ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Precisione del segnale: ±{distanzaLeggibile(posizione.accuratezza)}
              </p>
            ) : null}
          </div>

          {azioni ? <div className="flex flex-wrap gap-2">{azioni}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
