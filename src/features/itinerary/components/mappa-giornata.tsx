import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@maplibre/maplibre-gl-leaflet';
import type maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, MapPinOff } from 'lucide-react';
import * as React from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { useTheme } from '@/components/layout/theme-provider';
import { Button } from '@/components/ui/button';
import type { Geometria } from '@/features/itinerary/api/percorsi.api';
import { distanzaLeggibile, type Posizione } from '@/features/itinerary/lib/prossimita';
import { oraDiArrivo } from '@/features/itinerary/lib/prossimita-formato';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import { ATTRIBUZIONE_OSM, configurazioneTile } from '@/features/itinerary/lib/tile-mappa';
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

/**
 * Colori ispirati a Google Maps, per sembrare familiari a colpo d'occhio:
 * percorso blu con bordo più scuro, tappe come spilli rossi, posizione come
 * puntino blu con alone.
 */
const COLORI = {
  percorso: '#4285f4',
  bordoPercorso: '#1967d2',
  percorsoSecondario: '#9aa0a6',
  tappa: '#ea4335',
  bordoTappa: '#b31412',
  partenza: '#3c4043',
  raggiunta: '#34a853',
  bordoRaggiunta: '#137333',
  posizione: '#1a73e8',
} as const;

/** Centro di ripiego quando nessuna tappa ha coordinate (centro Italia). */
const CENTRO_PREDEFINITO: [number, number] = [41.9028, 12.4964];

/**
 * Spillo numerato disegnato come SVG: resta nitido su schermi retina e non
 * servono immagini separate per ogni numero. La punta indica il luogo esatto,
 * come su Google Maps.
 */
