import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Vier Funde vom Aufteilen der Chat-Komponente (28.08.2026). Drei davon sind
// toter Code, einer ein echter Fehler, der heute nur deshalb nicht auffaellt,
// weil es genau eine Aufrufstelle gibt.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const raum = lies('src/components/chat/ChatRoom.tsx');
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
    // aufgerufen -- Anhaenge laufen ueber das Datei-Feld in MessageInput,
    // das auf dem Handy die Kamera mit anbietet.
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

describe('Die 10-MB-Grenze bleibt im echten Weg bestehen', () => {
  // Beim Wegwerfen der toten Wrapper war die Frage, ob ihre Groessenpruefung
  // im echten Weg fehlt. Tut sie nicht -- und anders als die Wrapper sagt
  // handleFileSelect auch, warum nichts passiert.
  it('handleFileSelect prueft die Groesse', () => {
    const pruefung = dateien.slice(
      dateien.indexOf('const handleFileSelect'),
      dateien.indexOf('setSelectedFile(file)')
    );
    expect(pruefung).toContain('10 * 1024 * 1024');
  });

  it('und meldet es der Nutzerin, statt still abzubrechen', () => {
    const pruefung = dateien.slice(
      dateien.indexOf('const handleFileSelect'),
      dateien.indexOf('setSelectedFile(file)')
    );
    expect(pruefung).toContain('Datei ist zu groß (max. 10MB)');
  });
});
