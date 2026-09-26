import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff } from 'lucide-react';
import * as React from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

import { useTheme } from '@/components/layout/theme-provider';
import type { Geometria } from '@/features/itinerary/api/percorsi.api';
import type { Tratta } from '@/features/itinerary/lib/sequenza';
import { durata, km, oraBreve } from '@/lib/format';
import type { Stop } from '@/types/models';

type Props = {
  tappe: Stop[];
  tratte: Tratta[];
  /** Punto di partenza del profilo: destinazione della tratta di rientro. */
  partenza: { indirizzo: string; lat: number; lng: number } | null;
  className?: string;
};

/** Centro di ripiego quando nessuna tappa ha coordinate (centro Italia). */
const CENTRO_PREDEFINITO: [number, number] = [41.9028, 12.4964];

/**
 * Marker numerato disegnato come HTML: un'icona immagine per ogni numero
 * richiederebbe file separati, e i `divIcon` restano nitidi su schermi retina.
 */
function iconaNumerata(numero: number, tipo: 'tappa' | 'rientro'): L.DivIcon {
  const colore = tipo === 'rientro' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))';
  const contenuto = tipo === 'rientro' ? '⌂' : String(numero);

  return L.divIcon({
    className: 'marker-tappa',
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:9999px;
      background:${colore};color:hsl(var(--primary-foreground));
      font:600 13px/1 system-ui,sans-serif;
      box-shadow:0 1px 4px rgb(0 0 0 / .4);
      border:2px solid hsl(var(--background));
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

export function MappaGiornata({ tappe, tratte, partenza, className }: Props) {
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
      const a = tratta.rientro ? partenza : tratta.toStop;
      if (da.lat === null || da.lng === null || !a || a.lat === null || a.lng === null) return null;

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
        className={`flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 p-6 text-center ${className ?? ''}`}
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

  // Tema scuro: le tile chiare accecano. CARTO offre entrambe le varianti.
  const urlTile =
    resolvedTheme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div className={`overflow-hidden rounded-lg border ${className ?? ''}`}>
      <MapContainer
        center={puntiPerInquadratura[0] ?? CENTRO_PREDEFINITO}
        zoom={13}
        scrollWheelZoom={false}
        className="h-[260px] w-full sm:h-[360px] md:h-[calc(100dvh-14rem)]"
        // Leaflet non è navigabile da tastiera in modo utile: il contenuto
        // informativo resta disponibile nell'elenco tappe accanto.
        aria-label="Mappa dell'itinerario"
      >
        <TileLayer
          url={urlTile}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

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
            icon={iconaNumerata(numero, 'tappa')}
            title={`${numero}. ${tappa.label}`}
          >
            <Popup>
              <p className="font-semibold">
                {numero}. {tappa.label}
              </p>
              {tappa.address ? <p className="text-xs">{tappa.address}</p> : null}
              {tappa.planned_time ? (
                <p className="text-xs">Orario previsto: {oraBreve(tappa.planned_time)}</p>
              ) : null}
            </Popup>
          </Marker>
        ))}

        {partenza ? (
          <Marker
            position={[partenza.lat, partenza.lng]}
            icon={iconaNumerata(0, 'rientro')}
            title={`Punto di partenza: ${partenza.indirizzo}`}
          >
            <Popup>
              <p className="font-semibold">Punto di partenza</p>
              <p className="text-xs">{partenza.indirizzo}</p>
            </Popup>
          </Marker>
        ) : null}
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
              Tratta da {tratta.fromStop.label} a{' '}
              {tratta.rientro ? 'punto di partenza' : (tratta.toStop?.label ?? '')}:{' '}
              {km(tratta.leg.distance_km)}, {durata(tratta.leg.duration_min)}
            </li>
          ) : null,
        )}
      </ol>
    </div>
  );
}
