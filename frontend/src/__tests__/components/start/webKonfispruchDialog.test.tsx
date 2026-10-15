// „Dein Konfispruch" -- das Modal der App (konfi/modals/KonfispruchSelectModal)
// und der Dialog der Web-Fassung (konfi/web/WebKonfispruchDialog) im Vergleich
// (Simon, 15.10.2026: im Browser ab 992 px bekommt jedes Formular, das noch ein
// App-Modal öffnet, ein kompaktes Web-Fenster; in den Apps bleibt das Modal).
//
// Beide lesen denselben Hook (useKonfispruchWahl). Jeder Ablauf läuft deshalb
// zweimal, mit denselben Erwartungen: dieselben Sprüche der Gemeinde, dieselben
// Übersetzungen, dieselbe Prüfung mit denselben Texten, derselbe PATCH mit
// demselben Körper, für Konfis und Team gegen ihre eigenen Wege. Was sich
// unterscheidet, steht ausdrücklich da: Meldungen zeigt die App als Toast,
// der Browser im Dialog. Wie die Startseiten den Dialog öffnen, prüfen
// start/webKonfiStart und start/webTeamerStart; die Messung
// messungKonfispruch.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  toast: vi.fn(),
  online: true,
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('../support/ionicAttrappe')).ionicAttrappe({}),
  IonText: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useIonToast: () => [h.toast, vi.fn()],
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    isOnline: h.online,
    user: { id: 7, organization: 'Kirchengemeinde Beispiel', organization_id: 3 },
    activeOrgId: null,
    organizations: [{ id: 3, name: 'beispiel', display_name: 'Kirchengemeinde Beispiel', is_primary: true }],
  }),
}));
vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    patch: (u: string, b?: unknown) => h.apiPatch(u, b),
  },
}));

import KonfispruchSelectModal from '../../../components/konfi/modals/KonfispruchSelectModal';
import WebKonfispruchDialog from '../../../components/konfi/web/WebKonfispruchDialog';
import { SPRUCHLISTE_FEHLER, type CurrentKonfspruch } from '../../../components/konfi/useKonfispruchWahl';

const SPRUECHE = [
  {
    id: 11, reference: 'Josua 1,9', book: 'Josua', chapter: 1, verse: 9,
    uebersetzungen: { luther2017: 'Sei getrost und unverzagt.', gute_nachricht: 'Sei mutig und entschlossen!', bigs: '', elberfelder: '' },
  },
  {
    id: 12, reference: 'Psalm 23,1', book: 'Psalm', chapter: 23, verse: 1,
    uebersetzungen: { luther2017: 'Der HERR ist mein Hirte.', gute_nachricht: 'Der HERR ist mein Hirt.', bigs: '', elberfelder: '' },
  },
];

type Fassung = 'app' | 'web';
const zu = vi.fn();
const fertig = vi.fn();

