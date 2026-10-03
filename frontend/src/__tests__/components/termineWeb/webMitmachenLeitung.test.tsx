// Mitmachen der Leitung in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): im breiten Fenster
// Reiter oben (Events, Aktivitäten, Anträge über ?segment=) und die Events
// als Tabelle mit Zeitraum-Chips, Filtern und Suche. Kopieren, Absagen,
// Löschen und Co. rufen dieselben Funktionen wie die Wischaktionen der App --
// mit denselben Rückfragen und Modalen. Im schmalen Fenster bleibt die App.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  h, api, setSuccess, setError, routerPush, geoeffnet, letzteRueckfrage, knopfIn,
  zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT,
} from './geruestWeb';

const JAHRGAENGE = [{ id: 1, name: 'Jahrgang 2026' }, { id: 2, name: 'Jahrgang 2027' }];

const GOTTESDIENST = termin(201, 'Sonntagsgottesdienst', {
  event_date: inTagen(1), location: 'Kirche Musterdorf', points: 1, registered_count: 3, max_participants: 20,
  jahrgang_ids: '1', jahrgang_names: 'Jahrgang 2026', categories: [{ id: 5, name: 'Gottesdienst' }],
});
const KONFI_TAG = termin(202, 'Konfi-Tag', {
  event_date: inTagen(14), location: 'Küstenkapelle Büsum', registration_status: 'mandatory', mandatory: true,
  jahrgang_ids: '2', jahrgang_names: 'Jahrgang 2027', registered_count: 12, max_participants: 30,
});
const TEAMABEND = termin(203, 'Teamabend', {
  event_date: inTagen(5), teamer_only: true, teamer_needed: true, registered_count: 0, max_participants: 0,
  teamer_count: 4, teamer_max_participants: 8, jahrgang_ids: '',
});
const GEMEINDEFEST = termin(204, 'Gemeindefest', {
  event_date: inTagen(-2), location: 'Gemeindehaus', points: 2, registered_count: 8, pending_bookings_count: 5,
  jahrgang_ids: '1', jahrgang_names: 'Jahrgang 2026',
});
const ERNTEDANK = termin(205, 'Erntedank-Gottesdienst', {
  event_date: inTagen(-20), location: 'Kirche Musterdorf', points: 1, registered_count: 6, pending_bookings_count: 0,
  jahrgang_ids: '1', jahrgang_names: 'Jahrgang 2026', categories: [{ id: 5, name: 'Gottesdienst' }],
});
const FAHRRADTOUR = termin(206, 'Fahrradtour', {
  event_date: inTagen(10), registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung',
  registered_count: 9, jahrgang_ids: '1', jahrgang_names: 'Jahrgang 2026',
});

const EVENTS = [KONFI_TAG, GOTTESDIENST, TEAMABEND, GEMEINDEFEST, ERNTEDANK];

const ANTRAEGE = [
  { id: 71, konfi_id: 11, konfi_name: 'Mia Muster', jahrgang_name: 'Jahrgang 2026', activity_id: 3, activity_name: 'Gemeindefest helfen', activity_type: 'gemeinde', activity_points: 2, requested_date: '2026-09-27', comment: 'Beim Aufbau geholfen', status: 'pending', created_at: '2026-10-02T09:00:00Z', updated_at: '2026-10-02T09:00:00Z' },
  { id: 72, konfi_id: 12, konfi_name: 'Ben Beispiel', jahrgang_name: 'Jahrgang 2026', activity_id: 1, activity_name: 'Sonntagsgottesdienst', activity_type: 'gottesdienst', activity_points: 1, requested_date: '2026-09-20', status: 'approved', approved_by_name: 'Lea Leitung', created_at: '2026-09-21T09:00:00Z', updated_at: '2026-09-21T10:00:00Z' },
  { id: 73, konfi_id: 13, konfi_name: 'Zoe Probe', jahrgang_name: 'Jahrgang 2027', activity_id: 3, activity_name: 'Gemeindefest helfen', activity_type: 'gemeinde', activity_points: 2, requested_date: '2026-09-10', status: 'rejected', admin_comment: 'Nicht belegt', created_at: '2026-09-11T09:00:00Z', updated_at: '2026-09-11T10:00:00Z' },
];

