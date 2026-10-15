// „Neue Challenge" und „Challenge bearbeiten" -- das Modal der App
// (admin/modals/ChallengeManageModal) und der Dialog der Web-Fassung
// (shared/web/challenges/WebChallengeDialog) im Vergleich (Simon, 15.10.2026:
// Im Browser bekommt jedes Formular, das noch ein Modal der App öffnet, ein
// kompaktes Web-Fenster; in den Apps bleibt das Modal).
//
// Beide lesen denselben Hook (useChallengeManageFormular). Jeder Ablauf läuft
// deshalb zweimal, einmal je Fassung, mit denselben Erwartungen: dieselben
// Jahrgänge zur Auswahl (GET /admin/jahrgaenge), dieselben Rümpfe an
// dieselben Routen, dieselben Sperren nach dem Start, dieselben Sätze bei
// Prüfung und Fehler. Was sich unterscheidet, steht ausdrücklich da:
// Meldungen stehen in der App oben (setError), im Browser im Dialog; fehlt
// ein Pflichtfeld, sperrt die App den Haken, der Browser sagt im Dialog, was
// fehlt. Ungespeicherte Änderungen: die App meldet sie an canDismiss der
// Seite (onDirtyChange), der Browser fragt selbst nach.
//
// Ersetzt sind Netz, Kontext, Messung und die Ionic-Bausteine der App
// (schlichte HTML-Nachbauten mit denselben Namen).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  setError: vi.fn(),
  track: vi.fn(),
  fertig: vi.fn(),
  zu: vi.fn(),
  dirty: vi.fn(),
}));

vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const R = await vi.importActual<typeof import('react')>('react');
  type K = { children?: React.ReactNode };
  const durch = ({ children }: K) => R.createElement('div', null, children);
  type FeldProps = { value?: string; disabled?: boolean; 'aria-label'?: string; onIonInput?: (e: { detail: { value: string } }) => void };
  const feld = (tag: 'input' | 'textarea') => (p: FeldProps) => R.createElement(tag, {
    'aria-label': p['aria-label'], value: p.value ?? '', disabled: !!p.disabled,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonInput?.({ detail: { value: e.target.value } }),
  });
  return {
    ...echt,
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonItem: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch,
    IonAccordion: durch, IonAccordionGroup: durch, IonModal: durch,
    IonTitle: ({ children }: K) => R.createElement('h1', null, children),
    IonLabel: ({ children }: K) => R.createElement('span', null, children),
    IonText: ({ children }: K) => R.createElement('span', null, children),
    IonIcon: () => null,
    IonSpinner: () => R.createElement('span', { role: 'progressbar' }),
    IonButton: (p: K & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      R.createElement('button', { type: 'button', onClick: p.onClick, disabled: !!p.disabled, 'aria-label': p['aria-label'] }, p.children),
    IonInput: feld('input'),
    IonTextarea: feld('textarea'),
    IonToggle: (p: { checked?: boolean; disabled?: boolean; 'aria-label'?: string; onIonChange?: (e: { detail: { checked: boolean } }) => void }) =>
      R.createElement('input', {
        type: 'checkbox', 'aria-label': p['aria-label'], checked: !!p.checked, disabled: !!p.disabled,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { checked: e.target.checked } }),
      }),
    // Das Datumsfenster der App als Feld: Es liefert die lokale Zeit wie IonDatetime.
    IonDatetime: (p: { value?: string; 'aria-label'?: string; onIonChange?: (e: { detail: { value: string } }) => void }) =>
      R.createElement('input', {
        'aria-label': p['aria-label'], value: p.value ?? '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { value: e.target.value } }),
      }),
    IonDatetimeButton: () => null,
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, setSuccess: vi.fn(), isOnline: true, user: { id: 4, type: 'admin' } }),
}));
vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    post: (u: string, b?: unknown) => h.apiPost(u, b),
    put: (u: string, b?: unknown) => h.apiPut(u, b),
  },
}));
vi.mock('../../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../../services/analytics')>()),
  trackHandlung: (...args: unknown[]) => h.track(...args),
}));

import ChallengeManageModal from '../../../components/admin/modals/ChallengeManageModal';
import WebChallengeDialog from '../../../components/shared/web/challenges/WebChallengeDialog';
import { CHALLENGE_SICHTBARKEIT_MESSWERT } from '../../../services/analytics';
import type { AdminChallenge } from '../../../types/challenges';

// GET /admin/jahrgaenge: Der Server zeigt Admins und Teamer:innen nur ihre eigenen.
const JAHRGAENGE = [{ id: 1, name: '2026/2027' }, { id: 2, name: '2025/2026' }];

