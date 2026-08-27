import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund H3 (26.08.2026): Das Teamer-Kontingent wurde auf drei Ebenen
// ignoriert.
//
//   1. Backend: registration_status rechnet ausschliesslich mit Konfi-Zahlen
//      (events.js) — teamer_max_participants floss nirgends ein.
//   2. Frontend-Status: getEventStatusInfo im Teamer-Baum kannte keinen Zweig
//      fuer "voll" — ein volles Team-Kontingent stand als "Offen" da.
//   3. Karte: keine Wartelisten-Zahl, obwohl der Server sie liefert und das
//      Detail sie schon anzeigt. Konfi- und Leitungskarte zeigen sie.
//
// Folge: Man erfuhr erst beim Absenden (400), dass kein Platz mehr ist.
//
// Diese Tests lesen die Quelldatei, statt zu rendern: Die Statusanzeige haengt
// an Termindatum, Buchungsstatus, Anwesenheit und Rolle — das zu mocken fuehrte
// mehr Annahmen ein, als der Test absichert. Der Backend-Teil ist in
// events.test.js mit echten Daten geprueft.

const seite = readFileSync(
  resolve(process.cwd(), 'src/components/teamer/pages/TeamerEventsPage.tsx'),
  'utf8'
);

const typen = readFileSync(resolve(process.cwd(), 'src/types/event.ts'), 'utf8');

describe('Teamer-Kontingent wird in der Teamer-Ansicht sichtbar', () => {
  describe('Statusanzeige', () => {
    it('kennt den Fall "ausgebucht"', () => {
      expect(seite).toContain("event.teamer_registration_status === 'closed'");
      expect(seite).toContain("statusText = 'Ausgebucht'");
    });

    it('kennt den Fall "Warteliste offen"', () => {
      expect(seite).toContain("event.teamer_registration_status === 'waitlist'");
      expect(seite).toContain("statusText = 'Warteliste offen'");
    });

    it('kennt den Fall "noch nicht offen"', () => {
      expect(seite).toContain("event.teamer_registration_status === 'upcoming'");
    });

    it('meldet weiterhin "Offen", wenn Platz ist', () => {
      // Gegenprobe: Der Umbau darf den funktionierenden Fall nicht mitnehmen.
      expect(seite).toContain("statusText = 'Offen'");
    });

    it('prueft den Kontingent-Status NUR, wo man sich anmelden kann', () => {
      // canRegister ist true bei teamer_needed/teamer_only. An reinen
      // Konfi-Terminen darf kein "Ausgebucht" erscheinen — dort gibt es gar
      // kein Teamer-Kontingent (Backend meldet dafuer 'none').
      expect(seite).toContain("canRegister && event.teamer_registration_status === 'closed'");
      expect(seite).toContain("canRegister && event.teamer_registration_status === 'waitlist'");
    });
  });

  describe('Karte', () => {
    it('zeigt die Wartelisten-Zahl des Teamer-Kontingents', () => {
      // Vorher stand sie nur im Detail (Zeile ~843), nicht auf der Karte.
      const kartenBereich = seite.slice(seite.indexOf('app-list-item__meta'));
      expect(kartenBereich).toContain('event.teamer_waitlist_count');
      expect(kartenBereich).toContain('app-icon-color--waitlist');
    });

    it('zeigt sie nur, wenn tatsaechlich jemand wartet', () => {
      // Eine dauerhafte "0 wartet" waere Rauschen.
      expect(seite).toContain('(event.teamer_waitlist_count ?? 0) > 0');
    });
  });

  describe('Typ', () => {
    it('kennt teamer_registration_status mit allen Werten', () => {
      expect(typen).toContain('teamer_registration_status');
      for (const wert of ['none', 'upcoming', 'open', 'waitlist', 'closed', 'cancelled']) {
        expect(typen).toContain(`'${wert}'`);
      }
    });

    it('das Feld ist optional', () => {
      // Aeltere Antworten (vor 27.08.2026) liefern es nicht — der Code muss
      // damit umgehen, statt "undefined" als "ausgebucht" zu deuten.
      expect(typen).toMatch(/teamer_registration_status\?:/);
    });
  });
});
