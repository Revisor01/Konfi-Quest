import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// Der Lebenszyklus der Sperre: Kaltstart, Wechsel in den Hintergrund, Rueckkehr.
// Der appStateChange-Listener wird hier von Hand ausgeloest, damit sich echte
// Zeiten pruefen lassen, ohne auf eine Uhr zu warten.

let zustandsWechsel: ((e: { isActive: boolean }) => void) | null = null;
const mockEntfernen = vi.fn();

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_name: string, cb: (e: { isActive: boolean }) => void) => {
      zustandsWechsel = cb;
      return { remove: mockEntfernen };
    })
  }
}));

const mockVerfuegbar = vi.fn();
const mockLesen = vi.fn();
const mockLaeuftAusflug = vi.fn(() => false);

vi.mock('../../services/appSperre', async () => {
  // Die Rechenfunktionen bleiben ECHT — sonst pruefte dieser Test nur seine
  // eigenen Attrappen. Ersetzt werden nur die Zugriffe nach draussen.
  const echt = await vi.importActual<typeof import('../../services/appSperre')>(
    '../../services/appSperre'
  );
  return {
    ...echt,
    sperreVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
    sperreLesen: (...a: unknown[]) => mockLesen(...(a as [])),
    laeuftAusflug: () => mockLaeuftAusflug()
  };
});

import { useAppSperre } from '../../hooks/useAppSperre';

const Pruefling: React.FC = () => {
  const { gesperrt, verdeckt, entsperren } = useAppSperre();
  return (
    <div>
      <span data-testid="zustand">{gesperrt ? 'gesperrt' : 'offen'}</span>
      <span data-testid="abdeckung">{verdeckt ? 'verdeckt' : 'sichtbar'}</span>
      <button onClick={entsperren}>entsperren</button>
    </div>
  );
};

const zustand = () => screen.getByTestId('zustand').textContent;
const abdeckung = () => screen.getByTestId('abdeckung').textContent;

/** Nur wegwechseln, ohne zurueckzukommen — der Moment der Momentaufnahme. */
const wegwechseln = async () => {
  await act(async () => { zustandsWechsel?.({ isActive: false }); });
};

/** Wechsel in den Hintergrund und nach `msSpaeter` zurueck. */
const ausflugUeber = async (msSpaeter: number) => {
  const start = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(start);
  await act(async () => { zustandsWechsel?.({ isActive: false }); });
  vi.spyOn(Date, 'now').mockReturnValue(start + msSpaeter);
  await act(async () => { zustandsWechsel?.({ isActive: true }); });
  vi.spyOn(Date, 'now').mockRestore();
};

beforeEach(() => {
  vi.clearAllMocks();
  zustandsWechsel = null;
  mockVerfuegbar.mockResolvedValue(true);
  mockLesen.mockResolvedValue('aus');
  mockLaeuftAusflug.mockReturnValue(false);
});

describe('Kaltstart', () => {
  it('sperrt beim Start, wenn die Sperre eingeschaltet ist', async () => {
    mockLesen.mockResolvedValue('15min');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
  });

  it('sperrt beim Start auch bei "sofort"', async () => {
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
  });

  it('sperrt beim Start NICHT, wenn die Sperre aus ist', async () => {
    mockLesen.mockResolvedValue('aus');
    render(<Pruefling />);
    await waitFor(() => expect(mockLesen).toHaveBeenCalled());
    expect(zustand()).toBe('offen');
  });

  it('sperrt NICHT, wenn das Geraet keine Biometrie mehr hat — sonst steht man vor einer Tuer ohne Schluessel', async () => {
    mockVerfuegbar.mockResolvedValue(false);
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(mockVerfuegbar).toHaveBeenCalled());
    expect(zustand()).toBe('offen');
    // Die Einstellung wird dann gar nicht erst gelesen.
    expect(mockLesen).not.toHaveBeenCalled();
  });
});

