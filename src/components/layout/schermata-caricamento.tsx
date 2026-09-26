import { Loader2 } from 'lucide-react';

export function SchermataCaricamento({ messaggio = 'Caricamento…' }: { messaggio?: string }) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <p className="text-sm">{messaggio}</p>
    </div>
  );
}
