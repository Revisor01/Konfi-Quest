// Ein Event bei Konfis in der Web-Fassung, gerendert (03.10.2026):
// zweispaltig -- links Kennzahlen, Angaben, Beschreibung; rechts "Bist du
// dabei?" mit Anmelden und Abmelden, Einchecken und wer dabei ist. Welcher
// Knopf wann dasteht, entscheidet dieselbe Kette wie die Karte der App;
// Anmelden, Abmelden und Einchecken rufen dieselben Funktionen
// (POST /konfi/events/:id/register, Abmelde-Fenster, Scanner). Im schmalen
// Fenster bleibt die App.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffne, knopf, dabeiKarte, api, setError, setSuccess, presentAlert, modale, zuletztGeoeffnet, inTagen,
} from '../gerueste/konfiTerminDetail';

// Die erste Ansicht lädt die ganze Seite; in der vollen Suite unter Last reichen 5 Sekunden nicht.
vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));

beforeEach(() => {
  zuruecksetzen();
  breit.wert = true;
});

const geoeffnet = (name: string) => modale.geoeffnet.filter((m) => m.name === name);
const karte = (titel: string | RegExp) => screen.getByRole('region', { name: titel });
const dabei = () => karte('Bist du dabei?');

const SOMMERFEST = (zusatz: Partial<Parameters<typeof termin>[0]> = {}) => termin({
  id: 5, name: 'Sommerfest', description: 'Grillen im Gemeindegarten.', location: 'Gemeindegarten', event_date: inTagen(10),
  points: 2, max_participants: 10, registered_count: 4, can_register: true, ...zusatz,
});

