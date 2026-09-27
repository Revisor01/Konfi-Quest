// Tests fuer den Bildschirm "Bitte aktualisiere Konfi Quest"
// (components/common/MindestversionSperre) und den Wartungshinweis
// (components/shared/WartungsHinweis) — Feature-Empfehlung E-05,
// Entscheidung 27.09.2026.
//
// Die Bausteine lesen den Stand aus services/betriebsstatus. Der Service
// laeuft hier ECHT, gemockt sind nur Plattform, installierte Version, Netz
// und die API — so pruefen die Tests den ganzen Weg von der Antwort des
// Servers bis zum Bildschirm, nicht eine Attrappe des Stands.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'fs';
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

function antwort({ min = null as string | null, wartung = null as string | null } = {}) {
  return {
    ios: { version: '2.3.0', url: IOS_URL, min_version: min },
    android: { version: '2.3.0', url: PLAY_URL, min_version: min },
    wartung: wartung === null ? { aktiv: false, text: null } : { aktiv: true, text: wartung },
  };
}

import { pruefeBetriebsstatus, _nurFuerTests_reset } from '../../services/betriebsstatus';
import MindestversionSperre from '../../components/common/MindestversionSperre';
import WartungsHinweis from '../../components/shared/WartungsHinweis';

/** Der Store-Knopf (IonButton) ueber seinen sichtbaren Namen. */
function storeKnopf(name: string): HTMLElement {
  const knopf = screen.getByText(name).closest('ion-button');
  expect(knopf, `Knopf "${name}"`).not.toBeNull();
  return knopf as HTMLElement;
}

/** Pruefung wie beim App-Start, dann rendern. */
async function pruefeUndRendere(was: 'sperre' | 'wartung') {
  await act(async () => { await pruefeBetriebsstatus(); });
  return render(was === 'sperre' ? <MindestversionSperre /> : <WartungsHinweis />);
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MindestversionSperre', () => {
  it('unter der Mindestversion: Sperrbildschirm mit Ueberschrift, Grund und Store-Knopf', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    await pruefeUndRendere('sperre');

    const dialog = screen.getByRole('dialog', { name: 'Bitte aktualisiere Konfi Quest' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { level: 1, name: 'Bitte aktualisiere Konfi Quest' })).toBeInTheDocument();
    expect(screen.getByText('Diese Version wird nicht mehr unterstützt. Lade die aktuelle Version, um weiterzumachen.'))
      .toBeInTheDocument();

    // Genau EIN Knopf: der zum Store. Kein Schliessen, kein "Spaeter".
    // (IonButton ist in jsdom ein nacktes <ion-button> ohne Rolle -- deshalb
    // hier ueber die Elemente gezaehlt, wie in anmeldeseitenBarrierefrei.)
    const knoepfe = dialog.querySelectorAll('ion-button, button, [role="button"], a[href]');
    expect(knoepfe).toHaveLength(1);
    expect(knoepfe[0]).toHaveTextContent('Im App Store aktualisieren');
  });

  it('der Knopf oeffnet die Store-Seite aus der Antwort', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const oeffnen = vi.spyOn(window, 'open').mockImplementation(() => null);
    await pruefeUndRendere('sperre');
    fireEvent.click(storeKnopf('Im App Store aktualisieren'));
    expect(oeffnen).toHaveBeenCalledTimes(1);
    expect(oeffnen).toHaveBeenCalledWith(IOS_URL, '_blank');
  });

  it('auf Android: Knopf und Ziel von Google Play', async () => {
    halter.plattform = 'android';
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const oeffnen = vi.spyOn(window, 'open').mockImplementation(() => null);
    await pruefeUndRendere('sperre');
    fireEvent.click(storeKnopf('Bei Google Play aktualisieren'));
    expect(oeffnen).toHaveBeenCalledWith(PLAY_URL, '_blank');
  });

  it('holt den Fokus auf die Ueberschrift, damit Vorlesehilfen dort beginnen', async () => {
    halter.apiAntwort = antwort({ min: '2.3.0' });
    await pruefeUndRendere('sperre');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('gleich der Mindestversion (2.3.0 gegen 2.3.0): nichts', async () => {
    halter.installierteVersion = '2.3.0';
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const { container } = await pruefeUndRendere('sperre');
    expect(container.innerHTML).toBe('');
  });

  it('darueber: nichts', async () => {
    halter.installierteVersion = '2.10.0';
    halter.apiAntwort = antwort({ min: '2.9.0' });
    const { container } = await pruefeUndRendere('sperre');
    expect(container.innerHTML).toBe('');
  });

  it('semantisch darunter (2.9.0 gegen 2.10.0): Sperre', async () => {
    halter.installierteVersion = '2.9.0';
    halter.apiAntwort = antwort({ min: '2.10.0' });
    await pruefeUndRendere('sperre');
    expect(screen.getByRole('heading', { level: 1, name: 'Bitte aktualisiere Konfi Quest' })).toBeInTheDocument();
  });

  it('im Browser: nie', async () => {
    halter.nativ = false;
    halter.plattform = 'web';
    halter.apiAntwort = antwort({ min: '99.0.0' });
    const { container } = await pruefeUndRendere('sperre');
    expect(container.innerHTML).toBe('');
  });

  it('offline: nie', async () => {
    halter.online = false;
    halter.apiAntwort = antwort({ min: '2.3.0' });
    const { container } = await pruefeUndRendere('sperre');
    expect(container.innerHTML).toBe('');
  });

  it('Anfrage scheitert: nie', async () => {
    halter.apiFehler = new Error('Network Error');
    const { container } = await pruefeUndRendere('sperre');
    expect(container.innerHTML).toBe('');
  });

  it('keine Mindestversion gesetzt: nichts', async () => {
    halter.apiAntwort = antwort();
    const { container } = await pruefeUndRendere('sperre');
    expect(container.innerHTML).toBe('');
  });
});

