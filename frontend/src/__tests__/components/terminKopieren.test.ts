// Termin kopieren (Simons Wunsch vom 17.09.2026)
//
//   "termin kopieren übernimmt alles, aber nicht material und nicht den chat.
//    und nicht die anderen dingen. kopieren eröffnet ein modal mit allem
//    voreingetragen."
//   "es wird ja nur das modal vorausgefüllt und man kann es dann direkt anlegen."
//   "datum springt so wie bei einem neuen termin gerechnet auf den aktuellen
//    tag. da gibt es doch regeln."
//
// Geprueft wird die Vorbelegung, nicht der Quelltext: kopiereTermin bekommt ein
// Original und liefert das Pseudo-Event fuers Modal. Die feste Uhrzeit ("jetzt")
// wird hereingereicht, damit der Test nicht von der Laufzeit abhaengt.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  kopiereTermin,
  neuerTerminBeginn,
  endeNachDatumswechsel,
} from '../../utils/terminVorbelegung';
import type { Event, Timeslot } from '../../types/event';

// Fester Bezugspunkt: Donnerstag, 17.09.2026, 14:05 Ortszeit.
const JETZT = new Date(2026, 8, 17, 14, 5, 0, 0);

/** Lokaler ISO-String, wie ihn das Formular haelt. */
const lokal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

/** Ein Original, das alles gesetzt hat, was ein Termin haben kann. */
const original = (ueberschreiben: Partial<Event> = {}): Event =>
  ({
    id: 42,
    name: 'Konfi-Freizeit Büsum',
    description: 'Wochenende an der Nordsee',
    event_date: new Date(2026, 8, 4, 17, 0).toISOString(),   // Fr 04.09., 17:00
    event_end_time: new Date(2026, 8, 6, 14, 0).toISOString(), // So 06.09., 14:00
    location: 'Freizeitheim Büsum',
    location_maps_url: 'https://example.invalid/karte',
    points: 3,
    point_type: 'gemeinde',
    type: 'event',
    max_participants: 20,
    registration_opens_at: new Date(2026, 7, 1, 8, 0).toISOString(),
    registration_closes_at: new Date(2026, 8, 3, 17, 0).toISOString(),
    registered_count: 18,
    waitlist_enabled: true,
    max_waitlist_size: 5,
    waitlist_count: 2,
    mandatory: false,
    is_konfirmation: false,
    bring_items: 'Schlafsack, Handtuch',
    checkin_window: 45,
    teamer_needed: true,
    teamer_only: false,
    teamer_max_participants: 4,
    teamer_waitlist_enabled: true,
    teamer_max_waitlist_size: 2,
    teamer_count: 3,
    teamer_waitlist_count: 1,
    abgemeldet_count: 1,
    has_timeslots: false,
    categories: [{ id: 7, name: 'Freizeit' }, { id: 9, name: 'Fahrt' }],
    jahrgaenge: [{ id: 2, name: '2026/27' }],
    ...ueberschreiben,
  }) as Event;

