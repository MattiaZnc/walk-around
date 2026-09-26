import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme, type Theme } from '@/components/layout/theme-provider';
import { Button } from '@/components/ui/button';

const PROSSIMO: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ETICHETTA: Record<Theme, string> = {
  light: 'Tema chiaro',
  dark: 'Tema scuro',
  system: 'Tema di sistema',
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(PROSSIMO[theme]);
      }}
      title={`${ETICHETTA[theme]} — passa a ${ETICHETTA[PROSSIMO[theme]].toLowerCase()}`}
      aria-label={`${ETICHETTA[theme]}. Premi per passare a ${ETICHETTA[PROSSIMO[theme]].toLowerCase()}`}
    >
      {theme === 'light' ? <Sun aria-hidden /> : null}
      {theme === 'dark' ? <Moon aria-hidden /> : null}
      {theme === 'system' ? <Monitor aria-hidden /> : null}
    </Button>
  );
}
