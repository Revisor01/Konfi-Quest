// Die EINE Eventliste der Personenseite (components/admin/web/leitung/
// eventListe.ts; Simon, 13.10.2026: „das soll eine liste sein"): Ordnung,
// Stand und die drei Quellen (alleTermine, Rueckfall termine + Event-Punkte,
// Teamer:in). Gerendert geprueft in webKonfiDetailInterview.test.tsx.
import { describe, it, expect } from 'vitest';
import {
  eventStand,
  eventZeilenOrdnen,
  konfiEventZeilen,
  teamerEventZeilen,
  type EventZeile,
} from '../../../components/admin/web/leitung/eventListe';
import { personTerminStand, type PersonTermin } from '../../../components/admin/views/KonfiDetailSections';
import { teilnahmeDarstellung } from '../../../utils/teilnahmeStatus';

const JETZT = Date.parse('2026-10-13T12:00:00Z');
const zeile = (name: string, art: EventZeile['art'], datum: string): EventZeile => ({
  schluessel: name, event_id: 0, name, datum, pflicht: false, konfirmation: false, abgesagt: false, art,
  booking_status: 'confirmed', attendance_status: null, punkte: 0, punkteArt: null, von: null, termin: null, oeffnen: true,
});
const termin = (event_id: number, art: PersonTermin['art'], zusatz: Partial<PersonTermin> = {}): PersonTermin => ({
  booking_id: event_id + 500, event_id, event_name: `Termin ${event_id}`, event_date: '2026-10-01T09:00:00Z',
  booking_status: 'confirmed', art, darf_verbuchen: true, ...zusatz,
});

describe('Ordnung', () => {
  it('zu verbuchen (neueste zuerst), anstehend (naechste zuerst), dann der Rest (neueste zuerst)', () => {
    const geordnet = eventZeilenOrdnen([
      zeile('alt erledigt', 'erledigt', '2026-08-01'),
      zeile('spaet anstehend', 'anstehend', '2026-12-01'),
      zeile('alt offen', 'verbuchen', '2026-09-01'),
      zeile('neu erledigt', 'erledigt', '2026-10-01'),
      zeile('bald anstehend', 'anstehend', '2026-10-20'),
      zeile('neu offen', 'verbuchen', '2026-10-10'),
    ]);
    expect(geordnet.map((z) => z.name)).toEqual([
      'neu offen', 'alt offen', 'bald anstehend', 'spaet anstehend', 'neu erledigt', 'alt erledigt',
    ]);
  });
});

// Pruefung 13.10.2026: Die Woerter kommen aus den vorhandenen Regeln --
// offene und anstehende Buchungen wie in der App (personTerminStand),
// alles andere wie in der Teilnehmerliste (teilnahmeDarstellung). Vorher
// eigene, kuerzere Woerter ("Ausstehend", "Entschuldigt"): dieselbe Buchung
// hiess im Browser anders als in der App.
describe('Stand', () => {
  const stand = (z: Partial<EventZeile>) => eventStand({ abgesagt: false, art: 'erledigt', booking_status: 'confirmed', attendance_status: null, ...z });
  it.each([
    [{ abgesagt: true, attendance_status: 'excused' }, 'Abgesagt', 'fehler'],
    [{ art: 'verbuchen' as const }, 'Anwesenheit ausstehend', 'warnung'],
    [{ art: 'anstehend' as const }, 'Angemeldet', 'info'],
    [{ art: 'anstehend' as const, booking_status: 'waitlist' }, 'Warteliste', 'warnung'],
    [{ art: 'anstehend' as const, booking_status: 'pending' }, 'Warteliste', 'warnung'],
    [{ attendance_status: 'present' }, 'Anwesend', 'erfolg'],
    [{ attendance_status: 'absent' }, 'Abwesend', 'fehler'],
    [{ attendance_status: 'excused' }, 'Abgemeldet (nachgetragen)', 'neutral'],
    [{ booking_status: 'opted_out' }, 'Abgemeldet', 'fehler'],
    [{ booking_status: 'waitlist' }, 'Warteliste', 'warnung'],
    [{}, 'Gebucht', 'info'],
    [{ booking_status: null }, 'Anwesend', 'erfolg'],
  ])('%o -> %s', (z, text, ton) => {
    expect(stand(z)).toEqual({ text, ton });
  });

  it('offen und anstehend: dasselbe Wort wie die App (personTerminStand), der Rest wie die Teilnehmerliste', () => {
    for (const [art, booking_status] of [['verbuchen', 'confirmed'], ['anstehend', 'confirmed'], ['anstehend', 'waitlist'], ['anstehend', 'pending']] as const) {
      expect(stand({ art, booking_status }).text).toBe(personTerminStand({ art, booking_status }));
    }
    for (const [booking_status, attendance_status] of [['confirmed', 'present'], ['confirmed', 'absent'], ['confirmed', 'excused'], ['opted_out', null], ['excused', null], ['waitlist', null]] as const) {
      expect(stand({ booking_status, attendance_status }).text).toBe(teilnahmeDarstellung({ status: booking_status, attendance_status }).statusText);
    }
  });
});

