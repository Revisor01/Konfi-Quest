// Die Web-Fassung rechnet Status und Farbe eines Events NEU (utils/termineWeb.ts)
// -- die Listen der App tragen dieselbe Rechnung inline in ihren Ansichten.
// Zwei Rechnungen derselben Regel laufen auseinander, sobald jemand nur eine
// ändert. Dieser Test hält sie zusammen: Er rendert die ECHTEN Listen der App
// mit einer Matrix aus Zeit, Anmeldestand, Buchung, Anwesenheit, Pflicht,
// Konfirmation und Absage und vergleicht, was die App zeigt (Status-Marke,
// Farbe, Ausgrauen), mit dem, was die Web-Fassung rechnet.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { h, zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT } from './geruestWeb';
import KonfiEventsView from '../../../components/konfi/views/EventsView';
import AdminEventsView from '../../../components/admin/EventsView';
import { konfiFakten, konfiListeStatus, leitungFakten, leitungListeStatus, teamFakten, teamListeStatus } from '../../../utils/termineWeb';
import type { Event } from '../../../types/event';

// Die Vergleiche rendern hunderte Ansichten; unter Last (volle Suite) reichen die 5 Sekunden nicht.
vi.setConfig({ testTimeout: 120_000 });

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); cleanup(); });

/** Die Marken, die keine Status-Marke sind (Eck-Badges für Merkmale). */
const MERKMAL_TITEL = ['Nur Team', 'Team gesucht', 'Konfirmation', 'Pflichtveranstaltung'];

/** Die Zahlen einer Karte (Plätze, Team, Warteliste, Punkte, Art) als Texte; "∞" steht in der App teils als Symbol. */
const normFakt = (t: string | null | undefined) => (t ?? '').replace(/∞/g, '').replace(/\s+/g, ' ').trim();
const faktenAnKarte = (karte: Element) => [...(karte.querySelector('.app-list-item__meta')?.querySelectorAll('.app-list-item__meta-item') ?? [])].map((f) => normFakt(f.textContent));

/** Was die App auf einer Karte als Status zeigt: Wort und Farbe -- oder nichts. */
const statusAnKarte = (karte: Element) => {
  const marke = [...karte.querySelectorAll('.app-corner-badges .app-corner-badge[title]')]
    .find((m) => !MERKMAL_TITEL.includes(m.getAttribute('title')!)) as HTMLElement | undefined;
  return marke ? { text: marke.getAttribute('title')!, farbe: marke.style.backgroundColor } : null;
};

/** Zahlen, die die Karte zeigt (Plätze, Team, Warteliste, Punkte, Art) -- reihum verschieden, damit jede Zeile der Karte vorkommt. */
const zahlen = (nr: number, voll: boolean) => ({
  points: nr % 3 === 0 ? 0 : 1 + (nr % 2),
  point_type: nr % 2 ? 'gottesdienst' : 'gemeinde',
  waitlist_count: nr % 4 === 0 ? 2 : 0,
  max_waitlist_size: nr % 8 === 0 ? 7 : undefined,
  teamer_count: nr % 3,
  teamer_max_participants: nr % 2 ? 6 : 0,
  teamer_waitlist_count: nr % 5 === 0 ? 2 : 0,
  teamer_max_waitlist_size: nr % 10 === 0 ? 4 : 0,
  max_participants: !voll && nr % 6 === 0 ? 0 : 10,
});

interface Fall { zeit: 'kommend' | 'vorbei'; reg: string; voll: boolean; warteliste: boolean; buchung: string; anwesenheit: string | null; konfirmation: boolean; abgesagt: boolean }

