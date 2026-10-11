// Event anlegen und kopieren im Browser als eigener Dialog, gerendert
// (11.10.2026, Simon: „Web braucht eigene kompaktere Modale überall").
//
// Im breiten Fenster öffnen „Neues Event" und „Kopieren" der Web-Fassung von
// Mitmachen (AdminEventsPage) den Dialog WebEventDialog statt des App-Modals.
// Gerendert wird die echte Seite mit dem echten Dialog und dem echten Hook
// (useEventFormular, derselbe wie im App-Modal); nachgestellt sind nur Server,
// Kontext, Breite und Ionic (geruestWeb). Geprüft wird, was eine Person tut:
// Felder lesen und ändern, speichern, abbrechen -- und welcher Körper an
// welche Route geht. Im schmalen Fenster bleibt das App-Modal.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  h, api, setSuccess, setError, geoeffnet,
  zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT,
} from './geruestWeb';

const KATEGORIEN = [{ id: 5, name: 'Gottesdienst' }, { id: 6, name: 'Freizeit' }];
// Jahrgang 2027 hat die Punkteart Gottesdienst abgeschaltet.
const JAHRGAENGE = [
  { id: 1, name: 'Jahrgang 2026' },
  { id: 2, name: 'Jahrgang 2027', gottesdienst_enabled: false, gemeinde_enabled: true },
];

const GOTTESDIENST = termin(201, 'Sonntagsgottesdienst', {
  event_date: inTagen(1), event_end_time: inTagen(1, 11), location: 'Kirche Musterdorf', description: 'Mit Abendmahl',
  points: 2, point_type: 'gottesdienst', max_participants: 20, waitlist_enabled: true, max_waitlist_size: 4,
  jahrgang_ids: '1', jahrgang_names: 'Jahrgang 2026', jahrgaenge: [{ id: 1, name: 'Jahrgang 2026' }],
  categories: [{ id: 5, name: 'Gottesdienst' }], checkin_window: 45, bring_items: 'Gesangbuch',
});
// Ein Event mit zwei Zeitfenstern, wie der Server sie liefert (UTC).
const STATIONENLAUF = termin(207, 'Stationenlauf', {
  event_date: inTagen(3, 14), event_end_time: inTagen(3, 17), has_timeslots: true, max_participants: 12,
  jahrgang_ids: '2', jahrgaenge: [{ id: 2, name: 'Jahrgang 2027' }],
});
const STATIONEN_ZEITFENSTER = [
  { id: 31, start_time: '2026-10-06T12:00:00.000Z', end_time: '2026-10-06T13:00:00.000Z', max_participants: 6, registered_count: 4 },
  { id: 32, start_time: '2026-10-06T13:00:00.000Z', end_time: '2026-10-06T14:00:00.000Z', max_participants: 6, registered_count: 1 },
];

const DATEN = { 'admin:events:': [GOTTESDIENST, STATIONENLAUF], 'admin:events-cancelled:': [], 'admin:jahrgaenge:': JAHRGAENGE };

beforeEach(() => {
  zuruecksetzen();
  window.localStorage.clear();
  // Fester Zeitpunkt: Samstag, 03.10.2026, 10:30 Uhr. Ein neues Event beginnt
  // damit um 11:00 (jetzt + 30 Minuten, auf die halbe Stunde abgerundet).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  h.api.get.mockImplementation((pfad: string) => Promise.resolve({
    data: pfad === '/admin/categories' ? KATEGORIEN
      : pfad === '/admin/jahrgaenge' ? JAHRGAENGE
        : pfad === '/events/207/timeslots' ? STATIONEN_ZEITFENSTER
          : [],
  }));
});

const warte = async () => { for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); }); };
const oeffneMitmachen = async (rolle: 'leitung' | 'admin' = 'leitung') => {
  richteEin({ nutzer: rolle, pfad: '/admin/events', daten: DATEN });
  await oeffne('leitung');
};
const zeileVon = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement;
const neuesEvent = async () => {
  await oeffneMitmachen();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Neues Event anlegen' })); });
  await warte();
  return screen.getByRole('dialog', { name: 'Neues Event' });
};
const kopiere = async (name: string) => {
  await oeffneMitmachen();
  await act(async () => { fireEvent.click(within(zeileVon(name)).getByRole('button', { name: 'Event kopieren' })); });
  await warte();
  return screen.getByRole('dialog', { name: 'Event kopieren' });
};

