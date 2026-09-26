import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-01 / BF-02 / BF-08 (Anmeldeseiten):
//
// Die vier Anmeldeseiten waren am Rechner nur halb bedienbar. Die Tab-Reihe
// der Anmeldung hatte drei Haltepunkte (Nutzername, Passwort, „Anmelden");
// der Augen-Umschalter war ein ion-icon mit onClick, „Passwort vergessen?"
// und „Mit Einladungscode registrieren" waren <span onClick> -- weder
// fokussierbar noch mit Rolle. Enter im Passwortfeld tat nichts. Die Felder
// hatten keinen zugaenglichen Namen: Ionic 9 bindet ein Geschwister-IonLabel
// nicht mehr an das Feld, im Zugaenglichkeitsbaum stand „textbox" ohne Namen.
// Die Fehlermeldung nach einem Fehlversuch war ein div ohne role="alert".
//
// Diese Tests RENDERN die Seiten (kein Quelltext-Vergleich) und pruefen die
// Bedienung so, wie Tastatur und Vorleseprogramm sie sehen: Rollen, Namen,
// Fokus, Enter, Live-Regionen.
//
// Was Ionic in jsdom kann und was nicht (nachgemessen 26.09.2026):
// - ion-input hydriert (scoped, Light-DOM). React setzt aria-label als
//   Attribut auf den Host; Ionic zieht es beim Hydrieren auf das native
//   <input> um. Der Name ist also je nach Zeitpunkt am Host oder am <input>
//   -- die Helfer unten schauen an beiden Stellen.
// - Props wie placeholder, type, value kommen NICHT am Element an, und
//   ionInput-Ereignisse erreichen die React-Handler nicht. Werte lassen
//   sich deshalb nicht setzen. Enter wird darum ueber die Eingabepruefung
//   nachgewiesen: Enter -> handleLogin/handleSubmit -> „Bitte ... eingeben"
//   als role="alert". Dass Enter mit gefuellten Feldern wirklich sendet
//   (POST /api/auth/login), hat Playwright/Chromium gegen Vite gemessen
//   (Abschlussmeldung des Pakets), ebenso die Tab-Reihenfolge des Browsers
//   und den gerenderten Fokusring.
// - onKeyDown ist ein React-Ereignis und kommt an.
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...echt,
    useIonRouter: () => ({ push: mockPush, goBack: vi.fn(), canGoBack: () => false, routeInfo: undefined }),
  };
});

const mockLogin = vi.fn();
vi.mock('../../services/auth', () => ({
  loginWithAutoDetection: (...a: unknown[]) => mockLogin(...a),
  mitBiometrieAnmelden: vi.fn(),
  sitzungUebernehmen: vi.fn(),
}));
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: async () => ({ verfuegbar: false, art: 'keine', bezeichnung: null, sinnbild: 'schloss' }),
  istBiometrieAktiv: async () => false,
}));
vi.mock('../../services/tokenStore', () => ({
  setToken: vi.fn(), setUser: vi.fn(), setRefreshToken: vi.fn(),
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  },
}));

// Der Standort muss zwischen zwei Rendern DIESELBE Objektidentitaet behalten --
// die Seiten haengen ihren useEffect daran (siehe navigation/useAppLocation.ts).
// Ein frisches Objekt je Aufruf liesse validateCode endlos laufen und jede
// Fehlermeldung sofort wieder loeschen (so gesehen beim Schreiben dieser Tests).
const ort = (search: string) => ({ pathname: '/', search, state: null });
let standort = ort('');
vi.mock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => standort,
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setUser: vi.fn(), setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));

import LoginView from '../../components/auth/LoginView';
import ForgotPasswordPage from '../../components/auth/ForgotPasswordPage';
import ResetPasswordPage from '../../components/auth/ResetPasswordPage';
import KonfiRegisterPage from '../../components/auth/KonfiRegisterPage';

