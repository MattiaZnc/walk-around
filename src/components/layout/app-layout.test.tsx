import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthProvider } from '@/features/auth/api/auth-provider';
import { renderConProvider } from '@/test/test-utils';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
  },
}));

function render() {
  // Il menu utente mostra l'email della sessione, quindi serve AuthProvider.
  return renderConProvider(
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>Contenuto della pagina</p>} />
        </Route>
      </Routes>
    </AuthProvider>,
  );
}

describe('AppLayout', () => {
  it('nella navigazione tiene solo giorni e report', () => {
    render();

    // Due barre di navigazione (sidebar e bottom bar) con le stesse voci.
    for (const navigazione of screen.getAllByRole('navigation')) {
      expect(within(navigazione).getByText('Giorni')).toBeInTheDocument();
      expect(within(navigazione).getByText('Report')).toBeInTheDocument();
      // Il profilo non è una destinazione quotidiana: sta nel menu utente.
      expect(within(navigazione).queryByText('Profilo')).not.toBeInTheDocument();
    }
  });

  it('il menu utente offre il cambio tema e l’uscita', async () => {
    const utente = userEvent.setup();
    render();

    await utente.click(screen.getAllByRole('button', { name: 'Account e impostazioni' })[0]!);

    const menu = await screen.findByRole('menu');
    // Il tema stava in un'icona a forma di monitor che non diceva cosa facesse:
    // qui ogni scelta ha un'etichetta.
    for (const tema of ['Chiaro', 'Scuro', 'Automatico']) {
      expect(within(menu).getByRole('menuitemradio', { name: tema })).toBeInTheDocument();
    }
    expect(within(menu).getByRole('menuitem', { name: 'Esci' })).toBeInTheDocument();
  });

  it('scegliendo un tema il menu resta aperto e la scelta è segnata', async () => {
    const utente = userEvent.setup();
    render();

    await utente.click(screen.getAllByRole('button', { name: 'Account e impostazioni' })[0]!);
    const menu = await screen.findByRole('menu');
    await utente.click(within(menu).getByRole('menuitemradio', { name: 'Scuro' }));

    expect(screen.getByRole('menuitemradio', { name: 'Scuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    document.documentElement.classList.remove('dark');
  });

  it('offre un collegamento per saltare al contenuto', () => {
    render();

    const salta = screen.getByRole('link', { name: 'Vai al contenuto' });
    expect(salta).toHaveAttribute('href', '#contenuto');
    // La destinazione deve esistere, altrimenti il collegamento non porta a nulla.
    expect(document.getElementById('contenuto')).not.toBeNull();
  });
});

describe('AvvisoOffline', () => {
  const originale = navigator.onLine;

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: originale });
  });

  it('non dice nulla quando la connessione c’è', () => {
    render();
    expect(screen.queryByText(/Sei offline/)).not.toBeInTheDocument();
  });

  it('avvisa quando la connessione cade, e smette quando torna', async () => {
    render();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));

    expect(await screen.findByText(/Sei offline/)).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(screen.queryByText(/Sei offline/)).not.toBeInTheDocument();
    });
  });
});
