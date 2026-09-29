// backend/tests/schema/neuinstallation.test.js
//
// Waechter fuer den Weg, den NUR eine neue Instanz geht.
//
// init-scripts/ wird in deploy/compose.konfi_quest.yml nach
// /docker-entrypoint-initdb.d gehaengt. Das postgres-Image fuehrt das genau
// einmal aus: beim allerersten Start mit leerem Datenverzeichnis. Fuer die
// laufende Produktion passiert hier nie wieder etwas — und genau deshalb
// faellt ein Fehler dort im Alltag niemandem auf.
//
// Vorgeschichte (16.09.2026): init-scripts/01-create-schema.sql war ein
// handgeschriebenes Schema und damit eine ZWEITE Quelle neben den
// Migrationen. Die beiden waren weit auseinandergelaufen:
//   - 25 Tabellen statt 57,
//   - drei Tabellen, die es in Produktion seit 076/090 nicht mehr gibt
//     (badges, konfi_activities, konfi_badges),
//   - CHECK (attendance_status IN ('present','absent')) — der Code schreibt
//     seit Migration 147 auch 'excused',
//   - und ein CREATE INDEX ... WHERE event_date > CURRENT_TIMESTAMP, das
//     Postgres gar nicht annimmt ("functions in index predicate must be
//     marked IMMUTABLE"). Gemessen: der Container endete mit Exit-Code 3,
//     eine Neuinstallation kam nie hoch.
// Keine Suite konnte das sehen: Die Tests bauen aus prod-schema.sql und
// fassten init-scripts nie an.
//
// Dieser Test baut eine Wegwerf-Datenbank GENAU so auf, wie es eine neue
// Instanz tut — init-scripts einspielen, dann die Migrationen —, und
// vergleicht das Ergebnis mit dem Produktionsschema.
//
// Seit dem 29.09.2026 (Audit Datenbank BF-15) vergleicht er den ganzen
// Katalog -- nicht mehr nur Tabellen, Spaltentypen, CHECKs und Views, sondern
// auch Indizes, Fremdschluessel samt Loeschregel, UNIQUE und
// Primaerschluessel, Defaults, NOT NULL, Sequenzen, Trigger und Funktionen
// (scripts/schemaVergleich.js). Ein fehlender Index oder eine andere
// Loeschregel zwischen den beiden Wegen blieb vorher unsichtbar.
const { schemaFingerabdruck, vergleiche } = require('../../scripts/schemaVergleich');
const {
  dbAnlegen, dbWegraeumen, neueInstanzAufbauen, produktionAufbauen,
} = require('../helpers/schemaAufbau');

const DB_NAME = 'konfi_test_neuinstallation';

describe('Neuinstallation: init-scripts + Migrationen ergeben das Produktionsschema', () => {
  let neu;
  let prod;
  let abdruckNeu;
  let abdruckProd;
  const NEU_DB = DB_NAME;
  const PROD_DB = `${DB_NAME}_referenz`;

  beforeAll(async () => {
    neu = await dbAnlegen(NEU_DB);
    await neueInstanzAufbauen(neu);
    prod = await dbAnlegen(PROD_DB);
    await produktionAufbauen(prod);
    abdruckNeu = await schemaFingerabdruck(neu);
    abdruckProd = await schemaFingerabdruck(prod);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(neu, NEU_DB);
    await dbWegraeumen(prod, PROD_DB);
  }, 120000);

  it('init-scripts laeuft auf einer leeren Datenbank fehlerfrei durch', async () => {
    // Beweis, dass der Aufbau oben nicht stillschweigend gescheitert ist:
    // ohne Tabellen waere jeder folgende Vergleich wertlos.
    expect(abdruckNeu.tabellen.length).toBeGreaterThan(50);
    expect(abdruckNeu.tabellen).toContain('users');
  });

  // Je Objektart ein Fall, damit der Bericht sagt, WAS abweicht.
  // views: event_booking_stats entsteht erst in Migration 128/136/154 -- ein
  // fehlender View fiele sonst erst beim ersten Seitenaufruf auf.
  // constraints: die Klasse Fehler, die den Anlass gab (ein CHECK, der einen
  // Wert verbietet, den der Code schreibt), dazu Loeschregeln und UNIQUE.
  it.each([
    'tabellen', 'spalten', 'constraints', 'indizes', 'views',
    'sequenzen', 'trigger', 'funktionen', 'erweiterungen',
  ])('dieselben %s wie in Produktion', (art) => {
    expect(abdruckNeu[art]).toEqual(abdruckProd[art]);
  });

  it('der Vergleich deckt alle Objektarten des Fingerabdrucks ab', () => {
    // Kommt in schemaVergleich.js eine Art dazu, muss sie oben in die Liste.
    expect(Object.keys(abdruckNeu).sort()).toEqual([
      'constraints', 'erweiterungen', 'funktionen', 'indizes', 'sequenzen',
      'spalten', 'tabellen', 'trigger', 'views',
    ]);
  });
});