/** Zugaenglicher Name eines Bedienelements -- bei ion-input am Host oder am nativen <input>. */
const name = (el: Element) =>
  el.getAttribute('aria-label')
  ?? el.querySelector('input')?.getAttribute('aria-label')
  ?? el.textContent?.replace(/\s+/g, ' ').trim()
  ?? '';

/** Das ion-input mit diesem Namen (wirft, wenn es fehlt oder mehrdeutig ist). */
const feld = (n: string): HTMLElement => {
  const treffer = [...document.body.querySelectorAll<HTMLElement>('ion-input')].filter((el) => name(el) === n);
  if (treffer.length !== 1) throw new Error(`Feld „${n}": ${treffer.length} Treffer`);
  return treffer[0];
};

const enter = (el: Element) => fireEvent.keyDown(el, { key: 'Enter' });

/**
 * Was Tastatur und Vorleseprogramm der Reihe nach erreichen -- in
 * Dokumentreihenfolge, benannt wie der Zugaenglichkeitsbaum es taete.
 */
const bedienreihenfolge = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('ion-input, ion-button, button, a[href]')].map(name);

/** Ein <a href>, der den Fokus annimmt und per Klick zum Ziel fuehrt. */
const erwarteLink = (text: string | RegExp, ziel: string) => {
  const link = screen.getByRole('link', { name: text });
  link.focus();
  expect(document.activeElement).toBe(link);
  fireEvent.click(link);
  expect(mockPush).toHaveBeenCalledWith(ziel);
  return link;
};

beforeEach(() => {
  vi.clearAllMocks();
  standort = ort('');
  sessionStorage.clear();
});
afterEach(() => cleanup());