function iconaNumerata(numero: number, partenza: boolean, raggiunta: boolean): L.DivIcon {
  // La partenza si distingue a colpo d'occhio: è il punto da cui si misurano
  // i chilometri. Le tappe raggiunte diventano verdi con una spunta.
  const [riempimento, bordo] = raggiunta
    ? [COLORI.raggiunta, COLORI.bordoRaggiunta]
    : partenza
      ? [COLORI.partenza, '#202124']
      : [COLORI.tappa, COLORI.bordoTappa];

  const contenuto = raggiunta
    ? '<path d="M11 15.5l3.5 3.5 7-7.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    : `<text x="16" y="16" dy=".36em" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-weight="700" font-size="${numero > 9 ? 12 : 14}">${String(numero)}</text>`;

  return L.divIcon({
    className: 'marker-tappa',
    html: `<svg width="32" height="42" viewBox="0 0 32 42" style="display:block;filter:drop-shadow(0 2px 2px rgb(0 0 0 / .35))">
      <path d="M16 1C7.7 1 1 7.6 1 15.8c0 10.6 13.1 23.6 13.7 24.2a1.8 1.8 0 0 0 2.6 0C17.9 39.4 31 26.4 31 15.8 31 7.6 24.3 1 16 1z" fill="${riempimento}" stroke="${bordo}" stroke-width="1.5"/>
      ${contenuto}
    </svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 41],
    popupAnchor: [0, -38],
  });
}

/** Puntino blu con alone, come la posizione su Google Maps. */
function iconaPosizione(): L.DivIcon {
  return L.divIcon({
    className: 'marker-posizione',
    html: `<span style="
      display:block;width:20px;height:20px;border-radius:9999px;
      background:${COLORI.posizione};border:3px solid #fff;
      box-shadow:0 0 0 6px rgb(26 115 232 / .2),0 1px 4px rgb(0 0 0 / .4);
    "></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/**
 * Mappa vettoriale (MapLibre) come sfondo di Leaflet: marker e percorsi
 * restano gli stessi, cambia solo il disegno delle strade. Se lo stile non si
 * carica (rete assente, servizio giù) si avvisa il genitore, che torna alle
 * mattonelle di OpenStreetMap.
 */
/**
 * Gli stili di OpenFreeMap scrivono i nomi in inglese ("Rome"): si passa al
 * nome italiano dove esiste, altrimenti a quello locale. Solo le scritte che
 * usano il nome: numeri civici e sigle delle strade restano come sono.
 */
function nomiInItaliano(libre: maplibregl.Map) {
  for (const strato of libre.getStyle().layers) {
    if (strato.type !== 'symbol') continue;
    const testo: unknown = libre.getLayoutProperty(strato.id, 'text-field');
    if (!JSON.stringify(testo ?? null).includes('"name')) continue;
    libre.setLayoutProperty(strato.id, 'text-field', [
      'coalesce',
      ['get', 'name:it'],
      ['get', 'name'],
    ]);
  }
}

/**
 * Ricolora lo stile chiaro con la tavolozza di Google Maps: fondo grigio
 * chiaro, strade bianche con bordo grigio, solo le grandi arterie in giallo,
 * acqua azzurra e parchi verde tenue. Lo stile originale colora di giallo
 * quasi ogni strada e, a zoom di città, diventa una ragnatela che copre
 * tappe e percorso.
 */
const TAVOLOZZA_GOOGLE: [RegExp, string, string][] = [
  [/^background$/, 'background-color', '#f2f3f5'],
  [/^(park|landcover_wood|landcover_grass)$/, 'fill-color', '#cdebd3'],
  [/^landuse_residential$/, 'fill-color', '#eceef1'],
  [/^water$/, 'fill-color', '#a3d1f5'],
  [/^waterway_/, 'line-color', '#a3d1f5'],
  [/^building$/, 'fill-color', '#e3e5ea'],
  [/_motorway(_link)?_casing$/, 'line-color', '#e2b45a'],
  [/_motorway(_link)?$/, 'line-color', '#fcd77f'],
  [/_casing$/, 'line-color', '#d5d8de'],
  [
    /^(road|tunnel|bridge)_(link|minor|street|service_track|secondary_tertiary|trunk_primary)$/,
    'line-color',
    '#ffffff',
  ],
];

function aspettoTipoGoogle(libre: maplibregl.Map) {
  for (const strato of libre.getStyle().layers) {
    // Il primo modello che corrisponde vince: l'ordine dell'elenco conta.
    const voce = TAVOLOZZA_GOOGLE.find(([modello]) => modello.test(strato.id));
    if (!voce) continue;
    const [, proprieta, colore] = voce;
    try {
      libre.setPaintProperty(strato.id, proprieta, colore);
    } catch {
      // Proprietà non adatta al tipo di strato: lo si lascia com'è.
    }
  }
}

function SfondoVettoriale({
  stile,
  chiaro,
  onErrore,
}: {
  stile: string;
  chiaro: boolean;
  onErrore: () => void;
}) {
  const mappa = useMap();

  React.useEffect(() => {
    const strato = L.maplibreGL({ style: stile });
    strato.addTo(mappa);

    let caricata = false;
    const libre = strato.getMaplibreMap();
    libre.on('load', () => {
      caricata = true;
      nomiInItaliano(libre);
      if (chiaro) aspettoTipoGoogle(libre);
    });
    libre.on('error', () => {
      // Dopo il caricamento un errore riguarda una singola mattonella: la
      // mappa resta usabile e non vale la pena cambiare sfondo.
      if (!caricata) onErrore();
    });

    return () => {
      strato.remove();
    };
  }, [mappa, stile, chiaro, onErrore]);

  return null;
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

/** Attribuzione senza prefisso; lo stile vettoriale aggiunge da sé la sua. */
function AttribuzioneCompatta({ testo }: { testo: string }) {
  const mappa = useMap();
  React.useEffect(() => {
    const controllo = L.control.attribution({ prefix: false });
    controllo.addTo(mappa);
    if (testo) controllo.addAttribution(testo);
    return () => {
      controllo.remove();
    };
  }, [mappa, testo]);
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
  const [vettorialeFallita, setVettorialeFallita] = React.useState(false);
  const segnalaVettorialeFallita = React.useCallback(() => {
    setVettorialeFallita(true);
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
  const usaVettoriale = tile.stileVettoriale !== null && !vettorialeFallita;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border',
        // Il filtro agisce solo sulle mattonelle: marker e tracciato
        // restano dei loro colori (vedi index.css).
        !usaVettoriale && tile.filtraPerTemaScuro && 'mappa-tema-scuro',
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
          // Niente bandierina "Leaflet": l'attribuzione obbligatoria è quella
          // dei dati, e su telefono ogni riga in basso copre la mappa.
          attributionControl={false}
          className="h-full w-full"
          // Leaflet non è navigabile da tastiera in modo utile: il contenuto
          // informativo resta disponibile nell'elenco tappe accanto.
          aria-label="Mappa dell'itinerario"
        >
          {usaVettoriale && tile.stileVettoriale ? (
            <SfondoVettoriale
              stile={tile.stileVettoriale}
              chiaro={resolvedTheme !== 'dark'}
              onErrore={segnalaVettorialeFallita}
            />
          ) : (
            <TileLayer url={tile.url} maxZoom={19} />
          )}

          <AttribuzioneCompatta
            testo={usaVettoriale ? '' : tile.stileVettoriale ? ATTRIBUZIONE_OSM : tile.attribuzione}
          />
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

          {/* Due linee sovrapposte, una più larga e scura sotto: il bordo
              stacca il percorso da qualunque strada, come su Google Maps.
              In guida il giro diventa grigio: conta la strada da fare ora. */}
          {percorsi.map((percorso) =>
            percorso.stimato ? (
              // Tratteggio per i percorsi stimati: si vede subito che non è
              // un tracciato stradale reale.
              <Polyline
                key={percorso.chiave}
                positions={percorso.punti}
                pathOptions={{
                  color: inGuida ? COLORI.percorsoSecondario : COLORI.percorso,
                  weight: 5,
                  opacity: 0.9,
                  dashArray: '2 10',
                  lineCap: 'round',
                }}
              />
            ) : (
              <React.Fragment key={percorso.chiave}>
                <Polyline
                  positions={percorso.punti}
                  pathOptions={{
                    color: inGuida ? '#80868b' : COLORI.bordoPercorso,
                    weight: 8,
                    opacity: inGuida ? 0.5 : 1,
                    lineJoin: 'round',
                  }}
                />
                <Polyline
                  positions={percorso.punti}
                  pathOptions={{
                    color: inGuida ? COLORI.percorsoSecondario : COLORI.percorso,
                    weight: 5,
                    opacity: inGuida ? 0.6 : 1,
                    lineJoin: 'round',
                  }}
                />
              </React.Fragment>
            ),
          )}

          {inGuida ? (
            <>
              {/* Strada da fare ora: più spessa del giro, sempre in primo piano. */}
              <Polyline
                positions={percorsoGuida}
                pathOptions={{ color: COLORI.bordoPercorso, weight: 10, lineJoin: 'round' }}
              />
              <Polyline
                positions={percorsoGuida}
                pathOptions={{ color: COLORI.percorso, weight: 7, lineJoin: 'round' }}
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
                  color: COLORI.posizione,
                  fillColor: COLORI.posizione,
                  fillOpacity: 0.15,
                  weight: 1,
                }}
              />
              <Marker
                position={[posizione.lat, posizione.lng]}
                icon={iconaPosizione()}
                title="La tua posizione"
                zIndexOffset={1000}
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
