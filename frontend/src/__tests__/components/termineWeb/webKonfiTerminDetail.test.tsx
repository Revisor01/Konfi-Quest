// Ein Event bei Konfis in der Web-Fassung, gerendert (03.10.2026). Aufbau wie
// jede Detailseite (06.10.2026): im Kopf Titel, Kennzeichen und alle Aktionen --
// Anmelden oder Abmelden, Einchecken, Chat --, darunter als Hinweis, was die
// Karte "Bist du dabei?" der App erklärt, und die Kennzahlen; links die
// Beschreibung und wer dabei ist, rechts die Angaben. Welcher Knopf wann
// dasteht, entscheidet dieselbe Kette wie die Karte der App; Anmelden,
// Abmelden und Einchecken rufen dieselben Funktionen (POST
// /konfi/events/:id/register, Abmelde-Fenster, Scanner). Im schmalen Fenster
// bleibt die App.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffne, knopf, dabeiKarte, api, setError, setSuccess, presentAlert, modale, zuletztGeoeffnet, inTagen,
} from '../gerueste/konfiTerminDetail';
import { cleanup } from '@testing-library/react';
import { konfiAnmeldeZustand } from '../../../utils/termineWeb';
import { istAbgesagt } from '../../../components/shared/eventFormatting';

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
const kopf = () => screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
/** Die Knöpfe im Kopf in der Reihenfolge der Seite (Aktionen sind Knöpfe oben rechts). */
const knoepfeImKopf = () => within(kopf()).queryAllByRole('button').map((b) => b.textContent!.trim());
/** Die Hinweise unter dem Kopf, vor den Kennzahlen -- bei einem abgesagten Event der Titel des Absage-Hinweises. */
const hinweise = () => [...document.querySelectorAll('.web-detail > .web-hinweis')].map((x) => (
  (x.querySelector('.web-hinweis__titel') ?? x.querySelector('.web-hinweis__text'))!.textContent!.trim()
));

const SOMMERFEST = (zusatz: Partial<Parameters<typeof termin>[0]> = {}) => termin({
  id: 5, name: 'Sommerfest', description: 'Grillen im Gemeindegarten.', location: 'Gemeindegarten', event_date: inTagen(10),
  points: 2, max_participants: 10, registered_count: 4, can_register: true, ...zusatz,
});

