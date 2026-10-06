// Die Web-Fassung des Leitungs-Details rechnet NEU, was die Detailansicht der
// App inline rechnet: den Status im Kopf, die Kacheln (Teilnehmende, Team,
// Warteliste ...) und die Zeilen der Angaben (utils/termineWeb.ts:
// leitungDetailStatus, leitungKennzahlen, terminAngaben). Dieser Test rendert
// dieselbe Ansicht schmal (App) und breit (Web) für eine Matrix aus Zeit,
// Anmeldeart, Absage, Art des Events und Teilnehmenden und vergleicht, was
// beide zeigen.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, teilnahme, oeffne, inTagen } from '../gerueste/leitungTerminDetail';
import { leitungKennzahlen } from '../../../utils/termineWeb';

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));

beforeEach(() => {
  zuruecksetzen();
});

const norm = (t: string | null | undefined) => (t ?? '').replace(/∞/g, '').replace(/\s+/g, ' ').trim();

const TEILNEHMENDE: Record<string, Array<ReturnType<typeof teilnahme>>> = {
  niemand: [],
  konfis: [
    teilnahme(1, 'Kim Konfi'),
    teilnahme(2, 'Mia Muster', { attendance_status: 'present' }),
    teilnahme(3, 'Ben Beispiel', { attendance_status: 'absent' }),
    teilnahme(4, 'Wiebke Warte', { status: 'waitlist' }),
    teilnahme(5, 'Otto Offen', { status: 'opted_out' }),
    teilnahme(6, 'Eva Entschuldigt', { status: 'confirmed', attendance_status: 'excused' }),
  ],
  konfisUndTeam: [
    teilnahme(1, 'Kim Konfi'),
    teilnahme(2, 'Mia Muster', { attendance_status: 'present' }),
    teilnahme(7, 'Tim Teamer', { role_name: 'teamer' }),
    teilnahme(8, 'Tina Team', { role_name: 'teamer', attendance_status: 'present' }),
    teilnahme(9, 'Toni Team', { role_name: 'teamer', status: 'waitlist' }),
  ],
};

const alsEvent = (nr: number, f: { zeit: string; reg: string; abgesagt: boolean; art: string; tn: string; kapazitaet: string }) => termin({
  id: 7, name: `Fall ${nr}`,
  event_date: f.zeit === 'kommend' ? inTagen(5) : inTagen(-5),
  registration_status: f.abgesagt ? 'cancelled' : f.reg,
  cancelled: f.abgesagt,
  mandatory: f.reg === 'mandatory',
  teamer_needed: f.art !== 'nurKonfis',
  teamer_only: f.art === 'nurTeam',
  teamer_max_participants: nr % 2 ? 4 : 0,
  max_participants: f.kapazitaet === 'unbegrenzt' ? 0 : 6,
  registered_count: f.kapazitaet.startsWith('voll') ? 6 : 2,
  waitlist_enabled: f.kapazitaet === 'voll',
  pending_bookings_count: f.zeit === 'vorbei' && f.tn !== 'niemand' ? 2 : 0,
  points: nr % 3 === 0 ? 0 : 2,
  location: nr % 2 ? 'Gemeindehaus' : '',
  bring_items: nr % 4 === 0 ? 'Schlafsack' : '',
  checkin_window: nr % 5 === 0 ? 15 : 0,
  is_konfirmation: nr % 7 === 0,
  participants: TEILNEHMENDE[f.tn],
  unregistrations: [],
});

const faelle = () => {
  const alle: Array<ReturnType<typeof alsEvent>> = [];
  let nr = 0;
  for (const zeit of ['kommend', 'vorbei']) {
    for (const reg of ['open', 'upcoming', 'closed', 'mandatory']) {
      for (const abgesagt of [false, true]) {
        for (const art of ['nurKonfis', 'teamGesucht', 'nurTeam']) {
          for (const tn of Object.keys(TEILNEHMENDE)) {
            for (const kapazitaet of ['frei', 'voll', 'vollOhneWarteliste', 'unbegrenzt']) {
              nr += 1;
              alle.push(alsEvent(nr, { zeit, reg, abgesagt, art, tn, kapazitaet }));
            }
          }
        }
      }
    }
  }
  return alle;
};

