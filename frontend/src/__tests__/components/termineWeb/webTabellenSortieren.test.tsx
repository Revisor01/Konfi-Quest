// Die Tabellen der Web-Fassung sortieren nach Spalte (Simon, 07.10.2026:
// „bitte alle listen sortierbar machen durch klick auf den spaltennamen").
// Gerendert wird je die echte Tabelle mit ihren Spalten: Ein Klick auf den
// Kopf ordnet aufsteigend, ein zweiter dreht. Die Anträge und Aktivitäten
// der Leitung stehen in webAntraegeAktivitaeten.test.tsx, die Tabellen der
// Termin-Details in webTerminDetailLeitung.test.tsx und webTeamTerminDetail.test.tsx.
import { STATUS_FARBE } from '../../../utils/termineWeb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { h, zuruecksetzen, termin, inTagen, JETZT } from './geruestWeb';
import WebEventsTabelle from '../../../components/admin/web/termine/WebEventsTabelle';
import WebTeilnehmerLeitung, { type TeilnehmerAktionen } from '../../../components/admin/web/termine/WebTeilnehmerLeitung';
import WebChallengesTabelle from '../../../components/shared/web/challenges/WebChallengesTabelle';
import WebEigeneAntraege from '../../../components/shared/web/termine/WebEigeneAntraege';
import WebTerminAnsicht, { type WebTerminEintrag } from '../../../components/shared/web/termine/WebTerminAnsicht';
import WebTeamerMaterial, { type WebTeamerMaterialProps } from '../../../components/teamer/web/material/WebTeamerMaterial';
import WebKonfiHistorie from '../../../components/teamer/web/WebKonfiHistorie';
import { WebPunkteVerlauf } from '../../../components/konfi/web/WebProfilBausteine';
import type { ListenChallenge, ListenEintrag } from '../../../utils/challengesWeb';
import type { Participant } from '../../../types/event';
import type { ActivityRequest } from '../../../components/konfi/modals/RequestDetailModal';

