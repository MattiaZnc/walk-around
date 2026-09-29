import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPinOff } from 'lucide-react';
import * as React from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { useTheme } from '@/components/layout/theme-provider';
import { Button } from '@/components/ui/button';
import type { Geometria } from '@/features/itinerary/api/percorsi.api';
import { distanzaLeggibile, type Posizione } from '@/features/itinerary/lib/prossimita';
import { oraDiArrivo } from '@/features/itinerary/lib/prossimita-formato';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import { configurazioneTile } from '@/features/itinerary/lib/tile-mappa';
import { durata, km, oraBreve } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Stop } from '@/types/models';

type Props = {
  tappe: Stop[];
  tratte: Tratta[];
  /** Posizione corrente, quando "Seguimi" è attivo. */
  posizione?: Posizione | null;
  /**
   * Percorso del navigatore ([lat, lng]), quando la guida è attiva: la mappa
   * si ingrandisce, segue la posizione e disegna la strada da fare.
   */
  percorsoGuida?: [number, number][] | null;
  className?: string;
};

/** Blu del navigatore: lo stesso del puntino della posizione, distinto dal verde del giro. */
const BLU_GUIDA = '#2563eb';

/** Centro di ripiego quando nessuna tappa ha coordinate (centro Italia). */
const CENTRO_PREDEFINITO: [number, number] = [41.9028, 12.4964];

/**
 * Marker numerato disegnato come HTML: un'icona immagine per ogni numero
 * richiederebbe file separati, e i `divIcon` restano nitidi su schermi retina.
 */
