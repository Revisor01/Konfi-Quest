import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Maltes Befund 23.09.2026 (Android, App 2.3.0/118):
// "Der erste Login der automatisch das Android Fingerabdruck hoch holt hat aber
// in 2 von 2 Versuchen fehlgeschlagen (Tippe nochmal um es erneut zu versuchen
// oder so), wenn ich nach dem Fehlschlag haendisch jeweils dann mit Biometrie
// entsperren gedrueckt habe und dann das Androidding hoch kam und ich es
// gemacht habe ging's durch."
//
// ES GEHT UM DIE APP-SPERRE, nicht um die Anmeldung: Der Wortlaut "Tippe
// nochmal um es erneut zu versuchen" und die Schaltflaeche "mit Biometrie
// entsperren" stehen ausschliesslich im Sperrbildschirm (AppSperrbildschirm).
// Der automatische Versuch auf der Anmeldeseite (LoginView) bleibt bei einem
// Abbruch kommentarlos und hat keinen solchen Knopf.
//
// DIE URSACHE, am Code nachgesehen:
// App.tsx hatte DREI Rueckgabezweige, und der Sperrbildschirm stand in zwei von
// ihnen — im Ladezweig an zweiter Stelle hinter dem Ladebildschirm, im fertigen
// Zweig an vierter hinter Router, Toasts und Vorgangsleiste. React gleicht
// Kinder nach POSITION ab: verschiebt sich die Stelle, wird die Komponente nicht
// abgeglichen, sondern NEU MONTIERT. Nachgemessen, siehe den Test
// "Reconciliation" weiter unten.
//
// Beim Kaltstart mit eingeschalteter Sperre passiert genau das: `gesperrt` steht
// frueh (useAppSperre braucht zwei Aufrufe ueber die Capacitor-Bruecke),
// `seitenBereit` spaeter (useSeitenBereit wartet auf dynamische Importe). Der
// Sperrbildschirm erscheint also erst im Ladezweig und wandert dann in den
// fertigen — und sein Effekt beim Einblenden, der die Biometrie von selbst
// abfragt, lief ein ZWEITES Mal.
//
// WARUM DAS AUF ANDROID WEHTUT: Dort laeuft die Abfrage in einer eigenen
// Activity (AuthActivity im Plugin). Ein zweiter Start verdraengt den ersten
// Prompt; AndroidX beendet ihn mit ERROR_CANCELED — die Doku dazu wortwoertlich:
// "another pending operation prevents it". Das Plugin bildet ERROR_CANCELED auf
// seinen Code 15 ab, und services/biometrics.ts zaehlt 15 (SYSTEM_CANCEL) zu den
// Abbruch-Codes: Der Sperrbildschirm zeigte "Nicht erkannt. Tippe noch einmal",
// obwohl niemand abgebrochen hatte. Der haendische Versuch danach war der
// einzige laufende und ging durch — genau Maltes Bild.
// Auf iOS haengt der Prompt an der laufenden Activity, dort fiel es nicht auf.
//
// BEHOBEN AUF ZWEI EBENEN:
//   1. App.tsx haengt Sperrbildschirm und Abdeckung nur noch EINMAL ein,
//      ausserhalb der Zweigwahl. Damit wandert der Sperrbildschirm nicht mehr.
//   2. services/appSperre.ts startet keine zweite Abfrage neben einer offenen
//      (`laufendeAbfrage`). Auf Android waere sie nicht bloss doppelt, sondern
//      schaedlich — und dieser Schutz liegt an der Stelle, an der ALLE Aufrufer
//      vorbeikommen, nicht nur in der einen Komponente.
// ---------------------------------------------------------------------------

// Das Plugin wird ersetzt, `sperreOeffnen` selbst bleibt ECHT — sonst pruefte
// dieser Test seine eigene Attrappe statt der Absicherung.
const mockVerify = vi.fn();
const mockVerfuegbar = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' }
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async () => ({ value: null })),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined)
  }
}));
vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: { verifyIdentity: (...a: unknown[]) => mockVerify(...(a as [])) }
}));
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
  // Dieselbe Zuordnung wie in services/biometrics.ts: 15 ist SYSTEM_CANCEL, 16
  // USER_CANCEL, 10 AUTHENTICATION_FAILED — alle drei zaehlen als Abbruch.
  istAbbruch: (f: unknown) => [10, 15, 16].includes((f as { code?: number })?.code ?? -1)
}));

