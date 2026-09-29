import { AlertTriangle } from 'lucide-react';

import type { RiepilogoPeriodo } from '@/features/itinerary/api/totali.api';
import { durata, km } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  etichetta: string;
  riepilogo: RiepilogoPeriodo;
  /** In evidenza: usato per il periodo principale della schermata. */
  primario?: boolean;
  /** Per stare in due colonne su telefono: testi più piccoli, avviso breve. */
  compatto?: boolean;
  className?: string;
};

/**
 * Riquadro con i totali di un periodo.
 * I giorni incompleti sono segnalati perché un totale a cui mancano delle
 * tratte è più fuorviante di un totale assente: serve sapere che è parziale.
 */
export function RiepilogoPeriodoRiquadro({
  etichetta,
  riepilogo,
  primario,
  compatto,
  className,
}: Props) {
  return (
    // Region etichettata: i chilometri compaiono anche nelle righe dei giorni,
    // quindi serve un modo per indicare di quale periodo si sta parlando.
    <section
      aria-label={etichetta}
      className={cn(
        'min-w-0 rounded-xl border bg-card',
        compatto ? 'p-3 sm:p-4' : 'p-4',
        primario && 'bg-primary/5',
        className,
      )}
    >
      <p className="truncate text-xs text-muted-foreground first-letter:uppercase sm:text-sm">
        {etichetta}
      </p>

      <p
        className={cn(
          'tabular mt-1 font-semibold leading-none',
          compatto ? 'text-2xl sm:text-3xl' : primario ? 'text-3xl' : 'text-2xl',
        )}
      >
        {km(riepilogo.km)}
      </p>

      <p className="mt-1.5 truncate text-xs text-muted-foreground">
        {riepilogo.giorni === 1 ? '1 giornata' : `${riepilogo.giorni} giornate`}
        {riepilogo.minuti > 0 ? ` · ${durata(riepilogo.minuti)}` : ''}
      </p>

      {riepilogo.giorniIncompleti > 0 ? (
        <p
          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-warning"
          title="Giornate con tratte ancora senza chilometri"
        >
          <AlertTriangle className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {compatto
              ? `${riepilogo.giorniIncompleti} incomplet${riepilogo.giorniIncompleti === 1 ? 'a' : 'e'}`
              : riepilogo.giorniIncompleti === 1
                ? '1 giornata incompleta'
                : `${riepilogo.giorniIncompleti} giornate incomplete`}
          </span>
        </p>
      ) : null}
    </section>
  );
}