/** Felder im Dialog über ihre Beschriftung. */
const textfeld = (d: HTMLElement, name: string) => within(d).getByRole('textbox', { name }) as HTMLInputElement;
const auswahl = (d: HTMLElement, name: string) => within(d).getByRole('combobox', { name }) as HTMLSelectElement;
const datum = (d: HTMLElement, name: string) => within(d).getByLabelText(name) as HTMLInputElement;
const schalter = (d: HTMLElement, name: string) => within(d).getByRole('switch', { name }) as HTMLInputElement;
const haken = (d: HTMLElement, gruppe: string, name: string) =>
  within(within(d).getByRole('group', { name: gruppe })).getByRole('checkbox', { name }) as HTMLInputElement;
const tippe = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const ueberschriften = (d: HTMLElement) => within(d).getAllByRole('heading', { level: 3 }).map((x) => x.textContent);
const absenden = async (d: HTMLElement, knopf = 'Event anlegen') => {
  await act(async () => { fireEvent.click(within(d).getByRole('button', { name: knopf })); });
  await warte();
};
/** Die Dirty-Erkennung des Formulars beginnt 100 ms nach dem Öffnen (wie in der App). */
const nachDemOeffnen = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 120)); }); };

/** Der Körper eines neuen Events mit allen Voreinstellungen (Beginn 11:00, Ende 13:00, Schluss 10:45). */
const NEU_VOREINGESTELLT = {
  name: 'Konfi-Tag am See', description: null,
  event_date: '2026-10-03T09:00:00.000Z', event_end_time: '2026-10-03T11:00:00.000Z',
  location: null, points: 1, point_type: 'gemeinde', category_ids: [], jahrgang_ids: [], type: 'event',
  max_participants: 5, registration_opens_at: null, registration_closes_at: '2026-10-03T08:45:00.000Z',
  has_timeslots: false, waitlist_enabled: true, max_waitlist_size: 3, timeslots: [],
  is_series: false, series_count: undefined, series_interval: undefined,
  mandatory: false, is_konfirmation: false, bring_items: null, checkin_window: 30,
  teamer_needed: false, teamer_only: false, teamer_max_participants: 0,
  teamer_waitlist_enabled: false, teamer_max_waitlist_size: 0,
  client_id: expect.any(String),
};

