import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { RiepilogoPeriodo } from '@/features/itinerary/api/totali.api';
import { durata, km } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  etichetta: string;
  riepilogo: RiepilogoPeriodo;
  /** In evidenza: usato per il periodo principale della schermata. */
  primario?: boolean;
  className?: string;
};

/**
 * Riquadro con i totali di un periodo.
 * I giorni incompleti sono segnalati perché un totale a cui mancano delle
 * tratte è più fuorviante di un totale assente: serve sapere che è parziale.
 */
export function RiepilogoPeriodoRiquadro({ etichetta, riepilogo, primario, className }: Props) {
  return (
    // Region etichettata: i chilometri compaiono anche nelle righe dei giorni,
    // quindi serve un modo per indicare di quale periodo si sta parlando.
    <section
      aria-label={etichetta}
      className={cn('rounded-lg border bg-card p-4', primario && 'bg-primary/5', className)}
    >
      <p className="text-sm text-muted-foreground">{etichetta}</p>

      <p
        className={cn(
          'tabular mt-1 font-semibold leading-none',
          primario ? 'text-3xl' : 'text-2xl',
        )}
      >
        {km(riepilogo.km)}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        {riepilogo.giorni === 1 ? '1 giornata' : `${riepilogo.giorni} giornate`}
        {riepilogo.minuti > 0 ? ` · ${durata(riepilogo.minuti)}` : ''}
      </p>

      {riepilogo.giorniIncompleti > 0 ? (
        <Badge variant="outline" className="mt-2 gap-1 border-warning text-warning">
          <AlertTriangle className="size-3" aria-hidden />
          {riepilogo.giorniIncompleti === 1
            ? '1 giornata incompleta'
            : `${riepilogo.giorniIncompleti} giornate incomplete`}
        </Badge>
      ) : null}
    </section>
  );
}
