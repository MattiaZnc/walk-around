import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import {
  accedi,
  cambiaPassword,
  esci,
  impostaNuovaPassword,
  richiediResetPassword,
} from '@/features/auth/api/auth.api';
import type {
  CambioPasswordInput,
  LoginInput,
  RichiestaResetInput,
} from '@/features/auth/schemas/auth.schemas';
import type { AppError } from '@/lib/errors';

export function useLogin(): UseMutationResult<void, AppError, LoginInput> {
  return useMutation({
    mutationKey: ['auth', 'login'],
    mutationFn: async ({ email, password }: LoginInput) => {
      await accedi(email, password);
    },
  });
}

export function useLogout(): UseMutationResult<void, AppError, void> {
  return useMutation({
    mutationKey: ['auth', 'logout'],
    mutationFn: esci,
  });
}

export function useRichiestaReset(): UseMutationResult<void, AppError, RichiestaResetInput> {
  return useMutation({
    mutationKey: ['auth', 'reset-request'],
    mutationFn: async ({ email }: RichiestaResetInput) => {
      await richiediResetPassword(email);
    },
  });
}

export function useImpostaNuovaPassword(): UseMutationResult<void, AppError, { password: string }> {
  return useMutation({
    mutationKey: ['auth', 'set-password'],
    mutationFn: async ({ password }: { password: string }) => {
      await impostaNuovaPassword(password);
    },
  });
}

export function useCambioPassword(
  email: string,
): UseMutationResult<void, AppError, CambioPasswordInput> {
  return useMutation({
    mutationKey: ['auth', 'change-password'],
    mutationFn: async ({ passwordAttuale, password }: CambioPasswordInput) => {
      await cambiaPassword(email, passwordAttuale, password);
    },
  });
}