/** Eine laufende Challenge: Der Server meldet sie als gesperrt (locked). */
const LAUFEND = {
  id: 7,
  title: 'Fürbitten',
  description: 'Schreibt eine Bitte in einem Satz.',
  challenge_type: 'frei',
  audience: 'konfis',
  visibility: 'public',
  moderated: false,
  allowed_media: ['text', 'link'],
  allow_multiple: false,
  badge_icon: 'heart',
  badge_name: 'Fürbitter:in',
  author_freetext: 'Pastorin Beispiel',
  starts_at: '2026-10-01T07:00:00.000Z',
  ends_at: '2026-10-20T18:00:00.000Z',
  is_draft: false,
  locked: true,
  jahrgaenge: [{ id: 2, name: '2025/2026' }],
} as unknown as AdminChallenge;

/** Vorbelegung einer neuen Challenge: Start morgen 9 Uhr, Ende zwei Wochen später um 20 Uhr (Ortszeit). */
const vorgabeStart = () => { const s = new Date(); s.setDate(s.getDate() + 1); s.setHours(9, 0, 0, 0); return s; };
const vorgabeEnde = () => { const e = vorgabeStart(); e.setDate(e.getDate() + 14); e.setHours(20, 0, 0, 0); return e; };

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/admin/jahrgaenge') return { data: JAHRGAENGE };
    throw new Error(`unerwartet: ${pfad}`);
  });
  h.apiPost.mockResolvedValue({ data: { id: 99 } });
  h.apiPut.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';

const oeffnen = async (fassung: Fassung, challenge: AdminChallenge | null = null) => {
  if (fassung === 'app') render(<ChallengeManageModal challenge={challenge} onClose={h.zu} onSuccess={h.fertig} onDirtyChange={h.dirty} />);
  else render(<WebChallengeDialog challenge={challenge} onSchliessen={h.zu} onGespeichert={h.fertig} />);
  await screen.findByLabelText('Titel');
  // Erst nach der Vorbelegung zählen Eingaben als Änderung (100 ms, in beiden).
  await act(async () => { await new Promise((r) => setTimeout(r, 130)); });
};

const tippen = (name: string, wert: string) => fireEvent.change(screen.getByLabelText(name), { target: { value: wert } });

/** Eine Wahl aus mehreren (Zielgruppe, Sichtbarkeit): in der App eine antippbare Zeile, im Browser ein Optionsknopf. */
const einzelwahl = (fassung: Fassung, titel: string) => screen.getByRole(fassung === 'app' ? 'button' : 'radio', { name: new RegExp(`^${titel}`) });
/** Eine von mehreren (Jahrgänge, Medienarten): in der App eine antippbare Zeile, im Browser ein Ankreuzfeld. */
const mehrfachwahl = (fassung: Fassung, titel: string) => screen.getByRole(fassung === 'app' ? 'button' : 'checkbox', { name: new RegExp(`^${titel}`) });
/** Die Jahrgänge, die zur Auswahl stehen, in Anzeigereihenfolge. */
const jahrgaengeZurWahl = (fassung: Fassung): string[] => (fassung === 'app'
  ? screen.queryAllByRole('button', { name: /^\d{4}\/\d{4}$/ })
  : screen.queryAllByRole('checkbox', { name: /^\d{4}\/\d{4}$/ })).map((el) => el.textContent?.trim() || el.closest('label')?.textContent?.trim() || '');

/** Datum und Uhrzeit, wie das Feld der jeweiligen Fassung sie liefert. */
const datum = (fassung: Fassung, name: 'Start' | 'Ende', lokal: string) => fireEvent.change(
  screen.getByLabelText(name),
  { target: { value: fassung === 'app' ? `${lokal}:00` : lokal } },
);

const speichern = async (name = 'Challenge anlegen') => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
};