const DATEN = { 'admin:events-cancelled:': [FAHRRADTOUR], 'admin:jahrgaenge:': JAHRGAENGE, 'admin:requests:': ANTRAEGE };

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

const oeffneEvents = (nutzer: 'leitung' | 'admin' | 'teamer' = 'leitung', suche = '', events = EVENTS) => {
  richteEin({ nutzer, pfad: '/admin/events', suche, daten: { ...DATEN, 'admin:events:': events } });
  return oeffne('leitung');
};

/** Die Namen der Events in der Tabelle, von oben nach unten. */
const namenInTabelle = () => within(screen.getByRole('table', { name: 'Events' }))
  .getAllByRole('row').slice(1)
  .map((zeile) => within(zeile).getAllByRole('link')[0].textContent!.replace(/, abgesagt$/, ''));

const zeileVon = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement;
const chip = (name: RegExp) => screen.getByRole('button', { name });

describe('Kopf und Reiter', () => {
  it('Titel "Events", drei Reiter als echte Links, "Events" ist der aktuelle', async () => {
    await oeffneEvents();
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
    const reiter = within(screen.getByRole('navigation', { name: 'Bereiche von Mitmachen' })).getAllByRole('link');
    expect(reiter.map((a) => a.textContent)).toEqual(['Events', 'Aktivitäten', 'Anträge']);
    expect(reiter.map((a) => a.getAttribute('href'))).toEqual(['/admin/events', '/admin/events?segment=aktivitaeten', '/admin/events?segment=antraege']);
    expect(reiter.map((a) => a.getAttribute('aria-current'))).toEqual(['page', null, null]);
  });

  it('orange Zahlen: Events zum Verbuchen und offene Anträge, mit ganzem Satz zum Vorlesen', async () => {
    h.badge = { pendingEventsCount: 3, pendingRequestsCount: 1 };
    await oeffneEvents();
    const nav = screen.getByRole('navigation', { name: 'Bereiche von Mitmachen' });
    expect(within(nav).getByRole('img', { name: '3 Events warten auf Verbuchung' })).toHaveTextContent('3');
    expect(within(nav).getByRole('img', { name: '1 Antrag wartet auf Entscheidung' })).toHaveTextContent('1');
  });

  it('ein Klick auf einen Reiter bleibt in der App (Router) und lädt nichts neu', async () => {
    await oeffneEvents();
    fireEvent.click(screen.getByRole('link', { name: 'Anträge' }));
    expect(routerPush).toHaveBeenCalledWith('/admin/events?segment=antraege', 'none', 'push');
  });

  it('Aktualisieren lädt Events und abgesagte Events neu', async () => {
    await oeffneEvents();
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await act(async () => { await Promise.resolve(); });
    expect(h.neuGeladen).toEqual(['admin:events:1', 'admin:events-cancelled:1']);
  });
});

