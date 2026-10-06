// Mitmachen bei Konfis und Team in der Web-Fassung, gerendert (03.10.2026):
// die Events als Karten im Raster mit Chips wie die Reiter der App (Konfis:
// Alle, Meine, Konfirmation; Team: Alle, Meine, Team) und Suche, jede Karte ein
// echter Link auf das Event; die eigenen Aktivitäten als Tabelle mit
// Status-Chips. QR-Code scannen, Aktivität melden, ansehen und löschen rufen
// dieselben Funktionen wie die Seiten der App. Im schmalen Fenster bleibt die App.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  h, api, setError, routerPush, geoeffnet, letzteRueckfrage, knopfIn,
  zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT,
} from './geruestWeb';

// --- Konfis -------------------------------------------------------------------------

const KONFI_EVENTS = [
  termin(301, 'Konfi-Tag', { event_date: inTagen(3), mandatory: true, registration_status: 'mandatory', is_registered: true, booking_status: 'confirmed', registered_count: 12, max_participants: 30, location: 'Gemeindehaus' }),
  termin(302, 'Sonntagsgottesdienst', { event_date: inTagen(1), points: 1, point_type: 'gottesdienst', registered_count: 3, max_participants: 20, location: 'Kirche Musterdorf' }),
  termin(303, 'Gemeindefest', { event_date: inTagen(9), points: 2, point_type: 'gemeinde', registered_count: 10, max_participants: 10, waitlist_enabled: true, booking_status: 'waitlist', waitlist_position: 2 }),
  termin(304, 'Konfirmation Frühling', { event_date: inTagen(60), is_konfirmation: true, registered_count: 4, max_participants: 40 }),
  termin(305, 'Erntedank-Gottesdienst', { event_date: inTagen(-20), points: 1, is_registered: true, booking_status: 'confirmed', attendance_status: 'present' }),
  termin(306, 'Fahrradtour', { event_date: inTagen(10), registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung', is_registered: true, booking_status: 'confirmed' }),
  termin(307, 'Konfi-Wochenende', { event_date: inTagen(20), mandatory: true, registration_status: 'mandatory', registered_count: 2, max_participants: 30, teamer_needed: true }),
];

const ANTRAEGE_KONFI = [
  { id: 81, activity_id: 3, activity_name: 'Gemeindefest helfen', activity_points: 2, activity_type: 'gemeinde', requested_date: '2026-09-27', comment: 'Beim Aufbau geholfen', photo_filename: 'beleg.jpg', status: 'pending', created_at: '2026-10-02T09:00:00Z', updated_at: '2026-10-02T09:00:00Z' },
  { id: 82, activity_id: 1, activity_name: 'Sonntagsgottesdienst', activity_points: 1, activity_type: 'gottesdienst', requested_date: '2026-09-20', status: 'approved', created_at: '2026-09-21T09:00:00Z', updated_at: '2026-09-21T10:00:00Z' },
  { id: 83, activity_id: 5, activity_name: 'Adventsmarkt', activity_points: 3, activity_type: 'gemeinde', requested_date: '2026-09-10', status: 'rejected', admin_comment: 'Nicht belegt', created_at: '2026-09-11T09:00:00Z', updated_at: '2026-09-11T10:00:00Z' },
];

// --- Team ---------------------------------------------------------------------------

const TEAM_EVENTS = [
  termin(401, 'Teamabend', { event_date: inTagen(5), teamer_only: true, teamer_needed: true, teamer_registration_status: 'open', teamer_count: 2, teamer_max_participants: 8, jahrgang_names: 'Jahrgang 2026' }),
  termin(402, 'Konfi-Freizeit', { event_date: inTagen(14), teamer_needed: true, teamer_registration_status: 'open', is_registered: true, booking_status: 'confirmed', teamer_count: 3, teamer_max_participants: 6, registered_count: 18, max_participants: 24, material_count: 2 }),
  termin(403, 'Sonntagsgottesdienst', { event_date: inTagen(1), registered_count: 3, max_participants: 20 }),
  termin(404, 'Gemeindefest', { event_date: inTagen(-2), registered_count: 8, max_participants: 10 }),
];

const ANTRAEGE_TEAM = [
  { id: 91, activity_id: 9, activity_name: 'Freizeit begleitet', activity_target_role: 'teamer', requested_date: '2026-09-27', status: 'pending', created_at: '2026-10-02T09:00:00Z', updated_at: '2026-10-02T09:00:00Z' },
  { id: 92, activity_id: 9, activity_name: 'Konfi-Tag geleitet', activity_target_role: 'teamer', requested_date: '2026-09-12', status: 'approved', created_at: '2026-09-13T09:00:00Z', updated_at: '2026-09-13T10:00:00Z' },
];

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

const oeffneKonfi = (suche = '', events = KONFI_EVENTS) => {
  richteEin({ nutzer: 'konfi', pfad: '/konfi/events', suche, daten: { 'konfi:events:': events, 'konfi:requests:': ANTRAEGE_KONFI } });
  return oeffne('konfi');
};
const oeffneTeam = (suche = '', events = TEAM_EVENTS) => {
  richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche, daten: { 'teamer:events:': events, 'teamer:requests:': ANTRAEGE_TEAM } });
  return oeffne('team');
};

