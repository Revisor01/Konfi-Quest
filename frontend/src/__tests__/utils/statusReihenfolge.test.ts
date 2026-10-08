// Status-Spalten der Web-Tabellen sortieren in der fachlichen Reihenfolge,
// Offenes zuerst, nicht nach dem angezeigten Wort (Simon, 08.10.2026).
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import { nachReihe, sortiereZeilen } from '../../utils/tabelleSortieren';
import {
  ANTRAG_STATUS_REIHE,
  CHALLENGE_STATUS_REIHE,
  KONFI_ZEIT_STATUS_REIHE,
  TEILNAHME_STATUS_REIHE,
  TERMIN_STATUS_REIHE,
  antragStatusRang,
  badgeStatusRang,
  challengeStatusRang,
  konfiZeitStatusRang,
  konfispruchStatusRang,
  kontoStatusRang,
  teilnahmeStatusRang,
  terminStatusRang,
  vorgangStatusRang,
  zeitfensterStatusRang,
} from '../../utils/statusReihenfolge';
import { teilnahmeDarstellung } from '../../utils/teilnahmeStatus';
import { konfiZeitTerminStatus } from '../../utils/konfiZeit';

/** Sortiert Werte mit einem Rang auf- oder absteigend, wie die Tabelle es tut. */
const ordne = <T>(werte: readonly T[], rang: (w: T) => number | null, richtung: 'auf' | 'ab' = 'auf') =>
  sortiereZeilen(werte, rang, richtung);

describe('nachReihe', () => {
  const rang = nachReihe(['offen', 'verbucht', 'abgelehnt']);

  it('liefert die Stelle in der Reihe, nicht das Wort', () => {
    expect(rang('offen')).toBe(0);
    expect(rang('verbucht')).toBe(1);
    expect(rang('abgelehnt')).toBe(2);
  });

  it('ein unbekannter Wert steht hinter allen bekannten, ein leerer bleibt leer', () => {
    expect(rang('unbekannt')).toBe(3);
    expect(rang(null)).toBeNull();
    expect(rang(undefined)).toBeNull();
  });

  it('absteigend dreht die Reihe um; leere Werte stehen in beiden Richtungen unten', () => {
    const werte = ['abgelehnt', null, 'offen', 'verbucht'];
    expect(ordne(werte, rang, 'auf')).toEqual(['offen', 'verbucht', 'abgelehnt', null]);
    expect(ordne(werte, rang, 'ab')).toEqual(['abgelehnt', 'verbucht', 'offen', null]);
  });
});

