// Ein Event beim Team in der Web-Fassung, gerendert (03.10.2026): die Adresse
// /teamer/events?eventId=<id> trägt, welches Event offen ist; zweispaltig --
// links Kennzahlen, Angaben, Beschreibung, Material; rechts "Bist du dabei?"
// mit Zusage und Absage und, nur lesend, wer kommt. Zusage und Absage laufen
// über dieselben Funktionen wie in der App (POST /teamer/events/:id/zusage,
// Absage-Fenster mit Grund). Verbucht wird bei der Leitung -- die Tabellen
// haben keine Knöpfe.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  h, api, setError, setSuccess, routerPush, geoeffnet,
  zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT,
} from './geruestWeb';

const teilnehmer = (id: number, name: string, zusatz: Record<string, unknown> = {}) => ({
  id, user_id: id + 100, participant_name: name, role_name: 'konfi', created_at: '2026-09-01T10:00:00Z',
  status: 'confirmed', attendance_status: null, jahrgang_name: 'Jahrgang 2026', ...zusatz,
});

const FREIZEIT = termin(402, 'Konfi-Freizeit', {
  event_date: inTagen(14), event_end_time: inTagen(16, 12), location: 'Jugendherberge Musterstadt', description: 'Drei Tage am See.',
  teamer_needed: true, teamer_registration_status: 'open', is_registered: true, booking_status: 'confirmed',
  teamer_count: 3, teamer_max_participants: 6, registered_count: 18, max_participants: 24, points: 3, chat_room_id: 55,
});
const TEAMABEND = termin(401, 'Teamabend', {
  event_date: inTagen(5), teamer_only: true, teamer_needed: true, teamer_registration_status: 'open', teamer_count: 2, teamer_max_participants: 8,
});
const GOTTESDIENST = termin(403, 'Sonntagsgottesdienst', { event_date: inTagen(1), registered_count: 3, max_participants: 20 });
const ABGESAGT = termin(405, 'Fahrradtour', {
  event_date: inTagen(10), registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung', teamer_needed: true,
});
const VERGANGEN = termin(406, 'Erntedank-Gottesdienst', {
  event_date: inTagen(-20), teamer_needed: true, is_registered: true, booking_status: 'confirmed', attendance_status: 'present',
});
const EVENTS = [FREIZEIT, TEAMABEND, GOTTESDIENST, ABGESAGT, VERGANGEN];

const TEILNEHMENDE = [
  teilnehmer(1, 'Mia Muster'),
  teilnehmer(2, 'Ben Beispiel', { status: 'opted_out', opt_out_reason: 'Krank' }),
  teilnehmer(3, 'Tim Teamer', { role_name: 'teamer', jahrgang_name: undefined }),
];
const MATERIAL = [
  { id: 11, title: 'Packliste', file_count: 1 },
  { id: 12, title: 'Programm', file_count: 0, link_url: 'https://example.org/programm' },
];

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

const antworten = (opt: { eventId: number; teilnehmende?: unknown[]; material?: unknown[]; events?: Array<{ id: number }> }) => {
  h.api.get.mockImplementation((pfad: string) => {
    if (pfad === `/events/${opt.eventId}`) {
      const roh = (opt.events ?? EVENTS).find((e) => e.id === opt.eventId);
      return Promise.resolve({ data: { ...roh, participants: opt.teilnehmende ?? [] } });
    }
    if (pfad === `/material/by-event/${opt.eventId}`) return Promise.resolve({ data: opt.material ?? [] });
    return Promise.resolve({ data: [] });
  });
};

const oeffneEvent = async (eventId: number, opt: { teilnehmende?: unknown[]; material?: unknown[]; events?: Array<{ id: number }> } = {}) => {
  antworten({ eventId, teilnehmende: opt.teilnehmende, material: opt.material, events: opt.events });
  richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: `?eventId=${eventId}`, daten: { 'teamer:events:': opt.events ?? EVENTS, 'teamer:requests:': [] } });
  const r = await oeffne('team');
  // Auswahl aus der Liste, Detail- und Materialabruf: ein paar Runden warten.
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  return r;
};

