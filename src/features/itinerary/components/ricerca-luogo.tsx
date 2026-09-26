import { Check, Loader2, MapPin, Search } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Coordinate, Luogo } from '@/features/itinerary/api/percorsi.api';
import { useCercaLuoghi, useCoordinataStabile } from '@/features/itinerary/api/use-ricalcolo';
import { useDebounce } from '@/lib/use-debounce';

type Props = {
  /** Punto di riferimento per dare priorità ai risultati vicini. */
  vicinoA?: Coordinate | null;
  onScelta: (luogo: Luogo) => void;
};

/**
 * Ricerca di un luogo per nome o indirizzo ("Colosseo", "Via Roma 1 Milano").
 * Scegliendo un risultato, nome, indirizzo e coordinate vengono compilati
 * insieme: senza coordinate i chilometri non si possono calcolare.
 *
 * Combobox scritto a mano invece di una libreria: serve un elenco semplice con
 * navigazione da tastiera, e un componente Command completo porterebbe molte
 * dipendenze per poco.
 */
export function RicercaLuogo({ vicinoA, onScelta }: Props) {
  const [testo, setTesto] = React.useState('');
  const [indiceAttivo, setIndiceAttivo] = React.useState(-1);
  const [scelto, setScelto] = React.useState<string | null>(null);

  const testoRitardato = useDebounce(testo, 350);
  const riferimento = useCoordinataStabile(vicinoA ?? null);
  const ricerca = useCercaLuoghi(testoRitardato, riferimento);

  const luoghi = ricerca.data ?? [];
  const mostraElenco = testo.trim().length >= 3 && scelto === null;
  const idElenco = React.useId();

  const seleziona = (luogo: Luogo) => {
    onScelta(luogo);
    setScelto(luogo.etichetta);
    setTesto(luogo.etichetta);
    setIndiceAttivo(-1);
  };

  const onKeyDown = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mostraElenco || luoghi.length === 0) return;

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setIndiceAttivo((corrente) => (corrente + 1) % luoghi.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setIndiceAttivo((corrente) => (corrente <= 0 ? luoghi.length - 1 : corrente - 1));
    } else if (evento.key === 'Enter' && indiceAttivo >= 0) {
      evento.preventDefault();
      const luogo = luoghi[indiceAttivo];
      if (luogo) seleziona(luogo);
    } else if (evento.key === 'Escape') {
      setIndiceAttivo(-1);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idElenco}-campo`}>Cerca il luogo</Label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={`${idElenco}-campo`}
          value={testo}
          onChange={(evento) => {
            setTesto(evento.target.value);
            setScelto(null);
            setIndiceAttivo(-1);
          }}
          onKeyDown={onKeyDown}
          placeholder="Es. Colosseo, oppure Via Roma 1 Milano"
          className="pl-9 pr-10"
          autoComplete="off"
          role="combobox"
          aria-expanded={mostraElenco && luoghi.length > 0}
          aria-controls={idElenco}
          aria-autocomplete="list"
          aria-activedescendant={
            indiceAttivo >= 0 ? `${idElenco}-opzione-${String(indiceAttivo)}` : undefined
          }
        />
        {ricerca.isFetching ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
        {scelto !== null ? (
          <Check
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
            aria-hidden
          />
        ) : null}
      </div>

      {/* Stato della ricerca annunciato agli screen reader */}
      <p aria-live="polite" className="sr-only">
        {mostraElenco && luoghi.length > 0
          ? `${String(luoghi.length)} risultati trovati`
          : mostraElenco && ricerca.isSuccess
            ? 'Nessun risultato'
            : ''}
      </p>

      {mostraElenco ? (
        <div id={idElenco} role="listbox" aria-label="Risultati della ricerca">
          {ricerca.isError ? (
            <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
              Ricerca non disponibile: {ricerca.error.message} Puoi inserire nome e coordinate a
              mano qui sotto.
            </p>
          ) : null}

          {ricerca.isSuccess && luoghi.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Nessun luogo trovato. Prova con un nome più preciso, oppure compila i campi a mano.
            </p>
          ) : null}

          {luoghi.length > 0 ? (
            <ul className="max-h-60 divide-y overflow-y-auto rounded-md border">
              {luoghi.map((luogo, indice) => (
                <li key={`${luogo.etichetta}-${String(luogo.lat)}-${String(luogo.lng)}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    id={`${idElenco}-opzione-${String(indice)}`}
                    role="option"
                    aria-selected={indice === indiceAttivo}
                    className={`h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-left ${
                      indice === indiceAttivo ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      seleziona(luogo);
                    }}
                    onMouseEnter={() => {
                      setIndiceAttivo(indice);
                    }}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{luogo.nome}</span>
                      {luogo.indirizzo ? (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {luogo.indirizzo}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
