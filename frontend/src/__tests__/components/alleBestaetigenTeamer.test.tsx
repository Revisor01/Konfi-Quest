// Befund H5 (26.08.2026): "Alle bestätigen" auch für Teamer:innen --
// gerendert (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test,
// 30.09.2026 umgestellt).
//
// "Alle bestätigen" gab es nur über der Konfi-Sektion. Das Backend
// unterstützt die Sammelverbuchung für Teamer:innen seit dem 25.08.
// ausdrücklich (PUT /:id/participants/attendance-all, `rolle: 'teamer'`,
// bewusst getrennt, weil Teamer:innen Abzeichen, aber KEINE Punkte
// bekommen) -- das Frontend rief die Route ohne Body auf und bot den Knopf
// für Teamer:innen gar nicht an. Folge: Die Leitung musste Teamer:innen
// einzeln verbuchen, und der Termin blieb im "Verbuchen"-Reiter hängen. Bei
// reinen Teamer-Terminen fehlte der Knopf vollständig.
//
// Gerendert wird die Leitungsansicht mit gemischter Teilnehmerliste; die
// Rückfrage wird mitgeschrieben und ihr "Alle bestätigen" angetippt.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, abschnitt, api, letzteRueckfrage, knopfIn,
} from './gerueste/leitungTerminDetail';

beforeEach(zuruecksetzen);

const team = (id: number, name: string, zusatz: Record<string, unknown> = {}) => teilnahme(id, name, { role_name: 'teamer', ...zusatz });

const GEMISCHT = termin({
  teamer_needed: true,
  participants: [
    teilnahme(1, 'Kim Konfi'),
    teilnahme(2, 'Lea Konfi'),
    teilnahme(3, 'Max Anwesend', { attendance_status: 'present' }),
    teilnahme(4, 'Wanda Warteliste', { status: 'waitlist' }),
    team(11, 'Tom Teamer'),
    team(12, 'Tina Verbucht', { attendance_status: 'present' }),
    team(13, 'Tessa Wartet', { status: 'waitlist' }),
  ],
});

const teamAbschnitt = () => abschnitt(/^Team \(/)!;
const alleBestaetigen = (bereich: HTMLElement) => within(bereich).queryByRole('button', { name: /^Alle bestätigen/ });

/** Knopf tippen, in der Rückfrage "Alle bestätigen" wählen. */
const bestaetigen = async (k: HTMLElement) => {
  await act(async () => { fireEvent.click(k); });
  const frage = letzteRueckfrage();
  await act(async () => { await knopfIn(frage, 'Alle bestätigen')!.handler!(); });
  return frage;
};

describe('Alle bestätigen: auch für Teamer:innen', () => {
  it('die Team-Sektion hat ihren eigenen Knopf -- er zählt nur unverbuchte, bestätigte Teamer:innen', async () => {
    zustand.detail = GEMISCHT;
    await oeffne();
    expect(alleBestaetigen(teamAbschnitt())?.textContent).toBe('Alle bestätigen (1)');
  });

  it('die Konfi-Sektion behält ihren Knopf und zählt ebenso nur die unverbuchten Bestätigten', async () => {
    zustand.detail = GEMISCHT;
    await oeffne();
    const konfiKnoepfe = screen.getAllByRole('button', { name: /^Alle bestätigen/ }).filter((k) => !teamAbschnitt().contains(k));
    expect(konfiKnoepfe.map((k) => k.textContent)).toEqual(['Alle bestätigen (2)']);
  });

  it('Team: die Rückfrage verspricht keine Punkte, und die Rolle teamer geht an den Server', async () => {
    zustand.detail = GEMISCHT;
    await oeffne();
    const frage = await bestaetigen(alleBestaetigen(teamAbschnitt())!);
    expect(frage.header).toBe('Alle bestätigen?');
    expect(frage.message).toContain('Das Team bekommt dabei keine Punkte.');
    expect(frage.message).not.toContain('Punktevergabe');
    expect(frage.message).toContain('Die Warteliste (1) bleibt unberührt.');
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/attendance-all', { rolle: 'teamer' });
  });

  it('Konfis: die Rückfrage nennt die Punktevergabe, und die Rolle konfi geht an den Server', async () => {
    zustand.detail = GEMISCHT;
    await oeffne();
    const konfiKnopf = screen.getByRole('button', { name: 'Alle bestätigen (2)' });
    const frage = await bestaetigen(konfiKnopf);
    expect(frage.message).toContain('(inkl. Punktevergabe)');
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/attendance-all', { rolle: 'konfi' });
  });

  it('der Knopf verschwindet, wenn im Team nichts mehr offen ist', async () => {
    zustand.detail = termin({
      teamer_needed: true,
      participants: [teilnahme(1, 'Kim Konfi'), team(12, 'Tina Verbucht', { attendance_status: 'present' })],
    });
    await oeffne();
    expect(alleBestaetigen(teamAbschnitt())).toBeNull();
    expect(screen.getByRole('button', { name: 'Alle bestätigen (1)' })).toBeInTheDocument();
  });

  it('die Team-Sektion samt Knopf erscheint auch bei reinen Teamer-Terminen', async () => {
    zustand.detail = termin({ teamer_only: true, participants: [team(11, 'Tom Teamer'), team(14, 'Toni Teamer')] });
    await oeffne();
    expect(alleBestaetigen(teamAbschnitt())?.textContent).toBe('Alle bestätigen (2)');
  });

  it('offline steht kein "Alle bestätigen" da (ohne Teilnehmerliste gibt es nichts zu verbuchen)', async () => {
    zustand.online = false;
    zustand.cache.set('admin:events:1', [GEMISCHT]);
    await oeffne();
    // Offline gibt es keine Teilnehmerliste -- also auch nichts zu bestätigen.
    expect(screen.queryAllByRole('button', { name: /^Alle bestätigen/ })).toEqual([]);
  });

  it('Teamer:innen bekommen den Knopf nicht (Verbuchen ist Leitungssache)', async () => {
    zustand.rolle = 'teamer';
    zustand.detail = GEMISCHT;
    await oeffne();
    expect(screen.queryAllByRole('button', { name: /^Alle bestätigen/ })).toEqual([]);
  });
});