describe('die Reihen', () => {
  it('kein Wert steht doppelt', () => {
    for (const reihe of [ANTRAG_STATUS_REIHE, TERMIN_STATUS_REIHE, TEILNAHME_STATUS_REIHE, KONFI_ZEIT_STATUS_REIHE, CHALLENGE_STATUS_REIHE]) {
      expect(new Set(reihe).size).toBe(reihe.length);
    }
  });

  it('Anträge: Offen, Verbucht/Angerechnet, Abgelehnt', () => {
    expect(ordne(['rejected', 'approved', 'pending'], antragStatusRang)).toEqual(['pending', 'approved', 'rejected']);
  });

  it('Events: verbuchen, offen, bevorstehend, gelaufen, abgesagt', () => {
    expect(ordne(['Abgesagt', 'Verbucht', 'Geschlossen', 'Ausgebucht', 'Bald', 'Offen', 'Verbuchen'], terminStatusRang))
      .toEqual(['Verbuchen', 'Offen', 'Bald', 'Ausgebucht', 'Geschlossen', 'Verbucht', 'Abgesagt']);
    expect(ordne(['Vergangen', 'Abgemeldet', 'Verpasst', 'Angemeldet', 'Ausstehend', 'Verbucht'], terminStatusRang))
      .toEqual(['Angemeldet', 'Ausstehend', 'Verbucht', 'Verpasst', 'Vergangen', 'Abgemeldet']);
  });

  it('Events: jedes Status-Wort aus termineWeb.ts steht in der Reihe', () => {
    const quelle = readFileSync(resolve(__dirname, '../../utils/termineWeb.ts'), 'utf8');
    const woerter = new Set([
      ...[...quelle.matchAll(/\btext = '([^']+)'/g)].map((m) => m[1]),
      ...[...quelle.matchAll(/mitTon\('([^']+)'/g)].map((m) => m[1]),
    ]);
    const fehlend = [...woerter].filter((w) => !TERMIN_STATUS_REIHE.includes(w));
    expect(fehlend).toEqual([]);
    // Und umgekehrt: die Reihe trägt kein Wort, das es nicht (mehr) gibt.
    expect(woerter.size).toBe(26);
    expect(TERMIN_STATUS_REIHE.length).toBe(woerter.size);
  });

  it('Teilnahme: erst unverbucht (Gebucht, Warteliste, Abgemeldet), dann verbucht', () => {
    const zeilen = [
      { attendance_status: 'excused', status: 'confirmed' },
      { attendance_status: 'absent', status: 'confirmed' },
      { attendance_status: 'present', status: 'confirmed' },
      { status: 'opted_out' },
      { status: 'waitlist' },
      { status: 'confirmed' },
    ];
    expect(ordne(zeilen, (z) => teilnahmeStatusRang(teilnahmeDarstellung(z).statusText)).map((z) => teilnahmeDarstellung(z).statusText))
      .toEqual(['Gebucht', 'Warteliste', 'Abgemeldet', 'Anwesend', 'Abwesend', 'Abgemeldet (nachgetragen)']);
  });

  it('Konfi-Zeit: jedes Wort aus konfiZeitTerminStatus steht in der Reihe, in Ablauf-Ordnung', () => {
    const termine = [
      { abgesagt: true, status: 'confirmed' },
      { status: 'opted_out' },
      { anwesenheit: 'absent', status: 'confirmed' },
      { status: null },
      { anwesenheit: 'present', status: 'confirmed' },
      { status: 'waitlist' },
      { status: 'confirmed' },
    ];
    const woerter = ordne(termine, (t) => konfiZeitStatusRang(konfiZeitTerminStatus(t))).map((t) => konfiZeitTerminStatus(t));
    expect(woerter).toEqual(['Angemeldet', 'Warteliste', 'Dabei', 'Punkte erhalten', 'Nicht da', 'Abgemeldet', 'Abgesagt']);
    expect(woerter.every((w) => KONFI_ZEIT_STATUS_REIHE.includes(w))).toBe(true);
  });

  it('Challenges: Läuft, Geplant, Entwurf, Beendet', () => {
    expect(ordne(['ended', 'draft', 'scheduled', 'active'] as const, challengeStatusRang)).toEqual(['active', 'scheduled', 'draft', 'ended']);
  });

  it('Zeitfenster: Frei vor Voll', () => {
    expect(ordne(['Voll', 'Frei'], zeitfensterStatusRang)).toEqual(['Frei', 'Voll']);
  });

  it('Konten: aktiv vor gesperrt', () => {
    expect(ordne([false, true], kontoStatusRang)).toEqual([true, false]);
  });

  it('Badges: aktiv vor inaktiv, darin sichtbar vor geheim (alphabetisch stünde „Aktiv Geheim" vorn)', () => {
    const b = (is_active: boolean, is_hidden: boolean) => ({ is_active, is_hidden });
    expect(ordne([b(false, true), b(true, true), b(false, false), b(true, false)], badgeStatusRang))
      .toEqual([b(true, false), b(true, true), b(false, false), b(false, true)]);
  });

  it('Konfispruch: frei vor gesperrt', () => {
    expect(ordne([false, true], konfispruchStatusRang)).toEqual([true, false]);
  });

  it('Support-Vorgänge: neu, in Arbeit, wartet, erledigt', () => {
    expect(ordne(['erledigt', 'wartet', 'neu', 'in_arbeit'], vorgangStatusRang)).toEqual(['neu', 'in_arbeit', 'wartet', 'erledigt']);
  });
});
