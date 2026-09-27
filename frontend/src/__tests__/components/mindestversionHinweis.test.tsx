// Tests fuer den Hinweis "Bitte aktualisiere Konfi Quest"
// (components/common/MindestversionHinweis) und den Wartungshinweis
// (components/shared/WartungsHinweis) — Feature-Empfehlung E-05.
//
// HINWEIS, KEINE SPERRE (Simon, 27.09.2026: "Keine Zwangsupdates"): Unter der
// Mindestversion erscheint ein Dialog mit "Später" und "Aktualisieren". Er
// laesst sich schliessen, danach ist die App bedienbar, und im selben
// App-Start kommt er nicht wieder.
//
// Die Bausteine lesen den Stand aus services/betriebsstatus. Der Service
// laeuft hier ECHT, und der Dialog auch: ion-alert rendert in jsdom
// vollstaendig (Rolle, Name, Knoepfe, Fokus, Schliessen). Gemockt sind nur
// Plattform, installierte Version, Netz und die API — so pruefen die Tests
// den ganzen Weg von der Antwort des Servers bis zum Dialog, nicht eine
// Attrappe des Stands oder von useIonAlert.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act, waitFor, within } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const halter = {
  nativ: true,
  plattform: 'ios' as string,
  online: true,
  installierteVersion: '2.2.0',
  apiAntwort: {} as unknown,
  apiFehler: null as Error | null,
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => halter.nativ,
    getPlatform: () => halter.plattform,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: async () => ({ version: halter.installierteVersion }),
    addListener: async () => ({ remove: async () => undefined }),
  },
}));

vi.mock('../../services/api', () => ({
  default: {
    get: async () => {
      if (halter.apiFehler) throw halter.apiFehler;
      return { data: halter.apiAntwort };
    },
  },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return halter.online; },
  },
}));

const IOS_URL = 'https://apps.apple.com/de/app/konfi-quest/id6748016619';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest';
const TITEL = 'Bitte aktualisiere Konfi Quest';

function antwort({ min = null as string | null, wartung = null as string | null } = {}) {
  return {
    ios: { version: '2.3.0', url: IOS_URL, min_version: min },
    android: { version: '2.3.0', url: PLAY_URL, min_version: min },
    wartung: wartung === null ? { aktiv: false, text: null } : { aktiv: true, text: wartung },
  };
}

import { pruefeBetriebsstatus, _nurFuerTests_reset } from '../../services/betriebsstatus';
import MindestversionHinweis from '../../components/common/MindestversionHinweis';
import WartungsHinweis from '../../components/shared/WartungsHinweis';

/** Ein Knopf der App unter dem Hinweis — daran zeigt sich, ob sie bedienbar bleibt. */
const appKnopf = vi.fn();

/** Den Hinweis in eine App mit einem eigenen Knopf setzen (wie in App.tsx). */
function App({ zurueckhalten }: { zurueckhalten?: boolean }) {
  return (
    <IonApp>
      <button type="button" onClick={appKnopf}>Weiter in der App</button>
      <MindestversionHinweis zurueckhalten={zurueckhalten} />
    </IonApp>
  );
}

/** Pruefung wie beim App-Start, dann die App rendern. */
async function pruefeUndRendere(props: { zurueckhalten?: boolean } = {}) {
  await act(async () => { await pruefeBetriebsstatus(); });
  return render(<App {...props} />);
}

/**
 * Der Hinweis, sobald er fertig erschienen ist. ion-alert baut sich
 * asynchron auf, und solange er noch hereinfaehrt, ignoriert er Tipps auf
 * seine Knoepfe (dismiss vor dem Ende von present ist bei Ionic wirkungslos).
 * Fertig ist er, wenn er den Fokus hat -- den setzt Ionic am Ende.
 */
async function findeHinweis(): Promise<HTMLElement> {
  const hinweis = await screen.findByRole('alertdialog', { name: TITEL });
  await waitFor(() => expect(document.activeElement).toBe(hinweis));
  return hinweis;
}

