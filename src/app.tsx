import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/api/auth-provider';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/routes/router';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* AuthProvider sta dentro QueryClientProvider: al logout svuota la cache */}
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
