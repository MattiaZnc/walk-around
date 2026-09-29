import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Flag,
  Loader2,
  Navigation,
  RotateCw,
  TriangleAlert,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { Manovra, ModalitaViaggio } from '@/features/itinerary/api/percorsi.api';
import type { Navigazione } from '@/features/itinerary/api/use-navigazione';
import {
  dispositivoApple,
  linkAppleMaps,
  linkGoogleMaps,
  testoManovra,
} from '@/features/itinerary/lib/navigazione';
import {
  ACCURATEZZA_MASSIMA_METRI,
  distanzaLeggibile,
  type Coordinate,
  type Posizione,
} from '@/features/itinerary/lib/prossimita';
import { durata } from '@/lib/format';

type Props = {
  navigazione: Navigazione;
  destinazione: { etichetta: string; coordinate: Coordinate };
  modalita: ModalitaViaggio;
  posizione: Posizione | null;
  onTermina: () => void;
};

function iconaManovra(manovra: Manovra | null): LucideIcon {
  if (!manovra) return Navigation;
  switch (manovra.tipo) {
    case 'arrivo':
      return Flag;
    case 'rotonda':
      return RotateCw;
    case 'inversione':
      return Undo2;
    case 'svolta':
      if (manovra.direzione === 'sinistra' || manovra.direzione === 'nettamente-sinistra') {
        return CornerUpLeft;
      }
      if (manovra.direzione === 'destra' || manovra.direzione === 'nettamente-destra') {
        return CornerUpRight;
      }
      if (manovra.direzione === 'leggermente-sinistra') return ArrowUpLeft;
      if (manovra.direzione === 'leggermente-destra') return ArrowUpRight;
      return ArrowUp;
    default:
      return ArrowUp;
  }
}

/** Collegamenti al navigatore del telefono: stessi in guida e fuori. */
export function ApriInMappe({
  destinazione,
  modalita,
}: {
  destinazione: Coordinate;
  modalita: ModalitaViaggio;
}) {
  const apple = typeof navigator !== 'undefined' && dispositivoApple(navigator.userAgent);

  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <a href={linkGoogleMaps(destinazione, modalita)} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden />
          Google Maps
        </a>
      </Button>
      {apple ? (
        <Button variant="outline" size="sm" asChild>
          <a href={linkAppleMaps(destinazione, modalita)} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden />
            Mappe Apple
          </a>
        </Button>
      ) : null}
    </>
  );
}

/**
 * Indicazioni del navigatore: la prossima manovra in grande, leggibile a
 * colpo d'occhio camminando, e sotto quanto manca alla tappa.
 */
export function PannelloGuida({
  navigazione,
  destinazione,
  modalita,
  posizione,
  onTermina,
}: Props) {
  const { percorso, stato, calcolo, errore } = navigazione;
  const manovra = stato?.prossimaManovra ?? null;
  const Icona = iconaManovra(manovra);
  const segnaleDebole = posizione !== null && posizione.accuratezza > ACCURATEZZA_MASSIMA_METRI;

  let principale: React.ReactNode;
  if (!posizione) {
    principale = <p className="text-muted-foreground">In attesa della posizione…</p>;
  } else if (!percorso && errore) {
    principale = (
      <p className="flex items-start gap-2 text-warning">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Percorso non disponibile: {errore} Riprovo fra poco, intanto puoi aprire Google Maps.
      </p>
    );
  } else if (!percorso || !stato) {
    principale = (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Calcolo del percorso…
      </p>
    );
  } else if (manovra && stato.allaManovraM !== null) {
    principale = (
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white">
          <Icona className="size-7" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="tabular text-2xl font-semibold leading-tight">
            {distanzaLeggibile(stato.allaManovraM)}
          </p>
          <p className="font-medium leading-snug">{testoManovra(manovra)}</p>
        </div>
      </div>
    );
  } else {
    // Nessuna manovra: percorso stimato, o Edge Function di una versione che
    // non restituisce ancora le indicazioni.
    principale = (
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white">
          <Navigation className="size-6" aria-hidden />
        </span>
        <p className="font-medium leading-snug">
          {percorso.stimato
            ? 'Percorso in linea d’aria: segui la direzione sulla mappa.'
            : 'Segui la linea blu sulla mappa.'}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Navigatore"
      className="space-y-3 rounded-xl border-2 border-[#2563eb]/40 bg-card p-3 shadow-sm"
    >
      <div role="status" aria-live="polite" aria-atomic>
        {principale}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <p className="min-w-0">
          <span className="text-muted-foreground">Verso </span>
          <strong className="break-words">{destinazione.etichetta}</strong>
        </p>
        {stato ? (
          <p className="tabular whitespace-nowrap text-muted-foreground">
            {distanzaLeggibile(stato.rimanenteM)}
            {stato.rimanenteMin !== null ? ` · ${durata(stato.rimanenteMin)}` : ''}
          </p>
        ) : null}
      </div>

      {calcolo && percorso ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Sei fuori percorso: ricalcolo…
        </p>
      ) : null}

      {segnaleDebole ? (
        <p className="flex items-start gap-2 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Segnale GPS debole (±{distanzaLeggibile(posizione.accuratezza)}): le indicazioni
          potrebbero essere in ritardo.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ApriInMappe destinazione={destinazione.coordinate} modalita={modalita} />
        <Button variant="ghost" size="sm" onClick={onTermina} className="ml-auto">
          <X aria-hidden />
          Termina
        </Button>
      </div>
    </section>
  );
}
