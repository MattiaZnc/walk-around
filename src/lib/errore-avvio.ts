/**
 * Schermata mostrata quando l'app non riesce nemmeno a partire, tipicamente
 * perché mancano le variabili d'ambiente.
 *
 * Non usa React né le classi di Tailwind: se il caricamento è fallito non è
 * detto che siano disponibili. Solo HTML con stili in linea, altrimenti
 * l'utente vedrebbe una pagina bianca senza sapere cosa è andato storto.
 */

const VARIABILI_RICHIESTE = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

function scappaHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** true se l'errore riguarda la configurazione e non un guasto generico. */
export function isErroreConfigurazione(errore: unknown): boolean {
  if (!(errore instanceof Error)) return false;
  return (
    errore.message.includes('Configurazione ambiente non valida') ||
    VARIABILI_RICHIESTE.some((variabile) => errore.message.includes(variabile))
  );
}

export function messaggioAvvio(errore: unknown): string {
  if (errore instanceof Error) return errore.message;
  return 'Errore inatteso durante l’avvio.';
}

export function htmlErroreAvvio(errore: unknown): string {
  const configurazione = isErroreConfigurazione(errore);
  const dettaglio = scappaHtml(messaggioAvvio(errore));

  const titolo = configurazione ? 'Configurazione mancante' : 'L’app non è riuscita a partire';

  const istruzioni = configurazione
    ? `<p style="margin:0 0 8px">L’app ha bisogno dell’indirizzo e della chiave del progetto Supabase:</p>
       <ul style="margin:0 0 16px;padding-left:20px">
         ${VARIABILI_RICHIESTE.map((variabile) => `<li><code>${variabile}</code></li>`).join('')}
       </ul>
       <p style="margin:0 0 8px"><strong>Su Vercel:</strong> Settings → Environment Variables →
       aggiungile per Production, Preview e Development, poi
       <strong>rifai il deploy</strong> (Deployments → ⋯ → Redeploy). I valori vengono scritti
       dentro il JavaScript durante la build, quindi aggiungerli non basta: serve una build nuova.</p>
       <p style="margin:0"><strong>In locale:</strong> copia <code>.env.example</code> in
       <code>.env.local</code>, inserisci i valori e riavvia <code>npm run dev</code>.</p>`
    : `<p style="margin:0 0 8px">Ricarica la pagina. Se il problema resta, il dettaglio qui sotto
       dice cosa è andato storto.</p>`;

  return `
<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
            font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a">
  <div style="max-width:640px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;
              padding:24px;box-shadow:0 1px 3px rgb(0 0 0 / .1)">
    <h1 style="margin:0 0 4px;font-size:20px;line-height:1.3">${titolo}</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px">Walk Around</p>
    <div style="font-size:14px;line-height:1.6">${istruzioni}</div>
    <details style="margin-top:20px">
      <summary style="cursor:pointer;font-size:13px;color:#475569">Dettaglio tecnico</summary>
      <pre style="margin:8px 0 0;padding:12px;background:#f1f5f9;border-radius:8px;font-size:12px;
                  white-space:pre-wrap;word-break:break-word">${dettaglio}</pre>
    </details>
  </div>
</div>`;
}

/** Sostituisce il contenuto del contenitore con la schermata di errore. */
export function mostraErroreAvvio(contenitore: HTMLElement, errore: unknown): void {
  contenitore.innerHTML = htmlErroreAvvio(errore);
  // Il messaggio serve anche a chi guarda la console (o ci arriva da un log).
  console.error('Avvio non riuscito:', errore);
}