const serverFehler = (status: number, error?: string) => Object.assign(new Error('Request failed'), {
  response: { status, data: error ? { error } : {} },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.apiGet.mockReset().mockResolvedValue({ data: SPRUECHE });
  h.apiPatch.mockReset().mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

describe.each<Fassung>(['app', 'web'])('Konfispruch (%s): dieselbe Logik in App und Browser', (fassung) => {
  const oeffnen = async (props: { current?: CurrentKonfspruch | null; apiBasePath?: '/konfi' | '/teamer' } = {}) => {
    if (fassung === 'app') render(<KonfispruchSelectModal onClose={zu} onSuccess={fertig} {...props} />);
    else render(<WebKonfispruchDialog onSchliessen={zu} onGespeichert={fertig} {...props} />);
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
  };

  /** Ein Spruch der Liste: in der App eine Zeile zum Antippen, im Browser ein Optionsknopf. */
  const spruch = (stelle: string): HTMLElement => (fassung === 'app'
    ? screen.getAllByRole('button').find((b) => b.hasAttribute('aria-pressed') && b.textContent?.startsWith(stelle)) as HTMLElement
    : screen.getByRole('radio', { name: new RegExp(`^${stelle}`) }));
  /** Der Text eines Spruchs: in der App in der Zeile, im Browser im Namen des Optionsknopfs. */
  const erwarteSpruchText = (el: HTMLElement, text: string) => {
    if (fassung === 'app') expect(el).toHaveTextContent(text);
    else expect(el).toHaveAccessibleName(expect.stringContaining(text));
  };
  const gewaehlt = (el: HTMLElement) => (fassung === 'app' ? el.getAttribute('aria-pressed') === 'true' : (el as HTMLInputElement).checked);
  const modus = (name: 'Aus Liste' | 'Eigener Spruch') => fireEvent.click(screen.getByRole(fassung === 'app' ? 'tab' : 'button', { name }));
  const uebersetzung = (schluessel: string, name: string) => {
    if (fassung === 'app') fireEvent.click(screen.getByRole('tab', { name }));
    else fireEvent.change(screen.getByLabelText('Übersetzung'), { target: { value: schluessel } });
  };
  const speichern = async () => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: fassung === 'app' ? 'Konfispruch speichern' : 'Speichern' })); });
  };
  const tippen = (name: string, wert: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value: wert } });

  /** Die Meldung: in der App als Toast, im Browser im Dialog -- derselbe Text. */
  const erwarteMeldung = async (text: string) => {
    if (fassung === 'app') {
      await waitFor(() => expect(h.toast).toHaveBeenLastCalledWith(expect.objectContaining({ message: text, color: 'danger' })));
    } else {
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
      expect(h.toast).not.toHaveBeenCalled();
    }
  };

  it('zeigt die Sprüche der Gemeinde (GET /konfi/konfsprueche) mit dem gespeicherten gewählt', async () => {
    await oeffnen({ current: { source: 'liste', id: 11, reference: 'Josua 1,9', translation: 'luther2017' } });
    if (fassung === 'web') expect(screen.getByRole('dialog', { name: 'Dein Konfispruch' })).toBeInTheDocument();
    expect(h.apiGet.mock.calls).toEqual([['/konfi/konfsprueche']]);
    erwarteSpruchText(spruch('Josua 1,9'), 'Sei getrost und unverzagt.');
    expect(gewaehlt(spruch('Josua 1,9'))).toBe(true);
    expect(gewaehlt(spruch('Psalm 23,1'))).toBe(false);
  });

  it('Spruch und Übersetzung aus der Liste: PATCH /konfi/profile { konfspruch_id, translation }, Toast „gespeichert"', async () => {
    await oeffnen();
    uebersetzung('gute_nachricht', 'Gute Nachricht');
    erwarteSpruchText(spruch('Psalm 23,1'), 'Der HERR ist mein Hirt.');
    fireEvent.click(spruch('Psalm 23,1'));
    await speichern();
    expect(h.apiPatch.mock.calls).toEqual([['/konfi/profile', { konfspruch_id: 12, translation: 'gute_nachricht' }]]);
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Dein Konfispruch wurde gespeichert', color: 'success' }));
    expect(fertig).toHaveBeenCalledTimes(1);
  });

  it('ohne gewählten Spruch geht nichts an den Server', async () => {
    await oeffnen();
    await speichern();
    await erwarteMeldung('Bitte wähle einen Spruch aus der Liste aus');
    expect(h.apiPatch).not.toHaveBeenCalled();
  });

  it('eigener Spruch: Text und Stelle sind Pflicht; gespeichert wird beides ohne Leerzeichen am Rand', async () => {
    await oeffnen();
    modus('Eigener Spruch');
    await speichern();
    await erwarteMeldung('Bitte gib deinen Spruchtext ein');
    tippen('Spruchtext', '  Fürchte dich nicht.  ');
    await speichern();
    await erwarteMeldung('Bitte gib die Stellenangabe an');
    expect(h.apiPatch).not.toHaveBeenCalled();
    tippen('Bibelstelle', ' Jes 43,1 ');
    await speichern();
    expect(h.apiPatch.mock.calls).toEqual([['/konfi/profile', { konfspruch_freitext: 'Fürchte dich nicht.', konfspruch_freitext_referenz: 'Jes 43,1' }]]);
    expect(fertig).toHaveBeenCalledTimes(1);
  });

  it('ein gespeicherter eigener Spruch steht wieder in den Feldern', async () => {
    await oeffnen({ current: { source: 'freitext', text: 'Fürchte dich nicht.', reference: 'Jes 43,1' } });
    expect(screen.getByRole('textbox', { name: 'Spruchtext' })).toHaveValue('Fürchte dich nicht.');
    expect(screen.getByRole('textbox', { name: 'Bibelstelle' })).toHaveValue('Jes 43,1');
  });

  it('nicht mehr verfügbar (404): die Meldung, und die Wahl ist aufgehoben', async () => {
    h.apiPatch.mockRejectedValue(serverFehler(404, 'Spruch nicht gefunden'));
    await oeffnen();
    fireEvent.click(spruch('Josua 1,9'));
    await speichern();
    await erwarteMeldung('Der gewählte Spruch ist nicht mehr verfügbar. Bitte wähle einen anderen.');
    expect(gewaehlt(spruch('Josua 1,9'))).toBe(false);
    expect(fertig).not.toHaveBeenCalled();
  });

  it('anderer Fehler: die Meldung des Servers, sonst der Ersatztext', async () => {
    h.apiPatch.mockRejectedValueOnce(serverFehler(400, 'Übersetzung unbekannt'));
    await oeffnen();
    fireEvent.click(spruch('Josua 1,9'));
    await speichern();
    await erwarteMeldung('Übersetzung unbekannt');
    h.apiPatch.mockRejectedValueOnce(serverFehler(500));
    await speichern();
    await erwarteMeldung('Der Konfispruch konnte nicht gespeichert werden');
    expect(fertig).not.toHaveBeenCalled();
  });

  it('Team: dieselbe Auswahl gegen die eigenen Wege (GET /teamer/konfsprueche, PATCH /teamer/profile)', async () => {
    await oeffnen({ apiBasePath: '/teamer' });
    expect(h.apiGet.mock.calls).toEqual([['/teamer/konfsprueche']]);
    fireEvent.click(spruch('Psalm 23,1'));
    await speichern();
    expect(h.apiPatch.mock.calls).toEqual([['/teamer/profile', { konfspruch_id: 12, translation: 'luther2017' }]]);
  });

  it('scheitert das Laden, sagt die Liste es', async () => {
    h.apiGet.mockRejectedValue(new Error('offline'));
    await oeffnen();
    expect(await screen.findByText(SPRUCHLISTE_FEHLER)).toBeInTheDocument();
  });

  it('offline ist Speichern gesperrt', async () => {
    h.online = false;
    await oeffnen();
    const knopf = fassung === 'app'
      ? screen.getByRole('button', { name: 'Konfispruch speichern' })
      : screen.getByRole('button', { name: 'Speichern' });
    expect(knopf).toBeDisabled();
  });
});