describe('Events: Zeitraum', () => {
  it('Aktuell (Standard): kommende Events nach Datum, auch das abgesagte -- nichts Vergangenes', async () => {
    await oeffneEvents();
    expect(namenInTabelle()).toEqual(['Sonntagsgottesdienst', 'Teamabend', 'Fahrradtour', 'Konfi-Tag']);
  });

  it('die Chips zählen die vier Zeiträume; "Verbuchen" trägt die Zahl auch für Vorleseprogramme', async () => {
    await oeffneEvents();
    expect(chip(/^Aktuell/)).toHaveTextContent(/^Aktuell4$/);
    expect(chip(/^Verbuchen/)).toHaveTextContent(/^Verbuchen1 zum Verbuchen$/);
    expect(chip(/^Vergangen/)).toHaveTextContent(/^Vergangen1$/);
    expect(chip(/^Abgesagt/)).toHaveTextContent(/^Abgesagt1$/);
    expect(chip(/^Aktuell/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Vergangen/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('Klick auf "Verbuchen": nur das Event mit offenen Buchungen, Status "Verbuchen"', async () => {
    await oeffneEvents();
    fireEvent.click(chip(/^Verbuchen/));
    expect(chip(/^Verbuchen/)).toHaveAttribute('aria-pressed', 'true');
    expect(namenInTabelle()).toEqual(['Gemeindefest']);
    expect(within(zeileVon('Gemeindefest')).getByText('Verbuchen')).toBeInTheDocument();
  });

  it('Klick auf "Vergangen": das fertig verbuchte Event, Status "Verbucht"', async () => {
    await oeffneEvents();
    fireEvent.click(chip(/^Vergangen/));
    expect(namenInTabelle()).toEqual(['Erntedank-Gottesdienst']);
    expect(within(zeileVon('Erntedank-Gottesdienst')).getByText('Verbucht')).toBeInTheDocument();
  });

  it('Klick auf "Abgesagt": das abgesagte Event mit Grund und Marke', async () => {
    await oeffneEvents();
    fireEvent.click(chip(/^Abgesagt/));
    expect(namenInTabelle()).toEqual(['Fahrradtour']);
    const zeile = zeileVon('Fahrradtour');
    expect(within(zeile).getByText('Abgesagt', { selector: '.web-pill' })).toBeInTheDocument();
    expect(zeile).toHaveTextContent('Abgesagt: Sturmwarnung');
  });

  it('?filter=verbuchen in der Adresse wählt den Zeitraum vor', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/events', suche: '?filter=verbuchen', daten: { ...DATEN, 'admin:events:': EVENTS } });
    await oeffne('leitung');
    expect(chip(/^Verbuchen/)).toHaveAttribute('aria-pressed', 'true');
    expect(namenInTabelle()).toEqual(['Gemeindefest']);
  });

  it('wechselt die Adresse (Link in der Leiste), gilt der Filter der neuen Adresse', async () => {
    const seite = await oeffneEvents();
    expect(namenInTabelle()).toHaveLength(4);
    await seite.wechsleAdresse('/admin/events', '?filter=abgesagt');
    expect(namenInTabelle()).toEqual(['Fahrradtour']);
  });

  it('leerer Zeitraum: Hinweis statt leerer Tabelle', async () => {
    await oeffneEvents('leitung', '', [GOTTESDIENST]);
    fireEvent.click(chip(/^Vergangen/));
    expect(screen.queryByRole('table', { name: 'Events' })).toBe(null);
    expect(screen.getByText('Keine vergangenen Events')).toBeInTheDocument();
  });
});

describe('Events: Filter und Suche', () => {
  it('Jahrgang: nur Events dieses Jahrgangs; "Filter zurücksetzen" nimmt alles zurück', async () => {
    await oeffneEvents();
    fireEvent.change(screen.getByLabelText('Jahrgang'), { target: { value: '2' } });
    expect(namenInTabelle()).toEqual(['Konfi-Tag']);
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(namenInTabelle()).toHaveLength(4);
    expect(screen.getByLabelText('Jahrgang')).toHaveValue('alle');
    expect(screen.queryByRole('button', { name: 'Filter zurücksetzen' })).toBe(null);
  });

  it('Kategorie: die Auswahl nennt nur vorhandene Kategorien; sie filtert', async () => {
    await oeffneEvents();
    const auswahl = screen.getByLabelText('Kategorie');
    expect(within(auswahl).getAllByRole('option').map((o) => o.textContent)).toEqual(['Alle Kategorien', 'Gottesdienst']);
    fireEvent.change(auswahl, { target: { value: 'Gottesdienst' } });
    expect(namenInTabelle()).toEqual(['Sonntagsgottesdienst']);
  });

  it('Art: Pflicht-Events und Nur Team', async () => {
    await oeffneEvents();
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'pflicht' } });
    expect(namenInTabelle()).toEqual(['Konfi-Tag']);
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'team' } });
    expect(namenInTabelle()).toEqual(['Teamabend']);
  });

  it('Suche findet nach Name und Ort, Umlaute austauschbar ("buesum" findet Büsum)', async () => {
    await oeffneEvents();
    const feld = screen.getByRole('searchbox', { name: 'Events durchsuchen' });
    fireEvent.change(feld, { target: { value: 'sonntag' } });
    expect(namenInTabelle()).toEqual(['Sonntagsgottesdienst']);
    fireEvent.change(feld, { target: { value: 'buesum' } });
    expect(namenInTabelle()).toEqual(['Konfi-Tag']);
  });

  it('Suche ohne Treffer: Hinweis mit Weg zurück', async () => {
    await oeffneEvents();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Events durchsuchen' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Filter zurücksetzen' }).at(-1)!);
    expect(namenInTabelle()).toHaveLength(4);
  });

  it('der Name eines Events ist ein echter Link auf das Event', async () => {
    await oeffneEvents();
    const link = screen.getByRole('link', { name: 'Konfi-Tag' });
    expect(link).toHaveAttribute('href', '/admin/events/202');
    fireEvent.click(link);
    expect(routerPush).toHaveBeenCalledWith('/admin/events/202', 'none', 'push');
  });

  it('Zeile: Wann, Ort, Teilnahme und Punkte stehen in eigenen Spalten', async () => {
    await oeffneEvents();
    const zeile = zeileVon('Sonntagsgottesdienst');
    const zellen = within(zeile).getAllByRole('cell');
    expect(zellen[0]).toHaveTextContent('Jahrgang 2026');
    expect(zellen[1]).toHaveTextContent('So., 04.10.2026');
    expect(zellen[1]).toHaveTextContent('10:00');
    expect(zellen[2]).toHaveTextContent('Kirche Musterdorf');
    expect(zellen[2]).toHaveTextContent('Gottesdienst');
    expect(zellen[3]).toHaveTextContent('Plätze: 3/20');
    expect(zellen[4]).toHaveTextContent('Punkte: 1');
    expect(zellen[5]).toHaveTextContent('Offen');
  });
});

