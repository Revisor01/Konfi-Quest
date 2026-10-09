// Recht "Anträge entscheiden" (09.10.2026) in der Antragsliste der App: Das
// Zurücksetzen eines entschiedenen Antrags ist eine Entscheidung (PUT
// .../reset, ohne Recht 403). Die Wischaktion fehlt deshalb bei
// darf_entscheiden === false; bei true und ohne Feld (älterer Server) bleibt sie.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@ionic/react', async () => {
  const basis = (await import('./support/ionicAttrappe')).ionicAttrappe();
  type P = { children?: React.ReactNode };
  return {
    ...basis,
    IonItemOptions: ({ children }: P) => <>{children}</>,
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" onClick={onClick} aria-label={label}>{children}</button>,
  };
});

import ActivityRequestsView from '../../components/admin/ActivityRequestsView';

const antrag = (id: number, name: string, zusatz: Record<string, unknown> = {}) => ({
  id, konfi_id: id + 10, konfi_name: name, activity_id: 3, activity_name: 'Gemeindefest', activity_type: 'gemeinde',
  activity_points: 2, requested_date: '2026-09-20', status: 'approved' as const,
  created_at: `2026-09-2${id}T10:00:00Z`, updated_at: '2026-09-25T10:00:00Z', ...zusatz,
});

const onReset = vi.fn();
const zeige = (requests: ReturnType<typeof antrag>[]) => {
  render(<ActivityRequestsView requests={requests} onSelectRequest={vi.fn()} onResetRequest={onReset} />);
  // Auf den Reiter "Verbucht" -- nur dort stehen die entschiedenen.
  fireEvent.click(screen.getAllByRole('tab').find((t) => /Verbucht/.test(t.textContent || ''))!);
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Antragsliste: Zurücksetzen nur mit dem Recht', () => {
  it('ERLAUBT (true) und älterer Server (Feld fehlt): je eine Wischaktion "Aktivität zurücksetzen"', () => {
    zeige([antrag(1, 'Mia Muster', { darf_entscheiden: true }), antrag(2, 'Ben Beispiel')]);
    const knoepfe = screen.getAllByRole('button', { name: 'Aktivität zurücksetzen' });
    expect(knoepfe).toHaveLength(2);
    fireEvent.click(knoepfe[0]);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('VERBOTEN (false): keine Wischaktion an diesem Antrag -- der daneben behält seine', () => {
    zeige([antrag(1, 'Mia Muster', { darf_entscheiden: false }), antrag(2, 'Ben Beispiel', { darf_entscheiden: true })]);
    expect(screen.getAllByRole('button', { name: 'Aktivität zurücksetzen' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität zurücksetzen' }));
    expect(onReset).toHaveBeenCalledWith(expect.objectContaining({ id: 2, konfi_name: 'Ben Beispiel' }));
    expect(screen.getByText('Mia Muster')).toBeInTheDocument();
  });
});