beforeEach(() => {
  zuruecksetzen();
  try { window.localStorage.clear(); } catch { /* ohne Speicher gilt die Vorgabe */ }
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

/** Die Reihenfolge der Zeilen, gelesen an den Namen, die in ihnen stehen. */
const reihenfolge = (tabelle: HTMLElement, namen: readonly string[]) => within(tabelle).getAllByRole('row').slice(1)
  .map((zeile) => namen.find((n) => zeile.textContent!.includes(n)) ?? '?');

/** Klick auf den Kopf der Spalte -- der Knopf im columnheader. */
const sortiere = (tabelle: HTMLElement, kopf: string) => {
  const zelle = within(tabelle).getByRole('columnheader', { name: new RegExp(`^${kopf}`) });
  fireEvent.click(within(zelle).getByRole('button'));
  return zelle;
};

/** Erst aufsteigend, dann absteigend -- mit aria-sort am Kopf. */
const pruefeSortierung = (tabelle: () => HTMLElement, kopf: string, namen: readonly string[], auf: readonly string[]) => {
  const zelle = sortiere(tabelle(), kopf);
  expect(zelle).toHaveAttribute('aria-sort', 'ascending');
  expect(reihenfolge(tabelle(), namen)).toEqual(auf);
  sortiere(tabelle(), kopf);
  expect(zelle).toHaveAttribute('aria-sort', 'descending');
  expect(reihenfolge(tabelle(), namen)).toEqual([...auf].reverse());
};

describe('Events der Leitung (WebEventsTabelle)', () => {
  const EVENTS = [
    termin(1, 'Bibelabend', { event_date: inTagen(2), registered_count: 7, max_participants: 20, points: 1 }),
    termin(2, 'Adventsmarkt', { event_date: inTagen(5), registered_count: 2, max_participants: 20, points: 3 }),
    termin(3, 'Chorprobe', { event_date: inTagen(9), registered_count: 12, max_participants: 20, points: 2 }),
  ];
  const NAMEN = ['Bibelabend', 'Adventsmarkt', 'Chorprobe'];
  const zeige = () => render(
    <WebEventsTabelle
      events={EVENTS}
      abgesagte={[]}
      jahrgaenge={[]}
      darfVerwalten={false}
      aktionen={{ neu: vi.fn(), kopieren: vi.fn(), absagen: vi.fn(), zuruecknehmen: vi.fn(), loeschen: vi.fn() }}
    />,
  );
  const tabelle = () => screen.getByRole('table', { name: 'Events' });

  it('bis zum ersten Klick nach Datum; "Event" ordnet nach Name, ein zweiter Klick dreht', () => {
    zeige();
    expect(reihenfolge(tabelle(), NAMEN)).toEqual(['Bibelabend', 'Adventsmarkt', 'Chorprobe']);
    pruefeSortierung(tabelle, 'Event', NAMEN, ['Adventsmarkt', 'Bibelabend', 'Chorprobe']);
  });

  it('"Teilnahme" ordnet nach der Zahl der Angemeldeten, nicht als Text', () => {
    zeige();
    pruefeSortierung(tabelle, 'Teilnahme', NAMEN, ['Adventsmarkt', 'Bibelabend', 'Chorprobe']);
  });
});

describe('Teilnehmende der Leitung (WebTeilnehmerLeitung)', () => {
  const person = (id: number, name: string, zusatz: Partial<Participant> = {}) => ({
    id, user_id: id + 100, participant_name: name, role_name: 'konfi', created_at: '2026-09-01T10:00:00Z',
    status: 'confirmed', attendance_status: null, jahrgang_name: 'Jahrgang 2026', ...zusatz,
  }) as unknown as Participant;
  const PERSONEN = [
    person(1, 'Mia Muster', { timeslot_start_time: '2026-10-10T09:00:00Z', timeslot_end_time: '2026-10-10T10:00:00Z' }),
    person(2, 'Ben Beispiel', { attendance_status: 'present', timeslot_start_time: '2026-10-10T10:00:00Z', timeslot_end_time: '2026-10-10T11:00:00Z' }),
    person(3, 'Zoe Probe', { status: 'opted_out', timeslot_start_time: '2026-10-10T08:00:00Z', timeslot_end_time: '2026-10-10T09:00:00Z' }),
  ];
  const NAMEN = ['Mia Muster', 'Ben Beispiel', 'Zoe Probe'];
  const aktionen: TeilnehmerAktionen = {
    anwesenheit: vi.fn(), abmeldung: vi.fn(), notiz: vi.fn(), bestaetigen: vi.fn(), aufWarteliste: vi.fn(), entfernen: vi.fn(),
  };
  const zeige = () => render(
    <WebTeilnehmerLeitung
      titel="Konfis"
      teilnehmende={PERSONEN}
      mitZeitfenster
      pflicht={false}
      darfVerwalten={false}
      isOnline
      aktionen={aktionen}
    />,
  );
  const tabelle = () => screen.getByRole('table', { name: 'Konfis' });

  it('"Name" ordnet alphabetisch, ein zweiter Klick dreht', () => {
    zeige();
    pruefeSortierung(tabelle, 'Name', NAMEN, ['Ben Beispiel', 'Mia Muster', 'Zoe Probe']);
  });

  it('"Zeitfenster" ordnet nach dem Beginn des Fensters', () => {
    zeige();
    pruefeSortierung(tabelle, 'Zeitfenster', NAMEN, ['Zoe Probe', 'Mia Muster', 'Ben Beispiel']);
  });

  it('"Status" ordnet nach dem angezeigten Wort (Abgemeldet, Angemeldet/Anwesend ...)', () => {
    zeige();
    const tabelleJetzt = tabelle();
    const woerter = within(tabelleJetzt).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[2].querySelector('.web-pill, span')!.textContent!.trim());
    sortiere(tabelleJetzt, 'Status');
    const sortiert = within(tabelle()).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[2].querySelector('.web-pill, span')!.textContent!.trim());
    expect(sortiert).toEqual([...woerter].sort((a, b) => a.localeCompare(b, 'de')));
    expect(sortiert).not.toEqual(woerter);
  });
});

describe('Challenges (WebChallengesTabelle)', () => {
  const eintrag = (id: number, title: string, ends: number, beitraege: number): ListenEintrag<ListenChallenge> => ({
    challenge: {
      id, title, starts_at: inTagen(-5), ends_at: inTagen(ends), visibility: 'public', submission_count: beitraege,
    } as unknown as ListenChallenge,
    status: 'active',
  });
  const EINTRAEGE = [eintrag(1, 'Fotosafari', 20, 1), eintrag(2, 'Bibelvers lernen', 3, 12), eintrag(3, 'Kerze gestalten', 9, 4)];
  const NAMEN = ['Fotosafari', 'Bibelvers lernen', 'Kerze gestalten'];
  const zeige = () => render(
    <WebChallengesTabelle
      eintraege={EINTRAEGE}
      fuer="leitung"
      href={(c) => `/admin/challenges/${c.id}`}
      kugel={() => ({ anzahl: 0, text: '' })}
      eingereicht={() => false}
    />,
  );
  const tabelle = () => screen.getByRole('table', { name: 'Challenges' });

  it('"Challenge" ordnet nach Titel, ein zweiter Klick dreht', () => {
    zeige();
    pruefeSortierung(tabelle, 'Challenge', NAMEN, ['Bibelvers lernen', 'Fotosafari', 'Kerze gestalten']);
  });

  it('"Zeitraum" ordnet nach dem Ende, "Beiträge" nach der Zahl', () => {
    zeige();
    pruefeSortierung(tabelle, 'Zeitraum', NAMEN, ['Bibelvers lernen', 'Kerze gestalten', 'Fotosafari']);
    pruefeSortierung(tabelle, 'Beiträge', NAMEN, ['Fotosafari', 'Kerze gestalten', 'Bibelvers lernen']);
  });
});

