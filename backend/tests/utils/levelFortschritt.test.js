// backend/tests/utils/levelFortschritt.test.js
//
// Die Level-Schleife lag dreifach kopiert vor (Befund M2, 01.09.2026):
// Konfi-Dashboard, GET /levels/konfi/:userId und der Level-Aufstiegs-Push.
// Diese Tests halten die eine verbliebene Fassung fest — inklusive der
// Randfaelle, an denen die Kopien sich unterschieden.

const { berechneLevelFortschritt } = require('../../utils/levelFortschritt');

// Level wie im Seed: 0 / 5 / 10 / 20 Punkte
const LEVELS = [
  { id: 1, title: 'Novize', points_required: 0 },
  { id: 2, title: 'Lehrling', points_required: 5 },
  { id: 3, title: 'Gehilfe', points_required: 10 },
  { id: 4, title: 'Experte', points_required: 20 },
];

describe('berechneLevelFortschritt', () => {
  it('genau auf der Schwelle zaehlt das Level als erreicht', () => {
    const e = berechneLevelFortschritt(5, LEVELS);
    expect(e.currentLevel.id).toBe(2);
    expect(e.nextLevel.id).toBe(3);
    expect(e.levelIndex).toBe(2);
    expect(e.levelProgress).toBe(0);
    expect(e.pointsToNextLevel).toBe(5);
  });

  it('zwischen zwei Leveln wird anteilig gerechnet', () => {
    const e = berechneLevelFortschritt(12, LEVELS);
    expect(e.currentLevel.id).toBe(3);
    expect(e.nextLevel.id).toBe(4);
    expect(e.levelIndex).toBe(3);
    expect(e.levelProgress).toBe(20); // 2 von 10 Punkten
    expect(e.pointsToNextLevel).toBe(8);
  });

  it('Hoechstlevel: kein naechstes Level, Fortschritt 100, 0 fehlende Punkte', () => {
    const e = berechneLevelFortschritt(25, LEVELS);
    expect(e.currentLevel.id).toBe(4);
    expect(e.nextLevel).toBeNull();
    expect(e.levelIndex).toBe(4);
    expect(e.levelProgress).toBe(100);
    expect(e.pointsToNextLevel).toBe(0);
  });

  it('noch kein Level erreicht: currentLevel null, levelIndex 0', () => {
    // Level-Liste ohne Nullschwelle
    const ohneNull = LEVELS.slice(1);
    const e = berechneLevelFortschritt(2, ohneNull);
    expect(e.currentLevel).toBeNull();
    expect(e.levelIndex).toBe(0);
    expect(e.nextLevel.id).toBe(2);
    expect(e.levelProgress).toBe(40); // 2 von 5 Punkten
    expect(e.pointsToNextLevel).toBe(3);
  });

  it('negativer Punktestand: Fortschritt 0, nicht negativ und nicht NaN', () => {
    // Die Dashboard-Kopie lieferte hier -20 bzw. NaN (division durch die
    // Nullschwelle). Die levels.js-Kopie klemmte korrekt auf 0 — diese
    // Fassung gewinnt.
    const ohneNull = LEVELS.slice(1);
    const e = berechneLevelFortschritt(-1, ohneNull);
    expect(e.currentLevel).toBeNull();
    expect(e.levelProgress).toBe(0);
    expect(e.pointsToNextLevel).toBe(6);

    const mitNull = berechneLevelFortschritt(-3, LEVELS);
    expect(mitNull.currentLevel).toBeNull();
    expect(mitNull.levelProgress).toBe(0);
    expect(Number.isNaN(mitNull.levelProgress)).toBe(false);
    expect(mitNull.pointsToNextLevel).toBe(3);
  });

  it('leere Level-Liste: kein Level, kein naechstes, Fortschritt 100', () => {
    const e = berechneLevelFortschritt(42, []);
    expect(e.currentLevel).toBeNull();
    expect(e.nextLevel).toBeNull();
    expect(e.levelIndex).toBe(0);
    expect(e.levelProgress).toBe(100);
    expect(e.pointsToNextLevel).toBe(0);
  });

  it('zwei Level mit derselben Schwelle erzeugen keine Division durch Null', () => {
    const gleich = [
      { id: 1, points_required: 3 },
      { id: 2, points_required: 3 },
      { id: 3, points_required: 7 },
    ];
    const e = berechneLevelFortschritt(3, gleich);
    expect(e.currentLevel.id).toBe(2);
    expect(e.levelIndex).toBe(2);
    expect(e.levelProgress).toBe(0);
    expect(e.pointsToNextLevel).toBe(4);
  });

  it('Punktestand als Text (pg liefert numeric als String) wird als Zahl gerechnet', () => {
    const e = berechneLevelFortschritt('12', LEVELS);
    expect(e.currentLevel.id).toBe(3);
    expect(e.levelProgress).toBe(20);
    expect(e.pointsToNextLevel).toBe(8);
  });
});
