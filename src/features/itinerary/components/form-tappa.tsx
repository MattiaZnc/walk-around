import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import type { Coordinate } from '@/features/itinerary/api/percorsi.api';
import { RicercaLuogo } from '@/features/itinerary/components/ricerca-luogo';

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
import { Textarea } from '@/components/ui/textarea';
import {
  numeroPerCampo,
  tappaSchema,
  type CampiTappa,
  type TappaInput,
} from '@/features/itinerary/schemas/itinerary.schemas';
import type { Stop } from '@/types/models';

type Props = {
  /** Tappa da modificare; assente = nuova tappa. */
  tappa?: Stop;
  /** Valori suggeriti per una nuova tappa (es. indirizzo di partenza del profilo). */
  iniziali?: Partial<TappaInput>;
  inCorso: boolean;
  /** Riferimento per la ricerca: privilegia i luoghi vicini al giro in corso. */
  vicinoA?: Coordinate | null;
  onSalva: (valori: TappaInput) => void;
  onAnnulla: () => void;
};

function valoriIniziali(
  tappa: Stop | undefined,
  iniziali: Partial<TappaInput> | undefined,
): CampiTappa {
  if (tappa) {
    return {
      label: tappa.label,
      address: tappa.address ?? '',
      lat: numeroPerCampo(tappa.lat),
      lng: numeroPerCampo(tappa.lng),
      // Il DB restituisce 'HH:MM:SS', il campo time accetta solo 'HH:MM'.
      plannedTime: tappa.planned_time ? tappa.planned_time.slice(0, 5) : '',
      notes: tappa.notes ?? '',
    };
  }
  return {
    label: iniziali?.label ?? '',
    address: iniziali?.address ?? '',
    lat: numeroPerCampo(iniziali?.lat),
    lng: numeroPerCampo(iniziali?.lng),
    plannedTime: '',
    notes: '',
  };
}

/**
 * Un campo per riga: su telefono i campi affiancati costringono a zoom e
 * scroll orizzontale. Latitudine e longitudine stanno insieme solo da sm in su.
 */
export function FormTappa({ tappa, iniziali, inCorso, vicinoA, onSalva, onAnnulla }: Props) {
  // <campi del form, contesto, valori validati>: handleSubmit riceve i valori
  // già convertiti dallo schema.
  const form = useForm<CampiTappa, unknown, TappaInput>({
    resolver: zodResolver(tappaSchema),
    defaultValues: valoriIniziali(tappa, iniziali),
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((valori) => {
          onSalva(valori);
        })}
        className="space-y-4"
        noValidate
      >
        {/* La ricerca compila nome, indirizzo e coordinate insieme: senza
            coordinate i chilometri non si possono calcolare. */}
        <RicercaLuogo
          vicinoA={vicinoA}
          onScelta={(luogo) => {
            form.setValue('label', luogo.nome, { shouldValidate: true });
            form.setValue('address', luogo.indirizzo);
            form.setValue('lat', String(luogo.lat));
            form.setValue('lng', String(luogo.lng));
          }}
        />

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome della tappa</FormLabel>
              <FormControl>
                <Input placeholder="Es. Cliente Rossi" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indirizzo</FormLabel>
              <FormControl>
                <Input placeholder="Via Roma 1, Milano" autoComplete="street-address" {...field} />
              </FormControl>
              <FormDescription>Compilato dalla ricerca, oppure scrivilo a mano.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plannedTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Orario previsto</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="lat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitudine</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="45,4642" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lng"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitudine</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="9,1896" {...field} />
                </FormControl>
                <FormDescription>
                  Con le coordinate la tappa appare sulla mappa e i km si calcolano da soli.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onAnnulla} disabled={inCorso}>
            Annulla
          </Button>
          <Button type="submit" loading={inCorso}>
            {tappa ? 'Salva modifiche' : 'Aggiungi tappa'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