describe('Eigene Aktivitäten (WebEigeneAntraege)', () => {
  const antrag = (id: number, name: string, datum: string, punkte: number, status: ActivityRequest['status']) => ({
    id, activity_id: id, activity_name: name, activity_points: punkte, activity_type: 'gemeinde',
    requested_date: datum, status, created_at: datum,
  }) as unknown as ActivityRequest;
  const ANTRAEGE = [
    antrag(1, 'Gemeindefest', '2026-09-20', 2, 'pending'),
    antrag(2, 'Adventsmarkt', '2026-09-02', 3, 'approved'),
    antrag(3, 'Krippenspiel', '2026-09-28', 1, 'rejected'),
  ];
  const NAMEN = ['Gemeindefest', 'Adventsmarkt', 'Krippenspiel'];
  const zeige = () => {
    h.standort = { pathname: '/konfi/events', search: '' };
    render(<WebEigeneAntraege antraege={ANTRAEGE} pfad="/konfi/events" standardFilter="alle" teamerMode={false} onOeffnen={vi.fn()} onLoeschen={vi.fn()} />);
  };
  const tabelle = () => screen.getByRole('table', { name: 'Deine Aktivitäten' });

  it('"Stattgefunden" ordnet nach Datum, ein zweiter Klick dreht', () => {
    zeige();
    pruefeSortierung(tabelle, 'Stattgefunden', NAMEN, ['Adventsmarkt', 'Gemeindefest', 'Krippenspiel']);
  });

  it('"Status" ordnet nach dem Wort, "Punkte" nach der Zahl', () => {
    zeige();
    // Abgelehnt, Angerechnet/Verbucht ..., Offen -- die Wörter der Marken.
    const zelle = sortiere(tabelle(), 'Status');
    expect(zelle).toHaveAttribute('aria-sort', 'ascending');
    const woerter = within(tabelle()).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[3].textContent!.trim());
    expect(woerter).toEqual([...woerter].sort((a, b) => a.localeCompare(b, 'de')));
    expect(reihenfolge(tabelle(), NAMEN)[0]).toBe('Krippenspiel');
    pruefeSortierung(tabelle, 'Punkte', NAMEN, ['Krippenspiel', 'Gemeindefest', 'Adventsmarkt']);
  });
});

describe('Events von Konfis und Team (WebTerminAnsicht)', () => {
  const eintrag = (id: number, name: string, tage: number, angemeldet: number): WebTerminEintrag => ({
    event: termin(id, name, { event_date: inTagen(tage), registered_count: angemeldet, max_participants: 20 }),
    href: `/konfi/events/${id}`,
    status: { text: 'Offen', farbe: STATUS_FARBE.success, ton: 'erfolg' } as WebTerminEintrag['status'],
    fakten: [{ art: 'plaetze', text: `${angemeldet}/20` }] as unknown as WebTerminEintrag['fakten'],
  });
  const EINTRAEGE = [eintrag(1, 'Zeltlager', 3, 9), eintrag(2, 'Bastelnachmittag', 12, 4), eintrag(3, 'Mitarbeiterabend', 1, 15)];
  const NAMEN = ['Zeltlager', 'Bastelnachmittag', 'Mitarbeiterabend'];
  const tabelle = () => screen.getByRole('table', { name: 'Events' });

  it('"Wann" ordnet nach Datum, "Event" nach Name, "Plätze" nach der Zahl', () => {
    render(<WebTerminAnsicht eintraege={EINTRAEGE} ansicht="liste" teamZeigen={false} />);
    pruefeSortierung(tabelle, 'Wann', NAMEN, ['Mitarbeiterabend', 'Zeltlager', 'Bastelnachmittag']);
    pruefeSortierung(tabelle, 'Event', NAMEN, ['Bastelnachmittag', 'Mitarbeiterabend', 'Zeltlager']);
    pruefeSortierung(tabelle, 'Plätze', NAMEN, ['Bastelnachmittag', 'Zeltlager', 'Mitarbeiterabend']);
  });
});

