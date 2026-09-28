import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormTappa } from '@/features/itinerary/components/form-tappa';
import { renderConProvider } from '@/test/test-utils';
import type { Stop } from '@/types/models';

const tappaEsistente: Stop = {
  id: 's1',
  itinerary_id: 'g1',
  user_id: 'u1',
  position: 1,
  label: 'Deposito',
  address: 'Via Roma 1',
  lat: 45.4642,
  lng: 9.1896,
  planned_time: '08:30:00',
  notes: 'Ritiro merce',
  is_start: false,
  reached_at: null,
  created_at: '2026-05-04T06:00:00Z',
  updated_at: '2026-05-04T06:00:00Z',
};

describe('FormTappa', () => {
  it('richiede il nome della tappa', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(<FormTappa inCorso={false} onSalva={onSalva} onAnnulla={vi.fn()} />);

    await utente.click(screen.getByRole('button', { name: 'Aggiungi tappa' }));

    expect(await screen.findByText('Dai un nome alla tappa')).toBeInTheDocument();
    expect(onSalva).not.toHaveBeenCalled();
  });

  it('salva una tappa con solo il nome, con i campi vuoti a null', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(<FormTappa inCorso={false} onSalva={onSalva} onAnnulla={vi.fn()} />);

    await utente.type(screen.getByLabelText('Nome della tappa'), 'Cliente Rossi');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi tappa' }));

    await waitFor(() => {
      expect(onSalva).toHaveBeenCalledWith({
        label: 'Cliente Rossi',
        address: null,
        lat: null,
        lng: null,
        plannedTime: null,
        notes: null,
      });
    });
  });

  it('accetta le coordinate scritte con la virgola', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(<FormTappa inCorso={false} onSalva={onSalva} onAnnulla={vi.fn()} />);

    await utente.type(screen.getByLabelText('Nome della tappa'), 'Cantiere');
    await utente.type(screen.getByLabelText('Latitudine'), '45,4642');
    await utente.type(screen.getByLabelText('Longitudine'), '9,1896');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi tappa' }));

    await waitFor(() => {
      expect(onSalva).toHaveBeenCalledWith(expect.objectContaining({ lat: 45.4642, lng: 9.1896 }));
    });
  });

  it('segnala una coordinata inserita a metà', async () => {
    const utente = userEvent.setup();
    const onSalva = vi.fn();
    renderConProvider(<FormTappa inCorso={false} onSalva={onSalva} onAnnulla={vi.fn()} />);

    await utente.type(screen.getByLabelText('Nome della tappa'), 'Cantiere');
    await utente.type(screen.getByLabelText('Latitudine'), '45,4642');
    await utente.click(screen.getByRole('button', { name: 'Aggiungi tappa' }));

    expect(
      await screen.findByText('Servono entrambe le coordinate, oppure nessuna'),
    ).toBeInTheDocument();
    expect(onSalva).not.toHaveBeenCalled();
  });

  it('precompila i campi quando si modifica una tappa, con l’orario in HH:MM', () => {
    renderConProvider(
      <FormTappa tappa={tappaEsistente} inCorso={false} onSalva={vi.fn()} onAnnulla={vi.fn()} />,
    );

    expect(screen.getByLabelText('Nome della tappa')).toHaveValue('Deposito');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('Via Roma 1');
    // Il DB restituisce 'HH:MM:SS', l'input time accetta solo 'HH:MM'.
    expect(screen.getByLabelText('Orario previsto')).toHaveValue('08:30');
    expect(screen.getByLabelText('Note')).toHaveValue('Ritiro merce');
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeInTheDocument();
  });

  it('usa i valori suggeriti per una nuova tappa', () => {
    renderConProvider(
      <FormTappa
        iniziali={{ label: 'Partenza', address: 'Via Torino 5', lat: 45.1, lng: 9.2 }}
        inCorso={false}
        onSalva={vi.fn()}
        onAnnulla={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Nome della tappa')).toHaveValue('Partenza');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('Via Torino 5');
  });

  it('blocca i pulsanti durante il salvataggio', () => {
    renderConProvider(<FormTappa inCorso onSalva={vi.fn()} onAnnulla={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aggiungi tappa' })).toBeDisabled();
  });
});
