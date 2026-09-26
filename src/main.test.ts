import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Verifica la catena di avvio completa: se manca la configurazione, l'utente
 * deve vedere un messaggio, non una pagina bianca.
 * Il test importa davvero src/main.tsx, quindi copre anche l'import dinamico
 * di app.tsx e la cattura dell'errore.
 */
describe('avvio dell’applicazione', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
  });

  it('senza variabili d’ambiente mostra come configurarle', async () => {
    // Sovrascrive i valori validi impostati in src/test/setup.ts.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('@/main');
    // L'import di app.tsx è asincrono: si attende che la catena si concluda.
    await vi.waitFor(
      () => {
        expect(document.getElementById('root')?.textContent).toContain('Configurazione mancante');
      },
      { timeout: 10_000 },
    );

    const testo = document.getElementById('root')?.textContent ?? '';
    expect(testo).toContain('VITE_SUPABASE_URL');
    expect(testo).toContain('Redeploy');
  });

  it('con le variabili valide monta l’applicazione', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://progetto.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chiave-anon-di-test-abcdefghijklmnop');
    // React avvisa che il render non è in act(): qui è voluto, si monta
    // l'applicazione vera come farebbe il browser.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('@/main');

    // Il primo import trasforma tutta la catena dei moduli: richiede secondi.
    await vi.waitFor(
      () => {
        const radice = document.getElementById('root');
        expect(radice?.innerHTML).not.toBe('');
        expect(radice?.textContent).not.toContain('Configurazione mancante');
      },
      { timeout: 15_000 },
    );
  }, 20_000);
});
