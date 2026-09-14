import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Der Schalter darf NUR erscheinen, wo die Sperre auch etwas bewirkt: nativ und
// mit eingerichteter Biometrie. Ein Schalter, der ins Leere fuehrt, ist
// schlimmer als gar keiner.

const mockVerfuegbar = vi.fn();
const mockLesen = vi.fn();
const mockSpeichern = vi.fn(async () => undefined);
const mockBiometrie = vi.fn();

vi.mock('../../services/appSperre', async () => {
  const echt = await vi.importActual<typeof import('../../services/appSperre')>(
    '../../services/appSperre'
  );
  return {
    ...echt,
    sperreVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
    sperreLesen: (...a: unknown[]) => mockLesen(...(a as [])),
    sperreSpeichern: (...a: unknown[]) => mockSpeichern(...(a as []))
  };
});
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: (...a: unknown[]) => mockBiometrie(...(a as []))
}));

const mockAuswahl = vi.fn();
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  return { ...echt, useIonActionSheet: () => [mockAuswahl, vi.fn()] };
});

import AppSperreSchalter from '../../components/shared/AppSperreSchalter';

beforeEach(() => {
  vi.clearAllMocks();
  mockVerfuegbar.mockResolvedValue(true);
  mockLesen.mockResolvedValue('aus');
  mockBiometrie.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID' });
});

describe('Sichtbarkeit', () => {
  it('erscheint, wenn das Geraet Biometrie eingerichtet hat', async () => {
    render(<AppSperreSchalter variante="purple" />);
    expect(await screen.findByText('App sperren')).toBeInTheDocument();
  });

  it('erscheint GAR NICHT ohne verfuegbare Biometrie', async () => {
    mockVerfuegbar.mockResolvedValue(false);
    const { container } = render(<AppSperreSchalter variante="teamer" />);

    await waitFor(() => expect(mockVerfuegbar).toHaveBeenCalled());
    expect(screen.queryByText('App sperren')).toBeNull();
    expect(container.querySelector('.app-list-item')).toBeNull();
  });

  it('uebernimmt die Farbvariante der jeweiligen Rolle', async () => {
    const { container } = render(<AppSperreSchalter variante="teamer" />);
    await screen.findByText('App sperren');
    expect(container.querySelector('.app-list-item--teamer')).not.toBeNull();
  });
});

describe('Voreinstellung und Anzeige', () => {
  it('steht ohne gespeicherte Einstellung auf AUS', async () => {
    mockLesen.mockResolvedValue('aus');
    render(<AppSperreSchalter variante="purple" />);
    // "Aus" zeigt sich als Einladung, nicht als Wartezeit.
    expect(await screen.findByText(/Die App nach einer Pause mit Face ID schützen/))
      .toBeInTheDocument();
  });

  it('zeigt die eingestellte Wartezeit', async () => {
    mockLesen.mockResolvedValue('5min');
    render(<AppSperreSchalter variante="users" />);
    expect(await screen.findByText('Nach 5 Minuten im Hintergrund')).toBeInTheDocument();
  });

  it('zeigt "Sofort", wenn sofort eingestellt ist', async () => {
    mockLesen.mockResolvedValue('sofort');
    render(<AppSperreSchalter variante="users" />);
    expect(await screen.findByText('Sofort im Hintergrund')).toBeInTheDocument();
  });
});

describe('Umstellen', () => {
  it('bietet genau die vier Wartezeiten plus "Aus" und "Abbrechen" an', async () => {
    render(<AppSperreSchalter variante="purple" />);
    await screen.findByText('App sperren');
    await act(async () => { fireEvent.click(screen.getByText('App sperren')); });

    const optionen = mockAuswahl.mock.calls[0][0] as {
      buttons: { text: string; role?: string }[];
    };
    expect(optionen.buttons.map((b) => b.text)).toEqual([
      'Sofort', 'Nach 1 Minute', 'Nach 5 Minuten', 'Nach 15 Minuten', 'Aus', 'Abbrechen'
    ]);
  });

  it('speichert die gewaehlte Wartezeit und meldet die Aenderung an die laufende App', async () => {
    const gemeldet: string[] = [];
    const hoeren = () => { gemeldet.push('geaendert'); };
    window.addEventListener('app-sperre:geaendert', hoeren);

    render(<AppSperreSchalter variante="purple" />);
    await screen.findByText('App sperren');
    await act(async () => { fireEvent.click(screen.getByText('App sperren')); });

    const optionen = mockAuswahl.mock.calls[0][0] as {
      buttons: { text: string; handler?: () => void }[];
    };
    const fuenfMinuten = optionen.buttons.find((b) => b.text === 'Nach 5 Minuten');
    await act(async () => { fuenfMinuten?.handler?.(); });

    expect(mockSpeichern).toHaveBeenCalledWith('5min');
    // Ohne dieses Ereignis griffe die Sperre erst beim naechsten App-Start.
    expect(gemeldet).toEqual(['geaendert']);
    window.removeEventListener('app-sperre:geaendert', hoeren);
  });

  it('schaltet ueber "Aus" wieder ab', async () => {
    mockLesen.mockResolvedValue('15min');
    render(<AppSperreSchalter variante="purple" />);
    await screen.findByText('App sperren');
    await act(async () => { fireEvent.click(screen.getByText('App sperren')); });

    const optionen = mockAuswahl.mock.calls[0][0] as {
      buttons: { text: string; handler?: () => void }[];
    };
    await act(async () => { optionen.buttons.find((b) => b.text === 'Aus')?.handler?.(); });
    expect(mockSpeichern).toHaveBeenCalledWith('aus');
  });
});

describe('In allen drei Profil-Ansichten eingebunden', () => {
  // Die App hat drei getrennte Komponentenbaeume. Die uebliche Falle ist, eine
  // Aenderung nur in einem davon zu machen — dieser Test haelt alle drei fest.
  const seiten: { rolle: string; datei: string }[] = [
    { rolle: 'Leitung', datei: 'src/components/admin/pages/AdminProfilePage.tsx' },
    { rolle: 'Teamer:innen', datei: 'src/components/teamer/pages/TeamerProfilePage.tsx' },
    { rolle: 'Konfis', datei: 'src/components/konfi/views/ProfileView.tsx' }
  ];

  for (const { rolle, datei } of seiten) {
    it(`${rolle}: bindet den Schalter ein`, () => {
      const inhalt = readFileSync(resolve(__dirname, '../../..', datei), 'utf-8');
      expect(inhalt).toContain("import AppSperreSchalter from");
      expect(inhalt).toMatch(/<AppSperreSchalter\s+variante="(users|teamer|purple)"\s*\/>/);
    });
  }
});