/**
 * Wartet so lange, wie der Hinweis zum Erscheinen braucht, und stellt fest,
 * dass keiner da ist. Die Wartezeit ist mit Gegenproben belegt: Ohne die
 * Offline-Pruefung oder ohne die Browser-Ausnahme im Service erscheint der
 * Hinweis innerhalb dieser Zeit, und "offline: nie" bzw. "im Browser: nie"
 * fallen.
 */
async function erwarteKeinenHinweis() {
  await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  expect(document.querySelector('ion-alert')).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.queryByText(TITEL)).toBeNull();
}

/** Tippt einen Knopf im Hinweis an und wartet, bis er ganz weg ist. */
async function tippeImHinweis(name: string) {
  const hinweis = await findeHinweis();
  fireEvent.click(within(hinweis).getByRole('button', { name }));
  await waitFor(() => expect(document.querySelector('ion-alert')).toBeNull());
}

beforeEach(() => {
  // Der Stand liegt auf Modulebene -- jeder Test beginnt wie ein frischer Start.
  _nurFuerTests_reset();
  halter.nativ = true;
  halter.plattform = 'ios';
  halter.online = true;
  halter.installierteVersion = '2.2.0';
  halter.apiAntwort = antwort();
  halter.apiFehler = null;
  appKnopf.mockClear();
});

