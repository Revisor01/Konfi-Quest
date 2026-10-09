// Team-Terminansicht ohne Verbindung (09.10.2026, Simon: „Details aus Cache
// ist gut.").
//
// Die Teilnehmerliste steht nur in GET /events/:id. Ohne Netz blieb sie bis
// dahin leer -- der Abschnitt "Wer kommt" verschwand, als käme niemand. War
// der Termin schon einmal mit Netz offen, kommt sie jetzt aus dem gemerkten
// Stand (services/detailSpeicher.ts), ohne Anfrage.
import { describe, it, expect, beforeEach } from 'vitest';
import { within, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnehmer, oeffneTermin, abschnitt, api,
} from './gerueste/teamerTerminSeite';

beforeEach(zuruecksetzen);

const LISTE = [teilnehmer(1, 'Kim Konfi'), teilnehmer(4, 'Tom Teamer', { role_name: 'teamer' })];

const nachlaufen = async () => {
  for (let i = 0; i < 10; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const einmalMitNetzOeffnen = async () => {
  zustand.events = [termin()];
  zustand.details.set(77, { participants: LISTE });
  const r = await oeffneTermin();
  await nachlaufen();
  r.unmount();
  api.get.mockClear();
};

describe('Team-Terminansicht ohne Verbindung', () => {
  it('online: GET /events/77 genau einmal -- das Merken fragt nicht zusätzlich', async () => {
    zustand.events = [termin()];
    zustand.details.set(77, { participants: LISTE });
    await oeffneTermin();
    await nachlaufen();
    expect(api.get.mock.calls.filter((c) => c[0] === '/events/77')).toHaveLength(1);
  });

  it('nach einem Besuch mit Netz: die Teilnehmerliste aus dem gemerkten Stand, ohne Anfrage', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffneTermin();
    await nachlaufen();
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade).not.toContain('/events/77');
    expect(pfade).not.toContain('/material/by-event/77');
    const liste = abschnitt(/^Wer kommt/)!;
    expect(within(liste).getByText('Kim Konfi')).toBeInTheDocument();
    expect(within(liste).getByText('Tom Teamer')).toBeInTheDocument();
  });

  it('ohne gemerkten Stand: keine Anfrage und keine Namen', async () => {
    zustand.events = [termin()];
    zustand.details.set(77, { participants: LISTE });
    zustand.online = false;
    await oeffneTermin();
    await nachlaufen();
    expect(api.get.mock.calls.map((c) => c[0])).not.toContain('/events/77');
    expect(abschnitt(/^Wer kommt/)).toBeNull();
  });
});
