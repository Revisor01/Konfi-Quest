// Befund H1 (26.08.2026): Teamer:innen sahen ein neues Abzeichen nie als "neu".
// Das Backend hat die Endpunkte seit jeher (unseen, mark-seen) -- im Frontend
// rief sie NIEMAND auf. Der Zaehler-Loader brach fuer alle ausser Konfis
// sofort ab, der Teamer-Badges-Tab hatte gar kein IonBadge. Damit blieb
// `seen` dauerhaft false: die halbe Funktion war tot, obwohl beide Haelften
// gebaut waren.
//
// Befund B1 (27.08.2026): Der KONFI-Zaehler setzte sich in laufender Sitzung
// nie zurueck. mark-seen lief, aber danach stiess niemand eine
// Aktualisierung an.
//
// Seit 09.10.2026 gerendert statt am Quelltext (Geruest
// gerueste/reiterLeiste.tsx): echter BadgeProvider, echte Zaehler-Rechnung,
// echte Reiterleiste und echte Badge-Seiten; nachgestellt sind nur Server,
// Netz und Warteschlange. Geprueft wird die ganze Kette -- vom Feld
// newBadges in GET /notifications/badge-counts bis zur roten Zahl am Reiter,
// und vom Oeffnen der Seite ueber mark-seen bis zum erneuten Abruf der Zahlen.
import {
  zustand, api, enqueue, kontext, KONFI, TEAMER, LEITUNG, zaehlerAntwort, zuruecksetzen,
  mitZaehlern, zeigeReiter, zaehlerAbrufe,
} from './gerueste/reiterLeiste';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { cleanup, act } from '@testing-library/react';
import TeamerBadgesPage from '../../components/teamer/pages/TeamerBadgesPage';
import KonfiBadgesPage from '../../components/konfi/pages/KonfiBadgesPage';

beforeEach(() => {
  cleanup();
  zuruecksetzen();
});

const teamerAbzeichen = { available: [], earned: [], stats: { totalVisible: 0, totalSecret: 0 } };