function iconaNumerata(numero: number, partenza: boolean, raggiunta: boolean): L.DivIcon {
  // La partenza si distingue a colpo d'occhio: è il punto da cui si misurano
  // i chilometri, non una tappa qualsiasi. Le tappe raggiunte mostrano una
  // spunta al posto del numero.
  const colore = raggiunta
    ? 'hsl(var(--reached-foreground))'
    : partenza
      ? 'hsl(var(--foreground))'
      : 'hsl(var(--primary))';

  // Spunta disegnata come SVG: un carattere di testo cambia forma da un
  // dispositivo all'altro e non si allinea al centro.
  const contenuto = raggiunta
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
    : String(numero);

  return L.divIcon({
    className: 'marker-tappa',
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:9999px;
      background:${colore};color:${raggiunta ? 'hsl(var(--reached))' : 'hsl(var(--background))'};
      font:600 13px/1 system-ui,sans-serif;
      box-shadow:0 1px 4px rgb(0 0 0 / .4);
      border:${partenza ? '3px solid hsl(var(--primary))' : '2px solid hsl(var(--background))'};
    ">${contenuto}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

/** Punto blu della posizione corrente, distinto dai marker delle tappe. */
function iconaPosizione(): L.DivIcon {
  return L.divIcon({
    className: 'marker-posizione',
    html: `<span style="
      display:block;width:16px;height:16px;border-radius:9999px;
      background:#2563eb;border:3px solid #fff;
      box-shadow:0 0 0 1px rgb(0 0 0 / .3);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Converte la geometria GeoJSON ([lng,lat]) nell'ordine usato da Leaflet. */
function perLeaflet(geometria: Geometria): [number, number][] {
  return geometria.coordinates.map(([lng, lat]) => [lat, lng]);
}

function isGeometria(valore: unknown): valore is Geometria {
  if (typeof valore !== 'object' || valore === null) return false;
  const candidato = valore as { type?: unknown; coordinates?: unknown };
  return candidato.type === 'LineString' && Array.isArray(candidato.coordinates);
}

/** Inquadra automaticamente tutti i punti del giro. */
function AdattaVista({ punti }: { punti: [number, number][] }) {
  const mappa = useMap();
  // Stringa stabile: evita di rifare l'inquadratura a ogni render con gli
  // stessi punti, che annullerebbe lo zoom fatto a mano dall'utente.
  const firma = punti.map(([lat, lng]) => `${lat},${lng}`).join('|');

  React.useEffect(() => {
    if (punti.length === 0) return;

    const inquadra = () => {
      // Leaflet misura il riquadro quando viene creato. Se in quel momento il
      // layout non è ancora definitivo (caricamento dei font, pannelli che si
      // assestano) la misura è sbagliata e fitBounds calcola lo zoom su un
      // riquadro diverso da quello visibile: la mappa restava su mezza Roma
      // per un giro di tre chilometri. invalidateSize rilegge le dimensioni.
      mappa.invalidateSize();

      if (punti.length === 1) {
        const solo = punti[0];
        if (solo) mappa.setView(solo, 15);
        return;
      }
      mappa.fitBounds(L.latLngBounds(punti), { padding: [32, 32], maxZoom: 16 });
    };

    mappa.whenReady(inquadra);
    // Un secondo tentativo a layout assestato: costa niente e copre i casi in
    // cui il primo arriva troppo presto.
    const timer = window.setTimeout(inquadra, 250);
    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `firma` rappresenta `punti`
  }, [firma, mappa]);

  return null;
}

/**
 * Se il riquadro cambia dimensione (rotazione del telefono, colonne su
 * desktop, mappa che si allunga in guida) Leaflet va avvisato, altrimenti
 * restano zone grigie.
 */
function SeguiDimensioni() {
  const mappa = useMap();

  React.useEffect(() => {
    const contenitore = mappa.getContainer();
    if (typeof ResizeObserver === 'undefined') return;
    const osservatore = new ResizeObserver(() => {
      mappa.invalidateSize();
    });
    osservatore.observe(contenitore);
    return () => {
      osservatore.disconnect();
    };
  }, [mappa]);

  return null;
}

/**
 * Durante la guida la mappa resta centrata sulla posizione, come in un
 * navigatore. Se l'utente la sposta con il dito smette di seguirlo finché non
 * tocca "Ricentra": strapparla via mentre si guarda altrove è irritante.
 */
function SeguiPosizione({
  posizione,
  segui,
  onSmettiDiSeguire,
}: {
  posizione: Posizione | null;
  segui: boolean;
  onSmettiDiSeguire: () => void;
}) {
  const mappa = useMap();

  React.useEffect(() => {
    mappa.on('dragstart', onSmettiDiSeguire);
    return () => {
      mappa.off('dragstart', onSmettiDiSeguire);
    };
  }, [mappa, onSmettiDiSeguire]);

  React.useEffect(() => {
    if (!segui || !posizione) return;
    mappa.setView([posizione.lat, posizione.lng], Math.max(mappa.getZoom(), 17), {
      animate: true,
    });
  }, [mappa, segui, posizione]);

  return null;
}

export function MappaGiornata({ tappe, tratte, posizione, percorsoGuida, className }: Props) {
  const { resolvedTheme } = useTheme();
  const inGuida = percorsoGuida !== undefined && percorsoGuida !== null;
  const [segui, setSegui] = React.useState(true);
  const smettiDiSeguire = React.useCallback(() => {
    setSegui(false);
  }, []);

  // Ogni nuova guida riparte centrata sulla posizione.
  React.useEffect(() => {
    if (inGuida) setSegui(true);
  }, [inGuida]);

  const tappeConCoordinate = tappe
    .map((tappa, indice) => ({ tappa, numero: indice + 1 }))
    .filter(
      (voce): voce is { tappa: Stop & { lat: number; lng: number }; numero: number } =>
        voce.tappa.lat !== null && voce.tappa.lng !== null,
    );

  const percorsi = tratte
    .map((tratta) => {
      const geometria = tratta.leg?.route_geometry;
      if (isGeometria(geometria)) {
        return {
          chiave: tratta.chiave,
          punti: perLeaflet(geometria),
          stimato: tratta.leg?.is_estimate ?? false,
        };
      }

      // Senza geometria si collega comunque i due estremi, se noti: dà il senso
      // del giro anche quando il provider non ha restituito il tracciato.
      const da = tratta.fromStop;
      const a = tratta.toStop;
      if (da.lat === null || da.lng === null || a.lat === null || a.lng === null) return null;

      return {
        chiave: tratta.chiave,
        punti: [
          [da.lat, da.lng],
          [a.lat, a.lng],
        ] as [number, number][],
        stimato: true,
      };
    })
    .filter(
      (percorso): percorso is { chiave: string; punti: [number, number][]; stimato: boolean } =>
        percorso !== null,
    );

  const puntiPerInquadratura: [number, number][] = [
    ...tappeConCoordinate.map(({ tappa }) => [tappa.lat, tappa.lng] as [number, number]),
    ...percorsi.flatMap((percorso) => percorso.punti),
  ];

  if (tappeConCoordinate.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 p-6 text-center',
          className,
        )}
      >
        <MapPinOff className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Nessuna tappa sulla mappa</p>
        <p className="text-xs text-muted-foreground">
          Cerca il nome del luogo quando crei la tappa (es. “Colosseo”): le coordinate arrivano da
          sole.
        </p>
      </div>
    );
  }

  const tile = configurazioneTile(resolvedTheme === 'dark');

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border',
        // Il filtro agisce solo sulle mattonelle: marker e tracciato
        // restano dei loro colori (vedi index.css).
        tile.filtraPerTemaScuro && 'mappa-tema-scuro',
        className,
      )}
    >
      {/* Altezza sul contenitore e non su MapContainer: react-leaflet applica
          className solo alla creazione, e in guida la mappa deve allungarsi. */}
      <div
        className={
          inGuida
            ? // In guida la mappa è lo strumento principale: più spazio.
              'h-[45dvh] md:h-[calc(100dvh-14rem)]'
            : 'h-[260px] sm:h-[360px] md:h-[calc(100dvh-14rem)]'
        }
      >
        <MapContainer
          center={puntiPerInquadratura[0] ?? CENTRO_PREDEFINITO}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full"
          // Leaflet non è navigabile da tastiera in modo utile: il contenuto
          // informativo resta disponibile nell'elenco tappe accanto.
          aria-label="Mappa dell'itinerario"
        >
          <TileLayer url={tile.url} attribution={tile.attribuzione} maxZoom={tile.maxZoom} />

          <SeguiDimensioni />

          {/* In guida l'inquadratura la decide la posizione, non il giro. */}
          {inGuida ? (
            <SeguiPosizione
              posizione={posizione ?? null}
              segui={segui}
              onSmettiDiSeguire={smettiDiSeguire}
            />
          ) : (
            <AdattaVista punti={puntiPerInquadratura} />
          )}

          {percorsi.map((percorso) => (
            <Polyline
              key={percorso.chiave}
              positions={percorso.punti}
              pathOptions={{
                color: 'hsl(var(--primary))',
                weight: 4,
                // In guida il giro resta sullo sfondo: conta la strada da fare ora.
                opacity: inGuida ? 0.35 : 0.85,
                // Tratteggio per i percorsi stimati: si vede subito che non è
                // un tracciato stradale reale.
                dashArray: percorso.stimato ? '6 8' : undefined,
              }}
            />
          ))}

          {inGuida ? (
            <>
              {/* Bordo bianco sotto la linea: resta leggibile sopra qualunque strada. */}
              <Polyline
                positions={percorsoGuida}
                pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }}
              />
              <Polyline
                positions={percorsoGuida}
                pathOptions={{ color: BLU_GUIDA, weight: 6, opacity: 0.95 }}
              />
            </>
          ) : null}

          {/* Posizione corrente: il cerchio rappresenta l'incertezza del
            segnale, così si capisce quanto fidarsi del puntino. */}
          {posizione ? (
            <>
              <Circle
                center={[posizione.lat, posizione.lng]}
                radius={posizione.accuratezza}
                pathOptions={{
                  color: '#2563eb',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.15,
                  weight: 1,
                }}
              />
              <Marker
                position={[posizione.lat, posizione.lng]}
                icon={iconaPosizione()}
                title="La tua posizione"
              />
            </>
          ) : null}

          {tappeConCoordinate.map(({ tappa, numero }) => (
            <Marker
              key={tappa.id}
              position={[tappa.lat, tappa.lng]}
              icon={iconaNumerata(numero, tappa.is_start, tappa.reached_at !== null)}
              title={`${numero}. ${tappa.label}${tappa.is_start ? ' (partenza)' : ''}${
                tappa.reached_at !== null ? ' — raggiunta' : ''
              }`}
            >
              <Popup>
                <p className="font-semibold">
                  {numero}. {tappa.label}
                </p>
                {tappa.is_start ? (
                  <p className="text-xs font-medium">Punto di partenza della giornata</p>
                ) : null}
                {tappa.reached_at !== null ? (
                  <p className="text-xs font-medium">
                    Raggiunta
                    {oraDiArrivo(tappa.reached_at) ? ` alle ${oraDiArrivo(tappa.reached_at)}` : ''}
                  </p>
                ) : null}
                {tappa.address ? <p className="text-xs">{tappa.address}</p> : null}
                {tappa.planned_time ? (
                  <p className="text-xs">Orario previsto: {oraBreve(tappa.planned_time)}</p>
                ) : null}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {inGuida && !segui ? (
        <Button
          size="sm"
          onClick={() => {
            setSegui(true);
          }}
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
        >
          <LocateFixed aria-hidden />
          Ricentra
        </Button>
      ) : null}

      {/* Riepilogo testuale: la mappa da sola non è accessibile */}
      <ol className="sr-only">
        {posizione ? (
          <li>
            La tua posizione è nota con una precisione di circa{' '}
            {distanzaLeggibile(posizione.accuratezza)}.
          </li>
        ) : null}

        {tappeConCoordinate.map(({ tappa, numero }) => (
          <li key={tappa.id}>
            Tappa {numero}: {tappa.label}
            {tappa.reached_at !== null ? ' (raggiunta)' : ''}
          </li>
        ))}
        {tratte.map((tratta) =>
          tratta.leg ? (
            <li key={tratta.chiave}>
              {tratta.rientro ? 'Rientro' : 'Tratta'} da {tratta.fromStop.label} a{' '}
              {tratta.toStop.label}: {km(tratta.leg.distance_km)}, {durata(tratta.leg.duration_min)}
            </li>
          ) : null,
        )}
      </ol>
    </div>
  );
}