afterEach(() => {
  cleanup();
  // Ein Dialog, der nicht geschlossen wurde, darf nicht in den naechsten Test
  // hineinragen (ion-alert haengt an ion-app, zur Sicherheit auch am body).
  document.querySelectorAll('ion-alert').forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('MindestversionHinweis', () => {
  it('unter der Mindestversion: Hinweis mit Namen, Grund, „Später" und „Aktualisieren" — keine Sperre', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    await pruefeUndRendere();

    const hinweis = await findeHinweis();
    expect(hinweis.getAttribute('aria-modal')).toBe('true');
    // Der Grund ist die Beschreibung des Dialogs (aria-describedby).
    const beschreibung = document.getElementById(hinweis.getAttribute('aria-describedby') ?? '');
    expect(beschreibung).toHaveTextContent(
      'Diese Version wird nicht mehr unterstützt. Die aktuelle Version liegt im App Store bereit.',
    );

    // Genau zwei Knoepfe: zuerst "Später", dann "Aktualisieren".
    const knoepfe = within(hinweis).getAllByRole('button');
    expect(knoepfe.map((k) => k.textContent)).toEqual(['Später', 'Aktualisieren']);

    // Kein Sperrbildschirm mehr.
    expect(document.querySelector('.app-sperrbildschirm')).toBeNull();
  });

  it('„Später" schliesst den Hinweis, danach ist die App bedienbar', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const oeffnen = vi.spyOn(window, 'open').mockImplementation(() => null);
    await pruefeUndRendere();

    await tippeImHinweis('Später');

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    expect(oeffnen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter in der App' }));
    expect(appKnopf).toHaveBeenCalledTimes(1);
  });

  it('weggeklickt bleibt weggeklickt bis zum naechsten Start — auch nach Rueckkehr und neuer Montage', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const erste = await pruefeUndRendere();
    await tippeImHinweis('Später');

    // Rueckkehr in die App: der Server meldet dasselbe.
    await act(async () => { await pruefeBetriebsstatus(); });
    await erwarteKeinenHinweis();

    // Die Komponente wird neu montiert (etwa nach einer Fehlerseite).
    erste.unmount();
    render(<App />);
    await erwarteKeinenHinweis();
    cleanup();

    // Naechster Start: Der Hinweis ist wieder da.
    _nurFuerTests_reset();
    await pruefeUndRendere();
    await findeHinweis();
  });

  it('„Aktualisieren" oeffnet die Store-Seite aus der Antwort', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const oeffnen = vi.spyOn(window, 'open').mockImplementation(() => null);
    await pruefeUndRendere();

    await tippeImHinweis('Aktualisieren');

    expect(oeffnen).toHaveBeenCalledTimes(1);
    expect(oeffnen).toHaveBeenCalledWith(IOS_URL, '_blank');
  });

  it('auf Android: Google Play im Text und als Ziel', async () => {
    halter.plattform = 'android';
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const oeffnen = vi.spyOn(window, 'open').mockImplementation(() => null);
    await pruefeUndRendere();

    const hinweis = await findeHinweis();
    expect(hinweis).toHaveTextContent('Die aktuelle Version liegt bei Google Play bereit.');
    await tippeImHinweis('Aktualisieren');
    expect(oeffnen).toHaveBeenCalledWith(PLAY_URL, '_blank');
  });

  it('Fokus: springt in den Hinweis und nach „Später" zurueck, wo er vorher stand', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const ansicht = await pruefeUndRendere({ zurueckhalten: true });
    const knopf = screen.getByRole('button', { name: 'Weiter in der App' });
    knopf.focus();

    ansicht.rerender(<App zurueckhalten={false} />);
    const hinweis = await findeHinweis();
    await waitFor(() => expect(document.activeElement).toBe(hinweis));

    await tippeImHinweis('Später');
    await waitFor(() => expect(document.activeElement).toBe(knopf));
  });

  it('wartet, solange die App-Sperre davor liegt, und erscheint nach dem Entsperren', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const ansicht = await pruefeUndRendere({ zurueckhalten: true });
    await erwarteKeinenHinweis();

    ansicht.rerender(<App zurueckhalten={false} />);
    await findeHinweis();
  });

  it('gleich der Mindestversion (2.3.0 gegen 2.3.0): kein Hinweis', async () => {
    halter.installierteVersion = '2.3.0';
    halter.apiAntwort = antwort({ min: '2.3.0' });
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });

  it('darueber: kein Hinweis', async () => {
    halter.installierteVersion = '2.10.0';
    halter.apiAntwort = antwort({ min: '2.9.0' });
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });

  it('semantisch darunter (2.9.0 gegen 2.10.0): Hinweis', async () => {
    halter.installierteVersion = '2.9.0';
    halter.apiAntwort = antwort({ min: '2.10.0' });
    await pruefeUndRendere();
    await findeHinweis();
  });

  it('im Browser: nie', async () => {
    halter.nativ = false;
    halter.plattform = 'web';
    halter.apiAntwort = antwort({ min: '99.0.0' });
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });

  it('im Browser auch dann nicht, wenn sich die Umgebung als iOS meldet', async () => {
    // Die Ausnahme haengt an isNativePlatform, nicht an der Plattform-Kennung.
    halter.nativ = false;
    halter.plattform = 'ios';
    halter.apiAntwort = antwort({ min: '2.3.0' });
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });

  it('offline: nie', async () => {
    halter.online = false;
    halter.apiAntwort = antwort({ min: '2.3.0' });
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });

  it('Anfrage scheitert: nie', async () => {
    halter.apiFehler = new Error('Network Error');
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });

  it('keine Mindestversion gesetzt: kein Hinweis', async () => {
    halter.apiAntwort = antwort();
    await pruefeUndRendere();
    await erwarteKeinenHinweis();
  });
});

