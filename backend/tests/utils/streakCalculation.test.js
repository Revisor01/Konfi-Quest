// backend/tests/utils/streakCalculation.test.js
// Unit-Tests für computeCurrentStreak (gemeinsame Streak-Berechnung,
// Single Source of Truth für Badge-Wertung badges.js und Progress konfi.js).
// Reine Funktion ohne DB: berechnet den aktuellen Streak (Anzahl aufeinander-
// folgender aktiver ISO-Wochen bis zur neuesten aktiven Woche).
const { computeCurrentStreak, getYearWeek } = require('../../utils/streakCalculation');

describe('computeCurrentStreak', () => {
  it('leere Liste ergibt 0', () => {
    expect(computeCurrentStreak([])).toBe(0);
    expect(computeCurrentStreak(null)).toBe(0);
    expect(computeCurrentStreak(undefined)).toBe(0);
  });

  it('eine aktive Woche ergibt 1', () => {
    expect(computeCurrentStreak(['2026-03-02'])).toBe(1);
    // Mehrere Datumswerte in derselben Woche zählen trotzdem als 1
    expect(computeCurrentStreak(['2026-03-02', '2026-03-04'])).toBe(1);
  });

  it('drei aufeinanderfolgende Wochen ergeben 3', () => {
    // W10, W9, W8 (2026) in Folge
    expect(computeCurrentStreak(['2026-03-02', '2026-02-23', '2026-02-16'])).toBe(3);
  });

  it('Luecke bricht die Folge ab (W10, W9, W7 ergibt 2)', () => {
    // W10 -> W9 konsekutiv (Streak 2), W7 hat Luecke zu W9 -> Abbruch
    expect(computeCurrentStreak(['2026-03-02', '2026-02-23', '2026-02-09'])).toBe(2);
  });

  it('Jahresuebergang zaehlt durchgehend (W53/2026 + W1/2027 ergibt 2)', () => {
    // Verhaltenstreuer Jahresuebergangs-Testfall: 2026 hat 53 ISO-Wochen,
    // hier deckt sich die Formel mit dem realen Kalender, sodass W1/2027
    // konsekutiv auf W53/2026 folgt (expectedWeek === 0 Branch).
    expect(getYearWeek(new Date('2026-12-28'))).toBe('2026-W53');
    expect(getYearWeek(new Date('2027-01-04'))).toBe('2027-W01');
    expect(computeCurrentStreak(['2027-01-04', '2026-12-28'])).toBe(2);
  });

  it('ist reihenfolgeunabhaengig (sortiert intern absteigend)', () => {
    // Gleiche Wochen, andere Eingabereihenfolge -> gleiches Ergebnis
    expect(computeCurrentStreak(['2026-02-16', '2026-03-02', '2026-02-23'])).toBe(3);
  });

  it('ignoriert ungueltige Datumswerte (NaN-Wochen)', () => {
    // Ungueltiges Datum erzeugt NaN-Woche und wird herausgefiltert
    expect(computeCurrentStreak(['not-a-date', '2026-03-02'])).toBe(1);
  });
});

// SERIE IM FORTSCHRITT EHRLICH ZEIGEN (Entscheidung Simon, 29.09.2026)
//
// Die Wertung zaehlt ab der letzten aktiven Woche rueckwaerts (oben) und
// bleibt so. Der ANGEZEIGTE Fortschritt zeigt dagegen 0, sobald die letzte
// aktive Woche aelter als die Vorwoche ist -- genau dann beginnt die naechste
// aktive Woche tatsaechlich wieder bei 1. Vorher stand dort z. B. „3/4" fuer
// eine Serie, die seit Monaten gerissen war.
describe('angezeigteSerie', () => {
  const { angezeigteSerie } = require('../../utils/streakCalculation');
  // Mittwoch, 30.09.2026 (2026-W40), 12 Uhr Ortszeit.
  const jetzt = new Date(2026, 8, 30, 12, 0, 0);

  it('zeigt die Serie, wenn die letzte aktive Woche die laufende ist', () => {
    // W40, W39, W38
    expect(angezeigteSerie(['2026-09-28', '2026-09-21', '2026-09-14'], jetzt)).toBe(3);
  });

  it('zeigt die Serie, wenn die letzte aktive Woche die Vorwoche ist (sie kann noch weiterlaufen)', () => {
    // W39, W38, W37 -- in dieser Woche noch nichts, die Serie lebt.
    expect(angezeigteSerie(['2026-09-27', '2026-09-20', '2026-09-13'], jetzt)).toBe(3);
  });

  it('zeigt 0, wenn die letzte aktive Woche aelter als die Vorwoche ist', () => {
    // W38, W37, W36 -- W39 fehlt, die Serie ist gerissen.
    expect(angezeigteSerie(['2026-09-18', '2026-09-11', '2026-09-04'], jetzt)).toBe(0);
    // Die Wertung zaehlt dieselben Daten weiter als 3 (bleibt so).
    expect(computeCurrentStreak(['2026-09-18', '2026-09-11', '2026-09-04'])).toBe(3);
  });

  it('zeigt 0 ohne Eintraege', () => {
    expect(angezeigteSerie([], jetzt)).toBe(0);
    expect(angezeigteSerie(null, jetzt)).toBe(0);
  });

  it('kennt die Vorwoche auch ueber den Jahreswechsel (W53/2026 vor W01/2027)', () => {
    const montag = new Date(2027, 0, 4, 9, 0, 0); // 2027-W01
    expect(angezeigteSerie(['2026-12-28', '2026-12-21'], montag)).toBe(2);
    expect(angezeigteSerie(['2026-12-21', '2026-12-14'], montag)).toBe(0);
  });

  it('rechnet die Vorwoche nach Kalendertagen, nicht nach 168 Stunden (Zeitumstellung)', () => {
    // Montag nach der Umstellung auf Sommerzeit (29.03.2026), kurz nach
    // Mitternacht: 168 Stunden zurueck laege in Berlin schon am Sonntag der
    // Woche davor (W12). Die Vorwoche ist aber W13 -- eine Serie, die in W12
    // endete, ist gerissen.
    const kurzNachMitternacht = new Date(2026, 2, 30, 0, 30, 0); // 2026-W14
    expect(angezeigteSerie(['2026-03-23'], kurzNachMitternacht)).toBe(1);
    expect(angezeigteSerie(['2026-03-22'], kurzNachMitternacht)).toBe(0);
  });

  it('laesst einen kuenftig datierten Eintrag zaehlen', () => {
    // Ein Event in der naechsten Woche, schon verbucht -- die Folge ist nicht
    // gerissen, sie reicht nur nach vorn.
    expect(angezeigteSerie(['2026-10-05', '2026-09-28'], jetzt)).toBe(2);
  });
});
