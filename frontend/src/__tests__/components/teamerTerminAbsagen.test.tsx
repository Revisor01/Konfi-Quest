// Teamer:innen verwalten KEINE Termine (16.09.2026) -- gerendert (Audit
// Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Simons Entscheidung, wörtlich: "teamer erstellen keine veranstaltungen
// fertig. das machen admins und org admins. das ist einfach nicht der weg. ich
// halte das fuer zu komplex. lass es uns rausnehmen. also auch nicht loeschen
// und absagen" -- gesperrt in BEIDEN Ebenen, Oberfläche UND Backend.
//
// Die zweite Ebene liegt im Backend: POST /events, PUT /events/:id,
// DELETE /events/:id, PUT /events/:id/cancel, /absagegrund, /reaktivieren und
// POST /events/:id/chat stehen hinter requireAdmin. Die 403/200-Gegenprobe
// dazu steht in backend/tests/routes/rbacTermine.test.js.
//
// Diese Datei prüft die Oberfläche an der gerenderten Seite: Egal, was das
// Team in Liste und Detail antippt -- es geht keine Verwaltungs-Route hinaus,
// und es gibt keinen Knopf und keinen Wisch, der eine verspricht.
//
// WAS DEM TEAM BLEIBT und hier ausdrücklich geprüft wird: die eigene Zu- und
// Absage der TEILNAHME, der QR-Code zum Einchecken, der Termin-Chat und alles
// Lesende -- darunter der Absage-Block, denn ein abgesagter Termin muss
// weiterhin als solcher zu sehen sein, samt Grund.
//
// Dass die Leitungsliste Absagen, Absagegrund, Zurücknehmen und Löschen
// weiter anbietet und die Konfi-Liste gar keine Wisch-Aktionen hat, prüft
// terminListeRechteGerendert an den dortigen Listen.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffneListe, oeffneTermin, zeileVon, knopf, abschnitt, tippeAlleKnoepfe,
  api, modale, zuletztGeoeffnet, routerPush,
} from './gerueste/teamerTerminSeite';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

const VERWALTUNG = ['Event absagen', 'Absagegrund bearbeiten', 'Absage zurücknehmen', 'Event löschen', 'Event bearbeiten', 'Event kopieren', 'Neues Event anlegen'];

const AKTIV = termin({ id: 77, name: 'Konfi-Freizeit', chat_room_id: 55 } as Partial<Event>);
const ABGESAGT = termin({
  id: 78, name: 'Konfi-Tag', registration_status: 'cancelled', cancelled: true,
  cancelled_reason: 'Sturmwarnung', cancelled_by_name: 'Pastor Luthe', cancelled_at: '2026-09-15T08:00:00Z',
});

/** Alle Aufrufe, die etwas verändern -- auf allen Wegen. */
const schreibendeAufrufe = () => [
  ...api.post.mock.calls.map((c) => `POST ${c[0]}`),
  ...api.put.mock.calls.map((c) => `PUT ${c[0]}`),
  ...api.delete.mock.calls.map((c) => `DELETE ${c[0]}`),
];

describe('die Teamer-Liste hat keine Wisch-Aktionen', () => {
  it('kein Wisch an aktiven und abgesagten Terminen, keine Verwaltungs-Knöpfe', async () => {
    zustand.events = [AKTIV, ABGESAGT];
    await oeffneListe('alle');
    expect(screen.queryAllByTestId('wisch')).toHaveLength(0);
    expect(document.querySelectorAll('[data-wisch]')).toHaveLength(0);
    for (const name of VERWALTUNG) expect(knopf(name), name).toBeNull();
  });

  it('die Zeile ist ein schlichter Eintrag: Antippen öffnet den Termin, sonst nichts', async () => {
    zustand.events = [AKTIV];
    await oeffneListe('alle');
    await act(async () => { fireEvent.click(zeileVon('Konfi-Freizeit')); });
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Konfi-Freizeit');
    expect(schreibendeAufrufe()).toEqual([]);
  });
});

