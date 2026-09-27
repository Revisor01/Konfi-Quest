// backend/tests/utils/begrenztParallel.test.js
//
// begrenztParallel: Promise.allSettled mit Obergrenze (Betrieb BF-06).
const { begrenztParallel } = require('../../utils/begrenztParallel');

const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

describe('begrenztParallel', () => {
  it('laesst nie mehr als `grenze` Aufgaben gleichzeitig laufen', async () => {
    let laufend = 0;
    let spitze = 0;
    const eingabe = Array.from({ length: 20 }, (_, i) => i);

    await begrenztParallel(eingabe, 3, async () => {
      laufend++;
      spitze = Math.max(spitze, laufend);
      await schlafen(5);
      laufend--;
    });

    expect(spitze).toBe(3);
  });

  it('liefert Ergebnisse in Eingabe-Reihenfolge, wie Promise.allSettled', async () => {
    const eingabe = [30, 5, 15, 1];

    const ergebnisse = await begrenztParallel(eingabe, 2, async (ms) => {
      await schlafen(ms);
      return ms * 2;
    });

    expect(ergebnisse).toEqual([
      { status: 'fulfilled', value: 60 },
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 2 },
    ]);
  });

  it('faengt Fehler je Aufgabe ab und arbeitet die uebrigen weiter ab', async () => {
    const eingabe = [1, 2, 3, 4, 5];

    const ergebnisse = await begrenztParallel(eingabe, 2, async (n) => {
      if (n === 3) throw new Error('drei kaputt');
      return n;
    });

    expect(ergebnisse.map((r) => r.status)).toEqual([
      'fulfilled', 'fulfilled', 'rejected', 'fulfilled', 'fulfilled',
    ]);
    expect(ergebnisse[2].reason.message).toBe('drei kaputt');
  });

  it('kommt mit leerer Liste und einer Grenze groesser als die Liste zurecht', async () => {
    expect(await begrenztParallel([], 3, async () => 1)).toEqual([]);
    const ergebnisse = await begrenztParallel([1, 2], 10, async (n) => n);
    expect(ergebnisse).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ]);
  });
});
