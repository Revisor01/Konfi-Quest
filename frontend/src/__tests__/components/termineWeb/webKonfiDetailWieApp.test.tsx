// Die Web-Fassung des Konfi-Details rechnet NEU, was die Detailansicht der App
// inline rechnet: den Status im Kopf, die Zeilen der Angaben und die Karte
// "Bist du dabei?" (utils/termineWeb.ts: konfiDetailStatus, terminAngaben,
// konfiAnmeldeZustand). Dieser Test rendert die ECHTE App-Ansicht für eine
// Matrix aus Zeit, Anmeldeart, Buchung, Anwesenheit, Konfirmation, Absage und
// Netz und vergleicht, was sie zeigt, mit dem, was die Web-Fassung rechnet --
// damit eine Änderung an nur einer Stelle auffällt.
import { describe, it, expect, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne, inTagen } from '../gerueste/konfiTerminDetail';
import { konfiAnmeldeZustand, konfiDetailStatus, terminAngaben } from '../../../utils/termineWeb';
import type { Event } from '../../../types/event';

beforeEach(() => {
  zuruecksetzen();
});

const norm = (t: string | null | undefined) => (t ?? '').replace(/∞/g, '').replace(/\s+/g, ' ').trim();

/** Die Zeilen der Karte "Details" der App: Bezeichnung und Werte (der Absage-Kasten darüber hat eigene Zeilen). */
const zeilenDerApp = (container: HTMLElement) => {
  const titel = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Details')!;
  return [...titel.closest('section')!.querySelectorAll('.app-info-row')];
};
const zeilenAlsWerte = (zeilen: Element[]) => zeilen.map((z) => ({
  label: norm(z.querySelector('.app-info-row__label')?.textContent),
  wert: [...z.querySelectorAll('.app-info-row__value')].map((w) => norm(w.textContent)).join(' | '),
})).filter((z) => z.label !== 'Zeitfenster');
const angabenDerApp = (container: HTMLElement) => zeilenAlsWerte(zeilenDerApp(container));

/** Was in der Karte "Bist du dabei?" der App steht: Hinweise und Knöpfe, ohne Reihenfolge. */
const karteDerApp = (container: HTMLElement) => {
  const titel = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Bist du dabei?')!;
  const karte = titel.closest('section')!;
  const stuecke: string[] = [];
  for (const k of karte.querySelectorAll('button, .app-status-box')) stuecke.push(norm(k.textContent));
  for (const note of karte.querySelectorAll('span')) {
    if (!note.closest('button') && !note.closest('.app-status-box') && note.textContent !== 'Bist du dabei?') stuecke.push(norm(note.textContent));
  }
  return stuecke.filter(Boolean).sort();
};

interface Fall {
  zeit: 'kommend' | 'vorbei'; reg: string; kapazitaet: 'frei' | 'voll' | 'vollMitWarteliste'; canRegister: boolean;
  buchung: string; anwesenheit: string | null; konfirmation: boolean; abgesagt: boolean;
}

const faelle = (): Fall[] => {
  const alle: Fall[] = [];
  for (const zeit of ['kommend', 'vorbei'] as const) {
    for (const buchung of ['keine', 'confirmed', 'waitlist', 'opted_out', 'excused']) {
      for (const anwesenheit of (zeit === 'vorbei' && buchung === 'confirmed' ? [null, 'present', 'absent'] : [null])) {
        for (const abgesagt of [false, true]) {
          // Anmeldeart, Kapazität und Konfirmation hängen nur dort aneinander, wo sie etwas entscheiden.
          const arten: Array<Pick<Fall, 'reg' | 'kapazitaet' | 'canRegister' | 'konfirmation'>> = [
            { reg: 'upcoming', kapazitaet: 'frei', canRegister: false, konfirmation: false },
            { reg: 'closed', kapazitaet: 'frei', canRegister: false, konfirmation: false },
            { reg: 'mandatory', kapazitaet: 'frei', canRegister: false, konfirmation: false },
          ];
          for (const kapazitaet of ['frei', 'voll', 'vollMitWarteliste'] as const) {
            for (const canRegister of [true, false]) {
              for (const konfirmation of [false, true]) arten.push({ reg: 'open', kapazitaet, canRegister, konfirmation });
            }
          }
          for (const a of arten) alle.push({ zeit, buchung, anwesenheit, abgesagt, ...a });
        }
      }
    }
  }
  return alle;
};

/** Drei Ausstattungen: nichts Besonderes -- alles, was die Angaben zeigen können -- mit Punkten für den Gottesdienst. */
const AUSSTATTUNG: Array<Record<string, unknown>> = [
  {},
  {
    location: 'Gemeindegarten', location_maps_url: 'https://example.org/karte', categories: [{ id: 1, name: 'Gemeinde' }, { id: 2, name: 'Fest' }],
    bring_items: 'Sitzkissen', checkin_window: 15, is_series: true, description: 'Grillen im Garten.',
    registration_opens_at: '2026-09-01T08:00:00Z', registration_closes_at: '2026-10-09T08:00:00Z',
  },
  { points: 2, point_type: 'gottesdienst', location: 'Kirche Musterdorf', waitlist_position: 3 },
];

