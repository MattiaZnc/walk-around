import { Flag, Home, MapPinned } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Luogo } from '@/features/itinerary/api/percorsi.api';
import { RicercaLuogo } from '@/features/itinerary/components/ricerca-luogo';
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

  const conferma = (partenza: PartenzaScelta) => {
    onConferma(partenza);
  };

  const contenuto = (
    <div className="space-y-5">
      {profilo ? (
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

            <Button
              className="w-full"
              loading={inCorso}
              disabled={nome.trim() === ''}
              onClick={() => {
                conferma({
                  label: nome.trim() === '' ? scelto.nome : nome.trim(),
                  address: scelto.indirizzo || scelto.etichetta,
                  lat: scelto.lat,
                  lng: scelto.lng,
                });
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
          <Button
            variant="outline"
            className="w-full"
            loading={inCorso}
            disabled={nome.trim() === ''}
            onClick={() => {
              conferma({ label: nome.trim(), address: null, lat: null, lng: null });
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
