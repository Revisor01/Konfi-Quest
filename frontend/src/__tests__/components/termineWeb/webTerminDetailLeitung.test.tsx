// Ein Event bei der Leitung in der Web-Fassung, gerendert (03.10.2026):
// zweispaltig -- links Angaben, Beschreibung, Zeitfenster und Material, rechts
// Kennzahlen, Konfis, Warteliste und Team als Tabellen mit Anwesenheit und
// Aktionen, die Abmeldungen. Anwesenheit, Menü, Alle bestätigen, Absagen,
// Hinzufügen ... rufen dieselben Funktionen wie die Detailansicht der App --
// mit denselben Rückfragen, Fenstern und Routen. Im schmalen Fenster bleibt
// die App.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, api, setError, presentAlert, routerPush,
  modale, zuletztGeoeffnet, letzteRueckfrage, knopfIn, inTagen,
} from '../gerueste/leitungTerminDetail';

// Die erste Ansicht lädt die ganze Seite; in der vollen Suite unter Last reichen 5 Sekunden nicht.
vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));
const linkOeffnen = vi.hoisted(() => vi.fn());
vi.mock('../../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../../services/systemDialoge')>()),
  linkOeffnen,
}));

const geoeffnet = (name: string) => modale.geoeffnet.filter((m) => m.name === name);

const TEILNEHMENDE = [
  teilnahme(1, 'Kim Konfi', { jahrgang_name: 'Jahrgang 2026' }),
  teilnahme(2, 'Mia Muster', { jahrgang_name: 'Jahrgang 2026', attendance_status: 'present' }),
  teilnahme(3, 'Ben Beispiel', { jahrgang_name: 'Jahrgang 2026', status: 'opted_out', opt_out_reason: 'Krank' }),
  teilnahme(4, 'Wiebke Warte', { jahrgang_name: 'Jahrgang 2026', status: 'waitlist' }),
  teilnahme(5, 'Tim Teamer', { role_name: 'teamer', jahrgang_name: undefined }),
];

const freizeit = (zusatz: Record<string, unknown> = {}) => termin({
  id: 7, name: 'Konfi-Freizeit', location: 'Jugendherberge Musterstadt', description: 'Drei Tage am See.',
  max_participants: 20, registered_count: 2, teamer_needed: true, teamer_max_participants: 4, chat_room_id: 55,
  event_date: inTagen(7), participants: TEILNEHMENDE,
  unregistrations: [{ id: 1, konfi_name: 'Ben Beispiel', unregistered_at: '2026-10-01T08:00:00Z', reason: 'Krank' }],
  ...zusatz,
});

beforeEach(() => {
  zuruecksetzen();
  linkOeffnen.mockReset();
  breit.wert = true;
  zustand.detail = freizeit();
});

const karte = (titel: string | RegExp) => screen.getByRole('region', { name: titel });
const zeileVon = (name: string) => screen.getAllByText(name, { selector: '.web-zelle-titel' })[0].closest('tr') as HTMLElement;
const umschalter = (name: string) => within(zeileVon(name)).getByRole('group', { name: `Anwesenheit von ${name}` });

