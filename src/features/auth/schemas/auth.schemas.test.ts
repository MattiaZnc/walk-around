import { describe, expect, it } from 'vitest';

import {
  cambioPasswordSchema,
  loginSchema,
  nuovaPasswordSchema,
  richiestaResetSchema,
} from '@/features/auth/schemas/auth.schemas';

describe('loginSchema', () => {
  it('normalizza l’email (trim + minuscole)', () => {
    const esito = loginSchema.safeParse({
      email: '  Mario.Rossi@Esempio.IT ',
      password: 'segreta',
    });
    expect(esito.success).toBe(true);
    expect(esito.success && esito.data.email).toBe('mario.rossi@esempio.it');
  });

  it('rifiuta un’email non valida', () => {
    const esito = loginSchema.safeParse({ email: 'non-una-email', password: 'segreta' });
    expect(esito.success).toBe(false);
    expect(esito.success ? [] : esito.error.issues.map((i) => i.path[0])).toContain('email');
  });

  it('richiede la password', () => {
    const esito = loginSchema.safeParse({ email: 'mario@esempio.it', password: '' });
    expect(esito.success).toBe(false);
  });
});

describe('richiestaResetSchema', () => {
  it('accetta solo l’email', () => {
    expect(richiestaResetSchema.safeParse({ email: 'mario@esempio.it' }).success).toBe(true);
    expect(richiestaResetSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('nuovaPasswordSchema', () => {
  const valida = 'Password1';

  it('accetta una password conforme con conferma uguale', () => {
    expect(nuovaPasswordSchema.safeParse({ password: valida, conferma: valida }).success).toBe(
      true,
    );
  });

  it.each([
    ['troppo corta', 'Pass1'],
    ['senza maiuscola', 'password1'],
    ['senza minuscola', 'PASSWORD1'],
    ['senza numero', 'Passwordd'],
  ])('rifiuta una password %s', (_caso, password) => {
    expect(nuovaPasswordSchema.safeParse({ password, conferma: password }).success).toBe(false);
  });

  it('segnala la conferma diversa sul campo conferma', () => {
    const esito = nuovaPasswordSchema.safeParse({ password: valida, conferma: 'Password2' });
    expect(esito.success).toBe(false);
    const campi = esito.success ? [] : esito.error.issues.map((i) => i.path[0]);
    expect(campi).toContain('conferma');
  });
});

describe('cambioPasswordSchema', () => {
  it('rifiuta una nuova password uguale a quella attuale', () => {
    const esito = cambioPasswordSchema.safeParse({
      passwordAttuale: 'Password1',
      password: 'Password1',
      conferma: 'Password1',
    });
    expect(esito.success).toBe(false);
    const campi = esito.success ? [] : esito.error.issues.map((i) => i.path[0]);
    expect(campi).toContain('password');
  });

  it('accetta un cambio valido', () => {
    const esito = cambioPasswordSchema.safeParse({
      passwordAttuale: 'Password1',
      password: 'NuovaPass2',
      conferma: 'NuovaPass2',
    });
    expect(esito.success).toBe(true);
  });
});
