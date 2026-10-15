import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// NIEMAND DARF SICH AUSSPERREN — das ist die wichtigste Eigenschaft des
// Sperrbildschirms, und darauf zielt der groesste Teil dieser Tests: Nach einem
// Fehlversuch muss der Bildschirm stehen bleiben UND der Weg hinaus offen sein.

const mockOeffnen = vi.fn();
const mockVerfuegbar = vi.fn();

vi.mock('../../services/appSperre', () => ({
  sperreOeffnen: (...a: unknown[]) => mockOeffnen(...(a as []))
}));
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as []))
}));

import AppSperrbildschirm from '../../components/common/AppSperrbildschirm';

/** Alle Werte, die das Stylesheet einem Token gibt (hell, dunkel, je Plattform). */
const definitionen = (css: string, token: string): string[] =>
  [...css.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());

/** Ein Wert aus dem Stylesheet als Hexfarben -- var() ueber alle Definitionen aufgeloest. */
const hexWerte = (css: string, wert: string): string[] => {
  const variable = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(wert);
  if (variable) {
    const werte = definitionen(css, variable[1]);
    return (werte.length > 0 ? werte : [variable[2] ?? '']).flatMap((w) => hexWerte(css, w.trim()));
  }
  // Was keine sechsstellige Hexfarbe ist, laesst sich nicht nachrechnen -- und faellt auf.
  return [/^#[0-9a-fA-F]{6}$/.test(wert) ? wert : `nicht berechenbar: ${wert}`];
};

const kanal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const helligkeit = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => kanal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Kontrastverhaeltnis nach WCAG 2.x. */
const kontrast = (a: string, b: string) => {
  const [hell, dunkel] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockVerfuegbar.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID', sinnbild: 'gesicht' });
  mockOeffnen.mockResolvedValue('ok');
});

describe('Der Sperrbildschirm', () => {
  it('sagt klar, dass die App gesperrt ist', async () => {
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    expect(await screen.findByText('Konfi Quest ist gesperrt')).toBeInTheDocument();
  });

  it('benennt die Biometrie des Geraets im Knopf', async () => {
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Mit Face ID entsperren/)).toBeInTheDocument());
  });

  it('nennt den Fingerabdruck, wenn das Geraet einen Fingerabdruck hat', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'fingerabdruck', bezeichnung: 'Fingerabdruck', sinnbild: 'finger' });
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Mit Fingerabdruck entsperren/)).toBeInTheDocument());
  });

  it('spannt die verdeckende Flaeche auf', async () => {
    mockOeffnen.mockResolvedValue('abgebrochen');
    const { container } = render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    await screen.findByText('Konfi Quest ist gesperrt');

    const flaeche = container.querySelector('.app-sperrbildschirm') as HTMLElement;
    expect(flaeche).not.toBeNull();
    // Als Dialog ausgezeichnet: Vorlesehilfen sollen ansagen, dass hier alles
    // andere weg ist, und nicht in den verdeckten Inhalten weiterlesen.
    expect(flaeche.getAttribute('role')).toBe('dialog');
    expect(flaeche.getAttribute('aria-modal')).toBe('true');
  });

  it('verdeckt deckend — ohne Transparenz und ohne Unschaerfe', () => {
    // Das Aussehen liegt in theme/variables.css (Design-Tokens, kein Inline-
    // Stil). Geprueft wird deshalb die Regel selbst: Unschaerfe liesse Fotos
    // und Namen weiterhin erahnen, Transparenz erst recht.
    const css = readFileSync(
      resolve(__dirname, '../../..', 'src/theme/variables.css'),
      'utf-8'
    );
    const block = css.slice(css.indexOf('.app-sperrbildschirm {'));
    const regeln = block.slice(0, block.indexOf('}'));

    expect(regeln).toContain('position: fixed');
    expect(regeln).toContain('inset: 0');
    expect(regeln).toContain('background: var(--ion-background-color');
    expect(regeln).not.toContain('backdrop-filter');
    expect(regeln).not.toContain('opacity');
    expect(regeln).not.toContain('rgba');

    // Ueber allem, was Ionic selbst aufbaut (Modals 20000, Toasts 60000) —
    // ein offenes Modal darf den Sperrbildschirm nicht ueberlagern.
    const zIndex = Number(regeln.match(/z-index:\s*(\d+)/)?.[1]);
    expect(zIndex).toBeGreaterThan(60000);
  });

  it('verraet nichts ueber die angemeldete Person', async () => {
    // Diesen Bildschirm sieht, wer das Geraet in die Hand bekommt. Er darf
    // nur sagen, dass es Konfi Quest ist — kein Name, keine Rolle, keine
    // Gemeinde. Geprueft wird der gesamte sichtbare Text.
    mockOeffnen.mockResolvedValue('fehler');
    const { container } = render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    await screen.findByText(/nicht geklappt/);

    // "Konfi Quest" als App-Name ist erlaubt und soll auch dastehen — der
    // Rest des Textes darf die Rolle "Konfi" dagegen nicht nennen.
    expect(container.textContent).toContain('Konfi Quest ist gesperrt');
    const text = (container.textContent ?? '').toLowerCase().split('konfi quest').join(' ');
    for (const wort of ['konfi', 'teamer', 'admin', 'leitung', 'gemeinde', 'jahrgang', 'angemeldet als']) {
      expect(text).not.toContain(wort);
    }
  });
});

