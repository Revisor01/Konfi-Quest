import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// Der Lebenszyklus der Sperre: Kaltstart, Wechsel in den Hintergrund, Rueckkehr.
// Der appStateChange-Listener wird hier von Hand ausgeloest, damit sich echte
// Zeiten pruefen lassen, ohne auf eine Uhr zu warten.

let zustandsWechsel: ((e: { isActive: boolean }) => void) | null = null;
const mockEntfernen = vi.fn();

// Die Sperre kann nur nativ greifen. Der Vorgabewert hier ist deshalb "nativ" —
// sonst pruefte die halbe Datei den Browserfall, in dem es gar nichts zu
// sperren gibt.
const mockIstNativ = vi.fn(() => true);

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIstNativ(), getPlatform: () => 'ios' }
}));

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
  const { gesperrt, startGeklaert, verdeckt, entsperren } = useAppSperre();
  return (
    <div>
      <span data-testid="zustand">{gesperrt ? 'gesperrt' : 'offen'}</span>
      <span data-testid="abdeckung">{verdeckt ? 'verdeckt' : 'sichtbar'}</span>
      <span data-testid="start">{startGeklaert ? 'geklaert' : 'offen'}</span>
      <button onClick={entsperren}>entsperren</button>
    </div>
  );
};

const zustand = () => screen.getByTestId('zustand').textContent;
const abdeckung = () => screen.getByTestId('abdeckung').textContent;
const start = () => screen.getByTestId('start').textContent;

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
  mockIstNativ.mockReturnValue(true);
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