describe('Umschalten: im breiten Fenster der Dialog, im schmalen das App-Modal', () => {
  it('breit: „Neues Event anlegen" öffnet den Dialog, das App-Modal nicht', async () => {
    const d = await neuesEvent();
    expect(d).toHaveClass('web-dialog--breit');
    expect(geoeffnet('EventModal')).toHaveLength(0);
  });

  it('breit: „Kopieren" öffnet den Dialog, das App-Modal nicht', async () => {
    await kopiere('Sonntagsgottesdienst');
    expect(geoeffnet('EventModal')).toHaveLength(0);
  });

  it('schmal: „Neues Event anlegen" öffnet wie bisher das App-Modal, keinen Dialog', async () => {
    h.breit = false;
    await oeffneMitmachen();
    await act(async () => { fireEvent.click(within(screen.getByTestId('kopfzeile')).getByRole('button', { name: 'Neues Event anlegen' })); });
    expect(geoeffnet('EventModal')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBe(null);
  });
});

describe('Neues Event: Aufbau und Vorbelegung', () => {
  it('Abschnitte wie in der App, in derselben Reihenfolge', async () => {
    const d = await neuesEvent();
    expect(ueberschriften(d)).toEqual([
      'Kategorien & Zielgruppe', 'Datum & Zeit', 'Anmeldung', 'Event-Serie (optional)', 'Zeitfenster (optional)', 'Konfis', 'QR-Check-in',
    ]);
  });

  it('Felder benannt und vorbelegt wie in der App: Beginn in einer halben Stunde, zwei Stunden lang, Anmeldung ab sofort', async () => {
    const d = await neuesEvent();
    expect(textfeld(d, 'Event-Name').value).toBe('');
    expect(textfeld(d, 'Event-Name')).toHaveAttribute('aria-required', 'true');
    expect(textfeld(d, 'Ort').value).toBe('');
    expect(textfeld(d, 'Beschreibung').value).toBe('');
    expect(textfeld(d, 'Was mitbringen (optional)').value).toBe('');
    expect(auswahl(d, 'Für wen ist das Event?').value).toBe('normal');
    expect(optionen(auswahl(d, 'Für wen ist das Event?'))).toEqual(['Nur Konfis', 'Konfis, Team gesucht', 'Nur Team']);
    expect(schalter(d, 'Pflicht-Event').checked).toBe(false);
    expect(schalter(d, 'Konfirmation').checked).toBe(false);
    expect(datum(d, 'Datum & Uhrzeit')).toHaveAttribute('type', 'datetime-local');
    expect(datum(d, 'Datum & Uhrzeit').value).toBe('2026-10-03T11:00');
    expect(datum(d, 'Endzeit (optional)').value).toBe('2026-10-03T13:00');
    expect(datum(d, 'Endzeit (optional)')).toHaveAttribute('min', '2026-10-03T11:00');
    expect(schalter(d, 'Anmeldung ab sofort').checked).toBe(true);
    expect(schalter(d, 'Anmeldung ab sofort')).toHaveAccessibleDescription('Konfis können sich sofort anmelden.');
    expect(within(d).queryByLabelText('Anmeldung ab')).toBe(null);
    expect(datum(d, 'Anmeldeschluss').value).toBe('2026-10-03T10:45');
    expect(schalter(d, 'Als Serie erstellen').checked).toBe(false);
    expect(schalter(d, 'Zeitfenster aktivieren').checked).toBe(false);
    expect(auswahl(d, 'Max. Teilnehmer:innen').value).toBe('5');
    expect(optionen(auswahl(d, 'Max. Teilnehmer:innen'))).toHaveLength(31);
    expect(auswahl(d, 'Warteliste').value).toBe('3');
    expect(auswahl(d, 'Punkte').value).toBe('1');
    expect(optionen(auswahl(d, 'Punkte'))).toEqual(['1', '2', '3', '4', '5']);
    expect(auswahl(d, 'Typ').value).toBe('gemeinde');
    expect(auswahl(d, 'Check-in-Fenster (Minuten)').value).toBe('30');
    expect(auswahl(d, 'Check-in-Fenster (Minuten)')).toHaveAccessibleDescription('QR-Code Check-in: 30 Min. vor und nach dem Start');
    // Kategorien und Jahrgänge aus GET /admin/categories und /admin/jahrgaenge.
    expect(within(within(d).getByRole('group', { name: 'Kategorien (mehrere möglich)' })).getAllByRole('checkbox').map((x) => x.getAttribute('value'))).toEqual(['5', '6']);
    expect(within(d).getByRole('group', { name: 'Jahrgänge (mehrere möglich)' })).toHaveAccessibleDescription('Ohne Auswahl gilt das Event für die ganze Gemeinde.');
    // Kein Team-Abschnitt bei „Nur Konfis".
    expect(within(d).queryByRole('combobox', { name: 'Wie viele Personen werden fürs Team gesucht?' })).toBe(null);
  });

  it('ein anderer Beginn zieht Ende (Dauer bleibt) und Anmeldeschluss mit', async () => {
    const d = await neuesEvent();
    tippe(datum(d, 'Datum & Uhrzeit'), '2026-10-10T18:30');
    expect(datum(d, 'Datum & Uhrzeit').value).toBe('2026-10-10T18:30');
    expect(datum(d, 'Endzeit (optional)').value).toBe('2026-10-10T20:30');
    expect(datum(d, 'Anmeldeschluss').value).toBe('2026-10-09T18:30');
  });

  it('Speichern schickt genau diesen Körper an POST /events; danach ist der Dialog zu und die Liste lädt neu', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), '  Konfi-Tag am See  ');
    await absenden(d);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/events', NEU_VOREINGESTELLT);
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(h.neuGeladen).toEqual(['admin:events:1', 'admin:events-cancelled:1']);
  });

  it('alle Felder geändert: Körper mit Ort, Text, Kategorien, Jahrgängen, Punkten, Typ, Plätzen, Warteliste und Check-in', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    tippe(textfeld(d, 'Ort'), 'Badestelle');
    tippe(textfeld(d, 'Beschreibung'), 'Baden und Grillen');
    tippe(textfeld(d, 'Was mitbringen (optional)'), 'Handtuch');
    fireEvent.click(haken(d, 'Kategorien (mehrere möglich)', 'Freizeit'));
    fireEvent.click(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026'));
    expect(within(d).getByRole('group', { name: 'Jahrgänge (mehrere möglich)' })).toHaveAccessibleDescription('1 ausgewählt.');
    tippe(auswahl(d, 'Max. Teilnehmer:innen'), '12');
    tippe(auswahl(d, 'Warteliste'), '0');
    tippe(auswahl(d, 'Punkte'), '3');
    tippe(auswahl(d, 'Typ'), 'gottesdienst');
    tippe(auswahl(d, 'Check-in-Fenster (Minuten)'), '15');
    fireEvent.click(schalter(d, 'Anmeldung ab sofort'));
    expect(datum(d, 'Anmeldung ab').value).toBe('2026-10-03T10:30');
    tippe(datum(d, 'Anmeldung ab'), '2026-10-03T10:40');
    await absenden(d);
    expect(api.post).toHaveBeenCalledWith('/events', {
      ...NEU_VOREINGESTELLT,
      description: 'Baden und Grillen', location: 'Badestelle', bring_items: 'Handtuch',
      category_ids: [6], jahrgang_ids: [1], max_participants: 12,
      waitlist_enabled: false, max_waitlist_size: 3, points: 3, point_type: 'gottesdienst', checkin_window: 15,
      registration_opens_at: '2026-10-03T08:40:00.000Z',
    });
  });

  it('Typ: nur Punktearten, die in einem gewählten Jahrgang aktiv sind', async () => {
    const d = await neuesEvent();
    expect(optionen(auswahl(d, 'Typ'))).toEqual(['Gottesdienst', 'Gemeinde']);
    fireEvent.click(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2027'));
    expect(optionen(auswahl(d, 'Typ'))).toEqual(['Gemeinde']);
  });
});

