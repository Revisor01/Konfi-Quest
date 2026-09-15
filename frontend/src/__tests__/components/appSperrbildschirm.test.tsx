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

  it('legt den Verlauf deckend ueber die ganze Flaeche', () => {
    // Der Aurora-Verlauf liegt auf ::before, damit die Grundfarbe der
    // Hauptregel deckend bleibt. Dann muss aber auch dieses ::before die
    // ganze Flaeche fuellen und selbst undurchsichtig sein — sonst waere
    // der Verlauf nur Zierde ueber durchscheinendem Inhalt.
    const css = readFileSync(
      resolve(__dirname, '../../..', 'src/theme/variables.css'),
      'utf-8'
    );
    const block = css.slice(css.indexOf('.app-sperrbildschirm::before {'));
    const regeln = block.slice(0, block.indexOf('}'));

    expect(regeln).toContain('inset: 0');
    expect(regeln).toContain('var(--app-gradient-aurora)');
    expect(regeln).not.toContain('backdrop-filter');
    // Eine Deckkraft auf der Verlaufsflaeche selbst wuerde alles darunter
    // durchscheinen lassen (das Wasserzeichen darf sie haben, diese nicht).
    expect(regeln).not.toMatch(/(^|[\s;{])opacity\s*:/);
  });

  it('haelt den sicheren Bereich frei', () => {
    // Notch und Home-Indicator: der Inhalt darf nicht darunter liegen.
    const css = readFileSync(
      resolve(__dirname, '../../..', 'src/theme/variables.css'),
      'utf-8'
    );
    const block = css.slice(css.indexOf('.app-sperrbildschirm {'));
    const regeln = block.slice(0, block.indexOf('}'));

    expect(regeln).toContain('env(safe-area-inset-top');
    expect(regeln).toContain('env(safe-area-inset-bottom');
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

  it('gestaltet den Rueckweg als vollen Knopf, nicht als blassen Link', () => {
    // Auf dem Verlauf muesste ein "clear"-Knopf in Grau untergehen. Der
    // Rueckweg darf gestalterisch zweite Wahl sein, aber nie so weit
    // zuruecktreten, dass man ihn in einer Notlage nicht findet.
    const quelle = readFileSync(
      resolve(__dirname, '../../..', 'src/components/common/AppSperrbildschirm.tsx'),
      'utf-8'
    );
    expect(quelle).toContain('app-sperrbildschirm__abmelden');
    expect(quelle).not.toContain('color="medium"');
    expect(quelle).not.toContain('fill="clear"');

    const css = readFileSync(
      resolve(__dirname, '../../..', 'src/theme/variables.css'),
      'utf-8'
    );
    const block = css.slice(css.indexOf('.app-sperrbildschirm__abmelden {'));
    const regeln = block.slice(0, block.indexOf('}'));
    // Weisse Schrift in voller Deckkraft plus eigener Rahmen.
    expect(regeln).toContain('--color: var(--app-weiss)');
    expect(regeln).toContain('--border-width: 1px');
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
