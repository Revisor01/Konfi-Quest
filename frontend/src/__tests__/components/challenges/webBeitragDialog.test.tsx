// „Dein Beitrag" -- das Modal der App (konfi/modals/ChallengeSubmitModal) und
// der Dialog der Web-Fassung (shared/web/challenges/WebBeitragDialog) im
// Vergleich (Simon, 15.10.2026: Im Browser bekommt jedes Formular, das noch
// ein Modal der App öffnet, ein kompaktes Web-Fenster; in den Apps bleibt das
// Modal).
//
// Beide lesen denselben Hook (useChallengeBeitrag). Jeder Ablauf läuft
// deshalb zweimal, einmal je Fassung, mit denselben Erwartungen: nur die
// erlaubten Medienarten, die Wahl der Sichtbarkeit nur bei „Selbst
// entscheiden", Dateiauswahl über die Hülle (services/systemDialoge) und
// Verkleinerung über das Medien-System (fuerUploadVorbereiten, Grenze 50 MB),
// dieselben Rümpfe an dieselbe Route, dieselben Sätze bei Prüfung und
// Fehler, dieselbe Erfolgsmeldung. Was sich unterscheidet, steht
// ausdrücklich da: Meldungen stehen in der App oben (setError), im Browser im
// Dialog; die Felder heißen dort, wie die Abschnitte der App.
//
// Ersetzt sind Netz, Kontext, Messung, die Dateiauswahl des Systems, das
// Verkleinern (jsdom kann keine Bilder dekodieren), die Aufnahme
// (MediaRecorder) und die Ionic-Bausteine der App.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiPost: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  track: vi.fn(),
  auswahl: vi.fn(),
  verkleinern: vi.fn(),
  fertig: vi.fn(),
  zu: vi.fn(),
  online: true,
}));

vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const R = await vi.importActual<typeof import('react')>('react');
  type K = { children?: React.ReactNode };
  const durch = ({ children }: K) => R.createElement('div', null, children);
  type FeldProps = { value?: string; 'aria-label'?: string; onIonInput?: (e: { detail: { value: string } }) => void };
  const feld = (tag: 'input' | 'textarea') => (p: FeldProps) => R.createElement(tag, {
    'aria-label': p['aria-label'], value: p.value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonInput?.({ detail: { value: e.target.value } }),
  });
  return {
    ...echt,
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonItem: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch,
    IonTitle: ({ children }: K) => R.createElement('h1', null, children),
    IonLabel: ({ children }: K) => R.createElement('span', null, children),
    IonIcon: () => null,
    IonSpinner: () => R.createElement('span', { role: 'progressbar' }),
    IonButton: (p: K & { onClick?: (e: React.MouseEvent) => void; disabled?: boolean; 'aria-label'?: string }) =>
      R.createElement('button', { type: 'button', onClick: p.onClick, disabled: !!p.disabled, 'aria-label': p['aria-label'] }, p.children),
    IonInput: feld('input'),
    IonTextarea: feld('textarea'),
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online, user: { id: 31, type: 'konfi' } }),
}));
vi.mock('../../../services/api', () => ({
  default: { post: (u: string, b?: unknown, o?: unknown) => h.apiPost(u, b, o), get: vi.fn() },
}));
vi.mock('../../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../../services/analytics')>()),
  track: (...args: unknown[]) => h.track(...args),
}));
vi.mock('../../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../../services/systemDialoge')>()),
  dateiAuswaehlen: (o: unknown) => h.auswahl(o),
}));
vi.mock('../../../services/mediaCompression', async (original) => ({
  ...(await original<typeof import('../../../services/mediaCompression')>()),
  fuerUploadVorbereiten: (d: File, grenze: number) => h.verkleinern(d, grenze),
}));
vi.mock('../../../components/shared/AudioPlayer', () => ({
  default: ({ src }: { src: string }) => <span data-testid="abspieler" data-quelle={src} />,
}));

import ChallengeSubmitModal from '../../../components/konfi/modals/ChallengeSubmitModal';
import WebBeitragDialog from '../../../components/shared/web/challenges/WebBeitragDialog';
import { DateiZuGrossFehler, UPLOAD_GRENZE } from '../../../services/mediaCompression';
import { getSuccessMessage } from '../../../utils/challengeTexte';
import { ERLAUBTE_DIENSTE_TEXT } from '../../../utils/musikLinks';
import type { KonfiChallenge } from '../../../types/challenges';