describe('Neues Event: Prüfen vor dem Senden', () => {
  it('ohne Namen: die Meldung steht im Dialog, nichts wird gesendet', async () => {
    const d = await neuesEvent();
    await absenden(d);
    expect(within(d).getByRole('alert')).toHaveTextContent('Bitte gib dem Event einen Namen');
    expect(api.post).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    // Tippen nimmt die Meldung weg.
    tippe(textfeld(d, 'Event-Name'), 'K');
    expect(within(d).queryByRole('alert')).toBe(null);
  });

  it('Pflicht-Event ohne Jahrgang: Meldung, nichts gesendet; mit Jahrgang: Pflicht-Körper ohne Plätze, Punkte und Anmeldung', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    fireEvent.click(schalter(d, 'Pflicht-Event'));
    // Pflicht: Jahrgang mit Stern, Anmeldung, Zeitfenster und Konfis verschwinden.
    expect(within(d).getByRole('group', { name: 'Jahrgänge (mehrere möglich)' })).toHaveAttribute('aria-required', 'true');
    expect(within(d).getByRole('group', { name: 'Jahrgänge (mehrere möglich)' })).toHaveAccessibleDescription('Pflicht bei Pflicht-Events.');
    expect(ueberschriften(d)).toEqual(['Kategorien & Zielgruppe', 'Datum & Zeit', 'Event-Serie (optional)', 'QR-Check-in']);
    await absenden(d);
    expect(within(d).getByRole('alert')).toHaveTextContent('Pflicht-Events brauchen mindestens einen Jahrgang');
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2027'));
    await absenden(d);
    expect(api.post).toHaveBeenCalledWith('/events', {
      ...NEU_VOREINGESTELLT, mandatory: true, jahrgang_ids: [2], points: 0, max_participants: 0,
      registration_closes_at: null, waitlist_enabled: false, max_waitlist_size: 0,
    });
  });

  it('Ende vor Beginn: das Endfeld beginnt beim Beginn (min), ein früheres Ende hält der Browser vor dem Senden an', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    tippe(datum(d, 'Endzeit (optional)'), '2026-10-03T10:00');
    // Wie der Wähler der App: Die Auswahl fängt beim Beginn an. Der Browser
    // meldet den Widerspruch am Feld selbst und schickt das Formular nicht ab
    // (die Prüfung des Formulars, ENDE_VOR_BEGINN, steht dahinter).
    expect(datum(d, 'Endzeit (optional)').validity.rangeUnderflow).toBe(true);
    await absenden(d);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Neues Event' })).toBeInTheDocument();
    // Mit einem Ende nach dem Beginn geht es.
    tippe(datum(d, 'Endzeit (optional)'), '2026-10-03T11:00');
    await absenden(d);
    expect(api.post).toHaveBeenCalledWith('/events', { ...NEU_VOREINGESTELLT, event_end_time: '2026-10-03T09:00:00.000Z' });
  });

  it('Serverfehler mit Einzelheiten: sie stehen im Dialog, der offen bleibt', async () => {
    api.post.mockRejectedValue({ response: { status: 400, data: { error: 'Validierungsfehler', details: [{ message: 'Ort ist zu lang' }] } } });
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    await absenden(d);
    expect(within(d).getByRole('alert')).toHaveTextContent('Ort ist zu lang');
    expect(screen.getByRole('dialog', { name: 'Neues Event' })).toBeInTheDocument();
    expect(h.neuGeladen).toEqual([]);
  });
});

