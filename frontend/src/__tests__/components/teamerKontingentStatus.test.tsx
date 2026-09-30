// Befund H3 (26.08.2026): Das Teamer-Kontingent wird in der Teamer-Ansicht
// sichtbar -- gerendert (Audit Tests 26.09.2026, BF-02; vorher
// Quelltext-Test, 30.09.2026 umgestellt).
//
// Das Kontingent wurde auf drei Ebenen ignoriert: Das Backend rechnete den
// Anmeldestatus nur mit Konfi-Zahlen, die Statusanzeige der Teamer-Liste
// kannte keinen Zweig für "voll" (ein volles Team-Kontingent stand als
// "Offen" da), und die Karte zeigte keine Wartelisten-Zahl. Folge: Man
// erfuhr erst beim Absenden (400), dass kein Platz mehr ist. Der
// Backend-Teil ist in events.test.js mit echten Daten geprüft.
import { describe, it, expect, beforeEach, expectTypeOf } from 'vitest';
import { within } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffneListe, zeileVon } from './gerueste/teamerTerminSeite';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

/** Der Status an der Listenzeile: das Eck-Badge (Symbol, benannt). */
const statusVon = async (zusatz: Partial<Event>) => {
  zustand.events = [termin({ name: 'Team-Tag', ...zusatz })];
  const { unmount } = await oeffneListe('alle');
  const zeile = zeileVon('Team-Tag');
  const namen = within(zeile).queryAllByRole('img').map((b) => b.getAttribute('aria-label'))
    .concat(within(zeile).queryAllByTitle(/.+/).filter((b) => !b.getAttribute('role')).map((b) => b.getAttribute('title')));
  unmount();
  return namen;
};

describe('Teamer-Kontingent wird in der Teamer-Ansicht sichtbar', () => {
  describe('Statusanzeige', () => {
    it('kennt den Fall "ausgebucht"', async () => {
      expect(await statusVon({ teamer_registration_status: 'closed' })).toContain('Ausgebucht');
    });

    it('kennt den Fall "Warteliste offen"', async () => {
      expect(await statusVon({ teamer_registration_status: 'waitlist' })).toContain('Warteliste offen');
    });

    it('kennt den Fall "noch nicht offen"', async () => {
      expect(await statusVon({ teamer_registration_status: 'upcoming' })).toContain('Noch nicht offen');
    });

    it('meldet "Offen", wenn Platz ist', async () => {
      const status = await statusVon({ teamer_registration_status: 'open' });
      expect(status).toContain('Offen');
      expect(status).not.toContain('Ausgebucht');
    });

    it('prüft den Kontingent-Status NUR, wo man sich anmelden kann: ein reines Konfi-Event bleibt "Nur Info"', async () => {
      const status = await statusVon({ teamer_needed: false, teamer_only: false, teamer_registration_status: 'closed' });
      expect(status).toContain('Nur Info');
      expect(status).not.toContain('Ausgebucht');
    });

    it('auch ein Termin nur fürs Team kennt "ausgebucht"', async () => {
      expect(await statusVon({ teamer_needed: false, teamer_only: true, teamer_registration_status: 'closed' })).toContain('Ausgebucht');
    });
  });

  describe('Karte', () => {
    it('zeigt die Wartelisten-Zahl des Teamer-Kontingents', async () => {
      zustand.events = [termin({ name: 'Team-Tag', teamer_waitlist_count: 2, teamer_max_waitlist_size: 5 })];
      await oeffneListe('alle');
      const eintrag = within(zeileVon('Team-Tag')).getByText(/wartet/);
      expect(eintrag.textContent).toBe('2/5 wartet');
    });

    it('zeigt sie nur, wenn tatsächlich jemand wartet', async () => {
      zustand.events = [termin({ name: 'Team-Tag', teamer_waitlist_count: 0, teamer_max_waitlist_size: 5 })];
      await oeffneListe('alle');
      expect(within(zeileVon('Team-Tag')).queryByText(/wartet/)).toBeNull();
    });
  });

  describe('Typ', () => {
    it('kennt teamer_registration_status mit allen Werten, und das Feld ist optional', () => {
      // Prüft `npm run typecheck:tests` (tsc); zur Laufzeit ohne Wirkung.
      expectTypeOf<Event['teamer_registration_status']>().toEqualTypeOf<
        'none' | 'upcoming' | 'open' | 'waitlist' | 'closed' | 'cancelled' | undefined
      >();
      const ohneFeld: Event = termin();
      delete ohneFeld.teamer_registration_status;
      expect(ohneFeld.teamer_registration_status).toBeUndefined();
    });
  });
});
