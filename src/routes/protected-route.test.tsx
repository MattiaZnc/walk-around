import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/features/auth/api/auth-provider';
import { ProtectedRoute } from '@/routes/protected-route';
import { PublicOnlyRoute } from '@/routes/public-only-route';
import { createTestQueryClient } from '@/test/test-utils';

type CallbackAuth = (evento: string, sessione: Session | null) => void;

let sessioneAttuale: Session | null = null;
let notifica: CallbackAuth | null = null;

const unsubscribe = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sessioneAttuale }, error: null }),
      onAuthStateChange: (callback: CallbackAuth) => {
        notifica = callback;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  },
}));

function sessioneFinta(): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'utente-1',
      email: 'mario@esempio.it',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2025-01-01T00:00:00Z',
    },
  };
}

function renderRoute() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/segreta']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/segreta" element={<p>Contenuto riservato</p>} />
            </Route>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<p>Pagina di accesso</p>} />
              <Route path="/reset-password" element={<p>Nuova password</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    sessioneAttuale = null;
    notifica = null;
  });

  it('manda al login quando non c’è sessione', async () => {
    renderRoute();

    expect(await screen.findByText('Pagina di accesso')).toBeInTheDocument();
    expect(screen.queryByText('Contenuto riservato')).not.toBeInTheDocument();
  });

  it('mostra il contenuto quando la sessione esiste', async () => {
    sessioneAttuale = sessioneFinta();
    renderRoute();

    expect(await screen.findByText('Contenuto riservato')).toBeInTheDocument();
  });

  it('riporta al login se la sessione cade (evento SIGNED_OUT)', async () => {
    sessioneAttuale = sessioneFinta();
    renderRoute();
    expect(await screen.findByText('Contenuto riservato')).toBeInTheDocument();

    notifica?.('SIGNED_OUT', null);

    expect(await screen.findByText('Pagina di accesso')).toBeInTheDocument();
  });

  it('durante il recupero password dirotta su /reset-password', async () => {
    sessioneAttuale = sessioneFinta();
    renderRoute();
    expect(await screen.findByText('Contenuto riservato')).toBeInTheDocument();

    // Arrivo dal link email: la sessione esiste ma serve impostare la password.
    notifica?.('PASSWORD_RECOVERY', sessioneFinta());

    expect(await screen.findByText('Nuova password')).toBeInTheDocument();
  });
});
