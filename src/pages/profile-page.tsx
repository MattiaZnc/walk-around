import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUtenteCorrente } from '@/features/auth/api/auth-provider';
import { useAggiornaProfilo } from '@/features/profile/api/use-aggiorna-profilo';
import { useProfilo } from '@/features/profile/api/use-profilo';
import { FormProfilo } from '@/features/profile/components/form-profilo';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

export default function ProfilePage() {
  useTitoloPagina('Profilo');

  const utente = useUtenteCorrente();
  const profiloQuery = useProfilo();
  const aggiorna = useAggiornaProfilo(utente.id);

  return (
    <div className="container max-w-2xl space-y-4 py-4 sm:py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dati personali</CardTitle>
          <CardDescription>{utente.email}</CardDescription>
        </CardHeader>
        <CardContent>
          {profiloQuery.isPending ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <span className="sr-only">Caricamento del profilo…</span>
            </div>
          ) : null}

          {profiloQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>Impossibile caricare il profilo</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{profiloQuery.error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void profiloQuery.refetch();
                  }}
                >
                  Riprova
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {profiloQuery.isSuccess && profiloQuery.data ? (
            <FormProfilo
              profilo={profiloQuery.data}
              inCorso={aggiorna.isPending}
              onSalva={(valori) => {
                aggiorna.mutate(valori, {
                  onSuccess: () => {
                    toast.success('Profilo aggiornato');
                  },
                });
              }}
            />
          ) : null}

          {profiloQuery.isSuccess && !profiloQuery.data ? (
            <Alert variant="warning">
              <AlertCircle aria-hidden />
              <AlertTitle>Profilo non trovato</AlertTitle>
              <AlertDescription>
                Il profilo viene creato insieme all’account. Se vedi questo messaggio, scrivi
                all’amministratore.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