/** Alle sinnvollen Kombinationen -- jede wird zu einem Event mit eigenem Namen. */
const faelle = (): Fall[] => {
  const alle: Fall[] = [];
  for (const zeit of ['kommend', 'vorbei'] as const) {
    for (const reg of ['open', 'upcoming', 'closed', 'mandatory']) {
      for (const voll of [false, true]) {
        for (const warteliste of [false, true]) {
          for (const buchung of ['keine', 'confirmed', 'waitlist', 'opted_out', 'excused']) {
            for (const anwesenheit of [null, 'present', 'absent']) {
              // Anwesenheit gibt es nur für Angemeldete.
              if (anwesenheit && buchung !== 'confirmed') continue;
              for (const konfirmation of [false, true]) {
                for (const abgesagt of [false, true]) {
                  alle.push({ zeit, reg, voll, warteliste, buchung, anwesenheit, konfirmation, abgesagt });
                }
              }
            }
          }
        }
      }
    }
  }
  return alle;
};

const ALS_EVENT = (f: Fall, nr: number): Event => termin(1000 + nr, `Fall-${String(nr).padStart(4, '0')}`, {
  event_date: f.zeit === 'kommend' ? inTagen(5) : inTagen(-5),
  registration_status: f.abgesagt ? 'cancelled' : f.reg,
  cancelled: f.abgesagt,
  mandatory: f.reg === 'mandatory',
  is_konfirmation: f.konfirmation,
  ...zahlen(nr, f.voll),
  registered_count: f.voll ? 10 : 3,
  waitlist_enabled: f.warteliste,
  is_registered: f.buchung === 'confirmed',
  is_opted_out: f.buchung === 'opted_out',
  booking_status: f.buchung === 'keine' ? null : f.buchung,
  waitlist_position: f.buchung === 'waitlist' ? 2 : undefined,
  attendance_status: f.anwesenheit,
});

describe('Konfis: die Liste der Web-Fassung rechnet wie die Liste der App', () => {
  const alleFaelle = faelle().map(ALS_EVENT);
  // A: ohne gebuchte Konfirmation (nichts ist gesperrt) -- B: mit (alle anderen Konfirmationen sind gesperrt).
  const ohneGebuchteKonfirmation = alleFaelle.filter((e) => !(e.is_konfirmation && e.is_registered));

  const vergleiche = (events: Event[], tab: 'meine' | 'alle' | 'konfirmation') => {
    const gebucht = events.some((e) => e.is_konfirmation && e.is_registered);
    const { container } = render(
      <KonfiEventsView events={events} activeTab={tab} onTabChange={() => undefined} onSelectEvent={() => undefined} />,
    );
    const karten = [...container.querySelectorAll('.app-list-item')];
    const abweichungen: string[] = [];
    for (const karte of karten) {
      const name = karte.querySelector('.app-list-item__title')!.textContent!.trim();
      const event = events.find((e) => e.name === name)!;
      const web = konfiListeStatus(event, gebucht);
      const app = statusAnKarte(karte);
      const erwartet = web.zeigtStatus ? { text: web.text, farbe: web.farbe } : null;
      const gedaempft = (karte as HTMLElement).style.opacity === '0.6';
      if (JSON.stringify(app) !== JSON.stringify(erwartet) || gedaempft !== (web.gedaempft || web.gesperrt)) {
        abweichungen.push(`${name}: App ${JSON.stringify(app)} gedämpft ${gedaempft}, Web ${JSON.stringify(erwartet)} gedämpft ${web.gedaempft || web.gesperrt}`);
      }
      const fakten = konfiFakten(event).map((f) => normFakt(f.text));
      if (JSON.stringify(faktenAnKarte(karte)) !== JSON.stringify(fakten)) abweichungen.push(`${name}: Zahlen App ${JSON.stringify(faktenAnKarte(karte))}, Web ${JSON.stringify(fakten)}`);
    }
    return { karten: karten.length, abweichungen };
  };

  it.each(['meine', 'alle', 'konfirmation'] as const)('Reiter %s ohne gebuchte Konfirmation: Marke, Farbe, Ausgrauen und Zahlen stimmen für jedes Event', (tab) => {
    const { karten, abweichungen } = vergleiche(ohneGebuchteKonfirmation, tab);
    expect(karten).toBeGreaterThan(100);
    expect(abweichungen).toEqual([]);
  });

  it.each(['meine', 'alle', 'konfirmation'] as const)('Reiter %s mit gebuchter Konfirmation (andere sind gesperrt): Marke, Farbe, Ausgrauen und Zahlen stimmen', (tab) => {
    const { karten, abweichungen } = vergleiche(alleFaelle, tab);
    expect(karten).toBeGreaterThan(100);
    expect(abweichungen).toEqual([]);
  });

  it('die Matrix erreicht die Sonderfälle wirklich (sonst bewiese der Vergleich nichts)', () => {
    const texte = new Set(alleFaelle.map((e) => konfiListeStatus(e, true).text));
    for (const wort of ['Abgesagt', 'Abgemeldet', 'Anwesend', 'Gefehlt', 'Ausstehend', 'Angemeldet', 'Verbucht', 'Verpasst', 'Offen', 'Ausgebucht', 'Warteliste', 'Bald', 'Geschlossen', 'Vergangen', 'Anderer Termin']) {
      expect(texte.has(wort) || [...texte].some((t) => t.startsWith(wort))).toBe(true);
    }
  });
});