/** Die Namen der Karten, von oben links nach unten rechts. */
const karten = () => screen.queryAllByRole('article').map((a) => within(a).getByRole('heading', { level: 3 }).textContent);
const karte = (name: string) => screen.getByRole('link', { name }).closest('article') as HTMLElement;
const chip = (name: RegExp) => within(screen.getByRole('group', { name: 'Events anzeigen' })).getByRole('button', { name });

describe('Konfis: Kopf, Reiter und Chips', () => {
  it('Titel "Events", zwei Reiter als Links (Events, Aktivitäten), "Events" ist der aktuelle', async () => {
    await oeffneKonfi();
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
    const reiter = within(screen.getByRole('navigation', { name: 'Bereiche von Mitmachen' })).getAllByRole('link');
    expect(reiter.map((a) => a.textContent)).toEqual(['Events', 'Aktivitäten']);
    expect(reiter.map((a) => a.getAttribute('href'))).toEqual(['/konfi/events', '/konfi/events?segment=antraege']);
    expect(reiter.map((a) => a.getAttribute('aria-current'))).toEqual(['page', null]);
  });

  it('die Chips wie die Reiter der App -- Alle, Meine, Konfirmation, in dieser Reihenfolge, „Meine" vorgewählt (Simon, 06.10.2026: angleichen)', async () => {
    await oeffneKonfi();
    const chips = within(screen.getByRole('group', { name: 'Events anzeigen' })).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['Alle5', 'Meine4', 'Konfirmation1']);
    expect(chip(/^Meine/)).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Konfis: Karten', () => {
  it('Meine (Standard): jede Buchung, auch Warteliste und Abgesagtes; Anstehendes zuerst, Vergangenes danach', async () => {
    await oeffneKonfi();
    expect(karten()).toEqual(['Konfi-Tag', 'Gemeindefest', 'Fahrradtour', 'Erntedank-Gottesdienst']);
  });

  it('Alle: ohne Konfirmation und ohne Vergangenes, nach Datum -- wie „Alle" in der App', async () => {
    await oeffneKonfi();
    fireEvent.click(chip(/^Alle/));
    expect(karten()).toEqual(['Sonntagsgottesdienst', 'Konfi-Tag', 'Gemeindefest', 'Fahrradtour', 'Konfi-Wochenende']);
  });

  it('Konfirmation', async () => {
    await oeffneKonfi();
    fireEvent.click(chip(/^Konfirmation/));
    expect(karten()).toEqual(['Konfirmation Frühling']);
  });

  it('?filter=alle in der Adresse wählt den Chip vor; die alten Werte anstehend und pflicht führen zu „Meine"', async () => {
    const { unmount } = await oeffneKonfi('?filter=alle');
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'true');
    expect(karten()).toHaveLength(5);
    unmount();
    for (const alt of ['anstehend', 'pflicht']) {
      const ansicht = await oeffneKonfi(`?filter=${alt}`);
      expect(chip(/^Meine/)).toHaveAttribute('aria-pressed', 'true');
      ansicht.unmount();
    }
  });

  it('der Status steht als Marke mit Wort auf der Karte', async () => {
    await oeffneKonfi();
    expect(within(karte('Konfi-Tag')).getByText('Angemeldet', { selector: '.web-pill' })).toBeInTheDocument();
    expect(within(karte('Konfi-Tag')).getByText('Pflicht', { selector: '.web-pill' })).toBeInTheDocument();
    expect(within(karte('Gemeindefest')).getByText('Warteliste (2)')).toBeInTheDocument();
    expect(within(karte('Fahrradtour')).getByText('Abgesagt', { selector: '.web-pill' })).toBeInTheDocument();
    expect(karte('Fahrradtour')).toHaveTextContent('Abgesagt: Sturmwarnung');
    expect(within(karte('Erntedank-Gottesdienst')).getByText('Verbucht')).toBeInTheDocument();
  });

  it('Datum, Uhrzeit, Ort, Plätze und Punkte stehen auf der Karte; Pflicht-Events zählen keine Plätze', async () => {
    await oeffneKonfi();
    const tag = karte('Konfi-Tag');
    expect(tag).toHaveTextContent('Datum: 06.10.2026 · 10:00 Uhr');
    expect(tag).toHaveTextContent('Ort: Gemeindehaus');
    expect(tag).not.toHaveTextContent('Plätze');
    const fest = karte('Gemeindefest');
    expect(fest).toHaveTextContent('Plätze: 10/10');
    expect(fest).toHaveTextContent('Punkte: 2P');
  });

  it('Konfis sehen "Team gesucht" nicht', async () => {
    await oeffneKonfi();
    fireEvent.click(chip(/^Alle/));
    expect(karte('Konfi-Wochenende')).toBeInTheDocument();
    expect(within(karte('Konfi-Wochenende')).queryByText('Team gesucht')).toBe(null);
  });

  it('die Karte ist ein echter Link auf das Event; der Klick bleibt in der App', async () => {
    await oeffneKonfi();
    const link = screen.getByRole('link', { name: 'Konfi-Tag' });
    expect(link).toHaveAttribute('href', '/konfi/events/301');
    fireEvent.click(link);
    expect(routerPush).toHaveBeenCalledWith('/konfi/events/301', 'none', 'push');
  });

  it('ein zweiter Konfirmationstermin ist gesperrt, solange einer gebucht ist: "Anderer Termin"', async () => {
    const gebucht = termin(304, 'Konfirmation Frühling', { event_date: inTagen(60), is_konfirmation: true, is_registered: true, booking_status: 'confirmed' });
    const andere = termin(308, 'Konfirmation Herbst', { event_date: inTagen(90), is_konfirmation: true });
    await oeffneKonfi('?filter=konfirmation', [gebucht, andere]);
    expect(within(karte('Konfirmation Frühling')).getByText('Angemeldet', { selector: '.web-pill' })).toBeInTheDocument();
    expect(within(karte('Konfirmation Herbst')).getByText('Anderer Termin')).toBeInTheDocument();
    expect(karte('Konfirmation Herbst')).toHaveClass('web-termin-karte--gedaempft');
  });

  it('Suche nach Name, Ort und Beschreibung; "fruehling" findet "Frühling"', async () => {
    await oeffneKonfi('?filter=alle');
    const feld = screen.getByRole('searchbox', { name: 'Events durchsuchen' });
    fireEvent.change(feld, { target: { value: 'kirche' } });
    expect(karten()).toEqual(['Sonntagsgottesdienst']);
    fireEvent.click(chip(/^Konfirmation/));
    fireEvent.change(feld, { target: { value: 'fruehling' } });
    expect(karten()).toEqual(['Konfirmation Frühling']);
  });

  it('Suche ohne Treffer: Hinweis und "Suche leeren"', async () => {
    await oeffneKonfi();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Events durchsuchen' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
    expect(karten()).toHaveLength(4);
  });

  it('keine Buchung: Hinweis mit Weg zu allen Events', async () => {
    await oeffneKonfi('', [KONFI_EVENTS[1], KONFI_EVENTS[3]]);
    expect(screen.getByText('Du bist noch für keine Events angemeldet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alle Events ansehen' }));
    expect(karten()).toEqual(['Sonntagsgottesdienst']);
  });
});

