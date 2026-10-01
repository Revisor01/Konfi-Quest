// Konfis eines Pflicht-Termins nach Vornamen (01.10.2026), Teamer-Ansicht
// "Wer kommt". Dieselbe Regel wie in der Leitungsansicht
// (pflichtTerminNachVornameLeitung.test.tsx, Wunsch einer Gemeinde): Pflicht ->
// nach Name, sonst Anmeldereihenfolge. Das Team darunter bleibt, wie es ist.
import { describe, it, expect, beforeEach } from 'vitest';
import { zustand, zuruecksetzen, termin, teilnehmer, oeffneTermin, abschnitt } from './gerueste/teamerTerminSeite';

beforeEach(zuruecksetzen);

const GEBUCHT = [
  teilnehmer(1, 'Zoe Zander'),
  teilnehmer(2, 'Anna Albers'),
  teilnehmer(3, 'Mika Möller'),
  teilnehmer(9, 'Tom Teamer', { role_name: 'teamer' }),
];

const reihenfolgeIn = (liste: HTMLElement) => {
  const text = liste.textContent || '';
  return ['Zoe Zander', 'Anna Albers', 'Mika Möller'].sort((a, b) => text.indexOf(a) - text.indexOf(b));
};

describe('Wer kommt (Team)', () => {
  it('Pflicht-Termin: Konfis nach Vornamen', async () => {
    zustand.events = [termin({ mandatory: true })];
    zustand.details.set(77, { participants: GEBUCHT });
    await oeffneTermin();
    expect(reihenfolgeIn(abschnitt(/^Wer kommt/)!)).toEqual(['Anna Albers', 'Mika Möller', 'Zoe Zander']);
  });

  it('anderer Termin: Anmeldereihenfolge', async () => {
    zustand.events = [termin({ mandatory: false })];
    zustand.details.set(77, { participants: GEBUCHT });
    await oeffneTermin();
    expect(reihenfolgeIn(abschnitt(/^Wer kommt/)!)).toEqual(['Zoe Zander', 'Anna Albers', 'Mika Möller']);
  });
});
