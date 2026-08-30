import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund H1 (26.08.2026): Teamer:innen sahen ein neues Abzeichen nie als "neu".
// Das Backend hat die Endpunkte seit jeher (teamer.js:526 unseen, :544
// mark-seen) — im Frontend rief sie NIEMAND auf. Der Zähler-Loader brach für
// alle ausser Konfis sofort ab (`if (user?.type !== 'konfi') return`), der
// Teamer-Badges-Tab hatte gar kein IonBadge. Damit blieb `seen` dauerhaft
// false: die halbe Funktion war tot, obwohl beide Hälften gebaut waren.
//
// Diese Tests lesen die Quelldateien, statt zu rendern: Der Zähler hängt an
// Live-Updates, Netzstatus und geladenen Daten — das zu mocken führte mehr
// Annahmen ein, als der Test absichert. Geprüft wird die Verdrahtung.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const mainTabs = lies('src/components/layout/MainTabs.tsx');
const teamerBadges = lies('src/components/teamer/pages/TeamerBadgesPage.tsx');
const konfiBadges = lies('src/components/konfi/pages/KonfiBadgesPage.tsx');
const badgeContext = lies('src/contexts/BadgeContext.tsx');

describe('Abzeichen-Zaehler gilt auch fuer Teamer:innen', () => {
  describe('MainTabs', () => {
    it('holt den Zaehler aus dem BadgeContext statt selbst zu laden', () => {
      // Seit der Konsolidierung (27.08.2026) kommen ALLE fuenf Zahlen aus einer
      // Quelle. Vorher war newBadgesCount die Ausnahme mit eigenem Abruf.
      expect(mainTabs).toContain('newBadgesCount } = useBadge()');
      expect(mainTabs).not.toContain("api.get('/teamer/badges/unseen')");
      expect(mainTabs).not.toContain("api.get('/konfi/badges')");
    });

    it('der Teamer-Reiter zeigt den Zaehler an', () => {
      // Vorher hatte dieser Tab-Button gar kein IonBadge. Seit dem Umbau auf
      // die Routen-Konfiguration (30.08.2026) steht die Verdrahtung als
      // `badge: 'badges'` in navigation/rollenBaeume.ts; der eine Renderer in
      // MainTabs macht daraus fuer JEDE Rolle ein IonBadge — die frueher
      // moegliche Luecke, dass ein Tab den Zaehler vergisst, gibt es nicht mehr.
      const baeume = lies('src/navigation/rollenBaeume.ts');
      const zeile = baeume.split('\n').find(z => z.includes("tab: 'teamer-badges'")) || '';
      expect(zeile).toContain("badge: 'badges'");
      expect(mainTabs).toContain('<IonBadge color="danger">');
    });
  });

  describe('TeamerBadgesPage', () => {
    it('markiert die Abzeichen beim Oeffnen als gesehen', () => {
      expect(teamerBadges).toContain("api.put('/teamer/badges/mark-seen')");
    });

    it('stoesst danach die Aktualisierung an', () => {
      // Seit der Konsolidierung ist refreshAllCounts() der richtige Weg --
      // vorher brauchte es triggerRefresh('badges'), weil der Zaehler als
      // einziger an einem anderen Mechanismus hing.
      expect(teamerBadges).toContain('refreshAllCounts()');
    });

    it('markiert nur einmal, nicht bei jedem Neuladen', () => {
      // Ohne den Ref loeste jedes Live-Update und jedes Pull-to-Refresh einen
      // weiteren Aufruf aus.
      expect(teamerBadges).toContain('bereitsMarkiert');
    });

    it('reiht den Aufruf offline in die Warteschlange ein', () => {
      // Sonst ginge die Markierung offline still verloren und der Zaehler
      // bliebe stehen, bis jemand die Seite online erneut oeffnet.
      expect(teamerBadges).toContain('writeQueue.enqueue');
      expect(teamerBadges).toContain("url: '/teamer/badges/mark-seen'");
    });
  });

  // Befund B1 (27.08.2026): Der KONFI-Zaehler setzte sich in laufender Sitzung
  // nie zurueck. mark-seen lief, aber danach stiess niemand eine
  // Aktualisierung an -- kaputt seit dem 03.07.2026, als das 60-Sekunden-
  // Polling wegfiel. Der neue Teamer-Weg machte es richtig, die alte
  // Konfi-Seite wurde nicht nachgezogen: derselbe Drei-Ansichten-Fall.
  describe('B1: der Konfi-Zaehler setzt sich zurueck', () => {
    it('die Konfi-Seite aktualisiert nach mark-seen', () => {
      expect(konfiBadges).toContain('refreshAllCounts()');
    });

    it('beide Rollen nutzen denselben Weg', () => {
      // Der Kern der Konsolidierung: kein Sonderweg mehr je Baum.
      expect(konfiBadges).toContain('useBadge');
      expect(teamerBadges).toContain('useBadge');
    });
  });

  describe('Konsolidierung im BadgeContext', () => {
    it('newBadgesCount kommt aus badge-counts', () => {
      expect(badgeContext).toContain('data?.newBadges');
      expect(badgeContext).toContain('newBadgesCount');
    });

    it('das App-Icon zaehlt die Abzeichen mit', () => {
      // Befund B2a: Vorher fehlten sie in totalBadgeCount -- das Icon stimmte
      // nie mit der Summe der Reiter ueberein.
      const summe = badgeContext.slice(
        badgeContext.indexOf('const totalBadgeCount'),
        badgeContext.indexOf('}, [chatUnreadTotal')
      );
      expect(summe).toContain('newBadgesCount');
    });

    it('beim Abmelden wird auch dieser Zaehler geleert', () => {
      expect(badgeContext).toContain('setNewBadgesCount(0)');
    });
  });
});