describe('Termin kopieren', () => {
  describe('Was mitkommt', () => {
    it('uebernimmt den Titel unveraendert — kein "Kopie von"', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.name).toBe('Konfi-Freizeit Büsum');
    });

    it('uebernimmt Inhalt, Punkte, Plaetze, Wartelisten und Team-Kontingent', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.description).toBe('Wochenende an der Nordsee');
      expect(event.location).toBe('Freizeitheim Büsum');
      expect(event.bring_items).toBe('Schlafsack, Handtuch');
      expect(event.points).toBe(3);
      expect(event.point_type).toBe('gemeinde');
      expect(event.max_participants).toBe(20);
      expect(event.waitlist_enabled).toBe(true);
      expect(event.max_waitlist_size).toBe(5);
      expect(event.teamer_needed).toBe(true);
      expect(event.teamer_max_participants).toBe(4);
      expect(event.teamer_waitlist_enabled).toBe(true);
      expect(event.teamer_max_waitlist_size).toBe(2);
      expect(event.checkin_window).toBe(45);
    });

    it('uebernimmt Kategorien und Jahrgaenge', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.categories?.map((c) => c.id)).toEqual([7, 9]);
      expect(event.jahrgaenge?.map((j) => j.id)).toEqual([2]);
    });

    it('uebernimmt Pflicht- und Konfirmations-Kennzeichen', () => {
      const { event } = kopiereTermin(
        original({ mandatory: true, is_konfirmation: true }), [], JETZT
      );
      expect(event.mandatory).toBe(true);
      expect(event.is_konfirmation).toBe(true);
    });
  });

  describe('Das Datum springt wie bei einem neuen Termin', () => {
    it('Beginn ist jetzt + 30 Minuten, auf die halbe Stunde gerundet', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      // 14:05 + 30 min = 14:35 -> abgerundet 14:30
      expect(event.event_date).toBe(lokal(new Date(2026, 8, 17, 14, 30)));
      // und genau das, was ein neuer Termin bekaeme
      expect(event.event_date).toBe(lokal(neuerTerminBeginn(JETZT)));
    });

    it('der alte Termin von Anfang September steht nicht mehr drin', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.event_date.startsWith('2026-09-17')).toBe(true);
    });
  });

  describe('Die Dauer des Originals bleibt', () => {
    it('aus einem Wochenende wird wieder ein Wochenende, kein Zwei-Stunden-Termin', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      // Fr 04.09. 17:00 -> So 06.09. 14:00 sind 45 Stunden.
      const beginn = new Date(event.event_date);
      const ende = new Date(event.event_end_time as string);
      expect(ende.getTime() - beginn.getTime()).toBe(45 * 60 * 60 * 1000);
      // Neuer Beginn Do 17.09. 14:30 + 45 h = Sa 19.09. 11:30.
      expect(event.event_end_time).toBe(lokal(new Date(2026, 8, 19, 11, 30)));
    });

    it('ohne Endzeit im Original bleibt sie auch in der Kopie leer', () => {
      const { event } = kopiereTermin(original({ event_end_time: undefined }), [], JETZT);
      expect(event.event_end_time).toBe('');
    });

    it('eine kaputte Endzeit erfindet keine Dauer', () => {
      const { event } = kopiereTermin(original({ event_end_time: 'kein Datum' }), [], JETZT);
      expect(event.event_end_time).toBe('');
    });
  });

  describe('Der Anmeldeschluss wird neu gerechnet, nicht uebernommen', () => {
    it('liegt in der Zukunft — der des Originals lag im September', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      const schluss = new Date(event.registration_closes_at as string);
      expect(schluss.getTime()).toBeGreaterThan(JETZT.getTime());
    });

    it('folgt dem Vorschlag fuer kurzfristige Termine: Mitte zwischen jetzt und Beginn', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      // Beginn 14:30, jetzt 14:05 -> Vorlauf 25 min -> Mitte = 14:17:30,
      // im Formularformat auf die Minute gekappt.
      expect(event.registration_closes_at).toBe(lokal(new Date(2026, 8, 17, 14, 17, 30)));
    });

    it('Anmeldung steht auf "ab sofort", wie beim neuen Termin', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.registration_opens_at).toBe('');
    });
  });

  describe('Was NICHT mitkommt', () => {
    it('id ist 0 — das Signal fuer "neu", es wird nichts ueberschrieben', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.id).toBe(0);
    });

    it('keine Anmeldungen, keine Teilnehmerzahlen', () => {
      const { event } = kopiereTermin(original(), [], JETZT);
      expect(event.registered_count).toBe(0);
      expect(event.waitlist_count).toBe(0);
      expect(event.teamer_count).toBe(0);
      expect(event.teamer_waitlist_count).toBe(0);
      expect(event.abgemeldet_count).toBe(0);
    });

    it('keine eigene Buchung und keine Anwesenheit', () => {
      const { event } = kopiereTermin(
        original({
          is_registered: true,
          booking_status: 'confirmed',
          attendance_status: 'present',
          is_opted_out: true,
        }),
        [],
        JETZT
      );
      expect(event.is_registered).toBe(false);
      expect(event.booking_status).toBe(null);
      expect(event.attendance_status).toBe(null);
      expect(event.is_opted_out).toBe(false);
    });

    it('eine Kopie eines ABGESAGTEN Termins ist nicht abgesagt', () => {
      const { event } = kopiereTermin(
        original({
          cancelled: true,
          cancelled_at: new Date(2026, 8, 1).toISOString(),
          cancelled_reason: 'Sturmflut',
          cancelled_by: 5,
          cancelled_by_name: 'Simon',
        }),
        [],
        JETZT
      );
      expect(event.cancelled).toBe(false);
      expect(event.cancelled_reason).toBe(null);
      expect(event.cancelled_by).toBe(null);
      expect(event.cancelled_by_name).toBe(null);
      expect(event.cancelled_at).toBe(null);
    });

    it('die Kopie eines Serientermins ist ein Einzeltermin', () => {
      const { event } = kopiereTermin(
        original({ is_series: true, series_id: 42 } as Partial<Event>),
        [],
        JETZT
      );
      expect(event.is_series).toBe(false);
      expect(event.series_id).toBeUndefined();
    });
  });

  describe('Zeitfenster kommen mit, auf den neuen Tag geschoben', () => {
    // Original beginnt Fr 04.09. um 17:00; die Slots liegen am Samstag.
    const slots: Timeslot[] = [
      {
        id: 11,
        start_time: new Date(2026, 8, 5, 10, 0).toISOString(),
        end_time: new Date(2026, 8, 5, 12, 0).toISOString(),
        max_participants: 8,
        registered_count: 6,
      },
      {
        id: 12,
        start_time: new Date(2026, 8, 5, 14, 0).toISOString(),
        end_time: new Date(2026, 8, 5, 16, 0).toISOString(),
        max_participants: 8,
        registered_count: 2,
      },
    ];

    it('behalten ihren Abstand zum Beginn', () => {
      const { event, timeslots } = kopiereTermin(original(), slots, JETZT);
      expect(timeslots.length).toBe(2);
      const neuerBeginn = new Date(event.event_date);
      // Slot 1 lag 17 Stunden nach dem Beginn (Fr 17:00 -> Sa 10:00).
      expect(new Date(timeslots[0].start_time).getTime() - neuerBeginn.getTime())
        .toBe(17 * 60 * 60 * 1000);
      // Slot 2 lag 21 Stunden nach dem Beginn.
      expect(new Date(timeslots[1].start_time).getTime() - neuerBeginn.getTime())
        .toBe(21 * 60 * 60 * 1000);
    });

    it('behalten ihre Plaetze, aber nicht ihre Anmeldungen', () => {
      const { timeslots } = kopiereTermin(original(), slots, JETZT);
      expect(timeslots[0].max_participants).toBe(8);
      expect(timeslots[0].id).toBeUndefined();
      expect(timeslots[0].registered_count).toBeUndefined();
    });

    it('ohne Zeitfenster im Original bleibt die Liste leer', () => {
      const { timeslots } = kopiereTermin(original(), [], JETZT);
      expect(timeslots).toEqual([]);
    });
  });
});

