import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { useCambioPassword } from '@/features/auth/api/use-auth-mutations';
import {
  cambioPasswordSchema,
  LUNGHEZZA_MINIMA_PASSWORD,
  type CambioPasswordInput,
} from '@/features/auth/schemas/auth.schemas';

export function FormCambioPassword({ email }: { email: string }) {
  const cambio = useCambioPassword(email);

  const form = useForm<CambioPasswordInput>({
    resolver: zodResolver(cambioPasswordSchema),
    defaultValues: { passwordAttuale: '', password: '', conferma: '' },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((valori) => {
          cambio.mutate(valori, {
            onSuccess: () => {
              form.reset();
              toast.success('Password aggiornata');
            },
          });
        })}
        className="space-y-4"
        noValidate
      >
        {cambio.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{cambio.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="passwordAttuale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password attuale</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuova password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>
                Almeno {LUNGHEZZA_MINIMA_PASSWORD} caratteri, con una maiuscola, una minuscola e un
                numero.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="conferma"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ripeti la nuova password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" loading={cambio.isPending}>
          <KeyRound aria-hidden />
          Cambia password
        </Button>
      </form>
    </Form>
  );
}