const challenge = (extra: Record<string, unknown>) => ({
  id: 5,
  title: 'Gottesbilder',
  description: 'Wie stellst du dir Gott vor?',
  challenge_type: 'frei',
  visibility: 'konfi_choice',
  moderated: true,
  allowed_media: ['text', 'photo', 'audio', 'link'],
  allow_multiple: true,
  badge_icon: 'flag',
  badge_name: 'Bildermacher:in',
  starts_at: '2026-10-01T07:00:00.000Z',
  ends_at: '2026-10-30T18:00:00.000Z',
  is_draft: false,
  ...extra,
}) as unknown as KonfiChallenge;

/** „Selbst entscheiden", mit Freigabe, vier Medienarten. */
const WAHL = challenge({});
/** Öffentlich ohne Freigabe, nur Text. */
const OEFFENTLICH = challenge({ id: 6, title: 'Lieblingsplatz', visibility: 'public', moderated: false, allowed_media: ['text'] });

const ROUTE = '/challenges/konfi/5/submissions';
const datei = (bytes: number, name: string, typ: string) => new File([new Uint8Array(bytes)], name, { type: typ });
const HANDYFOTO = datei(8 * 1024, 'IMG_1.png', 'image/png');
const VERKLEINERT = datei(600, 'IMG_1.jpg', 'image/jpeg');

