import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Vier Funde vom Aufteilen der Chat-Komponente (28.08.2026). Drei davon sind
// toter Code, einer ein echter Fehler, der heute nur deshalb nicht auffaellt,
// weil es genau eine Aufrufstelle gibt.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

// Die Logik des Raums liegt seit der Web-Fassung in useChatRaum (die App-Fassung
// ChatRoom und die Web-Fassung zeichnen nur); gelesen wird beides.
const raum = lies('src/components/chat/ChatRoom.tsx') + lies('src/components/chat/useChatRaum.ts');
const sektionen = lies('src/components/chat/ChatRoomSections.tsx');
const dateien = lies('src/components/chat/useChatDateien.ts');

describe('Nachricht teilen liest den aktuellen Stand', () => {
  // Vorher: setSelectedMessage(message); handleShare(); -- handleShare las
  // selectedMessage aus dem VORIGEN Rendern. Das ging gut, solange nur die
  // ohnehin ausgewaehlte Nachricht geteilt wurde; eine zweite Aufrufstelle
  // haette die falsche Nachricht geteilt.
  it('teilt die uebergebene Nachricht, nicht den Zustand', () => {
    const teilen = raum.slice(
      raum.indexOf('const handleShareMessage'),
      raum.indexOf('const handleShareMessage') + 300
    );
    expect(teilen).toContain('nachrichtTeilen(message,');
  });

  it('greift dabei nicht auf selectedMessage zurueck', () => {
    const teilen = raum.slice(
      raum.indexOf('const handleShareMessage'),
      raum.indexOf('const handleShareMessage') + 300
    );
    expect(teilen).not.toContain('nachrichtTeilen(selectedMessage');
  });

  it('es gibt keinen zweiten Teilen-Weg mehr, der den Zustand liest', () => {
    // Die fruehere Doppelung handleShare + handleShareMessage ist zu einer
    // Funktion zusammengezogen.
    expect(raum).not.toContain('const handleShare = async () =>');
  });
});

describe('Toter Code aus der Aufteilung', () => {
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
  // dateiUebernehmen auch, warum nichts passiert. (Bis 29.09.2026 hiess die
  // Stelle handleFileSelect und bekam das change-Ereignis des Datei-Felds;
  // seitdem kommt die Datei aus der Huelle dateiAuswaehlen.)
  //
  // 27.09.2026: Die Grenze ist die des Servers (5 MB statt 10 MB) und steht
  // mit dem Satz dazu im gemeinsamen Weg fuer Chat und Challenges
  // (fuerUploadVorbereiten). Im Ablauf geprueft in
  // uploadVerkleinerungGemeinsam.test.tsx (6-MB-PDF abgelehnt, 4 MB durch).
  const kompression = lies('src/services/mediaCompression.ts');
  const pruefung = dateien.slice(
    dateien.indexOf('const dateiUebernehmen'),
    dateien.indexOf('setSelectedFile(file)')
  );

  it('dateiUebernehmen prueft die Groesse', () => {
    expect(pruefung).toContain('fuerUploadVorbereiten(picked, UPLOAD_GRENZE.chat)');
    expect(kompression).toContain('chat: 5 * 1024 * 1024,');
  });

  it('und meldet es der Nutzerin, statt still abzubrechen', () => {
    expect(dateien).toContain('setError(err instanceof DateiZuGrossFehler ? err.message');
    expect(kompression).toContain('`Datei ist zu groß (max. ${Math.round(maxBytes / 1024 / 1024)} MB).`');
  });
});
