import { addDays } from 'date-fns';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dataBreve, isoDaData, oggiISO } from '@/lib/format';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

/**
 * Versione provvisoria: serve solo per raggiungere le giornate.
 * Il calendario con i totali per giorno, settimana e mese arriva nella Fase 5.
 */
export default function DashboardPage() {
  useTitoloPagina('Giorni');
  const navigate = useNavigate();
  const oggi = oggiISO();
  const [dataScelta, setDataScelta] = useState(oggi);

  const prossimiGiorni = Array.from({ length: 7 }, (_, scostamento) =>
    isoDaData(addDays(new Date(), scostamento)),
  );

  return (
    <div className="container max-w-3xl space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Giorni</h1>

      <Card>
        <CardHeader>
          <CardTitle>Vai a una giornata</CardTitle>
          <CardDescription>Scegli una data per vedere o pianificare le tappe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="data-dashboard" className="sr-only">
              Data
            </label>
            <input
              id="data-dashboard"
              type="date"
              value={dataScelta}
              onChange={(evento) => {
                setDataScelta(evento.target.value);
              }}
              className="min-h-touch flex-1 rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:min-h-0 sm:text-sm"
            />
            <Button
              onClick={() => {
                void navigate(`/day/${dataScelta}`);
              }}
              disabled={dataScelta === ''}
            >
              Apri
              <ArrowRight aria-hidden />
            </Button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Prossimi giorni</p>
            <ul className="flex flex-wrap gap-2">
              {prossimiGiorni.map((giorno) => (
                <li key={giorno}>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/day/${giorno}`}>
                      <CalendarDays aria-hidden />
                      {giorno === oggi ? 'Oggi' : dataBreve(giorno)}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Calendario con i totali per giorno, settimana e mese: in arrivo nella Fase 5.
      </p>
    </div>
  );
}
