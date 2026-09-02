import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Der Wettlauf zwischen mark-read und dem Nachladen der Zaehler.
 *
 * SIMONS BEFUND (03.09.2026, nach Build 160): "Ich gehe in den Chats, Badge
 * wird nie geloescht. Bleibt immer da. Nach komplettem Neustart ist auch die
 * rote Linie wieder da."
 *
 * Der Fix vom 02.09.2026 hatte zwei echte Fehler behoben (Cache und
 * Closure-Wert), aber den eigentlichen Ablauf nicht:
 *
 *   ChatRoom.markRoomAsRead()
 *     -> badgeMarkRoomAsRead(room.id)   // POST lief im HINTERGRUND
 *     -> await refreshAllCounts()       // fragte SOFORT die Zaehler ab
 *
 * refreshAllCounts liest GET /notifications/badge-counts und setzt
 * setChatUnreadTotal HART auf den Serverwert (nicht relativ). Kam die
 * Antwort, bevor der Server das mark-read verbucht hatte, wurde die
 * optimistische Null zuverlaessig ueberschrieben -- der Badge war sofort
 * wieder da.
 *
 * WARUM DER TEST AM QUELLTEXT PRUEFT: Der Fehler ist eine Frage der
 * Reihenfolge zweier Netzaufrufe. Ein Rendertest mit verspotteten Aufrufen
 * wuerde die echte Verzoegerung nicht abbilden -- er wuerde gruen, weil das
 * Mock sofort antwortet. Genau daran ist der erste Anlauf gescheitert: Fuenf
 * gruene Tests, und der Fehler blieb auf dem Geraet.
 */

const badgeQuelle = readFileSync(
  resolve(process.cwd(), 'src/contexts/BadgeContext.tsx'), 'utf8'
);
const chatRoomQuelle = readFileSync(
  resolve(process.cwd(), 'src/components/chat/ChatRoom.tsx'), 'utf8'
);

describe('mark-read vor dem Nachladen der Zaehler', () => {
  it('markRoomAsRead gibt ein Promise zurueck', () => {
    // Ohne Rueckgabewert kann kein Aufrufer warten -- der Wettlauf waere
    // gar nicht vermeidbar.
    expect(badgeQuelle).toMatch(
      /markRoomAsRead:\s*\(roomId: number\)\s*=>\s*Promise<void>/
    );
  });

  it('markRoomAsRead ist async und wartet den POST ab', () => {
    expect(badgeQuelle).toMatch(
      /const markRoomAsRead = useCallback\(async \(roomId: number\): Promise<void> =>/
    );
    expect(badgeQuelle).toContain('await api.post(`/chat/rooms/${roomId}/mark-read`)');
  });

  it('der POST wird NICHT mehr fire-and-forget abgesetzt', () => {
    // Die alte Form: api.post(...).then(...) ohne await.
    const ohneAwait = /(?<!await )api\.post\(`\/chat\/rooms\/\$\{roomId\}\/mark-read`\)/;
    expect(ohneAwait.test(badgeQuelle)).toBe(false);
  });

  it('ChatRoom wartet auf mark-read, BEVOR es die Zaehler neu holt', () => {
    const stelle = chatRoomQuelle.slice(
      chatRoomQuelle.indexOf('const markRoomAsRead = async () => {'),
      chatRoomQuelle.indexOf('const markRoomAsRead = async () => {') + 900
    );
    expect(stelle).toContain('await badgeMarkRoomAsRead(room.id)');
    expect(stelle).toContain('await refreshAllCounts()');
    // Reihenfolge: erst verbuchen, dann nachladen.
    expect(stelle.indexOf('await badgeMarkRoomAsRead'))
      .toBeLessThan(stelle.indexOf('await refreshAllCounts'));
  });

  it('refreshAllCounts setzt den Zaehler weiterhin hart auf den Serverwert', () => {
    // Das ist ABSICHT und der Grund, warum die Reihenfolge stimmen muss:
    // Der Server ist die Wahrheit. Wuerde hier relativ gerechnet, koennten
    // sich Fehler aufsummieren. Der Test haelt fest, dass diese Eigenschaft
    // bewusst so ist -- wer sie aendert, muss den Wettlauf neu durchdenken.
    expect(badgeQuelle).toContain('setChatUnreadTotal(totalUnread)');
  });

  it('der Offline-Weg bleibt fire-and-forget', () => {
    // Ohne Netz kann nicht gewartet werden; die Warteschlange holt es nach.
    expect(badgeQuelle).toContain("label: 'Mark-Read'");
    expect(badgeQuelle).toMatch(/if \(!networkMonitor\.isOnline\)/);
  });
});
