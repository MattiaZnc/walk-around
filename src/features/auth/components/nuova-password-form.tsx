import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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
import { useAuth } from '@/features/auth/api/auth-provider';
import { useImpostaNuovaPassword } from '@/features/auth/api/use-auth-mutations';
import {
  LUNGHEZZA_MINIMA_PASSWORD,
  nuovaPasswordSchema,
  type NuovaPasswordInput,
} from '@/features/auth/schemas/auth.schemas';

/** Passo 2 del reset: l'utente arriva dal link email con una sessione di recupero. */
export function NuovaPasswordForm() {
  const navigate = useNavigate();
  const { fineRecuperoPassword } = useAuth();
  const imposta = useImpostaNuovaPassword();

  const form = useForm<NuovaPasswordInput>({
    resolver: zodResolver(nuovaPasswordSchema),
    defaultValues: { password: '', conferma: '' },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(({ password }) => {
          imposta.mutate(
            { password },
            {
              onSuccess: () => {
                fineRecuperoPassword();
                toast.success('Password aggiornata');
                void navigate('/', { replace: true });
              },
            },
          );
        })}
        className="space-y-4"
        noValidate
      >
        {imposta.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{imposta.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuova password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" autoFocus {...field} />
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
              <FormLabel>Ripeti la password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" loading={imposta.isPending}>
          Salva la nuova password
        </Button>
      </form>
    </Form>
  );
}
