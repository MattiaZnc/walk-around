import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/api/auth-provider';
import { NuovaPasswordForm } from '@/features/auth/components/nuova-password-form';
import { RichiestaResetForm } from '@/features/auth/components/richiesta-reset-form';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

/**
 * Due stati nella stessa route:
 * - senza sessione di recupero: si chiede l'email per ricevere il link;
 * - con sessione di recupero (arrivo dal link): si imposta la nuova password.
 */
export default function ResetPasswordPage() {
  const { inRecuperoPassword } = useAuth();
  useTitoloPagina(inRecuperoPassword ? 'Nuova password' : 'Password dimenticata');

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {inRecuperoPassword ? 'Scegli una nuova password' : 'Password dimenticata'}
        </CardTitle>
        <CardDescription>
          {inRecuperoPassword
            ? 'Imposta la password che userai per accedere.'
            : 'Inserisci la tua email: ti invieremo un link per reimpostarla.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inRecuperoPassword ? <NuovaPasswordForm /> : <RichiestaResetForm />}
      </CardContent>
    </Card>
  );
}
