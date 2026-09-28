import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check,
  Circle,
  Clock,
  Flag,
  GripVertical,
  MapPin,
  MapPinOff,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { oraBreve } from '@/lib/format';
import { oraDiArrivo } from '@/features/itinerary/lib/prossimita-formato';
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
 * Riga trascinabile. La maniglia è un pulsante separato: così lo scroll con il
 * dito sul resto della riga continua a funzionare su telefono, e chi usa la
 * tastiera può spostare la tappa con le frecce (KeyboardSensor di dnd-kit).
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

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative rounded-lg border bg-card transition-colors',
        // Verde chiarissimo: si vede a colpo d'occhio quali tappe sono fatte,
        // senza che la riga diventi illeggibile.
        raggiunta && 'border-reached-border bg-reached',
        isDragging && 'z-10 shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="flex items-start gap-2 p-2 sm:p-3">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon"
          className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Sposta ${tappa.label}, tappa ${numero} di ${totale}. Usa le frecce per cambiare posizione.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>

        <span
          className={cn(
            'tabular mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            raggiunta ? 'bg-reached-foreground text-reached' : 'bg-primary/10 text-primary',
          )}
          aria-hidden
        >
          {raggiunta ? <Check className="size-4" /> : numero}
        </span>

        <div className="min-w-0 flex-1 py-1">
          <p className="flex flex-wrap items-center gap-2 font-medium leading-tight">
            {tappa.label}
            {tappa.is_start ? (
              <Badge variant="outline" className="gap-1 font-normal">
                <Flag className="size-3" aria-hidden />
                partenza
              </Badge>
            ) : null}
            {raggiunta ? (
              <Badge
                variant="outline"
                className="gap-1 border-reached-border font-normal text-reached-foreground"
              >
                <Check className="size-3" aria-hidden />
                raggiunta
                {oraDiArrivo(tappa.reached_at) ? ` alle ${oraDiArrivo(tappa.reached_at)}` : ''}
              </Badge>
            ) : null}
          </p>

          {tappa.address ? (
            <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="break-words">{tappa.address}</span>
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {tappa.planned_time ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                <span className="tabular">{oraBreve(tappa.planned_time)}</span>
              </span>
            ) : null}
            {senzaCoordinate ? (
              <span
                className="flex items-center gap-1"
                title="Senza coordinate i chilometri vanno inseriti a mano"
              >
                <MapPinOff className="size-3.5" aria-hidden />
                senza coordinate
              </span>
            ) : null}
          </div>

          {tappa.notes ? (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{tappa.notes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
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
            className={raggiunta ? 'text-reached-foreground' : undefined}
          >
            {raggiunta ? <Check aria-hidden /> : <Circle aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onModifica}
            aria-label={`Modifica ${tappa.label}`}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onInserisciSotto}
            aria-label={`Inserisci una tappa dopo ${tappa.label}`}
            title="Inserisci una tappa qui sotto"
          >
            <Plus aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onElimina}
            aria-label={`Elimina ${tappa.label}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}
