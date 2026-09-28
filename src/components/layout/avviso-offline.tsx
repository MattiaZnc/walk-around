import { WifiOff } from 'lucide-react';

import { useOnline } from '@/lib/use-online';

/**
 * Avviso quando manca la connessione.
 * L'app è installabile e le schermate già visitate continuano ad aprirsi, ma i
 * dati non si salvano: meglio dirlo prima che l'utente inserisca tappe che
 * andrebbero perse.
 */
export function AvvisoOffline() {
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-sm text-warning-foreground"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>Sei offline: le modifiche non vengono salvate finché la rete non torna.</span>
    </div>
  );
}
