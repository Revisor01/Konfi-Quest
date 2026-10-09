// Mitmachen (Leitung, Konfis, Team) und der Katalog der Aktivitäten: App und
// Web-Fassung lesen ihre Reiter und Filter aus EINER Beschreibung
// (seiten/mitmachenLeitung.ts, seiten/mitmachenMitglied.ts,
// seiten/aktivitaetenKatalog.ts; Simon, 09.10.2026). Gerendert wird jeweils
// die echte Seite einmal schmal (App) und einmal breit (Web); verglichen wird,
// was dasteht, mit dem, was die Beschreibung für die Fassung vorsieht.
//
// Dazu je ein Test für die Abweichungen, die beim Zusammenführen auffielen und
// behoben sind (09.10.2026).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { h, zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT } from './geruestWeb';
import { inFassung, type Fassung, type Wahl } from '../../../seiten/beschreibung';
import {
  LEITUNG_ANTRAG_STATUS,
  LEITUNG_ANTRAG_STATUS_BESCHRIFTUNG,
  LEITUNG_BEREICHE,
  LEITUNG_BEREICHE_BESCHRIFTUNG,
  LEITUNG_ZEITRAUM,
  LEITUNG_ZEITRAUM_BESCHRIFTUNG,
} from '../../../seiten/mitmachenLeitung';
import {
  EIGENE_ANTRAG_STATUS,
  EIGENE_ANTRAG_STATUS_BESCHRIFTUNG,
  KONFI_EVENTS,
  MITGLIED_BEREICHE,
  MITGLIED_EVENTS_BESCHRIFTUNG,
  TEAM_EVENTS,
} from '../../../seiten/mitmachenMitglied';
import { KATALOG_ART, KATALOG_ART_BESCHRIFTUNG, KATALOG_ROLLE, KATALOG_ROLLE_BESCHRIFTUNG } from '../../../seiten/aktivitaetenKatalog';

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

/** Was eine Fassung laut Beschreibung zeigt: in der App die Kurzform, wo es eine gibt. */
const erwartet = <S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, fassung: Fassung) =>
  inFassung(liste, fassung).map((w) => (fassung === 'app' ? w.kurz ?? w.label : w.label));

/** Die Beschriftung ohne Zahl dahinter ("Verbuchen1 Event wartet …" -> "Verbuchen"). */
const ohneZahl = (text: string | null) => (text ?? '').replace(/\d.*$/, '').trim();

/** Die Reiter der App: jede Leiste ist eine tablist (Attrappe von IonSegment). */
const appLeisten = () => screen.getAllByRole('tablist').map((l) => within(l).getAllByRole('tab').map((t) => ohneZahl(t.textContent)));
/** Die Chips einer Gruppe der Web-Fassung. */
const chips = (gruppe: string) => within(screen.getByRole('group', { name: gruppe })).getAllByRole('button').map((b) => ohneZahl(b.textContent));
/** Die Reiter oben der Web-Fassung (echte Links). */
const webReiter = (name: string) => within(screen.getByRole('navigation', { name })).getAllByRole('link').map((a) => ohneZahl(a.textContent));

const ANTRAG = (id: number, status: 'pending' | 'approved' | 'rejected', name: string) => ({
  id, konfi_id: 10 + id, konfi_name: `Person ${id}`, activity_id: 3, activity_name: name, activity_type: 'gemeinde',
  requested_date: '2026-09-27', status, created_at: `2026-10-0${id}T09:00:00Z`, updated_at: `2026-10-0${id}T09:00:00Z`,
});

