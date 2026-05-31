// backend/tests/utils/streakCalculation.test.js
// Unit-Tests fuer computeCurrentStreak (gemeinsame Streak-Berechnung,
// Single Source of Truth fuer Badge-Wertung badges.js und Progress konfi.js).
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
    // Mehrere Datumswerte in derselben Woche zaehlen trotzdem als 1
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