describe('WartungsHinweis', () => {
  it('aktiv: Hinweis mit dem Text des Servers', async () => {
    halter.apiAntwort = antwort({ wartung: 'Heute ab 20 Uhr ist Konfi Quest für eine Stunde nicht erreichbar.' });
    await pruefeUndRendere('wartung');
    const hinweis = screen.getByRole('note', { name: 'Wartungshinweis' });
    expect(hinweis).toHaveTextContent('Heute ab 20 Uhr ist Konfi Quest für eine Stunde nicht erreichbar.');
    // Nicht sperrend: kein Knopf, nichts zum Wegklicken, kein Dialog.
    expect(hinweis.querySelectorAll('ion-button, button, [role="button"], a[href]')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('inaktiv: kein Hinweis', async () => {
    halter.apiAntwort = antwort();
    const { container } = await pruefeUndRendere('wartung');
    expect(container.innerHTML).toBe('');
  });

  it('zeigt den Text als Klartext — HTML wird nicht ausgefuehrt', async () => {
    halter.apiAntwort = antwort({ wartung: '<b>Wartung</b> <img src=x onerror="alert(1)">' });
    const { container } = await pruefeUndRendere('wartung');
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('note', { name: 'Wartungshinweis' }))
      .toHaveTextContent('<b>Wartung</b> <img src=x onerror="alert(1)">');
  });

  it('gilt auch im Browser', async () => {
    halter.nativ = false;
    halter.plattform = 'web';
    halter.apiAntwort = antwort({ wartung: 'Wartung heute Abend' });
    await pruefeUndRendere('wartung');
    expect(screen.getByRole('note', { name: 'Wartungshinweis' })).toHaveTextContent('Wartung heute Abend');
  });

  it('verschwindet, sobald der Server ihn nicht mehr meldet', async () => {
    halter.apiAntwort = antwort({ wartung: 'Wartung' });
    const { container } = await pruefeUndRendere('wartung');
    expect(screen.getByRole('note', { name: 'Wartungshinweis' })).toHaveTextContent('Wartung');

    halter.apiAntwort = antwort();
    await act(async () => { await pruefeBetriebsstatus(); });
    expect(container.innerHTML).toBe('');
  });
});

describe('Einbau: eine Pruefung, eine Sperre, der Hinweis bei allen Rollen', () => {
  const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
  // Nur Code, ohne Kommentare -- die erwaehnen die Bausteine auch.
  const code = (pfad: string) => lies(pfad).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

  it('App.tsx haengt die Pruefung und die Sperre genau einmal ein, zwischen Schloss und Abdeckung', () => {
    const app = code('src/App.tsx');
    expect(app.match(/beobachteBetriebsstatus\(\)/g) ?? []).toHaveLength(1);
    expect(app.match(/<MindestversionSperre\b/g) ?? []).toHaveLength(1);
    const schloss = app.indexOf('<AppSperrbildschirm');
    const sperre = app.indexOf('<MindestversionSperre');
    const decke = app.indexOf('<AppAbdeckung');
    expect(schloss).toBeGreaterThan(-1);
    expect(sperre).toBeGreaterThan(schloss);
    expect(decke).toBeGreaterThan(sperre);
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
