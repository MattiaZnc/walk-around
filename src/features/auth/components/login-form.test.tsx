import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/components/login-form';
import { renderConProvider } from '@/test/test-utils';

type Credenziali = { email: string; password: string };

const signInWithPassword = vi.fn<(credenziali: Credenziali) => Promise<unknown>>();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (credenziali: Credenziali) => signInWithPassword(credenziali),
    },
  },
}));

describe('LoginForm', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'u1' } },
      error: null,
    });
  });

  it('mostra gli errori di validazione senza chiamare Supabase', async () => {
    const utente = userEvent.setup();
    renderConProvider(<LoginForm />);

    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByText('Inserisci la tua email')).toBeInTheDocument();
    expect(screen.getByText('Inserisci la password')).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('segnala un’email formalmente non valida', async () => {
    const utente = userEvent.setup();
    renderConProvider(<LoginForm />);

    await utente.type(screen.getByLabelText('Email'), 'non-una-email');
    await utente.type(screen.getByLabelText('Password'), 'Password1');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByText('Indirizzo email non valido')).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('invia email normalizzata e password a Supabase', async () => {
    const utente = userEvent.setup();
    renderConProvider(<LoginForm />);

    await utente.type(screen.getByLabelText('Email'), '  Mario.Rossi@Esempio.IT ');
    await utente.type(screen.getByLabelText('Password'), 'Password1');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'mario.rossi@esempio.it',
        password: 'Password1',
      });
    });
  });

  it('mostra il messaggio in italiano quando le credenziali sono errate', async () => {
    const { AuthError } = await import('@supabase/supabase-js');
    // 400 + code invalid_credentials: la risposta reale di Supabase Auth.
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthError('Invalid login credentials', 400, 'invalid_credentials'),
    });

    const utente = userEvent.setup();
    renderConProvider(<LoginForm />);

    await utente.type(screen.getByLabelText('Email'), 'mario@esempio.it');
    await utente.type(screen.getByLabelText('Password'), 'sbagliata');
    await utente.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corretti.');
  });

  it('permette di mostrare e nascondere la password', async () => {
    const utente = userEvent.setup();
    renderConProvider(<LoginForm />);

    const campo = screen.getByLabelText('Password');
    expect(campo).toHaveAttribute('type', 'password');

    await utente.click(screen.getByRole('button', { name: 'Mostra password' }));
    expect(campo).toHaveAttribute('type', 'text');

    await utente.click(screen.getByRole('button', { name: 'Nascondi password' }));
    expect(campo).toHaveAttribute('type', 'password');
  });
});