const alsEvent = (f: Fall, nr: number): Event => termin({
  id: 5, name: `Fall ${nr}`,
  event_date: f.zeit === 'kommend' ? inTagen(5) : inTagen(-5),
  registration_status: f.abgesagt ? 'cancelled' : f.reg,
  cancelled: f.abgesagt,
  mandatory: f.reg === 'mandatory',
  is_konfirmation: f.konfirmation,
  can_register: f.canRegister,
  max_participants: 10,
  registered_count: f.kapazitaet === 'frei' ? 3 : 10,
  waitlist_enabled: f.kapazitaet === 'vollMitWarteliste',
  waitlist_count: f.kapazitaet === 'vollMitWarteliste' ? 2 : 0,
  max_waitlist_size: 5,
  is_registered: f.buchung === 'confirmed',
  is_opted_out: f.buchung === 'opted_out',
  booking_status: f.buchung === 'keine' ? null : f.buchung,
  attendance_status: f.anwesenheit,
  abgemeldet_count: f.abgesagt ? 4 : 0,
  points: 0,
  ...AUSSTATTUNG[nr % AUSSTATTUNG.length],
} as Partial<Event>);

const vergleiche = async (events: Event[], online: boolean) => {
  const abweichungen: string[] = [];
  for (const event of events) {
    zustand.online = online;
    const { container } = await oeffne(event);
    const web = {
      status: konfiDetailStatus(event).text,
      angaben: terminAngaben(event, { rolle: 'konfi' }).map((a) => ({ label: a.label, wert: a.zeilen.map(norm).join(' | ') })),
      karte: (() => {
        const z = konfiAnmeldeZustand(event, { online, laeuft: false, hatKonfirmationGebucht: false });
        return [z.hinweis?.text, z.knopf?.text, z.gesperrt?.text].map(norm).filter(Boolean).sort();
      })(),
    };
    const app = {
      status: norm(container.querySelector('.app-header-banner__subtitle')?.textContent),
      angaben: angabenDerApp(container),
      karte: karteDerApp(container),
    };
    // Die Angaben der App tragen "Anmeldung" nicht bei Pflicht-Events, der Ort steht dort als Knopf: beides gleich gerechnet.
    for (const teil of ['status', 'angaben', 'karte'] as const) {
      if (JSON.stringify(app[teil]) !== JSON.stringify(web[teil])) {
        abweichungen.push(`${event.name} (${online ? 'online' : 'offline'}) ${teil}: App ${JSON.stringify(app[teil])} -- Web ${JSON.stringify(web[teil])}`);
      }
    }
    cleanup();
  }
  return abweichungen;
};

describe('Konfi-Detail: Web-Fassung und App rechnen dasselbe', () => {
  const events = faelle().map(alsEvent);

  it('online: Status im Kopf, Angaben und Karte "Bist du dabei?" stimmen für jedes Event', async () => {
    expect(events.length).toBeGreaterThan(300);
    expect(await vergleiche(events, true)).toEqual([]);
  }, 240_000);

  it('offline: Anmelden und Wieder-Anmelden zeigen "Du bist offline", Abmelden "(wird gesendet)" -- wie die App', async () => {
    const kommend = events.filter((e) => new Date(e.event_date) > new Date() && !(e.cancelled));
    expect(kommend.length).toBeGreaterThan(50);
    expect(await vergleiche(kommend, false)).toEqual([]);
  }, 240_000);

  it('die Matrix erreicht alle Knöpfe und Hinweise (sonst bewiese der Vergleich nichts)', () => {
    const woerter = new Set<string>();
    for (const e of events) {
      const z = konfiAnmeldeZustand(e, { online: true, laeuft: false, hatKonfirmationGebucht: false });
      for (const t of [z.hinweis?.text, z.knopf?.text, z.gesperrt?.text]) if (t) woerter.add(t);
    }
    for (const t of [
      'Du bist automatisch angemeldet', 'Abmelden', 'Wieder anmelden', 'Wieder anmelden (Warteliste)', 'Von der Leitung abgemeldet', 'Du hast dich abgemeldet',
      'Dieses Event ist abgesagt', 'Pflicht-Event (vergangen)', 'Pflicht-Event', 'Abmelden geht nur bis 2 Tage vorher', 'Von der Warteliste abmelden',
      'Ausgebucht', 'Anmeldung noch nicht offen', 'Anmeldung geschlossen', 'Nicht verfügbar',
    ]) expect(woerter.has(t)).toBe(true);
    expect([...woerter].some((t) => t.startsWith('Anmelden ('))).toBe(true);
    expect([...woerter].some((t) => t.startsWith('Warteliste offen ('))).toBe(true);
    expect([...woerter].some((t) => t.startsWith('Du stehst auf Platz'))).toBe(true);
  });
});
