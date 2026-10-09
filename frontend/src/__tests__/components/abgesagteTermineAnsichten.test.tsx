// Alle Ansichten zeigen einen abgesagten Termin mit den gemeinsamen Bausteinen
// (15.09.2026)
//
// Der Verhaltenstest daneben (abgesagteTermineEinheitlich.test.tsx) prueft,
// dass AbsageBlock, titelDekoration() und teilnahmeDarstellung() das Richtige
// tun. Die Ursache des ganzen Befunds war aber, dass die Ansichten sie nicht
// benutzten: Die Bausteine gab es teilweise schon (istAbgesagt() stand seit
// Tagen in eventFormatting.ts und wurde an genau EINER Stelle benutzt),
// waehrend sechs Ansichten weiter von Hand rechneten -- jede mit einer
// anderen Haelfte der Wahrheit.
//
// Bis 09.10.2026 stand hier, dass keine Ansicht die Absage noch selbst
// zusammenbaut -- gelesen am Quelltext. Seither gerendert (Audit Tests
// 26.09.2026, BF-02): Jede Ansicht bekommt denselben abgesagten Termin und
// muss zeigen, was die Bausteine liefern -- den Grund genau einmal, beide
// Urheberzeilen, durchgestrichen in Listen und Kacheln, nicht im Detail --,
// und zwar fuer BEIDE Antwortformen: Die Listen (GET /events, GET
// /konfi/events) liefern nur registration_status='cancelled', die
// Einzelabrufe zusaetzlich cancelled=true. Eine Ansicht, die nur eines der
// Felder fragt, faellt an der anderen Form.
//
// Die Ansichten sind auf drei Dateien verteilt, weil jede ihre eigenen
// Attrappen braucht:
//   - hier: Konfi-Liste, Konfi-Detail, Team-Liste, Team-Detail (Geruest
//     teamerTerminSeite);
//   - abgesagteTermineAnsichtenLeitung.test.tsx: Leitungs-Detail, Zeitfenster,
//     Kachel "Abgemeldet";
//   - abgesagteTermineListenUndStart.test.tsx: Leitungsliste samt
//     Wisch-Aktionen, Startseiten von Konfi und Team.
// Welche Wisch-Aktionen es gibt und fuer wen, pruefen
// terminListeRechteGerendert.test.tsx (Leitung ja, Team und Konfis nein) und
// teamerTerminAbsagen.test.tsx (Team: kein Wisch, keine Verwaltungsroute,
// kein Absage-Modal) -- gerendert, seit dem 30.09.2026.
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { zustand, zuruecksetzen, oeffneListe, oeffneTermin, termin, inTagen, zeileVon } from './gerueste/teamerTerminSeite';
import { ohneKommentare } from '../ohneKommentare';
import type { Event } from '../../types/event';

const GRUND = 'Heizung im Gemeindehaus defekt';
const URHEBER = {
  cancelled_reason: GRUND,
  cancelled_by_name: 'Anna Meier',
  cancelled_at: '2026-09-15T08:00:00+02:00',
  cancelled_reason_set_by_name: 'Bernd Schulz',
  cancelled_reason_set_at: '2026-09-16T09:30:00+02:00',
};

/** Wie die Listen ihn liefern: nur registration_status. */
const abgesagtInDerListe = (zusatz: Partial<Event> = {}) => termin({
  id: 77, name: 'Konfi-Freizeit', event_date: inTagen(6), registration_status: 'cancelled',
  booking_status: 'excused', is_registered: false, ...URHEBER, ...zusatz,
} as Partial<Event>);

const offen = (id: number, name: string, tage: number) => termin({ id, name, event_date: inTagen(tage) });

const oeffneKonfiListe = async (reiter: 'meine' | 'alle' = 'alle') => {
  const KonfiEventsPage = (await import('../../components/konfi/pages/KonfiEventsPage')).default;
  render(<KonfiEventsPage />);
  await act(async () => { await Promise.resolve(); });
  if (reiter === 'alle') {
    await act(async () => { fireEvent.click(document.querySelector('[role="tab"][data-wert="alle"]') as HTMLElement); });
  }
};

