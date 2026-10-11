// Ein Dialog der Web-Fassung, der gerade sendet, lässt sich nicht schließen
// (Gegenprüfung 11.10.2026, „Aktivität melden" und „Aktivität prüfen"): Das X
// ist gesperrt, Escape und ein Klick auf den abgedunkelten Grund wirken
// nicht -- wie das X der App-Modale (`disabled={isSubmitting}`). Sonst ginge
// ein Fehler des Servers ins Leere, und nach erneutem Öffnen wäre derselbe
// Vorgang sofort wieder abschickbar. Ohne Sperre schließen alle drei.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));

import WebDialog from '../../../components/web/WebDialog';

const zeige = (gesperrt: boolean) => {
  const onSchliessen = vi.fn();
  render(
    <WebDialog titel="Aktivität melden" onSchliessen={onSchliessen} gesperrt={gesperrt}>
      <input aria-label="Anmerkungen" />
    </WebDialog>,
  );
  const dialog = screen.getByRole('dialog', { name: 'Aktivität melden' });
  return { onSchliessen, dialog, x: screen.getByRole('button', { name: 'Schließen' }), grund: dialog.parentElement! };
};

describe('WebDialog: gesperrt, solange gesendet wird', () => {
  it('gesperrt: X gesperrt, Escape und Klick auf den Grund rufen onSchliessen nicht', () => {
    const { onSchliessen, dialog, x, grund } = zeige(true);
    expect(x).toBeDisabled();
    fireEvent.click(x);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(grund);
    expect(onSchliessen).not.toHaveBeenCalled();
  });

  it('nicht gesperrt: X, Escape und Klick auf den Grund schließen je einmal', () => {
    const { onSchliessen, dialog, x, grund } = zeige(false);
    expect(x).toBeEnabled();
    fireEvent.click(x);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(grund);
    expect(onSchliessen).toHaveBeenCalledTimes(3);
  });

  it('ein Klick im Fenster selbst schließt nie', () => {
    const { onSchliessen, dialog } = zeige(false);
    fireEvent.mouseDown(dialog);
    expect(onSchliessen).not.toHaveBeenCalled();
  });
});

describe('WebDialog: der Fokus bleibt beim Sperren im Dialog', () => {
  // Der Knopf, der das Senden auslöst („Melden", „Genehmigen"), wird dabei
  // selbst gesperrt. Der Browser nimmt einem gesperrten Knopf den Fokus und
  // legt ihn auf die Seite (im Browser gemessen: BODY) -- Escape und Tab kämen
  // dann nach dem Senden nicht mehr im Dialog an.
  const Probe: React.FC<{ gesperrt: boolean }> = ({ gesperrt }) => (
    <WebDialog
      titel="Aktivität melden"
      onSchliessen={() => {}}
      gesperrt={gesperrt}
      aktionen={<button type="button" disabled={gesperrt}>Melden</button>}
    >
      <input aria-label="Anmerkungen" />
    </WebDialog>
  );

  it('lag der Fokus auf einem Knopf, der mitgesperrt wird, geht er auf das Fenster', () => {
    const { rerender } = render(<Probe gesperrt={false} />);
    screen.getByRole('button', { name: 'Melden' }).focus();
    rerender(<Probe gesperrt />);
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Aktivität melden' }));
  });

  it('lag er auf einem Feld, das frei bleibt, bleibt er dort', () => {
    const { rerender } = render(<Probe gesperrt={false} />);
    const feld = screen.getByRole('textbox', { name: 'Anmerkungen' });
    feld.focus();
    rerender(<Probe gesperrt />);
    expect(document.activeElement).toBe(feld);
  });
});
