import { Flag, Home, MapPin, MapPinned, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Luogo } from '@/features/itinerary/api/percorsi.api';
import { RicercaLuogo } from '@/features/itinerary/components/ricerca-luogo';
import {
  useEliminaPartenza,
  usePartenze,
  useSalvaPartenza,
} from '@/features/partenze/api/use-partenze';
import { giaSalvata } from '@/features/partenze/lib/partenze';
import type { PuntoDiPartenza } from '@/features/profile/api/use-profilo';
import { dataLunga } from '@/lib/format';

export type PartenzaScelta = {
  label: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type Props = {
  data: string;
  /** Indirizzo predefinito del profilo, se impostato. */
  profilo: PuntoDiPartenza | null;
  inCorso: boolean;
  /**
   * true quando il pannello è già dentro un dialog che ha il suo titolo:
   * ripetere intestazione e cornice sarebbe rumore.
   */
  senzaIntestazione?: boolean;
  onConferma: (partenza: PartenzaScelta) => void;
};

/**
 * Primo passo di una giornata nuova: da dove si parte.
 * Serve prima delle altre tappe perché i chilometri si misurano a partire da
 * qui: senza un punto di partenza il primo spostamento non esisterebbe.
 *
 * La partenza viene salvata come tappa numero 1 marcata `is_start`, così le
 * tratte restano tutte dello stesso tipo (da una tappa a un'altra) e mappa,
 * totali e ricalcolo non hanno bisogno di casi particolari.
 */
export function SceltaPartenza({
  data,
  profilo,
  inCorso,
  senzaIntestazione = false,
  onConferma,
}: Props) {
  const [scelto, setScelto] = React.useState<Luogo | null>(null);
  const [nome, setNome] = React.useState('');
  const [salva, setSalva] = React.useState(true);

  const partenzeQuery = usePartenze();
  const salvaPartenza = useSalvaPartenza();
  const eliminaPartenza = useEliminaPartenza();
  const salvate = partenzeQuery.data ?? [];

  const conferma = (partenza: PartenzaScelta, daSalvare = false) => {
    // Il salvataggio non blocca la giornata: se fallisce lo si dice, ma si
    // parte lo stesso.
    if (daSalvare && !giaSalvata(salvate, partenza)) {
      salvaPartenza.mutate(partenza, {
        onSuccess: (salvata) => {
          toast.success(`"${salvata.label}" aggiunta alle tue partenze`);
        },
        onError: (errore) => {
          toast.error('Partenza non salvata', { description: errore.message });
        },
      });
    }
    onConferma(partenza);
  };

  // L'indirizzo del profilo si propone solo se non è già fra le partenze
  // salvate (l'aggiornamento del database lo copia lì come "Casa").
  const mostraProfilo =
    profilo !== null &&
    !giaSalvata(salvate, {
      label: profilo.indirizzo,
      address: profilo.indirizzo,
      lat: profilo.lat,
      lng: profilo.lng,
    }) &&
    !salvate.some((salvata) => salvata.address === profilo.indirizzo);

  const interruttoreSalva = (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="salva-partenza" className="font-normal">
        Salva tra le mie partenze
      </Label>
      <Switch id="salva-partenza" checked={salva} onCheckedChange={setSalva} />
    </div>
  );

  const contenuto = (
    <div className="space-y-5">
      {salvate.length > 0 ? (
        <section aria-labelledby="titolo-partenze" className="space-y-2">
          <h3 id="titolo-partenze" className="text-sm font-medium">
            Le tue partenze
          </h3>
          <ul className="space-y-2">
            {salvate.map((salvata) => (
              <li key={salvata.id} className="flex items-stretch gap-2">
                <Button
                  variant="outline"
                  className="h-auto min-h-touch flex-1 justify-start gap-3 py-2 text-left"
                  disabled={inCorso}
                  onClick={() => {
                    conferma({
                      label: salvata.label,
                      address: salvata.address,
                      lat: salvata.lat,
                      lng: salvata.lng,
                    });
                  }}
                >
                  <MapPin className="text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{salvata.label}</span>
                    {salvata.address ? (
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {salvata.address}
                      </span>
                    ) : null}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-auto text-muted-foreground hover:text-destructive"
                  aria-label={`Elimina la partenza ${salvata.label}`}
                  onClick={() => {
                    eliminaPartenza.mutate(salvata.id, {
                      onSuccess: () => {
                        toast.info(`"${salvata.label}" tolta dalle tue partenze`);
                      },
                    });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mostraProfilo ? (
        <div className="space-y-2">
          <Button
            className="w-full justify-start gap-2 text-left"
            loading={inCorso}
            onClick={() => {
              conferma({
                label: 'Partenza',
                address: profilo.indirizzo,
                lat: profilo.lat,
                lng: profilo.lng,
              });
            }}
          >
            <Home aria-hidden />
            <span className="min-w-0 truncate">Parti da {profilo.indirizzo}</span>
          </Button>
          <p className="text-xs text-muted-foreground">
            È l’indirizzo predefinito del tuo profilo.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {salvate.length > 0 ? (
          <p className="text-sm font-medium">Oppure parti da un altro posto</p>
        ) : null}
        <RicercaLuogo
          vicinoA={
            profilo?.lat !== null && profilo?.lat !== undefined && profilo.lng !== null
              ? { lat: profilo.lat, lng: profilo.lng }
              : null
          }
          onScelta={(luogo) => {
            setScelto(luogo);
            setNome(luogo.nome);
          }}
        />

        {scelto ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="flex items-start gap-2 text-sm">
              <MapPinned className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-medium">{scelto.nome}</span>
                <span className="block text-xs text-muted-foreground">{scelto.indirizzo}</span>
              </span>
            </p>

            <div className="space-y-2">
              <Label htmlFor="nome-partenza">Come vuoi chiamare questa tappa?</Label>
              <Input
                id="nome-partenza"
                value={nome}
                onChange={(evento) => {
                  setNome(evento.target.value);
                }}
                placeholder="Es. Casa, Hotel, Ufficio"
              />
            </div>

            {interruttoreSalva}

            <Button
              className="w-full"
              loading={inCorso}
              disabled={nome.trim() === ''}
              onClick={() => {
                conferma(
                  {
                    label: nome.trim() === '' ? scelto.nome : nome.trim(),
                    address: scelto.indirizzo || scelto.etichetta,
                    lat: scelto.lat,
                    lng: scelto.lng,
                  },
                  salva,
                );
              }}
            >
              <Flag aria-hidden />
              Parti da qui
            </Button>
          </div>
        ) : null}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Non trovo il posto: lo scrivo a mano
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="partenza-manuale">Nome del punto di partenza</Label>
            <Input
              id="partenza-manuale"
              value={nome}
              onChange={(evento) => {
                setNome(evento.target.value);
              }}
              placeholder="Es. Casa"
            />
          </div>
          {interruttoreSalva}
          <Button
            variant="outline"
            className="w-full"
            loading={inCorso}
            disabled={nome.trim() === ''}
            onClick={() => {
              conferma({ label: nome.trim(), address: null, lat: null, lng: null }, salva);
            }}
          >
            Usa questo nome, senza coordinate
          </Button>
          <p className="text-xs text-muted-foreground">
            Senza coordinate i chilometri delle tratte vanno inseriti a mano: puoi aggiungerle più
            tardi modificando la tappa.
          </p>
        </div>
      </details>
    </div>
  );

  if (senzaIntestazione) return contenuto;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="size-5 text-primary" aria-hidden />
          Da dove parti?
        </CardTitle>
        <CardDescription>
          {dataLunga(data)}: indica il punto di partenza. I chilometri della giornata si calcolano
          da qui.
        </CardDescription>
      </CardHeader>
      <CardContent>{contenuto}</CardContent>
    </Card>
  );
}
