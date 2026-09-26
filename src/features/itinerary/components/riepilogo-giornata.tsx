import { AlertTriangle, Route } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { TotaliGiornataCalcolati } from '@/features/itinerary/lib/sequenza';
import { durata, km } from '@/lib/format';

type Props = {
  totali: TotaliGiornataCalcolati;
  numeroTappe: number;
};

/**
 * Totale della giornata. Su telefono resta appoggiato in basso, sopra la
 * bottom navigation: il numero che conta deve stare sempre sotto gli occhi.
 */
export function RiepilogoGiornata({ totali, numeroTappe }: Props) {
  return (
    <section
      aria-label="Totale della giornata"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-y bg-background/95 backdrop-blur md:static md:inset-auto md:rounded-lg md:border"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
        <Route className="size-5 shrink-0 text-primary" aria-hidden />

        <p className="flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold leading-none">{km(totali.km)}</span>
          {totali.minuti !== null ? (
            <span className="tabular text-sm text-muted-foreground">{durata(totali.minuti)}</span>
          ) : null}
        </p>

        <p className="text-sm text-muted-foreground">
          {numeroTappe === 1 ? '1 tappa' : `${numeroTappe} tappe`}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {totali.tratteMancanti > 0 ? (
            <Badge variant="outline" className="gap-1 border-warning text-warning">
              <AlertTriangle className="size-3" aria-hidden />
              {totali.tratteMancanti === 1
                ? '1 tratta senza km'
                : `${totali.tratteMancanti} tratte senza km`}
            </Badge>
          ) : null}
          {totali.tratteStimate > 0 ? (
            <Badge variant="warning">
              {totali.tratteStimate === 1 ? '1 stimata' : `${totali.tratteStimate} stimate`}
            </Badge>
          ) : null}
          {totali.tratteManuali > 0 ? (
            <Badge variant="secondary">
              {totali.tratteManuali === 1 ? '1 manuale' : `${totali.tratteManuali} manuali`}
            </Badge>
          ) : null}
        </div>
      </div>
    </section>
  );
}
