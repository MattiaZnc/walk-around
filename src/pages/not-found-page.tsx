import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useTitoloPagina } from '@/lib/use-titolo-pagina';

export default function NotFoundPage() {
  useTitoloPagina('Pagina non trovata');

  return (
    <div className="container flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Pagina non trovata</h1>
      <p className="text-sm text-muted-foreground">
        L’indirizzo che hai aperto non esiste o non è più disponibile.
      </p>
      <Button asChild>
        <Link to="/">Torna ai giorni</Link>
      </Button>
    </div>
  );
}