describe('Neues Event: Zeitfenster', () => {
  it('hinzufügen, ändern und entfernen -- der Körper trägt genau die übrigen Zeitfenster', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    fireEvent.click(schalter(d, 'Zeitfenster aktivieren'));
    // Mit Zeitfenstern stehen die Plätze am Zeitfenster, nicht am Event.
    expect(within(d).queryByRole('combobox', { name: 'Max. Teilnehmer:innen' })).toBe(null);
    fireEvent.click(within(d).getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    const fenster = (n: number) => within(d).getByRole('group', { name: `Zeitfenster ${n}` });
    // Das erste beginnt mit dem Event, jedes weitere am Ende des vorigen; eine Stunde, halbe Plätze.
    expect((within(fenster(1)).getByLabelText('Startzeit') as HTMLInputElement).value).toBe('11:00');
    expect((within(fenster(2)).getByLabelText('Startzeit') as HTMLInputElement).value).toBe('12:00');
    expect((within(fenster(3)).getByLabelText('Endzeit') as HTMLInputElement).value).toBe('14:00');
    expect((within(fenster(1)).getByRole('combobox', { name: 'Max. Teilnehmer:innen' }) as HTMLSelectElement).value).toBe('2');

    tippe(within(fenster(2)).getByLabelText('Endzeit'), '12:45');
    tippe(within(fenster(3)).getByRole('combobox', { name: 'Max. Teilnehmer:innen' }), '0');
    fireEvent.click(within(d).getByRole('button', { name: 'Zeitfenster 1 entfernen' }));
    expect(within(d).queryByRole('group', { name: 'Zeitfenster 3' })).toBe(null);
    expect((within(fenster(1)).getByLabelText('Startzeit') as HTMLInputElement).value).toBe('12:00');

    await absenden(d);
    expect(api.post).toHaveBeenCalledWith('/events', {
      ...NEU_VOREINGESTELLT,
      has_timeslots: true,
      timeslots: [
        { start_time: '2026-10-03T10:00:00.000Z', end_time: '2026-10-03T10:45:00.000Z', max_participants: 2 },
        { start_time: '2026-10-03T11:00:00.000Z', end_time: '2026-10-03T12:00:00.000Z', max_participants: 0 },
      ],
    });
  });

  it('ausschalten verwirft die Zeitfenster', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    fireEvent.click(schalter(d, 'Zeitfenster aktivieren'));
    fireEvent.click(within(d).getByRole('button', { name: 'Zeitfenster hinzufügen' }));
    fireEvent.click(schalter(d, 'Zeitfenster aktivieren'));
    fireEvent.click(schalter(d, 'Zeitfenster aktivieren'));
    expect(within(d).queryByRole('group', { name: 'Zeitfenster 1' })).toBe(null);
    await absenden(d);
    expect(api.post).toHaveBeenCalledWith('/events', { ...NEU_VOREINGESTELLT, has_timeslots: true, timeslots: [] });
  });
});

