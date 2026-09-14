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
  mockVerfuegbar.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID' });
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
      verfuegbar: true, art: 'fingerabdruck', bezeichnung: 'Fingerabdruck'
    });
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
