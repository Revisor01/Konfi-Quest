import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Zwei Befunde von Simon (02.09.2026), beide in BadgeContext.markRoomAsRead:
//
// 1. "Mach ich aus und wieder an, ist sogar die rote Linie im Chat da."
//    Die Chat-Übersicht lädt ihre Räume über useOfflineQuery aus dem Cache
//    ('chat:rooms:<userId>'), und jeder Raum bringt sein unread_count MIT.
//    Nach dem Lesen wurde dieser Cache nirgends aktualisiert -- beim
//    nächsten App-Start kam der alte Stand zurück und erzeugte erneut Badge
//    und roten Trenner (useChatSocket friert room.unread_count ein).
//
// 2. "Warum wird der Badge-Count nicht gelöscht, wenn ich live im System
//    bin?" setChatUnreadTotal las chatUnreadByRoom[roomId] aus der Closure --
//    also aus einem womöglich veralteten Stand. Die Gesamtzahl wurde dann um
//    den falschen Betrag verringert.
//
// Die Datenbank war bei beidem korrekt: Für Simons Jahrgangschat stand dort
// last_read_at von gestern und 0 ungelesen. Der Fehler lag in der Anzeige.
//
// Geprüft wird am Quelltext, weil der Fehler in der Verdrahtung steckt
// (welcher Wert aus welcher Quelle) und nicht im Ergebnis einer einzelnen
// Funktion.

const quelle = readFileSync(
  resolve(process.cwd(), 'src/contexts/BadgeContext.tsx'),
  'utf8'
);

describe('BadgeContext.markRoomAsRead', () => {
  it('verwirft den zwischengespeicherten Raum-Stand nach dem Lesen', () => {
    // Ohne diesen Schritt lebt das alte unread_count im Cache weiter und
    // kommt beim nächsten App-Start zurück.
    expect(quelle).toContain('offlineCache.remove(`chat:rooms:${user.id}`)');
  });

  it('verwirft den Cache erst NACH der Server-Antwort', () => {
    // Vor der Antwort wäre es geraten: Schlägt der Aufruf fehl, hätten wir
    // den Cache umsonst geleert und die Übersicht lädt neu, obwohl sich
    // nichts geändert hat.
    const abschnitt = quelle.slice(quelle.indexOf('mark-read'));
    const themen = abschnitt.indexOf('.then(');
    const entfernen = abschnitt.indexOf('offlineCache.remove');
    expect(themen).toBeGreaterThan(-1);
    expect(entfernen).toBeGreaterThan(themen);
  });

  it('zieht vom Gesamtzähler den tatsächlich abgezogenen Wert ab', () => {
    // Der alte Code las chatUnreadByRoom[roomId] aus der Closure. Steht das
    // wieder da, ist der Fehler zurück.
    const abschnitt = quelle.slice(
      quelle.indexOf('setChatUnreadByRoom'),
      quelle.indexOf('// API Call im Hintergrund')
    );
    expect(abschnitt).not.toContain('const currentUnread = chatUnreadByRoom[roomId]');
    expect(abschnitt).toContain('prev - abgezogen');
  });

  it('nimmt den abzuziehenden Wert aus dem Setter, nicht von außen', () => {
    const abschnitt = quelle.slice(
      quelle.indexOf('setChatUnreadByRoom'),
      quelle.indexOf('// API Call im Hintergrund')
    );
    // `abgezogen` wird IM ersten Updater gesetzt, wo React den aktuellen
    // Zustand liefert.
    expect(abschnitt).toMatch(/setChatUnreadByRoom\(prev => \{[\s\S]*abgezogen = prev\[roomId\]/);
  });

  it('lässt den Gesamtzähler nie negativ werden', () => {
    expect(quelle).toContain('Math.max(0, prev - abgezogen)');
  });
});
