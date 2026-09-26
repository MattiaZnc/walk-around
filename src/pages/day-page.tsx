import { addDays, isValid } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { DettaglioGiornata } from '@/features/itinerary/components/dettaglio-giornata';
import { dataDaISO, dataLunga, isoDaData, oggiISO } from '@/lib/format';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

const FORMATO_ATTESO = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(valore: string | undefined): valore is string {
  if (!valore || !FORMATO_ATTESO.test(valore)) return false;
  return isValid(dataDaISO(valore));
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  useTitoloPagina(dataValida(date) ? dataLunga(date) : 'Giorno non valido');

  if (!dataValida(date)) {
    return (
      <div className="container max-w-md space-y-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Data non valida</h1>
        <p className="text-sm text-muted-foreground">
          L’indirizzo deve contenere una data nel formato <code>AAAA-MM-GG</code>.
        </p>
        <Button asChild>
          <Link to={`/day/${oggiISO()}`}>Vai a oggi</Link>
        </Button>
      </div>
    );
  }

  const giorno = dataDaISO(date);
  const precedente = isoDaData(addDays(giorno, -1));
  const successivo = isoDaData(addDays(giorno, 1));
  const oggi = oggiISO();

  return (
    <div className="container max-w-3xl py-4 sm:py-6">
      <header className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void navigate(`/day/${precedente}`);
            }}
            aria-label={`Giorno precedente, ${dataLunga(precedente)}`}
          >
            <ChevronLeft aria-hidden />
          </Button>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-lg font-semibold capitalize sm:text-2xl">
              {dataLunga(date)}
            </h1>
            {date !== oggi ? (
              <Button variant="link" asChild className="h-auto p-0 text-xs">
                <Link to={`/day/${oggi}`}>Torna a oggi</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Oggi</p>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void navigate(`/day/${successivo}`);
            }}
            aria-label={`Giorno successivo, ${dataLunga(successivo)}`}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        {/* Selettore data: permette di saltare a giorni lontani */}
        <div className="flex items-center justify-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <label htmlFor="scelta-data" className="sr-only">
            Vai a una data
          </label>
          <input
            id="scelta-data"
            type="date"
            value={date}
            onChange={(evento) => {
              if (evento.target.value) void navigate(`/day/${evento.target.value}`);
            }}
            className="min-h-touch rounded-md border border-input bg-background px-3 text-sm sm:h-9 sm:min-h-0"
          />
        </div>
      </header>

      <DettaglioGiornata key={date} data={date} />
    </div>
  );
}