describe('Hintergrundwechsel', () => {
  it('sperrt bei "aus" niemals, egal wie lange', async () => {
    mockLesen.mockResolvedValue('aus');
    render(<Pruefling />);
    await waitFor(() => expect(mockLesen).toHaveBeenCalled());

    await ausflugUeber(60 * 60 * 1000);
    expect(zustand()).toBe('offen');
  });

  it('"5 Minuten": nach 4:59 offen, nach 5:00 gesperrt', async () => {
    mockLesen.mockResolvedValue('5min');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    // Kaltstart-Sperre erst aufheben, damit der Hintergrundwechsel zaehlt.
    await act(async () => { screen.getByText('entsperren').click(); });
    expect(zustand()).toBe('offen');

    await ausflugUeber(5 * 60 * 1000 - 1000);
    expect(zustand()).toBe('offen');

    await ausflugUeber(5 * 60 * 1000);
    expect(zustand()).toBe('gesperrt');
  });

  it('ein kurzer Wechsel unterhalb der Karenz sperrt bei "sofort" NICHT', async () => {
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    // Teilen-Blatt geht auf und wieder zu: 800 ms.
    await ausflugUeber(800);
    expect(zustand()).toBe('offen');
  });

  it('ein echter Wechsel sperrt bei "sofort" sehr wohl', async () => {
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    await ausflugUeber(10_000);
    expect(zustand()).toBe('gesperrt');
  });

  it('waehrend eines angemeldeten Ausflugs sperrt auch eine lange Abwesenheit nicht', async () => {
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    // Fotoauswahl: die Person blaettert zwei Minuten in der Mediathek.
    mockLaeuftAusflug.mockReturnValue(true);
    await ausflugUeber(2 * 60 * 1000);
    expect(zustand()).toBe('offen');
  });

  it('ein verbrauchter Zeitstempel zaehlt nicht zweimal', async () => {
    mockLesen.mockResolvedValue('15min');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    // Lange weg -> sperrt.
    await ausflugUeber(20 * 60 * 1000);
    expect(zustand()).toBe('gesperrt');
    await act(async () => { screen.getByText('entsperren').click(); });
    expect(zustand()).toBe('offen');

    // Jetzt nur noch in den Vordergrund kommen, ohne vorher weg gewesen zu
    // sein: der alte Zeitstempel darf nicht erneut zuschlagen.
    await act(async () => { zustandsWechsel?.({ isActive: true }); });
    expect(zustand()).toBe('offen');
  });
});