describe('Neues Event: Serie und Zielgruppe', () => {
  it('Serie: Anzahl ab 2, monatlich höchstens 12, letzter Termin; Speichern an POST /events/series', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfistunde');
    fireEvent.click(schalter(d, 'Als Serie erstellen'));
    expect(auswahl(d, 'Anzahl Events').value).toBe('2');
    expect(auswahl(d, 'Intervall').value).toBe('week');
    expect(within(d).getByText('Letzter Termin: Samstag, 10. Oktober 2026')).toBeInTheDocument();
    tippe(auswahl(d, 'Anzahl Events'), '20');
    tippe(auswahl(d, 'Intervall'), 'month');
    expect(auswahl(d, 'Anzahl Events').value).toBe('12');
    expect(optionen(auswahl(d, 'Anzahl Events'))).toHaveLength(11);
    expect(within(d).getByRole('button', { name: 'Serie anlegen' })).toBeInTheDocument();
    await absenden(d, 'Serie anlegen');
    expect(api.post).toHaveBeenCalledWith('/events/series', {
      ...NEU_VOREINGESTELLT, name: 'Konfistunde', is_series: true, series_count: 12, series_interval: 'month',
    });
    expect(setSuccess).toHaveBeenCalledWith('Event-Serie mit 12 Events erstellt');
  });

  it('„Nur Team" blendet Pflicht, Konfirmation, Jahrgänge, Anmeldung, Zeitfenster und Konfis aus und zeigt das Team', async () => {
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Teamabend');
    fireEvent.click(schalter(d, 'Pflicht-Event'));
    tippe(auswahl(d, 'Für wen ist das Event?'), 'teamer_only');
    expect(within(d).queryByRole('switch', { name: 'Pflicht-Event' })).toBe(null);
    expect(within(d).queryByRole('group', { name: 'Jahrgänge (mehrere möglich)' })).toBe(null);
    expect(ueberschriften(d)).toEqual(['Kategorien & Zielgruppe', 'Datum & Zeit', 'Event-Serie (optional)', 'Team', 'QR-Check-in']);
    expect(auswahl(d, 'Wie viele Personen werden fürs Team gesucht?').value).toBe('0');
    tippe(auswahl(d, 'Wie viele Personen werden fürs Team gesucht?'), '6');
    expect(auswahl(d, 'Warteliste fürs Team').value).toBe('3');
    tippe(auswahl(d, 'Warteliste fürs Team'), '2');
    await absenden(d);
    expect(api.post).toHaveBeenCalledWith('/events', {
      ...NEU_VOREINGESTELLT, name: 'Teamabend', points: 0, max_participants: 0, registration_closes_at: null,
      waitlist_enabled: false, max_waitlist_size: 0, teamer_only: true, teamer_max_participants: 6,
      teamer_waitlist_enabled: true, teamer_max_waitlist_size: 2,
    });
  });
});

