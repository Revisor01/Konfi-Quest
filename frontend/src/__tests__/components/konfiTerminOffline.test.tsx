// Konfi-Terminansicht: offline und beim Laden -- gerendert (Audit Tests
// 26.09.2026, BF-02, 30.09.2026).
//
// Übernommen aus zwei Quelltext-Tests, die neben der Leitungsansicht auch
// diese Ansicht am Quelltext prüften:
//   - adminEventDetailOffline, "Die Konfi-Ansicht bleibt repariert": Sie
//     teilt den Cache-Schlüssel mit ihrer Liste und fragt Zeitfenster und
//     Teilnehmerliste offline nicht ab (Nutzerhinweis 25.08.2026: "ich sehe
//     die Liste der Events, aber wenn ich in ein Event klicke ist alles 0 und
//     rot").
//   - ladeanzeigeDetailansichten, "die Konfi-Terminansicht bleibt die
//     Vorlage": Beim Laden steht die Ladeanzeige, nicht ein leeres Gerüst.
//
// Seit 09.10.2026 (Simon: „Details aus Cache ist gut."): War der Termin schon
// einmal mit Netz offen, kommen Teilnehmerliste und Zeitfenster ohne Netz aus
// dem gemerkten Stand (services/detailSpeicher.ts) -- weiter ohne Anfrage.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { setUser } from '../../services/tokenStore';
import { zustand, zuruecksetzen, termin, oeffne, api, querySchluessel } from './gerueste/konfiTerminDetail';

beforeEach(zuruecksetzen);

describe('Die Konfi-Ansicht offline', () => {
  it('liest ihren Termin aus der Terminliste der Konfi -- derselbe Schlüssel wie die Liste', async () => {
    await oeffne(termin({ has_timeslots: true }));
    expect(new Set(querySchluessel)).toEqual(new Set(['konfi:events:7']));
    expect(screen.getAllByText('Sommerfest').length).toBeGreaterThan(0);
  });

  it('fragt offline weder Zeitfenster noch Teilnehmerliste ab', async () => {
    zustand.online = false;
    await oeffne(termin({ has_timeslots: true }));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('online werden Zeitfenster und Teilnehmerliste nachgeladen', async () => {
    await oeffne(termin({ has_timeslots: true }));
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade).toContain('/konfi/events/5/timeslots');
    expect(pfade).toContain('/konfi/events/5/participants');
  });

  it('offline sagt die Ansicht, dass die Teilnehmerliste fehlt', async () => {
    zustand.online = false;
    await oeffne(termin());
    expect(screen.getByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeInTheDocument();
  });
});

describe('Die Konfi-Ansicht beim Laden', () => {
  it('zeigt die Ladeanzeige "Event wird geladen..." statt eines leeren Gerüsts', async () => {
    zustand.laedt = true;
    zustand.events = [termin()];
    await oeffne();
    expect(screen.getByTestId('ladeanzeige').textContent).toBe('Event wird geladen...');
    expect(screen.queryByText('Bist du dabei?')).toBeNull();
  });

  it('ist geladen, verschwindet die Ladeanzeige', async () => {
    await oeffne(termin());
    expect(screen.queryByTestId('ladeanzeige')).toBeNull();
    expect(screen.getAllByText('Bist du dabei?').length).toBeGreaterThan(0);
  });
});

describe('ohne Verbindung nach einem Besuch mit Netz', () => {
  const TEILNEHMER_PLATZHALTER = 'Die Teilnehmerliste ist offline nicht verfügbar.';
  const ZEITFENSTER_PLATZHALTER = 'Die Zeitfenster-Auswahl ist offline nicht verfügbar.';
  const MIT_ZEITFENSTER = () => termin({ has_timeslots: true });
  const nachlaufen = async () => {
    for (let i = 0; i < 10; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  };
  const einmalMitNetzOeffnen = async () => {
    zustand.teilnehmer = [{ id: 1, display_name: 'Mia Muster' }];
    zustand.zeitfenster = [{ id: 3, start_time: '10:00', end_time: '11:00', registered_count: 1, max_participants: 5 }];
    const r = await oeffne(MIT_ZEITFENSTER());
    await nachlaufen();
    r.unmount();
    api.get.mockClear();
  };

  afterEach(async () => { await setUser(null as never).catch(() => undefined); });

  it('online: je eine Anfrage für Zeitfenster und Teilnehmerliste -- das Merken fragt nicht zusätzlich', async () => {
    zustand.teilnehmer = [{ id: 1, display_name: 'Mia Muster' }];
    await oeffne(MIT_ZEITFENSTER());
    await nachlaufen();
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade.filter((p) => p === '/konfi/events/5/participants')).toHaveLength(1);
    expect(pfade.filter((p) => p === '/konfi/events/5/timeslots')).toHaveLength(1);
  });

  it('offline: Teilnehmerliste und Zeitfenster aus dem gemerkten Stand, ohne Anfrage und ohne Platzhalter', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffne(MIT_ZEITFENSTER());
    await nachlaufen();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByText('Mia Muster')).toBeInTheDocument();
    expect(screen.getByText(/\(1\/5 TN\)/)).toBeInTheDocument();
    expect(screen.queryByText(TEILNEHMER_PLATZHALTER)).toBeNull();
    expect(screen.queryByText(ZEITFENSTER_PLATZHALTER)).toBeNull();
  });

  it('offline ohne gemerkten Stand: weiter die Platzhalter', async () => {
    zustand.online = false;
    await oeffne(MIT_ZEITFENSTER());
    await nachlaufen();
    expect(screen.getByText(TEILNEHMER_PLATZHALTER)).toBeInTheDocument();
    expect(screen.getByText(ZEITFENSTER_PLATZHALTER)).toBeInTheDocument();
  });

  it('Anmelden bleibt offline gesperrt, auch mit gemerktem Stand', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffne(MIT_ZEITFENSTER());
    await nachlaufen();
    const gesperrt = screen.getAllByRole('button').filter((b) => /Du bist offline/.test(b.textContent ?? ''));
    expect(gesperrt.length).toBeGreaterThan(0);
    for (const k of gesperrt) expect(k).toBeDisabled();
  });

  it('Kontowechsel: ein anderes Konto sieht die gemerkte Teilnehmerliste nicht', async () => {
    await setUser({ id: 7, type: 'konfi' } as never);
    await einmalMitNetzOeffnen();
    await setUser({ id: 8, type: 'konfi' } as never);
    zustand.online = false;
    await oeffne(MIT_ZEITFENSTER());
    await nachlaufen();
    expect(screen.queryByText('Mia Muster')).toBeNull();
    expect(screen.getByText(TEILNEHMER_PLATZHALTER)).toBeInTheDocument();
  });
});
