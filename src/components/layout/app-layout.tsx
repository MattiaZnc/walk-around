import { CalendarDays, FileText, LogOut, Route as RouteIcon, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { toast } from 'sonner';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/api/use-auth-mutations';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

type VoceNav = {
  to: string;
  etichetta: string;
  icona: typeof CalendarDays;
};

const VOCI: VoceNav[] = [
  { to: '/', etichetta: 'Giorni', icona: CalendarDays },
  { to: '/report', etichetta: 'Report', icona: FileText },
  { to: '/profilo', etichetta: 'Profilo', icona: UserRound },
];

function BottoneLogout({ compatto = false }: { compatto?: boolean }) {
  const logout = useLogout();

  return (
    <Button
      variant="ghost"
      size={compatto ? 'icon' : 'default'}
      loading={logout.isPending}
      onClick={() => {
        logout.mutate(undefined, {
          onError: (errore) => {
            toast.error(errore.message);
          },
        });
      }}
      aria-label="Esci"
      className={compatto ? undefined : 'w-full justify-start gap-2'}
    >
      <LogOut aria-hidden />
      {compatto ? null : 'Esci'}
    </Button>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      {/* Header: unico su mobile, ridotto su desktop dove c'è la sidebar */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <RouteIcon className="size-5 text-primary" aria-hidden />
            {env.VITE_APP_NAME}
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <BottoneLogout compatto />
          </div>
        </div>
      </header>

      <div className="md:flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
          <span className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold">
            <RouteIcon className="size-5 text-primary" aria-hidden />
            {env.VITE_APP_NAME}
          </span>

          <nav aria-label="Navigazione principale" className="flex flex-col gap-1">
            {VOCI.map(({ to, etichetta, icona: Icona }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Icona className="size-4" aria-hidden />
                {etichetta}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-1">
            <div className="px-1">
              <ThemeToggle />
            </div>
            <BottoneLogout />
          </div>
        </aside>

        {/* Contenuto: padding-bottom per non finire sotto la bottom nav */}
        <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation mobile */}
      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="flex">
          {VOCI.map(({ to, etichetta, icona: Icona }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-touch flex-col items-center justify-center gap-1 py-2 text-xs font-medium',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icona className="size-5" aria-hidden />
                    {etichetta}
                    <span className="sr-only">{isActive ? '(pagina corrente)' : ''}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