describe('Kopf, Kennzahlen und Angaben', () => {
  it('Titel, Zurück-Link zur Liste und der Status als Marke', async () => {
    await oeffne(SOMMERFEST());
    expect(screen.getByRole('heading', { level: 1, name: 'Sommerfest' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Events' })).toHaveAttribute('href', '/konfi/events');
    expect(screen.getByText('Offen', { selector: '.web-pill' })).toBeInTheDocument();
  });

  it('Kennzahlen: Frei, Punkte, Dabei', async () => {
    await oeffne(SOMMERFEST());
    expect(screen.getByRole('group', { name: 'Frei: 6' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Punkte: 2' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dabei: 4' })).toBeInTheDocument();
  });

  it('Angaben und Beschreibung', async () => {
    await oeffne(SOMMERFEST());
    const angaben = screen.getByLabelText('Angaben zum Event');
    expect(within(angaben).getByRole('link', { name: 'Gemeindegarten' })).toBeInTheDocument();
    expect(within(karte('Beschreibung')).getByText('Grillen im Gemeindegarten.')).toBeInTheDocument();
  });

  it('Chat nur mit Chat-Raum', async () => {
    await oeffne(SOMMERFEST());
    expect(screen.queryByRole('button', { name: 'Event-Chat öffnen' })).toBe(null);
  });
});

describe('"Bist du dabei?": Anmelden', () => {
  it('Platz frei: grüner Knopf "Anmelden (4/10)"; ein Klick schickt POST /register ohne Zeitfenster', async () => {
    await oeffne(SOMMERFEST());
    const anmelden = within(dabei()).getByRole('button', { name: 'Anmelden (4/10)' });
    expect(anmelden).toHaveClass('web-knopf--erfolg');
    await act(async () => { fireEvent.click(anmelden); });
    expect(api.post).toHaveBeenCalledWith('/konfi/events/5/register', {});
    expect(setError).not.toHaveBeenCalled();
  });

  it('Anmeldefehler: die Meldung des Servers', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Anmeldung nicht mehr möglich' } } }));
    await oeffne(SOMMERFEST());
    await act(async () => { fireEvent.click(within(dabei()).getByRole('button', { name: 'Anmelden (4/10)' })); });
    expect(setError).toHaveBeenCalledWith('Anmeldung nicht mehr möglich');
  });

  it('Warteliste: "Wieder-Anmelden" nennt die Warteliste, die Antwort "waitlist" meldet es', async () => {
    api.post.mockResolvedValue({ data: { status: 'waitlist' } });
    await oeffne(SOMMERFEST({ registered_count: 10, waitlist_enabled: true, waitlist_count: 1, max_waitlist_size: 5 }));
    await act(async () => { fireEvent.click(within(dabei()).getByRole('button', { name: 'Warteliste offen (1/5)' })); });
    expect(api.post).toHaveBeenCalledWith('/konfi/events/5/register', {});
    expect(setSuccess).toHaveBeenCalledWith('Du bist auf der Warteliste. Wird ein Platz frei, rückst du automatisch nach.');
  });

  it('ausgebucht ohne Warteliste: der Knopf entfällt, es bleibt die Erklärung', async () => {
    await oeffne(SOMMERFEST({ registered_count: 10, can_register: false }));
    expect(within(dabei()).queryByRole('button', { name: /Anmelden/ })).toBe(null);
    expect(within(dabei()).getByRole('button', { name: 'Nicht verfügbar' })).toBeDisabled();
  });

  it('offline: "Du bist offline" -- gesperrt, kein POST', async () => {
    zustand.online = false;
    await oeffne(SOMMERFEST());
    const knopfOffline = within(dabei()).getByRole('button', { name: 'Du bist offline' });
    expect(knopfOffline).toBeDisabled();
    fireEvent.click(knopfOffline);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Zeitfenster-Event ohne Zeitfenster: kein POST, ein Hinweis', async () => {
    await oeffne(SOMMERFEST({ has_timeslots: true }));
    await act(async () => { fireEvent.click(within(dabei()).getByRole('button', { name: 'Anmelden (4/10)' })); });
    expect(api.post).not.toHaveBeenCalled();
    expect(presentAlert.mock.calls.at(-1)![0].header).toBe('Zeitfenster nicht geladen');
  });

  it('Konfirmation, wenn schon ein anderer Termin gebucht ist: kein Knopf, die Erklärung', async () => {
    const gebucht = termin({ id: 6, name: 'Konfirmation Frühling', is_konfirmation: true, is_registered: true, booking_status: 'confirmed', event_date: inTagen(40) });
    const neu = termin({ id: 8, name: 'Konfirmation Herbst', is_konfirmation: true, event_date: inTagen(80), can_register: true, max_participants: 20 });
    zustand.events = [gebucht, neu];
    await oeffne(neu);
    expect(within(dabei()).getByRole('button', { name: 'Konfirmationstermin bereits gebucht' })).toBeDisabled();
    expect(within(dabei()).queryByRole('button', { name: /^Anmelden/ })).toBe(null);
  });
});

describe('"Bist du dabei?": Abmelden', () => {
  const angemeldet = (zusatz: Parameters<typeof termin>[0] = {}) => SOMMERFEST({ is_registered: true, booking_status: 'confirmed', ...zusatz });

  it('angemeldet, mehr als 2 Tage vorher: roter Knopf "Abmelden" öffnet das Abmelde-Fenster, sendet noch nichts', async () => {
    await oeffne(angemeldet());
    const abmelden = within(dabei()).getByRole('button', { name: 'Abmelden' });
    expect(abmelden).toHaveClass('web-knopf--gefahr');
    fireEvent.click(abmelden);
    expect(geoeffnet('UnregisterModal')).toHaveLength(1);
    expect(zuletztGeoeffnet('UnregisterModal')!.props.mandatory).toBeUndefined();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('weniger als 2 Tage vorher: keine Abmeldung mehr, nur die Erklärung', async () => {
    await oeffne(angemeldet({ event_date: inTagen(1) }));
    expect(within(dabei()).queryByRole('button', { name: 'Abmelden' })).toBe(null);
    expect(within(dabei()).getByRole('button', { name: 'Abmelden geht nur bis 2 Tage vorher' })).toBeDisabled();
  });

  it('Warteliste: "Platz 2" und "Von der Warteliste abmelden"', async () => {
    await oeffne(SOMMERFEST({ booking_status: 'waitlist', waitlist_position: 2, registered_count: 10 }));
    expect(dabei()).toHaveTextContent('Du stehst auf Platz 2 der Warteliste');
    fireEvent.click(within(dabei()).getByRole('button', { name: 'Von der Warteliste abmelden' }));
    expect(geoeffnet('UnregisterModal')).toHaveLength(1);
  });

  it('Pflicht-Event: automatisch angemeldet; Abmelden öffnet das Fenster mit Grund, Wieder anmelden ruft opt-in', async () => {
    await oeffne(angemeldet({ mandatory: true, registration_status: 'mandatory', points: 0 }));
    expect(dabei()).toHaveTextContent('Du bist automatisch angemeldet');
    fireEvent.click(within(dabei()).getByRole('button', { name: 'Abmelden' }));
    // Dasselbe Fenster, aber im Pflicht-Modus (Grund mit mindestens 5 Zeichen).
    expect(geoeffnet('UnregisterModal')).toHaveLength(1);
    expect(zuletztGeoeffnet('UnregisterModal')!.props.mandatory).toBe(true);
  });

  it('Pflicht-Event, abgemeldet: "Wieder anmelden" ruft POST /opt-in', async () => {
    await oeffne(SOMMERFEST({ mandatory: true, registration_status: 'mandatory', points: 0, is_opted_out: true, booking_status: 'opted_out' }));
    expect(dabei()).toHaveTextContent('Du hast dich abgemeldet');
    await act(async () => { fireEvent.click(within(dabei()).getByRole('button', { name: 'Wieder anmelden' })); });
    expect(api.post).toHaveBeenCalledWith('/konfi/events/5/opt-in');
  });
});

describe('Einchecken, abgesagt, Teilnehmende', () => {
  it('angemeldet und noch nicht verbucht: "Einchecken" öffnet den Scanner', async () => {
    await oeffne(SOMMERFEST({ is_registered: true, booking_status: 'confirmed' }));
    fireEvent.click(within(dabei()).getByRole('button', { name: 'Einchecken' }));
    expect(geoeffnet('QRScannerModal')).toHaveLength(1);
  });

  it('schon anwesend: "Anwesend", kein Einchecken mehr', async () => {
    await oeffne(SOMMERFEST({ is_registered: true, booking_status: 'confirmed', attendance_status: 'present', event_date: inTagen(-1) }));
    expect(dabei()).toHaveTextContent('Anwesend');
    expect(within(dabei()).queryByRole('button', { name: 'Einchecken' })).toBe(null);
  });

  it('abgesagt: Hinweis mit Grund, "Abgemeldet" statt "Frei", keine Knöpfe', async () => {
    await oeffne(SOMMERFEST({ registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung', abgemeldet_count: 3 }));
    expect(screen.getAllByRole('status').some((s) => s.textContent!.includes('Grund: Sturmwarnung'))).toBe(true);
    expect(screen.getByRole('group', { name: 'Abgemeldet: 3' })).toBeInTheDocument();
    expect(dabei()).toHaveTextContent('Dieses Event ist abgesagt');
    expect(within(dabei()).queryByRole('button')).toBe(null);
  });

  it('Teilnehmer:innen: die Namen der Mitkonfis', async () => {
    zustand.teilnehmer = [{ id: 1, display_name: 'Mia Muster' }, { id: 2, display_name: 'Ben Beispiel' }];
    await oeffne(SOMMERFEST());
    const liste = karte('Teilnehmer:innen (2)');
    expect(within(liste).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Mia Muster', 'Ben Beispiel']);
  });

  it('offline ohne Liste: Hinweis, keine leere Karte', async () => {
    zustand.online = false;
    await oeffne(SOMMERFEST());
    expect(screen.getByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Teilnehmer:innen/ })).toBe(null);
  });
});

describe('Laden und Fehler', () => {
  it('solange die Liste lädt: Platzhalter statt der Karten', async () => {
    zustand.laedt = true;
    await oeffne(SOMMERFEST());
    expect(screen.getByText('Das Event wird geladen.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bist du dabei?' })).toBe(null);
  });

  it('ein Event, das es nicht (mehr) gibt: Hinweis mit erneutem Versuch', async () => {
    zustand.events = [SOMMERFEST()];
    const { default: EventDetailView } = await import('../../../components/konfi/views/EventDetailView');
    const { render } = await import('@testing-library/react');
    render(<EventDetailView eventId={999} onBack={() => undefined} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole('heading', { level: 1, name: 'Event nicht gefunden' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Dieses Event gibt es nicht (mehr) oder du siehst es nicht.');
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });
});

describe('Schmales Fenster: die App bleibt, wie sie ist', () => {
  it('Karte "Bist du dabei?" der App, kein Link "Alle Events", keine Region', async () => {
    breit.wert = false;
    await oeffne(SOMMERFEST());
    expect(screen.queryByRole('link', { name: 'Alle Events' })).toBe(null);
    expect(screen.queryByRole('region', { name: 'Bist du dabei?' })).toBe(null);
    expect(within(dabeiKarte()).getByRole('button', { name: /^Anmelden/ })).toBeInTheDocument();
    expect(knopf(/^Anmelden/)).not.toBe(null);
  });
});
