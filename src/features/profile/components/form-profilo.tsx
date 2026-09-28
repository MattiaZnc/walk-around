import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';

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
import { RicercaLuogo } from '@/features/itinerary/components/ricerca-luogo';
import { numeroPerCampo } from '@/features/itinerary/schemas/itinerary.schemas';
import {
  profiloSchema,
  type CampiProfilo,
  type ProfiloInput,
} from '@/features/profile/schemas/profile.schemas';
import type { Profile } from '@/types/models';

type Props = {
  profilo: Profile;
  inCorso: boolean;
  onSalva: (valori: ProfiloInput) => void;
};

export function FormProfilo({ profilo, inCorso, onSalva }: Props) {
  const form = useForm<CampiProfilo, unknown, ProfiloInput>({
    resolver: zodResolver(profiloSchema),
    defaultValues: {
      fullName: profilo.full_name ?? '',
      defaultStartAddress: profilo.default_start_address ?? '',
      defaultStartLat: numeroPerCampo(profilo.default_start_lat),
      defaultStartLng: numeroPerCampo(profilo.default_start_lng),
    },
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
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Mario Rossi" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="font-medium">Punto di partenza predefinito</p>
            <p className="text-sm text-muted-foreground">
              Viene proposto quando apri una giornata nuova, così non lo devi cercare ogni volta.
            </p>
          </div>

          {/* La ricerca compila indirizzo e coordinate insieme */}
          <RicercaLuogo
            onScelta={(luogo) => {
              form.setValue('defaultStartAddress', luogo.indirizzo || luogo.etichetta, {
                shouldDirty: true,
              });
              form.setValue('defaultStartLat', String(luogo.lat), { shouldDirty: true });
              form.setValue('defaultStartLng', String(luogo.lng), { shouldDirty: true });
            }}
          />

          <FormField
            control={form.control}
            name="defaultStartAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Indirizzo</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="street-address"
                    placeholder="Via Roma 1, Milano"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="defaultStartLat"
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
              name="defaultStartLng"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitudine</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="9,1896" {...field} />
                  </FormControl>
                  <FormDescription>
                    Senza coordinate l’indirizzo resta solo un’etichetta: i km non si calcolano.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" loading={inCorso} disabled={!form.formState.isDirty}>
          <Save aria-hidden />
          Salva modifiche
        </Button>
      </form>
    </Form>
  );
}
