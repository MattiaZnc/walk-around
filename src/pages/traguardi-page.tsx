import { AlertCircle, Trophy } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressi } from '@/features/traguardi/api/use-traguardi';
import { BadgeTraguardo } from '@/features/traguardi/components/badge-traguardo';
import { statoTraguardi, TRAGUARDI } from '@/features/traguardi/lib/traguardi';
import { km, numero } from '@/lib/format';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

export default function TraguardiPage() {
  useTitoloPagina('Traguardi');
  const progressiQuery = useProgressi();

  const stati = useMemo(
    () => (progressiQuery.data ? statoTraguardi(progressiQuery.data) : []),
    [progressiQuery.data],
  );
  const ottenuti = stati.filter((stato) => stato.ottenuto).length;

  return (
    <div className="container max-w-3xl space-y-5 py-4 sm:py-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Trophy className="size-6 text-primary" aria-hidden />
          Traguardi
        </h1>
        <p className="text-sm text-muted-foreground">
          Contano le tappe raggiunte e i chilometri percorsi: quelli delle giornate passate e, per
          oggi, fino all’ultima tappa raggiunta.
        </p>
      </header>

      {progressiQuery.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <span className="sr-only">Caricamento dei traguardi…</span>
        </div>
      ) : null}

      {progressiQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>Impossibile caricare i traguardi</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{progressiQuery.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void progressiQuery.refetch();
              }}
            >
              Riprova
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {progressiQuery.data ? (
        <>
          <section
            aria-label="I tuoi totali"
            className="grid grid-cols-3 divide-x rounded-xl border bg-card text-center"
          >
            <div className="p-3">
              <p className="tabular text-xl font-semibold sm:text-2xl">
                {numero(progressiQuery.data.tappe)}
              </p>
              <p className="text-xs text-muted-foreground">tappe</p>
            </div>
            <div className="p-3">
              <p className="tabular whitespace-nowrap text-xl font-semibold sm:text-2xl">
                {km(progressiQuery.data.km)}
              </p>
              <p className="text-xs text-muted-foreground">percorsi</p>
            </div>
            <div className="p-3">
              <p className="tabular text-xl font-semibold sm:text-2xl">
                {ottenuti}/{TRAGUARDI.length}
              </p>
              <p className="text-xs text-muted-foreground">traguardi</p>
            </div>
          </section>

          <section aria-labelledby="titolo-tappe" className="space-y-3">
            <h2 id="titolo-tappe" className="font-semibold">
              Tappe raggiunte
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stati
                .filter((stato) => stato.categoria === 'tappe')
                .map((stato) => (
                  <BadgeTraguardo key={stato.id} stato={stato} />
                ))}
            </ul>
          </section>

          <section aria-labelledby="titolo-km" className="space-y-3">
            <h2 id="titolo-km" className="font-semibold">
              Chilometri percorsi
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stati
                .filter((stato) => stato.categoria === 'km')
                .map((stato) => (
                  <BadgeTraguardo key={stato.id} stato={stato} />
                ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