describe('Konfispruch (web): Enter speichert, während des Speicherns schließt nichts', () => {
  it('Absenden aus der Bibelstelle; solange gesendet wird, sind X und Abbrechen gesperrt und Escape schließt nicht', async () => {
    let ok: (v: unknown) => void = () => undefined;
    h.apiPatch.mockReturnValue(new Promise((a) => { ok = a; }));
    render(<WebKonfispruchDialog onSchliessen={zu} onGespeichert={fertig} current={{ source: 'freitext', text: 'Fürchte dich nicht.', reference: '' }} />);
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledTimes(1));
    const dialog = screen.getByRole('dialog', { name: 'Dein Konfispruch' });
    const stelle = within(dialog).getByRole('textbox', { name: 'Bibelstelle' }) as HTMLInputElement;
    fireEvent.change(stelle, { target: { value: 'Jes 43,1' } });
    await act(async () => { fireEvent.submit(stelle.form as HTMLFormElement); });
    expect(h.apiPatch.mock.calls).toEqual([['/konfi/profile', { konfspruch_freitext: 'Fürchte dich nicht.', konfspruch_freitext_referenz: 'Jes 43,1' }]]);
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    await act(async () => { ok({ data: {} }); });
    expect(fertig).toHaveBeenCalledTimes(1);
  });

  it('die nächste Eingabe räumt eine Meldung weg', async () => {
    render(<WebKonfispruchDialog onSchliessen={zu} onGespeichert={fertig} />);
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte wähle einen Spruch aus der Liste aus');
    fireEvent.click(await screen.findByRole('radio', { name: /^Josua 1,9/ }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
