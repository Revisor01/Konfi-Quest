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
const mockOeffnen = vi.fn();

vi.mock('../../services/appSperre', async () => {
  const echt = await vi.importActual<typeof import('../../services/appSperre')>(
    '../../services/appSperre'
  );
  return {
    ...echt,
    sperreVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
    sperreLesen: (...a: unknown[]) => mockLesen(...(a as [])),
    sperreSpeichern: (...a: unknown[]) => mockSpeichern(...(a as [])),
    sperreOeffnen: (...a: unknown[]) => mockOeffnen(...(a as []))
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
  mockBiometrie.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID', sinnbild: 'gesicht' });
  mockOeffnen.mockResolvedValue('ok');
});

/** Oeffnet die Auswahl und tippt den Punkt mit diesem Text an. */
const waehlen = async (text: string) => {
  await screen.findByText('App sperren');
  await act(async () => { fireEvent.click(screen.getByText('App sperren')); });
  const optionen = mockAuswahl.mock.calls[mockAuswahl.mock.calls.length - 1][0] as {
    buttons: { text: string; handler?: () => void }[];
  };
  await act(async () => { optionen.buttons.find((b) => b.text === text)?.handler?.(); });
};

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

describe('Beim Einschalten wird die Biometrie einmal geprueft (Simon, 16.09.2026)', () => {
  it('klappt die Abfrage, ist die Sperre an', async () => {
    mockLesen.mockResolvedValue('aus');
    mockOeffnen.mockResolvedValue('ok');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Nach 5 Minuten');

    expect(mockOeffnen).toHaveBeenCalledTimes(1);
    expect(mockSpeichern).toHaveBeenCalledWith('5min');
    expect(await screen.findByText('Nach 5 Minuten im Hintergrund')).toBeInTheDocument();
  });

  it('DER VERBOTENE FALL: scheitert die Abfrage, bleibt die Sperre aus', async () => {
    mockLesen.mockResolvedValue('aus');
    mockOeffnen.mockResolvedValue('fehler');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Sofort');

    expect(mockOeffnen).toHaveBeenCalledTimes(1);
    // Nichts gespeichert, nichts gemeldet -- die Sperre steht weiter auf 'aus'.
    expect(mockSpeichern).not.toHaveBeenCalled();
    expect(screen.queryByText('Sofort im Hintergrund')).toBeNull();
  });

  it('bricht die Person die Abfrage ab, bleibt die Sperre ebenfalls aus', async () => {
    mockLesen.mockResolvedValue('aus');
    mockOeffnen.mockResolvedValue('abgebrochen');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Nach 1 Minute');

    expect(mockSpeichern).not.toHaveBeenCalled();
  });

  it('meldet den Fehlschlag sichtbar -- sonst haelt man die Sperre fuer an', async () => {
    mockLesen.mockResolvedValue('aus');
    mockOeffnen.mockResolvedValue('fehler');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Sofort');

    expect(await screen.findByText('Die Sperre bleibt aus – Face ID hat nicht geklappt.'))
      .toBeInTheDocument();
  });

  it('die laufende App erfaehrt von einer gescheiterten Einschaltung NICHTS', async () => {
    const gemeldet: string[] = [];
    const hoeren = () => { gemeldet.push('geaendert'); };
    window.addEventListener('app-sperre:geaendert', hoeren);

    mockLesen.mockResolvedValue('aus');
    mockOeffnen.mockResolvedValue('fehler');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Sofort');

    expect(gemeldet).toEqual([]);
    window.removeEventListener('app-sperre:geaendert', hoeren);
  });
});

describe('Ausschalten und Umstellen fragen NICHT erneut', () => {
  // Begruendung im Kopfkommentar von AppSperreSchalter.setzen: Wer abschalten
  // kann, sitzt schon in der entsperrten App. Eine Huerde davor schuetzt
  // niemanden und wuerde bei kaputter Biometrie die Sperre unloesbar machen.
  it('Ausschalten kommt ohne Abfrage aus', async () => {
    mockLesen.mockResolvedValue('15min');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Aus');

    expect(mockOeffnen).not.toHaveBeenCalled();
    expect(mockSpeichern).toHaveBeenCalledWith('aus');
  });

  it('der Wechsel der Wartezeit bei bereits aktiver Sperre fragt nicht erneut', async () => {
    mockLesen.mockResolvedValue('1min');
    render(<AppSperreSchalter variante="purple" />);
    await waehlen('Nach 15 Minuten');

    expect(mockOeffnen).not.toHaveBeenCalled();
    expect(mockSpeichern).toHaveBeenCalledWith('15min');
  });
});

describe('Der Schalter baut KEINE zweite Biometrie-Pruefung', () => {
  // Es gibt genau eine Ja/Nein-Abfrage im Repo: sperreOeffnen() in
  // services/appSperre.ts. Wer hier NativeBiometric direkt aufruft, hat eine
  // zweite gebaut -- mit eigener Fehlerbehandlung und eigenem Ausflug-Merker.
  const quelltext = readFileSync(
    resolve(__dirname, '../../..', 'src/components/shared/AppSperreSchalter.tsx'),
    'utf-8'
  );
  const ohneKommentare = quelltext
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:/])\/\/[^\n]*/g, '$1');

  it('ruft sperreOeffnen() auf und nicht NativeBiometric', () => {
    expect(ohneKommentare).toContain('sperreOeffnen');
    expect(ohneKommentare).not.toContain('NativeBiometric');
    expect(ohneKommentare).not.toContain('verifyIdentity');
  });

  it('GEGENPROBE zur Pruefmethode: der Kommentarfilter schluckt keinen Code', () => {
    // Waere die Entfernung zu gierig, verschwaende auch der echte Aufruf.
    expect(ohneKommentare).toContain('sperreSpeichern(neu)');
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
