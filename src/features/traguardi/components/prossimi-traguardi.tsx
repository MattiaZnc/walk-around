import { ChevronRight, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useProgressi } from '@/features/traguardi/api/use-traguardi';
import { prossimoTraguardo, type StatoTraguardo } from '@/features/traguardi/lib/traguardi';
import { km, numero } from '@/lib/format';

function Riga({ stato }: { stato: StatoTraguardo }) {
  const quanto =
    stato.categoria === 'km'
      ? km(stato.mancante)
      : `${numero(stato.mancante)} ${stato.mancante === 1 ? 'tappa' : 'tappe'}`;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">{stato.titolo}</span>
        <span className="tabular shrink-0 text-xs text-muted-foreground">mancano {quanto}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stato.percentuale}
        aria-label={`${stato.titolo}: ${String(stato.percentuale)}%`}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${String(stato.percentuale)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * I prossimi due traguardi, uno per categoria, in dashboard.
 * Non occupa spazio finché i dati non ci sono: un segnaposto qui spingerebbe
 * giù l'elenco dei giorni, che è la ragione per cui si apre la schermata.
 */
export function ProssimiTraguardi() {
  const { data: progressi } = useProgressi();
  if (!progressi) return null;

  const prossimi = [
    prossimoTraguardo(progressi, 'tappe'),
    prossimoTraguardo(progressi, 'km'),
  ].filter((stato): stato is StatoTraguardo => stato !== null);

  return (
    <Link
      to="/traguardi"
      className="block rounded-xl border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
      aria-label="Prossimi traguardi: apri tutti i traguardi"
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Trophy className="size-4 text-primary" aria-hidden />
        Prossimi traguardi
        <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </p>

      {prossimi.length > 0 ? (
        <div className="space-y-2.5">
          {prossimi.map((stato) => (
            <Riga key={stato.id} stato={stato} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Li hai ottenuti tutti. Complimenti.</p>
      )}
    </Link>
  );
}