const karte = (titel: string | RegExp) => screen.getByRole('region', { name: titel });
const angabe = (label: string) => screen.getByText(label, { selector: 'dt' }).closest('div')!.querySelector('dd')!.textContent;

describe('Kopf: Titel, Zurück, Aktionen', () => {
  it('Titel und Untertitel nennen das Event; "Alle Events" ist ein echter Link zur Liste', async () => {
    await oeffneEvent(402);
    expect(screen.getByRole('heading', { level: 1, name: 'Konfi-Freizeit' })).toBeInTheDocument();
    const zurueck = screen.getByRole('link', { name: 'Alle Events' });
    expect(zurueck).toHaveAttribute('href', '/teamer/events');
    fireEvent.click(zurueck);
    expect(routerPush).toHaveBeenCalledWith('/teamer/events', 'none', 'push');
    // Status als Marke, Zeitraum als Text.
    expect(screen.getByText('Dabei', { selector: '.web-pill' })).toBeInTheDocument();
    expect(screen.getByText('Team gesucht', { selector: '.web-pill' })).toBeInTheDocument();
  });

  it('Chat (nur mit Chat-Raum) und QR-Code rufen dieselben Funktionen wie die App', async () => {
    await oeffneEvent(402);
    fireEvent.click(screen.getByRole('button', { name: 'Event-Chat öffnen' }));
    expect(routerPush).toHaveBeenCalledWith('/teamer/chat/room/55', 'root');
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code zum Einchecken anzeigen' }));
    expect(geoeffnet('QRDisplayModal')).toHaveLength(1);
  });

  it('ohne Chat-Raum gibt es keinen Chat-Knopf', async () => {
    await oeffneEvent(401);
    expect(screen.queryByRole('button', { name: 'Event-Chat öffnen' })).toBe(null);
    expect(screen.getByRole('button', { name: 'QR-Code zum Einchecken anzeigen' })).toBeInTheDocument();
  });
});