describe('Neuinstallation: der Waechter sieht die Abweichungen, die er fangen soll', () => {
  // Gegenprobe im Test selbst (Audit Datenbank BF-15): Fuenf Abweichungen,
  // die der alte Waechter nicht gesehen haette, auf einer sonst gleichen
  // Datenbank -- jede muss als Unterschied auftauchen.
  let referenz;
  let abweichend;
  const REF_DB = `${DB_NAME}_gegenprobe_a`;
  const ABW_DB = `${DB_NAME}_gegenprobe_b`;
  let unterschiede;

  beforeAll(async () => {
    referenz = await dbAnlegen(REF_DB);
    await neueInstanzAufbauen(referenz);
    abweichend = await dbAnlegen(ABW_DB);
    await neueInstanzAufbauen(abweichend);
    // 1. fehlender Index
    await abweichend.query('DROP INDEX idx_chat_messages_reply_to');
    // 2. andere Loeschregel an einem Fremdschluessel
    await abweichend.query(`ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_reply_to_fkey,
      ADD CONSTRAINT chat_messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE CASCADE`);
    // 3. fehlendes UNIQUE
    await abweichend.query('ALTER TABLE daily_verses DROP CONSTRAINT daily_verses_date_translation_key');
    // 4. anderer Default
    await abweichend.query("ALTER TABLE event_bookings ALTER COLUMN status SET DEFAULT 'waitlist'");
    // 5. fehlendes NOT NULL
    await abweichend.query('ALTER TABLE jahrgaenge ALTER COLUMN konfspruch_enabled DROP NOT NULL');
    unterschiede = vergleiche(await schemaFingerabdruck(referenz), await schemaFingerabdruck(abweichend));
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(referenz, REF_DB);
    await dbWegraeumen(abweichend, ABW_DB);
  }, 120000);

  it('fehlender Index', () => {
    expect(unterschiede.indizes.nurA.some((z) => z.includes('idx_chat_messages_reply_to'))).toBe(true);
  });

  it('andere Loeschregel', () => {
    expect(unterschiede.constraints.nurB).toContain(
      'chat_messages chat_messages_reply_to_fkey f: FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE CASCADE'
    );
  });

  it('fehlendes UNIQUE', () => {
    expect(unterschiede.constraints.nurA).toContain(
      'daily_verses daily_verses_date_translation_key u: UNIQUE (date, translation)'
    );
  });

  it('anderer Default', () => {
    expect(unterschiede.spalten.nurB.some((z) => z.startsWith('event_bookings.status ') && z.includes("DEFAULT 'waitlist'"))).toBe(true);
  });

  it('fehlendes NOT NULL', () => {
    expect(unterschiede.spalten.nurA.some((z) => z.startsWith('jahrgaenge.konfspruch_enabled ') && z.includes('NOT NULL'))).toBe(true);
  });

  it('sonst nichts: genau diese drei Objektarten weichen ab', () => {
    expect(Object.keys(unterschiede).sort()).toEqual(['constraints', 'indizes', 'spalten']);
  });
});

describe('Neuinstallation: die Werte, die der Code schreibt, sind erlaubt', () => {
  let pool;
  const DB = `${DB_NAME}_werte`;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await neueInstanzAufbauen(pool);
    // Minimalgeruest fuer eine Buchung: Organisation, Rolle, Nutzer, Termin.
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (901, 'Waechter', 'waechter-neuinstallation')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id)
                      VALUES (901, 'waechter', 'Waechter', 901)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      VALUES (901, 'waechter', 'Waechter', 'x', 901, 901)`);
    await pool.query(`INSERT INTO events (id, name, event_date, organization_id)
                      VALUES (901, 'Waechter-Termin', NOW(), 901)`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  const buchung = async (spalte, wert) => {
    await pool.query('DELETE FROM event_bookings WHERE id = 9901');
    await pool.query(
      `INSERT INTO event_bookings (id, event_id, user_id, organization_id, ${spalte})
       VALUES (9901, 901, 901, 901, $1)`,
      [wert]
    );
    const { rows } = await pool.query(`SELECT ${spalte} AS wert FROM event_bookings WHERE id = 9901`);
    return rows[0].wert;
  };

  // routes/events/anwesenheit.js laesst genau diese drei Werte zu.
  it.each(['present', 'absent', 'excused'])(
    "attendance_status = '%s' ist erlaubt",
    async (wert) => {
      expect(await buchung('attendance_status', wert)).toBe(wert);
    }
  );

  // Migration 153: 'excused' kam zu den Buchungsstatus dazu.
  it.each(['confirmed', 'waitlist', 'cancelled', 'opted_out', 'pending', 'excused'])(
    "status = '%s' ist erlaubt",
    async (wert) => {
      expect(await buchung('status', wert)).toBe(wert);
    }
  );

  // Migration 151: checkin_quelle hat bewusst einen CHECK.
  it.each(['qr', 'manuell'])("checkin_quelle = '%s' ist erlaubt", async (wert) => {
    expect(await buchung('checkin_quelle', wert)).toBe(wert);
  });

  it('checkin_quelle = "erfunden" wird abgelehnt (der verbotene Fall)', async () => {
    // Gegenstueck zu den erlaubten Faellen: der CHECK greift wirklich,
    // die Spalte ist nicht einfach ungeprueft.
    await expect(buchung('checkin_quelle', 'erfunden')).rejects.toThrow();
  });

  // Migration 155: status_vor_absage merkt sich den Stand vor der Absage.
  it.each(['confirmed', 'waitlist'])("status_vor_absage = '%s' ist erlaubt", async (wert) => {
    expect(await buchung('status_vor_absage', wert)).toBe(wert);
  });

  it('status_vor_absage = "cancelled" wird abgelehnt (der verbotene Fall)', async () => {
    await expect(buchung('status_vor_absage', 'cancelled')).rejects.toThrow();
  });
});