/** Die Meldung: in der App oben (setError), im Browser im Dialog -- derselbe Satz. */
const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError).toHaveBeenLastCalledWith(text));
  } else {
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

const pflichtfelder = () => {
  tippen('Titel', '  Gottesbilder  ');
  tippen('Beschreibung', 'Malt euer Bild von Gott.');
  tippen('Name des Stempels', 'Bildermacher:in');
};

// --- Abläufe, je Fassung -----------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Challenge anlegen und bearbeiten (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('dieselben Jahrgänge zur Auswahl: die aus GET /admin/jahrgaenge, in derselben Reihenfolge', async () => {
    await oeffnen(fassung);
    expect(h.apiGet.mock.calls.map(([pfad]) => pfad)).toEqual(['/admin/jahrgaenge']);
    expect(jahrgaengeZurWahl(fassung)).toEqual(['2026/2027', '2025/2026']);
  });

  it('neue Challenge: POST /challenges/admin mit genau diesem Rumpf, gemessen wird das Anlegen, danach fertig', async () => {
    await oeffnen(fassung);
    pflichtfelder();
    tippen('Gestellt von (optional)', ' Konfi-Team ');
    fireEvent.click(mehrfachwahl(fassung, '2025/2026'));
    fireEvent.click(mehrfachwahl(fassung, 'Link'));
    fireEvent.click(einzelwahl(fassung, 'Öffentlich'));
    fireEvent.click(screen.getByLabelText('Beiträge erst nach Freigabe zeigen'));
    await speichern();

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost).toHaveBeenCalledWith('/challenges/admin', {
      title: 'Gottesbilder',
      description: 'Malt euer Bild von Gott.',
      allow_multiple: true,
      badge_icon: 'flag',
      badge_name: 'Bildermacher:in',
      author_user_id: null,
      author_freetext: 'Konfi-Team',
      jahrgang_ids: [2],
      ends_at: vorgabeEnde().toISOString(),
      is_draft: false,
      audience: 'konfis_und_team',
      visibility: 'public',
      moderated: false,
      allowed_media: ['text', 'photo', 'link'],
      starts_at: vorgabeStart().toISOString(),
    });
    expect(h.track).toHaveBeenCalledWith('challenge-angelegt', { sichtbarkeit: CHALLENGE_SICHTBARKEIT_MESSWERT.public, freigabe: 'false' });
    await waitFor(() => expect(h.fertig).toHaveBeenCalledTimes(1));
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('„Nur das Team": keine Jahrgangs-Auswahl, im Rumpf audience nur_team und keine Jahrgänge', async () => {
    await oeffnen(fassung);
    pflichtfelder();
    fireEvent.click(mehrfachwahl(fassung, '2026/2027'));
    fireEvent.click(einzelwahl(fassung, 'Nur das Team'));
    expect(jahrgaengeZurWahl(fassung)).toEqual([]);
    await speichern();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ audience: 'nur_team', jahrgang_ids: [] });
  });

  it('Entwurf: kein Zeitraum zu sehen, im Rumpf is_draft true', async () => {
    await oeffnen(fassung);
    pflichtfelder();
    fireEvent.click(mehrfachwahl(fassung, '2026/2027'));
    expect(screen.getByText('Zeitraum')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Als Entwurf speichern'));
    // Der Abschnitt heißt nach dem, was er zeigt; Start und Ende stehen nicht da.
    expect(screen.getByText('Entwurf')).toBeInTheDocument();
    expect(screen.queryByText('Zeitraum')).toBeNull();
    expect(screen.queryByText(/^(Start|Ende)( \*)?$/)).toBeNull();
    if (fassung === 'web') expect(screen.queryByLabelText('Start')).toBeNull();
    await speichern();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ is_draft: true, jahrgang_ids: [1] });
  });

  it('Ende vor dem Start: „Das Ende muss nach dem Start liegen." -- nichts geht an den Server', async () => {
    await oeffnen(fassung);
    pflichtfelder();
    fireEvent.click(mehrfachwahl(fassung, '2026/2027'));
    datum(fassung, 'Start', '2026-11-10T09:00');
    datum(fassung, 'Ende', '2026-11-09T20:00');
    await speichern();
    await erwarteMeldung(fassung, 'Das Ende muss nach dem Start liegen.');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.fertig).not.toHaveBeenCalled();
  });

  it('der gewählte Zeitraum geht als Zeitpunkt (UTC) an den Server', async () => {
    await oeffnen(fassung);
    pflichtfelder();
    fireEvent.click(mehrfachwahl(fassung, '2026/2027'));
    datum(fassung, 'Start', '2026-11-10T09:15');
    datum(fassung, 'Ende', '2026-11-24T20:45');
    await speichern();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({
      starts_at: new Date('2026-11-10T09:15:00').toISOString(),
      ends_at: new Date('2026-11-24T20:45:00').toISOString(),
    });
  });

  it('es fehlt etwas: nichts geht an den Server (die App sperrt den Haken, der Browser sagt, was fehlt)', async () => {
    await oeffnen(fassung);
    tippen('Titel', 'Nur ein Titel');
    const knopf = screen.getByRole('button', { name: 'Challenge anlegen' }) as HTMLButtonElement;
    if (fassung === 'app') {
      expect(knopf.disabled).toBe(true);
    } else {
      expect(knopf.disabled).toBe(false);
      await speichern();
      await erwarteMeldung(fassung, 'Bitte fülle Titel, Beschreibung, Stempel-Name, Medienarten, Jahrgänge und den Zeitraum aus.');
    }
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('laufende Challenge bearbeiten: Zielgruppe, Medienarten, Sichtbarkeit, Freigabe und Start gesperrt; PUT ohne die gesperrten Felder', async () => {
    await oeffnen(fassung, LAUFEND);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Fürbitten');
    expect((screen.getByLabelText('Beiträge erst nach Freigabe zeigen') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Mehrere Beiträge erlauben') as HTMLInputElement).disabled).toBe(false);
    // Ein Antippen der gesperrten Wahl ändert nichts (im Browser ist sie gar nicht bedienbar).
    fireEvent.click(einzelwahl(fassung, 'Nur das Team'));
    expect(jahrgaengeZurWahl(fassung)).toEqual(['2026/2027', '2025/2026']);
    expect(screen.queryByLabelText('Als Entwurf speichern')).toBeNull();

    tippen('Titel', 'Fürbitten zum Erntedank');
    await speichern('Speichern');
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledTimes(1));
    expect(h.apiPut).toHaveBeenCalledWith('/challenges/admin/7', {
      title: 'Fürbitten zum Erntedank',
      description: 'Schreibt eine Bitte in einem Satz.',
      allow_multiple: false,
      badge_icon: 'heart',
      badge_name: 'Fürbitter:in',
      author_user_id: null,
      author_freetext: 'Pastorin Beispiel',
      jahrgang_ids: [2],
      ends_at: '2026-10-20T18:00:00.000Z',
      is_draft: false,
    });
    // Bearbeiten ist kein Anlegen.
    expect(h.track).not.toHaveBeenCalled();
    await waitFor(() => expect(h.fertig).toHaveBeenCalledTimes(1));
  });

  it('ein Fehler des Servers: derselbe Satz (in der App oben, im Browser im Fenster); nichts schließt', async () => {
    h.apiPut.mockRejectedValueOnce(Object.assign(new Error('409'), {
      response: { status: 409, data: { error: 'Nach dem Start lässt sich das nicht mehr ändern.' } },
    }));
    await oeffnen(fassung, LAUFEND);
    tippen('Titel', 'Neu');
    await speichern('Speichern');
    await erwarteMeldung(fassung, 'Nach dem Start lässt sich das nicht mehr ändern.');
    expect(h.fertig).not.toHaveBeenCalled();
    expect(h.zu).not.toHaveBeenCalled();
  });

  it('ungespeicherte Änderungen: die App meldet sie an die Seite, der Browser fragt vor dem Schließen', async () => {
    await oeffnen(fassung);
    tippen('Titel', 'Halb fertig');
    if (fassung === 'app') {
      await waitFor(() => expect(h.dirty).toHaveBeenLastCalledWith(true));
      return;
    }
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    const frage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    expect(frage).toHaveAccessibleDescription('Möchtest du die Änderungen verwerfen?');
    expect(h.zu).not.toHaveBeenCalled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Verwerfen' }));
    expect(h.zu).toHaveBeenCalledTimes(1);
  });
});

// --- Nur im Browser ----------------------------------------------------------------------
describe('Challenge im Browser: das Fenster', () => {
  it('heißt nach dem, was es tut, und schließt ohne Änderung sofort', async () => {
    await oeffnen('web');
    expect(screen.getByRole('dialog', { name: 'Neue Challenge' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeNull();
    expect(h.zu).toHaveBeenCalledTimes(1);
    cleanup();
    await oeffnen('web', LAUFEND);
    expect(screen.getByRole('dialog', { name: 'Challenge bearbeiten' })).toBeInTheDocument();
  });

  it('beim Speichern gesperrt: Abbrechen, X und Escape schließen nicht', async () => {
    let fertig: (v: unknown) => void = () => undefined;
    h.apiPost.mockReturnValueOnce(new Promise((r) => { fertig = r; }));
    await oeffnen('web');
    pflichtfelder();
    fireEvent.click(mehrfachwahl('web', '2026/2027'));
    await speichern();
    const dialog = screen.getByRole('dialog', { name: 'Neue Challenge' });
    expect((within(dialog).getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Schließen' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(h.zu).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeNull();
    await act(async () => { fertig({ data: { id: 99 } }); });
    await waitFor(() => expect(h.fertig).toHaveBeenCalledTimes(1));
  });

  it('Enter im Titel speichert wie der Knopf', async () => {
    await oeffnen('web');
    pflichtfelder();
    fireEvent.click(mehrfachwahl('web', '2026/2027'));
    await act(async () => { fireEvent.submit(screen.getByRole('dialog', { name: 'Neue Challenge' }).querySelector('form') as HTMLFormElement); });
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
  });
});