import AppSperrbildschirm from '../../components/common/AppSperrbildschirm';
import { _abfrageMerkerZuruecksetzenFuerTests } from '../../services/appSperre';

beforeEach(() => {
  vi.clearAllMocks();
  // Der Merker gegen die zweite Abfrage liegt auf Modulebene. Tests, die eine
  // Abfrage absichtlich offen lassen, wuerden sonst die folgenden blockieren —
  // und die saehen gruen aus, weil gar nichts mehr beim Geraet ankommt.
  _abfrageMerkerZuruecksetzenFuerTests();
  mockVerfuegbar.mockResolvedValue({
    verfuegbar: true, art: 'fingerabdruck', bezeichnung: 'Fingerabdruck', sinnbild: 'finger'
  });
  mockVerify.mockResolvedValue(undefined);
});

/**
 * Stellt die Lage aus App.tsx VOR dem Fix nach: zwei Zweige, die denselben
 * Sperrbildschirm an unterschiedlicher Stelle rendern. `bereit` schaltet
 * zwischen ihnen um — genau das tat `seitenBereit`, sobald die Seiten der Rolle
 * geladen waren.
 *
 * DIE ANZAHL DER GESCHWISTER DAVOR IST DER GANZE PUNKT: Steht der
 * Sperrbildschirm in beiden Zweigen an derselben Stelle, wird er abgeglichen
 * und sein Effekt laeuft einmal. Verschiebt sich die Stelle, montiert React ihn
 * NEU — und der Effekt feuert ein zweites Mal. Diese Attrappe hat deshalb
 * bewusst unterschiedlich viele Geschwister vor dem Sperrbildschirm, so wie
 * App.tsx es hatte (Position 1 gegen Position 3).
 *
 * Sie bleibt im Test, obwohl App.tsx das Muster nicht mehr hat: Sie ist der
 * Beweis, dass die zweite Ebene in services/appSperre.ts traegt, falls die
 * Doppelung jemals zurueckkommt.
 */
const ZweiZweige: React.FC<{ bereit: boolean; onEntsperrt?: () => void }> = ({
  bereit,
  onEntsperrt = () => {}
}) => {
  if (!bereit) {
    return (
      <div>
        <div data-testid="laedt">laedt</div>
        <AppSperrbildschirm onEntsperrt={onEntsperrt} onAbmelden={() => {}} />
      </div>
    );
  }
  return (
    <div>
      <div data-testid="router">router</div>
      <div data-testid="toasts">toasts</div>
      <div data-testid="vorgaenge">vorgaenge</div>
      <AppSperrbildschirm onEntsperrt={onEntsperrt} onAbmelden={() => {}} />
    </div>
  );
};

describe('Reconciliation: warum der Sperrbildschirm doppelt fragte', () => {
  // Nachgemessen, nicht behauptet. Diese beiden Tests belegen die Regel, auf
  // der der ganze Befund beruht — ohne sie waere "React montiert neu" bloss
  // eine Annahme.
  const montiert = vi.fn();
  const Kind: React.FC = () => {
    React.useEffect(() => { montiert(); }, []);
    return <span>kind</span>;
  };

  it('gleiche Position -> eine Montage', async () => {
    montiert.mockClear();
    const Zweig: React.FC<{ b: boolean }> = ({ b }) =>
      b ? <div><div>router</div><Kind /></div> : <div><div>laedt</div><Kind /></div>;

    const { rerender } = render(<Zweig b={false} />);
    await act(async () => { rerender(<Zweig b />); });
    expect(montiert).toHaveBeenCalledTimes(1);
  });

  it('verschobene Position -> ZWEI Montagen', async () => {
    montiert.mockClear();
    const Zweig: React.FC<{ b: boolean }> = ({ b }) =>
      b
        ? <div><div>r1</div><div>r2</div><div>r3</div><Kind /></div>
        : <div><div>laedt</div><Kind /></div>;

    const { rerender } = render(<Zweig b={false} />);
    await act(async () => { rerender(<Zweig b />); });
    expect(montiert).toHaveBeenCalledTimes(2);
  });
});

