import { AlertCircle, Copy, Flag, Plus, RefreshCw, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PannelloResponsive } from '@/components/ui/pannello-responsive';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  MODALITA,
  modalitaValida,
  type Coordinate,
  type ModalitaViaggio,
} from '@/features/itinerary/api/percorsi.api';
import { useGiornata, vistaGiornata } from '@/features/itinerary/api/use-giornata';
import { tratteDaCalcolare, useRicalcolaTratte } from '@/features/itinerary/api/use-ricalcolo';
import {
  useAggiornaTappa,
  useCreaTappa,
  useEliminaTappa,
  useRiordinaTappe,
} from '@/features/itinerary/api/use-mutazioni-tappe';
import {
  useAggiornaGiornata,
  useDuplicaGiornata,
  useEliminaGiornata,
  useEliminaTratta,
  useSalvaTrattaManuale,
} from '@/features/itinerary/api/use-mutazioni-tratte';
import { DialogoDuplica } from '@/features/itinerary/components/dialogo-duplica';
import { ElencoTappe } from '@/features/itinerary/components/elenco-tappe';
import { FormTappa } from '@/features/itinerary/components/form-tappa';
import { MappaGiornata } from '@/features/itinerary/components/mappa-giornata';
import { RiepilogoGiornata } from '@/features/itinerary/components/riepilogo-giornata';
import {
  SceltaPartenza,
  type PartenzaScelta,
} from '@/features/itinerary/components/scelta-partenza';
import type { TappaInput, TrattaInput } from '@/features/itinerary/schemas/itinerary.schemas';
import { puntoDiPartenza, useProfilo } from '@/features/profile/api/use-profilo';
import { dataLunga } from '@/lib/format';
import type { Stop } from '@/types/models';

type StatoPannello =
  | { tipo: 'chiuso' }
  | { tipo: 'nuova'; posizione?: number; iniziali?: Partial<TappaInput> }
  | { tipo: 'modifica'; tappa: Stop }
  /** Sostituzione del punto di partenza di una giornata che ne ha già uno. */
  | { tipo: 'partenza' };

function messaggioRicalcolo(tratteInvalidate: number): string | null {
  if (tratteInvalidate === 0) return null;
  return tratteInvalidate === 1
    ? '1 tratta da ricalcolare'
    : `${tratteInvalidate} tratte da ricalcolare`;
}

