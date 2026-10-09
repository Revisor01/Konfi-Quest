// Gerüst zuerst: es registriert die Attrappen, bevor die Seite geladen wird.
import {
  zustand, api, zuruecksetzen, seiteOeffnen, einladung, imDialogDruecken, letzterDialog,
} from './gerueste/einladungSeite';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, within, cleanup } from '@testing-library/react';
import { ICON_UHRZEIT_GEFUELLT } from '../../components/shared/icons';

// Befund 30.08.2026: Das Verlaengern einer Einladung merkte sich zwar in
// extendingInvite, welche Einladung gerade laeuft, zeigte das aber nirgends.
// Wer wischte, sah das Element zuklappen und danach nichts — bei langsamer
// Verbindung wischte man ein zweites Mal und schickte den Aufruf doppelt.
//
// Seit dem 09.10.2026 gerendert (vorher Quelltext): Der Aufruf haelt an, und
// geprueft wird, was die Wisch-Aktionen der echten Seite in der Zeit zeigen.

beforeEach(zuruecksetzen);
afterEach(() => cleanup());

const verlaengern = (code: string) => {
  // Der Code steht auch unter dem QR-Code -- gemeint ist seine Listenzeile.
  const zeile = screen.getAllByText(code).map((el) => el.closest('[data-testid="wischzeile"]')).find(Boolean) as HTMLElement;
  return within(zeile).getByRole('button', { name: 'Einladung verlängern' });
};

/** Wischen, im Dialog 7 Tage waehlen -- der Aufruf bleibt haengen, bis der Test ihn loest. */
async function verlaengerungStarten(code: string) {
  let loesen!: () => void;
  api.post.mockImplementationOnce(() => new Promise((r) => { loesen = () => r({ data: { expires_at: '2026-12-01T00:00:00Z' } }); }));
  await act(async () => { fireEvent.click(verlaengern(code)); });
  await imDialogDruecken('Verlängern', 7);
  return async () => { await act(async () => { loesen(); await Promise.resolve(); }); };
}

describe('Einladung verlaengern: Rueckmeldung waehrend des Aufrufs', () => {
  beforeEach(() => {
    zustand.einladungen = [einladung(1), einladung(2, { jahrgang_id: 2, jahrgang_name: '2027/28' })];
  });

  it('der Aufruf geht an die richtige Einladung', async () => {
    await seiteOeffnen();
    await verlaengerungStarten('CODE1');
    expect(letzterDialog().header).toBe('Einladung verlängern');
    expect(api.post).toHaveBeenCalledWith('/auth/invite-codes/1/extend', { tage: 7 });
  });

  it('sperrt die Wisch-Aktion der laufenden Einladung: ein zweiter Wisch schickt nichts', async () => {
    await seiteOeffnen();
    await verlaengerungStarten('CODE1');
    expect((verlaengern('CODE1') as HTMLButtonElement).disabled).toBe(true);
    const dialogeVorher = letzterDialog();
    await act(async () => { fireEvent.click(verlaengern('CODE1')); });
    expect(letzterDialog()).toBe(dialogeVorher);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('zeigt an ihrer Stelle den Spinner statt des Uhr-Symbols', async () => {
    await seiteOeffnen();
    expect(within(verlaengern('CODE1')).queryByTestId('spinner')).toBeNull();
    expect(verlaengern('CODE1').querySelector(`i[data-icon="${ICON_UHRZEIT_GEFUELLT}"]`)).not.toBeNull();
    await verlaengerungStarten('CODE1');
    expect(within(verlaengern('CODE1')).getByTestId('spinner')).toBeTruthy();
    expect(verlaengern('CODE1').querySelector(`i[data-icon="${ICON_UHRZEIT_GEFUELLT}"]`)).toBeNull();
  });

  it('sperrt nur die laufende Einladung, nicht die ganze Liste', async () => {
    // Ein blosses disabled={!!extendingInvite} wuerde alle Zeilen sperren.
    await seiteOeffnen();
    await verlaengerungStarten('CODE1');
    expect((verlaengern('CODE2') as HTMLButtonElement).disabled).toBe(false);
    expect(within(verlaengern('CODE2')).queryByTestId('spinner')).toBeNull();
    expect(screen.getAllByTestId('spinner')).toHaveLength(1);
  });

  it('nach der Antwort ist die Aktion wieder frei und zeigt die Uhr', async () => {
    await seiteOeffnen();
    const fertig = await verlaengerungStarten('CODE1');
    await fertig();
    expect((verlaengern('CODE1') as HTMLButtonElement).disabled).toBe(false);
    expect(within(verlaengern('CODE1')).queryByTestId('spinner')).toBeNull();
    expect(verlaengern('CODE1').querySelector(`i[data-icon="${ICON_UHRZEIT_GEFUELLT}"]`)).not.toBeNull();
  });

  it('auch wenn der Aufruf scheitert, ist die Aktion danach wieder frei', async () => {
    await seiteOeffnen();
    api.post.mockRejectedValueOnce(new Error('weg'));
    await act(async () => { fireEvent.click(verlaengern('CODE1')); });
    await imDialogDruecken('Verlängern', 7);
    await act(async () => { await Promise.resolve(); });
    expect((verlaengern('CODE1') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('spinner')).toBeNull();
  });
});
