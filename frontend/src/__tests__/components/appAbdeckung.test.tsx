import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Simons Befund 15.09.2026 (echtes Geraet): "Wenn die App per Biometrie
// gesperrt ist, wird sie im App-Switcher trotzdem MIT INHALT angezeigt."
//
// Gerendert wird hier die ECHTE App-Huelle (App.tsx) mit ersetzten Nachbarn:
// Wo haengt die Abdeckung, liegt sie ueber dem Sperrbildschirm, deckt sie
// auch Anmeldeseite und Ladezustand ab, und was steht in der Wartezeit des
// Kaltstarts?
//
// Der Lebenszyklus (wann kippt `verdeckt`, wann `startGeklaert`?) steht
// gerendert in __tests__/hooks/useAppSperre.test.tsx, Abschnitte "Abdeckung
// im App-Umschalter" und "Kaltstart: kein Aufblitzen": verdeckt schon beim
// Wegwechseln, auch waehrend eines Ausflugs, nicht bei "aus" und nicht ohne
// Biometrie; startGeklaert im Browser sofort, nativ erst nach der Antwort,
// auch wenn das Plugin wirft. Die frueheren Quelltext-Pruefungen am Hook
// (setVerdeckt im isActive-false-Zweig, vor laeuftAusflug(), an der
// Einstellung statt an `gesperrt`, synchroner Startwert, finally) sind dort
// als Verhalten abgedeckt.
// ---------------------------------------------------------------------------

type Sperre = { gesperrt: boolean; startGeklaert: boolean; verdeckt: boolean; entsperren: () => void };
const zustand = vi.hoisted(() => ({
  sperre: { gesperrt: false, startGeklaert: true, verdeckt: false, entsperren: () => {} } as Sperre,
  user: null as null | { id: number; type: string },
  seitenBereit: true,
}));