// Die Dauer ueberlebt einen Dreh am Datums-Rad (Befund 17.09.2026)
//
// Vorher stand im Picker-Handler `endDate.setHours(+1)`, fest. Wer eine
// Freizeit von Freitag bis Sonntag verschob, hatte danach einen
// Ein-Stunden-Termin -- beim Bearbeiten wie beim Kopieren. Beim Kopieren faellt
// es staerker auf, weil dort fast immer das Datum gedreht wird.
describe('Dauer beim Verschieben des Datums', () => {
  const beginnAlt = '2026-09-04T17:00:00';
  const endeAlt = '2026-09-06T14:00:00'; // 45 Stunden spaeter
  const neuerBeginn = new Date(2026, 9, 2, 9, 0); // Fr 02.10., 09:00

  it('ein Wochenende bleibt ein Wochenende', () => {
    const ende = endeNachDatumswechsel(neuerBeginn, beginnAlt, endeAlt);
    expect(ende.getTime() - neuerBeginn.getTime()).toBe(45 * 60 * 60 * 1000);
    expect(ende).toEqual(new Date(2026, 9, 4, 6, 0)); // So 04.10., 06:00
  });

  it('zwei Stunden bleiben zwei Stunden', () => {
    const ende = endeNachDatumswechsel(neuerBeginn, '2026-09-04T17:00:00', '2026-09-04T19:00:00');
    expect(ende.getTime() - neuerBeginn.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('ohne bisherige Endzeit greift die Voreinstellung von einer Stunde', () => {
    const ende = endeNachDatumswechsel(neuerBeginn, beginnAlt, '');
    expect(ende.getTime() - neuerBeginn.getTime()).toBe(60 * 60 * 1000);
  });

  it('eine Endzeit VOR dem Beginn wird nicht uebernommen', () => {
    // Kaputter Stand: Ende liegt vor dem Beginn. Daraus eine negative Dauer zu
    // rechnen, wuerde den Zustand verschlimmern.
    const ende = endeNachDatumswechsel(neuerBeginn, '2026-09-04T17:00:00', '2026-09-04T15:00:00');
    expect(ende.getTime() - neuerBeginn.getTime()).toBe(60 * 60 * 1000);
  });

  it('unlesbare Zeitangaben fallen auf die eine Stunde zurueck', () => {
    const ende = endeNachDatumswechsel(neuerBeginn, 'kein Datum', 'auch nicht');
    expect(ende.getTime() - neuerBeginn.getTime()).toBe(60 * 60 * 1000);
  });
});

// Speichern einer Kopie darf nicht nach "Verwerfen?" fragen (Befund Simon, 17.09.2026)
//
//   "Ich klicke auf kopieren alles ist richtig da ich drücke auf speichern,
//    Modal Schließer sich und fragt mich ob ich die Änderungen verwerfen will.
//    Als hätte ich das Modal fälschlich geschlossen. [...] Event ist da. Nur die
//    Meldung ist falsch und die Liste aktualisiert dann nicht sofort."
//
// ZWEI FEHLER IN EINEM HANDGRIFF:
//
// 1. DIE RUECKFRAGE. EventModal meldet beim Speichern synchron
//    onDirtyChange(false) und schliesst dann. Mein onSuccess setzte aber
//    setKopierVorlage(null) -- das Modal rendert daraufhin neu, faellt mit
//    event=null in den "neuer Termin"-Zweig, fuellt das Formular frisch und
//    setzt isDirty WIEDER auf true. canDismiss sah also einen dreckigen
//    Stand und fragte nach, obwohl gerade gespeichert wurde.
//    Die Vorlage darf erst weg, wenn das Modal zu ist.
//
// 2. DIE LISTE. Das Bearbeiten-Modal ruft onBack(), und darueber laedt die
//    Terminliste neu. Meine Kopie nahm stattdessen router.push(...) und
//    umging damit genau diesen Weg -- der neue Termin stand nicht da.
describe('Nach dem Speichern einer Kopie', () => {
  const lies = (pfad: string) =>
    readFileSync(resolve(process.cwd(), pfad), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  const detail = lies('src/components/admin/views/EventDetailView.tsx');
  const seite = lies('src/components/admin/pages/AdminEventsPage.tsx');

  /** Der onSuccess-Block des Kopier-Modals. */
  const kopierErfolg = (quelle: string) => {
    const start = quelle.indexOf('presentKopierModal');
    const block = quelle.slice(start, start + 1400);
    const s = block.indexOf('onSuccess:');
    return block.slice(s, block.indexOf('dismiss:', s));
  };

  it('Detailansicht: die Vorlage wird NICHT im selben Zug geleert', () => {
    // setKopierVorlage(null) im onSuccess laesst das Modal neu rendern und
    // macht es wieder "dirty" -- genau das loest die falsche Rueckfrage aus.
    expect(kopierErfolg(detail)).not.toContain('setKopierVorlage(null)');
  });

  it('Detailansicht: zurueck zur Liste ueber onBack, nicht per router.push', () => {
    const erfolg = kopierErfolg(detail);
    expect(erfolg).toContain('onBack()');
    expect(erfolg).not.toContain("router.push('/admin/events'");
  });

  it('Terminliste: dieselbe Falle -- editEvent bleibt beim Schliessen stehen', () => {
    // Dort haengt das Modal an editEvent; bei einer Kopie steht die Vorlage
    // drin. setEditEvent(null) beim Schliessen loest denselben Neu-Render aus.
    const start = seite.indexOf('useIonModal(EventModal');
    const block = seite.slice(start, start + 1200);
    const erfolg = block.slice(block.indexOf('onSuccess:'));
    expect(erfolg).toContain('refreshEvents()');
    expect(erfolg).not.toContain('setEditEvent(null)');
    expect(erfolg).not.toContain('setKopierteTimeslots([])');
  });

  it('Terminliste: "Neuer Termin" erbt keine Zeitfenster einer vorherigen Kopie', () => {
    // Weil beim Schliessen nichts mehr aufgeraeumt wird, muss es beim OEFFNEN
    // passieren -- sonst braechte ein neuer Termin direkt nach einem Kopieren
    // dessen Zeitfenster mit.
    const start = seite.indexOf('const presentEventModal =');
    const block = seite.slice(start, start + 400);
    expect(block).toContain('setKopierteTimeslots([])');
  });
});
