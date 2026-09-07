/**
 * Die Ueberschrift des Rueckblicks -- ohne freie Titel.
 *
 * SIMONS REGEL (07.09.2026), woertlich: "wir lassen das mit dem Datum. Wir
 * machen einfach immer Konfi bis jetzt von Beginn und Teamer der Rueckblick
 * des Jahres. Also immer zurueck auf den 1.1. des Jahres. Sonst ist das zu
 * kompliziert mit den rueckblicken. Dann braucht es auch keine Titel."
 *
 * Vorher trug jede Ausgabe einen Namen, den die Leitung eintippte
 * ("Zwischenstand", "Dein Abschluss"). Er stand auf der ersten und der
 * letzten Seite. Jetzt ergibt sich die Ueberschrift aus dem Rueckblick
 * selbst -- und genau das pruefen diese Tests.
 */

import { describe, test, expect } from 'vitest';
import {
  konfiUeberschrift,
  teamerUeberschrift,
  TAGE_BIS_KONFIRMATION
} from '../../components/wrapped/ueberschrift';

/** Ein Datum um n Tage nach dem Stichtag. */
const tageNach = (basis: string, n: number) => {
  const d = new Date(basis);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const STAND = '2026-05-01';

describe('Die Ueberschrift des Konfi-Rueckblicks', () => {
  test('ohne Konfirmationstermin steht schlicht "Deine Konfi-Zeit"', () => {
    // Ohne Termin gibt es nichts, wozu der Rueckblick vorlaeufig waere.
    expect(konfiUeberschrift(null, STAND)).toEqual(['Deine', 'Konfi-Zeit']);
    expect(konfiUeberschrift(undefined, STAND)).toEqual(['Deine', 'Konfi-Zeit']);
  });

  test('mehr als 30 Tage vor der Konfirmation kommt "(bis jetzt)" dazu', () => {
    const weitHin = tageNach(STAND, TAGE_BIS_KONFIRMATION + 1);
    expect(konfiUeberschrift(weitHin, STAND)).toEqual(['Deine', 'Konfi-Zeit', '(bis jetzt)']);
  });

  test('genau 30 Tage davor ist es der Abschluss, ohne Nachsatz', () => {
    // Die Schwelle schliesst den 30. Tag ein: Ab hier ist "gleich soweit".
    const knapp = tageNach(STAND, TAGE_BIS_KONFIRMATION);
    expect(konfiUeberschrift(knapp, STAND)).toEqual(['Deine', 'Konfi-Zeit']);
  });

  test('kurz vor der Konfirmation kein Nachsatz', () => {
    expect(konfiUeberschrift(tageNach(STAND, 3), STAND)).toEqual(['Deine', 'Konfi-Zeit']);
  });

  test('nach der Konfirmation erst recht nicht', () => {
    expect(konfiUeberschrift(tageNach(STAND, -60), STAND)).toEqual(['Deine', 'Konfi-Zeit']);
  });

  test('der STAND entscheidet, nicht der heutige Tag', () => {
    // DER WICHTIGSTE FALL: Ein im Mai erzeugter Zwischenstand muss seinen
    // Nachsatz auch im November noch tragen. Waere die Uhr massgeblich,
    // aenderte sich die Ueberschrift eines fertigen Rueckblicks von selbst.
    const konfirmation = '2026-07-01';
    // Gemessen an einem Stand LANGE davor: vorlaeufig.
    expect(konfiUeberschrift(konfirmation, '2026-01-01'))
      .toEqual(['Deine', 'Konfi-Zeit', '(bis jetzt)']);
    // Gemessen an einem Stand kurz davor: der Abschluss.
    expect(konfiUeberschrift(konfirmation, '2026-06-25'))
      .toEqual(['Deine', 'Konfi-Zeit']);
  });

  test('ein unlesbares Datum bricht nichts', () => {
    // Alt-Snapshots und Datenfehler duerfen keine kaputte Seite erzeugen.
    expect(konfiUeberschrift('kein-datum', STAND)).toEqual(['Deine', 'Konfi-Zeit']);
    expect(konfiUeberschrift('2026-07-01', 'unsinn')).toEqual(['Deine', 'Konfi-Zeit']);
  });
});

describe('Die Ueberschrift des Team-Rueckblicks', () => {
  test('nennt das Kalenderjahr', () => {
    expect(teamerUeberschrift(2026)).toEqual(['Dein', 'Teamerjahr', '2026']);
    expect(teamerUeberschrift(2027)).toEqual(['Dein', 'Teamerjahr', '2027']);
  });

  test('zusammengesetzt liest sie sich als ein Satz', () => {
    expect(teamerUeberschrift(2025).join(' ')).toBe('Dein Teamerjahr 2025');
  });
});