describe('Events: Aktionen -- dieselben Funktionen wie die Wischaktionen der App', () => {
  it('"Neues Event anlegen" öffnet das Event-Fenster', async () => {
    await oeffneEvents();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Event anlegen' }));
    expect(geoeffnet('EventModal')).toHaveLength(1);
  });

  it('Kopieren öffnet das Fenster, legt aber nichts an', async () => {
    await oeffneEvents();
    fireEvent.click(within(zeileVon('Sonntagsgottesdienst')).getByRole('button', { name: 'Event kopieren' }));
    await act(async () => { await Promise.resolve(); });
    expect(geoeffnet('EventModal')).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Absagen öffnet das Absage-Fenster mit dem Event', async () => {
    await oeffneEvents();
    fireEvent.click(within(zeileVon('Konfi-Tag')).getByRole('button', { name: 'Event absagen' }));
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(1);
  });

  it('Löschen fragt erst nach und ruft erst nach "Löschen" DELETE auf das Event', async () => {
    await oeffneEvents();
    fireEvent.click(within(zeileVon('Teamabend')).getByRole('button', { name: 'Event löschen' }));
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Event löschen');
    expect(frage.message).toBe('Event "Teamabend" wirklich löschen?');
    expect(api.delete).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Löschen')!.handler!(); });
    expect(api.delete).toHaveBeenCalledWith('/events/203');
    expect(h.neuGeladen).toEqual(['admin:events:1', 'admin:events-cancelled:1']);
  });

  it('am abgesagten Event: Absagegrund bearbeiten und Absage zurücknehmen, nicht noch einmal absagen', async () => {
    await oeffneEvents();
    fireEvent.click(chip(/^Abgesagt/));
    const zeile = zeileVon('Fahrradtour');
    expect(within(zeile).queryByRole('button', { name: 'Event absagen' })).toBe(null);
    fireEvent.click(within(zeile).getByRole('button', { name: 'Absagegrund bearbeiten' }));
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(1);
    fireEvent.click(within(zeile).getByRole('button', { name: 'Absage zurücknehmen' }));
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Absage zurücknehmen?');
    expect(api.put).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Zurücknehmen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/206/reaktivieren');
  });

  it('offline: kein Fenster, keine Rückfrage, eine Meldung', async () => {
    h.online = false;
    await oeffneEvents();
    fireEvent.click(within(zeileVon('Konfi-Tag')).getByRole('button', { name: 'Event absagen' }));
    fireEvent.click(within(zeileVon('Konfi-Tag')).getByRole('button', { name: 'Event kopieren' }));
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(0);
    expect(geoeffnet('EventModal')).toHaveLength(0);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setSuccess).not.toHaveBeenCalled();
  });
});

