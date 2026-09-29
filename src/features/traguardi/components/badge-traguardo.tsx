import { Footprints, Lock, MapPin } from 'lucide-react';

import type { StatoTraguardo } from '@/features/traguardi/lib/traguardi';
import { km, numero } from '@/lib/format';
import { cn } from '@/lib/utils';

function quantita(stato: StatoTraguardo, valore: number): string {
  // Un decimale, come in tutto il resto dell'app.
  if (stato.categoria === 'km') return km(valore);
  return valore === 1 ? '1 tappa' : `${numero(valore)} tappe`;
}

/**
 * Un traguardo: ottenuto a colori, da ottenere in grigio con l'avanzamento.
 * La barra dice quanto manca, che è l'informazione che fa venire voglia di
 * continuare; un lucchetto da solo direbbe solo "non ancora".
 */
export function BadgeTraguardo({ stato }: { stato: StatoTraguardo }) {
  const Icona = stato.categoria === 'km' ? Footprints : MapPin;

  return (
    <li
      className={cn(
        'flex flex-col items-center rounded-xl border p-3 text-center transition-colors',
        stato.ottenuto ? 'border-reached-border bg-reached' : 'bg-card',
      )}
    >
      <span
        className={cn(
          'relative flex size-14 items-center justify-center rounded-full',
          stato.ottenuto
            ? 'bg-reached-foreground text-reached shadow-sm'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icona className="size-6" />
        {!stato.ottenuto ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border bg-background">
            <Lock className="size-3" />
          </span>
        ) : null}
      </span>

      <p
        className={cn(
          'mt-2 text-sm font-semibold leading-tight',
          !stato.ottenuto && 'text-muted-foreground',
        )}
      >
        {stato.titolo}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{stato.descrizione}</p>

      {stato.ottenuto ? (
        <p className="mt-2 text-xs font-medium text-reached-foreground">Ottenuto</p>
      ) : (
        <div className="mt-2 w-full">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stato.percentuale}
            aria-label={`${stato.titolo}: ${String(stato.percentuale)}%`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${String(stato.percentuale)}%` }}
            />
          </div>
          <p className="tabular mt-1 text-[11px] text-muted-foreground">
            mancano {quantita(stato, stato.mancante)}
          </p>
        </div>
      )}
    </li>
  );
}