/** Die Aufnahme: ein MediaRecorder, der beim Stoppen eine kleine webm-Datei liefert. */
class AufnahmeAttrappe {
  static isTypeSupported = (mime: string) => mime === 'audio/webm';
  mimeType = 'audio/webm';
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(12)], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.apiPost.mockResolvedValue({ data: { id: 77 } });
  h.auswahl.mockResolvedValue([HANDYFOTO]);
  h.verkleinern.mockResolvedValue({ file: VERKLEINERT, bildVorschau: 'blob:vorschau-foto' });
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:vorschau-${++n}`);
  URL.revokeObjectURL = vi.fn();
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = AufnahmeAttrappe;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
  });
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';

const oeffnen = (fassung: Fassung, c: KonfiChallenge = WAHL) => {
  if (fassung === 'app') render(<ChallengeSubmitModal challenge={c} onClose={h.zu} onSuccess={h.fertig} />);
  else render(<WebBeitragDialog challenge={c} onSchliessen={h.zu} onEingereicht={h.fertig} />);
};

/** Eine Wahl aus mehreren: in der App eine antippbare Zeile, im Browser ein Optionsknopf. */
const wahl = (fassung: Fassung, titel: string) => screen.getByRole(fassung === 'app' ? 'button' : 'radio', { name: new RegExp(`^${titel}`) });
const medienarten = (fassung: Fassung): string[] => (fassung === 'app'
  ? screen.queryAllByRole('button', { name: /^(Text|Foto|Audio|Video|Link)/ })
  : screen.queryAllByRole('radio', { name: /^(Text|Foto|Audio|Video|Link)/ }))
  .map((el) => (el.closest('label') ?? el).textContent!.match(/^(Text|Foto|Audio|Video|Link)/)![1]);

/** Das Textfeld des Beitrags: in der App nach seinem Platzhalter benannt, im Browser nach dem Abschnitt. */
const textfeld = (fassung: Fassung) => screen.getByLabelText(fassung === 'app' ? 'Schreib hier deinen Beitrag' : 'Dein Text');
const linkfeld = (fassung: Fassung) => screen.getByLabelText(fassung === 'app' ? 'Link' : 'Dein Link');
const tippen = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });

const einreichen = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Beitrag einreichen' })); });
};

const AUFNAHME_STARTEN: Record<Fassung, RegExp> = { app: /Tippen zum Aufnehmen/, web: /^Aufnahme starten$/ };
const AUFNAHME_BEENDEN: Record<Fassung, RegExp> = { app: /Antippen zum Stoppen/, web: /^Aufnahme beenden$/ };

/** Die Meldung: in der App oben (setError), im Browser im Dialog -- derselbe Satz. */
const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError).toHaveBeenLastCalledWith(text));
  } else {
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

// --- Abläufe, je Fassung -----------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Beitrag einreichen (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('nur die erlaubten Medienarten, in derselben Reihenfolge; Text ist vorgewählt', () => {
    oeffnen(fassung);
    expect(medienarten(fassung)).toEqual(['Text', 'Foto', 'Audio', 'Link']);
    expect(textfeld(fassung)).toBeInTheDocument();
  });

  it('Text bei „Selbst entscheiden", anonym: POST mit genau diesem Rumpf, Messung, Erfolgsmeldung oben, fertig', async () => {
    oeffnen(fassung);
    tippen(textfeld(fassung), '  Gott ist wie Licht  ');
    fireEvent.click(wahl(fassung, 'Anonym'));
    await einreichen();

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost).toHaveBeenCalledWith(ROUTE, {
      media_type: 'text', text_content: 'Gott ist wie Licht', link_url: null, konfi_consent: 'anonymous',
    }, undefined);
    expect(h.track).toHaveBeenCalledWith('challenge-beitrag', { medium: 'text', sichtbarkeit: 'anonymous' });
    expect(h.setSuccess).toHaveBeenCalledWith(getSuccessMessage(WAHL, 'anonymous'));
    expect(h.fertig).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('öffentliche Challenge mit nur Text: keine Wahl der Medienart und der Sichtbarkeit, konfi_consent null', async () => {
    oeffnen(fassung, OEFFENTLICH);
    expect(screen.queryByText('Wie möchtest du antworten?')).toBeNull();
    expect(screen.queryByText('Wer sieht deinen Beitrag?')).toBeNull();
    tippen(textfeld(fassung), 'Die Bank am Deich');
    await einreichen();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost).toHaveBeenCalledWith('/challenges/konfi/6/submissions', {
      media_type: 'text', text_content: 'Die Bank am Deich', link_url: null, konfi_consent: null,
    }, undefined);
    expect(h.setSuccess).toHaveBeenCalledWith(getSuccessMessage(OEFFENTLICH, 'publish'));
  });

  it('Foto: Auswahl über die Hülle (image/*), verkleinert über das Medien-System (50 MB), als multipart mit Fortschritt an dieselbe Route', async () => {
    oeffnen(fassung);
    fireEvent.click(wahl(fassung, 'Foto'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Foto hinzufügen' })); });
    expect(h.auswahl).toHaveBeenCalledWith(expect.objectContaining({ accept: 'image/*' }));
    expect(h.verkleinern).toHaveBeenCalledWith(HANDYFOTO, UPLOAD_GRENZE.challenges);
    expect(await screen.findByRole('img', { name: 'Dein Foto' })).toHaveAttribute('src', 'blob:vorschau-foto');
    tippen(screen.getByLabelText('Etwas dazu sagen? (optional)'), ' Unsere Kirche ');
    await einreichen();

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    const [route, formular, optionen] = h.apiPost.mock.calls[0] as [string, FormData, Record<string, unknown>];
    expect(route).toBe(ROUTE);
    expect([...formular.keys()]).toEqual(['file', 'media_type', 'text_content', 'konfi_consent']);
    expect(formular.get('file')).toBe(VERKLEINERT);
    expect(formular.get('media_type')).toBe('photo');
    expect(formular.get('text_content')).toBe('Unsere Kirche');
    expect(formular.get('konfi_consent')).toBe('publish');
    expect(optionen).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
    expect(typeof optionen.onUploadProgress).toBe('function');
    expect(h.track).toHaveBeenCalledWith('challenge-beitrag', { medium: 'photo', sichtbarkeit: 'publish' });
  });

  it('Foto entfernen: danach fehlt die Datei -- „Bitte wähle eine Datei aus"', async () => {
    oeffnen(fassung);
    fireEvent.click(wahl(fassung, 'Foto'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Foto hinzufügen' })); });
    await screen.findByRole('img', { name: 'Dein Foto' });
    fireEvent.click(screen.getByRole('button', { name: 'Bild entfernen' }));
    expect(screen.queryByRole('img', { name: 'Dein Foto' })).toBeNull();
    await einreichen();
    await erwarteMeldung(fassung, 'Bitte wähle eine Datei aus');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ein Foto, das auch verkleinert zu groß bleibt: der Satz des Medien-Systems', async () => {
    h.verkleinern.mockRejectedValueOnce(new DateiZuGrossFehler(UPLOAD_GRENZE.challenges));
    oeffnen(fassung);
    fireEvent.click(wahl(fassung, 'Foto'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Foto hinzufügen' })); });
    await erwarteMeldung(fassung, 'Datei ist zu groß (max. 50 MB).');
    expect(screen.queryByRole('img', { name: 'Dein Foto' })).toBeNull();
  });

  it('Aufnahme: starten, beenden, einreichen -- die Datei der Aufnahme als multipart', async () => {
    oeffnen(fassung);
    fireEvent.click(wahl(fassung, 'Audio'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: AUFNAHME_STARTEN[fassung] })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: AUFNAHME_BEENDEN[fassung] })); });
    expect(screen.getByText('Aufnahme bereit')).toBeInTheDocument();
    expect(screen.getByTestId('abspieler')).toHaveAttribute('data-quelle', 'blob:vorschau-1');
    await einreichen();

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    const formular = h.apiPost.mock.calls[0][1] as FormData;
    const gesendet = formular.get('file') as File;
    expect(gesendet.name).toBe('challenge-audio.webm');
    expect(gesendet.type).toBe('audio/webm');
    expect(formular.get('media_type')).toBe('audio');
  });

  it('Link: nur Musik-Links -- sonst der Satz der App ohne Anfrage; ein Spotify-Link geht als JSON', async () => {
    oeffnen(fassung);
    fireEvent.click(wahl(fassung, 'Link'));
    tippen(linkfeld(fassung), 'https://example.com/lied');
    await einreichen();
    await erwarteMeldung(fassung, `Hier gehen nur Musik-Links: ${ERLAUBTE_DIENSTE_TEXT}. Bitte teile den Link direkt aus einer dieser Apps.`);
    expect(h.apiPost).not.toHaveBeenCalled();

    tippen(linkfeld(fassung), ' https://open.spotify.com/track/abc ');
    tippen(screen.getByLabelText('Warum dieser Link? (optional)'), 'Mein Lied');
    await einreichen();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost).toHaveBeenCalledWith(ROUTE, {
      media_type: 'link', text_content: 'Mein Lied', link_url: 'https://open.spotify.com/track/abc', konfi_consent: 'publish',
    }, undefined);
  });

  it('nichts geschrieben: „Bitte schreib etwas, bevor du einreichst" -- nichts geht hinaus', async () => {
    oeffnen(fassung);
    tippen(textfeld(fassung), '   ');
    await einreichen();
    await erwarteMeldung(fassung, 'Bitte schreib etwas, bevor du einreichst');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.fertig).not.toHaveBeenCalled();
  });

  it('offline: „Einreichen nicht möglich — du bist offline"', async () => {
    h.online = false;
    oeffnen(fassung);
    tippen(textfeld(fassung), 'Gott ist wie Licht');
    await einreichen();
    await erwarteMeldung(fassung, 'Einreichen nicht möglich — du bist offline');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ein Fehler des Servers: derselbe Satz, nichts schließt, keine Erfolgsmeldung', async () => {
    h.apiPost.mockRejectedValueOnce(Object.assign(new Error('400'), { response: { status: 400, data: { error: 'Diese Challenge ist beendet.' } } }));
    oeffnen(fassung);
    tippen(textfeld(fassung), 'Gott ist wie Licht');
    await einreichen();
    await erwarteMeldung(fassung, 'Diese Challenge ist beendet.');
    expect(h.fertig).not.toHaveBeenCalled();
    expect(h.zu).not.toHaveBeenCalled();
    expect(h.setSuccess).not.toHaveBeenCalled();
  });
});

// --- Nur im Browser ----------------------------------------------------------------------
describe('Beitrag im Browser: das Fenster', () => {
  it('heißt „Dein Beitrag" und nennt die Challenge und wer den Beitrag sieht', () => {
    oeffnen('web');
    const dialog = screen.getByRole('dialog', { name: 'Dein Beitrag' });
    expect(dialog).toHaveAccessibleDescription('Gottesbilder: Du entscheidest unten, wer deinen Beitrag sieht — veröffentlicht wird nach Freigabe');
  });

  it('beim Senden gesperrt, mit dem Fortschritt im Fenster; danach fertig', async () => {
    let fortschritt: ((e: { loaded: number; total: number }) => void) | undefined;
    let fertig: () => void = () => undefined;
    h.apiPost.mockImplementationOnce((_route: string, _daten: unknown, optionen?: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
      fortschritt = optionen?.onUploadProgress;
      return new Promise((resolve) => { fertig = () => resolve({ data: {} }); });
    });
    oeffnen('web');
    fireEvent.click(wahl('web', 'Foto'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Foto hinzufügen' })); });
    await screen.findByRole('img', { name: 'Dein Foto' });
    await einreichen();
    await waitFor(() => expect(fortschritt).toBeDefined());
    await act(async () => { fortschritt!({ loaded: 40, total: 100 }); });

    const dialog = screen.getByRole('dialog', { name: 'Dein Beitrag' });
    expect(dialog).toHaveTextContent('Wird gesendet… 40 %');
    expect(screen.getByRole('progressbar', { name: 'Beitrag wird gesendet: 40 Prozent' })).toHaveAttribute('aria-valuenow', '40');
    expect((screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Schließen' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(h.zu).not.toHaveBeenCalled();

    await act(async () => { fertig(); });
    await waitFor(() => expect(h.fertig).toHaveBeenCalledTimes(1));
  });

  it('Abbrechen schließt ohne Anfrage', () => {
    oeffnen('web');
    tippen(textfeld('web'), 'Doch nicht');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(h.zu).toHaveBeenCalledTimes(1);
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});