describe('Konfis: Aktionen oben', () => {
  it('"QR-Code scannen" öffnet den Scanner', async () => {
    await oeffneKonfi();
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code scannen' }));
    expect(geoeffnet('QRScannerModal')).toHaveLength(1);
  });

  it('die Legende öffnet ihr Fenster; Aktualisieren lädt die Events neu', async () => {
    await oeffneKonfi();
    fireEvent.click(screen.getByRole('button', { name: /Legende/ }));
    expect(geoeffnet('EventLegendModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await act(async () => { await Promise.resolve(); });
    expect(h.neuGeladen).toEqual(['konfi:events:7']);
  });

  it('solange die Events laden, steht ein Platzhalter statt der Karten', async () => {
    richteEin({ nutzer: 'konfi', pfad: '/konfi/events', daten: { 'konfi:requests:': [] } });
    h.laedt.add('konfi:events:');
    await oeffne('konfi');
    expect(screen.getByText('Die Events werden geladen.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBe(null);
  });
});

describe('Konfis: eigene Aktivitäten', () => {
  const oeffneAktivitaeten = (filter = '') => oeffneKonfi(`?segment=antraege${filter}`);
  const zeilen = () => within(screen.getByRole('table', { name: 'Deine Aktivitäten' })).getAllByRole('row').slice(1)
    .map((z) => within(z).getAllByRole('cell')[0].querySelector('button')!.textContent);

  it('Titel "Aktivitäten", "Aktivitäten" ist der aktuelle Reiter; Standard: die offenen', async () => {
    await oeffneAktivitaeten();
    expect(screen.getByRole('heading', { level: 1, name: 'Aktivitäten' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Bereiche von Mitmachen' });
    expect(within(nav).getByRole('link', { name: 'Aktivitäten' })).toHaveAttribute('aria-current', 'page');
    expect(zeilen()).toEqual(['Gemeindefest helfen']);
  });

  it('die Chips zählen; Angerechnet, Abgelehnt und Alle wechseln die Liste', async () => {
    await oeffneAktivitaeten();
    const gruppe = within(screen.getByRole('group', { name: 'Aktivitäten nach Status' }));
    expect(gruppe.getByRole('button', { name: /^Offen/ })).toHaveTextContent(/^Offen1$/);
    expect(gruppe.getByRole('button', { name: /^Angerechnet/ })).toHaveTextContent(/^Angerechnet1$/);
    expect(gruppe.getByRole('button', { name: /^Abgelehnt/ })).toHaveTextContent(/^Abgelehnt1$/);
    expect(gruppe.getByRole('button', { name: /^Alle/ })).toHaveTextContent(/^Alle3$/);
    fireEvent.click(gruppe.getByRole('button', { name: /^Angerechnet/ }));
    expect(zeilen()).toEqual(['Sonntagsgottesdienst']);
    fireEvent.click(gruppe.getByRole('button', { name: /^Abgelehnt/ }));
    expect(zeilen()).toEqual(['Adventsmarkt']);
    expect(screen.getByText('Nicht belegt')).toBeInTheDocument();
    fireEvent.click(gruppe.getByRole('button', { name: /^Alle/ }));
    expect(zeilen()).toEqual(['Gemeindefest helfen', 'Sonntagsgottesdienst', 'Adventsmarkt']);
  });

  it('die Zeile zeigt Datum, Foto-Hinweis, Punkte und Status', async () => {
    await oeffneAktivitaeten();
    const zeile = screen.getByRole('button', { name: 'Gemeindefest helfen ansehen' }).closest('tr')!;
    expect(zeile).toHaveTextContent('Beim Aufbau geholfen');
    expect(zeile).toHaveTextContent('Foto');
    expect(zeile).toHaveTextContent('2P');
    expect(zeile).toHaveTextContent('Offen');
  });

  it('"Ansehen" öffnet das Fenster; "Aktivität melden" öffnet den Antrag', async () => {
    await oeffneAktivitaeten();
    fireEvent.click(screen.getByRole('button', { name: 'Gemeindefest helfen ansehen' }));
    expect(geoeffnet('RequestDetailModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Aktivität melden' }));
    expect(geoeffnet('KonfiActivityRequestModal')).toHaveLength(1);
  });

  it('Löschen fragt nach und ruft erst nach "Löschen" DELETE auf die eigene Meldung', async () => {
    await oeffneAktivitaeten();
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität löschen' }));
    const frage = letzteRueckfrage();
    expect(frage.message).toBe('Möchtest du deine Meldung für "Gemeindefest helfen" wirklich löschen?');
    expect(api.delete).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Löschen')!.handler!(); });
    expect(api.delete).toHaveBeenCalledWith('/konfi/requests/81');
    expect(h.neuGeladen).toEqual(['konfi:requests:7']);
  });

  it('nur offene Meldungen lassen sich löschen', async () => {
    await oeffneAktivitaeten('&filter=angerechnet');
    expect(screen.queryByRole('button', { name: 'Aktivität löschen' })).toBe(null);
  });

  it('offline: keine Rückfrage, eine Meldung', async () => {
    h.online = false;
    await oeffneAktivitaeten();
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität löschen' }));
    expect(h.presentAlert).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Löschen nicht möglich — du bist offline');
  });

  it('was in der Warteschlange liegt, steht über der Tabelle; Gescheitertes lässt sich verwerfen', async () => {
    h.wartend = [{ id: 'q1', metadata: { label: 'Aktivität' }, body: { description: 'Fahrradtour' } }];
    h.gescheitert = [{ id: 'f1', label: 'Aktivität Adventsmarkt', error: { message: 'Foto zu groß' } }];
    await oeffneAktivitaeten();
    expect(screen.getByText('Wird gesendet...')).toBeInTheDocument();
    expect(screen.getByText(/Aktivität – Fahrradtour/)).toBeInTheDocument();
    expect(screen.getByText(/Aktivität Adventsmarkt – Foto zu groß/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität Adventsmarkt wegwischen' }));
    expect(h.vergessen).toHaveBeenCalledWith('f1');
  });

  it('Aktualisieren lädt die Aktivitäten neu', async () => {
    await oeffneAktivitaeten();
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await act(async () => { await Promise.resolve(); });
    expect(h.neuGeladen).toEqual(['konfi:requests:7']);
  });
});

describe('Team: Karten', () => {
  it('Titel "Events", Reiter wie bei Konfis, Chips Alle 4, Meine 1, Team 2', async () => {
    await oeffneTeam();
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
    const reiter = within(screen.getByRole('navigation', { name: 'Bereiche von Mitmachen' })).getAllByRole('link');
    expect(reiter.map((a) => a.getAttribute('href'))).toEqual(['/teamer/events', '/teamer/events?segment=antraege']);
    expect(chip(/^Alle/)).toHaveTextContent(/^Alle4$/);
    expect(chip(/^Meine/)).toHaveTextContent(/^Meine1$/);
    expect(chip(/^Team/)).toHaveTextContent(/^Team2$/);
  });

  it('Meine (Standard): nur die Zusage; Alle: auch reine Konfi-Events, Vergangenes zuletzt; Team: Team gesucht und Nur Team', async () => {
    await oeffneTeam();
    expect(karten()).toEqual(['Konfi-Freizeit']);
    fireEvent.click(chip(/^Alle/));
    expect(karten()).toEqual(['Sonntagsgottesdienst', 'Teamabend', 'Konfi-Freizeit', 'Gemeindefest']);
    fireEvent.click(chip(/^Team/));
    expect(karten()).toEqual(['Teamabend', 'Konfi-Freizeit']);
  });

  it('die Karte führt auf ?eventId= -- ein echter Link, der Klick bleibt in der App', async () => {
    await oeffneTeam();
    const link = screen.getByRole('link', { name: 'Konfi-Freizeit' });
    expect(link).toHaveAttribute('href', '/teamer/events?eventId=402');
    fireEvent.click(link);
    expect(routerPush).toHaveBeenCalledWith('/teamer/events?eventId=402', 'none', 'push');
  });

  it('Status: Dabei, Offen, "Nur Info" für reine Konfi-Events; Vergangenes ohne Teilnahme trägt keine Marke', async () => {
    await oeffneTeam('?filter=alle');
    expect(within(karte('Konfi-Freizeit')).getByText('Dabei', { selector: '.web-pill' })).toBeInTheDocument();
    expect(within(karte('Teamabend')).getByText('Offen', { selector: '.web-pill' })).toBeInTheDocument();
    expect(within(karte('Sonntagsgottesdienst')).getByText('Nur Info', { selector: '.web-pill' })).toBeInTheDocument();
    expect(within(karte('Gemeindefest')).queryByText('Vergangen', { selector: '.web-pill' })).toBe(null);
    expect(karte('Gemeindefest')).toHaveClass('web-termin-karte--gedaempft');
  });

  it('Jahrgang, Team-Zahlen und Material stehen auf der Karte; "Team gesucht" zeigt das Team', async () => {
    await oeffneTeam('?filter=alle');
    expect(karte('Teamabend')).toHaveTextContent('Jahrgang 2026');
    expect(karte('Teamabend')).toHaveTextContent('Nur Team');
    expect(karte('Konfi-Freizeit')).toHaveTextContent('2 Materialien');
    expect(within(karte('Konfi-Freizeit')).getByText('Team gesucht')).toBeInTheDocument();
  });

  it('leer: "Du bist noch bei keinem Event dabei" mit Weg zu allen Events', async () => {
    await oeffneTeam('', [TEAM_EVENTS[2]]);
    expect(screen.getByText('Du bist noch bei keinem Event dabei')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alle Events ansehen' }));
    expect(karten()).toEqual(['Sonntagsgottesdienst']);
  });

  it('QR-Code scannen öffnet den Scanner', async () => {
    await oeffneTeam();
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code scannen' }));
    expect(geoeffnet('QRScannerModal')).toHaveLength(1);
  });
});

describe('Team: eigene Aktivitäten', () => {
  const zeilen = () => within(screen.getByRole('table', { name: 'Deine Aktivitäten' })).getAllByRole('row').slice(1)
    .map((z) => within(z).getAllByRole('cell')[0].querySelector('button')!.textContent);

  it('Standard "Alle"; ohne Spalte Punkte (reiner Nachweis)', async () => {
    await oeffneTeam('?segment=antraege');
    expect(zeilen()).toEqual(['Freizeit begleitet', 'Konfi-Tag geleitet']);
    expect(screen.queryByRole('columnheader', { name: 'Punkte' })).toBe(null);
  });

  it('"Aktivität melden" öffnet den Antrag des Teams; Löschen ruft DELETE auf /teamer/requests', async () => {
    await oeffneTeam('?segment=antraege');
    fireEvent.click(screen.getByRole('button', { name: 'Neue Aktivität melden' }));
    expect(geoeffnet('TeamerActivityRequestModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität löschen' }));
    await act(async () => { await knopfIn(letzteRueckfrage(), 'Löschen')!.handler!(); });
    expect(api.delete).toHaveBeenCalledWith('/teamer/requests/91');
  });
});

describe('Schmales Fenster: die App bleibt, wie sie ist', () => {
  it('Konfis: keine Karten-Links, keine Link-Reiter -- Reiter der App und Scanner in der Kopfzeile', async () => {
    h.breit = false;
    await oeffneKonfi();
    expect(screen.queryByRole('article')).toBe(null);
    expect(screen.queryByRole('navigation', { name: 'Bereiche von Mitmachen' })).toBe(null);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('data-wert')).slice(0, 2)).toEqual(['events', 'antraege']);
    expect(within(screen.getByTestId('kopfzeile')).getByRole('button', { name: 'QR-Code scannen' })).toBeInTheDocument();
  });

  it('Team: dieselbe Seite mit den Reitern der App', async () => {
    h.breit = false;
    await oeffneTeam();
    expect(screen.queryByRole('article')).toBe(null);
    expect(screen.queryByRole('navigation', { name: 'Bereiche von Mitmachen' })).toBe(null);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('data-wert'))).toContain('meine');
  });
});