describe('Mitmachen der Leitung: dieselben Reiter in App und Web', () => {
  const daten = { 'admin:events:': [], 'admin:events-cancelled:': [], 'admin:jahrgaenge:': [], 'admin:requests:': [] };

  it('App: Bereiche und Zeiträume aus der Beschreibung, ohne „Abgesagt"', async () => {
    h.breit = false;
    richteEin({ nutzer: 'leitung', pfad: '/admin/events', daten });
    await oeffne('leitung');
    expect(appLeisten()).toEqual([erwartet(LEITUNG_BEREICHE, 'app'), erwartet(LEITUNG_ZEITRAUM, 'app')]);
    expect(erwartet(LEITUNG_ZEITRAUM, 'app')).toEqual(['Aktuell', 'Verbuchen', 'Vergangen']);
  });

  it('Web: dieselben Bereiche als Links, die Zeiträume als Chips samt „Abgesagt"', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/events', daten });
    await oeffne('leitung');
    expect(webReiter(LEITUNG_BEREICHE_BESCHRIFTUNG)).toEqual(erwartet(LEITUNG_BEREICHE, 'web'));
    expect(chips(LEITUNG_ZEITRAUM_BESCHRIFTUNG)).toEqual(erwartet(LEITUNG_ZEITRAUM, 'web'));
    expect(erwartet(LEITUNG_ZEITRAUM, 'web')).toEqual(['Aktuell', 'Verbuchen', 'Vergangen', 'Abgesagt']);
  });

  it('Aktivitäten: App drei Stände, Web dazu „Alle"', async () => {
    h.breit = false;
    richteEin({ nutzer: 'leitung', pfad: '/admin/events', suche: '?segment=antraege', daten });
    const seite = await oeffne('leitung');
    expect(appLeisten()[1]).toEqual(erwartet(LEITUNG_ANTRAG_STATUS, 'app'));
    seite.unmount();

    h.breit = true;
    await oeffne('leitung');
    expect(chips(LEITUNG_ANTRAG_STATUS_BESCHRIFTUNG)).toEqual(erwartet(LEITUNG_ANTRAG_STATUS, 'web'));
    expect(erwartet(LEITUNG_ANTRAG_STATUS, 'web')).toEqual(['Offen', 'Verbucht', 'Abgelehnt', 'Alle']);
  });

  it('die Kacheln über den Aktivitäten der App folgen den Reitern der Beschreibung', async () => {
    h.breit = false;
    richteEin({
      nutzer: 'leitung', pfad: '/admin/events', suche: '?segment=antraege',
      daten: { ...daten, 'admin:requests:': [ANTRAG(1, 'pending', 'Gemeindefest'), ANTRAG(2, 'approved', 'Sonntagsgottesdienst')] },
    });
    await oeffne('leitung');
    const kacheln = screen.getAllByRole('button', { name: /: \d+ anzeigen$/ }).map((k) => k.getAttribute('aria-label'));
    expect(kacheln).toEqual(['Offen: 1 anzeigen', 'Verbucht: 1 anzeigen', 'Abgelehnt: 0 anzeigen']);
  });

  it('Behoben: ein leerer Reiter der App nennt seinen eigenen Grund (wie im Browser)', async () => {
    h.breit = false;
    richteEin({
      nutzer: 'leitung', pfad: '/admin/events', suche: '?segment=antraege',
      daten: { ...daten, 'admin:requests:': [ANTRAG(1, 'pending', 'Gemeindefest')] },
    });
    await oeffne('leitung');
    fireEvent.click(screen.getByRole('tab', { name: 'Verbucht' }));
    expect(screen.getByText('Noch keine Aktivität verbucht.')).toBeInTheDocument();
    expect(screen.queryByText('Konfirmand:innen können Aktivitäten beantragen')).toBeNull();
  });
});

