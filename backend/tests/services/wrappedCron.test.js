// backend/tests/services/wrappedCron.test.js
//
// DER TEAM-RUECKBLICK ENTSTEHT AM 6. JANUAR VON SELBST -- in jeder Gemeinde.
//
// SIMONS VORGABE (07.09.2026), woertlich: "Ich finde Teamer zum 6.1 super
// wenn es automatisch passiert. Aber darf auch Manuel."
//
// Was hier geprueft wird, ist genau das Verhalten, das der Cron am 6.1.
// ausloest (checkWrappedTriggers). Der Zeitpunkt selbst -- '0 6 6 1 *' --
// liegt in node-cron und wird nicht mitgetestet: Ein Test, der auf den
// naechsten 6. Januar wartet, hilft niemandem.
//
// DIE WICHTIGSTE EIGENSCHAFT IST DIE IDEMPOTENZ. Der Cron kann nach einem
// Neustart am selben Tag erneut feuern, und die Leitung kann den Rueckblick
// vorher schon von Hand erzeugt haben. In beiden Faellen darf kein zweiter
// entstehen -- sonst bekaeme das ganze Team eine zweite Mitteilung und saehe
// denselben Rueckblick doppelt in seiner Liste.

const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ORGS, USERS } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');

describe('Team-Rueckblick am 6. Januar (Wrapped-Cron)', () => {
  let db;
  let wrappedRouter;

  beforeAll(() => {
    db = getTestPool();
    // Der Cron ruft den Router ueber BackgroundService.wrappedRouter -- so
    // wie der Server ihn beim Start setzt (server.js).
    const rbacDurchreiche = (req, res, next) => next();
    // Die Rollen-Helfer muessen echte Middleware sein, kein leeres Objekt:
    // Seit 1aea1404 haengt requireAdmin an POST /generate/:jahrgangId, und
    // express lehnt ein undefined als Handler beim Anlegen der Route ab
    // ("argument handler must be a function") -- die ganze Datei fiel damit
    // aus, nicht nur der eine Test. Dieser Test prueft den Cron, nicht die
    // Berechtigung; Durchreichen ist hier richtig.
    const rollenDurchreiche = {
      requireSuperAdmin: rbacDurchreiche,
      requireOrgAdmin: rbacDurchreiche,
      requireAdmin: rbacDurchreiche,
      requireTeamer: rbacDurchreiche
    };
    wrappedRouter = require('../../routes/wrapped')(db, rbacDurchreiche, rollenDurchreiche);
    BackgroundService.wrappedRouter = wrappedRouter;
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    BackgroundService.wrappedRouter = null;
    await closePool();
  });

  /** Das Jahr, dem der Rueckblick am 6. Januar gilt: das abgelaufene. */
  const RUECKBLICK_JAHR = new Date().getFullYear() - 1;

  /** Alle Team-Ausgaben einer Organisation. */
  async function ausgabenVon(orgId) {
    const { rows } = await db.query(
      `SELECT id, titel, zeitraum_start, zeitraum_ende
         FROM wrapped_ausgaben
        WHERE organization_id = $1 AND wrapped_type = 'teamer'
        ORDER BY id`,
      [orgId]
    );
    return rows;
  }

  /** Ortszeit-ISO -- toISOString() verschoebe die DATE-Spalte nach UTC. */
  const iso = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  it('legt in JEDER Organisation eine Ausgabe fuer das abgelaufene Jahr an', async () => {
    // "Fuer alle Gemeinden" -- ohne Filter, ohne Einstellung, ohne Ausnahme.
    await BackgroundService.checkWrappedTriggers(db);

    for (const org of [ORGS.testGemeinde, ORGS.andereGemeinde]) {
      const ausgaben = await ausgabenVon(org.id);
      expect(ausgaben).toHaveLength(1);
      expect(iso(ausgaben[0].zeitraum_start)).toBe(`${RUECKBLICK_JAHR}-01-01`);
      expect(iso(ausgaben[0].zeitraum_ende)).toBe(`${RUECKBLICK_JAHR}-12-31`);
    }
  });

  it('die Ausgabe ist sofort freigegeben -- sonst saehe sie niemand', async () => {
    // Der automatische Lauf hat niemanden, der ihn nachtraeglich
    // freischaltet. Waere er nicht freigegeben, waere die Automatik sinnlos.
    await BackgroundService.checkWrappedTriggers(db);

    const { rows } = await db.query(
      `SELECT freigegeben_at FROM wrapped_ausgaben
        WHERE organization_id = $1 AND wrapped_type = 'teamer'`,
      [ORGS.testGemeinde.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].freigegeben_at).not.toBeNull();
  });

  it('die Teamer:innen bekommen ihren Rueckblick', async () => {
    await BackgroundService.checkWrappedTriggers(db);

    const { rows } = await db.query(
      `SELECT s.year, s.ausgabe_id, s.data FROM wrapped_snapshots s
        WHERE s.user_id = $1 AND s.wrapped_type = 'teamer'`,
      [USERS.teamer1.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(RUECKBLICK_JAHR);
    expect(rows[0].ausgabe_id).toBeGreaterThan(0);
    // Der Zeitraum im Snapshot ist derselbe wie der der Ausgabe.
    expect(rows[0].data.slides.zeitraum.start).toBe(`${RUECKBLICK_JAHR}-01-01`);
    expect(rows[0].data.slides.zeitraum.ende).toBe(`${RUECKBLICK_JAHR}-12-31`);
  });

  it('ein zweiter Lauf legt NICHTS zusaetzlich an', async () => {
    // Der Cron kann nach einem Neustart am selben Tag erneut feuern.
    await BackgroundService.checkWrappedTriggers(db);
    await BackgroundService.checkWrappedTriggers(db);

    expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(1);

    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
        WHERE user_id = $1 AND wrapped_type = 'teamer'`,
      [USERS.teamer1.id]
    );
    expect(rows[0].anzahl).toBe(1);
  });

  it('hat die Leitung ihn schon von Hand erzeugt, laesst der Cron ihn in Ruhe', async () => {
    // DER FALL, DER DIE IDEMPOTENZ WIRKLICH BRAUCHT: Eine Leitung, die am
    // 3. Januar selbst auf "Rueckblick erstellen" tippt, darf am 6. keinen
    // zweiten bekommen -- und ihr Team keine zweite Mitteilung.
    const vonHand = await wrappedRouter.generateAllTeamerWrapped(
      db, ORGS.testGemeinde.id, RUECKBLICK_JAHR
    );
    expect(vonHand.uebersprungen).toBeUndefined();
    expect(vonHand.generated).toBeGreaterThan(0);

    await BackgroundService.checkWrappedTriggers(db);

    expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(1);
  });

  it('ein Rueckblick ueber ein ANDERES Jahr blockiert den neuen nicht', async () => {
    // Erkannt wird die Doppelung am ZEITRAUM, nicht daran, dass ueberhaupt
    // schon einmal etwas erzeugt wurde. Wer den Rueckblick auf 2024 hat,
    // bekommt den auf 2025 trotzdem.
    await wrappedRouter.generateAllTeamerWrapped(
      db, ORGS.testGemeinde.id, RUECKBLICK_JAHR - 1
    );

    await BackgroundService.checkWrappedTriggers(db);

    const ausgaben = await ausgabenVon(ORGS.testGemeinde.id);
    expect(ausgaben).toHaveLength(2);
    const jahre = ausgaben.map(a => Number(iso(a.zeitraum_start).slice(0, 4))).sort();
    expect(jahre).toEqual([RUECKBLICK_JAHR - 1, RUECKBLICK_JAHR]);
  });

  it('generateAllTeamerWrapped meldet, wenn sie uebersprungen hat', async () => {
    // Der Cron zaehlt nur, was wirklich entstanden ist -- dafuer braucht er
    // die Auskunft.
    await wrappedRouter.generateAllTeamerWrapped(db, ORGS.testGemeinde.id, RUECKBLICK_JAHR);
    const zweiter = await wrappedRouter.generateAllTeamerWrapped(
      db, ORGS.testGemeinde.id, RUECKBLICK_JAHR
    );
    expect(zweiter.uebersprungen).toBe(true);
    expect(zweiter.generated).toBe(0);
  });

  it('eine Gemeinde ohne Team bekommt eine leere Ausgabe, aber keinen Fehler', async () => {
    // Eine frisch angelegte Gemeinde hat noch niemanden im Team. Der Lauf
    // darf daran nicht scheitern und die uebrigen Gemeinden mitreissen.
    await db.query(
      `DELETE FROM users WHERE organization_id = $1
         AND role_id IN (SELECT id FROM roles WHERE name = 'teamer')`,
      [ORGS.andereGemeinde.id]
    );

    await BackgroundService.checkWrappedTriggers(db);

    expect(await ausgabenVon(ORGS.andereGemeinde.id)).toHaveLength(1);
    // Und die andere Gemeinde ist trotzdem versorgt.
    expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(1);
  });

  // ================================================================
  // Wenn gar nichts gelingt (Befund 14.09.2026)
  // ================================================================
  //
  // Der Cron hat kein res und niemanden, der die Zahlen ansieht. Umso
  // wichtiger ist, dass er einen Totalausfall nicht als Erfolg ablegt:
  // Bis zum 14.09.2026 schrieb er bei generated=0 trotzdem die Ausgabe fest
  // (COMMIT auf einer abgebrochenen Transaktion wirkt wie ROLLBACK und wirft
  // NICHT) und schickte dem ganzen Team "Dein Teamerjahr ist da!" -- fuer
  // einen Rueckblick, der nicht existierte. Und weil die Ausgabe fehlte,
  // griff die Idempotenz beim naechsten Lauf nicht.
  describe('Kein einziger Snapshot', () => {
    /** Laesst jede Snapshot-Abfrage der Teamgroesse scheitern. */
    async function ohneSpalte(tabelle, spalte, fn) {
      await db.query(`ALTER TABLE ${tabelle} RENAME COLUMN ${spalte} TO ${spalte}_weg`);
      try {
        return await fn();
      } finally {
        await db.query(`ALTER TABLE ${tabelle} RENAME COLUMN ${spalte}_weg TO ${spalte}`);
      }
    }

    it('wirft, statt eine leere Ausgabe festzuschreiben', async () => {
      await expect(
        ohneSpalte('user_jahrgang_assignments', 'jahrgang_id', () =>
          wrappedRouter.generateAllTeamerWrapped(db, ORGS.testGemeinde.id, RUECKBLICK_JAHR)
        )
      ).rejects.toThrow(/kein einziger Snapshot/);

      // Nichts bleibt liegen -- weder Ausgabe noch halber Snapshot.
      expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(0);
      const { rows: [snap] } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
          WHERE organization_id = $1 AND wrapped_type = 'teamer'`,
        [ORGS.testGemeinde.id]
      );
      expect(snap.anzahl).toBe(0);
    });

    // DER EIGENTLICHE SCHADEN WAR DER PUSH, nicht die Zeile in der Tabelle:
    // Ohne die Wache lief der Code bei generated=0 geradeaus zum Versand.
    // Die Ausgabe verschwand dabei ohnehin (COMMIT auf einer abgebrochenen
    // Transaktion wirkt wie ROLLBACK) -- das ganze Team bekam also "Dein
    // Teamerjahr ist da!" fuer etwas, das es nachweislich nicht gab. Genau
    // deshalb wird hier der Versand geprueft und nicht nur die Datenlage.
    it('benachrichtigt niemanden, wenn kein Rueckblick entstanden ist', async () => {
      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      await ohneSpalte('user_jahrgang_assignments', 'jahrgang_id', async () => {
        await expect(
          wrappedRouter.generateAllTeamerWrapped(db, ORGS.testGemeinde.id, RUECKBLICK_JAHR)
        ).rejects.toThrow(/kein einziger Snapshot/);
      });

      expect(spy).toHaveBeenCalledTimes(0);
      expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(0);

      spy.mockRestore();
    });

    it('der Cron faengt den Fehlschlag ab und versorgt die anderen Gemeinden', async () => {
      // checkWrappedTriggers faengt je Organisation ab. Eine Gemeinde, in der
      // es schiefgeht, darf die uebrigen nicht mitreissen.
      //
      // Damit der Fehler nur EINE Gemeinde trifft, bekommt die andere ihren
      // Rueckblick vorab: dort ueberspringt der Cron und ruehrt die kaputte
      // Spalte gar nicht erst an.
      await wrappedRouter.generateAllTeamerWrapped(
        db, ORGS.andereGemeinde.id, RUECKBLICK_JAHR
      );
      expect(await ausgabenVon(ORGS.andereGemeinde.id)).toHaveLength(1);

      await ohneSpalte('user_jahrgang_assignments', 'jahrgang_id', () =>
        BackgroundService.checkWrappedTriggers(db)
      );

      // Die kaputte Gemeinde hat nichts bekommen ...
      expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(0);
      // ... die andere behaelt ihren einen Rueckblick.
      expect(await ausgabenVon(ORGS.andereGemeinde.id)).toHaveLength(1);
    });

    it('nach dem Fehlschlag laeuft der naechste Versuch sauber durch', async () => {
      await expect(
        ohneSpalte('user_jahrgang_assignments', 'jahrgang_id', () =>
          wrappedRouter.generateAllTeamerWrapped(db, ORGS.testGemeinde.id, RUECKBLICK_JAHR)
        )
      ).rejects.toThrow(/kein einziger Snapshot/);

      const erneut = await wrappedRouter.generateAllTeamerWrapped(
        db, ORGS.testGemeinde.id, RUECKBLICK_JAHR
      );
      expect(erneut.uebersprungen).toBeUndefined();
      expect(erneut.generated).toBe(1);
      expect(erneut.errors).toBe(0);
      expect(await ausgabenVon(ORGS.testGemeinde.id)).toHaveLength(1);
    });
  });
});
