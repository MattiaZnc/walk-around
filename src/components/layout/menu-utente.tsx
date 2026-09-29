import { LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { useTheme, type Theme } from '@/components/layout/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/api/auth-provider';
import { useLogout } from '@/features/auth/api/use-auth-mutations';
import { cn } from '@/lib/utils';

const TEMI: { valore: Theme; etichetta: string; icona: typeof Sun }[] = [
  { valore: 'light', etichetta: 'Chiaro', icona: Sun },
  { valore: 'dark', etichetta: 'Scuro', icona: Moon },
  { valore: 'system', etichetta: 'Automatico', icona: Monitor },
];

/**
 * Account, tema e uscita in un unico menu.
 * Il cambio tema stava in un'icona a forma di monitor nell'intestazione, che
 * a colpo d'occhio non diceva cosa facesse: qui ha un'etichetta.
 */
export function MenuUtente({ etichettaVisibile = false }: { etichettaVisibile?: boolean }) {
  const { user } = useAuth();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={etichettaVisibile ? 'default' : 'icon'}
          className={etichettaVisibile ? 'w-full justify-start gap-2' : undefined}
          aria-label="Account e impostazioni"
        >
          <UserRound aria-hidden />
          {etichettaVisibile ? <span className="truncate">{user?.email ?? 'Account'}</span> : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {user?.email ? (
          <>
            <DropdownMenuLabel className="truncate font-normal">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        {TEMI.map(({ valore, etichetta, icona: Icona }) => (
          <DropdownMenuItem
            key={valore}
            // Il menu resta aperto: si vede subito l'effetto della scelta.
            onSelect={(evento) => {
              evento.preventDefault();
              setTheme(valore);
            }}
            aria-checked={theme === valore}
            role="menuitemradio"
            className={cn(theme === valore && 'font-medium text-primary')}
          >
            <Icona aria-hidden />
            {etichetta}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            logout.mutate(undefined, {
              onError: (errore) => {
                toast.error(errore.message);
              },
            });
          }}
        >
          <LogOut aria-hidden />
          Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
