import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { AlertCircle, Download, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { riepiloga } from '@/features/itinerary/api/totali.api';
import { NESSUN_GIORNO, useTotaliPeriodo } from '@/features/itinerary/api/use-totali';
import { RiepilogoPeriodoRiquadro } from '@/features/itinerary/components/riepilogo-periodo';
import {
  componiCsv,
  descrizioneEsportazione,
  nomeFileCsv,
  scaricaCsv,
} from '@/features/reports/lib/csv';
import { dataBreve, durata, giornoSettimana, isoDaData, km } from '@/lib/format';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

type Preset = { etichetta: string; da: string; a: string };

function presets(): Preset[] {
  const adesso = new Date();
  const mesePrecedente = subMonths(adesso, 1);

  return [
    {
      etichetta: 'Questo mese',
      da: isoDaData(startOfMonth(adesso)),
      a: isoDaData(endOfMonth(adesso)),
    },
    {
      etichetta: 'Mese scorso',
      da: isoDaData(startOfMonth(mesePrecedente)),
      a: isoDaData(endOfMonth(mesePrecedente)),
    },
    {
      etichetta: 'Ultimi 3 mesi',
      da: isoDaData(startOfMonth(subMonths(adesso, 2))),
      a: isoDaData(endOfMonth(adesso)),
    },
    {
      etichetta: "Quest'anno",
      da: isoDaData(startOfYear(adesso)),
      a: isoDaData(endOfYear(adesso)),
    },
  ];
}

export default function ReportsPage() {
  useTitoloPagina('Report');

  const intervalli = useMemo(presets, []);
  const predefinito = intervalli[0];
  const [da, setDa] = useState(predefinito?.da ?? '');
  const [a, setA] = useState(predefinito?.a ?? '');

  const intervalloValido = da !== '' && a !== '' && da <= a;
  const totaliQuery = useTotaliPeriodo(da, a, intervalloValido);
  const giorni = totaliQuery.data ?? NESSUN_GIORNO;
  const riepilogo = useMemo(() => riepiloga(giorni), [giorni]);

  const esporta = () => {
    if (giorni.length === 0) return;
    scaricaCsv(componiCsv(giorni), nomeFileCsv(da, a));
    toast.success('File CSV scaricato', {
      description: descrizioneEsportazione(da, a, giorni.length),
    });
  };

  return (
    <div className="container max-w-3xl space-y-4 py-4 sm:py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Report</h1>

      <Card>
        <CardHeader>
          <CardTitle>Periodo</CardTitle>
          <CardDescription>Per i rimborsi chilometrici.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {intervalli.map((intervallo) => {
              const attivo = intervallo.da === da && intervallo.a === a;
              return (
                <Button
                  key={intervallo.etichetta}
                  size="sm"
                  variant={attivo ? 'default' : 'outline'}
                  aria-pressed={attivo}
                  onClick={() => {
                    setDa(intervallo.da);
                    setA(intervallo.a);
                  }}
                >
                  {intervallo.etichetta}
                </Button>
              );
            })}
          </div>

          {/* Un campo per riga su telefono: le date affiancate costringono a zoom */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-da">Dal</Label>
              <input
                id="report-da"
                type="date"
                value={da}
                max={a || undefined}
                onChange={(evento) => {
                  setDa(evento.target.value);
                }}
                className="min-h-touch w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:min-h-0 sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-a">Al</Label>
              <input
                id="report-a"
                type="date"
                value={a}
                min={da || undefined}
                onChange={(evento) => {
                  setA(evento.target.value);
                }}
                className="min-h-touch w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:min-h-0 sm:text-sm"
              />
            </div>
          </div>

          {!intervalloValido && da !== '' && a !== '' ? (
            <p className="text-sm text-destructive" role="alert">
              La data iniziale deve precedere quella finale.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {intervalloValido ? (
        <>
          <RiepilogoPeriodoRiquadro
            etichetta={`Dal ${dataBreve(da)} al ${dataBreve(a)}`}
            riepilogo={riepilogo}
            primario
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={esporta} disabled={giorni.length === 0}>
              <Download aria-hidden />
              Esporta CSV
            </Button>
            {giorni.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {descrizioneEsportazione(da, a, giorni.length)}
              </p>
            ) : null}
          </div>

          {totaliQuery.isPending ? (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <span className="sr-only">Caricamento del report…</span>
            </div>
          ) : null}

          {totaliQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>Impossibile caricare il report</AlertTitle>
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
              <CardContent className="space-y-2 py-8 text-center">
                <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
                <p className="font-medium">Nessuna giornata nel periodo scelto</p>
                <p className="text-sm text-muted-foreground">Prova con un intervallo più ampio.</p>
              </CardContent>
            </Card>
          ) : null}

          {giorni.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Chilometri per giornata dal {dataBreve(da)} al {dataBreve(a)}
                </caption>
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Giorno
                    </th>
                    <th
                      scope="col"
                      className="hidden px-3 py-2 text-left font-medium sm:table-cell"
                    >
                      Mezzo
                    </th>
                    <th
                      scope="col"
                      className="hidden px-3 py-2 text-right font-medium sm:table-cell"
                    >
                      Tappe
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Durata
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Km
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...giorni]
                    .sort((primo, secondo) => primo.data.localeCompare(secondo.data))
                    .map((giorno) => (
                      <tr key={giorno.itineraryId} className="border-t">
                        <td className="px-3 py-2">
                          {/* Tutta la cella è il collegamento: su telefono un
                              bersaglio di tre parole era difficile da prendere. */}
                          <Link
                            to={`/day/${giorno.data}`}
                            className="-mx-3 -my-2 flex min-h-touch flex-col justify-center px-3 py-2 underline-offset-4 hover:underline sm:min-h-0"
                          >
                            <span className="whitespace-nowrap font-medium">
                              {dataBreve(giorno.data)}
                              <span className="ml-2 hidden text-xs font-normal capitalize text-muted-foreground sm:inline">
                                {giornoSettimana(giorno.data)}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden">
                              {giorno.modalita === 'piedi' ? 'a piedi' : 'in auto'} · {giorno.tappe}{' '}
                              tappe
                            </span>
                          </Link>
                        </td>
                        <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                          {giorno.modalita === 'piedi' ? 'a piedi' : 'in auto'}
                        </td>
                        <td className="tabular hidden px-3 py-2 text-right sm:table-cell">
                          {giorno.tappe}
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                          {giorno.minuti > 0 ? durata(giorno.minuti) : '—'}
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-2 text-right font-medium">
                          {km(giorno.km)}
                          {giorno.tratteStimate > 0 ? (
                            <span
                              className="ml-1 text-warning"
                              title="Contiene tratte stimate"
                              aria-label="contiene tratte stimate"
                            >
                              *
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Totale</td>
                    <td className="hidden sm:table-cell" />
                    <td className="tabular hidden px-3 py-2 text-right sm:table-cell">
                      {riepilogo.tappe}
                    </td>
                    <td className="tabular whitespace-nowrap px-3 py-2 text-right">
                      {riepilogo.minuti > 0 ? durata(riepilogo.minuti) : '—'}
                    </td>
                    <td className="tabular whitespace-nowrap px-3 py-2 text-right">
                      {km(riepilogo.km)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {giorni.some((giorno) => giorno.tratteStimate > 0) ? (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  <span className="text-warning">*</span> contiene tratte stimate, non percorsi
                  reali
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
