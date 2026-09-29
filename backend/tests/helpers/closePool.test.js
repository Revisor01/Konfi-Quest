// closePool haengt nicht, wenn beim Schliessen noch ein Nachlauf laeuft
// (29.09.2026, Audit CI "Unklar": Test-Deadlocks in den Laeufen 931/938).
//
// Nachgestellt ist die Lage aus teamerZaehlerNachAbmeldung.test.js: Eine
// Route haelt ihre Verbindung nach der Antwort noch und wartet auf eine
// weitere Abfrage aus demselben, gerade vollen Pool; im selben Moment ruft
// afterAll closePool(). Mit dem alten closePool (sofort pool.end()) bediente
// der endende Pool die Warteschlange nicht mehr -- die Route bekam ihre
// Verbindung nie, gab ihre eigene nie zurueck, und der Hook lief nach 10 s
// in den Timeout.
const { getTestPool, closePool } = require('./db');

describe('closePool', () => {
  it('wartet ausgeliehene Verbindungen ab, statt den Pool darunter zu schliessen', async () => {
    const db = getTestPool();
    // Pool (max 5) fuellen: ein Halter wie die Route nach dem COMMIT ...
    const halter = await db.getClient();
    // ... und vier laufende Abfragen wie der Push-Nachlauf.
    const hintergrund = [1, 2, 3, 4].map(() => db.query('SELECT pg_sleep(0.3)'));
    // Der Halter braucht noch eine Verbindung (Event-Chat) und gibt erst
    // danach seine eigene zurueck.
    let nachlaufFehler = null;
    const nachlauf = (async () => {
      try {
        await db.query('SELECT 1');
      } catch (e) {
        nachlaufFehler = e;
      } finally {
        halter.release();
      }
    })();

    const start = Date.now();
    await closePool();
    const dauer = Date.now() - start;

    await Promise.all(hintergrund);
    await nachlauf;
    // Der Nachlauf kam durch (keine Zeitueberschreitung beim Verbinden) ...
    expect(nachlaufFehler).toBe(null);
    // ... und closePool war fertig, sobald die 0,3 s Abfragen durch waren --
    // weit unter der Zeitgrenze fuer Verbindungen (5 s) und dem Hook (10 s).
    expect(dauer).toBeLessThan(2000);
  }, 15000);
});