describe('Entsperren', () => {
  it('fragt beim Erscheinen von selbst', async () => {
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    await waitFor(() => expect(mockOeffnen).toHaveBeenCalledTimes(1));
  });

  it('gibt die App nach erfolgreicher Biometrie frei', async () => {
    const entsperrt = vi.fn();
    mockOeffnen.mockResolvedValue('ok');
    render(<AppSperrbildschirm onEntsperrt={entsperrt} onAbmelden={vi.fn()} />);
    await waitFor(() => expect(entsperrt).toHaveBeenCalledTimes(1));
  });

  it('gibt die App bei Abbruch NICHT frei und laesst den Bildschirm stehen', async () => {
    const entsperrt = vi.fn();
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={entsperrt} onAbmelden={vi.fn()} />);

    await waitFor(() => expect(mockOeffnen).toHaveBeenCalled());
    expect(entsperrt).not.toHaveBeenCalled();
    expect(screen.getByText('Konfi Quest ist gesperrt')).toBeInTheDocument();
    expect(await screen.findByText(/Nicht erkannt/)).toBeInTheDocument();
  });

  it('gibt die App bei einem Fehler NICHT frei', async () => {
    const entsperrt = vi.fn();
    mockOeffnen.mockResolvedValue('fehler');
    render(<AppSperrbildschirm onEntsperrt={entsperrt} onAbmelden={vi.fn()} />);

    await waitFor(() => expect(mockOeffnen).toHaveBeenCalled());
    expect(entsperrt).not.toHaveBeenCalled();
    expect(await screen.findByText(/nicht geklappt/)).toBeInTheDocument();
  });

  it('laesst nach einem Fehlversuch einen zweiten zu — und der oeffnet', async () => {
    const entsperrt = vi.fn();
    mockOeffnen.mockResolvedValueOnce('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={entsperrt} onAbmelden={vi.fn()} />);

    await waitFor(() => expect(mockOeffnen).toHaveBeenCalledTimes(1));
    expect(entsperrt).not.toHaveBeenCalled();

    mockOeffnen.mockResolvedValue('ok');
    const knopf = screen.getByText(/Mit Face ID entsperren/);
    await act(async () => { fireEvent.click(knopf); });

    await waitFor(() => expect(entsperrt).toHaveBeenCalledTimes(1));
    expect(mockOeffnen).toHaveBeenCalledTimes(2);
  });

  it('versucht es nach einem Fehlversuch NICHT von selbst noch einmal', async () => {
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);

    await waitFor(() => expect(mockOeffnen).toHaveBeenCalledTimes(1));
    // Eine Schleife aus automatischen Versuchen waere genau das, worin
    // Nutzer:innen sonst haengen bleiben.
    await new Promise((f) => setTimeout(f, 50));
    expect(mockOeffnen).toHaveBeenCalledTimes(1);
  });
});

