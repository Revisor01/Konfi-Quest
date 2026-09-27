import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Haptik darf keinen Ablauf abbrechen (15.09.2026, Simon in Firefox am Rechner).
//
// Der Befund: Im Chat liess sich keine Datei mehr oeffnen, in der Konsole stand
// "Browser does not support the vibrate API". Die Vibrationsmeldung sah nach
// Begleitrauschen aus, war aber die Ursache — der Haptik-Aufruf stand als erste
// Zeile im try-Block von handleFileClick. Die Ausnahme sprang sofort in den
// catch: keine Datei-Anfrage, nur die Meldung "Fehler beim Oeffnen der Datei".
//
// Geprueft wird der ECHTE Hook gegen ein Haptik-Plugin, das wirft — wie das
// Plugin es im Desktop-Browser tut. Nicht der Quelltext: Ob ein try/catch an
// der richtigen Stelle steht, entscheidet der Ablauf, nicht der Wortlaut.

// WICHTIG: Attrappiert wird das PLUGIN, nicht die Hilfsfunktion. Wer
// utils/haptics attrappiert, prueft die Attrappe und laesst genau die Zeile
// ungeprueft, um die es geht — der Schutz steckt in der Hilfsfunktion.
const impactMock = vi.fn();
const getMediaBlobMock = vi.fn();
const istGecachtMock = vi.fn();
const openFileNativelyMock = vi.fn();
const setErrorMock = vi.fn();
const presentFileViewerMock = vi.fn();

// Das echte utils/haptics laeuft mit — nur das Plugin darunter ist gestellt.
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: (...args: unknown[]) => impactMock(...args) },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

// Als native Plattform laufen: sonst kommt die Hilfsfunktion gar nicht bis zum
// Plugin, und der try/catch — die eigentlich zu pruefende Zeile — bliebe
// ungeprueft. Der Desktop-Browser-Fall ist damit sogar noch besser gestellt.
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock('../../services/mediaCache', () => ({
  getMediaBlob: (...args: unknown[]) => getMediaBlobMock(...args),
  istGecacht: (...args: unknown[]) => istGecachtMock(...args),
}));

vi.mock('../../utils/nativeFileViewer', () => ({
  openFileNatively: (...args: unknown[]) => openFileNativelyMock(...args),
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError: setErrorMock }),
}));

vi.mock('@ionic/react', () => ({
  useIonModal: () => [presentFileViewerMock, vi.fn()],
}));

vi.mock('../../components/shared/FileViewerModal', () => ({ default: () => null }));

import { useChatDateien } from '../../components/chat/useChatDateien';
import type { Message } from '../../types/chat';

const NACHRICHTEN = [
  { id: 1, file_path: 'abc123.pdf', file_name: 'Konfirmationsablauf.pdf' },
] as unknown as Message[];

// Genau die Ausnahme, die das Capacitor-Haptik-Plugin im Desktop-Browser wirft.
const VIBRATIONS_FEHLER = new Error('Browser does not support the vibrate API');

let fehlerInDerKonsole: string[] = [];
const unbehandelt: unknown[] = [];

// Eine verschluckte, aber nie gefangene Zusage landet hier — der Weg, auf dem
// ein "unhandled rejection" im Browser in der Konsole erscheint.
process.on('unhandledRejection', (grund) => { unbehandelt.push(grund); });

beforeEach(() => {
  vi.clearAllMocks();
  fehlerInDerKonsole = [];
  unbehandelt.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    // Reines Testgeschirr-Rauschen: React meldet Zustandsaenderungen ausserhalb
    // von act(). Das hat mit dem Befund nichts zu tun und wuerde die Pruefung
    // dauerhaft rot faerben.
    if (text.includes('not wrapped in act(')) return;
    fehlerInDerKonsole.push(text);
  });
  istGecachtMock.mockResolvedValue(false);
  getMediaBlobMock.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  // Web-Browser: nativ oeffnen ist nicht moeglich -> FileViewerModal.
  openFileNativelyMock.mockResolvedValue(false);
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test-url');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const dateiOeffnen = async () => {
  const { result } = renderHook(() => useChatDateien({ messages: NACHRICHTEN }));
  await result.current.handleFileClick('abc123.pdf', 'Konfirmationsablauf.pdf', 'application/pdf');
  return result;
};