describe('Material fürs Team (WebTeamerMaterial)', () => {
  const MATERIAL = [
    { id: 1, title: 'Packliste', file_count: 1, jahrgaenge: [{ id: 2, name: 'Jahrgang 2027' }] },
    { id: 2, title: 'Andachtsideen', file_count: 4, link_count: 1, jahrgaenge: [{ id: 1, name: 'Jahrgang 2026' }] },
    { id: 3, title: 'Spielesammlung', file_count: 2 },
  ] as unknown as WebTeamerMaterialProps['uebrige'];
  const NAMEN = ['Packliste', 'Andachtsideen', 'Spielesammlung'];
  const tabelle = () => screen.getByRole('table', { name: 'Materialien' });

  it('"Material" ordnet nach Titel, "Inhalt" nach der Zahl der Dateien und Links', () => {
    render(
      <WebTeamerMaterial
        fuerAlle={[]} uebrige={MATERIAL} jahrgaenge={[]} jahrgangId={undefined} onJahrgang={vi.fn()}
        suche="" onSuche={vi.fn()} laedt={false} material={null} materialLaedt={false}
        onOeffnen={vi.fn()} onSchliessen={vi.fn()} onDatei={vi.fn()} onLink={vi.fn()}
      />,
    );
    pruefeSortierung(tabelle, 'Material', NAMEN, ['Andachtsideen', 'Packliste', 'Spielesammlung']);
    pruefeSortierung(tabelle, 'Inhalt', NAMEN, ['Packliste', 'Spielesammlung', 'Andachtsideen']);
  });
});

describe('Konfi-Zeit und Punkte-Verlauf (WebKonfiHistorie, WebPunkteVerlauf)', () => {
  it('Events der Konfi-Zeit: "Datum" und "Punkte" ordnen, ein zweiter Klick dreht', async () => {
    render(
      <WebKonfiHistorie
        punkte={{ gesamt: 0, gottesdienst: 0, gemeinde: 0 }}
        badges={[]}
        termine={[
          { event_id: 1, name: 'Osternacht', datum: '2026-04-04T20:00:00Z', punkte: 2 },
          { event_id: 2, name: 'Konfi-Camp', datum: '2025-09-12T10:00:00Z', punkte: 5 },
          { event_id: 3, name: 'Taizé-Abend', datum: '2026-01-20T18:00:00Z', punkte: 1 },
        ]}
        rueckblick={null}
        onRueckblick={vi.fn()}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    const tabelle = () => screen.getByRole('table', { name: 'Events der Konfi-Zeit' });
    const NAMEN = ['Osternacht', 'Konfi-Camp', 'Taizé-Abend'];
    pruefeSortierung(tabelle, 'Datum', NAMEN, ['Konfi-Camp', 'Taizé-Abend', 'Osternacht']);
    pruefeSortierung(tabelle, 'Punkte', NAMEN, ['Taizé-Abend', 'Osternacht', 'Konfi-Camp']);
  });

  it('Punkte-Verlauf: bis zum Klick neueste zuerst; "Wofür" ordnet nach Titel, "Punkte" nach der Zahl', async () => {
    h.api.get.mockResolvedValue({
      data: {
        history: [
          { id: 1, source_type: 'activity', title: 'Gemeindefest', points: 2, category: 'gemeinde', date: '2026-09-20' },
          { id: 2, source_type: 'event', title: 'Sonntagsgottesdienst', points: 1, category: 'gottesdienst', event_date: '2026-09-27T10:00:00Z' },
          { id: 3, source_type: 'bonus', title: 'Aufräumen', points: 5, category: 'gemeinde', date: '2026-08-30' },
        ],
      },
    });
    render(<WebPunkteVerlauf endpunkt="/konfi/points-history" gottesdienstAktiv gemeindeAktiv />);
    for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });
    const tabelle = () => screen.getByRole('table', { name: 'Punkte-Verlauf' });
    const NAMEN = ['Gemeindefest', 'Sonntagsgottesdienst', 'Aufräumen'];
    expect(reihenfolge(tabelle(), NAMEN)).toEqual(['Sonntagsgottesdienst', 'Gemeindefest', 'Aufräumen']);
    pruefeSortierung(tabelle, 'Wofür', NAMEN, ['Aufräumen', 'Gemeindefest', 'Sonntagsgottesdienst']);
    pruefeSortierung(tabelle, 'Punkte', NAMEN, ['Sonntagsgottesdienst', 'Gemeindefest', 'Aufräumen']);
    pruefeSortierung(tabelle, 'Datum', NAMEN, ['Aufräumen', 'Gemeindefest', 'Sonntagsgottesdienst']);
  });
});
