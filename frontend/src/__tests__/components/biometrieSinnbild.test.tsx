import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { fingerPrintOutline, scanOutline, lockClosedOutline } from 'ionicons/icons';

// ---------------------------------------------------------------------------
// SYMBOL UND BESCHRIFTUNG MUESSEN ZUSAMMENPASSEN.
//
// Gefunden auf Simons Geraet (15.09.2026): Ein Geraet mit Face ID zeigte ein
// FINGERABDRUCK-Symbol. Die Bezeichnung war laengst richtig ("Mit Face ID
// entsperren"), nur das Symbol hing an drei Stellen fest verdrahtet daneben.
//
// Diese Tests pruefen beides gemeinsam — Symbol UND Text — an allen drei
// Oberflaechen, an denen das Verfahren benannt wird. Ein Test nur auf den Text
// haette den Fehler nicht gesehen: der Text stimmte ja.
//
// Der wichtigste Fall ist der letzte: Ohne verlaessliche Auskunft darf NICHT
// stillschweigend der Finger stehen. Genau das war der gemeldete Fehler.
// ---------------------------------------------------------------------------

const mockVerfuegbar = vi.fn();
const mockIstAktiv = vi.fn();
const mockOeffnen = vi.fn();

vi.mock('../../services/biometrics', async () => {
  const echt = await vi.importActual<typeof import('../../services/biometrics')>(
    '../../services/biometrics'
  );
  return {
    ...echt,
    biometrieVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
    istBiometrieAktiv: (...a: unknown[]) => mockIstAktiv(...(a as [])),
    biometrieAktivieren: vi.fn(async () => true),
    biometrieVergessen: vi.fn(async () => undefined),
  };
});
vi.mock('../../services/appSperre', () => ({
  sperreOeffnen: (...a: unknown[]) => mockOeffnen(...(a as [])),
}));

import BiometrieSchalter from '../../components/shared/BiometrieSchalter';
import AppSperrbildschirm from '../../components/common/AppSperrbildschirm';
import { biometrieIcon } from '../../components/shared/biometrieSymbol';

/** Das Icon, das eine Ionic-Komponente tatsaechlich bekommen hat. */
const iconVon = (element: Element | null): string | null =>
  (element as (Element & { icon?: string }) | null)?.icon
  ?? element?.getAttribute('icon')
  ?? null;

beforeEach(() => {
  vi.clearAllMocks();
  mockIstAktiv.mockResolvedValue(false);
  // Der Sperrbildschirm fragt beim Erscheinen von selbst; "abgebrochen" laesst
  // ihn stehen, damit der Knopf mit Symbol und Text ueberhaupt sichtbar ist.
  mockOeffnen.mockResolvedValue('abgebrochen');
});

describe('biometrieIcon — die eine Quelle fuer das Symbol', () => {
  it('gibt fuer ein Gesicht das Gesichts-Symbol', () => {
    expect(biometrieIcon('gesicht')).toBe(scanOutline);
  });

  it('gibt fuer einen Finger das Fingerabdruck-Symbol', () => {
    expect(biometrieIcon('finger')).toBe(fingerPrintOutline);
  });

  it('gibt ohne erkanntes Verfahren das neutrale Schloss', () => {
    expect(biometrieIcon('schloss')).toBe(lockClosedOutline);
    // Auch wenn gar nichts uebergeben wird: niemals stillschweigend der Finger.
    expect(biometrieIcon(undefined)).toBe(lockClosedOutline);
    expect(biometrieIcon(undefined)).not.toBe(fingerPrintOutline);
  });
});