vi.mock('../../hooks/useAppSperre', () => ({ useAppSperre: () => zustand.sperre }));
vi.mock('../../navigation/useSeitenBereit', () => ({ useSeitenBereit: () => zustand.seitenBereit }));
vi.mock('../../contexts/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useApp: () => ({ user: zustand.user, setUser: () => {}, orgVersion: 0, signOut: async () => {} }),
}));
vi.mock('../../contexts/BadgeContext', () => ({
  BadgeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  LiveUpdateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../components/auth/LoginView', () => ({
  default: () => <div data-testid="anmeldeseite">Anmelden</div>,
}));
vi.mock('../../components/auth/KonfiRegisterPage', () => ({ default: () => null }));
vi.mock('../../components/auth/ForgotPasswordPage', () => ({ default: () => null }));
vi.mock('../../components/auth/ResetPasswordPage', () => ({ default: () => null }));
vi.mock('../../components/layout/MainTabs', () => ({
  default: () => <div data-testid="app-inhalt">Startseite</div>,
}));
vi.mock('../../components/layout/SeitenleistenRahmen', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../components/common/GlobalToasts', () => ({ default: () => null }));
vi.mock('../../components/common/PostfachModal', () => ({ default: () => null }));
vi.mock('../../components/common/MindestversionHinweis', () => ({ default: () => null }));
vi.mock('../../components/common/AppSperrbildschirm', () => ({
  default: () => (
    <div data-testid="sperrbildschirm">
      <button>Entsperren</button>
    </div>
  ),
}));
vi.mock('../../navigation/PushZielNavigation', () => ({ default: () => null }));
vi.mock('../../services/betriebsstatus', () => ({ beobachteBetriebsstatus: () => () => {} }));
vi.mock('../../utils/segmentGlas', () => ({ segmentGlasAnschalten: () => () => {} }));
vi.mock('../../utils/modalNamen', () => ({ modalNamenAnschalten: () => () => {} }));

import App from '../../App';
import AppAbdeckung from '../../components/common/AppAbdeckung';

const abdeckungen = () => document.querySelectorAll('.app-abdeckung');
const abdeckung = () => document.querySelector('.app-abdeckung');

beforeEach(() => {
  cleanup();
  zustand.sperre = { gesperrt: false, startGeklaert: true, verdeckt: false, entsperren: () => {} };
  zustand.user = { id: 7, type: 'konfi' };
  zustand.seitenBereit = true;
});

describe('Die Abdeckung wiederholt den weissen-Startbildschirm-Fehler nicht', () => {
  // Begruendung siehe navigation/useSeitenBereit.ts und
  // __tests__/navigation/keinTauschImOutlet.test.ts: Ein IonRouterOutlet
  // registriert die zuerst eingehaengte IonPage und bemerkt einen spaeteren
  // Austausch NICHT. Eine Abdeckung, die kommt und geht, waere genau so ein
  // Austausch — sie darf deshalb weder Seite sein noch in einem Outlet haengen.

  it('ist keine IonPage', () => {
    render(<AppAbdeckung />);
    expect(abdeckung()).not.toBeNull();
    expect(document.querySelectorAll('.ion-page')).toHaveLength(0);
  });

  it('haengt in keinem IonRouterOutlet, sondern direkt unter ion-app als letztes Kind', () => {
    zustand.sperre = { ...zustand.sperre, verdeckt: true };
    render(<App />);
    expect(abdeckungen()).toHaveLength(1);
    const decke = abdeckung()!;
    // Gegencheck, dass ueberhaupt ein Outlet da ist, in dem sie stecken koennte.
    expect(document.querySelectorAll('ion-router-outlet')).toHaveLength(1);
    expect(decke.closest('ion-router-outlet')).toBeNull();
    expect(decke.parentElement!.tagName).toBe('ION-APP');
    expect(decke.parentElement!.lastElementChild).toBe(decke);
  });

  it('deckt JEDEN Zustand ab: angemeldet, Anmeldeseite und Ladezustand', async () => {
    zustand.sperre = { ...zustand.sperre, verdeckt: true };
    render(<App />);
    expect((await screen.findByTestId('app-inhalt')).textContent).toBe('Startseite');
    expect(abdeckungen()).toHaveLength(1);
    cleanup();

    zustand.user = null;
    render(<App />);
    expect((await screen.findByTestId('anmeldeseite')).textContent).toBe('Anmelden');
    expect(abdeckungen()).toHaveLength(1);
    cleanup();

    zustand.user = { id: 7, type: 'konfi' };
    zustand.seitenBereit = false;
    render(<App />);
    expect(document.querySelectorAll('.app-laedt')).toHaveLength(1);
    expect(abdeckungen()).toHaveLength(1);
  });

  it('eine einzige ion-app-Huelle in jedem Zustand -- sonst wandern die Kinder wieder', () => {
    render(<App />);
    expect(document.querySelectorAll('ion-app')).toHaveLength(1);
    cleanup();
    zustand.user = null;
    render(<App />);
    expect(document.querySelectorAll('ion-app')).toHaveLength(1);
  });

  it('liegt ueber dem Sperrbildschirm, nicht darunter', () => {
    // Beim Wegwechseln kann beides gleichzeitig anstehen. Ins Vorschaubild
    // gehoert die neutrale Flaeche, nicht der bedienbare Sperrbildschirm.
    zustand.sperre = { ...zustand.sperre, gesperrt: true, verdeckt: true };
    render(<App />);
    const schloss = screen.getByTestId('sperrbildschirm');
    const decke = abdeckung()!;
    expect(schloss.compareDocumentPosition(decke) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('erscheint nicht, solange nicht verdeckt ist', async () => {
    render(<App />);
    expect(abdeckungen()).toHaveLength(0);
    expect((await screen.findByTestId('app-inhalt')).textContent).toBe('Startseite');
  });
});

describe('Die Abdeckung verraet nichts', () => {
  it('zeigt keine Bedienelemente', () => {
    // Reiner Sichtschutz. Ein Knopf waere im Vorschaubild ohnehin nicht
    // antippbar und muesste dort trotzdem sinnvoll aussehen.
    render(<AppAbdeckung />);
    const bedienbar = abdeckung()!.querySelectorAll(
      'button, ion-button, a, input, [role="button"], [tabindex], [onclick]'
    );
    expect(bedienbar).toHaveLength(0);
  });

  it('nennt weder Namen noch Rolle noch Gemeinde -- nur die App', () => {
    // Dieses Bild sehen auch Unbefugte. Es darf nur sagen, welche App das ist.
    render(<AppAbdeckung />);
    const decke = abdeckung()!;
    expect(decke.textContent).toBe('Konfi Quest');
    expect(decke.querySelector('img')!.getAttribute('alt')).toBe('');
    expect(decke.getAttribute('aria-hidden')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Simons Befund 15.09.2026 (echtes Geraet, Build 194): "Aber er flickert kurz,
// wenn die App aus dem ganz aus Zustand kommt. Vermutlich weil er sonst die
// Grafik zeigt."  App.tsx faellt die Entscheidung VOR dem Rendern und zeigt in
// der Wartezeit das Neutrale, nicht das Logo.
// ---------------------------------------------------------------------------
describe('Kaltstart: die Entscheidung faellt vor dem Rendern', () => {
  it('haelt den Inhalt zurueck, solange die Sperre unbekannt ist', () => {
    zustand.sperre = { ...zustand.sperre, startGeklaert: false };
    render(<App />);
    expect(screen.queryByTestId('app-inhalt')).toBeNull();
    expect(document.querySelectorAll('.app-laedt')).toHaveLength(1);
  });

  it('zeigt in der Wartezeit den Ladebildschirm, nicht die Abdeckung', () => {
    // Die Sperre steht in der Voreinstellung auf 'aus'. Stuende in der
    // Wartezeit die Abdeckung, saehe diese Mehrheit ein Logo aufblitzen, das
    // gleich wieder verschwindet.
    zustand.sperre = { ...zustand.sperre, startGeklaert: false };
    render(<App />);
    expect(document.querySelectorAll('.app-laedt ion-spinner')).toHaveLength(1);
    expect(abdeckungen()).toHaveLength(0);
  });

  it('rendert den Inhalt, sobald die Sperre geklaert ist', async () => {
    render(<App />);
    expect((await screen.findByTestId('app-inhalt')).textContent).toBe('Startseite');
    expect(document.querySelectorAll('.app-laedt')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Android: FLAG_SECURE nur bei eingeschalteter Sperre.
//
// WAECHTER (bewusst Quelltext): MainActivity.java ist nativer Code und laesst
// sich in jsdom nicht ausfuehren -- wie die Konfigurationsdateien unter
// __tests__/config/ ist hier das Lesen der Datei die Pruefung. Die
// Entscheidung: FLAG_SECURE verbietet JEDE Bildschirmaufnahme in der ganzen
// App. Dauerhaft gesetzt wuerde es auch die grosse Mehrheit treffen, die die
// Sperre gar nicht nutzt (Voreinstellung 'aus'). Es haengt deshalb an
// derselben Einstellung wie die Sperre.
// ---------------------------------------------------------------------------
const lies = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const ohneKommentare = (q: string) => q.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const mainActivity = ohneKommentare(
  lies('android/app/src/main/java/de/godsapp/konfiquest/MainActivity.java')
);

describe('Android: FLAG_SECURE nur bei eingeschalteter Sperre', () => {
  it('setzt das Flag', () => {
    expect(mainActivity).toContain('FLAG_SECURE');
    expect(mainActivity).toContain('setFlags');
  });

  it('entfernt das Flag wieder, wenn die Sperre aus ist', () => {
    // Ohne clearFlags bliebe das Flag nach einmaligem Einschalten fuer immer
    // stehen — die Sperre waere abschaltbar, die Einschraenkung nicht.
    expect(mainActivity).toContain('clearFlags');
  });

  it('liest denselben Schluessel wie das JavaScript', () => {
    // Laufen die beiden auseinander, ist das Flag still wirkungslos.
    expect(mainActivity).toContain('konfi_app_sperre_verzoegerung');
    expect(lies('src/services/appSperre.ts')).toContain("'konfi_app_sperre_verzoegerung'");
  });

  it('kennt genau die Sperrwerte aus dem JavaScript', () => {
    for (const wert of ['sofort', '1min', '5min', '15min']) {
      expect(mainActivity).toContain(`"${wert}"`);
    }
  });

  it('wertet bei jeder Rueckkehr neu aus', () => {
    // Nur in onCreate gelesen, bliebe eine im Profil geaenderte Einstellung
    // bis zum naechsten Kaltstart wirkungslos.
    expect(mainActivity).toContain('onResume');
  });
});
