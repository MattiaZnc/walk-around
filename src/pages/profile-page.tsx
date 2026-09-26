import { useTitoloPagina } from '@/lib/use-titolo-pagina';

export default function ProfilePage() {
  useTitoloPagina('Profilo');

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nome, indirizzo di partenza e cambio password: in arrivo nella Fase 5.
      </p>
    </div>
  );
}
