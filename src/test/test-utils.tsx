import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ThemeProvider } from '@/components/layout/theme-provider';

/** QueryClient isolato e silenzioso: niente retry né log tra i test. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

type Opzioni = Omit<RenderOptions, 'wrapper'> & {
  route?: string;
  queryClient?: QueryClient;
};

/** Render con i provider dell'app (router in memoria, query client, tema). */
export function renderConProvider(
  ui: ReactElement,
  { route = '/', queryClient = createTestQueryClient(), ...opzioni }: Opzioni = {},
): RenderResult & { queryClient: QueryClient } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...opzioni }), queryClient };
}