describe('Mitmachen der Konfis und des Teams: dieselben Reiter in App und Web', () => {
  const KONFI_DATEN = { 'konfi:events:': [], 'konfi:requests:': [] };
  const TEAM_DATEN = { 'teamer:events:': [], 'teamer:requests:': [] };

  it('Konfis, App: Bereiche und Events aus der Beschreibung -- „Konfirmation" kurz als „Konfi"', async () => {
    h.breit = false;
    richteEin({ nutzer: 'konfi', pfad: '/konfi/events', daten: KONFI_DATEN });
    await oeffne('konfi');
    expect(appLeisten()).toEqual([erwartet(MITGLIED_BEREICHE, 'app'), erwartet(KONFI_EVENTS, 'app')]);
    expect(erwartet(KONFI_EVENTS, 'app')).toEqual(['Alle', 'Meine', 'Konfi']);
  });

  it('Konfis, Web: dieselben Events als Chips mit der vollen Beschriftung', async () => {
    richteEin({ nutzer: 'konfi', pfad: '/konfi/events', daten: KONFI_DATEN });
    await oeffne('konfi');
    expect(webReiter('Bereiche von Mitmachen')).toEqual(erwartet(MITGLIED_BEREICHE, 'web'));
    expect(chips(MITGLIED_EVENTS_BESCHRIFTUNG)).toEqual(erwartet(KONFI_EVENTS, 'web'));
    expect(erwartet(KONFI_EVENTS, 'web')).toEqual(['Alle', 'Meine', 'Konfirmation']);
  });

  it('Team: App und Web zeigen Alle, Meine, Team', async () => {
    h.breit = false;
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', daten: TEAM_DATEN });
    const seite = await oeffne('team');
    expect(appLeisten()).toEqual([erwartet(MITGLIED_BEREICHE, 'app'), erwartet(TEAM_EVENTS, 'app')]);
    seite.unmount();

    h.breit = true;
    await oeffne('team');
    expect(chips(MITGLIED_EVENTS_BESCHRIFTUNG)).toEqual(erwartet(TEAM_EVENTS, 'web'));
    expect(erwartet(TEAM_EVENTS, 'web')).toEqual(['Alle', 'Meine', 'Team']);
  });

  it('eigene Aktivitäten: App drei Stände, Web dazu „Alle"', async () => {
    h.breit = false;
    richteEin({ nutzer: 'konfi', pfad: '/konfi/events', suche: '?segment=antraege', daten: KONFI_DATEN });
    const seite = await oeffne('konfi');
    expect(appLeisten()[1]).toEqual(erwartet(EIGENE_ANTRAG_STATUS, 'app'));
    seite.unmount();

    h.breit = true;
    await oeffne('konfi');
    expect(chips(EIGENE_ANTRAG_STATUS_BESCHRIFTUNG)).toEqual(erwartet(EIGENE_ANTRAG_STATUS, 'web'));
  });

  it('Behoben: ein laufendes mehrtägiges Event steht bei den Konfis in der App unter „Alle"', async () => {
    h.breit = false;
    const freizeit = termin(301, 'Konfi-Freizeit', { event_date: inTagen(-1), event_end_time: inTagen(2) });
    richteEin({ nutzer: 'konfi', pfad: '/konfi/events', daten: { ...KONFI_DATEN, 'konfi:events:': [freizeit] } });
    await oeffne('konfi');
    fireEvent.click(screen.getByRole('tab', { name: 'Alle' }));
    expect(screen.getByText('Konfi-Freizeit')).toBeInTheDocument();
  });

  it('Behoben: die Suche der Konfi-App findet ein Event über seinen Namen', async () => {
    h.breit = false;
    const fest = termin(302, 'Gemeindefest', { event_date: inTagen(3), location: 'Pastorat' });
    const tag = termin(303, 'Konfi-Tag', { event_date: inTagen(4), location: 'Kirche' });
    richteEin({ nutzer: 'konfi', pfad: '/konfi/events', daten: { ...KONFI_DATEN, 'konfi:events:': [fest, tag] } });
    await oeffne('konfi');
    fireEvent.click(screen.getByRole('tab', { name: 'Alle' }));
    fireEvent.change(screen.getByLabelText('Events durchsuchen'), { target: { value: 'gemeindefest' } });
    expect(screen.getByText('Gemeindefest')).toBeInTheDocument();
    expect(screen.queryByText('Konfi-Tag')).toBeNull();
  });

  it('Behoben: die Kacheln über den eigenen Aktivitäten zählen alle Stände, nicht nur den gewählten', async () => {
    h.breit = false;
    richteEin({
      nutzer: 'konfi', pfad: '/konfi/events', suche: '?segment=antraege',
      daten: { ...KONFI_DATEN, 'konfi:requests:': [ANTRAG(1, 'pending', 'Gemeindefest'), ANTRAG(2, 'approved', 'Sonntagsgottesdienst'), ANTRAG(3, 'approved', 'Erntedank')] },
    });
    await oeffne('konfi');
    const kacheln = screen.getAllByRole('button', { name: /: \d+ anzeigen$/ }).map((k) => k.getAttribute('aria-label'));
    expect(kacheln).toEqual(['Offen: 1 anzeigen', 'Angerechnet: 2 anzeigen', 'Abgelehnt: 0 anzeigen']);
  });

  it('Behoben: das Team startet in der App bei den offenen Aktivitäten, nicht auf einer Liste ohne Reiter', async () => {
    h.breit = false;
    richteEin({
      nutzer: 'teamer', pfad: '/teamer/events', suche: '?segment=antraege',
      daten: { ...TEAM_DATEN, 'teamer:requests:': [ANTRAG(1, 'pending', 'Gemeindefest'), ANTRAG(2, 'approved', 'Sonntagsgottesdienst')] },
    });
    await oeffne('team');
    expect(screen.getByText('Gemeindefest')).toBeInTheDocument();
    expect(screen.queryByText('Sonntagsgottesdienst')).toBeNull();
  });
});