describe('Leitung: die Tabelle der Web-Fassung rechnet wie die Liste der App', () => {
  const leitungsFaelle = (): Event[] => {
    const alle: Event[] = [];
    let nr = 0;
    for (const zeit of ['kommend', 'vorbei']) {
      for (const reg of ['open', 'upcoming', 'closed', 'mandatory']) {
        for (const voll of [false, true]) {
          for (const warteliste of [false, true]) {
            for (const konfirmation of [false, true]) {
              for (const abgesagt of [false, true]) {
                for (const [konfis, team, offen] of [[0, 0, 0], [3, 0, 0], [3, 0, 2], [0, 2, 2], [3, 2, 0]]) {
                  nr += 1;
                  alle.push(termin(2000 + nr, `Fall-${String(nr).padStart(4, '0')}`, {
                    event_date: zeit === 'kommend' ? inTagen(5) : inTagen(-5),
                    registration_status: abgesagt ? 'cancelled' : reg,
                    cancelled: abgesagt,
                    mandatory: reg === 'mandatory',
                    is_konfirmation: konfirmation,
                    ...zahlen(nr, voll),
                    registered_count: voll ? 10 : konfis,
                    teamer_count: team,
                    pending_bookings_count: offen,
                    waitlist_enabled: warteliste,
                  }));
                }
              }
            }
          }
        }
      }
    }
    return alle;
  };

  it('Marke, Farbe, Ausgrauen und Zahlen stimmen für jedes Event', () => {
    const alle = leitungsFaelle();
    const abweichungen: string[] = [];
    let karten = 0;
    // Die Liste der App rendert schrittweise (30 je Schritt) -- die Matrix geht in Päckchen hinein.
    for (let i = 0; i < alle.length; i += 30) {
      const paket = alle.slice(i, i + 30);
      const { container, unmount } = render(<AdminEventsView events={paket} onSelectEvent={() => undefined} />);
      for (const karte of container.querySelectorAll('.app-list-item')) {
        karten += 1;
        const name = karte.querySelector('.app-list-item__title')!.textContent!.trim();
        const event = paket.find((e) => name.startsWith(e.name))!;
        const web = leitungListeStatus(event);
        // Bis 03.10.2026 sagte die App bei einem kommenden Pflicht-Event "Geschlossen" (registration_status
        // 'mandatory' fehlte in ihrer Textkette, die Farbe kannte ihn). Jetzt sagen beide "Pflicht".
        const wortDerApp = web.text;
        const app = statusAnKarte(karte);
        const gedaempft = (karte as HTMLElement).style.opacity === '0.6';
        if (JSON.stringify(app) !== JSON.stringify({ text: wortDerApp, farbe: web.farbe }) || gedaempft !== web.gedaempft) {
          abweichungen.push(`${name}: App ${JSON.stringify(app)} gedämpft ${gedaempft}, Web ${wortDerApp} ${web.farbe} gedämpft ${web.gedaempft}`);
        }
        const fakten = leitungFakten(event).map((f) => normFakt(f.text));
        if (JSON.stringify(faktenAnKarte(karte)) !== JSON.stringify(fakten)) abweichungen.push(`${name}: Zahlen App ${JSON.stringify(faktenAnKarte(karte))}, Web ${JSON.stringify(fakten)}`);
      }
      unmount();
    }
    expect(karten).toBe(alle.length);
    expect(abweichungen).toEqual([]);
  });

  it('nur kommende Pflicht-Events heißen "Pflicht" -- in App und Web', () => {
    const texte = leitungsFaelle().filter((e) => leitungListeStatus(e).text === 'Pflicht');
    expect(texte.length).toBeGreaterThan(0);
    for (const e of texte) {
      expect(e.registration_status).toBe('mandatory');
      expect(new Date(e.event_date).getTime()).toBeGreaterThan(JETZT.getTime());
    }
  });
});

