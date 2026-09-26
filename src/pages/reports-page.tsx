import { useTitoloPagina } from '@/lib/use-titolo-pagina';

export default function ReportsPage() {
  useTitoloPagina('Report');

  return (
    <div className="container max-w-5xl py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Totali per intervallo di date ed export CSV: in arrivo nella Fase 5.
      </p>
    </div>
  );
}