describe('Katalog der Aktivitäten: dieselben Reiter in App und Web', () => {
  const KONFI_AKT = [
    { id: 1, name: 'Gemeindefest helfen', type: 'gemeinde', points: 2, target_role: 'konfi' },
    { id: 2, name: 'Sonntagsgottesdienst', type: 'gottesdienst', points: 1, target_role: 'konfi' },
  ];
  const TEAM_AKT = [{ id: 3, name: 'Konfi-Tag begleiten', type: null, points: 0, target_role: 'teamer' }];
  const daten = { 'admin:activities:1:konfi': KONFI_AKT, 'admin:activities:1:teamer': TEAM_AKT };

  it('App: Rolle und Art aus der Beschreibung -- „Gottesdienst" kurz als „GoDi", die Kachel ebenso', async () => {
    h.breit = false;
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten });
    await oeffne('aktivitaeten');
    expect(appLeisten()).toEqual([erwartet(KATALOG_ROLLE, 'app'), erwartet(KATALOG_ART, 'app')]);
    expect(erwartet(KATALOG_ART, 'app')).toEqual(['Alle', 'Gemeinde', 'GoDi']);
    // Bis 09.10.2026 hieß die Kachel „Godi", der Reiter darunter „GoDi".
    expect(screen.getByRole('button', { name: 'GoDi: 1 anzeigen' })).toBeInTheDocument();
  });

  it('Web: dieselben Reiter als Chips, mit der vollen Beschriftung', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten });
    await oeffne('aktivitaeten');
    expect(chips(KATALOG_ROLLE_BESCHRIFTUNG)).toEqual(erwartet(KATALOG_ROLLE, 'web'));
    expect(chips(KATALOG_ART_BESCHRIFTUNG)).toEqual(erwartet(KATALOG_ART, 'web'));
  });

  it('Behoben: nach „Gemeinde" und dem Wechsel zu „Team" zeigt die App die Team-Aktivitäten', async () => {
    h.breit = false;
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten });
    await oeffne('aktivitaeten');
    fireEvent.click(screen.getByRole('tab', { name: 'Gemeinde' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Team' }));
    expect(screen.getByText('Konfi-Tag begleiten')).toBeInTheDocument();
  });

  it('Behoben: der Untertitel im Browser folgt der Rolle wie in der App', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten });
    await oeffne('aktivitaeten');
    expect(screen.getByText('Punkte und Aufgaben')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: KATALOG_ROLLE_BESCHRIFTUNG })).getByRole('button', { name: 'Team' }));
    expect(screen.getByText('Aktivitäten fürs Team')).toBeInTheDocument();
    expect(screen.queryByText('Hier legst du fest, wofür es Punkte gibt')).toBeNull();
  });
});
