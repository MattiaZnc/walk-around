import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import * as React from 'react';

import { RigaTappa } from '@/features/itinerary/components/riga-tappa';
import { TrattaInline } from '@/features/itinerary/components/tratta-inline';
import type { Sequenza } from '@/features/itinerary/lib/sequenza';
import type { TrattaInput } from '@/features/itinerary/schemas/itinerary.schemas';
import type { Stop } from '@/types/models';

type Props = {
  sequenza: Sequenza;
  salvataggioTrattaInCorso: boolean;
  onRiordina: (idOrdinati: string[]) => void;
  onModificaTappa: (tappa: Stop) => void;
  onEliminaTappa: (tappa: Stop) => void;
  onInserisciSotto: (posizione: number) => void;
  onSalvaTratta: (chiaveTratta: string, valori: TrattaInput) => void;
  onAzzeraTratta: (legId: string) => void;
};

export function ElencoTappe({
  sequenza,
  salvataggioTrattaInCorso,
  onRiordina,
  onModificaTappa,
  onEliminaTappa,
  onInserisciSotto,
  onSalvaTratta,
  onAzzeraTratta,
}: Props) {
  // Il touch richiede una piccola pressione prima di iniziare il trascinamento,
  // altrimenti lo scroll della pagina diventa impossibile.
  const sensori = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { tappe, tratte } = sequenza;
  const idTappe = React.useMemo(() => tappe.map((tappa) => tappa.id), [tappe]);

  // Messaggio per gli screen reader dopo uno spostamento.
  const [annuncio, setAnnuncio] = React.useState('');

  /**
   * Durante il trascinamento le tratte vengono nascoste: servirebbero altezze
   * uniformi perché l'anteprima di dnd-kit sia precisa, e comunque una tratta
   * "in movimento" non ha senso, sta per essere ricalcolata.
   */
  const [inTrascinamento, setInTrascinamento] = React.useState(false);

  const onDragEnd = (evento: DragEndEvent) => {
    setInTrascinamento(false);
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const da = idTappe.indexOf(String(active.id));
    const a = idTappe.indexOf(String(over.id));
    if (da === -1 || a === -1) return;

    const nuovoOrdine = arrayMove(idTappe, da, a);
    const spostata = tappe[da];
    if (spostata) {
      setAnnuncio(`${spostata.label} spostata in posizione ${a + 1} di ${tappe.length}.`);
    }
    onRiordina(nuovoOrdine);
  };

  const tratteDaPartenza = React.useMemo(
    () => new Map(tratte.map((tratta) => [tratta.fromStop.id, tratta])),
    [tratte],
  );

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {annuncio}
      </p>

      <DndContext
        sensors={sensori}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={() => {
          setInTrascinamento(true);
        }}
        onDragCancel={() => {
          setInTrascinamento(false);
        }}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={idTappe} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1">
            {tappe.map((tappa, indice) => {
              const tratta = tratteDaPartenza.get(tappa.id);
              return (
                <React.Fragment key={tappa.id}>
                  <RigaTappa
                    tappa={tappa}
                    numero={indice + 1}
                    totale={tappe.length}
                    onModifica={() => {
                      onModificaTappa(tappa);
                    }}
                    onElimina={() => {
                      onEliminaTappa(tappa);
                    }}
                    onInserisciSotto={() => {
                      onInserisciSotto(indice + 2);
                    }}
                  />
                  {tratta && !inTrascinamento ? (
                    <TrattaInline
                      key={tratta.chiave}
                      tratta={tratta}
                      inCorso={salvataggioTrattaInCorso}
                      onSalva={(valori) => {
                        onSalvaTratta(tratta.chiave, valori);
                      }}
                      onAzzera={() => {
                        if (tratta.leg) onAzzeraTratta(tratta.leg.id);
                      }}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}
