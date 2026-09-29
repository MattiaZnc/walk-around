import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useLogin } from '@/features/auth/api/use-auth-mutations';
import { loginSchema, type LoginInput } from '@/features/auth/schemas/auth.schemas';

export function LoginForm() {
  const login = useLogin();
  const [mostraPassword, setMostraPassword] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (valori: LoginInput) => {
    login.mutate(valori);
    // Il redirect avviene in PublicOnlyRoute quando la sessione arriva.
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {login.isError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{login.error.message}</AlertDescription>
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
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              {/* FormControl avvolge solo l'input: l'id deve finire sul campo,
                  altrimenti la label non è associata a nulla. */}
              <div className="relative">
                <FormControl>
                  <Input
                    type={mostraPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-12"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-11 sm:size-10"
                  onClick={() => {
                    setMostraPassword((valore) => !valore);
                  }}
                  aria-label={mostraPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {mostraPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" loading={login.isPending}>
          Accedi
        </Button>

        {/* Nessun "password dimenticata": gli account e le password li gestisce
            l'amministratore. La pagina /reset-password resta per i link di
            recupero che l'amministratore può inviare dalla dashboard. */}
        <p className="text-center text-xs text-muted-foreground">
          Password dimenticata? Chiedi all’amministratore di reimpostarla.
        </p>
      </form>
    </Form>
  );
}