// ===========================================================================
describe('Anmeldung (LoginView)', () => {
  it('jedes Feld hat einen zugaenglichen Namen', async () => {
    render(<LoginView />);
    expect((await screen.findByLabelText('Benutzername')).closest('ion-input')).not.toBeNull();
    expect((await screen.findByLabelText('Passwort')).closest('ion-input')).not.toBeNull();
  });

  it('alle Bedienelemente stehen in sinnvoller Reihenfolge und tragen Rolle und Namen', () => {
    const { container } = render(<LoginView />);
    expect(bedienreihenfolge(container)).toEqual([
      'Benutzername',
      'Passwort',
      'Passwort anzeigen',
      'Anmelden',
      'Passwort vergessen?',
      'Noch keinen Account?Mit Einladungscode registrieren',
    ]);
  });

  it('der Augen-Umschalter ist ein Knopf mit Namen und Zustand', () => {
    render(<LoginView />);
    const knopf = screen.getByRole('button', { name: 'Passwort anzeigen' });
    expect(knopf).toHaveAttribute('aria-pressed', 'false');
    knopf.focus();
    expect(document.activeElement).toBe(knopf);

    fireEvent.click(knopf);

    expect(screen.getByRole('button', { name: 'Passwort verbergen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Passwort anzeigen' })).not.toBeInTheDocument();
  });

  it('„Passwort vergessen?" und „Registrieren" sind Links, nehmen den Fokus an und navigieren', () => {
    render(<LoginView />);
    erwarteLink('Passwort vergessen?', '/forgot-password');
    erwarteLink(/Mit Einladungscode registrieren/, '/register');
  });

  it('Enter im Passwortfeld loest die Anmeldung aus -- die Eingabepruefung meldet als Alarm, was fehlt', async () => {
    render(<LoginView />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    enter(feld('Passwort'));

    const alarm = await screen.findByRole('alert');
    expect(alarm).toHaveTextContent('Anmeldung fehlgeschlagen');
    expect(alarm).toHaveTextContent('Bitte Benutzername und Passwort eingeben');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('Enter im Benutzernamen-Feld sendet ebenfalls', async () => {
    render(<LoginView />);
    enter(feld('Benutzername'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bitte Benutzername und Passwort eingeben');
  });

  it('eine andere Taste als Enter loest nichts aus', () => {
    render(<LoginView />);
    fireEvent.keyDown(feld('Passwort'), { key: 'a' });
    fireEvent.keyDown(feld('Passwort'), { key: 'Tab' });
    fireEvent.keyDown(feld('Passwort'), { key: ' ' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('die Fehlermeldung laesst sich mit einem benannten Knopf schliessen', async () => {
    render(<LoginView />);
    enter(feld('Passwort'));
    await screen.findByRole('alert');

    const schliessen = screen.getByRole('button', { name: 'Meldung schließen' });
    schliessen.focus();
    expect(document.activeElement).toBe(schliessen);
    fireEvent.click(schliessen);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('der Hinweis „Sitzung abgelaufen" ist beim Oeffnen ein Alarm', () => {
    sessionStorage.setItem('session_expired', '1');
    render(<LoginView />);
    expect(screen.getByRole('alert')).toHaveTextContent('Deine Sitzung ist abgelaufen');
  });
});

// ===========================================================================
describe('Passwort vergessen (ForgotPasswordPage)', () => {
  it('das Feld hat einen Namen, der Ruecklink ist ein Link', async () => {
    const { container } = render(<ForgotPasswordPage />);
    expect((await screen.findByLabelText('E-Mail-Adresse')).closest('ion-input')).not.toBeNull();
    expect(bedienreihenfolge(container)).toEqual(['E-Mail-Adresse', 'Link senden', 'Zurück zum Login']);
    erwarteLink('Zurück zum Login', '/login');
  });

  it('Enter im Feld sendet -- ohne Adresse meldet die Pruefung den Fehler als Alarm', async () => {
    render(<ForgotPasswordPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    enter(feld('E-Mail-Adresse'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bitte gib deine E-Mail-Adresse ein');
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('Neues Passwort setzen (ResetPasswordPage)', () => {
  beforeEach(() => { standort = ort('?token=abc123'); });

  it('beide Felder haben Namen, beide Augen-Umschalter sind unterscheidbare Knoepfe', async () => {
    const { container } = render(<ResetPasswordPage />);
    expect((await screen.findByLabelText('Neues Passwort')).closest('ion-input')).not.toBeNull();
    expect((await screen.findByLabelText('Passwort bestätigen')).closest('ion-input')).not.toBeNull();
    expect(bedienreihenfolge(container)).toEqual([
      'Neues Passwort',
      'Passwort anzeigen',
      'Passwort bestätigen',
      'Passwortbestätigung anzeigen',
      'Passwort ändern',
      'Zurück zum Login',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Passwortbestätigung anzeigen' }));
    expect(screen.getByRole('button', { name: 'Passwortbestätigung verbergen' })).toHaveAttribute('aria-pressed', 'true');
    // Der erste Umschalter bleibt unberuehrt.
    expect(screen.getByRole('button', { name: 'Passwort anzeigen' })).toHaveAttribute('aria-pressed', 'false');
    erwarteLink('Zurück zum Login', '/login');
  });

  it('Enter im letzten Feld schickt ab -- die Pruefung meldet ein zu schwaches Passwort als Alarm', async () => {
    render(<ResetPasswordPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    enter(feld('Passwort bestätigen'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Passwort erfüllt nicht alle Anforderungen');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('ohne Token ist der Hinweis auf den ungueltigen Link ein Alarm', () => {
    standort = ort('');
    render(<ResetPasswordPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('UNGÜLTIGER LINK');
  });
});

// ===========================================================================
describe('Registrierung mit Einladungscode (KonfiRegisterPage)', () => {
  const einladung = { data: { jahrgang_name: 'Jahrgang 2027', organization_name: 'Testgemeinde' } };

  it('Code-Feld mit Namen, Knopf und Ruecklink in der Reihe, Ruecklink ist ein Link', async () => {
    const { container } = render(<KonfiRegisterPage />);
    expect((await screen.findByLabelText('Einladungscode')).closest('ion-input')).not.toBeNull();
    expect(bedienreihenfolge(container)).toEqual(['Einladungscode', 'Code prüfen', 'Zurück zur Anmeldung']);
    erwarteLink('Zurück zur Anmeldung', '/login');
  });

  it('ein abgelehnter Code wird als Alarm gemeldet', async () => {
    mockGet.mockRejectedValue({ response: { status: 404, data: { error_code: 'not_found' } } });
    standort = ort('?code=FALSCH99');
    render(<KonfiRegisterPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Einladungscode existiert nicht');
    expect(mockGet).toHaveBeenCalledWith('/auth/validate-invite/FALSCH99');
  });

  it('das Formular hat benannte Pflichtfelder, zwei Augen-Knoepfe und einen Anmelde-Link', async () => {
    mockGet.mockResolvedValue(einladung);
    standort = ort('?code=ABC12345');
    const { container } = render(<KonfiRegisterPage />);
    await screen.findByLabelText('Dein Name');

    for (const n of ['Dein Name', 'Benutzername', 'Passwort', 'Passwort bestätigen']) {
      expect(screen.getByLabelText(n)).toHaveAttribute('aria-required', 'true');
    }
    expect(screen.getByLabelText('E-Mail (optional)')).not.toHaveAttribute('aria-required');

    expect(bedienreihenfolge(container)).toEqual([
      'Dein Name',
      'Benutzername',
      'E-Mail (optional)',
      'Passwort',
      'Passwort anzeigen',
      'Passwort bestätigen',
      'Passwortbestätigung anzeigen',
      'Registrieren',
      'Anmelden',
    ]);
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login');
  });

  it('Enter im letzten Feld schickt das Formular ab -- die Pruefung meldet als Alarm, was fehlt', async () => {
    mockGet.mockResolvedValue(einladung);
    standort = ort('?code=ABC12345');
    render(<KonfiRegisterPage />);
    await screen.findByLabelText('Passwort bestätigen');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    enter(feld('Passwort bestätigen'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bitte gib deinen Namen ein');
    expect(mockPost).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('Sichtbarer Fokus (Stylesheet)', () => {
  // jsdom rendert weder :focus-visible noch ::part. Dass der Ring da ist,
  // hat Playwright gemessen (innerer Knopf: outline "solid 3px rgb(255,255,255)",
  // Host: "solid 3px rgb(91,33,182)" -- vorher "none 0px"). Hier wird nur
  // festgehalten, dass die Regeln nicht verschwinden und NACH variables.css
  // geladen werden -- dort steht die Regel, die Fokusrahmen entfernt.
  const css = readFileSync(resolve(process.cwd(), 'src/theme/barrierefreiheit.css'), 'utf8');
  const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('der Anmelde-Knopf bekommt bei Tastaturfokus einen Ring -- ueber :focus-visible UND Ionics .ion-focused', () => {
    expect(css).toMatch(/\.app-auth-button\.ion-focused::part\(native\)[^{]*\{[^}]*outline:\s*3px solid/);
    expect(css).toMatch(/\.app-auth-button:focus-visible::part\(native\)/);
    expect(css).toMatch(/\.app-auth-button\.ion-focused,\s*\.app-auth-button:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--app-color-konfis\)/);
  });

  it('Links und nackte Knoepfe bekommen bei Tastaturfokus einen Ring', () => {
    expect(css).toMatch(/\.app-auth-link:focus-visible[^{]*\{[^}]*outline:\s*2px solid currentColor/);
    expect(css).toMatch(/\.app-auth-knopf-nackt:focus-visible/);
  });

  it('das Stylesheet wird nach variables.css geladen', () => {
    const variablen = app.indexOf("import './theme/variables.css'");
    const barrierefrei = app.indexOf("import './theme/barrierefreiheit.css'");
    expect(variablen).toBeGreaterThan(-1);
    expect(barrierefrei).toBeGreaterThan(variablen);
  });
});
