// Ein Event beim Team in der Web-Fassung, gerendert (03.10.2026): die Adresse
// /teamer/events?eventId=<id> trägt, welches Event offen ist. Aufbau wie jede
// Detailseite (06.10.2026): im Kopf Titel, Kennzeichen und alle Aktionen --
// Chat, QR-Code, Zusage und Absage --, darunter die Kennzahlen; links die
// Beschreibung und, nur lesend, wer kommt; rechts die Angaben und das
// Material. Zusage und Absage laufen über dieselben Funktionen wie in der App
// (POST /teamer/events/:id/zusage, Absage-Fenster mit Grund). Verbucht wird
// bei der Leitung -- die Tabellen haben keine Knöpfe.
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
const kopf = () => screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
/** Die Knöpfe im Kopf in der Reihenfolge der Seite (Aktionen sind Knöpfe oben rechts). */
const knoepfeImKopf = () => within(kopf()).queryAllByRole('button').map((b) => b.textContent!.trim());
/** Was direkt unter dem Kopf steht, vor den Kennzahlen: Hinweise. */
const ersterBlock = () => document.querySelector('.web-detail')!.firstElementChild as HTMLElement;
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

describe('Aufbau wie jede Detailseite', () => {
  it('Aktionen im Kopf: Chat, QR-Code und die Zusage -- keine eigene Karte "Bist du dabei?"', async () => {
    await oeffneEvent(401);
    expect(knoepfeImKopf()).toEqual(['QR-Code', 'Nicht dabei', 'Dabei']);
    expect(within(kopf()).getByRole('button', { name: 'Dabei' })).toHaveClass('web-knopf--primaer');
    expect(within(kopf()).getByRole('button', { name: 'Nicht dabei' })).toHaveClass('web-knopf--gefahr');
    expect(screen.queryByRole('region', { name: 'Bist du dabei?' })).toBe(null);
  });

  it('mit Chat-Raum und Zusage steht der Chat vorn und nur der Weg zur Absage am Ende', async () => {
    await oeffneEvent(402);
    expect(knoepfeImKopf()).toEqual(['Chat', 'QR-Code', 'Nicht mehr dabei']);
  });

  it('die Kennzahlen stehen in einer Reihe unter dem Kopf, vor den Spalten', async () => {
    await oeffneEvent(402);
    const reihe = document.querySelector('.web-detail__kennzahlen') as HTMLElement;
    expect([...reihe.querySelectorAll('.web-kachel')].map((k) => k.getAttribute('aria-label'))).toEqual(['Konfis: 18', 'Team: 3', 'Punkte: 3']);
    expect(kopf().compareDocumentPosition(reihe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reihe.compareDocumentPosition(document.querySelector('.web-spalten')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links der Inhalt (Beschreibung, wer kommt), rechts der Block "Angaben" mit Angaben und Material', async () => {
    await oeffneEvent(402, { teilnehmende: TEILNEHMENDE, material: MATERIAL });
    const [haupt, seite] = [...document.querySelector('.web-spalten')!.children] as HTMLElement[];
    expect(seite.tagName).toBe('ASIDE');
    expect(seite).toHaveAttribute('aria-label', 'Angaben');
    expect(within(haupt).getByRole('region', { name: 'Beschreibung' })).toBeInTheDocument();
    expect(within(haupt).getByRole('region', { name: 'Konfis (2)' })).toBeInTheDocument();
    expect(within(haupt).getByRole('region', { name: 'Team (1)' })).toBeInTheDocument();
    expect(within(seite).getByRole('region', { name: 'Angaben' })).toBeInTheDocument();
    expect(within(seite).getByRole('region', { name: 'Material (2)' })).toBeInTheDocument();
    expect(within(seite).queryByRole('region', { name: 'Beschreibung' })).toBe(null);
    expect(within(haupt).queryByRole('region', { name: 'Angaben' })).toBe(null);
  });
});

describe('Kennzahlen, Beschreibung, Angaben, Material', () => {
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

describe('Kopf: Zusage und Absage', () => {
  it('zugesagt: nur der rote Weg zurück -- "Nicht mehr dabei" öffnet das Absage-Fenster, sendet noch nichts', async () => {
    await oeffneEvent(402);
    expect(within(kopf()).queryByRole('button', { name: 'Dabei' })).toBe(null);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Nicht mehr dabei' }));
    expect(geoeffnet('TeamerAbsageModal')).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('noch nichts gesagt: beide Knöpfe; "Dabei" sendet die Zusage und lädt das Event neu', async () => {
    await oeffneEvent(401);
    expect(within(kopf()).getByRole('button', { name: 'Nicht dabei' })).toBeInTheDocument();
    h.api.get.mockClear();
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Dabei' })); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/401/zusage', { dabei: true });
    expect(setSuccess).toHaveBeenCalledWith('Du bist dabei');
    expect(h.api.get).toHaveBeenCalledWith('/events/401');
  });

  it('"Nicht dabei" öffnet das Absage-Fenster (der Grund ist dort freiwillig)', async () => {
    await oeffneEvent(401);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Nicht dabei' }));
    expect(geoeffnet('TeamerAbsageModal')).toHaveLength(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('eine Absage von dir: nur der grüne Weg zurück "Doch dabei"', async () => {
    const abgesagt = termin(401, 'Teamabend', { ...TEAMABEND, booking_status: 'opted_out' });
    await oeffneEvent(401, { events: [abgesagt, ...EVENTS.filter((e) => e.id !== 401)] });
    expect(knoepfeImKopf()).toEqual(['QR-Code', 'Doch dabei']);
    expect(within(kopf()).getByRole('button', { name: 'Doch dabei' })).toHaveClass('web-knopf--primaer');
  });

  it('offline: die Zusage ist gesperrt ("Du bist offline"), der Weg zur Absage bleibt', async () => {
    h.online = false;
    await oeffneEvent(401);
    expect(within(kopf()).getByRole('button', { name: 'Du bist offline' })).toBeDisabled();
    expect(within(kopf()).getByRole('button', { name: 'Nicht dabei' })).toBeEnabled();
  });

  it('Fehler beim Senden: die Meldung des Servers, kein "Du bist dabei"', async () => {
    h.api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Kein Platz mehr' } } }));
    await oeffneEvent(401);
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Dabei' })); });
    expect(setError).toHaveBeenCalledWith('Kein Platz mehr');
    expect(setSuccess).not.toHaveBeenCalled();
  });

  it('reines Konfi-Event: "Nur zur Info - keine Anmeldung" als Hinweis, keine Knöpfe zur Zusage', async () => {
    await oeffneEvent(403);
    expect(ersterBlock()).toHaveTextContent('Nur zur Info - keine Anmeldung');
    expect(ersterBlock()).toHaveClass('web-hinweis--hinweis');
    expect(knoepfeImKopf()).toEqual(['QR-Code']);
  });

  it('abgesagtes Event: der Hinweis mit Grund steht einmal, keine Knöpfe zur Zusage', async () => {
    await oeffneEvent(405);
    expect(ersterBlock()).toHaveTextContent('Dieses Event ist abgesagt');
    expect(ersterBlock()).toHaveTextContent('Grund: Sturmwarnung');
    expect(screen.getAllByText('Dieses Event ist abgesagt')).toHaveLength(1);
    expect(knoepfeImKopf()).toEqual(['QR-Code']);
  });

  it('vergangen und angemeldet: "Anwesend" als Auskunft, keine Knöpfe zur Zusage', async () => {
    await oeffneEvent(406);
    expect(ersterBlock()).toHaveTextContent('Anwesend');
    expect(ersterBlock()).toHaveClass('web-hinweis--erfolg');
    expect(knoepfeImKopf()).toEqual(['QR-Code']);
  });

  it('vergangen ohne Teilnahme: weder Hinweis noch Knöpfe zur Zusage', async () => {
    const vergangen = termin(407, 'Gemeindefest', { event_date: inTagen(-2), teamer_needed: true });
    antworten({ eventId: 407 });
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=407', daten: { 'teamer:events:': [vergangen], 'teamer:requests:': [] } });
    await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('heading', { level: 1, name: 'Gemeindefest' })).toBeInTheDocument();
    expect(ersterBlock()).toHaveClass('web-detail__kennzahlen');
    expect(knoepfeImKopf()).toEqual(['QR-Code']);
  });
});

describe('Links: wer kommt -- nur lesend', () => {
  it('Konfis und Team getrennt, mit Status und Hinweisen; ohne Knöpfe zum Verbuchen', async () => {
    await oeffneEvent(402, { teilnehmende: TEILNEHMENDE });
    const konfis = karte('Konfis (2)');
    expect(within(konfis).getByText('Mia Muster')).toBeInTheDocument();
    expect(within(konfis).getByText('Ben Beispiel')).toBeInTheDocument();
    expect(konfis).toHaveTextContent('Jahrgang 2026');
    expect(konfis).toHaveTextContent('Krank');
    expect(within(karte('Team (1)')).getByText('Tim Teamer')).toBeInTheDocument();
    // Knöpfe gibt es nur im Kopf zum Sortieren -- in den Zeilen keinen.
    const zeilenKnoepfe = (k: HTMLElement) => within(k).getAllByRole('row').slice(1).flatMap((z) => within(z).queryAllByRole('button'));
    expect(zeilenKnoepfe(konfis)).toEqual([]);
    expect(zeilenKnoepfe(karte('Team (1)'))).toEqual([]);
  });

  it('"Name" und "Status" sortieren die Liste, ein zweiter Klick dreht', async () => {
    await oeffneEvent(402, { teilnehmende: [teilnehmer(1, 'Mia Muster'), teilnehmer(2, 'Ben Beispiel', { status: 'opted_out' }), teilnehmer(4, 'Zoe Probe')] });
    const tabelle = () => within(karte('Konfis (3)')).getByRole('table');
    const namen = () => within(tabelle()).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[0].querySelector('.web-zelle-titel')!.textContent);
    expect(namen()).toEqual(['Mia Muster', 'Ben Beispiel', 'Zoe Probe']);
    const kopf = within(tabelle()).getByRole('columnheader', { name: /^Name/ });
    fireEvent.click(within(kopf).getByRole('button'));
    expect(kopf).toHaveAttribute('aria-sort', 'ascending');
    expect(namen()).toEqual(['Ben Beispiel', 'Mia Muster', 'Zoe Probe']);
    fireEvent.click(within(kopf).getByRole('button'));
    expect(kopf).toHaveAttribute('aria-sort', 'descending');
    expect(namen()).toEqual(['Zoe Probe', 'Mia Muster', 'Ben Beispiel']);
    // Status nach dem Ablauf: "Gebucht" vor "Abgemeldet" -- Ben nach unten, die
    // anderen in der Reihenfolge der Seite (alphabetisch stünde Ben oben).
    fireEvent.click(within(within(tabelle()).getByRole('columnheader', { name: /^Status/ })).getByRole('button'));
    expect(namen()).toEqual(['Mia Muster', 'Zoe Probe', 'Ben Beispiel']);
    fireEvent.click(within(within(tabelle()).getByRole('columnheader', { name: /^Status/ })).getByRole('button'));
    expect(namen()).toEqual(['Ben Beispiel', 'Mia Muster', 'Zoe Probe']);
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
