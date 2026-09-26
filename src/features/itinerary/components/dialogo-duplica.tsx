import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PannelloResponsive } from '@/components/ui/pannello-responsive';
import {
  duplicaGiornataSchema,
  type DuplicaGiornataInput,
} from '@/features/itinerary/schemas/itinerary.schemas';
import { dataLunga } from '@/lib/format';

type Props = {
  aperto: boolean;
  onCambioApertura: (aperto: boolean) => void;
  dataOrigine: string;
  inCorso: boolean;
  /** Impostato quando la data scelta è già occupata: serve conferma esplicita. */
  dataInConflitto: string | null;
  onDuplica: (dataDestinazione: string, sovrascrivi: boolean) => void;
};

export function DialogoDuplica({
  aperto,
  onCambioApertura,
  dataOrigine,
  inCorso,
  dataInConflitto,
  onDuplica,
}: Props) {
  const form = useForm<DuplicaGiornataInput>({
    resolver: zodResolver(duplicaGiornataSchema),
    defaultValues: { dataDestinazione: '' },
  });

  return (
    <PannelloResponsive
      aperto={aperto}
      onCambioApertura={onCambioApertura}
      titolo="Duplica la giornata"
      descrizione={`Copia le tappe del ${dataLunga(dataOrigine)} su un'altra data.`}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(({ dataDestinazione }) => {
            onDuplica(dataDestinazione, dataDestinazione === dataInConflitto);
          })}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="dataDestinazione"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data di destinazione</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>
                  Vengono copiate le tappe, non i chilometri: le tratte si ricalcolano.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {dataInConflitto && form.watch('dataDestinazione') === dataInConflitto ? (
            <Alert variant="warning">
              <AlertDescription>
                Il {dataLunga(dataInConflitto)} esiste già. Confermando, le sue tappe attuali
                vengono <strong>sostituite</strong>.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onCambioApertura(false);
              }}
              disabled={inCorso}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              loading={inCorso}
              variant={
                dataInConflitto && form.watch('dataDestinazione') === dataInConflitto
                  ? 'destructive'
                  : 'default'
              }
            >
              {dataInConflitto && form.watch('dataDestinazione') === dataInConflitto
                ? 'Sostituisci la giornata'
                : 'Duplica'}
            </Button>
          </div>
        </form>
      </Form>
    </PannelloResponsive>
  );
}