describe('Der Schalter in den Konto-Einstellungen', () => {
  it('zeigt bei Face ID ein Gesichts-Symbol und "Face ID"', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID', sinnbild: 'gesicht',
    });
    const { container } = render(<BiometrieSchalter variante="purple" />);

    expect(await screen.findByText('Anmelden mit Face ID')).toBeInTheDocument();
    const icon = container.querySelector('.app-icon-circle ion-icon');
    expect(iconVon(icon)).toBe(scanOutline);
    // Genau der gemeldete Fehler: Face ID, aber Fingerabdruck-Symbol.
    expect(iconVon(icon)).not.toBe(fingerPrintOutline);
  });

  it('zeigt bei Touch ID ein Finger-Symbol und "Touch ID"', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'touchId', bezeichnung: 'Touch ID', sinnbild: 'finger',
    });
    const { container } = render(<BiometrieSchalter variante="users" />);

    expect(await screen.findByText('Anmelden mit Touch ID')).toBeInTheDocument();
    expect(iconVon(container.querySelector('.app-icon-circle ion-icon'))).toBe(fingerPrintOutline);
  });

  it('zeigt beim Fingerabdruck ein Finger-Symbol und "Fingerabdruck"', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'fingerabdruck', bezeichnung: 'Fingerabdruck', sinnbild: 'finger',
    });
    const { container } = render(<BiometrieSchalter variante="teamer" />);

    expect(await screen.findByText('Anmelden mit Fingerabdruck')).toBeInTheDocument();
    expect(iconVon(container.querySelector('.app-icon-circle ion-icon'))).toBe(fingerPrintOutline);
  });

  it('zeigt bei Android-Gesichtserkennung ein Gesichts-Symbol und den deutschen Text', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true,
      art: 'gesichtserkennung',
      bezeichnung: 'Gesichtserkennung',
      sinnbild: 'gesicht',
    });
    const { container } = render(<BiometrieSchalter variante="purple" />);

    expect(await screen.findByText('Anmelden mit Gesichtserkennung')).toBeInTheDocument();
    expect(iconVon(container.querySelector('.app-icon-circle ion-icon'))).toBe(scanOutline);
  });

  it('faellt bei unbekanntem Verfahren auf das Schloss zurueck — NICHT auf den Finger', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'biometrie', bezeichnung: 'Biometrie', sinnbild: 'schloss',
    });
    const { container } = render(<BiometrieSchalter variante="purple" />);

    expect(await screen.findByText('Anmelden mit Biometrie')).toBeInTheDocument();
    const icon = container.querySelector('.app-icon-circle ion-icon');
    expect(iconVon(icon)).toBe(lockClosedOutline);
    expect(iconVon(icon)).not.toBe(fingerPrintOutline);
    expect(iconVon(icon)).not.toBe(scanOutline);
  });
});

describe('Der Sperrbildschirm', () => {
  const knopfIcon = (container: HTMLElement) =>
    iconVon(container.querySelector('.app-sperrbildschirm__knopf ion-icon'));

  it('zeigt bei Face ID ein Gesichts-Symbol und "Mit Face ID entsperren"', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID', sinnbild: 'gesicht',
    });
    const { container } = render(
      <AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByText(/Mit Face ID entsperren/)).toBeInTheDocument());
    expect(knopfIcon(container)).toBe(scanOutline);
    expect(knopfIcon(container)).not.toBe(fingerPrintOutline);
  });

  it('zeigt beim Fingerabdruck ein Finger-Symbol und "Mit Fingerabdruck entsperren"', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'fingerabdruck', bezeichnung: 'Fingerabdruck', sinnbild: 'finger',
    });
    const { container } = render(
      <AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />
    );

    await waitFor(() =>
      expect(screen.getByText(/Mit Fingerabdruck entsperren/)).toBeInTheDocument()
    );
    expect(knopfIcon(container)).toBe(fingerPrintOutline);
  });

  it('bleibt bei unbekanntem Verfahren neutral — Schloss und "Biometrie"', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true, art: 'biometrie', bezeichnung: 'Biometrie', sinnbild: 'schloss',
    });
    const { container } = render(
      <AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByText(/Mit Biometrie entsperren/)).toBeInTheDocument());
    expect(knopfIcon(container)).toBe(lockClosedOutline);
    expect(knopfIcon(container)).not.toBe(fingerPrintOutline);
  });

  it('raet auch VOR der Antwort des Geraets nichts', async () => {
    // Solange die Abfrage laeuft, stand hier frueher fest "Face ID" — auf einem
    // Fingerabdruck-Geraet also kurz die falsche Ansage.
    let antworten: (w: unknown) => void = () => {};
    mockVerfuegbar.mockImplementation(() => new Promise((f) => { antworten = f; }));

    const { container } = render(
      <AppSperrbildschirm onEntsperrt={vi.fn()} onAbmelden={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByText(/entsperren/)).toBeInTheDocument());
    expect(screen.queryByText(/Mit Face ID entsperren/)).toBeNull();
    expect(screen.getByText(/Mit Biometrie entsperren/)).toBeInTheDocument();
    expect(knopfIcon(container)).toBe(lockClosedOutline);

    await waitFor(async () => {
      antworten({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID', sinnbild: 'gesicht' });
    });
    await waitFor(() => expect(screen.getByText(/Mit Face ID entsperren/)).toBeInTheDocument());
  });
});