describe('Aufbau wie jede Detailseite', () => {
  it('Aktionen im Kopf: der Weg zur Anmeldung rechts als primärer Knopf -- keine eigene Karte "Bist du dabei?"', async () => {
    await oeffne(SOMMERFEST());
    expect(knoepfeImKopf()).toEqual(['Anmelden (4/10)']);
    expect(within(kopf()).getByRole('button', { name: 'Anmelden (4/10)' })).toHaveClass('web-knopf--primaer');
    expect(screen.queryByRole('region', { name: 'Bist du dabei?' })).toBe(null);
  });

  it('mit Chat-Raum und Anmeldung: Chat, Einchecken, Abmelden in dieser Reihenfolge, Abmelden als Gefahr', async () => {
    await oeffne(SOMMERFEST({ chat_room_id: 55, is_registered: true, booking_status: 'confirmed' }));
    expect(knoepfeImKopf()).toEqual(['Chat', 'Einchecken', 'Abmelden']);
    expect(within(kopf()).getByRole('button', { name: 'Abmelden' })).toHaveClass('web-knopf--gefahr');
    expect(within(kopf()).getByRole('button', { name: 'Einchecken' })).not.toHaveClass('web-knopf--primaer');
  });

  it('die Kennzahlen stehen in einer Reihe unter dem Kopf, vor den Spalten', async () => {
    await oeffne(SOMMERFEST());
    const reihe = document.querySelector('.web-detail__kennzahlen') as HTMLElement;
    expect([...reihe.querySelectorAll('.web-kachel')].map((k) => k.getAttribute('aria-label'))).toEqual(['Frei: 6', 'Punkte: 2', 'Dabei: 4']);
    expect(kopf().compareDocumentPosition(reihe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reihe.compareDocumentPosition(document.querySelector('.web-spalten')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links der Inhalt (Beschreibung, wer dabei ist), rechts der Block "Angaben"', async () => {
    zustand.teilnehmer = [{ id: 1, display_name: 'Mia Muster' }];
    await oeffne(SOMMERFEST());
    const [haupt, seite] = [...document.querySelector('.web-spalten')!.children] as HTMLElement[];
    expect(seite.tagName).toBe('ASIDE');
    expect(seite).toHaveAttribute('aria-label', 'Angaben');
    expect(within(haupt).getByRole('region', { name: 'Beschreibung' })).toBeInTheDocument();
    expect(within(haupt).getByRole('region', { name: 'Teilnehmer:innen (1)' })).toBeInTheDocument();
    expect(within(seite).getByRole('region', { name: 'Angaben' })).toBeInTheDocument();
    expect(within(seite).queryByRole('region', { name: 'Beschreibung' })).toBe(null);
  });
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

describe('Kopf: Anmelden', () => {
  it('Platz frei: primärer Knopf "Anmelden (4/10)"; ein Klick schickt POST /register ohne Zeitfenster', async () => {
    await oeffne(SOMMERFEST());
    const anmelden = within(kopf()).getByRole('button', { name: 'Anmelden (4/10)' });
    expect(anmelden).toHaveClass('web-knopf--primaer');
    await act(async () => { fireEvent.click(anmelden); });
    expect(api.post).toHaveBeenCalledWith('/konfi/events/5/register', {});
    expect(setError).not.toHaveBeenCalled();
  });

  it('Anmeldefehler: die Meldung des Servers', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Anmeldung nicht mehr möglich' } } }));
    await oeffne(SOMMERFEST());
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Anmelden (4/10)' })); });
    expect(setError).toHaveBeenCalledWith('Anmeldung nicht mehr möglich');
  });

  it('Warteliste: der Knopf nennt die Warteliste, die Antwort "waitlist" meldet es', async () => {
    api.post.mockResolvedValue({ data: { status: 'waitlist' } });
    await oeffne(SOMMERFEST({ registered_count: 10, waitlist_enabled: true, waitlist_count: 1, max_waitlist_size: 5 }));
    const knopfWarteliste = within(kopf()).getByRole('button', { name: 'Warteliste offen (1/5)' });
    expect(knopfWarteliste).toHaveClass('web-knopf--primaer');
    await act(async () => { fireEvent.click(knopfWarteliste); });
    expect(api.post).toHaveBeenCalledWith('/konfi/events/5/register', {});
    expect(setSuccess).toHaveBeenCalledWith('Du bist auf der Warteliste. Wird ein Platz frei, rückst du automatisch nach.');
  });

  it('ausgebucht ohne Warteliste: kein Knopf, es bleibt die Erklärung als Hinweis', async () => {
    await oeffne(SOMMERFEST({ registered_count: 10, can_register: false }));
    expect(knoepfeImKopf()).toEqual([]);
    expect(hinweise()).toEqual(['Nicht verfügbar']);
  });

  it('offline: "Du bist offline" -- gesperrt, kein POST', async () => {
    zustand.online = false;
    await oeffne(SOMMERFEST());
    const knopfOffline = within(kopf()).getByRole('button', { name: 'Du bist offline' });
    expect(knopfOffline).toBeDisabled();
    fireEvent.click(knopfOffline);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Zeitfenster-Event ohne Zeitfenster: kein POST, ein Hinweis', async () => {
    await oeffne(SOMMERFEST({ has_timeslots: true }));
    await act(async () => { fireEvent.click(within(kopf()).getByRole('button', { name: 'Anmelden (4/10)' })); });
    expect(api.post).not.toHaveBeenCalled();
    expect(presentAlert.mock.calls.at(-1)![0].header).toBe('Zeitfenster nicht geladen');
  });

  it('Konfirmation, wenn schon ein anderer Termin gebucht ist: kein Knopf, die Erklärung als Hinweis', async () => {
    const gebucht = termin({ id: 6, name: 'Konfirmation Frühling', is_konfirmation: true, is_registered: true, booking_status: 'confirmed', event_date: inTagen(40) });
    const neu = termin({ id: 8, name: 'Konfirmation Herbst', is_konfirmation: true, event_date: inTagen(80), can_register: true, max_participants: 20 });
    zustand.events = [gebucht, neu];
    await oeffne(neu);
    expect(hinweise()).toEqual(['Konfirmationstermin bereits gebucht']);
    expect(knoepfeImKopf()).toEqual([]);
  });
});

describe('Kopf: Abmelden', () => {
  const angemeldet = (zusatz: Parameters<typeof termin>[0] = {}) => SOMMERFEST({ is_registered: true, booking_status: 'confirmed', ...zusatz });

  it('angemeldet, mehr als 2 Tage vorher: roter Knopf "Abmelden" öffnet das Abmelde-Fenster, sendet noch nichts', async () => {
    await oeffne(angemeldet());
    const abmelden = within(kopf()).getByRole('button', { name: 'Abmelden' });
    expect(abmelden).toHaveClass('web-knopf--gefahr');
    fireEvent.click(abmelden);
    expect(geoeffnet('UnregisterModal')).toHaveLength(1);
    expect(zuletztGeoeffnet('UnregisterModal')!.props.mandatory).toBeUndefined();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('weniger als 2 Tage vorher: keine Abmeldung mehr, nur die Erklärung als Hinweis', async () => {
    await oeffne(angemeldet({ event_date: inTagen(1) }));
    expect(within(kopf()).queryByRole('button', { name: 'Abmelden' })).toBe(null);
    expect(hinweise()).toEqual(['Abmelden geht nur bis 2 Tage vorher']);
  });

  it('Warteliste: "Platz 2" als Hinweis und "Von der Warteliste abmelden" im Kopf', async () => {
    await oeffne(SOMMERFEST({ booking_status: 'waitlist', waitlist_position: 2, registered_count: 10 }));
    expect(hinweise()).toEqual(['Du stehst auf Platz 2 der Warteliste']);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Von der Warteliste abmelden' }));
    expect(geoeffnet('UnregisterModal')).toHaveLength(1);
  });

  it('Pflicht-Event: automatisch angemeldet; Abmelden öffnet das Fenster mit Grund', async () => {
    await oeffne(angemeldet({ mandatory: true, registration_status: 'mandatory', points: 0 }));
    expect(hinweise()).toEqual(['Du bist automatisch angemeldet']);
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Abmelden' }));
    // Dasselbe Fenster, aber im Pflicht-Modus (Grund mit mindestens 5 Zeichen).
    expect(geoeffnet('UnregisterModal')).toHaveLength(1);
    expect(zuletztGeoeffnet('UnregisterModal')!.props.mandatory).toBe(true);
  });

  it('Pflicht-Event, abgemeldet: "Wieder anmelden" ruft POST /opt-in', async () => {
    await oeffne(SOMMERFEST({ mandatory: true, registration_status: 'mandatory', points: 0, is_opted_out: true, booking_status: 'opted_out' }));
    expect(hinweise()).toEqual(['Du hast dich abgemeldet']);
    const wieder = within(kopf()).getByRole('button', { name: 'Wieder anmelden' });
    expect(wieder).toHaveClass('web-knopf--primaer');
    await act(async () => { fireEvent.click(wieder); });
    expect(api.post).toHaveBeenCalledWith('/konfi/events/5/opt-in');
  });
});

describe('Kopf: Einchecken, Hinweise, Teilnehmende', () => {
  it('angemeldet und noch nicht verbucht: "Einchecken" öffnet den Scanner', async () => {
    await oeffne(SOMMERFEST({ is_registered: true, booking_status: 'confirmed' }));
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Einchecken' }));
    expect(geoeffnet('QRScannerModal')).toHaveLength(1);
  });

  it('schon anwesend: "Anwesend" als Hinweis, kein Einchecken mehr', async () => {
    await oeffne(SOMMERFEST({ is_registered: true, booking_status: 'confirmed', attendance_status: 'present', event_date: inTagen(-1) }));
    expect(hinweise()).toContain('Anwesend');
    expect(document.querySelector('.web-detail > .web-hinweis--erfolg')).toHaveTextContent('Anwesend');
    expect(within(kopf()).queryByRole('button', { name: 'Einchecken' })).toBe(null);
  });

  it('abgesagt: der Hinweis mit Grund steht einmal, "Abgemeldet" statt "Frei", keine Knöpfe', async () => {
    await oeffne(SOMMERFEST({ registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung', abgemeldet_count: 3 }));
    expect(document.querySelector('.web-detail')!.firstElementChild).toHaveTextContent('Grund: Sturmwarnung');
    expect(screen.getAllByText('Dieses Event ist abgesagt')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Abgemeldet: 3' })).toBeInTheDocument();
    expect(knoepfeImKopf()).toEqual([]);
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

  it('offline nach einem Besuch mit Netz: die gemerkte Liste, kein Hinweis', async () => {
    const nachlaufen = async () => {
      for (let i = 0; i < 10; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };
    zustand.teilnehmer = [{ id: 1, display_name: 'Mia Muster' }];
    await oeffne(SOMMERFEST());
    await nachlaufen();
    cleanup();
    zustand.online = false;
    await oeffne(SOMMERFEST());
    await nachlaufen();
    expect(within(karte('Teilnehmer:innen (1)')).getByText('Mia Muster')).toBeInTheDocument();
    expect(screen.queryByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBe(null);
  });
});

describe('Kopf und Hinweise zeigen, was konfiAnmeldeZustand sagt -- für jeden Zustand', () => {
  // Der Vergleich ist die Stütze der Umstellung: Die Seite stellt nur dar, was die Kette der App entscheidet.
  const faelle: Array<[string, Parameters<typeof SOMMERFEST>[0]]> = [
    ['Platz frei', {}],
    ['ausgebucht', { registered_count: 10, can_register: false }],
    ['Warteliste offen', { registered_count: 10, waitlist_enabled: true, waitlist_count: 1, max_waitlist_size: 5 }],
    ['angemeldet', { is_registered: true, booking_status: 'confirmed' }],
    ['angemeldet, Frist um', { is_registered: true, booking_status: 'confirmed', event_date: inTagen(1) }],
    ['auf der Warteliste', { booking_status: 'waitlist', waitlist_position: 2, registered_count: 10 }],
    ['von der Leitung abgemeldet', { booking_status: 'excused' }],
    ['von der Leitung abgemeldet, Anmeldung geschlossen', { booking_status: 'excused', registration_status: 'closed' }],
    ['Anmeldung geschlossen', { registration_status: 'closed', can_register: false }],
    ['Pflicht, angemeldet', { mandatory: true, registration_status: 'mandatory', points: 0, is_registered: true, booking_status: 'confirmed' }],
    ['Pflicht, abgemeldet', { mandatory: true, registration_status: 'mandatory', points: 0, is_opted_out: true, booking_status: 'opted_out' }],
    ['Pflicht, vergangen', { mandatory: true, registration_status: 'mandatory', points: 0, event_date: inTagen(-3) }],
    ['abgesagt', { registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturm' }],
    ['abgesagt, Pflicht', { mandatory: true, registration_status: 'cancelled', cancelled: true, points: 0 }],
    ['abgesagt, angemeldet', { registration_status: 'cancelled', cancelled: true, is_registered: true, booking_status: 'confirmed' }],
  ];

  it.each(faelle)('%s', async (_name, zusatz) => {
    const event = SOMMERFEST(zusatz);
    await oeffne(event);
    const z = konfiAnmeldeZustand(event, { online: true, laeuft: false, hatKonfirmationGebucht: false });
    const erwartet = [z.hinweis?.text, z.knopf?.text, z.gesperrt?.text].filter(Boolean) as string[];
    // Ein abgesagtes Event sagt es immer (Absage-Hinweis), auch wo die Kette es nicht wiederholt (angemeldet).
    if (istAbgesagt(event) && !erwartet.includes('Dieses Event ist abgesagt')) erwartet.push('Dieses Event ist abgesagt');
    erwartet.sort();
    // Im Kopf zählen nur die Knöpfe der Anmeldung; Chat und Einchecken sind eigene Aktionen.
    const knoepfe = knoepfeImKopf().filter((k) => k !== 'Chat' && k !== 'Einchecken');
    expect([...knoepfe, ...hinweise()].sort()).toEqual(erwartet);
    cleanup();
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