describe('WartungsHinweis', () => {
  async function pruefeUndRendereWartung() {
    await act(async () => { await pruefeBetriebsstatus(); });
    return render(<WartungsHinweis />);
  }

  it('aktiv: Hinweis mit dem Text des Servers', async () => {
    halter.apiAntwort = antwort({ wartung: 'Heute ab 20 Uhr ist Konfi Quest für eine Stunde nicht erreichbar.' });
    await pruefeUndRendereWartung();
    const hinweis = screen.getByRole('note', { name: 'Wartungshinweis' });
    expect(hinweis).toHaveTextContent('Heute ab 20 Uhr ist Konfi Quest für eine Stunde nicht erreichbar.');
    // Nicht sperrend: kein Knopf, nichts zum Wegklicken, kein Dialog.
    expect(hinweis.querySelectorAll('ion-button, button, [role="button"], a[href]')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('inaktiv: kein Hinweis', async () => {
    halter.apiAntwort = antwort();
    const { container } = await pruefeUndRendereWartung();
    expect(container.innerHTML).toBe('');
  });

  it('zeigt den Text als Klartext — HTML wird nicht ausgefuehrt', async () => {
    halter.apiAntwort = antwort({ wartung: '<b>Wartung</b> <img src=x onerror="alert(1)">' });
    const { container } = await pruefeUndRendereWartung();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('note', { name: 'Wartungshinweis' }))
      .toHaveTextContent('<b>Wartung</b> <img src=x onerror="alert(1)">');
  });

  it('gilt auch im Browser', async () => {
    halter.nativ = false;
    halter.plattform = 'web';
    halter.apiAntwort = antwort({ wartung: 'Wartung heute Abend' });
    await pruefeUndRendereWartung();
    expect(screen.getByRole('note', { name: 'Wartungshinweis' })).toHaveTextContent('Wartung heute Abend');
  });

  it('verschwindet, sobald der Server ihn nicht mehr meldet', async () => {
    halter.apiAntwort = antwort({ wartung: 'Wartung' });
    const { container } = await pruefeUndRendereWartung();
    expect(screen.getByRole('note', { name: 'Wartungshinweis' })).toHaveTextContent('Wartung');

    halter.apiAntwort = antwort();
    await act(async () => { await pruefeBetriebsstatus(); });
    expect(container.innerHTML).toBe('');
  });
});

describe('Einbau: eine Pruefung, ein Hinweis, der Wartungshinweis bei allen Rollen', () => {
  const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
  // Nur Code, ohne Kommentare -- die erwaehnen die Bausteine auch.
  const code = (pfad: string) => lies(pfad).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

  it('App.tsx haengt die Pruefung und den Hinweis genau einmal ein; der Hinweis wartet auf die App-Sperre', () => {
    const app = code('src/App.tsx');
    expect(app.match(/beobachteBetriebsstatus\(\)/g) ?? []).toHaveLength(1);
    expect(app.match(/<MindestversionHinweis\b/g) ?? []).toHaveLength(1);
    // Solange der Sperrbildschirm steht oder beim Start noch nicht klar ist,
    // ob er kommt, wartet der Hinweis -- sonst laege ein modaler Dialog
    // unsichtbar unter dem Schloss und zoege Fokus und Vorlesehilfe dorthin.
    expect(app).toMatch(/<MindestversionHinweis\s+zurueckhalten=\{gesperrt \|\| !startGeklaert\}\s*\/>/);
  });

  it('die Sperre ist weg: keine Datei, kein Einbau', () => {
    expect(existsSync(resolve(process.cwd(), 'src/components/common/MindestversionSperre.tsx'))).toBe(false);
    expect(code('src/App.tsx')).not.toMatch(/MindestversionSperre/);
  });

  // Drei Rollenbaeume, einer wird vergessen -- der Fehlertyp, den
  // rollenGleichbehandlung.test.ts beschreibt. Die Startseite jeder Rolle
  // (navigation/rollenBaeume.ts, home) und die Anmeldeseite tragen den Hinweis.
  const ORTE: Record<string, string> = {
    konfi: 'src/components/konfi/pages/KonfiDashboardPage.tsx',
    teamer: 'src/components/teamer/pages/TeamerDashboardPage.tsx',
    'admin/org_admin (AdminKonfisPage -> KonfisView)': 'src/components/admin/KonfisView.tsx',
    super_admin: 'src/components/admin/pages/AdminOrganizationsPage.tsx',
    Anmeldung: 'src/components/auth/LoginView.tsx',
  };

  it.each(Object.entries(ORTE))('%s: der Wartungshinweis steht genau einmal auf der Seite', (_ort, pfad) => {
    expect(code(pfad).match(/<WartungsHinweis\b/g) ?? []).toHaveLength(1);
  });
});