describe('Links: Kennzahlen, Angaben, Beschreibung, Material', () => {
  it('Kennzahlen: Konfis, Team und Punkte', async () => {
    await oeffneEvent(402);
    expect(screen.getByRole('group', { name: 'Konfis: 18' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Team: 3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Punkte: 3' })).toBeInTheDocument();
  });

  it('"Nur Team": Team und Warteliste statt Konfis', async () => {
    await oeffneEvent(401);
    expect(screen.getByRole('group', { name: 'Team: 2' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Warteliste: 0' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Konfis:/ })).toBe(null);
  });

  it('Angaben und Beschreibung', async () => {
    await oeffneEvent(402);
    expect(angabe('Teilnehmer:innen')).toBe('18 / 24');
    expect(angabe('Ort')).toBe('Jugendherberge Musterstadt');
    expect(within(karte('Beschreibung')).getByText('Drei Tage am See.')).toBeInTheDocument();
  });

  it('Material: Liste mit Dateizahl bzw. Link; ein Tipp öffnet das Material', async () => {
    await oeffneEvent(402, { material: MATERIAL });
    const material = karte('Material (2)');
    expect(within(material).getByText('1 Datei')).toBeInTheDocument();
    expect(within(material).getByText('Link')).toBeInTheDocument();
    fireEvent.click(within(material).getByRole('button', { name: 'Packliste' }));
    expect(geoeffnet('TeamerMaterialDetailPage')).toHaveLength(1);
    expect(h.api.get).toHaveBeenCalledWith('/material/by-event/402');
  });

  it('ohne Material keine Material-Karte', async () => {
    await oeffneEvent(402);
    expect(screen.queryByRole('region', { name: /^Material/ })).toBe(null);
  });
});

describe('Rechts: "Bist du dabei?"', () => {
  it('zugesagt: nur der rote Weg zurück -- "Nicht mehr dabei" öffnet das Absage-Fenster, sendet noch nichts', async () => {
    await oeffneEvent(402);
    const zusage = karte('Bist du dabei?');
    expect(within(zusage).queryByRole('button', { name: 'Dabei' })).toBe(null);
    fireEvent.click(within(zusage).getByRole('button', { name: 'Nicht mehr dabei' }));
    expect(geoeffnet('TeamerAbsageModal')).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('noch nichts gesagt: beide Knöpfe; "Dabei" sendet die Zusage und lädt das Event neu', async () => {
    await oeffneEvent(401);
    const zusage = karte('Bist du dabei?');
    expect(within(zusage).getByRole('button', { name: 'Nicht dabei' })).toBeInTheDocument();
    h.api.get.mockClear();
    await act(async () => { fireEvent.click(within(zusage).getByRole('button', { name: 'Dabei' })); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/401/zusage', { dabei: true });
    expect(setSuccess).toHaveBeenCalledWith('Du bist dabei');
    expect(h.api.get).toHaveBeenCalledWith('/events/401');
  });

  it('"Nicht dabei" öffnet das Absage-Fenster (der Grund ist dort freiwillig)', async () => {
    await oeffneEvent(401);
    fireEvent.click(within(karte('Bist du dabei?')).getByRole('button', { name: 'Nicht dabei' }));
    expect(geoeffnet('TeamerAbsageModal')).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('eine Absage von dir: nur der grüne Weg zurück "Doch dabei"', async () => {
    const abgesagt = termin(401, 'Teamabend', { ...TEAMABEND, booking_status: 'opted_out' });
    await oeffneEvent(401, { events: [abgesagt, ...EVENTS.filter((e) => e.id !== 401)] });
    const zusage = karte('Bist du dabei?');
    expect(within(zusage).getByRole('button', { name: 'Doch dabei' })).toBeInTheDocument();
    expect(within(zusage).queryByRole('button', { name: 'Nicht dabei' })).toBe(null);
  });

  it('offline: die Zusage ist gesperrt ("Du bist offline"), der Weg zur Absage bleibt', async () => {
    h.online = false;
    await oeffneEvent(401);
    const zusage = karte('Bist du dabei?');
    expect(within(zusage).getByRole('button', { name: 'Du bist offline' })).toBeDisabled();
    expect(within(zusage).getByRole('button', { name: 'Nicht dabei' })).toBeEnabled();
  });

  it('Fehler beim Senden: die Meldung des Servers, kein "Du bist dabei"', async () => {
    h.api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Kein Platz mehr' } } }));
    await oeffneEvent(401);
    await act(async () => { fireEvent.click(within(karte('Bist du dabei?')).getByRole('button', { name: 'Dabei' })); });
    expect(setError).toHaveBeenCalledWith('Kein Platz mehr');
    expect(setSuccess).not.toHaveBeenCalled();
  });

  it('reines Konfi-Event: "Nur zur Info - keine Anmeldung", keine Knöpfe', async () => {
    await oeffneEvent(403);
    const zusage = karte('Bist du dabei?');
    expect(zusage).toHaveTextContent('Nur zur Info - keine Anmeldung');
    expect(within(zusage).queryByRole('button')).toBe(null);
  });

  it('abgesagtes Event: Hinweis mit Grund, keine Knöpfe', async () => {
    await oeffneEvent(405);
    expect(karte('Bist du dabei?')).toHaveTextContent('Dieses Event ist abgesagt');
    expect(within(karte('Bist du dabei?')).queryByRole('button')).toBe(null);
    expect(screen.getAllByRole('status').some((s) => s.textContent!.includes('Grund: Sturmwarnung'))).toBe(true);
  });

  it('vergangen und angemeldet: "Anwesend" als Auskunft, keine Knöpfe', async () => {
    await oeffneEvent(406);
    expect(karte('Bist du dabei?')).toHaveTextContent('Anwesend');
    expect(within(karte('Bist du dabei?')).queryByRole('button')).toBe(null);
  });

  it('vergangen ohne Teilnahme: die ganze Karte entfällt', async () => {
    const vergangen = termin(407, 'Gemeindefest', { event_date: inTagen(-2), teamer_needed: true });
    antworten({ eventId: 407 });
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=407', daten: { 'teamer:events:': [vergangen], 'teamer:requests:': [] } });
    await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('heading', { level: 1, name: 'Gemeindefest' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bist du dabei?' })).toBe(null);
  });
});

describe('Rechts: wer kommt -- nur lesend', () => {
  it('Konfis und Team getrennt, mit Status und Hinweisen; ohne Knöpfe zum Verbuchen', async () => {
    await oeffneEvent(402, { teilnehmende: TEILNEHMENDE });
    const konfis = karte('Konfis (2)');
    expect(within(konfis).getByText('Mia Muster')).toBeInTheDocument();
    expect(within(konfis).getByText('Ben Beispiel')).toBeInTheDocument();
    expect(konfis).toHaveTextContent('Jahrgang 2026');
    expect(konfis).toHaveTextContent('Krank');
    expect(within(karte('Team (1)')).getByText('Tim Teamer')).toBeInTheDocument();
    expect(within(konfis).queryByRole('button')).toBe(null);
    expect(within(karte('Team (1)')).queryByRole('button')).toBe(null);
  });

  it('niemand angemeldet: keine Karten "Konfis" und "Team"', async () => {
    await oeffneEvent(402);
    expect(screen.queryByRole('region', { name: /^Konfis/ })).toBe(null);
    expect(screen.queryByRole('region', { name: /^Team \(/ })).toBe(null);
  });
});

describe('Adresse: ?eventId=', () => {
  it('ein Event aus der Liste öffnet sich, ohne die Liste zu zeigen', async () => {
    await oeffneEvent(402);
    expect(screen.queryByRole('navigation', { name: 'Bereiche von Mitmachen' })).toBe(null);
    expect(screen.queryByRole('article')).toBe(null);
  });

  it('solange die Liste lädt: "Event wird geladen"', async () => {
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=402', daten: { 'teamer:requests:': [] } });
    h.laedt.add('teamer:events:');
    await oeffne('team');
    expect(screen.getByRole('heading', { name: 'Event wird geladen' })).toBeInTheDocument();
  });

  it('ein Event, das diese Person nicht sehen darf (403, anderer Jahrgang): die Erklärung', async () => {
    h.api.get.mockImplementation((pfad: string) => (pfad === '/events/999'
      ? Promise.reject(Object.assign(new Error('x'), { response: { status: 403, data: { error_code: 'jahrgang_nicht_zugewiesen' } } }))
      : Promise.resolve({ data: [] })));
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=999', daten: { 'teamer:events:': EVENTS, 'teamer:requests:': [] } });
    await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('heading', { name: 'Nicht deinem Jahrgang zugeordnet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Events' })).toHaveAttribute('href', '/teamer/events');
  });

  it('ein gelöschtes Event (404): die Liste, keine Erklärung', async () => {
    h.api.get.mockImplementation((pfad: string) => (pfad === '/events/998'
      ? Promise.reject(Object.assign(new Error('x'), { response: { status: 404, data: { error: 'nicht gefunden' } } }))
      : Promise.resolve({ data: [] })));
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=998', daten: { 'teamer:events:': EVENTS, 'teamer:requests:': [] } });
    await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('heading', { name: 'Nicht deinem Jahrgang zugeordnet' })).toBe(null);
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });
});

describe('Schmales Fenster: die App bleibt, wie sie ist', () => {
  it('?eventId= zeigt die Detailansicht der App: Kopfzeile mit dem Event, kein Link "Alle Events"', async () => {
    h.breit = false;
    await oeffneEvent(402);
    expect(screen.queryByRole('link', { name: 'Alle Events' })).toBe(null);
    expect(screen.getByTestId('kopfzeile')).toHaveAttribute('data-titel', 'Konfi-Freizeit');
    expect(screen.queryByRole('region', { name: 'Bist du dabei?' })).toBe(null);
  });
});