describe('Team: die Karten der Web-Fassung rechnen wie die Liste der App', () => {
  const teamFaelle = (): Event[] => {
    const alle: Event[] = [];
    let nr = 0;
    for (const zeit of ['kommend', 'vorbei']) {
      for (const art of ['nurKonfis', 'teamGesucht', 'nurTeam']) {
        for (const teamStatus of ['open', 'closed', 'waitlist', 'upcoming']) {
          for (const buchung of ['keine', 'confirmed', 'waitlist', 'pending', 'opted_out']) {
            for (const anwesenheit of [null, 'present', 'absent']) {
              if (anwesenheit && buchung !== 'confirmed') continue;
              for (const abgesagt of [false, true]) {
                nr += 1;
                alle.push(termin(3000 + nr, `Fall-${String(nr).padStart(4, '0')}`, {
                  event_date: zeit === 'kommend' ? inTagen(5) : inTagen(-5),
                  registration_status: abgesagt ? 'cancelled' : 'open',
                  cancelled: abgesagt,
                  teamer_needed: art !== 'nurKonfis',
                  teamer_only: art === 'nurTeam',
                  ...zahlen(nr, false),
                  teamer_registration_status: teamStatus,
                  is_registered: buchung === 'confirmed',
                  booking_status: buchung === 'keine' ? null : buchung,
                  attendance_status: anwesenheit,
                }));
              }
            }
          }
        }
      }
    }
    return alle;
  };

  it('Reiter "Alle": Marke, Farbe, Ausgrauen und Zahlen stimmen für jedes Event', async () => {
    h.breit = false;
    const alle = teamFaelle();
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', daten: { 'teamer:events:': alle, 'teamer:requests:': [] } });
    const { container } = await oeffne('team');
    fireEvent.click(container.querySelector('[role="tab"][data-wert="alle"]')!);
    const abweichungen: string[] = [];
    const karten = [...container.querySelectorAll('.app-list-item')];
    for (const karte of karten) {
      const name = karte.querySelector('.app-list-item__title')!.textContent!.trim();
      const event = alle.find((e) => name.startsWith(e.name))!;
      const web = teamListeStatus(event);
      const app = statusAnKarte(karte);
      const erwartet = web.zeigtStatus ? { text: web.text, farbe: web.farbe } : null;
      const gedaempft = (karte as HTMLElement).style.opacity === '0.6';
      if (JSON.stringify(app) !== JSON.stringify(erwartet) || gedaempft !== web.gedaempft) {
        abweichungen.push(`${name}: App ${JSON.stringify(app)} gedämpft ${gedaempft}, Web ${JSON.stringify(erwartet)} gedämpft ${web.gedaempft}`);
      }
      const fakten = teamFakten(event).map((f) => normFakt(f.text));
      if (JSON.stringify(faktenAnKarte(karte)) !== JSON.stringify(fakten)) abweichungen.push(`${name}: Zahlen App ${JSON.stringify(faktenAnKarte(karte))}, Web ${JSON.stringify(fakten)}`);
    }
    expect(karten.length).toBe(alle.length);
    expect(abweichungen).toEqual([]);
  });
});

