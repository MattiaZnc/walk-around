import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, Check, Pencil, RotateCcw, X } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import {
  numeroPerCampo,
  trattaSchema,
  type CampiTratta,
  type TrattaInput,
} from '@/features/itinerary/schemas/itinerary.schemas';
import { durata, km } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  tratta: Tratta;
  /** Indirizzo di rientro mostrato al posto del nome della tappa di arrivo. */
  indirizzoRientro?: string | null;
  inCorso: boolean;
  onSalva: (valori: TrattaInput) => void;
  onAzzera: () => void;
};

/**
 * La tratta fra due tappe: km e durata, modificabili sul posto.
 * Quando la riga `legs` non esiste la tratta resta comunque modificabile: un
 * indirizzo senza coordinate o un errore dell'API non devono bloccare l'utente.
 */
export function TrattaInline({ tratta, indirizzoRientro, inCorso, onSalva, onAzzera }: Props) {
  const [inModifica, setInModifica] = React.useState(false);
  const { leg } = tratta;

  const form = useForm<CampiTratta, unknown, TrattaInput>({
    resolver: zodResolver(trattaSchema),
    defaultValues: {
      distanceKm: numeroPerCampo(leg?.distance_km),
      durationMin: numeroPerCampo(leg?.duration_min),
    },
  });

  // Se il valore cambia da fuori (ricalcolo, refetch) il form deve seguirlo.
  React.useEffect(() => {
    if (!inModifica) {
      form.reset({
        distanceKm: numeroPerCampo(leg?.distance_km),
        durationMin: numeroPerCampo(leg?.duration_min),
      });
    }
  }, [leg?.distance_km, leg?.duration_min, inModifica, form]);

  const destinazione = tratta.rientro
    ? (indirizzoRientro ?? 'punto di partenza')
    : (tratta.toStop?.label ?? 'tappa successiva');
  const descrizione = `da ${tratta.fromStop.label} a ${destinazione}`;

  if (inModifica) {
    return (
      <li className="ml-4 border-l-2 border-dashed border-primary/40 pl-4 sm:ml-6 sm:pl-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((valori) => {
              onSalva(valori);
              setInModifica(false);
            })}
            className="rounded-md border bg-card p-3"
            noValidate
          >
            <p className="mb-3 text-xs text-muted-foreground">Tratta {descrizione}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <FormField
                control={form.control}
                name="distanceKm"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Chilometri</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" autoFocus placeholder="12,5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationMin"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Minuti (facoltativo)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="submit" size="sm" loading={inCorso}>
                <Check aria-hidden />
                Salva
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  form.reset();
                  setInModifica(false);
                }}
              >
                <X aria-hidden />
                Annulla
              </Button>
            </div>
          </form>
        </Form>
      </li>
    );
  }

  return (
    <li className="ml-4 border-l-2 border-dashed border-border pl-4 sm:ml-6 sm:pl-6">
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm',
          !leg && 'text-muted-foreground',
        )}
      >
        <ArrowDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />

        {leg ? (
          <>
            <span className="tabular font-medium">{km(leg.distance_km)}</span>
            {leg.duration_min !== null ? (
              <span className="tabular text-muted-foreground">{durata(leg.duration_min)}</span>
            ) : null}
            {leg.source === 'manual' ? (
              <Badge
                variant="secondary"
                title="Valore inserito a mano: il ricalcolo non lo sovrascrive"
              >
                manuale
              </Badge>
            ) : null}
            {leg.is_estimate ? (
              <Badge variant="warning" title="Distanza stimata, non un percorso reale">
                stimata
              </Badge>
            ) : null}
          </>
        ) : (
          <span>Chilometri da inserire</span>
        )}

        <span className="sr-only">Tratta {descrizione}</span>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInModifica(true);
            }}
            aria-label={`Modifica i chilometri della tratta ${descrizione}`}
          >
            <Pencil aria-hidden />
            <span className="hidden sm:inline">{leg ? 'Modifica' : 'Inserisci'}</span>
          </Button>
          {leg ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAzzera}
              disabled={inCorso}
              aria-label={`Azzera la tratta ${descrizione}`}
              title="Azzera: la tratta torna da calcolare"
            >
              <RotateCcw aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