describe('Neues Event: Abbrechen und ohne Netz', () => {
  it('Abbrechen ohne Änderung schließt sofort und schickt nichts', async () => {
    const d = await neuesEvent();
    fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }));
    await warte();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(h.presentAlert).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('mit Änderungen fragt Schließen wie die App nach -- als kleiner Dialog darüber: „Abbrechen" lässt offen, „Verwerfen" schließt, gesendet wird nichts', async () => {
    const d = await neuesEvent();
    await nachDemOeffnen();
    tippe(textfeld(d, 'Event-Name'), 'Halb fertig');
    fireEvent.click(within(d).getByRole('button', { name: 'Schließen' }));
    const frage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    expect(frage).toHaveAccessibleDescription('Möchtest du die Änderungen verwerfen?');
    // Kein Ionic-Alert: Der läge unter dem Dialog, der an <body> hängt.
    expect(h.presentAlert).not.toHaveBeenCalled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBe(null);
    expect(textfeld(screen.getByRole('dialog', { name: 'Neues Event' }), 'Event-Name').value).toBe('Halb fertig');
    // Escape im Dialog fragt ebenso.
    fireEvent.keyDown(d, { key: 'Escape' });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.post).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('solange gespeichert wird, schließt nichts den Dialog; lehnt der Server ab, steht seine Meldung im Dialog, danach fragt Schließen wieder nach', async () => {
    // Gegenprüfung 11.10.2026: Vorher ließ sich der Dialog beim Speichern
    // schließen oder die Rückfrage öffnen (Abbrechen, X, Escape, Klick
    // daneben) -- das Event wurde trotzdem angelegt, und eine Ablehnung des
    // Servers ging ins Leere.
    let ablehnen: (grund: unknown) => void = () => {};
    api.post.mockReturnValue(new Promise((_ok, nein) => { ablehnen = nein; }));
    const d = await neuesEvent();
    await nachDemOeffnen();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    await absenden(d);
    expect(api.post).toHaveBeenCalledTimes(1);

    const knopf = (name: string) => within(d).getByRole('button', { name }) as HTMLButtonElement;
    expect([knopf('Abbrechen'), knopf('Schließen'), knopf('Event anlegen')].map((k) => k.disabled)).toEqual([true, true, true]);
    fireEvent.click(knopf('Abbrechen'));
    fireEvent.click(knopf('Schließen'));
    fireEvent.keyDown(d, { key: 'Escape' });
    fireEvent.mouseDown(d.parentElement as HTMLElement);
    // Weder zu noch die Rückfrage darüber: nur der Dialog selbst.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBe(d);

    await act(async () => { ablehnen({ response: { status: 400, data: { error: 'Validierungsfehler', details: [{ message: 'Ort ist zu lang' }] } } }); });
    await warte();
    expect(within(d).getByRole('alert')).toHaveTextContent('Ort ist zu lang');
    expect(h.neuGeladen).toEqual([]);
    // Danach ist er wieder frei; Schließen fragt wie sonst nach, und die
    // Rückfrage selbst ist nie gesperrt.
    expect(knopf('Abbrechen')).toBeEnabled();
    fireEvent.keyDown(d, { key: 'Escape' });
    const frage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    expect(within(frage).getByRole('button', { name: 'Schließen' })).toBeEnabled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Verwerfen' }));
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('ohne Netz: wie in der App in die Warteschlange, mit Kennung und Meldung', async () => {
    h.online = false;
    const d = await neuesEvent();
    tippe(textfeld(d, 'Event-Name'), 'Konfi-Tag am See');
    await absenden(d);
    expect(api.post).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    const eintrag = h.enqueue.mock.calls[0][0];
    expect(eintrag).toEqual({
      method: 'POST', url: '/events', body: NEU_VOREINGESTELLT, maxRetries: 5, hasFileUpload: false,
      metadata: { type: 'admin', clientId: eintrag.body.client_id, label: 'Event erstellen' },
    });
    expect(setSuccess).toHaveBeenCalledWith('Event wird erstellt sobald du wieder online bist');
    expect(screen.queryByRole('dialog')).toBe(null);
  });
});

describe('Kopieren', () => {
  it('Vorbelegung aus dem Original, Datum neu; Titel und Knopf sagen „kopieren" und „anlegen"', async () => {
    const d = await kopiere('Sonntagsgottesdienst');
    expect(d).toHaveAccessibleDescription('Alles aus „Sonntagsgottesdienst“ ist übernommen, das Datum ist neu. Material und Chat kommen nicht mit; angelegt wird erst beim Speichern.');
    expect(textfeld(d, 'Event-Name').value).toBe('Sonntagsgottesdienst');
    expect(textfeld(d, 'Ort').value).toBe('Kirche Musterdorf');
    expect(textfeld(d, 'Beschreibung').value).toBe('Mit Abendmahl');
    expect(textfeld(d, 'Was mitbringen (optional)').value).toBe('Gesangbuch');
    expect(haken(d, 'Kategorien (mehrere möglich)', 'Gottesdienst').checked).toBe(true);
    expect(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026').checked).toBe(true);
    expect(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2027').checked).toBe(false);
    // Neuer Beginn wie bei einem neuen Event, die Dauer (eine Stunde) bleibt.
    expect(datum(d, 'Datum & Uhrzeit').value).toBe('2026-10-03T11:00');
    expect(datum(d, 'Endzeit (optional)').value).toBe('2026-10-03T12:00');
    expect(auswahl(d, 'Max. Teilnehmer:innen').value).toBe('20');
    expect(auswahl(d, 'Warteliste').value).toBe('4');
    expect(auswahl(d, 'Punkte').value).toBe('2');
    expect(auswahl(d, 'Typ').value).toBe('gottesdienst');
    expect(auswahl(d, 'Check-in-Fenster (Minuten)').value).toBe('45');
    // Eine Kopie ist ein Einzeltermin -- wie in der App ohne Serie.
    expect(within(d).queryByRole('switch', { name: 'Als Serie erstellen' })).toBe(null);
    expect(within(d).getByRole('button', { name: 'Event anlegen' })).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Speichern legt NEU an (POST /events, kein PUT auf das Original)', async () => {
    const d = await kopiere('Sonntagsgottesdienst');
    await absenden(d);
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/events', {
      ...NEU_VOREINGESTELLT,
      name: 'Sonntagsgottesdienst', description: 'Mit Abendmahl', location: 'Kirche Musterdorf', bring_items: 'Gesangbuch',
      event_end_time: '2026-10-03T10:00:00.000Z', points: 2, point_type: 'gottesdienst', category_ids: [5], jahrgang_ids: [1],
      max_participants: 20, max_waitlist_size: 4, checkin_window: 45,
    });
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(h.neuGeladen).toEqual(['admin:events:1', 'admin:events-cancelled:1']);
  });

  it('Zeitfenster kommen mit, auf den neuen Tag verschoben, und gehen so in den Körper', async () => {
    const d = await kopiere('Stationenlauf');
    expect(api.get).toHaveBeenCalledWith('/events/207/timeslots');
    expect(schalter(d, 'Zeitfenster aktivieren').checked).toBe(true);
    const fenster = (n: number) => within(d).getByRole('group', { name: `Zeitfenster ${n}` });
    // Original: Beginn 06.10. 14:00, Fenster 14:00 und 15:00 -- Kopie beginnt 11:00.
    expect((within(fenster(1)).getByLabelText('Startzeit') as HTMLInputElement).value).toBe('11:00');
    expect((within(fenster(2)).getByLabelText('Startzeit') as HTMLInputElement).value).toBe('12:00');
    expect((within(fenster(2)).getByRole('combobox', { name: 'Max. Teilnehmer:innen' }) as HTMLSelectElement).value).toBe('6');
    await absenden(d);
    const koerper = api.post.mock.calls[0][1];
    expect(api.post.mock.calls[0][0]).toBe('/events');
    expect(koerper.timeslots).toEqual([
      { start_time: '2026-10-03T09:00:00.000Z', end_time: '2026-10-03T10:00:00.000Z', max_participants: 6 },
      { start_time: '2026-10-03T10:00:00.000Z', end_time: '2026-10-03T11:00:00.000Z', max_participants: 6 },
    ]);
    expect(koerper.has_timeslots).toBe(true);
  });

  it('ein anderes Datum verschiebt die Zeitfenster nicht (wie in der App) -- der Dialog nennt dann ihren Tag', async () => {
    const d = await kopiere('Stationenlauf');
    const fenster = within(d).getByRole('group', { name: 'Zeitfenster 1' });
    expect(within(fenster).queryByText(/nicht am Tag des Events/)).toBe(null);
    tippe(datum(d, 'Datum & Uhrzeit'), '2026-10-10T11:00');
    expect(within(fenster).getByText('Am Sa., 03.10.2026 – nicht am Tag des Events.')).toBeInTheDocument();
  });

  it('ohne Netz: kein Dialog, eine Meldung (wie in der App)', async () => {
    h.online = false;
    await oeffneMitmachen();
    await act(async () => { fireEvent.click(within(zeileVon('Sonntagsgottesdienst')).getByRole('button', { name: 'Event kopieren' })); });
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(setError).toHaveBeenCalledTimes(1);
  });
});
