import { AlertTriangle, Route } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { TotaliGiornataCalcolati } from '@/features/itinerary/lib/sequenza';
import { durata, km } from '@/lib/format';

type Props = {
  totali: TotaliGiornataCalcolati;
  numeroTappe: number;
};

/**
 * Totale della giornata.
 *
 * Su telefono resta appoggiato in basso, sopra la barra di navigazione, e
 * deve stare in una riga: nella prima versione i badge andavano a capo e il
 * riquadro occupava un terzo dello schermo, coprendo le tappe che doveva
 * riassumere. Tratte manuali e stimate sono segnalate già sulle tratte stesse,
 * quindi qui compaiono solo da tablet in su; resta sempre visibile solo
 * l'avviso che cambia il significato del totale: mancano dei chilometri.
 */
export function RiepilogoGiornata({ totali, numeroTappe }: Props) {
  return (
    <section
      aria-label="Totale della giornata"
      className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.15)] backdrop-blur md:static md:inset-auto md:rounded-lg md:border md:shadow-none"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 md:py-3">
        <Route className="size-5 shrink-0 text-primary" aria-hidden />

        <p className="flex min-w-0 items-baseline gap-2">
          <span className="tabular text-xl font-semibold leading-none sm:text-2xl">
            {km(totali.km)}
          </span>
          <span className="truncate text-xs text-muted-foreground sm:text-sm">
            {totali.minuti !== null ? `${durata(totali.minuti)} · ` : ''}
            {numeroTappe === 1 ? '1 tappa' : `${numeroTappe} tappe`}
          </span>
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {totali.tratteMancanti > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 whitespace-nowrap border-warning text-warning"
              title="Il totale non comprende queste tratte"
            >
              <AlertTriangle className="size-3" aria-hidden />
              {totali.tratteMancanti} senza km
            </Badge>
          ) : null}
          {totali.tratteStimate > 0 ? (
            <Badge variant="warning" className="hidden whitespace-nowrap sm:inline-flex">
              {totali.tratteStimate === 1 ? '1 stimata' : `${totali.tratteStimate} stimate`}
            </Badge>
          ) : null}
          {totali.tratteManuali > 0 ? (
            <Badge variant="secondary" className="hidden whitespace-nowrap sm:inline-flex">
              {totali.tratteManuali === 1 ? '1 manuale' : `${totali.tratteManuali} manuali`}
            </Badge>
          ) : null}
        </div>
      </div>
    </section>
  );
}
