// backend/tests/utils/zertifikatstypenSeed.test.js
//
// Startseeding der Standard-Zertifikatstypen (Audit 26.09.2026, Betrieb BF-16).
//
// BEFUND: routes/organizations.js legte beim Start je Organisation ohne
// Zertifikatstypen vier Zeilen an -- ohne ON CONFLICT. Starten zwei Replicas
// gleichzeitig, verliert eine den Wettlauf mit "duplicate key value violates
// unique constraint certificate_types_organization_id_name_key"; der catch
// schluckte den Fehler, die Schleife brach ab.
//
// GEGENPROBE: Ohne ON CONFLICT faellt "zweiter Lauf fuer dieselbe
// Organisation" mit dem duplicate-key-Fehler und "zwei Replicas gleichzeitig"
// mit einer abgelehnten Promise.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ORGS } = require('../helpers/seed');
const {
  STANDARD_ZERTIFIKATSTYPEN,
  legeStandardZertifikatstypenAn,
  seedeStandardZertifikatstypen,
} = require('../../utils/zertifikatstypenSeed');

describe('Standard-Zertifikatstypen beim Start', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query('DELETE FROM certificate_types');
  });

  afterAll(async () => {
    await closePool();
  });

  const anzahl = async (orgId) => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM certificate_types WHERE organization_id = $1',
      [orgId]
    );
    return r.n;
  };

  it('legt die vier Standardtypen fuer eine Organisation an', async () => {
    const eingefuegt = await legeStandardZertifikatstypenAn(db, ORGS.testGemeinde.id);

    expect(eingefuegt).toBe(4);
    expect(await anzahl(ORGS.testGemeinde.id)).toBe(4);
    const { rows } = await db.query(
      'SELECT name, icon FROM certificate_types WHERE organization_id = $1 ORDER BY name',
      [ORGS.testGemeinde.id]
    );
    expect(rows).toEqual(
      [...STANDARD_ZERTIFIKATSTYPEN].sort((a, b) => a.name.localeCompare(b.name))
    );
  });

  it('ein zweiter Lauf fuer dieselbe Organisation fuegt nichts ein und wirft nicht', async () => {
    await legeStandardZertifikatstypenAn(db, ORGS.testGemeinde.id);

    const eingefuegt = await legeStandardZertifikatstypenAn(db, ORGS.testGemeinde.id);

    expect(eingefuegt).toBe(0);
    expect(await anzahl(ORGS.testGemeinde.id)).toBe(4);
  });

  it('laesst einen von der Leitung umbenannten Typ stehen und ergaenzt nur die fehlenden', async () => {
    await db.query(
      "INSERT INTO certificate_types (name, icon, organization_id) VALUES ('JuLeiCa', 'star', $1)",
      [ORGS.testGemeinde.id]
    );

    const eingefuegt = await legeStandardZertifikatstypenAn(db, ORGS.testGemeinde.id);

    expect(eingefuegt).toBe(3);
    const { rows: [juleica] } = await db.query(
      "SELECT icon FROM certificate_types WHERE organization_id = $1 AND name = 'JuLeiCa'",
      [ORGS.testGemeinde.id]
    );
    expect(juleica.icon).toBe('star');
  });

  it('zwei Replicas gleichzeitig: jede Organisation bekommt genau vier Typen, keine wirft', async () => {
    // Zwei bereits offene Verbindungen, damit beide SELECTs wirklich vor dem
    // ersten INSERT laufen (ueber den Pool muesste die zweite Abfrage erst
    // eine Verbindung aufbauen und saehe die Zeilen der ersten schon).
    //
    // SCHRANKE (27.09.2026): Die offenen Verbindungen allein erzwangen die
    // Reihenfolge nicht. Unter Last (voller Lauf, 1 von 3 Einzellaeufen) war
    // A mit SELECT und INSERT fertig, bevor B las -- B sah dann 0 oder 1
    // Organisationen ohne Typen, und die Erwartung "beide sahen 2" fiel,
    // obwohl der Code richtig war. Jetzt wartet jede Seite nach ihrer ersten
    // Abfrage (dem SELECT), bis auch die andere gelesen hat. Damit laeuft
    // genau das Rennen, das dieser Test pruefen soll, in jedem Lauf.
    const clientA = await db.getClient();
    const clientB = await db.getClient();
    let gelesen = 0;
    let freigeben;
    const beideHabenGelesen = new Promise((r) => { freigeben = r; });
    const mitSchranke = (client) => {
      let ersteAbfrage = true;
      return {
        query: async (t, p) => {
          const ergebnis = await client.query(t, p);
          if (ersteAbfrage) {
            ersteAbfrage = false;
            gelesen += 1;
            if (gelesen === 2) freigeben();
            await beideHabenGelesen;
          }
          return ergebnis;
        },
      };
    };
    let a;
    let b;
    try {
      [a, b] = await Promise.all([
        seedeStandardZertifikatstypen(mitSchranke(clientA)),
        seedeStandardZertifikatstypen(mitSchranke(clientB)),
      ]);
    } finally {
      clientA.release();
      clientB.release();
    }

    // Beide sahen die Organisationen ohne Typen; zusammen haben sie genau
    // einmal jede Zeile eingefuegt.
    expect(a.organisationen).toBe(2);
    expect(b.organisationen).toBe(2);
    expect(a.eingefuegt + b.eingefuegt).toBe(8);
    expect(await anzahl(ORGS.testGemeinde.id)).toBe(4);
    expect(await anzahl(ORGS.andereGemeinde.id)).toBe(4);
  });

  it('macht nichts, wenn jede Organisation schon Typen hat', async () => {
    await seedeStandardZertifikatstypen(db);

    const ergebnis = await seedeStandardZertifikatstypen(db);

    expect(ergebnis).toEqual({ organisationen: 0, eingefuegt: 0 });
  });
});