describe.each(['leitung', 'admin'] as const)('ERLAUBT: %s verwaltet Events', (rolle) => {
  it('sieht "Neues Event anlegen" und an jeder Zeile Kopieren, Absagen und Löschen', async () => {
    await oeffneEvents(rolle);
    expect(screen.getByRole('button', { name: 'Neues Event anlegen' })).toBeInTheDocument();
    // Vier Zeilen: drei Events zum Absagen, das abgesagte bietet stattdessen Grund und Rücknahme an.
    expect(screen.getAllByRole('button', { name: 'Event kopieren' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Event absagen' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Event löschen' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Absagegrund bearbeiten' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Absage zurücknehmen' })).toHaveLength(1);
  });
});

describe('VERBOTEN: Teamer:innen', () => {
  it('sehen die Tabelle, aber weder "Neues Event anlegen" noch eine Aktion an der Zeile', async () => {
    await oeffneEvents('teamer');
    expect(namenInTabelle()).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Neues Event anlegen' })).toBe(null);
    for (const name of ['Event kopieren', 'Event absagen', 'Event löschen', 'Absage zurücknehmen']) {
      expect(screen.queryByRole('button', { name })).toBe(null);
    }
    expect(screen.queryByRole('columnheader', { name: 'Aktionen' })).toBe(null);
  });
});

describe('Laden und Fehler', () => {
  it('solange die Events laden, steht ein Platzhalter statt der Tabelle', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/events', daten: DATEN });
    h.laedt.add('admin:events:');
    await oeffne('leitung');
    expect(screen.getByText('Die Events werden geladen.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Events' })).toBe(null);
  });
});

describe('Schmales Fenster: die App bleibt, wie sie ist', () => {
  it('keine Tabelle, keine Link-Reiter -- die Reiter der App und "Neues Event anlegen" in der Kopfzeile', async () => {
    h.breit = false;
    await oeffneEvents();
    expect(screen.queryByRole('table')).toBe(null);
    expect(screen.queryByRole('navigation', { name: 'Bereiche von Mitmachen' })).toBe(null);
    // Oben Events | Aktivitäten, darunter Aktuell | Verbuchen | Vergangen -- wie bisher.
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('data-wert'))).toEqual(['events', 'antraege', 'aktuell', 'verbuchen', 'vergangen']);
    expect(within(screen.getByTestId('kopfzeile')).getByRole('button', { name: 'Neues Event anlegen' })).toBeInTheDocument();
    // Die App zeigt Events als Zeilen mit Wischaktionen.
    expect(screen.getAllByTestId('termin').length).toBeGreaterThan(0);
  });
});