describe('die Teamer-Seite ruft keine Verwaltungs-Route auf', () => {
  it('Liste: jeden Knopf antippen -- kein Anlegen, Ändern, Absagen, Löschen', async () => {
    zustand.events = [AKTIV, ABGESAGT];
    await oeffneListe('alle');
    await tippeAlleKnoepfe();
    expect(schreibendeAufrufe()).toEqual([]);
  });

  it('Detail eines aktiven Termins: jeden Knopf antippen -- nur die eigene Zusage geht hinaus', async () => {
    zustand.events = [AKTIV];
    await oeffneTermin('Konfi-Freizeit');
    await tippeAlleKnoepfe();
    // "Dabei" sendet die eigene Zusage; "Nicht dabei" öffnet nur den Dialog.
    expect(schreibendeAufrufe()).toEqual(['POST /teamer/events/77/zusage']);
  });

  it('Detail eines abgesagten Termins: jeden Knopf antippen -- kein Aufruf, weder /cancel noch /absagegrund noch /reaktivieren', async () => {
    zustand.events = [ABGESAGT];
    await oeffneTermin('Konfi-Tag');
    await tippeAlleKnoepfe();
    expect(schreibendeAufrufe()).toEqual([]);
  });

  it('kein Anlegen eines Termin-Chats: ohne Raum gibt es keinen Chat-Knopf', async () => {
    zustand.events = [termin({ chat_room_id: null } as Partial<Event>)];
    await oeffneTermin('Konfi-Freizeit');
    expect(knopf('Event-Chat öffnen')).toBeNull();
    await tippeAlleKnoepfe();
    expect(schreibendeAufrufe().filter((a) => a.includes('/chat'))).toEqual([]);
  });
});

describe('das Absage-Modal der Leitung ist nicht eingebunden', () => {
  it('die Seite meldet TerminAbsagenModal nicht an -- weder in der Liste noch im Detail', async () => {
    zustand.events = [AKTIV, ABGESAGT];
    await oeffneTermin('Konfi-Freizeit');
    expect(modale.angemeldet.has('TeamerAbsageModal')).toBe(true);
    expect(modale.angemeldet.has('TerminAbsagenModal')).toBe(false);
  });

  it('der Detail-Knopf "Event absagen" fehlt', async () => {
    zustand.events = [AKTIV];
    await oeffneTermin('Konfi-Freizeit');
    expect(knopf('Event absagen')).toBeNull();
  });
});

describe('was dem Team bleibt', () => {
  it('die eigene Zu- und Absage der TEILNAHME: Zusage über die Zusage-Route, Absage über den eigenen Dialog', async () => {
    zustand.events = [AKTIV];
    await oeffneTermin('Konfi-Freizeit');
    await act(async () => { fireEvent.click(knopf('Dabei')!); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/77/zusage', { dabei: true });
    await act(async () => { fireEvent.click(knopf('Nicht dabei')!); });
    expect(zuletztGeoeffnet('TeamerAbsageModal')).toBeDefined();
  });

  it('der QR-Code zum Einchecken bleibt und öffnet die Anzeige für diesen Termin', async () => {
    zustand.events = [AKTIV];
    await oeffneTermin('Konfi-Freizeit');
    await act(async () => { fireEvent.click(knopf('QR-Code zum Einchecken anzeigen')!); });
    const qr = zuletztGeoeffnet('QRDisplayModal');
    expect(qr?.props.eventId).toBe(77);
    expect(qr?.props.eventName).toBe('Konfi-Freizeit');
  });

  it('der Termin-Chat lässt sich weiter ÖFFNEN -- ein Sprung in den vorhandenen Raum', async () => {
    zustand.events = [AKTIV];
    await oeffneTermin('Konfi-Freizeit');
    await act(async () => { fireEvent.click(knopf('Event-Chat öffnen')!); });
    expect(routerPush).toHaveBeenCalledWith('/teamer/chat/room/55', 'root');
    expect(schreibendeAufrufe()).toEqual([]);
  });

  it('ein abgesagter Termin ist als abgesagt zu SEHEN, samt Grund -- im Detail als Kasten', async () => {
    zustand.events = [ABGESAGT];
    await oeffneTermin('Konfi-Tag');
    const kasten = abschnitt('Absage')!;
    expect(within(kasten).getByText('Grund')).toBeInTheDocument();
    expect(within(kasten).getByText('Sturmwarnung')).toBeInTheDocument();
    expect(within(kasten).getByText(/Pastor Luthe/)).toBeInTheDocument();
  });

  it('... und in der Liste als Zeile', async () => {
    zustand.events = [ABGESAGT];
    await oeffneListe('alle');
    expect(within(zeileVon('Konfi-Tag')).getByText('Abgesagt:').parentElement!.textContent).toBe('Abgesagt: Sturmwarnung');
  });

  it('der Absage-Block ist reine Auskunft: keine Knöpfe darin', async () => {
    zustand.events = [ABGESAGT];
    await oeffneTermin('Konfi-Tag');
    expect(within(abschnitt('Absage')!).queryAllByRole('button')).toHaveLength(0);
  });
});