describe('Abzeichen-Zaehler gilt auch fuer Teamer:innen', () => {
  describe('Reiterleiste', () => {
    it('holt den Zaehler aus dem BadgeContext statt selbst zu laden', async () => {
      // Seit der Konsolidierung (27.08.2026) kommen ALLE Zahlen aus einer
      // Quelle; vorher war newBadgesCount die Ausnahme mit eigenem Abruf.
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 3 }));
      const reiter = await zeigeReiter('/konfi/dashboard');
      expect(reiter.find((r) => r.tab === 'badges')).toEqual({ tab: 'badges', name: 'Badges', zahl: '3', farbe: 'danger' });
      const pfade = api.get.mock.calls.map(([p]) => p);
      expect(pfade).not.toContain('/konfi/badges');
      expect(pfade).not.toContain('/konfi/badges/v2');
      expect(pfade).not.toContain('/teamer/badges/unseen');
    });

    it('ohne neue Abzeichen steht keine Zahl am Reiter, ab zehn "9+"', async () => {
      const ohne = await zeigeReiter('/konfi/dashboard');
      expect(ohne.find((r) => r.tab === 'badges')?.zahl).toBeNull();
      cleanup();
      zuruecksetzen();
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 12 }));
      const viele = await zeigeReiter('/konfi/dashboard');
      expect(viele.find((r) => r.tab === 'badges')?.zahl).toBe('9+');
    });

    it('der Teamer hat Material statt Badges in der Leiste', async () => {
      // Der Teamer-Reiter "Badges" ist am 04.09.2026 ins Profil gewandert.
      zuruecksetzen(TEAMER);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 2 }));
      const reiter = await zeigeReiter('/teamer/dashboard');
      expect(reiter.map((r) => r.tab)).toContain('teamer-material');
      expect(reiter.map((r) => r.tab)).not.toContain('teamer-badges');
      expect(reiter.some((r) => r.name === 'Badges')).toBe(false);
      // Die Zahl kommt trotzdem an -- sie steht im App-Symbol (siehe unten).
      expect(kontext.aktuell?.newBadgesCount).toBe(2);
    });
  });

  describe('TeamerBadgesPage', () => {
    beforeEach(() => {
      zuruecksetzen(TEAMER);
      zustand.antworten.set('/teamer/badges/v2', teamerAbzeichen);
    });

    it('markiert die Abzeichen beim Oeffnen als gesehen', async () => {
      await mitZaehlern(<TeamerBadgesPage />);
      // POST seit dem 01.09.2026 (vorher PUT) -- dieselbe Handlung wie beim Konfi.
      expect(api.post.mock.calls).toEqual([['/teamer/badges/mark-seen']]);
    });

    it('stoesst danach die Aktualisierung an', async () => {
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 1 }));
      await mitZaehlern(<TeamerBadgesPage />);
      // Erster Abruf beim Anmelden, zweiter nach mark-seen. Der Server meldet
      // jetzt 0 -- genau das muss beim Zaehler ankommen.
      expect(zaehlerAbrufe()).toBe(2);
    });

    it('der Zaehler faellt nach dem Oeffnen auf 0', async () => {
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 1 }));
      api.post.mockImplementationOnce(async () => {
        zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 0 }));
        return { data: {} };
      });
      // Erst angemeldet (Zahl 1 ist da), dann die Seite oeffnen.
      const { neu } = await mitZaehlern(null);
      expect(kontext.aktuell?.newBadgesCount).toBe(1);
      await neu(<TeamerBadgesPage />);
      expect(kontext.aktuell?.newBadgesCount).toBe(0);
    });

    it('markiert nur einmal, nicht bei jedem Neuladen', async () => {
      // Ohne den Merker loeste jedes Live-Update und jedes Neuladen einen
      // weiteren Aufruf aus.
      const { neu } = await mitZaehlern(<TeamerBadgesPage />);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 4 }));
      await act(async () => { await kontext.aktuell!.refreshAllCounts(); });
      // Das Konto kommt frisch vom Server (neues Objekt, gleiche Person) --
      // damit entsteht auch refreshAllCounts neu, und der Effekt der Seite
      // laeuft ein zweites Mal.
      zustand.user = { ...TEAMER };
      await neu();
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('reiht den Aufruf offline in die Warteschlange ein', async () => {
      // Sonst ginge die Markierung offline still verloren und der Zaehler
      // bliebe stehen, bis jemand die Seite online erneut oeffnet.
      zustand.online = false;
      await mitZaehlern(<TeamerBadgesPage />);
      expect(api.post).not.toHaveBeenCalled();
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue.mock.calls[0][0]).toMatchObject({
        method: 'POST', url: '/teamer/badges/mark-seen', hasFileUpload: false,
        metadata: { type: 'fire-and-forget', label: 'Badges gesehen' },
      });
    });
  });

  describe('B1: der Konfi-Zaehler setzt sich zurueck', () => {
    const konfiAbzeichen = {
      available: [],
      earned: [{ id: 5, name: 'Erster Gottesdienst', icon: 'star', criteria_type: 'gottesdienst_points', criteria_value: 1, seen: false }],
      stats: { totalVisible: 1, totalSecret: 0 },
    };

    it('die Konfi-Seite aktualisiert nach mark-seen', async () => {
      zuruecksetzen(KONFI);
      zustand.antworten.set('/konfi/badges/v2', konfiAbzeichen);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 1 }));
      api.post.mockImplementationOnce(async () => {
        zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 0 }));
        return { data: {} };
      });
      const { neu } = await mitZaehlern(null);
      expect(kontext.aktuell?.newBadgesCount).toBe(1);
      await neu(<KonfiBadgesPage />);
      expect(api.post.mock.calls).toEqual([['/konfi/badges/mark-seen']]);
      expect(zaehlerAbrufe()).toBe(2);
      expect(kontext.aktuell?.newBadgesCount).toBe(0);
    });

    it('beide Rollen nutzen denselben Weg: mark-seen, dann refreshAllCounts', async () => {
      // Der Kern der Konsolidierung: kein Sonderweg mehr je Baum. Beide
      // Seiten loesen genau einen weiteren Abruf derselben Zahlen-Route aus.
      zuruecksetzen(KONFI);
      zustand.antworten.set('/konfi/badges/v2', konfiAbzeichen);
      await mitZaehlern(<KonfiBadgesPage />);
      const konfiAbrufe = zaehlerAbrufe();
      cleanup();
      zuruecksetzen(TEAMER);
      zustand.antworten.set('/teamer/badges/v2', teamerAbzeichen);
      await mitZaehlern(<TeamerBadgesPage />);
      expect([konfiAbrufe, zaehlerAbrufe()]).toEqual([2, 2]);
    });
  });

  describe('Konsolidierung im BadgeContext', () => {
    it('newBadgesCount kommt aus badge-counts', async () => {
      zuruecksetzen(TEAMER);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 4 }));
      await mitZaehlern(null);
      expect(kontext.aktuell?.newBadgesCount).toBe(4);
    });

    it('das App-Icon zaehlt die Abzeichen mit (Konfi und Team, nicht die Leitung)', async () => {
      // Befund B2a: Vorher fehlten sie in totalBadgeCount -- das Icon stimmte
      // nie mit der Summe der Reiter ueberein.
      zuruecksetzen(KONFI);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ chat: 2, newBadges: 3 }));
      await mitZaehlern(null);
      expect(kontext.aktuell?.totalBadgeCount).toBe(5);
      cleanup();
      zuruecksetzen(TEAMER);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ chat: 1, newBadges: 2 }));
      await mitZaehlern(null);
      expect(kontext.aktuell?.totalBadgeCount).toBe(3);
      cleanup();
      // Leitung: der Server liefert ihr 0 Abzeichen; ihre Summe sind Chat,
      // Antraege, Termine, Freigaben.
      zuruecksetzen(LEITUNG);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ chat: 1, pendingRequests: 2 }));
      await mitZaehlern(null);
      expect(kontext.aktuell?.totalBadgeCount).toBe(3);
    });

    it('beim Abmelden wird auch dieser Zaehler geleert', async () => {
      zuruecksetzen(TEAMER);
      zustand.antworten.set('/notifications/badge-counts', zaehlerAntwort({ newBadges: 4 }));
      const { neu } = await mitZaehlern(null);
      expect(kontext.aktuell?.newBadgesCount).toBe(4);
      zustand.user = null;
      await neu();
      expect(kontext.aktuell?.newBadgesCount).toBe(0);
    });
  });
});
