// Dauerhafte Warteschlange fuer die Arbeit nach der Antwort
// (utils/warteschlange.js, Migration 202).
//
// Befund: utils/nachAntwort.js arbeitete nur im Speicher des Prozesses. Endete
// der Prozess nach der Antwort (Deploy, Absturz), fehlten Push und Postfach.
// Diese Tests pruefen gegen die echte Test-Datenbank:
//   - ein Auftrag steht in der Tabelle, bevor er laeuft, und ist danach erledigt
//   - ein liegengebliebener Auftrag (Prozess weg) wird von einem Arbeiter geholt
//   - zwei Replicas nehmen denselben Auftrag nie beide an (SKIP LOCKED)
//   - Wiederholung mit Grenze, ohne erledigte Schritte doppelt zu senden
//   - ein alter Stand laesst Arten liegen, die er nicht kennt
//   - Herunterfahren gibt Angefangenes an die Schlange zurueck
//   - Aufraeumen, Notweg ohne Tabelle
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const ws = require('../../utils/warteschlange');

const T = ws.TABELLE;

describe('Nachlauf-Warteschlange', () => {
  let db;
  const aufrufe = [];

  beforeAll(() => {
    db = getTestPool();
    ws.registriereArt('test_merken', async (_db, p, k) => {
      await k.schritt('eins', async () => { aufrufe.push(['eins', p.wert]); });
    });
  });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    aufrufe.length = 0;
    ws._zuruecksetzen();
  });

  const zeile = async (id) => (await db.query(`SELECT * FROM ${T} WHERE id = $1`, [id])).rows[0];
  const alle = async () => (await db.query(`SELECT id, art, status, versuche, erledigte_schritte FROM ${T} ORDER BY id`)).rows;

  it('einreihen legt eine Zeile an, fuehrt sie sofort aus und vermerkt sie als erledigt -- ohne Parameter', async () => {
    await ws.einreihen(db, 'test_merken', { wert: 7 });
    expect(aufrufe).toEqual([['eins', 7]]);
    const [z] = await alle();
    expect(z).toEqual({ id: z.id, art: 'test_merken', status: 'erledigt', versuche: 1, erledigte_schritte: ['eins'] });
    const voll = await zeile(z.id);
    expect(voll.parameter).toEqual({});
    expect(voll.erledigt_am).not.toBeNull();
    expect(voll.gesperrt_bis).toBeNull();
  });

  it('Prozess endet direkt nach dem Einreihen: der Auftrag bleibt offen, ein Arbeiter (andere Replica) holt ihn', async () => {
    ws._lokalAnhalten(true);
    await ws.einreihen(db, 'test_merken', { wert: 1 });
    expect(aufrufe).toEqual([]);
    expect((await alle()).map((z) => z.status)).toEqual(['offen']);

    ws._lokalAnhalten(false);
    expect(await ws.einTakt(db)).toBe(1);
    expect(aufrufe).toEqual([['eins', 1]]);
    expect((await alle()).map((z) => z.status)).toEqual(['erledigt']);
  });

  it('Prozess stirbt mitten in der Arbeit: nach Ablauf der Sperre holt ihn ein anderer, vorher nicht', async () => {
    const { rows: [z] } = await db.query(
      `INSERT INTO ${T} (art, parameter, status, versuche, gesperrt_von, gesperrt_bis)
       VALUES ('test_merken', '{"wert": 2}', 'laeuft', 1, 'toter-prozess:1', NOW() + INTERVAL '1 minute') RETURNING id`);
    // Sperre laeuft noch: nicht anfassen (der andere koennte noch arbeiten).
    expect(await ws.einTakt(db)).toBe(0);
    expect(aufrufe).toEqual([]);

    await db.query(`UPDATE ${T} SET gesperrt_bis = NOW() - INTERVAL '1 second' WHERE id = $1`, [z.id]);
    expect(await ws.einTakt(db)).toBe(1);
    expect(aufrufe).toEqual([['eins', 2]]);
    const nachher = await zeile(z.id);
    expect(nachher.status).toBe('erledigt');
    expect(nachher.versuche).toBe(2);
    expect(nachher.gesperrt_von).toBe(ws.ICH);
  });

  it('SKIP LOCKED: eine gesperrte Zeile wird uebersprungen; zwei gleichzeitige Arbeiter teilen sich die Auftraege ohne Ueberschneidung', async () => {
    await db.query(
      `INSERT INTO ${T} (art, parameter) SELECT 'test_merken', jsonb_build_object('wert', g) FROM generate_series(1, 20) g`);

    // Eine andere Replica haelt die erste Zeile gerade im Annehmen fest.
    const fremd = await db.getClient();
    try {
      await fremd.query('BEGIN');
      const { rows: [gesperrt] } = await fremd.query(
        `SELECT id FROM ${T} ORDER BY id LIMIT 1 FOR UPDATE`);
      const [a, b] = await Promise.all([
        ws.annehmen(db, { anzahl: 10 }),
        ws.annehmen(db, { anzahl: 10 }),
      ]);
      const ids = [...a, ...b].map((r) => r.id);
      expect(ids).not.toContain(gesperrt.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(19);
    } finally {
      await fremd.query('ROLLBACK');
      fremd.release();
    }
  });

  it('ein Fehler schickt den Auftrag mit Abstand zurueck; ein erledigter Schritt laeuft beim zweiten Versuch nicht noch einmal', async () => {
    let zweiterSchrittKlappt = false;
    const gesendet = [];
    ws.registriereArt('test_zwei_schritte', async (_db, _p, k) => {
      await k.schritt('push', async () => { gesendet.push('push'); });
      await k.schritt('postfach', async () => {
        if (!zweiterSchrittKlappt) throw new Error('Postfach kaputt');
        gesendet.push('postfach');
      });
    });
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});

    await ws.einreihen(db, 'test_zwei_schritte', {});
    const [z] = await alle();
    const nachErstem = await zeile(z.id);
    expect(nachErstem.status).toBe('offen');
    expect(nachErstem.versuche).toBe(1);
    expect(nachErstem.erledigte_schritte).toEqual(['push']);
    expect(nachErstem.letzter_fehler).toContain('Postfach kaputt');
    // Abstand 30 s: jetzt noch nicht faellig.
    const { rows: [{ sekunden }] } = await db.query(
      `SELECT EXTRACT(EPOCH FROM faellig_ab - NOW())::int AS sekunden FROM ${T} WHERE id = $1`, [z.id]);
    expect(sekunden).toBeGreaterThanOrEqual(28);
    expect(sekunden).toBeLessThanOrEqual(30);
    expect(await ws.einTakt(db)).toBe(0);

    await db.query(`UPDATE ${T} SET faellig_ab = NOW() WHERE id = $1`, [z.id]);
    zweiterSchrittKlappt = true;
    expect(await ws.einTakt(db)).toBe(1);
    fehler.mockRestore();

    expect(gesendet).toEqual(['push', 'postfach']);
    const fertig = await zeile(z.id);
    expect(fertig.status).toBe('erledigt');
    expect(fertig.versuche).toBe(2);
    expect(fertig.erledigte_schritte).toEqual(['push', 'postfach']);
  });

  it('nach max_versuche ist Schluss: fehlgeschlagen, mit Fehlertext, und kein Takt nimmt ihn mehr', async () => {
    ws.registriereArt('test_immer_kaputt', async () => { throw new Error('immer kaputt'); }, { maxVersuche: 2 });
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    await ws.einreihen(db, 'test_immer_kaputt', {});
    const [z] = await alle();
    await db.query(`UPDATE ${T} SET faellig_ab = NOW() WHERE id = $1`, [z.id]);
    expect(await ws.einTakt(db)).toBe(1);
    fehler.mockRestore();

    const ende = await zeile(z.id);
    expect(ende.status).toBe('fehlgeschlagen');
    expect(ende.versuche).toBe(2);
    expect(ende.letzter_fehler).toContain('immer kaputt');
    expect(ende.erledigt_am).not.toBeNull();
    await db.query(`UPDATE ${T} SET faellig_ab = NOW() WHERE id = $1`, [z.id]);
    expect(await ws.einTakt(db)).toBe(0);
  });

  it('ein Auftrag, der den Prozess jedes Mal mitnimmt, wird nach max_versuche aufgegeben statt endlos neu angenommen', async () => {
    const { rows: [z] } = await db.query(
      `INSERT INTO ${T} (art, parameter, status, versuche, max_versuche, gesperrt_von, gesperrt_bis)
       VALUES ('test_merken', '{"wert": 3}', 'laeuft', 5, 5, 'toter-prozess:1', NOW() - INTERVAL '1 second') RETURNING id`);
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await ws.einTakt(db)).toBe(1);
    fehler.mockRestore();
    expect(aufrufe).toEqual([]);
    expect((await zeile(z.id)).status).toBe('fehlgeschlagen');
  });

  it('Rolling Deploy: eine Art, die dieser Stand nicht kennt, bleibt unangetastet liegen', async () => {
    const { rows: [z] } = await db.query(
      `INSERT INTO ${T} (art, parameter) VALUES ('art_aus_neuerem_stand', '{}') RETURNING id`);
    expect(await ws.einTakt(db)).toBe(0);
    const danach = await zeile(z.id);
    expect(danach.status).toBe('offen');
    expect(danach.versuche).toBe(0);
  });

  it('gleicher Schluessel zweimal eingereiht: nur ein Auftrag, nur ein Lauf', async () => {
    await ws.einreihen(db, 'test_merken', { wert: 5 }, { schluessel: 'einmalig-5' });
    await ws.einreihen(db, 'test_merken', { wert: 5 }, { schluessel: 'einmalig-5' });
    expect(aufrufe).toEqual([['eins', 5]]);
    expect((await alle()).length).toBe(1);
  });

  it('stopp: was rechtzeitig fertig wird, ist erledigt; was noch laeuft, geht zurueck in die Schlange, ohne als Versuch zu zaehlen', async () => {
    let freigeben;
    const haengt = new Promise((resolve) => { freigeben = resolve; });
    ws.registriereArt('test_haengt', async (_db, _p, k) => {
      await k.schritt('lang', async () => { await haengt; });
    });
    ws.registriereArt('test_schnell', async () => {});

    const arbeiter = ws.starteArbeiter(db, { taktMs: 60000 });
    const lauf = ws.einreihen(db, 'test_haengt', {});
    await ws.einreihen(db, 'test_schnell', {});
    // Warten, bis der haengende Auftrag angenommen ist.
    for (let i = 0; i < 50; i++) {
      const { rows } = await db.query(`SELECT status FROM ${T} WHERE art = 'test_haengt'`);
      if (rows[0] && rows[0].status === 'laeuft') break;
      await new Promise((r) => setTimeout(r, 20));
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { zurueckgegeben } = await arbeiter.stopp({ wartenMs: 100 });
    warn.mockRestore();
    expect(zurueckgegeben).toBe(1);

    // Nach der Art sortiert, nicht nach id: Die beiden einreihen() oben laufen
    // gleichzeitig (der erste ist nicht abgewartet), ihre INSERTs bekommen
    // die ids in beliebiger Reihenfolge (im vollen Lauf am 08.10.2026 einmal
    // vertauscht gesehen).
    const { rows } = await db.query(`SELECT art, status, versuche, gesperrt_von FROM ${T} ORDER BY art`);
    expect(rows).toEqual([
      { art: 'test_haengt', status: 'offen', versuche: 0, gesperrt_von: null },
      { art: 'test_schnell', status: 'erledigt', versuche: 1, gesperrt_von: ws.ICH },
    ]);

    // Nach dem Stopp wird nichts mehr lokal angestossen: neu Eingereihtes
    // wartet auf die andere Replica.
    await ws.einreihen(db, 'test_merken', { wert: 9 });
    expect(aufrufe).toEqual([]);

    freigeben();
    await lauf;
  });

  it('aufraeumen: erledigte nach 7, fehlgeschlagene nach 30 Tagen; offene und juengere bleiben', async () => {
    await db.query(
      `INSERT INTO ${T} (art, status, erledigt_am, bezeichnung) VALUES
         ('test_merken', 'erledigt', NOW() - INTERVAL '8 days', 'alt-erledigt'),
         ('test_merken', 'erledigt', NOW() - INTERVAL '6 days', 'jung-erledigt'),
         ('test_merken', 'fehlgeschlagen', NOW() - INTERVAL '31 days', 'alt-fehlgeschlagen'),
         ('test_merken', 'fehlgeschlagen', NOW() - INTERVAL '8 days', 'jung-fehlgeschlagen'),
         ('art_aus_neuerem_stand', 'offen', NULL, 'offen')`);
    expect(await ws.aufraeumen(db)).toBe(2);
    const { rows } = await db.query(`SELECT bezeichnung FROM ${T} ORDER BY id`);
    expect(rows.map((r) => r.bezeichnung)).toEqual(['jung-erledigt', 'jung-fehlgeschlagen', 'offen']);
  });

  it('Notweg: laesst sich nicht einreihen (Tabelle fehlt), laeuft die Arbeit wie bisher im Prozess', async () => {
    const ohneTabelle = {
      query: async () => { const e = new Error('relation "nachlauf_auftraege" does not exist'); e.code = '42P01'; throw e; },
    };
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    await ws.einreihen(ohneTabelle, 'test_merken', { wert: 4 });
    fehler.mockRestore();
    expect(aufrufe).toEqual([['eins', 4]]);
  });

  it('eine unbekannte Art wird gemeldet und wirft nicht', async () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(ws.einreihen(db, 'gibt_es_nicht', {})).resolves.toBeUndefined();
    expect(fehler).toHaveBeenCalledTimes(1);
    fehler.mockRestore();
    expect(await alle()).toEqual([]);
  });

  it('Wartezeit waechst: 30 s, 60 s, 120 s ... hoechstens eine Stunde', () => {
    expect([1, 2, 3, 4, 10, 20].map(ws.wartezeitMs)).toEqual([30000, 60000, 120000, 240000, 3600000, 3600000]);
  });
});
