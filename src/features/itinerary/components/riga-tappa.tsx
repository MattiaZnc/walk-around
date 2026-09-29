import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check,
  Circle,
  Clock,
  Flag,
  GripVertical,
  MapPinOff,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { oraDiArrivo } from '@/features/itinerary/lib/prossimita-formato';
import { oraBreve } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Stop } from '@/types/models';

type Props = {
  tappa: Stop;
  numero: number;
  totale: number;
  onModifica: () => void;
  onElimina: () => void;
  onInserisciSotto: () => void;
  /** Marca o smarca la tappa come raggiunta. */
  onCambiaRaggiunta: (raggiunta: boolean) => void;
};

/**
 * Riga trascinabile di una tappa.
 *
 * Su telefono le azioni stanno in fila e non in colonna: impilare quattro
 * pulsanti a destra rendeva ogni riga alta quanto loro, anche per una tappa
 * con il solo nome. Resta in vista solo l'azione che si usa durante il giro
 * (segnare la tappa raggiunta); modifica, inserimento ed eliminazione sono
 * nel menu, con l'eliminazione separata dalle altre.
 *
 * La maniglia è un pulsante a sé: lo scroll col dito sul resto della riga
 * continua a funzionare, e da tastiera la tappa si sposta con le frecce.
 */
export function RigaTappa({
  tappa,
  numero,
  totale,
  onModifica,
  onElimina,
  onInserisciSotto,
  onCambiaRaggiunta,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tappa.id });

  const senzaCoordinate = tappa.lat === null || tappa.lng === null;
  const raggiunta = tappa.reached_at !== null;
  const oraArrivo = oraDiArrivo(tappa.reached_at);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative rounded-xl border bg-card transition-colors',
        // Verde chiarissimo: si vede a colpo d'occhio quali tappe sono fatte.
        raggiunta && 'border-reached-border bg-reached',
        isDragging && 'z-10 shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="flex items-center gap-1 py-1.5 pl-0.5 pr-1 sm:gap-2 sm:p-2">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon"
          className="w-10 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={`Sposta ${tappa.label}, tappa ${numero} di ${totale}. Usa le frecce per cambiare posizione.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>

        <span
          className={cn(
            'tabular flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            raggiunta
              ? 'bg-reached-foreground text-reached'
              : tappa.is_start
                ? 'bg-foreground text-background'
                : 'bg-primary/10 text-primary',
          )}
          aria-hidden
        >
          {raggiunta ? <Check className="size-4" /> : numero}
        </span>

        <div className="min-w-0 flex-1 py-1 pl-1.5">
          <p className="line-clamp-2 font-medium leading-snug">{tappa.label}</p>

          {tappa.address ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{tappa.address}</p>
          ) : null}

          {/* Metadati in una riga sola: ognuno solo se c'è davvero */}
          {tappa.is_start || tappa.planned_time || raggiunta || senzaCoordinate ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {tappa.is_start ? (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Flag className="size-3" aria-hidden />
                  partenza
                </span>
              ) : null}
              {tappa.planned_time ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  <span className="tabular">{oraBreve(tappa.planned_time)}</span>
                </span>
              ) : null}
              {raggiunta ? (
                <span className="flex items-center gap-1 font-medium text-reached-foreground">
                  <Check className="size-3" aria-hidden />
                  raggiunta{oraArrivo ? ` alle ${oraArrivo}` : ''}
                </span>
              ) : null}
              {senzaCoordinate ? (
                <span
                  className="flex items-center gap-1"
                  title="Senza coordinate i chilometri vanno inseriti a mano"
                >
                  <MapPinOff className="size-3" aria-hidden />
                  senza coordinate
                </span>
              ) : null}
            </p>
          ) : null}

          {tappa.notes ? (
            <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
              {tappa.notes}
            </p>
          ) : null}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onCambiaRaggiunta(!raggiunta);
          }}
          aria-label={
            raggiunta
              ? `Segna ${tappa.label} come non raggiunta`
              : `Segna ${tappa.label} come raggiunta`
          }
          aria-pressed={raggiunta}
          title={raggiunta ? 'Annulla: non ancora raggiunta' : 'Segna come raggiunta'}
          className={cn('shrink-0', raggiunta ? 'text-reached-foreground' : 'text-muted-foreground')}
        >
          {raggiunta ? <Check aria-hidden /> : <Circle aria-hidden />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              aria-label={`Azioni per ${tappa.label}`}
            >
              <MoreVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onModifica}>
              <Pencil aria-hidden />
              Modifica
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onInserisciSotto}>
              <Plus aria-hidden />
              Inserisci una tappa dopo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onElimina}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 aria-hidden />
              Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