describe('Der erste, automatische Versuch (Maltes Befund)', () => {
  it('fragt das Geraet GENAU EINMAL, auch wenn der Sperrbildschirm neu montiert wird', async () => {
    // DER KERN DES BEFUNDS. Der Sperrbildschirm wird hier absichtlich neu
    // montiert (verschobene Position). Trotzdem darf nur EIN Prompt beim Geraet
    // ankommen — ein zweiter verdraengt auf Android den ersten und laesst beide
    // scheitern.
    //
    // Die Abfrage bleibt absichtlich offen (wie auf dem Geraet, wo der Prompt
    // steht und auf den Finger wartet) — sonst waere der Wettlauf nicht
    // nachgestellt.
    mockVerify.mockImplementation(() => new Promise(() => {}));

    const { rerender } = render(<ZweiZweige bereit={false} />);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));

    // Die Seiten der Rolle sind fertig -> Zweigwechsel, Neumontage.
    await act(async () => { rerender(<ZweiZweige bereit />); });

    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('fragt auch nach mehreren Zweigwechseln nur einmal', async () => {
    // Der Zweig hing an zwei unabhaengigen Bedingungen (`seitenBereit` UND
    // `startGeklaert`) und konnte deshalb mehr als einmal umschlagen.
    mockVerify.mockImplementation(() => new Promise(() => {}));

    const { rerender } = render(<ZweiZweige bereit={false} />);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));

    for (const bereit of [true, false, true]) {
      await act(async () => { rerender(<ZweiZweige bereit={bereit} />); });
    }

    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('haelt den Sperrbildschirm ueber den Zweigwechsel hinweg stehen', async () => {
    // Die Sperre darf durch den Wechsel nicht aufgehen: Wer den Zweigwechsel
    // abwartet, kommt nicht ohne Biometrie hinein.
    const entsperrt = vi.fn();
    mockVerify.mockImplementation(() => new Promise(() => {}));

    const { rerender } = render(<ZweiZweige bereit={false} onEntsperrt={entsperrt} />);
    await screen.findByText('Konfi Quest ist gesperrt');

    await act(async () => { rerender(<ZweiZweige bereit onEntsperrt={entsperrt} />); });

    expect(screen.getByText('Konfi Quest ist gesperrt')).toBeInTheDocument();
    expect(entsperrt).not.toHaveBeenCalled();
  });

  it('zeigt nach einer verdraengten Abfrage NICHT mehr "Nicht erkannt"', async () => {
    // Genau der falsche Text aus Maltes Befund. Er entstand, weil der zweite
    // Aufruf den ersten mit ERROR_CANCELED (Plugin-Code 15) beendete und der
    // Sperrbildschirm 15 als Abbruch las. Ohne zweiten Aufruf entsteht er nicht.
    mockVerify.mockImplementation(() => new Promise(() => {}));

    const { rerender } = render(<ZweiZweige bereit={false} />);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
    await act(async () => { rerender(<ZweiZweige bereit />); });

    expect(screen.queryByText(/Nicht erkannt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nicht geklappt/)).not.toBeInTheDocument();
  });

  it('gibt nach erfolgreicher Biometrie frei — der erlaubte Fall', async () => {
    // Gegenstueck zum verbotenen Fall: Die Sperre bleibt bedienbar. Ein Fix,
    // der die doppelte Abfrage unterdrueckt, darf die erste nicht mit
    // unterdruecken.
    const entsperrt = vi.fn();
    mockVerify.mockResolvedValue(undefined);

    render(<ZweiZweige bereit={false} onEntsperrt={entsperrt} />);
    await waitFor(() => expect(entsperrt).toHaveBeenCalledTimes(1));
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('laesst den haendischen Versuch nach einem Fehlschlag weiter zu', async () => {
    // Der Weg, der bei Malte funktioniert hat, muss offen bleiben: nach einem
    // gescheiterten automatischen Versuch oeffnet der Knopf eine NEUE Abfrage
    // beim Geraet. Der Merker darf den Knopf nicht totstellen.
    const entsperrt = vi.fn();
    mockVerify.mockRejectedValueOnce({ code: 16 });

    render(<ZweiZweige bereit={false} onEntsperrt={entsperrt} />);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Nicht erkannt/)).toBeInTheDocument();

    mockVerify.mockResolvedValue(undefined);
    const knopf = await screen.findByText(/Mit Fingerabdruck entsperren/);
    await act(async () => { knopf.click(); });

    await waitFor(() => expect(entsperrt).toHaveBeenCalledTimes(1));
    expect(mockVerify).toHaveBeenCalledTimes(2);
  });

  it('gibt ohne erfolgreiche Biometrie NICHT frei — der verbotene Fall', async () => {
    // Die Sperre ist ein Sicherheitsmerkmal. Der Merker gegen die zweite
    // Abfrage darf keinen Weg schaffen, der ohne Pruefung durchlaesst: Lehnt
    // das Geraet ab, bleibt gesperrt — auch wenn mehrfach getippt wird.
    const entsperrt = vi.fn();
    mockVerify.mockRejectedValue({ code: 16 });

    render(<ZweiZweige bereit={false} onEntsperrt={entsperrt} />);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 2; i++) {
      const knopf = await screen.findByText(/Mit Fingerabdruck entsperren/);
      await act(async () => { knopf.click(); });
    }

    expect(mockVerify).toHaveBeenCalledTimes(3);
    expect(entsperrt).not.toHaveBeenCalled();
    expect(screen.getByText('Konfi Quest ist gesperrt')).toBeInTheDocument();
  });

  it('gibt bei einem unerwarteten Fehler NICHT frei', async () => {
    // Ein Code, der kein Abbruch ist (z.B. Hardware weg), muss zu 'fehler'
    // fuehren und darf die App nicht oeffnen.
    const entsperrt = vi.fn();
    mockVerify.mockRejectedValue({ code: 1 });

    render(<ZweiZweige bereit={false} onEntsperrt={entsperrt} />);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));

    expect(await screen.findByText(/nicht geklappt/)).toBeInTheDocument();
    expect(entsperrt).not.toHaveBeenCalled();
  });
});