// ---------------------------------------------------------------------------
// Simons Befund 15.09.2026 (echtes Geraet): "Wenn die App per Biometrie
// gesperrt ist, wird sie im App-Switcher trotzdem MIT INHALT angezeigt."
//
// WORAN DIESE TESTS HAENGEN — und warum das die Regel ist und nicht der
// Kommentar: iOS macht die Momentaufnahme fuer den Umschalter beim
// WEGWECHSELN. Alle Tests hier pruefen deshalb den Zustand NACH
// `isActive: false` und VOR jeder Rueckkehr. Eine Abdeckung, die erst beim
// Zurueckkommen erscheint, faellt hier durch — genau das war der Fehler.
// ---------------------------------------------------------------------------
describe('Abdeckung im App-Umschalter', () => {
  it('verdeckt SCHON BEIM WEGWECHSELN, nicht erst bei der Rueckkehr', async () => {
    mockLesen.mockResolvedValue('15min');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });
    expect(abdeckung()).toBe('sichtbar');

    // Der entscheidende Moment: nur weg, noch nicht zurueck.
    await wegwechseln();
    expect(abdeckung()).toBe('verdeckt');
  });

  it('verdeckt beim Wegwechseln auch dann, wenn die Wartezeit noch gar nicht abgelaufen waere', async () => {
    // 15 Minuten: Beim Wegwechseln steht noch nicht fest, ob die Rueckkehr
    // sperren wird. Verdeckt werden muss trotzdem sofort — sonst haengt der
    // Sichtschutz an einer Rechnung, die es zu diesem Zeitpunkt nicht gibt.
    mockLesen.mockResolvedValue('15min');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    await wegwechseln();
    expect(abdeckung()).toBe('verdeckt');
  });

  it('verdeckt auch waehrend eines angemeldeten Ausflugs', async () => {
    // Der Ausflug-Merker regelt, ob spaeter GESPERRT wird. Ob JETZT verdeckt
    // wird, ist eine andere Frage: Der Umschalter laesst sich auch aus der
    // Fotoauswahl heraus aufrufen.
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    mockLaeuftAusflug.mockReturnValue(true);
    await wegwechseln();
    expect(abdeckung()).toBe('verdeckt');
  });

  it('verdeckt NICHT, wenn die Sperre aus ist — der erlaubte Fall', async () => {
    // Voreinstellung 'aus': Wer die Sperre nicht nutzt, darf keinerlei
    // Verhaltensaenderung merken.
    mockLesen.mockResolvedValue('aus');
    render(<Pruefling />);
    await waitFor(() => expect(mockLesen).toHaveBeenCalled());

    await wegwechseln();
    expect(abdeckung()).toBe('sichtbar');
  });

  it('verdeckt NICHT, wenn das Geraet gar keine Biometrie hat', async () => {
    // Ohne Biometrie steht die Sperre intern auf 'aus' — dann gibt es auch
    // nichts zu verdecken.
    mockVerfuegbar.mockResolvedValue(false);
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(mockVerfuegbar).toHaveBeenCalled());

    await wegwechseln();
    expect(abdeckung()).toBe('sichtbar');
  });

  it('gibt die App beim Zurueckkommen wieder frei', async () => {
    mockLesen.mockResolvedValue('15min');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    // Kurz weg und zurueck: zu kurz zum Sperren, die Abdeckung muss fallen.
    await ausflugUeber(500);
    expect(zustand()).toBe('offen');
    expect(abdeckung()).toBe('sichtbar');
  });

  it('verschwindet nach erfolgreicher Entsperrung', async () => {
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    // Lange weg -> beim Zurueckkommen steht der Sperrbildschirm.
    await ausflugUeber(10_000);
    expect(zustand()).toBe('gesperrt');

    // Biometrie erfolgreich: Es darf nichts mehr vor der App stehen.
    await act(async () => { screen.getByText('entsperren').click(); });
    expect(zustand()).toBe('offen');
    expect(abdeckung()).toBe('sichtbar');
  });

  it('verdeckt beim erneuten Wegwechseln, waehrend die App gesperrt ist', async () => {
    // Gesperrt und nochmal in den Hintergrund: Ins Vorschaubild gehoert dann
    // die neutrale Flaeche, nicht der bedienbare Sperrbildschirm.
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);
    await waitFor(() => expect(zustand()).toBe('gesperrt'));

    await wegwechseln();
    expect(zustand()).toBe('gesperrt');
    expect(abdeckung()).toBe('verdeckt');
  });

  it('uebernimmt eine frisch eingeschaltete Sperre auch fuer die Abdeckung', async () => {
    mockLesen.mockResolvedValue('aus');
    render(<Pruefling />);
    await waitFor(() => expect(mockLesen).toHaveBeenCalled());
    await wegwechseln();
    expect(abdeckung()).toBe('sichtbar');
    await act(async () => { zustandsWechsel?.({ isActive: true }); });

    // Im Profil eingeschaltet:
    mockLesen.mockResolvedValue('5min');
    await act(async () => {
      window.dispatchEvent(new CustomEvent('app-sperre:geaendert'));
    });
    await waitFor(() => expect(mockLesen).toHaveBeenCalledTimes(2));

    await wegwechseln();
    expect(abdeckung()).toBe('verdeckt');
  });
});

describe('Aenderung der Einstellung im laufenden Betrieb', () => {
  it('uebernimmt eine frisch eingeschaltete Sperre sofort, ohne App-Neustart', async () => {
    mockLesen.mockResolvedValue('aus');
    render(<Pruefling />);
    await waitFor(() => expect(mockLesen).toHaveBeenCalled());

    await ausflugUeber(60 * 60 * 1000);
    expect(zustand()).toBe('offen');

    // Im Profil eingeschaltet:
    mockLesen.mockResolvedValue('sofort');
    await act(async () => {
      window.dispatchEvent(new CustomEvent('app-sperre:geaendert'));
    });
    await waitFor(() => expect(mockLesen).toHaveBeenCalledTimes(2));

    await ausflugUeber(10_000);
    expect(zustand()).toBe('gesperrt');
  });
});
