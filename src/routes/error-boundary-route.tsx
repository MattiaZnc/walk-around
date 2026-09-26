import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { messaggioErrore } from '@/lib/errors';

/** Ultima rete di sicurezza: un errore non gestito non lascia schermo bianco. */
export function ErrorBoundaryRoute() {
  const errore = useRouteError();
  const navigate = useNavigate();

  const messaggio = isRouteErrorResponse(errore)
    ? `${errore.status} — ${errore.statusText}`
    : messaggioErrore(errore);

  return (
    <div className="container flex min-h-dvh max-w-md flex-col items-center justify-center gap-4">
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>Qualcosa è andato storto</AlertTitle>
        <AlertDescription>{messaggio}</AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            void navigate(-1);
          }}
        >
          Torna indietro
        </Button>
        <Button
          onClick={() => {
            window.location.href = '/';
          }}
        >
          Ricarica l’app
        </Button>
      </div>
    </div>
  );
}