describe('Kopf und Angaben', () => {
  it('Titel, Zurück-Link zur Liste, Aktionen oben', async () => {
    await oeffne();
    expect(screen.getByRole('heading', { level: 1, name: 'Konfi-Freizeit' })).toBeInTheDocument();
    const zurueck = screen.getByRole('link', { name: 'Alle Events' });
    expect(zurueck).toHaveAttribute('href', '/admin/events');
    for (const name of ['Event-Chat öffnen', 'QR-Code anzeigen', 'Event kopieren', 'Event bearbeiten']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Event absagen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Absage zurücknehmen' })).toBe(null);
  });

  it('links Angaben und Beschreibung', async () => {
    await oeffne();
    const angaben = screen.getByLabelText('Angaben zum Event');
    expect(within(angaben).getByText('Ort', { selector: 'dt' })).toBeInTheDocument();
    // Der Ort ist ein Link auf die Karte; er geht über die Hülle der App, nicht über den Browser-Tab.
    const ort = within(angaben).getByRole('link', { name: 'Jugendherberge Musterstadt' });
    expect(ort).toHaveAttribute('href', 'https://maps.apple.com/?q=Jugendherberge%20Musterstadt');
    fireEvent.click(ort);
    expect(linkOeffnen).toHaveBeenCalledWith('https://maps.apple.com/?q=Jugendherberge%20Musterstadt');
    expect(within(karte('Beschreibung')).getByText('Drei Tage am See.')).toBeInTheDocument();
  });

  it('Kennzahlen: Teilnehmer:innen und Team mit Höchstzahl', async () => {
    await oeffne();
    expect(screen.getByRole('group', { name: 'Teilnehmer:innen: 2 / 20' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Team: 1 / 4' })).toBeInTheDocument();
  });

  it('Aktionen oben: QR-Code, Bearbeiten, Kopieren, Absagen öffnen ihre Fenster; Chat führt in den Chat-Raum', async () => {
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    expect(geoeffnet('QRDisplayModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Event bearbeiten' }));
    expect(geoeffnet('EventModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Event absagen' }));
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Event-Chat öffnen' }));
    expect(routerPush).toHaveBeenCalledWith('/admin/chat/room/55', 'root');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Event kopieren' })); });
    expect(geoeffnet('EventModal')).toHaveLength(2);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Chat ohne Raum: Leitung wird gefragt und legt ihn an, das Team sieht den Knopf gar nicht', async () => {
    zustand.detail = freizeit({ chat_room_id: null });
    api.post.mockResolvedValue({ data: { chat_room_id: 77 } });
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Event-Chat öffnen' }));
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Chat erstellen?');
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Erstellen')!.handler!(); });
    expect(api.post).toHaveBeenCalledWith('/events/7/chat');
    expect(routerPush).toHaveBeenCalledWith('/admin/chat/room/77', 'root');
  });
});

describe('Konfis: Anwesenheit', () => {
  it('Tabelle "Konfis (2)": bestätigte und abgemeldete; die Warteliste hat eine eigene Tabelle', async () => {
    await oeffne();
    const konfis = karte('Konfis (2)');
    expect(within(konfis).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[0].querySelector('.web-zelle-titel')!.textContent))
      .toEqual(['Kim Konfi', 'Mia Muster', 'Ben Beispiel']);
    expect(konfis).toHaveTextContent('Jahrgang 2026');
    expect(konfis).toHaveTextContent('Krank');
    expect(within(karte('Warteliste (1)')).getByText('Wiebke Warte')).toBeInTheDocument();
  });

  it('der Stand steht an den Umschaltern: Mia ist anwesend, Kim noch offen', async () => {
    await oeffne();
    const mia = within(umschalter('Mia Muster'));
    expect(mia.getByRole('button', { name: 'Anwesend' })).toHaveAttribute('aria-pressed', 'true');
    expect(mia.getByRole('button', { name: 'Abwesend' })).toHaveAttribute('aria-pressed', 'false');
    const kim = within(umschalter('Kim Konfi'));
    expect(kim.getByRole('button', { name: 'Anwesend' })).toHaveAttribute('aria-pressed', 'false');
    expect(kim.getByRole('button', { name: 'Abwesend' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Anwesend" verbucht mit einem Klick (PUT) und zeigt es sofort; ein zweiter Klick nimmt es zurück', async () => {
    await oeffne();
    const kim = within(umschalter('Kim Konfi'));
    await act(async () => { fireEvent.click(kim.getByRole('button', { name: 'Anwesend' })); });
    expect(api.put).toHaveBeenLastCalledWith('/events/7/participants/1/attendance', { attendance_status: 'present' });
    expect(kim.getByRole('button', { name: 'Anwesend' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { fireEvent.click(kim.getByRole('button', { name: 'Anwesend' })); });
    expect(api.put).toHaveBeenLastCalledWith('/events/7/participants/1/attendance', { attendance_status: null });
    expect(kim.getByRole('button', { name: 'Anwesend' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Abwesend" verbucht als abwesend', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(within(umschalter('Kim Konfi')).getByRole('button', { name: 'Abwesend' })); });
    expect(api.put).toHaveBeenLastCalledWith('/events/7/participants/1/attendance', { attendance_status: 'absent' });
  });

  it('scheitert das Speichern, geht die Zeile zurück und eine Meldung erscheint', async () => {
    api.put.mockRejectedValue(new Error('Netz weg'));
    await oeffne();
    const kim = within(umschalter('Kim Konfi'));
    await act(async () => { fireEvent.click(kim.getByRole('button', { name: 'Anwesend' })); });
    expect(setError).toHaveBeenCalledWith('Fehler beim Aktualisieren der Anwesenheit');
    expect(kim.getByRole('button', { name: 'Anwesend' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('offline: der Grundstand aus der Liste, Absagen gesperrt, Hinweis auf die fehlende Teilnehmerliste', async () => {
    zustand.online = false;
    zustand.cache.set('admin:events:1', [freizeit()]);
    await oeffne();
    expect(screen.getByRole('heading', { level: 1, name: 'Konfi-Freizeit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Event absagen' })).toBeDisabled();
    expect(screen.getByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Anwesenheit von/ })).toBe(null);
  });

  it('"Alle bestätigen (1)" fragt nach, zählt Verbuchte und Warteliste mit und ruft erst nach dem Ja attendance-all', async () => {
    await oeffne();
    // Auch beim Team wartet noch jemand auf die Verbuchung -- die Tabelle der Konfis hat ihren eigenen Knopf.
    fireEvent.click(within(karte('Konfis (2)')).getByRole('button', { name: 'Alle bestätigen (1)' }));
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Alle bestätigen?');
    expect(frage.message).toBe('1 angemeldete Teilnehmer:in(nen) werden als anwesend verbucht (inkl. Punktevergabe). Bereits Verbuchte bleiben unverändert. Die Warteliste (1) bleibt unberührt.');
    expect(api.put).not.toHaveBeenCalled();
    api.put.mockResolvedValue({ data: { message: 'Teilnahmen verbucht' } });
    await act(async () => { await knopfIn(frage, 'Alle bestätigen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/attendance-all', { rolle: 'konfi' });
  });

  it('beim Team verbucht "Alle bestätigen" mit rolle teamer -- und sagt, dass es keine Punkte gibt', async () => {
    await oeffne();
    fireEvent.click(within(karte('Team (1)')).getByRole('button', { name: 'Alle bestätigen (1)' }));
    const frage = letzteRueckfrage();
    // Bis 03.10.2026: "1 angemeldete Team werden als anwesend verbucht Das Team
    // bekommt dabei keine Punkte.. Bereits ..." (Satzzeichen und Wort falsch).
    expect(frage.message).toBe('1 angemeldete Teamer:in(nen) werden als anwesend verbucht. Das Team bekommt dabei keine Punkte. Bereits Verbuchte bleiben unverändert.');
    await act(async () => { await knopfIn(frage, 'Alle bestätigen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/attendance-all', { rolle: 'teamer' });
  });
});

describe('Menü "Weitere Aktionen"', () => {
  const oeffneMenue = async (name: string) => {
    await oeffne();
    fireEvent.click(within(zeileVon(name)).getByRole('button', { name: `Weitere Aktionen für ${name}` }));
    return screen.getByRole('dialog', { name });
  };

  it('ohne Eintrag: Abgemeldet eintragen, Auf Warteliste setzen, Teilnahme entfernen -- nichts zum Zurücksetzen', async () => {
    const menue = await oeffneMenue('Kim Konfi');
    expect(within(menue).getAllByRole('button').map((b) => b.textContent!.trim()).filter(Boolean))
      .toEqual(['Abgemeldet eintragen', 'Auf Warteliste setzen', 'Teilnahme entfernen']);
  });

  it('mit Eintrag: auch Notiz und "Eintrag zurücksetzen"; das Zurücksetzen schickt null', async () => {
    const menue = await oeffneMenue('Mia Muster');
    expect(within(menue).getByRole('button', { name: 'Notiz hinzufügen' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(menue).getByRole('button', { name: 'Eintrag zurücksetzen' })); });
    expect(api.put).toHaveBeenLastCalledWith('/events/7/participants/2/attendance', { attendance_status: null });
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('"Abgemeldet eintragen" und "Notiz" öffnen die Fenster der App', async () => {
    const menue = await oeffneMenue('Mia Muster');
    fireEvent.click(within(menue).getByRole('button', { name: 'Abgemeldet eintragen' }));
    expect(geoeffnet('AbmeldungNachtragenModal')).toHaveLength(1);
    fireEvent.click(within(zeileVon('Mia Muster')).getByRole('button', { name: 'Weitere Aktionen für Mia Muster' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Notiz hinzufügen' }));
    expect(geoeffnet('AnwesenheitNotizModal')).toHaveLength(1);
  });

  it('"Auf Warteliste setzen" und "Teilnahme entfernen" fragen nach und rufen erst nach dem Ja ihre Route', async () => {
    const menue = await oeffneMenue('Kim Konfi');
    fireEvent.click(within(menue).getByRole('button', { name: 'Auf Warteliste setzen' }));
    let frage = letzteRueckfrage();
    expect(frage.header).toBe('Auf die Warteliste setzen?');
    expect(api.put).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Auf Warteliste')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/1/status', { status: 'waitlist' });

    fireEvent.click(within(zeileVon('Kim Konfi')).getByRole('button', { name: 'Weitere Aktionen für Kim Konfi' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Teilnahme entfernen' }));
    frage = letzteRueckfrage();
    expect(frage.header).toBe('Anmeldung entfernen?');
    expect(api.delete).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Entfernen')!.handler!(); });
    expect(api.delete).toHaveBeenCalledWith('/events/7/bookings/1');
  });

  it('Pflicht-Event: Konfis lassen sich weder entfernen noch auf die Warteliste setzen', async () => {
    zustand.detail = freizeit({ mandatory: true, registration_status: 'mandatory' });
    const menue = await oeffneMenue('Kim Konfi');
    expect(within(menue).queryByRole('button', { name: 'Teilnahme entfernen' })).toBe(null);
    expect(within(menue).queryByRole('button', { name: 'Auf Warteliste setzen' })).toBe(null);
    expect(within(menue).getByRole('button', { name: 'Abgemeldet eintragen' })).toBeInTheDocument();
  });

  it('Escape schließt das Menü, ohne etwas zu tun', async () => {
    const menue = await oeffneMenue('Kim Konfi');
    fireEvent.keyDown(menue, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.put).not.toHaveBeenCalled();
    expect(presentAlert).not.toHaveBeenCalled();
  });
});

describe('Teilnehmerliste ohne Netz', () => {
  // Die Detailansicht lädt offline keine Teilnehmenden (sie hängen an GET /events/:id); hier wird die Tabelle
  // selbst mit ihnen und ohne Netz gezeigt -- etwa, wenn das Netz erst nach dem Laden abreißt.
  const aktionen = { anwesenheit: vi.fn(), abmeldung: vi.fn(), notiz: vi.fn(), bestaetigen: vi.fn(), aufWarteliste: vi.fn(), entfernen: vi.fn() };

  it('Anwesend, Abwesend und "Alle bestätigen" sind gesperrt und sagen warum; ein Klick tut nichts', async () => {
    const { default: WebTeilnehmerLeitung } = await import('../../../components/admin/web/termine/WebTeilnehmerLeitung');
    render(
      <WebTeilnehmerLeitung
        titel="Konfis (1)" teilnehmende={[TEILNEHMENDE[0] as never]} mitZeitfenster={false} pflicht={false} darfVerwalten isOnline={false}
        aktionen={aktionen} alleBestaetigen={{ anzahl: 1, onClick: vi.fn() }}
      />,
    );
    const hinweis = 'Ohne Internetverbindung nicht möglich';
    for (const knopf of [screen.getByRole('button', { name: 'Anwesend' }), screen.getByRole('button', { name: 'Abwesend' }), screen.getByRole('button', { name: 'Alle bestätigen (1)' })]) {
      expect(knopf).toBeDisabled();
      expect(knopf).toHaveAttribute('title', hinweis);
      fireEvent.click(knopf);
    }
    expect(aktionen.anwesenheit).not.toHaveBeenCalled();
  });

  it('online dieselbe Tabelle: die Knöpfe rufen ihre Funktion', async () => {
    const { default: WebTeilnehmerLeitung } = await import('../../../components/admin/web/termine/WebTeilnehmerLeitung');
    render(<WebTeilnehmerLeitung titel="Konfis (1)" teilnehmende={[TEILNEHMENDE[0] as never]} mitZeitfenster={false} pflicht={false} darfVerwalten isOnline aktionen={aktionen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abwesend' }));
    expect(aktionen.anwesenheit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'absent');
  });
});

describe('Warteliste und Team', () => {
  it('Warteliste: "Bestätigen" setzt die Person auf bestätigt, "Entfernen" fragt nach', async () => {
    await oeffne();
    const warteliste = karte('Warteliste (1)');
    await act(async () => { fireEvent.click(within(warteliste).getByRole('button', { name: 'Wiebke Warte bestätigen' })); });
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/4/status', { status: 'confirmed' });
    fireEvent.click(within(warteliste).getByRole('button', { name: 'Wiebke Warte entfernen' }));
    expect(letzteRueckfrage().header).toBe('Anmeldung entfernen?');
  });

  it('Team: Tabelle mit Tim Teamer; Konfi, Team und Leitung lassen sich hinzufügen (je ein Fenster mit seiner Rolle)', async () => {
    await oeffne();
    expect(within(karte('Team (1)')).getByText('Tim Teamer')).toBeInTheDocument();
    for (const [name, rolle] of [['Konfi hinzufügen', 'konfi'], ['Team hinzufügen', 'teamer'], ['Leitung hinzufügen', 'leitung']] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(zuletztGeoeffnet('ParticipantManagementModal')!.props.filterRole).toBe(rolle);
    }
    expect(geoeffnet('ParticipantManagementModal')).toHaveLength(3);
  });

  it('Abmeldungen: Name, Zeitpunkt und Grund', async () => {
    await oeffne();
    const abmeldungen = karte('Abmeldungen (1)');
    expect(abmeldungen).toHaveTextContent('Ben Beispiel');
    expect(abmeldungen).toHaveTextContent('Krank');
  });

  it('Event nur für das Team: keine Konfi-Tabelle', async () => {
    zustand.detail = freizeit({ teamer_only: true, participants: [TEILNEHMENDE[4]] });
    await oeffne();
    expect(screen.queryByRole('region', { name: /^Konfis/ })).toBe(null);
    expect(screen.getByRole('region', { name: 'Team (1)' })).toBeInTheDocument();
  });
});

describe('Abgesagte Events', () => {
  it('Hinweis mit Grund, "Absage zurücknehmen" statt "Event absagen"; die Rücknahme fragt nach und ruft /reaktivieren', async () => {
    zustand.detail = freizeit({ registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung' });
    await oeffne();
    expect(screen.getAllByRole('status').some((s) => s.textContent!.includes('Grund: Sturmwarnung'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Event absagen' })).toBe(null);
    fireEvent.click(screen.getByRole('button', { name: 'Absage zurücknehmen' }));
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Absage zurücknehmen?');
    expect(api.put).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Zurücknehmen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/7/reaktivieren');
  });

  it('niemand kann an einem abgesagten Event eingetragen werden: keine "Hinzufügen"-Knöpfe', async () => {
    zustand.detail = freizeit({ registration_status: 'cancelled', cancelled: true });
    await oeffne();
    expect(screen.queryByRole('button', { name: /hinzufügen$/ })).toBe(null);
  });
});

describe('Zeitfenster', () => {
  it('Tabelle mit Belegung; volle Fenster sind als "Voll" markiert', async () => {
    zustand.detail = freizeit({
      has_timeslots: true,
      timeslots: [
        { id: 1, start_time: '2026-10-10T08:00:00Z', end_time: '2026-10-10T09:00:00Z', max_participants: 4, registered_count: 4 },
        { id: 2, start_time: '2026-10-10T09:00:00Z', end_time: '2026-10-10T10:00:00Z', max_participants: 4, registered_count: 1 },
      ],
    });
    await oeffne();
    const zeilen = within(karte('Zeitfenster (2)')).getAllByRole('row').slice(1);
    expect(zeilen[0]).toHaveTextContent('10:00 – 11:00');
    expect(zeilen[0]).toHaveTextContent('4/4');
    expect(zeilen[0]).toHaveTextContent('Voll');
    expect(zeilen[1]).toHaveTextContent('1/4');
    expect(zeilen[1]).toHaveTextContent('Frei');
  });
});

describe('Material', () => {
  it('Liste mit Dateizahl; ein Tipp öffnet das Material', async () => {
    api.get.mockImplementation((pfad: string) => {
      if (pfad === '/events/7') return Promise.resolve({ data: zustand.detail });
      if (pfad === '/material/by-event/7') return Promise.resolve({ data: [{ id: 11, title: 'Packliste', file_count: 2 }] });
      return Promise.resolve({ data: [] });
    });
    await oeffne();
    const material = karte('Material (1)');
    expect(within(material).getByText('2 Dateien')).toBeInTheDocument();
    fireEvent.click(within(material).getByRole('button', { name: 'Packliste' }));
    expect(geoeffnet('TeamerMaterialDetailPage')).toHaveLength(1);
  });
});

describe('Rechte', () => {
  it.each(['org_admin', 'admin'])('ERLAUBT: %s sieht Kopieren, Bearbeiten, Absagen, Anwesenheit und Hinzufügen', async (rolle) => {
    zustand.rolle = rolle;
    await oeffne();
    for (const name of ['Event kopieren', 'Event bearbeiten', 'Event absagen']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('group', { name: /^Anwesenheit von/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Konfi hinzufügen' })).toBeInTheDocument();
  });

  it('VERBOTEN: Teamer:innen können keinen Chat anlegen -- ohne Raum steht der Knopf nicht da', async () => {
    zustand.rolle = 'teamer';
    zustand.detail = freizeit({ chat_room_id: null });
    await oeffne();
    expect(screen.queryByRole('button', { name: 'Event-Chat öffnen' })).toBe(null);
  });

  it('VERBOTEN: Teamer:innen sehen die Teilnehmenden, aber weder Verwaltung noch Anwesenheit noch Hinzufügen', async () => {
    zustand.rolle = 'teamer';
    await oeffne();
    expect(screen.getByRole('region', { name: 'Konfis (2)' })).toBeInTheDocument();
    for (const name of ['Event kopieren', 'Event bearbeiten', 'Event absagen', 'Absage zurücknehmen']) {
      expect(screen.queryByRole('button', { name })).toBe(null);
    }
    expect(screen.queryByRole('group', { name: /^Anwesenheit von/ })).toBe(null);
    expect(screen.queryByRole('button', { name: /Weitere Aktionen/ })).toBe(null);
    expect(screen.queryByRole('button', { name: /hinzufügen$/ })).toBe(null);
    expect(screen.queryByRole('button', { name: /^Alle bestätigen/ })).toBe(null);
    // Den Chat-Raum, den es gibt, darf auch das Team öffnen.
    expect(screen.getByRole('button', { name: 'Event-Chat öffnen' })).toBeInTheDocument();
  });

  it('Teamer:innen melden sich selbst: "Bist du dabei?" mit Zusage und Absage', async () => {
    zustand.rolle = 'teamer';
    await oeffne();
    const zusage = karte('Bist du dabei?');
    await act(async () => { fireEvent.click(within(zusage).getByRole('button', { name: 'Dabei' })); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/7/zusage', { dabei: true });
    fireEvent.click(within(karte('Bist du dabei?')).getByRole('button', { name: /Nicht/ }));
    expect(geoeffnet('TeamerAbsageModal')).toHaveLength(1);
  });
});

describe('Laden, Fehler, Jahrgang', () => {
  it('ein Termin aus einem fremden Jahrgang (403): die Erklärung mit Weg zurück', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 403, data: { error_code: 'jahrgang_nicht_zugewiesen' } } }));
    await oeffne();
    expect(screen.getByRole('heading', { name: 'Nicht deinem Jahrgang zugeordnet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Events' })).toHaveAttribute('href', '/admin/events');
  });

  it('ein anderer Fehler: "konnte nicht geladen werden" mit erneutem Versuch, der neu lädt', async () => {
    api.get.mockRejectedValue(new Error('Netz weg'));
    await oeffne();
    expect(screen.getByRole('alert')).toHaveTextContent('Das Event konnte nicht geladen werden.');
    api.get.mockImplementation(() => Promise.resolve({ data: freizeit() }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 1, name: 'Konfi-Freizeit' })).toBeInTheDocument();
  });
});

describe('Schmales Fenster: die App bleibt, wie sie ist', () => {
  it('Kopfzeile mit dem Event, keine Tabellen, kein Link "Alle Events"', async () => {
    breit.wert = false;
    await oeffne();
    expect(screen.queryByRole('link', { name: 'Alle Events' })).toBe(null);
    expect(screen.queryByRole('table')).toBe(null);
    expect(screen.getByTestId('kopfzeile')).toHaveAttribute('data-titel', 'Konfi-Freizeit');
  });
});