const angabenApp = () => {
  const titel = [...document.querySelectorAll('span')].find((x) => x.textContent === 'Details')!;
  return [...titel.closest('section')!.querySelectorAll('.app-info-row')].map((z) => ({
    label: norm(z.querySelector('.app-info-row__label')?.textContent),
    wert: [...z.querySelectorAll('.app-info-row__value')].map((w) => norm(w.textContent)).join(' | '),
  })).filter((z) => z.label !== 'Zeitfenster');
};
const angabenWeb = () => [...document.querySelectorAll('dl.web-angaben .web-angaben__zeile')]
  .map((z) => {
    const dd = z.querySelector('dd')!;
    const zeilen = [...dd.querySelectorAll('.web-angabe-zeile')];
    return { label: norm(z.querySelector('dt')!.textContent), wert: zeilen.length > 0 ? zeilen.map((x) => norm(x.textContent)).join(' | ') : norm(dd.textContent) };
  });

describe('Leitungs-Detail: Web-Fassung und App rechnen dasselbe', () => {
  it('Status, Kacheln und Angaben stimmen für jedes Event', async () => {
    const events = faelle();
    expect(events.length).toBeGreaterThan(400);
    const abweichungen: string[] = [];
    const gesehen = { stati: new Set<string>(), zeilen: new Set<string>(), kacheln: new Set<string>() };
    for (const event of events) {
      zustand.detail = event;
      breit.wert = false;
      await oeffne();
      const app = {
        status: norm(document.querySelector('.app-header-banner__subtitle')?.textContent),
        kacheln: [...document.querySelectorAll('.app-stats-row__item')].map((k) => ({
          wert: norm(k.querySelector('.app-stats-row__value')?.textContent), label: norm(k.querySelector('.app-stats-row__label')?.textContent),
        })),
        angaben: angabenApp(),
      };
      cleanup();
      breit.wert = true;
      await oeffne();
      const web = {
        status: norm(document.querySelector('.web-untertitel .web-pill')?.textContent),
        kacheln: leitungKennzahlen(event as never, event.participants as never).map((k) => ({ wert: norm(k.wert), label: norm(k.label) })),
        angaben: angabenWeb(),
      };
      // Die Kacheln der Web-Fassung stehen als Gruppen da: dieselben Zahlen, anders gesetzt ("von 6 TN" -> "Teilnehmer:innen 2 / 6").
      const kachelnImDom = [...document.querySelectorAll('.web-kachel')].map((k) => norm(k.getAttribute('aria-label')));
      cleanup();
      gesehen.stati.add(app.status);
      for (const z of app.angaben) gesehen.zeilen.add(z.label);
      for (const k of app.kacheln) gesehen.kacheln.add(k.label.replace(/\d+/, 'n'));
      for (const teil of ['status', 'kacheln', 'angaben'] as const) {
        if (JSON.stringify(app[teil]) !== JSON.stringify(web[teil])) {
          abweichungen.push(`${event.name} ${teil}: App ${JSON.stringify(app[teil])} -- Web ${JSON.stringify(web[teil])}`);
        }
      }
      if (kachelnImDom.length !== web.kacheln.length) abweichungen.push(`${event.name}: ${kachelnImDom.length} Kacheln im Web, ${web.kacheln.length} gerechnet`);
    }
    expect(abweichungen).toEqual([]);
    // Der Vergleich ist nur etwas wert, wenn die Matrix die Zustände erreicht.
    for (const wort of ['Abgesagt', 'Verbuchen', 'Verbucht', 'Offen', 'Bald', 'Geschlossen', 'Warteliste', 'Ausgebucht']) expect([...gesehen.stati].some((s) => s.startsWith(wort)), `Status ${wort} in ${[...gesehen.stati].join(', ')}`).toBe(true);
    for (const label of ['Datum', 'Teilnehmer:innen', 'Anwesend', 'Team', 'Warteliste', 'Punkte', 'Ort', 'Mitbringen', 'Team-Zugang', 'Check-in-Fenster', 'Pflicht-Event']) expect(gesehen.zeilen.has(label), `Zeile ${label} in ${[...gesehen.zeilen].join(', ')}`).toBe(true);
    expect(gesehen.kacheln.size).toBeGreaterThan(4);
  }, 400_000);
});
