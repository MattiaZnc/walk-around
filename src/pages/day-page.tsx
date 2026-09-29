import { addDays, isValid } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { DettaglioGiornata } from '@/features/itinerary/components/dettaglio-giornata';
import { annoCorrente, dataDaISO, dataLunga, dataSenzaAnno, isoDaData, oggiISO } from '@/lib/format';
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
    <div className="container max-w-3xl py-3 sm:py-6">
      {/* Intestazione compatta: su telefono ogni riga in alto è una riga di
          tappe in meno. Il titolo stesso apre il calendario, quindi non serve
          un selettore di data separato. */}
      <header className="mb-3 flex items-center gap-1 sm:mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void navigate(`/day/${precedente}`);
          }}
          aria-label={`Giorno precedente, ${dataLunga(precedente)}`}
        >
          <ChevronLeft aria-hidden />
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <label className="relative inline-flex min-h-touch max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 hover:bg-accent focus-within:ring-2 focus-within:ring-ring sm:min-h-0 sm:py-1">
            <h1 className="truncate text-base font-semibold capitalize sm:text-xl">
              {annoCorrente(date) ? dataSenzaAnno(date) : dataLunga(date)}
            </h1>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Scegli un altro giorno</span>
            {/* Input nativo invisibile sopra il titolo: il tocco apre il
                calendario del telefono, che è quello a cui l'utente è abituato. */}
            <input
              type="date"
              value={date}
              onChange={(evento) => {
                if (evento.target.value) void navigate(`/day/${evento.target.value}`);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          {date !== oggi ? (
            <Button variant="link" asChild className="h-auto p-0 text-xs">
              <Link to={`/day/${oggi}`}>Torna a oggi</Link>
            </Button>
          ) : (
            <p className="text-xs font-medium text-primary">Oggi</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void navigate(`/day/${successivo}`);
          }}
          aria-label={`Giorno successivo, ${dataLunga(successivo)}`}
        >
          <ChevronRight aria-hidden />
        </Button>
      </header>

      <DettaglioGiornata key={date} data={date} />
    </div>
  );
}