const oeffneKonfiDetail = async (id = 77) => {
  const EventDetailView = (await import('../../components/konfi/views/EventDetailView')).default;
  render(<EventDetailView eventId={id} onBack={() => undefined} />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
};

/** Wie oft ein Text im Bereich steht (genau, nicht als Teilstring). */
const anzahl = (bereich: HTMLElement, text: string) => within(bereich).queryAllByText(text).length;
const titelStil = (zeile: HTMLElement) => zeile.querySelector('.app-list-item__title') as HTMLElement;
const durchgestrichen = () => [...document.querySelectorAll<HTMLElement>('[style]')]
  .filter((el) => el.style.textDecoration === 'line-through');

beforeEach(() => {
  zuruecksetzen();
  zustand.events = [abgesagtInDerListe(), offen(78, 'Stadtrallye', 8)];
  // Der Einzelabruf (GET /events/:id) traegt zusaetzlich cancelled=true.
  zustand.details.set(77, { ...abgesagtInDerListe(), cancelled: true, participants: [] });
});

describe('der Absageblock steht in jeder Ansicht -- der Grund genau einmal, beide Urheber', () => {
  it('Konfi-Liste: Grund, "Abgesagt von" und "Grund geändert von" in der Zeile', async () => {
    await oeffneKonfiListe();
    const zeile = zeileVon('Konfi-Freizeit');
    expect(anzahl(zeile, GRUND)).toBe(1);
    expect(anzahl(zeile, 'Abgesagt von Anna Meier, 15.09.')).toBe(1);
    expect(anzahl(zeile, 'Grund geändert von Bernd Schulz, 16.09.')).toBe(1);
    // Gegenprobe: am offenen Termin steht nichts davon.
    expect(zeileVon('Stadtrallye').textContent).not.toContain('Abgesagt');
  });

  it('Team-Liste: dieselben drei Zeilen', async () => {
    await oeffneListe('alle');
    const zeile = zeileVon('Konfi-Freizeit');
    expect(anzahl(zeile, GRUND)).toBe(1);
    expect(anzahl(zeile, 'Abgesagt von Anna Meier, 15.09.')).toBe(1);
    expect(anzahl(zeile, 'Grund geändert von Bernd Schulz, 16.09.')).toBe(1);
  });

  it('Konfi-Detail: der Kasten mit Grund und beiden Urhebern -- auch aus der Listenform', async () => {
    // Das Konfi-Detail liest seine Daten aus der Terminliste: nur
    // registration_status, kein cancelled.
    await oeffneKonfiDetail();
    expect(screen.getAllByText(GRUND)).toHaveLength(1);
    expect(screen.getAllByText('Anna Meier, 15.09.')).toHaveLength(1);
    expect(screen.getAllByText('Geändert von Bernd Schulz, 16.09.')).toHaveLength(1);
  });

  it('Team-Detail: derselbe Kasten', async () => {
    await oeffneTermin('Konfi-Freizeit');
    expect(screen.getAllByText(GRUND)).toHaveLength(1);
    expect(screen.getAllByText('Anna Meier, 15.09.')).toHaveLength(1);
    expect(screen.getAllByText('Geändert von Bernd Schulz, 16.09.')).toHaveLength(1);
  });

  it('ohne Grund steht in jedem Detail der Platzhaltersatz', async () => {
    zustand.events = [abgesagtInDerListe({ cancelled_reason: null } as Partial<Event>)];
    zustand.details.set(77, { ...zustand.events[0], cancelled: true, participants: [] });
    await oeffneKonfiDetail();
    expect(screen.getAllByText('Kein Grund zur Absage angegeben.')).toHaveLength(1);
    document.body.innerHTML = '';
    await oeffneTermin('Konfi-Freizeit');
    expect(screen.getAllByText('Kein Grund zur Absage angegeben.')).toHaveLength(1);
  });
});

describe('Befund A: die Terminlisten streichen abgesagte Titel durch', () => {
  it.each([
    ['Konfi-Liste', () => oeffneKonfiListe()],
    ['Team-Liste', () => oeffneListe('alle')],
  ])('%s streicht durch und graut aus -- den offenen Termin nicht', async (_name, oeffne) => {
    await oeffne();
    expect(titelStil(zeileVon('Konfi-Freizeit')).style.textDecoration).toBe('line-through');
    expect(titelStil(zeileVon('Konfi-Freizeit')).style.color).toBe('var(--app-text-muted)');
    expect(titelStil(zeileVon('Stadtrallye')).style.textDecoration).toBe('none');
  });
});

describe('Befund B: keine Detailansicht streicht durch', () => {
  it('das Konfi-Detail streicht nichts durch -- Kopf, Farbe und Kasten sagen es schon', async () => {
    await oeffneKonfiDetail();
    expect(document.querySelector('.app-header-banner__subtitle')!.textContent).toBe('Abgesagt');
    expect(durchgestrichen()).toEqual([]);
  });

  it('das Team-Detail ebenso', async () => {
    await oeffneTermin('Konfi-Freizeit');
    expect(document.querySelector('.app-header-banner__subtitle')!.textContent).toBe('Abgesagt');
    expect(durchgestrichen()).toEqual([]);
  });
});

describe('Befund I: der Konfi-Reiter "Alle" laesst abgesagte an ihrem Datum', () => {
  // Umgedreht am 16.09.2026 (Entscheidung Simon): Bis zum 15.09. schob
  // `abgesagteAnsEnde` sie ans Listenende. Ein abgesagter Termin soll aber an
  // seinem Tag stehen, damit sichtbar ist, dass genau DIESER erwartete Termin
  // ausfaellt.
  it('sortiert die Serverreihenfolge nicht um', async () => {
    zustand.events = [offen(70, 'Gottesdienst', 3), abgesagtInDerListe(), offen(78, 'Stadtrallye', 8)];
    await oeffneKonfiListe();
    const namen = ['Gottesdienst', 'Konfi-Freizeit', 'Stadtrallye'];
    const reihe = screen.getAllByTestId('zeile')
      .filter((z) => z.getAttribute('data-tippbar') === 'ja')
      .map((z) => namen.find((n) => z.textContent?.includes(n)));
    expect(reihe).toEqual(namen);
  });
});

describe('alle Absage-Pruefungen laufen ueber istAbgesagt() -- beide Antwortformen', () => {
  it('die Listen erkennen die Absage allein am registration_status', async () => {
    await oeffneKonfiListe();
    expect(within(zeileVon('Konfi-Freizeit')).getByRole('img', { name: 'Abgesagt' })).toBeTruthy();
    document.body.innerHTML = '';
    await oeffneListe('alle');
    expect(within(zeileVon('Konfi-Freizeit')).getByRole('img', { name: 'Abgesagt' })).toBeTruthy();
  });

  it('das Team-Detail erkennt sie allein am Feld cancelled', async () => {
    // Die Listenzeile sagt es ueber registration_status; der Einzelabruf traegt
    // cancelled=true und einen anderen Anmeldestatus.
    zustand.details.set(77, { ...abgesagtInDerListe(), registration_status: 'open', cancelled: true, participants: [] });
    await oeffneTermin('Konfi-Freizeit');
    expect(document.querySelector('.app-header-banner__subtitle')!.textContent).toBe('Abgesagt');
    expect(screen.getAllByText(GRUND)).toHaveLength(1);
  });

  it('die Konfi-Ansichten erkennen sie auch allein am Feld cancelled', async () => {
    zustand.events = [abgesagtInDerListe({ registration_status: 'open', cancelled: true } as Partial<Event>)];
    await oeffneKonfiDetail();
    expect(document.querySelector('.app-header-banner__subtitle')!.textContent).toBe('Abgesagt');
    document.body.innerHTML = '';
    await oeffneKonfiListe();
    expect(within(zeileVon('Konfi-Freizeit')).getByRole('img', { name: 'Abgesagt' })).toBeTruthy();
    expect(titelStil(zeileVon('Konfi-Freizeit')).style.textDecoration).toBe('line-through');
  });
});

// WAECHTER (09.10.2026, Simon: "gilt ab Beginn fuer alle Ansichten"). Das
// Verhalten pruefen utils/anwesenheitAbBeginn.test.ts (termineWeb.ts,
// aufgerufen) und konfiDetailOffenesBestaetigen.test.tsx gerendert; hier
// steht die Gegenrichtung: Die App-Ansichten, die den Stand noch selbst
// zusammensetzen, fragen die Regel-Stelle (shared/eventFormatting.ts,
// istBegonnen / anwesenheitAusstehend), statt wieder das Ende zu nehmen.
describe('Ausstehend ab Beginn: die Ansichten fragen die Regel-Stelle (Waechter)', () => {
  const lies = (p: string) => ohneKommentare(readFileSync(resolve(process.cwd(), p), 'utf8'));
  it.each([
    'src/components/konfi/views/EventsView.tsx',
    'src/components/konfi/views/EventDetailView.tsx',
    'src/components/teamer/pages/TeamerEventsPage.tsx',
    'src/components/admin/EventsView.tsx',
    'src/components/admin/views/EventDetailView.tsx',
    'src/utils/termineWeb.ts',
  ])('%s', (datei) => {
    const quelle = lies(datei);
    expect(quelle).toMatch(/istBegonnen\(/);
    expect(quelle).not.toMatch(/(isPastEvent|vorbei) && (event|eventData)\??\.is_registered && !/);
    expect(quelle).not.toMatch(/const (hasUnprocessedBookings|zuVerbuchen) = (isPastEvent|vorbei) &&/);
  });
});

describe('ohneKommentare() trennt Code von Kommentar (Gegenprobe zum Waechter)', () => {
  it('entfernt Zeilen-, Block- und JSX-Kommentare', () => {
    expect(ohneKommentare('const a = 1; // event.cancelled steht hier nur im Text')).not.toContain('event.cancelled');
    expect(ohneKommentare('/* event.cancelled */ const a = 1;')).not.toContain('event.cancelled');
    expect(ohneKommentare('{/* <strong>Abgesagt: </strong> */}<div />')).not.toContain('Abgesagt:');
  });

  it('laesst echten Code und Zeichenketten stehen -- auch solche mit Schraegstrichen', () => {
    expect(ohneKommentare('if (event.cancelled) return null; // Kommentar')).toContain('event.cancelled');
    expect(ohneKommentare("const url = 'https://konfi-quest.de/events';")).toContain('https://konfi-quest.de/events');
    expect(ohneKommentare('<span>Kein Grund zur Absage angegeben.</span>')).toContain('Kein Grund zur Absage angegeben.');
  });
});
