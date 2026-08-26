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

describe('Abzeichen-Zaehler gilt auch fuer Teamer:innen', () => {
  describe('MainTabs', () => {
    it('bricht nicht mehr fuer alles ausser Konfis ab', () => {
      // Die alte Zeile war: if (user?.type !== 'konfi') return;
      expect(mainTabs).not.toMatch(/if \(user\?\.type !== 'konfi'\) return;/);
    });

    it('laedt den Zaehler fuer Teamer:innen ueber den eigenen Endpunkt', () => {
      expect(mainTabs).toContain("api.get('/teamer/badges/unseen')");
    });

    it('laedt den Zaehler fuer Konfis weiterhin ueber die Abzeichenliste', () => {
      // Gegenprobe: Der Umbau darf den funktionierenden Fall nicht mitnehmen.
      expect(mainTabs).toContain("api.get('/konfi/badges')");
      expect(mainTabs).toContain("badge.seen");
    });

    it('der Teamer-Reiter zeigt den Zaehler an', () => {
      // Vorher hatte dieser Tab-Button gar kein IonBadge.
      const teamerTab = mainTabs.slice(
        mainTabs.indexOf('tab="teamer-badges"'),
        mainTabs.indexOf('</IonTabBar>', mainTabs.indexOf('tab="teamer-badges"'))
      );
      expect(teamerTab).toContain('newBadgesCount > 0');
      expect(teamerTab).toContain('IonBadge');
    });
  });

  describe('TeamerBadgesPage', () => {
    it('markiert die Abzeichen beim Oeffnen als gesehen', () => {
      expect(teamerBadges).toContain("api.put('/teamer/badges/mark-seen')");
    });

    it('stoesst danach genau die Aktualisierung an, an der der Zaehler haengt', () => {
      // Der Zaehler haengt in MainTabs an useLiveRefresh('badges'), NICHT am
      // BadgeContext. refreshAllCounts() wuerde ihn nicht erreichen und die
      // rote Zahl bliebe nach dem Oeffnen stehen.
      expect(teamerBadges).toContain("triggerRefresh('badges')");
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
});