describe('Datei oeffnen, wenn die Haptik nicht verfuegbar ist', () => {
  it('oeffnet die Datei trotzdem — der Kern des Befunds', async () => {
    // Das Plugin wirft, wie im Desktop-Browser.
    impactMock.mockRejectedValue(VIBRATIONS_FEHLER);

    await dateiOeffnen();

    // Die Datei wurde geladen: GENAU einmal, mit genau diesem Pfad.
    expect(getMediaBlobMock).toHaveBeenCalledTimes(1);
    expect(getMediaBlobMock.mock.calls[0][0]).toBe('abc123.pdf');
    // Und sie wurde angezeigt.
    expect(presentFileViewerMock).toHaveBeenCalledTimes(1);
    // Keine Fehlermeldung an die Nutzerin.
    expect(setErrorMock).not.toHaveBeenCalled();
  });

  it('meldet keinen Fehler in die Fehlererfassung', async () => {
    impactMock.mockRejectedValue(VIBRATIONS_FEHLER);

    await dateiOeffnen();

    // Ein gemeldeter Fehler verrauscht die Messung: "Fehler beim Oeffnen der
    // Datei" stand 30 Tage lang mit 12 Vorfaellen in der Auswertung, obwohl
    // nie eine Datei-Anfrage gescheitert war.
    expect(setErrorMock).not.toHaveBeenCalledWith(
      'Fehler beim Öffnen der Datei',
      expect.anything()
    );
  });

  it('laesst keinen unbehandelten Fehler in der Konsole zurueck', async () => {
    impactMock.mockRejectedValue(VIBRATIONS_FEHLER);

    await dateiOeffnen();
    // Eine verwaiste Zusage meldet sich erst, wenn die Microtask-Schlange leer
    // ist — ohne das Warten waere die Pruefung immer gruen.
    await new Promise((fertig) => setTimeout(fertig, 0));

    expect(fehlerInDerKonsole).toEqual([]);
    expect(unbehandelt).toEqual([]);
  });
});

describe('Datei oeffnen, wenn die Haptik verfuegbar ist', () => {
  it('loest die Haptik aus und oeffnet die Datei', async () => {
    impactMock.mockResolvedValue(undefined);

    await dateiOeffnen();

    expect(impactMock).toHaveBeenCalledTimes(1);
    expect(impactMock.mock.calls[0][0]).toEqual({ style: 'LIGHT' });
    expect(getMediaBlobMock).toHaveBeenCalledTimes(1);
    expect(presentFileViewerMock).toHaveBeenCalledTimes(1);
    expect(setErrorMock).not.toHaveBeenCalled();
  });
});

describe('Echte Fehler beim Oeffnen kommen weiterhin an', () => {
  it('meldet einen gescheiterten Download mit Ort und Ursache', async () => {
    // Gegenprobe zur Entschaerfung: Das Wegfangen der Haptik darf nicht
    // nebenbei echte Fehler verschlucken.
    impactMock.mockResolvedValue(undefined);
    getMediaBlobMock.mockRejectedValue(Object.assign(new Error('Request failed'), {
      response: { status: 404 },
    }));

    await dateiOeffnen();

    expect(setErrorMock).toHaveBeenCalledTimes(1);
    expect(setErrorMock.mock.calls[0][0]).toBe('Fehler beim Öffnen der Datei');
    expect(setErrorMock.mock.calls[0][1].ort).toBe('chat-datei');
    expect(presentFileViewerMock).not.toHaveBeenCalled();
  });
});

describe('Die Haptik-Hilfsfunktion ist die einzige Stelle', () => {
  it('niemand importiert das Haptik-Plugin direkt', async () => {
    // Die Loesung ist an EINER Stelle gebuendelt. Ein direkter Import waere
    // eine neue ungeschuetzte Aufrufstelle — genau das Muster, das den Fehler
    // an fuenf Stellen gleichzeitig erzeugt hat (Chat, Material, Video,
    // Reaktionen, Material-Formular).
    const { readFileSync, readdirSync, statSync } = await import('fs');
    const { resolve, join } = await import('path');

    const wurzel = resolve(process.cwd(), 'src');
    const erlaubt = resolve(wurzel, 'utils/haptics.ts');
    const treffer: string[] = [];

    const durchsuchen = (verzeichnis: string) => {
      for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag);
        if (statSync(pfad).isDirectory()) { durchsuchen(pfad); continue; }
        if (!/\.(ts|tsx)$/.test(eintrag)) continue;
        if (pfad === erlaubt) continue;
        if (pfad.includes('__tests__')) continue;
        if (readFileSync(pfad, 'utf8').includes("from '@capacitor/haptics'")) {
          treffer.push(pfad.slice(wurzel.length + 1));
        }
      }
    };
    durchsuchen(wurzel);

    expect(treffer).toEqual([]);
  });
});
