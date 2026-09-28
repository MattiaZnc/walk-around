import { LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

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

/**
 * Profilo e uscita in un unico menu.
 * Il profilo non è una destinazione quotidiana come i giorni e i report: nella
 * navigazione principale occupava spazio a scapito di quelle, ma da qualche
 * parte deve restare raggiungibile, perché contiene il punto di partenza
 * predefinito e il cambio password.
 */
export function MenuUtente({ etichettaVisibile = false }: { etichettaVisibile?: boolean }) {
  const { user } = useAuth();
  const logout = useLogout();

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

      <DropdownMenuContent align="end" className="max-w-[16rem]">
        {user?.email ? (
          <>
            <DropdownMenuLabel className="truncate font-normal">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem asChild>
          <Link to="/profilo">
            <UserRound aria-hidden />
            Profilo
          </Link>
        </DropdownMenuItem>

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
