import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { aktuelleTermine, zuVerbuchendeTermine, vergangeneTermine } from '../../components/shared/eventFormatting';

// Bugreport 15.09.2026 (Leitung): Ein abgesagter Termin verschwand nach
// seinem Datum aus ALLEN drei Reitern der Terminliste — dauerhaft.
//
// Ursache: "Vergangen" mischte die abgesagten Termine zwar dazu, legte den
// Filter `!hasPendingBookings` danach aber ueber die GESAMTE Liste. Eine
// Absage laesst die Buchungen jedoch auf 'confirmed' stehen
// (backend/services/backgroundService.js) — der abgesagte Termin behaelt
// also seinen pending_bookings_count und fiel hier heraus. Gleichzeitig
// schliesst "Verbuchen" abgesagte bewusst aus und "Aktuell" laesst sie nach
// dem Enddatum los. Ergebnis: kein Reiter zeigte ihn mehr.

// Fester "Jetzt"-Zeitpunkt, damit die Reiter reproduzierbar rechnen.
const JETZT = new Date('2026-09-15T12:00:00+02:00');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(JETZT);
});

afterAll(() => {
  vi.useRealTimers();
});

interface Termin {
  id: number;
  event_date: string;
  event_end_time?: string | null;
  pending_bookings_count?: number;
  registration_status?: string;
}

// Der gemeldete Fall: abgesagt, Datum vorbei, Buchungen noch auf 'confirmed'.
const abgesagtVergangen: Termin = {
  id: 1,
  event_date: '2026-09-10T18:00:00+02:00',
  event_end_time: null,
  pending_bookings_count: 7,
  registration_status: 'cancelled'
};

// Derselbe Termin, nur noch in der Zukunft.
const abgesagtZukuenftig: Termin = {
  id: 2,
  event_date: '2026-09-20T18:00:00+02:00',
  event_end_time: null,
  pending_bookings_count: 7,
  registration_status: 'cancelled'
};

// Regressionsfall: NICHT abgesagt, vorbei, offene Buchungen -> "Verbuchen".
const offenVergangenUnverbucht: Termin = {
  id: 3,
  event_date: '2026-09-11T18:00:00+02:00',
  event_end_time: null,
  pending_bookings_count: 4,
  registration_status: 'open'
};

// Fertig verbucht, vorbei -> "Vergangen".
const offenVergangenVerbucht: Termin = {
  id: 4,
  event_date: '2026-09-12T18:00:00+02:00',
  event_end_time: null,
  pending_bookings_count: 0,
  registration_status: 'open'
};

// Noch bevorstehend -> "Aktuell".
const offenZukuenftig: Termin = {
  id: 5,
  event_date: '2026-09-25T18:00:00+02:00',
  event_end_time: null,
  pending_bookings_count: 0,
  registration_status: 'open'
};

// So liefert die Seite die beiden Mengen: `offen` aus GET /events (ohne
// abgesagte), `abgesagt` aus GET /events/cancelled.
const offen = [offenVergangenUnverbucht, offenVergangenVerbucht, offenZukuenftig];
const abgesagt = [abgesagtVergangen, abgesagtZukuenftig];

const ids = (liste: Termin[]) => liste.map(e => e.id);

describe('Abgesagte Termine bleiben in der Leitungs-Terminliste sichtbar', () => {
  it('zeigt einen vergangenen abgesagten Termin MIT offenen Buchungen unter "Vergangen"', () => {
    expect(ids(vergangeneTermine(offen, abgesagt))).toContain(abgesagtVergangen.id);
  });

  it('zeigt ihn NICHT unter "Verbuchen" — an einem abgesagten Termin gibt es nichts zu verbuchen', () => {
    expect(ids(zuVerbuchendeTermine(offen))).not.toContain(abgesagtVergangen.id);
    expect(ids(zuVerbuchendeTermine(offen))).toEqual([offenVergangenUnverbucht.id]);
  });

  it('zeigt ihn NICHT mehr unter "Aktuell", sein Datum ist vorbei', () => {
    expect(ids(aktuelleTermine(offen, abgesagt))).not.toContain(abgesagtVergangen.id);
  });

  it('zeigt einen zukuenftigen abgesagten Termin unter "Aktuell"', () => {
    expect(ids(aktuelleTermine(offen, abgesagt))).toEqual([abgesagtZukuenftig.id, offenZukuenftig.id]);
  });

  it('zeigt den zukuenftigen abgesagten Termin NICHT unter "Vergangen"', () => {
    expect(ids(vergangeneTermine(offen, abgesagt))).not.toContain(abgesagtZukuenftig.id);
  });

  it('fuehrt jeden Termin genau einmal — keine Duplikate', () => {
    const alle = [
      ...ids(aktuelleTermine(offen, abgesagt)),
      ...ids(zuVerbuchendeTermine(offen)),
      ...ids(vergangeneTermine(offen, abgesagt))
    ];
    expect(alle.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(alle).size).toBe(alle.length);
  });

  it('laesst keinen Termin in gar keinem Reiter zurueck', () => {
    const gezeigt = new Set([
      ...ids(aktuelleTermine(offen, abgesagt)),
      ...ids(zuVerbuchendeTermine(offen)),
      ...ids(vergangeneTermine(offen, abgesagt))
    ]);
    for (const termin of [...offen, ...abgesagt]) {
      expect(gezeigt.has(termin.id)).toBe(true);
    }
  });
});

describe('Die uebrigen Reiter bleiben unveraendert (Regression)', () => {
  it('haelt einen vergangenen, nicht abgesagten Termin mit offenen Buchungen in "Verbuchen"', () => {
    expect(ids(zuVerbuchendeTermine(offen))).toContain(offenVergangenUnverbucht.id);
  });

  it('haelt ihn aus "Vergangen" heraus, solange Buchungen offen sind', () => {
    expect(ids(vergangeneTermine(offen, abgesagt))).not.toContain(offenVergangenUnverbucht.id);
  });

  it('zeigt den fertig verbuchten vergangenen Termin unter "Vergangen"', () => {
    expect(ids(vergangeneTermine(offen, abgesagt))).toContain(offenVergangenVerbucht.id);
  });

  it('sortiert "Vergangen" absteigend, das Juengste zuerst', () => {
    // 12.09. (fertig verbucht) vor 10.09. (abgesagt)
    expect(ids(vergangeneTermine(offen, abgesagt))).toEqual([
      offenVergangenVerbucht.id,
      abgesagtVergangen.id
    ]);
  });

  it('nimmt bei mehrtaegigen abgesagten Terminen das ENDE als Stichzeit', () => {
    // Freizeit 10.-20.09., abgesagt: laeuft am 15.09. noch -> "Aktuell".
    const laufendAbgesagt: Termin = {
      id: 9,
      event_date: '2026-09-10T09:00:00+02:00',
      event_end_time: '2026-09-20T16:00:00+02:00',
      pending_bookings_count: 3,
      registration_status: 'cancelled'
    };
    expect(ids(aktuelleTermine([], [laufendAbgesagt]))).toEqual([9]);
    expect(ids(vergangeneTermine([], [laufendAbgesagt]))).toEqual([]);
  });
});
