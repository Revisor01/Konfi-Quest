// Gerüst zuerst: es registriert die Attrappen, bevor der Raum geladen wird.
import {
  zustand, setError, nachrichtTeilen,
  raumElement, nachrichtenAbwarten, dateiWaehlen, zuruecksetzen, textNachricht, datei,
} from './gerueste/chatRaumMitDateien';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Message } from '../../types/chat';

// Vier Funde vom Aufteilen der Chat-Komponente (28.08.2026). Drei davon sind
// toter Code, einer ein echter Fehler, der heute nur deshalb nicht auffaellt,
// weil es genau eine Aufrufstelle gibt.
//
// Seit dem 09.10.2026 laeuft der Fehler und die Groessengrenze im echten
// Chatraum (Geruest gerueste/chatRaumMitDateien); nur die drei Abwesenheits-
// Waechter fuer den toten Code lesen noch Quelltext.

beforeEach(async () => { await zuruecksetzen(); });

/** Den echten Raum rendern und warten, bis die Nachrichten stehen. */
async function raumOeffnen() {
  render(raumElement());
  await nachrichtenAbwarten();
}
afterEach(() => cleanup());

describe('Nachricht teilen liest den aktuellen Stand', () => {
  // Vorher: setSelectedMessage(message); handleShare(); -- handleShare las
  // selectedMessage aus dem VORIGEN Rendern. Das ging gut, solange nur die
  // ohnehin ausgewaehlte Nachricht geteilt wurde; eine zweite Aufrufstelle
  // haette die falsche Nachricht geteilt.
  const a = textNachricht(21, 'Erste');
  const b = textNachricht(22, 'Zweite');

  type ListenProps = { onLongPress: (m: Message) => void; onShare: (m: Message) => Promise<void> };
  const liste = () => zustand.listenProps as unknown as ListenProps;

  it('teilt die uebergebene Nachricht, nicht die ausgewaehlte', async () => {
    zustand.nachrichten = [a, b];
    await raumOeffnen();
    // "Erste" ist ausgewaehlt (langer Druck), geteilt wird "Zweite".
    await act(async () => { liste().onLongPress(a); });
    await act(async () => { await liste().onShare(b); });
    expect(nachrichtTeilen).toHaveBeenCalledTimes(1);
    expect((nachrichtTeilen.mock.calls[0] as unknown[])[0]).toBe(b);
  });

  it('teilt auch ohne jede Auswahl -- der Zustand spielt keine Rolle', async () => {
    zustand.nachrichten = [a, b];
    await raumOeffnen();
    await act(async () => { await liste().onShare(a); });
    expect(nachrichtTeilen).toHaveBeenCalledTimes(1);
    expect((nachrichtTeilen.mock.calls[0] as unknown[])[0]).toBe(a);
  });

  it('meldet Fehler beim Teilen ueber die App-Meldung', async () => {
    zustand.nachrichten = [a];
    await raumOeffnen();
    await act(async () => { await liste().onShare(a); });
    // Der zweite Parameter ist der Fehlerweg der App.
    expect((nachrichtTeilen.mock.calls[0] as unknown[])[1]).toBe(setError);
  });
});

describe('Toter Code aus der Aufteilung (Abwesenheits-Waechter)', () => {
  // Bewusst Quelltext: geprueft wird, dass etwas NICHT mehr da ist.
  const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
  const sektionen = lies('src/components/chat/ChatRoomSections.tsx');
  const dateien = lies('src/components/chat/useChatDateien.ts');
  const raum = lies('src/components/chat/ChatRoom.tsx') + lies('src/components/chat/useChatRaum.ts');

  it('es gibt keinen zweiten Teilen-Weg mehr, der den Zustand liest', () => {
    expect(raum).not.toContain('const handleShare = async () =>');
  });

  it('die nie aufgerufenen Kamera-Wrapper sind weg', () => {
    // takePicture/selectFromGallery in useChatDateien wurden von niemandem
    // aufgerufen -- Anhaenge laufen ueber die Dateiauswahl des Systems
    // (dateiAuswaehlen), die auf dem Handy die Kamera mit anbietet.
    expect(dateien).not.toContain('takePictureHelper');
    expect(dateien).not.toContain('selectFromGalleryHelper');
  });

  it('auch die zugehoerigen Helfer sind weg', () => {
    expect(sektionen).not.toContain('export const takePicture');
    expect(sektionen).not.toContain('export const selectFromGallery');
  });

  it('MIME_EXT_MAP ist weg -- niemand hat sie je gelesen', () => {
    expect(sektionen).not.toContain('MIME_EXT_MAP');
  });
});

describe('Die Groessengrenze bleibt im echten Weg bestehen', () => {
  // Beim Wegwerfen der toten Wrapper war die Frage, ob ihre Groessenpruefung
  // im echten Weg fehlt. Tut sie nicht -- und anders als die Wrapper sagt
  // dateiUebernehmen auch, warum nichts passiert.
  //
  // 27.09.2026: Die Grenze ist die des Servers (5 MB statt 10 MB) und steht
  // mit dem Satz dazu im gemeinsamen Weg fuer Chat und Challenges
  // (fuerUploadVorbereiten).
  const MB = 1024 * 1024;

  it('eine Datei ueber 5 MB wird nicht uebernommen und die Nutzerin erfaehrt, warum', async () => {
    await raumOeffnen();
    await dateiWaehlen(datei('Gross.pdf', 6 * MB));
    expect(screen.getByTestId('gewaehlt').textContent).toBe('');
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 5 MB).');
  });

  it('eine Datei unter 5 MB wird uebernommen, ohne Meldung', async () => {
    await raumOeffnen();
    await dateiWaehlen(datei('Klein.pdf', 4 * MB));
    expect(screen.getByTestId('gewaehlt').textContent).toBe('Klein.pdf');
    expect(setError).not.toHaveBeenCalled();
  });

  it('die Grenze liegt bei genau 5 MB', async () => {
    await raumOeffnen();
    await dateiWaehlen(datei('Genau.pdf', 5 * MB));
    expect(screen.getByTestId('gewaehlt').textContent).toBe('Genau.pdf');
    await dateiWaehlen(datei('EinByteMehr.pdf', 5 * MB + 1));
    expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 5 MB).');
  });
});
