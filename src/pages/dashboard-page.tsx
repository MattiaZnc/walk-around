import { addMonths, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Car,
  Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { riepiloga, type TotaliGiorno } from '@/features/itinerary/api/totali.api';
import { NESSUN_GIORNO, useTotaliPeriodo } from '@/features/itinerary/api/use-totali';
import { RiepilogoPeriodoRiquadro } from '@/features/itinerary/components/riepilogo-periodo';
import { dataBreve, durata, giornoSettimana, isoDaData, km, meseAnno, oggiISO } from '@/lib/format';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

/** Settimana che inizia il lunedì, come si usa in Italia. */
const INIZIO_SETTIMANA = { weekStartsOn: 1 } as const;

export default function DashboardPage() {
  useTitoloPagina('Giorni');

  const [mese, setMese] = useState(() => startOfMonth(new Date()));
  const oggi = oggiISO();

  const primoGiorno = isoDaData(startOfMonth(mese));
  const ultimoGiorno = isoDaData(endOfMonth(mese));

  const totaliQuery = useTotaliPeriodo(primoGiorno, ultimoGiorno);
  const giorni = totaliQuery.data ?? NESSUN_GIORNO;

  const { riepilogoMese, riepilogoSettimana, settimanaNelMese } = useMemo(() => {
    const inizioSettimana = isoDaData(startOfWeek(new Date(), INIZIO_SETTIMANA));
    const fineSettimana = isoDaData(endOfWeek(new Date(), INIZIO_SETTIMANA));

    return {
      riepilogoMese: riepiloga(giorni),
      // La settimana corrente può cadere a cavallo di due mesi: dei giorni
      // caricati si prendono solo quelli che ci rientrano.
      riepilogoSettimana: riepiloga(
        giorni.filter((giorno) => giorno.data >= inizioSettimana && giorno.data <= fineSettimana),
      ),
      settimanaNelMese: isSameMonth(new Date(), mese),
    };
  }, [giorni, mese]);

  return (
    <div className="container max-w-3xl space-y-4 py-4 sm:py-6">
      <header className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setMese((corrente) => addMonths(corrente, -1));
          }}
          aria-label={`Mese precedente, ${meseAnno(addMonths(mese, -1))}`}
        >
          <ChevronLeft aria-hidden />
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg font-semibold capitalize sm:text-2xl">
            {meseAnno(mese)}
          </h1>
          {!isSameMonth(new Date(), mese) ? (
            <Button
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setMese(startOfMonth(new Date()));
              }}
            >
              Torna al mese corrente
            </Button>
          ) : null}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setMese((corrente) => addMonths(corrente, 1));
          }}
          aria-label={`Mese successivo, ${meseAnno(addMonths(mese, 1))}`}
        >
          <ChevronRight aria-hidden />
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <RiepilogoPeriodoRiquadro
          etichetta={`Totale ${meseAnno(mese)}`}
          riepilogo={riepilogoMese}
          primario
        />
        {settimanaNelMese ? (
          <RiepilogoPeriodoRiquadro etichetta="Questa settimana" riepilogo={riepilogoSettimana} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/day/${oggi}`}>
            <Plus aria-hidden />
            Pianifica oggi
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/report">Report ed export</Link>
        </Button>
      </div>

      {totaliQuery.isPending ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <span className="sr-only">Caricamento delle giornate…</span>
        </div>
      ) : null}

      {totaliQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>Impossibile caricare le giornate</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{totaliQuery.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void totaliQuery.refetch();
              }}
            >
              Riprova
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {totaliQuery.isSuccess && giorni.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Nessuna giornata in {meseAnno(mese)}</p>
            <p className="text-sm text-muted-foreground">
              Scegli un giorno e indica da dove parti: i chilometri si calcolano da lì.
            </p>
            <Button asChild>
              <Link to={`/day/${oggi}`}>Comincia da oggi</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {giorni.length > 0 ? (
        <ul className="space-y-2">
          {giorni.map((giorno) => (
            <li key={giorno.itineraryId}>
              <RigaGiorno giorno={giorno} oggi={oggi} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RigaGiorno({ giorno, oggi }: { giorno: TotaliGiorno; oggi: string }) {
  const tratteAttese = Math.max(0, giorno.tappe - 1) + (giorno.rientro && giorno.tappe > 1 ? 1 : 0);
  const incompleto = giorno.tratte < tratteAttese;

  return (
    <Link
      to={`/day/${giorno.data}`}
      className="flex min-h-touch items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="capitalize">{giornoSettimana(giorno.data)}</span>
          <span className="text-muted-foreground">{dataBreve(giorno.data)}</span>
          {giorno.data === oggi ? <Badge variant="secondary">oggi</Badge> : null}
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {giorno.modalita === 'piedi' ? (
              <Footprints className="size-3.5" aria-hidden />
            ) : (
              <Car className="size-3.5" aria-hidden />
            )}
            {giorno.modalita === 'piedi' ? 'a piedi' : 'in auto'}
          </span>
          <span>{giorno.tappe === 1 ? '1 tappa' : `${giorno.tappe} tappe`}</span>
          {giorno.minuti > 0 ? <span className="tabular">{durata(giorno.minuti)}</span> : null}
          {incompleto ? <span className="text-warning">tratte senza km</span> : null}
        </p>
      </div>

      <p className="tabular shrink-0 text-lg font-semibold">{km(giorno.km)}</p>
    </Link>
  );
}
