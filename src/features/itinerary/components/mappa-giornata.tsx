import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff } from 'lucide-react';
import * as React from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { useTheme } from '@/components/layout/theme-provider';
import type { Geometria } from '@/features/itinerary/api/percorsi.api';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import { configurazioneTile } from '@/features/itinerary/lib/tile-mappa';
import { durata, km, oraBreve } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Stop } from '@/types/models';

type Props = {
  tappe: Stop[];
  tratte: Tratta[];
  className?: string;
};

/** Centro di ripiego quando nessuna tappa ha coordinate (centro Italia). */
const CENTRO_PREDEFINITO: [number, number] = [41.9028, 12.4964];

/**
 * Marker numerato disegnato come HTML: un'icona immagine per ogni numero
 * richiederebbe file separati, e i `divIcon` restano nitidi su schermi retina.
 */
function iconaNumerata(numero: number, partenza: boolean): L.DivIcon {
  // La partenza si distingue a colpo d'occhio: è il punto da cui si misurano
  // i chilometri, non una tappa qualsiasi.
  const colore = partenza ? 'hsl(var(--foreground))' : 'hsl(var(--primary))';
  const contenuto = String(numero);

  return L.divIcon({
    className: 'marker-tappa',
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:9999px;
      background:${colore};color:hsl(var(--background));
      font:600 13px/1 system-ui,sans-serif;
      box-shadow:0 1px 4px rgb(0 0 0 / .4);
      border:${partenza ? '3px solid hsl(var(--primary))' : '2px solid hsl(var(--background))'};
    ">${contenuto}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
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
  // Stringa stabile: evita di rifare il fit a ogni render con gli stessi punti.
  const firma = punti.map(([lat, lng]) => `${lat},${lng}`).join('|');

  React.useEffect(() => {
    if (punti.length === 0) return;

    if (punti.length === 1) {
      const solo = punti[0];
      if (solo) mappa.setView(solo, 15);
      return;
    }

    mappa.fitBounds(L.latLngBounds(punti), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `firma` rappresenta `punti`
  }, [firma, mappa]);

  return null;
}

export function MappaGiornata({ tappe, tratte, className }: Props) {
  const { resolvedTheme } = useTheme();

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
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <MapContainer
        center={puntiPerInquadratura[0] ?? CENTRO_PREDEFINITO}
        zoom={13}
        scrollWheelZoom={false}
        className={cn(
          'h-[260px] w-full sm:h-[360px] md:h-[calc(100dvh-14rem)]',
          // Il filtro agisce solo sulle mattonelle: marker e tracciato
          // restano dei loro colori (vedi index.css).
          tile.filtraPerTemaScuro && 'mappa-tema-scuro',
        )}
        // Leaflet non è navigabile da tastiera in modo utile: il contenuto
        // informativo resta disponibile nell'elenco tappe accanto.
        aria-label="Mappa dell'itinerario"
      >
        <TileLayer url={tile.url} attribution={tile.attribuzione} maxZoom={tile.maxZoom} />

        <AdattaVista punti={puntiPerInquadratura} />

        {percorsi.map((percorso) => (
          <Polyline
            key={percorso.chiave}
            positions={percorso.punti}
            pathOptions={{
              color: 'hsl(var(--primary))',
              weight: 4,
              opacity: 0.85,
              // Tratteggio per i percorsi stimati: si vede subito che non è
              // un tracciato stradale reale.
              dashArray: percorso.stimato ? '6 8' : undefined,
            }}
          />
        ))}

        {tappeConCoordinate.map(({ tappa, numero }) => (
          <Marker
            key={tappa.id}
            position={[tappa.lat, tappa.lng]}
            icon={iconaNumerata(numero, tappa.is_start)}
            title={`${numero}. ${tappa.label}${tappa.is_start ? ' (partenza)' : ''}`}
          >
            <Popup>
              <p className="font-semibold">
                {numero}. {tappa.label}
              </p>
              {tappa.is_start ? (
                <p className="text-xs font-medium">Punto di partenza della giornata</p>
              ) : null}
              {tappa.address ? <p className="text-xs">{tappa.address}</p> : null}
              {tappa.planned_time ? (
                <p className="text-xs">Orario previsto: {oraBreve(tappa.planned_time)}</p>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Riepilogo testuale: la mappa da sola non è accessibile */}
      <ol className="sr-only">
        {tappeConCoordinate.map(({ tappa, numero }) => (
          <li key={tappa.id}>
            Tappa {numero}: {tappa.label}
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
