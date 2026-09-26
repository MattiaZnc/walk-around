import { beforeEach, describe, expect, it, vi } from 'vitest';

import { htmlErroreAvvio, isErroreConfigurazione, mostraErroreAvvio } from '@/lib/errore-avvio';

const ERRORE_ENV = new Error(
  'Configurazione ambiente non valida.\n- VITE_SUPABASE_URL deve essere un URL valido\n',
);

describe('isErroreConfigurazione', () => {
  it('riconosce l’errore di variabili d’ambiente', () => {
    expect(isErroreConfigurazione(ERRORE_ENV)).toBe(true);
    expect(isErroreConfigurazione(new Error('VITE_SUPABASE_ANON_KEY mancante'))).toBe(true);
  });

  it('non confonde un guasto qualsiasi con un problema di configurazione', () => {
    expect(isErroreConfigurazione(new Error('Network request failed'))).toBe(false);
    expect(isErroreConfigurazione('stringa')).toBe(false);
  });
});

describe('htmlErroreAvvio', () => {
  it('per un problema di configurazione dice cosa manca e cosa fare su Vercel', () => {
    const html = htmlErroreAvvio(ERRORE_ENV);

    expect(html).toContain('Configurazione mancante');
    expect(html).toContain('VITE_SUPABASE_URL');
    expect(html).toContain('VITE_SUPABASE_ANON_KEY');
    expect(html).toContain('Environment Variables');
    // Il punto che si dimentica sempre: aggiungere le variabili non basta.
    expect(html).toContain('Redeploy');
    expect(html).toContain('.env.local');
  });

  it('per un errore generico invita a ricaricare e mostra il dettaglio', () => {
    const html = htmlErroreAvvio(new Error('Failed to fetch dynamically imported module'));

    expect(html).toContain('non è riuscita a partire');
    expect(html).toContain('Failed to fetch dynamically imported module');
    expect(html).not.toContain('Environment Variables');
  });

  it('non inietta HTML proveniente dal messaggio di errore', () => {
    const html = htmlErroreAvvio(new Error('<img src=x onerror="alert(1)">'));

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('gestisce un errore che non è un Error', () => {
    expect(htmlErroreAvvio({ strano: true })).toContain('Errore inatteso');
  });
});

describe('mostraErroreAvvio', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('scrive la schermata nel contenitore e registra l’errore in console', () => {
    const contenitore = document.createElement('div');
    mostraErroreAvvio(contenitore, ERRORE_ENV);

    expect(contenitore.textContent).toContain('Configurazione mancante');
    expect(contenitore.querySelector('pre')?.textContent).toContain('VITE_SUPABASE_URL');
    expect(console.error).toHaveBeenCalled();
  });
});
