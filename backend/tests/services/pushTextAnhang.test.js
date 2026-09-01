// backend/tests/services/pushTextAnhang.test.js
// Was in der Mitteilung steht, wenn eine Nachricht nur einen Anhang hat.
//
// Vorher stand dort fuer ALLES nur "[Anhang]" — Foto, Video, Datei und
// Sprachnachricht sahen gleich aus. Man konnte nicht entscheiden, ob es
// sich lohnt, gerade hinzusehen (Nutzerhinweis 31.08.2026).

const { anhangText, chatPushText } = require('../../utils/pushText');

describe('Mitteilungstext bei Anhaengen', () => {
  it('nennt den Typ statt "[Anhang]"', () => {
    expect(anhangText('image')).toBe('Foto');
    expect(anhangText('audio')).toBe('Sprachnachricht');
    expect(anhangText('poll')).toBe('Umfrage');
  });

  it('nennt bei Datei und Video den Dateinamen', () => {
    expect(anhangText('file', 'Freizeit-Anmeldung.pdf')).toBe('Datei: Freizeit-Anmeldung.pdf');
    expect(anhangText('video', 'krippenspiel.mp4')).toBe('Video: krippenspiel.mp4');
  });

  it('nennt beim Foto KEINEN Dateinamen', () => {
    // Kameranamen wie "IMG_20260831_120000.jpg" helfen niemandem.
    expect(anhangText('image', 'IMG_20260831_120000.jpg')).toBe('Foto');
  });

  it('faellt bei unbekanntem Typ auf einen neutralen Text zurueck', () => {
    expect(anhangText('irgendwas')).toBe('Anhang');
    expect(anhangText(undefined)).toBe('Anhang');
  });
});

describe('Mitteilungstext: Direktchat und Gruppe', () => {
  it('zeigt im Direktchat nur den Text (der Name steht im Titel)', () => {
    expect(chatPushText({
      content: 'Bis gleich!', messageType: 'text', senderName: 'Emilia', isDirectChat: true,
    })).toBe('Bis gleich!');
  });

  it('stellt in der Gruppe den Absender voran', () => {
    expect(chatPushText({
      content: 'Bis gleich!', messageType: 'text', senderName: 'Emilia', isDirectChat: false,
    })).toBe('Emilia: Bis gleich!');
  });

  it('nutzt den Anhang-Text, wenn kein Begleittext da ist', () => {
    expect(chatPushText({
      content: null, messageType: 'image', senderName: 'Emilia', isDirectChat: false,
    })).toBe('Emilia: Foto');
  });

  it('behandelt einen leeren Begleittext wie gar keinen', () => {
    // Sonst stuende in der Mitteilung nur "Emilia: " ohne Inhalt.
    expect(chatPushText({
      content: '   ', messageType: 'file', fileName: 'plan.pdf', senderName: 'Emilia', isDirectChat: false,
    })).toBe('Emilia: Datei: plan.pdf');
  });

  it('bevorzugt den Begleittext, wenn es einen gibt', () => {
    expect(chatPushText({
      content: 'Schaut mal!', messageType: 'image', senderName: 'Emilia', isDirectChat: false,
    })).toBe('Emilia: Schaut mal!');
  });
});
