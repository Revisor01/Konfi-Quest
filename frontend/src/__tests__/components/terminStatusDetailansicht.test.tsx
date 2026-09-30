// Anmeldestatus in der Leitungs-Detailansicht (Befund 06.09.2026) --
// gerendert (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test,
// 30.09.2026 umgestellt).
//
// Prod-Event 130 "Teamerfreizeit", Org 1: Ein offener Termin stand in der
// Leitungs-Detailansicht als "Geschlossen". Zwei Stellen spielten zusammen:
//   Backend  -- GET /events/:id lieferte kein registration_status.
//   Frontend -- getStatusText() fiel bei fehlendem Wert bis zum
//               abschließenden `return 'Geschlossen'` durch.
//
// Die Backend-Hälfte prüfen backend/tests/routes/events.test.js ("Detail und
// Liste sind sich beim selben Termin einig", "Nur-Team-Termin ohne Fristen
// und ohne Kapazität meldet open") und terminAnmeldeStatus.test.js am echten
// Endpunkt. Bis 30.09.2026 las dieser Frontend-Test zusätzlich den
// Backend-Quelltext und prüfte die Statuskette an einer NACHGEBAUTEN Kopie
// -- die in einem Punkt schon von der Ansicht abwich (die Kopie sagte
// "Pflichttermin", die Ansicht sagt "Pflicht-Event"). Jetzt wird die echte
// Ansicht gerendert und ihr Statustext gelesen.
import { describe, it, expect, beforeEach } from 'vitest';
import { zustand, zuruecksetzen, termin, oeffne, statusText } from './gerueste/leitungTerminDetail';

beforeEach(zuruecksetzen);

const status = async (zusatz: Record<string, unknown>) => {
  zuruecksetzen();
  zustand.detail = termin({ participants: [], registered_count: 0, ...zusatz });
  const { unmount } = await oeffne();
  const text = statusText();
  unmount();
  return text;
};

const TEAMERFREIZEIT = {
  registration_status: 'open', teamer_registration_status: 'open', teamer_only: true,
  mandatory: false, max_participants: 0, registered_count: 0, waitlist_enabled: false,
};

describe('Statustext der Detailansicht', () => {
  it('Teamerfreizeit ohne Fristen und ohne Kapazität steht auf "Offen"', async () => {
    expect(await status(TEAMERFREIZEIT)).toBe('Offen');
  });

  it('ohne Status vom Backend wird nichts behauptet -- "Event" statt "Geschlossen"', async () => {
    expect(await status({ ...TEAMERFREIZEIT, registration_status: undefined, teamer_registration_status: undefined })).toBe('Event');
  });

  it('volles Teamer-Kontingent mit Warteliste bleibt anmeldbar: "Offen"', async () => {
    expect(await status({ ...TEAMERFREIZEIT, teamer_registration_status: 'waitlist' })).toBe('Offen');
  });

  it('geschlossenes Teamer-Kontingent meldet "Geschlossen"', async () => {
    expect(await status({ ...TEAMERFREIZEIT, teamer_registration_status: 'closed' })).toBe('Geschlossen');
  });

  it('bei Team-Terminen zählt das Teamer-Kontingent, der Konfi-Status schlägt nicht durch', async () => {
    expect(await status({
      registration_status: 'closed', teamer_registration_status: 'open', teamer_needed: true, max_participants: 0,
    })).toBe('Offen');
  });

  it('reiner Konfi-Termin nutzt weiter den Konfi-Status', async () => {
    expect(await status({
      registration_status: 'closed', teamer_registration_status: 'none', teamer_only: false, teamer_needed: false, max_participants: 0,
    })).toBe('Geschlossen');
  });

  it('ein wirklich geschlossener Termin sagt das weiterhin', async () => {
    expect(await status({ registration_status: 'closed', max_participants: 0 })).toBe('Geschlossen');
  });

  it('Pflichttermin, Ausgebucht und Warteliste bleiben unverändert', async () => {
    expect(await status({ registration_status: 'mandatory', max_participants: 0 })).toBe('Pflicht-Event');
    expect(await status({ registration_status: 'open', max_participants: 5, registered_count: 5 })).toBe('Ausgebucht');
    expect(await status({ registration_status: 'open', max_participants: 5, registered_count: 5, waitlist_enabled: true })).toBe('Warteliste');
  });

  it('noch nicht offen: "Bald"', async () => {
    expect(await status({ registration_status: 'upcoming', max_participants: 0 })).toBe('Bald');
  });
});
