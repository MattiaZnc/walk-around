import { Route as RouteIcon } from 'lucide-react';
import { Outlet } from 'react-router-dom';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { env } from '@/lib/env';

/** Cornice delle pagine pubbliche (login, reset password). */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="flex items-center justify-between p-4">
        <span className="flex items-center gap-2 font-semibold">
          <RouteIcon className="size-5 text-primary" aria-hidden />
          {env.VITE_APP_NAME}
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-muted-foreground">
        Gli account sono creati dall’amministratore.
      </footer>
    </div>
  );
}
