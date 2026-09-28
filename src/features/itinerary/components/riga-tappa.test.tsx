import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RigaTappa } from '@/features/itinerary/components/riga-tappa';
import { renderConProvider } from '@/test/test-utils';
import type { Stop } from '@/types/models';

const ADESSO = '2026-09-28T09:00:00Z';

function tappa(extra: Partial<Stop> = {}): Stop {
  return {
    id: 's1',
    itinerary_id: 'g1',
    user_id: 'u1',
    position: 1,
    label: 'Colosseo',
    address: 'Piazza del Colosseo, Roma',
    lat: 41.8902,
    lng: 12.4924,
    planned_time: null,
    notes: null,
    is_start: false,
    reached_at: null,
    created_at: ADESSO,
    updated_at: ADESSO,
    ...extra,
  };
}

/** RigaTappa usa useSortable: va montata dentro il contesto di dnd-kit. */
function render(stop: Stop, onCambiaRaggiunta = vi.fn()) {
  return {
    onCambiaRaggiunta,
    ...renderConProvider(
      <DndContext>
        <SortableContext items={[stop.id]}>
          <ol>
            <RigaTappa
              tappa={stop}
              numero={2}
              totale={3}
              onModifica={vi.fn()}
              onElimina={vi.fn()}
              onInserisciSotto={vi.fn()}
              onCambiaRaggiunta={onCambiaRaggiunta}
            />
          </ol>
        </SortableContext>
      </DndContext>,
    ),
  };
}

describe('RigaTappa', () => {
  it('mostra il numero della tappa quando non è raggiunta', () => {
    render(tappa());

    expect(screen.getByText('Colosseo')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText(/raggiunta/)).not.toBeInTheDocument();
  });

  it('una tappa raggiunta si distingue: sfondo dedicato, spunta e orario', () => {
    render(tappa({ reached_at: '2026-09-28T10:35:00Z' }));

    // Lo sfondo cambia: è il segnale che si legge a colpo d'occhio.
    const riga = screen.getByRole('listitem');
    expect(riga.className).toContain('bg-reached');

    // L'orario dell'arrivo è l'informazione utile per confrontarlo col previsto.
    expect(screen.getByText(/raggiunta alle \d{2}:\d{2}/)).toBeInTheDocument();
    // Il numero lascia il posto alla spunta.
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('si può segnare come raggiunta a mano', async () => {
    const utente = userEvent.setup();
    const { onCambiaRaggiunta } = render(tappa());

    await utente.click(screen.getByRole('button', { name: 'Segna Colosseo come raggiunta' }));

    expect(onCambiaRaggiunta).toHaveBeenCalledWith(true);
  });

  it('e si può annullare, se il rilevamento ha sbagliato', async () => {
    const utente = userEvent.setup();
    const { onCambiaRaggiunta } = render(tappa({ reached_at: ADESSO }));

    const pulsante = screen.getByRole('button', {
      name: 'Segna Colosseo come non raggiunta',
    });
    expect(pulsante).toHaveAttribute('aria-pressed', 'true');

    await utente.click(pulsante);
    expect(onCambiaRaggiunta).toHaveBeenCalledWith(false);
  });

  it('segnala la partenza e le tappe senza coordinate', () => {
    render(tappa({ is_start: true, lat: null, lng: null }));

    expect(screen.getByText('partenza')).toBeInTheDocument();
    expect(screen.getByText('senza coordinate')).toBeInTheDocument();
  });
});