describe('Team-Detail: die Web-Fassung zeigt, was die Detailansicht der App zeigt', () => {
  const norm = (t: string | null | undefined) => (t ?? '').replace(/∞/g, '').replace(/\s+/g, ' ').trim();

  const detailFaelle = (): Event[] => {
    const alle: Event[] = [];
    let nr = 0;
    for (const zeit of ['kommend', 'vorbei']) {
      for (const art of ['nurKonfis', 'teamGesucht', 'nurTeam']) {
        for (const kapazitaet of ['frei', 'vollWarteliste', 'vollWartelisteVoll', 'vollOhneWarteliste']) {
          for (const buchung of ['keine', 'confirmed', 'waitlist', 'pending', 'opted_out']) {
            for (const anwesenheit of (zeit === 'vorbei' && buchung === 'confirmed' ? [null, 'present', 'absent'] : [null])) {
              for (const abgesagt of [false, true]) {
                nr += 1;
                alle.push(termin(4000, `Fall ${nr}`, {
                  event_date: zeit === 'kommend' ? inTagen(5) : inTagen(-5),
                  registration_status: abgesagt ? 'cancelled' : 'open',
                  cancelled: abgesagt,
                  teamer_needed: art !== 'nurKonfis',
                  teamer_only: art === 'nurTeam',
                  teamer_registration_status: 'open',
                  teamer_max_participants: kapazitaet === 'frei' ? 6 : 4,
                  teamer_count: kapazitaet === 'frei' ? 2 : 4,
                  teamer_waitlist_enabled: kapazitaet === 'vollWarteliste' || kapazitaet === 'vollWartelisteVoll',
                  teamer_waitlist_count: kapazitaet === 'vollWartelisteVoll' ? 3 : kapazitaet === 'vollWarteliste' ? 1 : 0,
                  teamer_max_waitlist_size: kapazitaet === 'vollWartelisteVoll' ? 3 : 5,
                  is_registered: buchung === 'confirmed',
                  booking_status: buchung === 'keine' ? null : buchung,
                  attendance_status: anwesenheit,
                  location: nr % 2 ? 'Gemeindehaus' : '',
                  bring_items: nr % 3 ? '' : 'Schlafsack',
                  points: nr % 5 ? 0 : 2,
                  registered_count: 6, max_participants: 20,
                }));
              }
            }
          }
        }
      }
    }
    return alle;
  };

  const zeilenWeb = () => [...document.querySelectorAll('dl.web-angaben .web-angaben__zeile')].map((z) => {
    const dd = z.querySelector('dd')!;
    const zeilen = [...dd.querySelectorAll('.web-angabe-zeile')];
    return { label: norm(z.querySelector('dt')!.textContent), wert: zeilen.length > 0 ? zeilen.map((x) => norm(x.textContent)).join(' | ') : norm(dd.textContent) };
  });
  const zeilenApp = () => {
    const titel = [...document.querySelectorAll('span')].find((x) => x.textContent === 'Details')!;
    return [...titel.closest('section')!.querySelectorAll('.app-info-row')].map((z) => ({
      label: norm(z.querySelector('.app-info-row__label')?.textContent),
      wert: [...z.querySelectorAll('.app-info-row__value')].map((w) => norm(w.textContent)).join(' | '),
    })).filter((z) => z.label !== 'Zeitfenster');
  };
  const karteApp = () => {
    const titel = [...document.querySelectorAll('span')].find((x) => x.textContent === 'Bist du dabei?');
    if (!titel) return null;
    const karte = titel.closest('section')!;
    const stuecke: string[] = [];
    for (const k of karte.querySelectorAll('button, .app-status-box')) stuecke.push(norm(k.textContent));
    for (const note of karte.querySelectorAll('span')) {
      if (!note.closest('button') && !note.closest('.app-status-box') && note.textContent !== 'Bist du dabei?') stuecke.push(norm(note.textContent));
    }
    return stuecke.filter(Boolean).sort();
  };
  // Die Web-Fassung hat keine Karte "Bist du dabei?" mehr: Zusage und Absage stehen als Knöpfe im Kopf
  // (neben Chat und QR-Code), die Auskunft als Hinweis über den Kennzahlen. Der Hinweis auf ein
  // abgesagtes Event hat Titel und Grund -- der Titel ist der Satz der App.
  const karteWeb = () => {
    const kopfKnoepfe = [...document.querySelectorAll('.web-kopf__aktionen button')]
      .map((k) => norm(k.textContent))
      .filter((text) => text !== 'Chat' && text !== 'QR-Code');
    const stuecke = [...kopfKnoepfe];
    for (const hinweis of document.querySelectorAll('.web-detail > .web-hinweis')) {
      stuecke.push(norm((hinweis.querySelector('.web-hinweis__titel') ?? hinweis.querySelector('.web-hinweis__text'))!.textContent));
    }
    return stuecke.length > 0 ? stuecke.filter(Boolean).sort() : null;
  };

  const oeffneDetail = async (event: Event, breit: boolean) => {
    h.breit = breit;
    h.api.get.mockImplementation((pfad: string) => Promise.resolve({ data: pfad === '/events/4000' ? { ...event, participants: [] } : [] }));
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=4000', daten: { 'teamer:events:': [event], 'teamer:requests:': [] } });
    await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  };

  it('Status, Angaben und "Bist du dabei?" stimmen für jedes Event', async () => {
    const events = detailFaelle();
    expect(events.length).toBeGreaterThan(250);
    const abweichungen: string[] = [];
    const gesehen = { stati: new Set<string>(), karten: new Set<string>(), mitKarte: 0, zeilen: new Set<string>() };
    for (const event of events) {
      await oeffneDetail(event, false);
      const app = {
        status: norm(document.querySelector('.app-header-banner__subtitle')?.textContent),
        angaben: zeilenApp(),
        karte: karteApp(),
      };
      gesehen.stati.add(app.status);
      for (const z of app.angaben) gesehen.zeilen.add(z.label);
      for (const k of app.karte ?? []) gesehen.karten.add(k);
      if (app.karte) gesehen.mitKarte += 1;
      cleanup();
      await oeffneDetail(event, true);
      const web = {
        status: norm(document.querySelector('.web-untertitel .web-pill')?.textContent),
        angaben: zeilenWeb(),
        karte: karteWeb(),
      };
      cleanup();
      for (const teil of ['status', 'angaben', 'karte'] as const) {
        if (JSON.stringify(app[teil]) !== JSON.stringify(web[teil])) {
          abweichungen.push(`${event.name} ${teil}: App ${JSON.stringify(app[teil])} -- Web ${JSON.stringify(web[teil])}`);
        }
      }
    }
    expect(abweichungen).toEqual([]);
    // Der Vergleich ist nur etwas wert, wenn die Matrix die Zustände wirklich erreicht -- sonst stünde zweimal "leer" da.
    for (const wort of ['Abgesagt', 'Anwesend', 'Abwesend', 'Ausstehend', 'Warteliste', 'Dabei', 'Vergangen', 'Offen', 'Nur Info', 'Abgesagt von dir']) expect(gesehen.stati.has(wort)).toBe(true);
    for (const wort of ['Dabei', 'Nicht dabei', 'Nicht mehr dabei', 'Doch dabei', 'Nur zur Info - keine Anmeldung', 'Dieses Event ist abgesagt', 'Anwesend', 'Abwesend', 'Anwesenheit ausstehend']) expect(gesehen.karten.has(wort)).toBe(true);
    expect([...gesehen.karten].some((k) => k.startsWith('Warteliste ('))).toBe(true);
    for (const label of ['Datum', 'Teilnehmer:innen', 'Team', 'Team-Warteliste', 'Punkte', 'Ort', 'Mitbringen', 'Team-Zugang']) expect(gesehen.zeilen.has(label)).toBe(true);
    expect(gesehen.mitKarte).toBeGreaterThan(150);
  }, 300_000);
});