describe('Quellen', () => {
  it('Konfi ohne alleTermine: termine oben, Event-Punkte darunter, kein Termin doppelt', () => {
    const z = konfiEventZeilen(undefined, [termin(41, 'verbuchen'), termin(42, 'anstehend', { event_date: '2026-11-11T17:00:00Z' })], [
      { id: 1, event_id: 9, points: 2, point_type: 'gemeinde', event_name: 'Wochenende', event_date: '2026-09-04', admin_name: 'Alex' },
      // Derselbe Termin wie oben (kann es nicht geben, darf aber nicht doppelt stehen).
      { id: 2, event_id: 41, points: 1, point_type: 'gemeinde', event_name: 'Termin 41', event_date: '2026-10-01' },
    ]);
    expect(z.map((e) => [e.name, e.art, e.punkte, e.termin?.booking_id ?? null])).toEqual([
      ['Termin 41', 'verbuchen', 0, 541],
      ['Termin 42', 'anstehend', 0, 542],
      ['Wochenende', 'erledigt', 2, null],
    ]);
  });

  it('Konfi mit alleTermine: darf_oeffnen entscheidet den Link, fehlt es (Stand davor), bleibt er', () => {
    const eintrag = {
      booking_id: null, event_id: 9, event_name: 'Alter Jahrgang', event_date: '2026-05-01T09:00:00Z',
      mandatory: false, booking_status: null, attendance_status: null, art: 'erledigt' as const,
      darf_verbuchen: false, points: 2, point_type: 'gemeinde',
    };
    expect(konfiEventZeilen([{ ...eintrag, darf_oeffnen: false }], [], [])[0].oeffnen).toBe(false);
    expect(konfiEventZeilen([{ ...eintrag, darf_oeffnen: true }], [], [])[0].oeffnen).toBe(true);
    expect(konfiEventZeilen([eintrag], [], [])[0].oeffnen).toBe(true);
  });

  it('Konfi mit alleTermine (auch leer): nur daraus, die Event-Punkte bleiben aussen vor', () => {
    expect(konfiEventZeilen([], [termin(41, 'verbuchen')], [
      { id: 1, event_id: 9, points: 2, point_type: 'gemeinde', event_name: 'Wochenende', event_date: '2026-09-04' },
    ])).toEqual([]);
  });

  it('Teamer:in: Art aus termine, sonst kuenftig = anstehend; ein Termin nur in termine steht trotzdem da', () => {
    const z = teamerEventZeilen([
      { id: 1, name: 'Vergangen offen', event_date: '2026-10-03', location: '', teamer_only: false, teamer_needed: true, booking_status: 'confirmed', booking_date: '', attendance_status: null },
      { id: 2, name: 'Kuenftig', event_date: '2026-10-20', location: '', teamer_only: true, teamer_needed: false, booking_status: 'confirmed', booking_date: '', attendance_status: null },
      { id: 3, name: 'Vergangen ohne Recht', event_date: '2026-09-03', location: '', teamer_only: false, teamer_needed: true, booking_status: 'confirmed', booking_date: '', attendance_status: null },
    ], [termin(1, 'verbuchen'), termin(7, 'anstehend', { event_name: 'Nur in termine', event_date: '2026-11-01T10:00:00Z' })], JETZT);
    expect(z.map((e) => [e.name, e.art, eventStand(e).text, e.termin?.booking_id ?? null])).toEqual([
      ['Vergangen offen', 'verbuchen', 'Anwesenheit ausstehend', 501],
      ['Kuenftig', 'anstehend', 'Angemeldet', null],
      ['Nur in termine', 'anstehend', 'Angemeldet', 507],
      ['Vergangen ohne Recht', 'erledigt', 'Gebucht', null],
    ]);
  });
});