describe('App.tsx haengt Sperrbildschirm und Abdeckung nur einmal ein', () => {
  // Die Wurzel des Befunds: Zwei Einhaengepunkte fuer denselben Sperrbildschirm
  // an unterschiedlicher Position. Solange das so ist, montiert React ihn beim
  // Zweigwechsel neu. Dieser Test bewacht die Stelle, nicht nur das Verhalten —
  // die Absicherung in services/appSperre.ts faengt die Folgen ab, aber die
  // doppelte Montage soll gar nicht erst zurueckkommen.
  const quelle = readFileSync(
    resolve(__dirname, '../../..', 'src/App.tsx'),
    'utf-8'
  );

  it('haengt den Sperrbildschirm genau einmal ein', () => {
    const treffer = quelle.match(/<AppSperrbildschirm\b/g) ?? [];
    expect(treffer).toHaveLength(1);
  });

  it('haengt auch die Abdeckung genau einmal ein', () => {
    // Dieselbe Falle: zwei Einhaengepunkte, also Neumontage beim Wechsel.
    // Bei der Abdeckung faellt es nicht auf (sie hat keinen Effekt), aber die
    // Doppelung ist dieselbe und soll nicht zurueckkommen.
    const treffer = quelle.match(/<AppAbdeckung\b/g) ?? [];
    expect(treffer).toHaveLength(1);
  });

  it('haengt auch IonApp nur einmal ein', () => {
    // Die Huelle steht fest, nur der Inhalt wechselt. Zwei IonApp-Zweige waeren
    // der Weg zurueck zu wandernden Kindern.
    const treffer = quelle.match(/<IonApp>/g) ?? [];
    expect(treffer).toHaveLength(1);
  });
});