export function DettaglioGiornata({ data }: { data: string }) {
  const navigate = useNavigate();
  const giornataQuery = useGiornata(data);
  const profiloQuery = useProfilo();

  const creaTappa = useCreaTappa(data);
  const aggiornaTappa = useAggiornaTappa(data);
  const eliminaTappa = useEliminaTappa(data);
  const riordinaTappe = useRiordinaTappe(data);
  const salvaTratta = useSalvaTrattaManuale(data);
  const eliminaTratta = useEliminaTratta(data);
  const aggiornaGiornata = useAggiornaGiornata(data);
  const eliminaGiornata = useEliminaGiornata();
  const duplicaGiornata = useDuplicaGiornata();
  const ricalcola = useRicalcolaTratte(data);

  const [pannello, setPannello] = React.useState<StatoPannello>({ tipo: 'chiuso' });
  const [tappaDaEliminare, setTappaDaEliminare] = React.useState<Stop | null>(null);
  const [confermaEliminaGiornata, setConfermaEliminaGiornata] = React.useState(false);
  const [duplicaAperto, setDuplicaAperto] = React.useState(false);
  const [dataInConflitto, setDataInConflitto] = React.useState<string | null>(null);

  const giornata = giornataQuery.data ?? null;
  const { sequenza, totali } = vistaGiornata(giornata);
  const partenza = puntoDiPartenza(profiloQuery.data);

  const [note, setNote] = React.useState('');
  React.useEffect(() => {
    setNote(giornata?.itinerary.notes ?? '');
  }, [giornata?.itinerary.notes]);

  if (giornataQuery.isPending) {
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <span className="sr-only">Caricamento della giornata…</span>
      </div>
    );
  }

  if (giornataQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden />
        <AlertTitle>Impossibile caricare la giornata</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{giornataQuery.error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void giornataQuery.refetch();
            }}
          >
            Riprova
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const apriNuovaTappa = (posizione?: number) => {
    setPannello({ tipo: 'nuova', posizione });
  };

  const salvaTappa = (valori: TappaInput) => {
    const datiTappa = {
      label: valori.label,
      address: valori.address,
      lat: valori.lat,
      lng: valori.lng,
      plannedTime: valori.plannedTime,
      notes: valori.notes,
    };

    if (pannello.tipo === 'modifica') {
      aggiornaTappa.mutate(
        { stopId: pannello.tappa.id, tappa: datiTappa },
        {
          onSuccess: () => {
            setPannello({ tipo: 'chiuso' });
            toast.success('Tappa aggiornata');
          },
        },
      );
      return;
    }

    if (pannello.tipo === 'nuova') {
      creaTappa.mutate(
        { tappa: datiTappa, posizione: pannello.posizione },
        {
          onSuccess: () => {
            setPannello({ tipo: 'chiuso' });
            toast.success('Tappa aggiunta');
          },
        },
      );
    }
  };

  const confermaEliminazioneTappa = (tappa: Stop) => {
    eliminaTappa.mutate(
      { stopId: tappa.id },
      {
        onSuccess: (tratteInvalidate) => {
          setTappaDaEliminare(null);
          const dettaglio = messaggioRicalcolo(tratteInvalidate);
          toast.success(`"${tappa.label}" eliminata`, {
            description: dettaglio
              ? `${dettaglio}. Ripristinando la tappa i chilometri vanno reinseriti.`
              : 'Ripristinando la tappa i chilometri vanno reinseriti.',
            action: {
              label: 'Annulla',
              onClick: () => {
                creaTappa.mutate(
                  {
                    tappa: {
                      label: tappa.label,
                      address: tappa.address,
                      lat: tappa.lat,
                      lng: tappa.lng,
                      plannedTime: tappa.planned_time,
                      notes: tappa.notes,
                    },
                    posizione: tappa.position,
                  },
                  {
                    onSuccess: () => {
                      toast.success('Tappa ripristinata');
                    },
                  },
                );
              },
            },
          });
        },
      },
    );
  };

  const onSalvaTratta = (chiaveTratta: string, valori: TrattaInput) => {
    const tratta = sequenza.tratte.find((candidata) => candidata.chiave === chiaveTratta);
    if (!tratta || !giornata) return;

    salvaTratta.mutate({
      legId: tratta.leg?.id ?? null,
      itineraryId: giornata.itinerary.id,
      fromStopId: tratta.fromStop.id,
      toStopId: tratta.toStop.id,
      valori: { distanceKm: valori.distanceKm, durationMin: valori.durationMin },
    });
  };

  const salvaNote = () => {
    if (!giornata) return;
    const valore = note.trim() === '' ? null : note;
    if (valore === giornata.itinerary.notes) return;
    aggiornaGiornata.mutate({ itineraryId: giornata.itinerary.id, notes: valore });
  };

  // La partenza della giornata è una tappa: da lì cominciano i chilometri.
  const coordinateProfilo: Coordinate | null =
    partenza && partenza.lat !== null && partenza.lng !== null
      ? { lat: partenza.lat, lng: partenza.lng }
      : null;

  // Riferimento per la ricerca: l'ultima tappa con coordinate, altrimenti il profilo.
  const riferimentoRicerca =
    sequenza.tappe
      .slice()
      .reverse()
      .map((tappa) =>
        tappa.lat !== null && tappa.lng !== null ? { lat: tappa.lat, lng: tappa.lng } : null,
      )
      .find((coordinata): coordinata is Coordinate => coordinata !== null) ?? coordinateProfilo;

  const modalita: ModalitaViaggio = modalitaValida(giornata?.itinerary.travel_mode ?? 'auto');

  /**
   * Ricalcola le tratte. `soloMancanti` distingue i due casi d'uso:
   * dopo una modifica si completa ciò che manca, col pulsante si rifà tutto
   * (tranne le tratte manuali, che restano di chi le ha scritte).
   */
  const eseguiRicalcolo = (soloMancanti: boolean) => {
    if (!giornata) return;

    const { calcolabili, nonCalcolabili } = tratteDaCalcolare(sequenza.tratte, soloMancanti);

    if (calcolabili.length === 0) {
      toast.info(
        nonCalcolabili > 0
          ? 'Nessuna tratta calcolabile: alle tappe coinvolte mancano le coordinate.'
          : 'Non c’è nulla da calcolare.',
      );
      return;
    }

    ricalcola.mutate(
      {
        itineraryId: giornata.itinerary.id,
        modalita,
        tratte: calcolabili,
        nonCalcolabili,
      },
      {
        onSuccess: (esito) => {
          const parti: string[] = [];
          if (esito.calcolate > 0) parti.push(`${esito.calcolate} calcolate`);
          if (esito.stimate > 0) parti.push(`${esito.stimate} stimate`);
          if (esito.fallite > 0) parti.push(`${esito.fallite} non riuscite`);
          if (esito.nonCalcolabili > 0) parti.push(`${esito.nonCalcolabili} senza coordinate`);

          const messaggio = parti.length > 0 ? `Tratte: ${parti.join(', ')}` : 'Tratte aggiornate';

          if (esito.fallite > 0 || esito.nonCalcolabili > 0) {
            toast.warning(messaggio, {
              description: 'Le tratte rimaste puoi completarle a mano.',
            });
          } else {
            toast.success(messaggio);
          }
        },
      },
    );
  };

  /** Salva la partenza come prima tappa della giornata. */
  const confermaPartenza = (scelta: PartenzaScelta) => {
    creaTappa.mutate(
      {
        tappa: {
          label: scelta.label,
          address: scelta.address,
          lat: scelta.lat,
          lng: scelta.lng,
          plannedTime: null,
          notes: null,
        },
        partenza: true,
      },
      {
        onSuccess: () => {
          const cambio = pannello.tipo === 'partenza';
          setPannello({ tipo: 'chiuso' });
          toast.success(cambio ? 'Punto di partenza aggiornato' : 'Punto di partenza impostato', {
            description: cambio
              ? 'Le tratte coinvolte vanno ricalcolate.'
              : 'Ora aggiungi le tappe del giro.',
            action: cambio
              ? {
                  label: 'Calcola',
                  onClick: () => {
                    eseguiRicalcolo(true);
                  },
                }
              : undefined,
          });
        },
      },
    );
  };

  // Giornata senza tappe: prima di tutto si chiede da dove si parte, perché è
  // il punto da cui si misurano i chilometri.
  if (!giornata || sequenza.tappe.length === 0) {
    return (
      <SceltaPartenza
        data={data}
        profilo={partenza}
        inCorso={creaTappa.isPending}
        onConferma={confermaPartenza}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      {/* Azioni sulla giornata */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            apriNuovaTappa();
          }}
        >
          <Plus aria-hidden />
          Aggiungi tappa
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setPannello({ tipo: 'partenza' });
          }}
          title="Cambia il punto da cui parte la giornata"
        >
          <Flag aria-hidden />
          Cambia partenza
        </Button>
        <Button
          variant="outline"
          loading={ricalcola.isPending}
          onClick={() => {
            eseguiRicalcolo(false);
          }}
          title="Ricalcola i chilometri di tutte le tratte automatiche"
        >
          <RefreshCw aria-hidden />
          Calcola km
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDataInConflitto(null);
            setDuplicaAperto(true);
          }}
        >
          <Copy aria-hidden />
          Duplica giornata
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setConfermaEliminaGiornata(true);
          }}
        >
          <Trash2 aria-hidden />
          Elimina giornata
        </Button>
      </div>

      <RiepilogoGiornata totali={totali} numeroTappe={sequenza.tappe.length} />

      {/* Su desktop elenco e mappa sono affiancati; su telefono la mappa sta
          sopra l'elenco, così si vede il giro prima dei dettagli. */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="md:sticky md:top-4 md:order-2">
          <MappaGiornata tappe={sequenza.tappe} tratte={sequenza.tratte} />
        </div>

        <div className="md:order-1">
          <ElencoTappe
            sequenza={sequenza}
            salvataggioTrattaInCorso={salvaTratta.isPending}
            onRiordina={(idOrdinati) => {
              riordinaTappe.mutate(
                { itineraryId: giornata.itinerary.id, idOrdinati },
                {
                  onSuccess: (tratteInvalidate) => {
                    const dettaglio = messaggioRicalcolo(tratteInvalidate);
                    if (dettaglio) {
                      toast.info(`Ordine aggiornato: ${dettaglio}`, {
                        action: {
                          label: 'Calcola',
                          onClick: () => {
                            eseguiRicalcolo(true);
                          },
                        },
                      });
                    }
                  },
                },
              );
            }}
            onModificaTappa={(tappa) => {
              setPannello({ tipo: 'modifica', tappa });
            }}
            onEliminaTappa={setTappaDaEliminare}
            onInserisciSotto={(posizione) => {
              apriNuovaTappa(posizione);
            }}
            onSalvaTratta={onSalvaTratta}
            onAzzeraTratta={(legId) => {
              eliminaTratta.mutate({ legId });
            }}
          />
        </div>
      </div>

      {/* Rientro e note */}
      <Card>
        <CardContent className="space-y-4 pt-4 sm:pt-6">
          <div className="space-y-2">
            <Label htmlFor="modalita">Come ti muovi</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="modalita">
              {MODALITA.map(({ valore, etichetta }) => (
                <Button
                  key={valore}
                  type="button"
                  size="sm"
                  variant={modalita === valore ? 'default' : 'outline'}
                  aria-pressed={modalita === valore}
                  disabled={aggiornaGiornata.isPending}
                  onClick={() => {
                    if (valore === modalita) return;
                    aggiornaGiornata.mutate(
                      { itineraryId: giornata.itinerary.id, travelMode: valore },
                      {
                        onSuccess: () => {
                          toast.info(`Modalità: ${etichetta.toLowerCase()}`, {
                            description: 'Le tratte calcolate automaticamente vanno rifatte.',
                            action: {
                              label: 'Calcola',
                              onClick: () => {
                                eseguiRicalcolo(true);
                              },
                            },
                          });
                        },
                      },
                    );
                  }}
                >
                  {etichetta}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              I chilometri dipendono dal mezzo: fra Colosseo e Villa Borghese ci sono 3,6 km a piedi
              e 7,5 km in auto.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="rientro">Ritorno al punto di partenza</Label>
              <p className="text-sm text-muted-foreground">
                {partenza
                  ? `Aggiunge la tratta finale verso ${partenza.indirizzo}.`
                  : 'Imposta prima un indirizzo di partenza nel profilo.'}
              </p>
            </div>
            <Switch
              id="rientro"
              checked={giornata.itinerary.returns_to_start}
              disabled={!partenza || aggiornaGiornata.isPending}
              onCheckedChange={(attivo) => {
                aggiornaGiornata.mutate({
                  itineraryId: giornata.itinerary.id,
                  returnsToStart: attivo,
                });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-giornata">Note della giornata</Label>
            <Textarea
              id="note-giornata"
              rows={3}
              value={note}
              onChange={(evento) => {
                setNote(evento.target.value);
              }}
              onBlur={salvaNote}
              placeholder="Promemoria, appuntamenti, indicazioni…"
            />
            <p className="text-xs text-muted-foreground">
              Le note si salvano quando esci dal campo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pannello nuova tappa / modifica */}
      <PannelloResponsive
        aperto={pannello.tipo !== 'chiuso'}
        onCambioApertura={(aperto) => {
          if (!aperto) setPannello({ tipo: 'chiuso' });
        }}
        titolo={
          pannello.tipo === 'modifica'
            ? 'Modifica tappa'
            : pannello.tipo === 'partenza'
              ? 'Cambia il punto di partenza'
              : 'Nuova tappa'
        }
        descrizione={dataLunga(data)}
      >
        {pannello.tipo === 'partenza' ? (
          <SceltaPartenza
            data={data}
            profilo={partenza}
            inCorso={creaTappa.isPending}
            senzaIntestazione
            onConferma={(scelta) => {
              confermaPartenza(scelta);
            }}
          />
        ) : null}
        {pannello.tipo === 'modifica' ? (
          <FormTappa
            tappa={pannello.tappa}
            vicinoA={riferimentoRicerca}
            inCorso={aggiornaTappa.isPending}
            onSalva={salvaTappa}
            onAnnulla={() => {
              setPannello({ tipo: 'chiuso' });
            }}
          />
        ) : null}
        {pannello.tipo === 'nuova' ? (
          <FormTappa
            iniziali={pannello.iniziali}
            vicinoA={riferimentoRicerca}
            inCorso={creaTappa.isPending}
            onSalva={salvaTappa}
            onAnnulla={() => {
              setPannello({ tipo: 'chiuso' });
            }}
          />
        ) : null}
      </PannelloResponsive>

      {/* Conferma eliminazione tappa */}
      <AlertDialog
        open={tappaDaEliminare !== null}
        onOpenChange={(aperto) => {
          if (!aperto) setTappaDaEliminare(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare “{tappaDaEliminare?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Le tratte collegate a questa tappa verranno rimosse e i chilometri delle tappe vicine
              andranno ricalcolati. Potrai annullare subito dopo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (tappaDaEliminare) confermaEliminazioneTappa(tappaDaEliminare);
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conferma eliminazione giornata */}
      <AlertDialog open={confermaEliminaGiornata} onOpenChange={setConfermaEliminaGiornata}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare tutta la giornata?</AlertDialogTitle>
            <AlertDialogDescription>
              Vengono eliminate {sequenza.tappe.length} tappe e tutte le tratte del{' '}
              {dataLunga(data)}. L’operazione non è annullabile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                eliminaGiornata.mutate(
                  { itineraryId: giornata.itinerary.id },
                  {
                    onSuccess: () => {
                      setConfermaEliminaGiornata(false);
                      toast.success('Giornata eliminata');
                      void navigate('/', { replace: true });
                    },
                  },
                );
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogoDuplica
        aperto={duplicaAperto}
        onCambioApertura={(aperto) => {
          setDuplicaAperto(aperto);
          if (!aperto) setDataInConflitto(null);
        }}
        dataOrigine={data}
        inCorso={duplicaGiornata.isPending}
        dataInConflitto={dataInConflitto}
        onDuplica={(dataDestinazione, sovrascrivi) => {
          duplicaGiornata.mutate(
            { itineraryId: giornata.itinerary.id, dataDestinazione, sovrascrivi },
            {
              onSuccess: (copia) => {
                setDuplicaAperto(false);
                setDataInConflitto(null);
                toast.success(`Giornata copiata sul ${dataLunga(copia.date)}`, {
                  action: {
                    label: 'Apri',
                    onClick: () => {
                      void navigate(`/day/${copia.date}`);
                    },
                  },
                });
              },
              onError: (errore) => {
                // unique_violation: la data è occupata, serve conferma esplicita.
                if (errore.code === '23505') {
                  setDataInConflitto(dataDestinazione);
                  return;
                }
                toast.error(errore.message);
              },
            },
          );
        }}
      />
    </div>
  );
}
