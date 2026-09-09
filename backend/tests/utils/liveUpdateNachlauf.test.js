const liveUpdate = require('../../utils/liveUpdate');

/**
 * DER SPORADISCHE "Parse Error: Expected HTTP/, RTSP/ or ICE/".
 *
 * Etwa jeder 1200. Test fiel damit aus, wechselnd welcher, isoliert immer
 * gruen. Die Ursache lag NICHT in den Tests und NICHT in Parallelitaet
 * (maxWorkers ist 1): Die send*-Funktionen sind `async` und fragen die
 * Datenbank ab, werden aber an 118 Stellen ohne `await` gerufen. supertest
 * schliesst die Verbindung, sobald die Antwort da ist -- laeuft die Abfrage
 * dann noch, riss ihr Abbruch den naechsten Test mit.
 *
 * In Produktion ist der Aufruf ohne `await` richtig: Ein Live-Update ist
 * Beiwerk, die Antwort soll nicht darauf warten. Deshalb wurde nicht der
 * Aufruf geaendert, sondern der Nachlauf abwartbar gemacht.
 */
describe('Live-Updates: der Nachlauf ist abwartbar', () => {
  afterEach(() => liveUpdate._reset());

  /** Eine Datenbank, die absichtlich Zeit braucht. */
  function langsameDb(ms = 80) {
    let offen = 0;
    return {
      pool: { query: () => { offen++; return new Promise(r => setTimeout(() => { offen--; r({ rows: [] }); }, ms)); } },
      offene: () => offen,
    };
  }

  const scheinIo = { to: () => ({ emit: () => {} }) };

  it('nach dem Aufruf laeuft die Arbeit noch -- genau das riss die Tests mit', async () => {
    const db = langsameDb();
    liveUpdate.init(scheinIo, db.pool);

    liveUpdate.sendToOrgAdmins(1, 'test');
    // Ohne await ist die Abfrage hier noch unterwegs. Das ist der Zustand,
    // in dem supertest die Verbindung schloss.
    expect(db.offene()).toBe(1);

    await liveUpdate.warteAufLiveUpdates();
    expect(db.offene()).toBe(0);
  });

  it('warteAufLiveUpdates erfasst alle vier Sende-Wege', async () => {
    const db = langsameDb();
    liveUpdate.init(scheinIo, db.pool);

    liveUpdate.sendToOrgAdmins(1, 'a');
    liveUpdate.sendToOrgKonfis(1, 'b');
    liveUpdate.sendToJahrgang(1, 'c');
    expect(db.offene()).toBeGreaterThan(0);

    await liveUpdate.warteAufLiveUpdates();
    expect(db.offene()).toBe(0);
  });

  it('sendToOrg erfasst auch seine beiden inneren Aufrufe', async () => {
    // sendToOrg ruft intern sendToOrgAdmins UND sendToOrgKonfis -- beide
    // mit await, also haengen sie am selben Nachlauf.
    const db = langsameDb();
    liveUpdate.init(scheinIo, db.pool);

    liveUpdate.sendToOrg(1, 'test');
    await liveUpdate.warteAufLiveUpdates();
    expect(db.offene()).toBe(0);
  });

  it('der Rueckgabewert bleibt ein Promise', async () => {
    // Die Funktionen sind ueber eine Huelle exportiert. Wer sie doch einmal
    // mit await ruft, darf davon nichts merken (ALT-VERTRAG).
    liveUpdate.init(scheinIo, langsameDb(1).pool);
    const r = liveUpdate.sendToOrgAdmins(1, 'test');
    expect(r).toBeInstanceOf(Promise);
    await expect(r).resolves.toBeUndefined();
  });

  it('ohne Socket-Server passiert gar nichts', async () => {
    // _io ist null -> sofortige Rueckkehr, keine Datenbankabfrage.
    liveUpdate._reset();
    const db = langsameDb();
    await liveUpdate.sendToOrgAdmins(1, 'test');
    expect(db.offene()).toBe(0);
  });

  it('ein Fehler im Nachlauf blockiert das Warten nicht', async () => {
    // Beiwerk darf nie den Testlauf aufhalten -- deshalb allSettled.
    liveUpdate.init(scheinIo, { query: () => Promise.reject(new Error('DB weg')) });
    liveUpdate.sendToOrgAdmins(1, 'test');
    await expect(liveUpdate.warteAufLiveUpdates()).resolves.toBeUndefined();
  });
});
