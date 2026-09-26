import * as React from 'react';

export type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const CHIAVE_STORAGE = 'walk-around-theme';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function leggiTemaSalvato(): Theme {
  try {
    const salvato = localStorage.getItem(CHIAVE_STORAGE);
    if (salvato === 'light' || salvato === 'dark' || salvato === 'system') return salvato;
  } catch {
    // localStorage non disponibile (navigazione privata): si usa il default.
  }
  return 'system';
}

function preferenzaSistema(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(leggiTemaSalvato);
  const [sistema, setSistema] = React.useState<ResolvedTheme>(preferenzaSistema);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (evento: MediaQueryListEvent) => {
      setSistema(evento.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? sistema : theme;

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = React.useCallback((nuovo: Theme) => {
    setThemeState(nuovo);
    try {
      localStorage.setItem(CHIAVE_STORAGE, nuovo);
    } catch {
      // Preferenza non persistita: accettabile.
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme richiede <ThemeProvider>');
  return context;
}