// ---------------------------------------------------------------------------
// Simons Befund 15.09.2026 (echtes Geraet, Build 194): "Aber er flickert kurz,
// wenn die App aus dem ganz aus Zustand kommt. Vermutlich weil er sonst die
// Grafik zeigt."
//
// WAS DIESE TESTS PRUEFEN — und warum sie den ZWISCHENZUSTAND pruefen muessen:
// Die Einstellung wird beim Start asynchron gelesen (Biometrie-Bruecke, dann
// Preferences). Vorher stand `gesperrt` auf false, und false heisst fuer die
// Oberflaeche: Inhalt zeigen. Erst nach der Antwort sprang der Sperrbildschirm
// davor — das Aufblitzen. Ein Test, der nur das ENDERGEBNIS prueft, war schon
// vorher gruen und hat den Fehler nicht gesehen. Geprueft wird deshalb der
// Zustand VOR der Antwort des Plugins.
// ---------------------------------------------------------------------------
describe('Kaltstart: kein Aufblitzen, bevor die Sperre bekannt ist', () => {
  /**
   * Antworten, die erst auf Zuruf kommen. Damit laesst sich der Zustand
   * einfrieren, den es auf dem Geraet nur Millisekunden lang gibt.
   */
  const anHaltepunkt = () => {
    let freigeben!: (wert: boolean) => void;
    const versprechen = new Promise<boolean>((r) => { freigeben = r; });
    mockVerfuegbar.mockReturnValue(versprechen);
    return freigeben;
  };

  it('sagt VOR der Antwort des Plugins NICHT, dass nicht gesperrt ist', async () => {
    // DER KERN. `startGeklaert` ist das Signal an die Oberflaeche, ob sie
    // ueberhaupt schon etwas rendern darf. Solange es offen steht, zeigt
    // App.tsx den Ladebildschirm statt des Inhalts.
    const freigeben = anHaltepunkt();
    mockLesen.mockResolvedValue('sofort');

    render(<Pruefling />);

    // Das Plugin hat noch nicht geantwortet: Die Frage ist offen, und genau
    // deshalb darf `gesperrt === false` hier nicht als "zeig den Inhalt"
    // gelesen werden.
    expect(start()).toBe('offen');

    await act(async () => { freigeben(true); });
    await waitFor(() => expect(start()).toBe('geklaert'));
    expect(zustand()).toBe('gesperrt');
  });

  it('gibt erst frei, wenn feststeht, dass die Sperre gesperrt hat', async () => {
    // Die Reihenfolge ist die eigentliche Regel: Wenn `startGeklaert` faellt,
    // MUSS `gesperrt` schon stehen. Faellt es einen Tick zu frueh, rendert die
    // Oberflaeche genau einmal den Inhalt — das Aufblitzen.
    mockLesen.mockResolvedValue('15min');
    const gesehen: string[] = [];

    const Beobachter: React.FC = () => {
      const { gesperrt, startGeklaert } = useAppSperre();
      gesehen.push(`${startGeklaert ? 'geklaert' : 'offen'}/${gesperrt ? 'gesperrt' : 'offen'}`);
      return <span data-testid="start">{startGeklaert ? 'geklaert' : 'offen'}</span>;
    };

    render(<Beobachter />);
    await waitFor(() => expect(start()).toBe('geklaert'));

    // Kein einziges Bild darf "freigegeben, aber nicht gesperrt" gewesen sein.
    expect(gesehen).not.toContain('geklaert/offen');
    // Und am Ende steht beides.
    expect(gesehen[gesehen.length - 1]).toBe('geklaert/gesperrt');
  });

  it('haelt die App bei einem langsamen Plugin weiter zurueck', async () => {
    // Auf echter Hardware ist die Bruecke spuerbar langsamer als im
    // Simulator. Je laenger sie braucht, desto wichtiger ist, dass in dieser
    // Zeit nichts gerendert wird.
    const freigeben = anHaltepunkt();
    mockLesen.mockResolvedValue('5min');
    render(<Pruefling />);

    // Mehrere Ticks vergehen lassen — die Antwort bleibt aus.
    for (let i = 0; i < 5; i++) {
      await act(async () => { await Promise.resolve(); });
    }
    expect(start()).toBe('offen');

    await act(async () => { freigeben(true); });
    await waitFor(() => expect(zustand()).toBe('gesperrt'));
    expect(start()).toBe('geklaert');
  });

  it('gibt bei ausgeschalteter Sperre frei, ohne je zu sperren', async () => {
    // Der erlaubte Fall, und die andere Fehlerrichtung: Die Voreinstellung ist
    // 'aus'. Diese Mehrheit darf KEINE Abdeckung und KEINEN Sperrbildschirm
    // aufblitzen sehen — nur den Ladebildschirm, den der Start ohnehin zeigt,
    // und danach die App.
    mockLesen.mockResolvedValue('aus');
    const gesehen: string[] = [];

    const Beobachter: React.FC = () => {
      const { gesperrt, startGeklaert, verdeckt } = useAppSperre();
      gesehen.push(`${gesperrt ? 'gesperrt' : 'offen'}/${verdeckt ? 'verdeckt' : 'sichtbar'}`);
      return <span data-testid="start">{startGeklaert ? 'geklaert' : 'offen'}</span>;
    };

    render(<Beobachter />);
    await waitFor(() => expect(start()).toBe('geklaert'));

    // In KEINEM Bild stand je eine Sperre oder eine Abdeckung.
    expect(gesehen.every((b) => b === 'offen/sichtbar')).toBe(true);
  });

  it('gibt ohne Biometrie am Geraet frei, genau wie bei "aus"', async () => {
    mockVerfuegbar.mockResolvedValue(false);
    mockLesen.mockResolvedValue('sofort');
    render(<Pruefling />);

    await waitFor(() => expect(start()).toBe('geklaert'));
    expect(zustand()).toBe('offen');
    expect(abdeckung()).toBe('sichtbar');
  });

  it('gibt im Browser SOFORT frei, ohne einen einzigen Tick zu warten', async () => {
    // Ohne native Plattform kann die Sperre nie greifen. Dort auch nur einen
    // Tick zu warten waere eine Verzoegerung ohne jeden Gegenwert.
    mockIstNativ.mockReturnValue(false);
    mockVerfuegbar.mockResolvedValue(false);

    render(<Pruefling />);

    // Direkt nach dem ersten Rendern, ohne await dazwischen.
    expect(start()).toBe('geklaert');
  });

  it('gibt auch dann frei, wenn das Biometrie-Plugin wirft', async () => {
    // Ein streikendes Plugin darf die App nicht dauerhaft im Ladebildschirm
    // festhalten — das waere schlimmer als das Flackern, das hier behoben wird.
    // mockImplementation statt mockRejectedValue: Letzteres legt das
    // abgelehnte Versprechen schon beim Einrichten an, und bis der Hook es
    // abholt, meldet Node es als unbehandelt.
    mockVerfuegbar.mockImplementation(() =>
      Promise.reject(new Error('Plugin nicht verfuegbar'))
    );

    render(<Pruefling />);

    await waitFor(() => expect(start()).toBe('geklaert'));
    expect(zustand()).toBe('offen');
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

describe('Rueckkehr aus dem Hintergrund hat dieselbe Luecke NICHT', () => {
  it('sperrt im selben Bild wie die Rueckkehr, ohne Zwischenzustand', async () => {
    // Nachgeprueft, weil die Frage beim Kaltstart-Befund mitgestellt wurde:
    // Beim Zurueckkommen ist die Einstellung laengst geladen und liegt in
    // einem Ref. `mussSperren` ist eine reine Rechnung ohne await — `gesperrt`
    // kippt deshalb im selben Ereignis. Es gibt hier kein Bild dazwischen, in
    // dem die App schon vorne und noch nicht gesperrt waere.
    mockLesen.mockResolvedValue('sofort');
    const gesehen: string[] = [];

    const Beobachter: React.FC = () => {
      const { gesperrt, entsperren } = useAppSperre();
      gesehen.push(gesperrt ? 'gesperrt' : 'offen');
      return <button onClick={entsperren}>entsperren</button>;
    };

    render(<Beobachter />);
    await waitFor(() => expect(gesehen[gesehen.length - 1]).toBe('gesperrt'));
    await act(async () => { screen.getByText('entsperren').click(); });

    // Erst weg. Dieser Schritt rendert noch einmal (die Abdeckung kippt) und
    // gehoert NICHT zur gemessenen Strecke — gemessen wird ab der Rueckkehr.
    const los = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(los);
    await act(async () => { zustandsWechsel?.({ isActive: false }); });

    gesehen.length = 0;
    vi.spyOn(Date, 'now').mockReturnValue(los + 10_000);
    await act(async () => { zustandsWechsel?.({ isActive: true }); });
    vi.spyOn(Date, 'now').mockRestore();

    // Kein einziges Bild NACH der Rueckkehr zeigte die App offen: Der
    // Sperrbildschirm steht ab dem ersten Bild.
    expect(gesehen.length).toBeGreaterThan(0);
    expect(gesehen).not.toContain('offen');
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
