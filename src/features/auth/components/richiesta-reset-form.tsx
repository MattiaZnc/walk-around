import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useRichiestaReset } from '@/features/auth/api/use-auth-mutations';
import {
  richiestaResetSchema,
  type RichiestaResetInput,
} from '@/features/auth/schemas/auth.schemas';

/** Passo 1 del reset: invio del link via email. */
export function RichiestaResetForm() {
  const richiesta = useRichiestaReset();

  const form = useForm<RichiestaResetInput>({
    resolver: zodResolver(richiestaResetSchema),
    defaultValues: { email: '' },
  });

  if (richiesta.isSuccess) {
    return (
      <div className="space-y-4">
        <Alert>
          <MailCheck aria-hidden />
          <AlertTitle>Controlla la posta</AlertTitle>
          <AlertDescription>
            Se esiste un account con questo indirizzo, riceverai un’email con il link per
            reimpostare la password. Il link è valido per un’ora.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/login">Torna all’accesso</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((valori) => {
          richiesta.mutate(valori);
        })}
        className="space-y-4"
        noValidate
      >
        {richiesta.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{richiesta.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="nome@esempio.it"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Ti invieremo un link per scegliere una nuova password.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" loading={richiesta.isPending}>
          Invia il link
        </Button>

        <div className="text-center">
          <Button variant="link" asChild className="h-auto p-0 text-sm">
            <Link to="/login">Torna all’accesso</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
