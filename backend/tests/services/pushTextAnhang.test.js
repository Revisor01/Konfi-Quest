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

describe('Chat-Mitteilung: Absender und Art, nie der Inhalt (Simon, 29.09.2026)', () => {
  it('nennt im Direktchat nur die Art (der Name steht im Titel)', () => {
    expect(chatPushText({
      content: 'Bis gleich!', messageType: 'text', senderName: 'Emilia', isDirectChat: true,
    })).toBe('Neue Nachricht');
  });

  it('nennt in der Gruppe Art und Absender', () => {
    expect(chatPushText({
      content: 'Bis gleich!', messageType: 'text', senderName: 'Emilia', isDirectChat: false,
    })).toBe('Neue Nachricht von Emilia');
  });

  it('nennt bei Anhaengen die Art', () => {
    const art = (messageType) => chatPushText({ messageType, senderName: 'Emilia', isDirectChat: false });
    expect(art('image')).toBe('Neues Foto von Emilia');
    expect(art('video')).toBe('Neues Video von Emilia');
    expect(art('audio')).toBe('Neue Sprachnachricht von Emilia');
    expect(art('file')).toBe('Neue Datei von Emilia');
    expect(art('poll')).toBe('Neue Umfrage von Emilia');
    expect(art(undefined)).toBe('Neue Nachricht von Emilia');
  });

  it('laesst Nachrichtentext und Dateinamen draussen', () => {
    const text = chatPushText({
      content: 'Geheimer Treffpunkt', messageType: 'file', fileName: 'Adressliste.pdf',
      senderName: 'Emilia', isDirectChat: false,
    });
    expect(text).toBe('Neue Datei von Emilia');
    expect(text).not.toContain('Geheimer');
    expect(text).not.toContain('Adressliste');
  });
});