describe('Der Rueckweg — niemand darf sich aussperren', () => {
  it('zeigt "Abmelden" immer an', async () => {
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    expect(await screen.findByText('Abmelden')).toBeInTheDocument();
  });

  it('meldet auf Antippen ab — auch nach einem gescheiterten Versuch', async () => {
    const abmelden = vi.fn();
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={abmelden} />);

    await waitFor(() => expect(mockOeffnen).toHaveBeenCalled());
    await act(async () => { fireEvent.click(screen.getByText('Abmelden')); });
    expect(abmelden).toHaveBeenCalledTimes(1);
  });

  it('laesst "Abmelden" waehrend der laufenden Abfrage bedienbar', async () => {
    // Der Entsperren-Knopf ist waehrend der Abfrage gesperrt — der Rueckweg
    // ausdruecklich NICHT. Wer hier festhaengt, soll nicht warten muessen,
    // bis ein Spinner fertig ist.
    const abmelden = vi.fn();
    let freigeben: (w: string) => void = () => {};
    mockOeffnen.mockImplementation(() => new Promise((f) => { freigeben = f; }));

    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={abmelden} />);
    await waitFor(() => expect(mockOeffnen).toHaveBeenCalledTimes(1));

    const knopf = screen.getByText('Abmelden').closest('ion-button') as HTMLElement;
    expect(knopf.hasAttribute('disabled')).toBe(false);
    await act(async () => { fireEvent.click(screen.getByText('Abmelden')); });
    expect(abmelden).toHaveBeenCalledTimes(1);

    await act(async () => { freigeben('abgebrochen'); });
  });

  it('ist auf dem Verlauf zu sehen: die Schrift hebt sich von jeder Farbstufe mindestens 3:1 ab', async () => {
    // Der Rueckweg darf gestalterisch zweite Wahl sein, aber nie so weit
    // zuruecktreten, dass man ihn in einer Notlage nicht findet. Ionics Grau
    // (color="medium") laege auf dem Aurora-Verlauf bei 1,07 bis 1,67:1.
    // Geprueft wird die Schriftfarbe aus dem Stylesheet gegen die Farbstufen
    // des Verlaufs, die auf der Flaeche liegen (bis 100 %) -- welche Farbe es
    // ist, legt der Test nicht fest. 3:1 ist die Grenze fuer Bedienelemente
    // (WCAG 1.4.11); die 4,5:1 fuer Text erreicht auch Weiss nicht an jeder
    // Stelle (3,23:1 auf #5b8def, siehe "Kontrast im Hellmodus" in
    // docs/offene-befunde.md).
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />);
    const knopf = (await screen.findByText('Abmelden')).closest('ion-button') as HTMLElement;
    // Eine Ionic-Farbe am Knopf (color="...") ueberstimmt die Schriftfarbe
    // des Stylesheets -- dann gaelte die Rechnung unten nicht mehr.
    expect(knopf.getAttribute('color')).toBeNull();

    const css = readFileSync(resolve(__dirname, '../../..', 'src/theme/variables.css'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const regel = /\.app-sperrbildschirm__abmelden\s*\{([^}]*)\}/.exec(css)![1];
    const schrift = /(?:^|[;\s])--color:\s*([^;]+);/.exec(regel)![1].trim();
    const schriftFarben = hexWerte(css, schrift);
    const stufen = definitionen(css, '--app-gradient-aurora').flatMap((verlauf) =>
      [...verlauf.matchAll(/(#[0-9a-fA-F]{6})\s+(-?\d+(?:\.\d+)?)%/g)]
        .filter(([, , lage]) => Number(lage) <= 100)
        .map(([, hex]) => hex));
    expect(schriftFarben.length).toBeGreaterThan(0);
    expect(schriftFarben.filter((f) => !/^#[0-9a-fA-F]{6}$/.test(f))).toEqual([]);
    expect(stufen.length).toBeGreaterThan(1);

    const zuSchwach = schriftFarben.flatMap((farbe) => stufen
      .map((stufe) => ({ farbe, stufe, verhaeltnis: Math.round(kontrast(farbe, stufe) * 100) / 100 }))
      .filter(({ verhaeltnis }) => verhaeltnis < 3));
    expect(zuSchwach).toEqual([]);
  });

  it('bleibt bedienbar, wenn die Biometrie dauerhaft scheitert', async () => {
    const abmelden = vi.fn();
    mockOeffnen.mockResolvedValue('fehler');
    render(<AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={abmelden} />);

    // Dreimal scheitern lassen — der Weg hinaus muss danach noch da sein.
    await waitFor(() => expect(mockOeffnen).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 2; i++) {
      // Nach jedem Versuch steht der Knopf wieder mit seiner Beschriftung da
      // (waehrend der Abfrage zeigt er einen Spinner). Genau das belegt, dass
      // die Oberflaeche nicht in einem Ladezustand haengen bleibt.
      const knopf = await screen.findByText(/Mit Face ID entsperren/);
      await act(async () => { fireEvent.click(knopf); });
    }
    expect(mockOeffnen).toHaveBeenCalledTimes(3);
    expect(await screen.findByText(/Mit Face ID entsperren/)).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText('Abmelden')); });
    expect(abmelden).toHaveBeenCalledTimes(1);
  });
});
