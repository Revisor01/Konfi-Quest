// Personenansicht der Leitung: Das Einmalpasswort entsteht 300 ms nach dem
// Bestaetigen (der Dialog schliesst erst). Der Zeitgeber endet mit der
// Ansicht -- wer sie in der Spanne verlaesst, setzt das Passwort der Person
// nicht mehr im Hintergrund zurueck (offene Befunde, Tests und CI:
// "Zeitgeber, die das Schliessen einer Seite überleben").
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { zuruecksetzen, oeffne, api, presentAlert, knopf, KONFI_ID } from './gerueste/leitungKonfiDetail';

beforeEach(zuruecksetzen);
afterEach(() => { vi.useRealTimers(); });

type Knopf = { text: string; handler?: () => void };
const bestaetigen = () => {
  const dialog = presentAlert.mock.calls.at(-1)?.[0] as { header: string; buttons: Knopf[] };
  expect(dialog.header).toBe('Einmalpasswort generieren');
  dialog.buttons.find((b) => b.text === 'Generieren')!.handler!();
};
const passwortAbrufe = () => api.post.mock.calls.filter((c) => c[0] === `/admin/konfis/${KONFI_ID}/regenerate-password`);

describe('Personenansicht: Passwort zuruecksetzen nach dem Bestaetigen', () => {
  it('erlaubter Fall: Ansicht bleibt offen, nach 300 ms wird das Passwort erzeugt', async () => {
    api.post.mockResolvedValue({ data: { temporaryPassword: 'Abc-123' } });
    await oeffne();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(knopf('Passwort zurücksetzen')!);
    bestaetigen();
    expect(passwortAbrufe()).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(passwortAbrufe()).toHaveLength(1);
  });

  it('verbotener Fall: Ansicht in der Spanne geschlossen, kein Abruf mehr', async () => {
    api.post.mockResolvedValue({ data: { temporaryPassword: 'Abc-123' } });
    const { unmount } = await oeffne();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(knopf('Passwort zurücksetzen')!);
    bestaetigen();
    unmount();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(passwortAbrufe()).toHaveLength(0);
  });
});
