// backend/tests/services/abzeichenAuswahl.test.js
//
// Der stündliche Abzeichen-Lauf prüfte bis zum 14.09.2026 JEDE Person, jede
// Stunde — rund 27 Abfragen je Person, unabhängig davon, ob sich etwas
// geändert hatte. Bei 10.000 Personen wären das 268.000 Abfragen und über
// zwei Minuten am Stück auf einer von 20 Pool-Verbindungen.
//
// Seither prüft er nur noch, wessen Datenlage sich seit dem letzten Lauf
// geändert hat (services/backgroundService.js, utils/abzeichenKandidaten.js).
// Diese Suite hält zwei Dinge fest:
//
//   1. PARITÄT: Die Vergabe-Logik ist unverändert. Dieselben Personen
//      bekommen dieselben Abzeichen wie mit dem alten Weg, der ausnahmslos
//      jede Person prüfte. Vorbild ist appIconBadgeBulkParitaet.test.js.
//   2. AUSWAHL: Der neue Weg überspringt, wer sich nicht geändert hat, und
//      erwischt jeden, der sich geändert hat.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ACTIVITIES } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');
const { abzeichenFingerabdruecke } = require('../../utils/abzeichenKandidaten');
const { checkAndAwardBadges } = require('../../routes/badges');

describe('Abzeichen-Lauf: nur veraenderte Personen pruefen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    BackgroundService.letzterAbzeichenAbdruck.clear();
    BackgroundService.letzterZaehler.clear();
    BackgroundService.abzeichenZeiger = 0;
  });
  afterAll(async () => { await closePool(); });

  // Zaehlt die Abfragen eines Laufs mit.
  const zaehlend = () => {
    let n = 0;
    return {
      wrapper: { query: (t, p) => { n++; return db.query(t, p); }, getClient: () => db.getClient() },
      stand: () => n,
      reset: () => { n = 0; }
    };
  };

  // Der ALTE Weg, wortgleich zu dem, was backgroundService bis zum
  // 14.09.2026 tat: ueber alle Konfis und Teamer:innen, ohne jede Auswahl.
  // Dient als Vergleichsmassstab fuer die Paritaet.
  const alterWeg = async () => {
    const { rows: personen } = await db.query(
      `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('konfi','teamer') AND u.deleted_at IS NULL AND u.is_active = true
       ORDER BY u.id`
    );
    for (const p of personen) await checkAndAwardBadges(db, p.id);
  };

  // Wer hat welches Abzeichen? Der Vergleichswert fuer die Paritaet.
  const vergabeStand = async () => {
    const { rows } = await db.query(
      'SELECT user_id, badge_id FROM user_badges ORDER BY user_id, badge_id'
    );
    return rows.map(r => `${r.user_id}:${r.badge_id}`);
  };

  // Ein Satz Abzeichen ueber mehrere Kriterientypen, die die Seed-Daten
  // tatsaechlich erfuellen koennen.
  const legeAbzeichenAn = async () => {
    const ids = {};
    const anlegen = async (name, typ, wert, rolle, extra = null) => {
      const { rows: [b] } = await db.query(
        `INSERT INTO custom_badges (name, description, icon, criteria_type, criteria_value, criteria_extra,
           organization_id, is_active, target_role)
         VALUES ($1, 'Test', 'star', $2, $3, $4, $5, true, $6) RETURNING id`,
        [name, typ, wert, extra ? JSON.stringify(extra) : null, ORGS.testGemeinde.id, rolle]
      );
      ids[name] = b.id;
    };
    await anlegen('Punkte3', 'total_points', 3, 'konfi');
    await anlegen('Punkte99', 'total_points', 99, 'konfi');
    await anlegen('EineAktivitaet', 'activity_count', 1, 'konfi');
    await anlegen('DreiAktivitaeten', 'activity_count', 3, 'konfi');
    await anlegen('Bonus3', 'bonus_points', 3, 'konfi');
    await anlegen('Serie1', 'streak', 1, 'konfi');
    await anlegen('TeamAktivitaet', 'activity_count', 1, 'teamer');
    await anlegen('TeamJahr1', 'teamer_year', 1, 'teamer');
    return ids;
  };

  // Gibt konfi1 zwei Aktivitaeten und teamer1 eine, damit es etwas zu
  // vergeben gibt.
  const gibDatenlage = async () => {
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
       VALUES ($1, $2, CURRENT_DATE, $3, $4), ($1, $5, CURRENT_DATE - 7, $3, $4)`,
      [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, USERS.admin1.id,
       ORGS.testGemeinde.id, ACTIVITIES.gemeindefest.id]
    );
    await db.query(
      'UPDATE konfi_profiles SET gottesdienst_points = 4, gemeinde_points = 2 WHERE user_id = $1',
      [USERS.konfi1.id]
    );
    // Teamer-Abzeichen zaehlen nur Aktivitaeten mit target_role = 'teamer'
    // (badges.js, Teamer-Zweig). Der Seed legt Aktivitaeten ohne target_role
    // an, deshalb hier ausdruecklich eine passende.
    await db.query(
      "UPDATE activities SET target_role = 'teamer' WHERE id = $1",
      [ACTIVITIES.kirchenchor.id]
    );
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
      [USERS.teamer1.id, ACTIVITIES.kirchenchor.id, USERS.admin1.id, ORGS.testGemeinde.id]
    );
    await db.query(
      "UPDATE users SET teamer_since = NOW() - INTERVAL '1 year' WHERE id = $1",
      [USERS.teamer1.id]
    );
  };

  // ==================================================================
  // 1. PARITÄT: die Vergabe-Logik ist unveraendert
  // ==================================================================
  it('Paritaet: neuer Lauf vergibt exakt dieselben Abzeichen wie der alte', async () => {
    const ids = await legeAbzeichenAn();
    await gibDatenlage();

    // Alter Weg auf dem Ist-Stand.
    await alterWeg();
    const nachAlt = await vergabeStand();

    // Zuruecksetzen und denselben Ausgangszustand mit dem NEUEN Weg fahren.
    await db.query('DELETE FROM user_badges');
    BackgroundService.letzterAbzeichenAbdruck.clear();
    await BackgroundService.updateAllUserBadges(db);
    const nachNeu = await vergabeStand();

    // Harte Gleichheit der ganzen Vergabeliste, nicht nur der Anzahl.
    expect(nachNeu).toEqual(nachAlt);
    // Gegenprobe zur Aussagekraft: Es muss ueberhaupt etwas vergeben worden
    // sein, sonst vergliche der Test zwei leere Listen. Nachgezaehlt:
    // konfi1 erfuellt Punkte3 (4+2=6 Punkte), EineAktivitaet und
    // DreiAktivitaeten nicht (nur 2), Bonus3 (Seed gibt 3 Bonuspunkte) und
    // Serie1; teamer1 erfuellt TeamAktivitaet und TeamJahr1.
    expect(nachAlt).toEqual([
      `${USERS.konfi1.id}:${ids.Punkte3}`,
      `${USERS.konfi1.id}:${ids.EineAktivitaet}`,
      `${USERS.konfi1.id}:${ids.Bonus3}`,
      `${USERS.konfi1.id}:${ids.Serie1}`,
      `${USERS.teamer1.id}:${ids.TeamAktivitaet}`,
      `${USERS.teamer1.id}:${ids.TeamJahr1}`
    ].sort((a, b) => {
      const [ua, ba] = a.split(':').map(Number);
      const [ub, bb] = b.split(':').map(Number);
      return ua - ub || ba - bb;
    }));
  });

  it('Paritaet bleibt ueber mehrere Laeufe: niemand bekommt ein Abzeichen doppelt', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();

    await BackgroundService.updateAllUserBadges(db);
    const nachErstem = await vergabeStand();
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    const nachDrittem = await vergabeStand();

    expect(nachDrittem).toEqual(nachErstem);
    // Dieselben sechs Vergaben wie im Paritaetstest oben.
    expect(nachDrittem.length).toBe(6);
    // Doppelte waeren an einer laengeren Liste erkennbar — hier ausdruecklich
    // auf Eindeutigkeit geprueft.
    expect(new Set(nachDrittem).size).toBe(nachDrittem.length);
  });

  // ==================================================================
  // 2. DER NEUE AUSWAHLPFAD
  // ==================================================================
  it('zweiter Lauf ohne Aenderung prueft NIEMANDEN', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();

    // Lauf 1 prueft alle (Merker leer) und vergibt dabei. Lauf 2 prueft sie
    // erneut, weil die Vergabe selbst die Datenlage aendert. Ab Lauf 3 ist
    // nichts mehr offen — das ist der Zustand, in dem ein Stundenjob fast
    // immer laeuft.
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);

    const ruhig = await BackgroundService.updateAllUserBadges(db);
    expect(ruhig.geprueft).toBe(0);

    const nochmal = await BackgroundService.updateAllUserBadges(db);
    expect(nochmal.geprueft).toBe(0);
  });

  it('ein ruhiger Lauf kostet keine Abfragen je Person', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);

    const z = zaehlend();
    z.reset();
    const ergebnis = await BackgroundService.updateAllUserBadges(z.wrapper);

    expect(ergebnis.geprueft).toBe(0);
    // 26 Abfragen: der feste Rumpf des Laufs (Personen, Jahrgangs-
    // Zuweisungen, Organisationen und die App-Icon-Summen — hier fuer ZWEI
    // Organisationen, daher zweimal der Bulk-Satz) plus die sieben des
    // Fingerabdrucks. Entscheidend ist nicht die Zahl selbst, sondern dass
    // sie NICHT an der Personenzahl haengt: Der alte Weg haette hier
    // zusaetzlich rund 27 Abfragen je Person gebraucht.
    expect(z.stand()).toBe(26);
  });

  it('wer eine neue Aktivitaet bekommt, wird geprueft — und sonst niemand', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    expect((await BackgroundService.updateAllUserBadges(db)).geprueft).toBe(0);

    // konfi2 bekommt eine Aktivitaet — nur sie darf geprueft werden.
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
      [USERS.konfi2.id, ACTIVITIES.sonntagsgottesdienst.id, USERS.admin1.id, ORGS.testGemeinde.id]
    );

    const lauf = await BackgroundService.updateAllUserBadges(db);
    expect(lauf.geprueft).toBe(1);

    // Und sie hat die faelligen Abzeichen auch tatsaechlich bekommen:
    // EineAktivitaet (activity_count 1) und Serie1 (streak 1).
    const { rows } = await db.query(
      `SELECT cb.name FROM user_badges ub JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 ORDER BY cb.name`,
      [USERS.konfi2.id]
    );
    expect(rows.map(r => r.name)).toEqual(['EineAktivitaet', 'Serie1']);
  });

  it('das blosse Setzen der Anwesenheit wird erkannt (kein Zeitstempel im Spiel)', async () => {
    // Diese Kante ist der Grund, warum die Auswahl ueber einen
    // Fingerabdruck laeuft und NICHT ueber created_at: Eine Buchung, die
    // laengst besteht, wird auf 'present' gesetzt — event_bookings.created_at
    // aendert sich dabei nicht. Ein Zeitstempel-Filter wuerde die Person
    // uebersehen und das Abzeichen still verschlucken.
    await db.query(
      `INSERT INTO custom_badges (name, description, icon, criteria_type, criteria_value,
         organization_id, is_active, target_role)
       VALUES ('EinTermin', 'Test', 'star', 'event_count', 1, $1, true, 'konfi')`,
      [ORGS.testGemeinde.id]
    );
    // Buchung anlegen, aber OHNE Anwesenheit — zaehlt noch nicht.
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, 1, 'confirmed', $2)`,
      [USERS.konfi1.id, ORGS.testGemeinde.id]
    );

    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    expect((await BackgroundService.updateAllUserBadges(db)).geprueft).toBe(0);

    // Jetzt nur die Anwesenheit setzen. Sonst aendert sich nichts.
    await db.query(
      `UPDATE event_bookings SET attendance_status = 'present' WHERE user_id = $1`,
      [USERS.konfi1.id]
    );

    const lauf = await BackgroundService.updateAllUserBadges(db);
    expect(lauf.geprueft).toBe(1);

    const { rows } = await db.query(
      `SELECT cb.name FROM user_badges ub JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND cb.name = 'EinTermin'`,
      [USERS.konfi1.id]
    );
    expect(rows.length).toBe(1);
  });

  it('ein neues Abzeichen im Katalog laesst ALLE der Zielrolle wieder pruefen', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    expect((await BackgroundService.updateAllUserBadges(db)).geprueft).toBe(0);

    await db.query(
      `INSERT INTO custom_badges (name, description, icon, criteria_type, criteria_value,
         organization_id, is_active, target_role)
       VALUES ('Nachzuegler', 'Test', 'star', 'total_points', 1, $1, true, 'konfi')`,
      [ORGS.testGemeinde.id]
    );

    // Der Katalog gehoert zum Fingerabdruck jeder Person dieser Organisation
    // -> konfi1, konfi2 und teamer1 werden wieder geprueft. Die beiden
    // Personen der ANDEREN Gemeinde (konfi3, teamer2) nicht: ihr Katalog hat
    // sich nicht geaendert. Genau diese Trennung soll die Auswahl leisten.
    const lauf = await BackgroundService.updateAllUserBadges(db);
    expect(lauf.geprueft).toBe(3);
  });

  it('ein zurueckgenommenes Abzeichen kann erneut vergeben werden', async () => {
    const ids = await legeAbzeichenAn();
    await gibDatenlage();
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    expect((await BackgroundService.updateAllUserBadges(db)).geprueft).toBe(0);

    await db.query('DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2',
      [USERS.konfi1.id, ids.Punkte3]);

    const lauf = await BackgroundService.updateAllUserBadges(db);
    expect(lauf.geprueft).toBe(1);

    const { rows } = await db.query(
      'SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2',
      [USERS.konfi1.id, ids.Punkte3]);
    expect(rows.length).toBe(1);
  });

  it('faellt der Fingerabdruck aus, wird wie frueher jede Person geprueft', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    expect((await BackgroundService.updateAllUserBadges(db)).geprueft).toBe(0);

    // Die Fingerabdruck-Abfragen scheitern lassen. Erkennbar sind sie an
    // der Aggregation ueber user_activities je Person.
    const kaputt = {
      query: (text, params) => {
        if (/COALESCE\(MAX\(completed_date\)/.test(String(text))) {
          return Promise.reject(new Error('Fingerabdruck absichtlich kaputt'));
        }
        return db.query(text, params);
      },
      getClient: () => db.getClient()
    };

    const lauf = await BackgroundService.updateAllUserBadges(kaputt);
    // Kein stilles Ueberspringen: ALLE Konfis und Teamer:innen beider
    // Gemeinden werden geprueft (konfi1, konfi2, teamer1, konfi3, teamer2).
    expect(lauf.geprueft).toBe(5);
  });

  // ==================================================================
  // 2b. OBERGRENZE JE LAUF (Kaltstart)
  // ==================================================================
  it('ein Kaltstart prueft hoechstens ABZEICHEN_MAX_JE_LAUF Personen', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();

    // Grenze kuenstlich auf 2 setzen: Der Seed hat 5 Konfis/Teamer:innen,
    // der Merker ist leer — ohne Grenze kaemen alle 5 dran.
    const echteGrenze = BackgroundService.ABZEICHEN_MAX_JE_LAUF;
    BackgroundService.ABZEICHEN_MAX_JE_LAUF = 2;
    BackgroundService.abzeichenZeiger = 0;
    try {
      const lauf = await BackgroundService.updateAllUserBadges(db);
      expect(lauf.geprueft).toBe(2);
    } finally {
      BackgroundService.ABZEICHEN_MAX_JE_LAUF = echteGrenze;
    }
  });

  it('der Rest kommt in den Folgelaeufen dran, niemand bleibt liegen', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();

    const echteGrenze = BackgroundService.ABZEICHEN_MAX_JE_LAUF;
    BackgroundService.ABZEICHEN_MAX_JE_LAUF = 2;
    BackgroundService.abzeichenZeiger = 0;
    try {
      // 5 Personen, 2 je Lauf -> nach drei Laeufen ist jede einmal dran
      // gewesen. Danach ist nichts mehr offen.
      await BackgroundService.updateAllUserBadges(db);
      await BackgroundService.updateAllUserBadges(db);
      await BackgroundService.updateAllUserBadges(db);

      // Alle fuenf haben inzwischen einen Eintrag im Merker — niemand wurde
      // dauerhaft uebersprungen.
      expect(BackgroundService.letzterAbzeichenAbdruck.size).toBe(5);
    } finally {
      BackgroundService.ABZEICHEN_MAX_JE_LAUF = echteGrenze;
    }

    // Und die faelligen Abzeichen sind vollstaendig vergeben — dieselben
    // sechs wie ohne Grenze.
    await BackgroundService.updateAllUserBadges(db);
    await BackgroundService.updateAllUserBadges(db);
    expect((await vergabeStand()).length).toBe(6);
  });

  it('im Regelbetrieb greift die Grenze nicht', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();
    // Fuenf Personen, Grenze 800 -> alle in einem Lauf.
    const lauf = await BackgroundService.updateAllUserBadges(db);
    expect(lauf.geprueft).toBe(5);
  });

  it('nurZaehler laesst die Auswahl und die Pruefung ganz aus', async () => {
    await legeAbzeichenAn();
    await gibDatenlage();

    const lauf = await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(lauf.geprueft).toBe(0);
    // Und es wurde nichts vergeben.
    const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM user_badges');
    expect(rows[0].c).toBe(0);
  });

  // ==================================================================
  // 3. DER FINGERABDRUCK SELBST
  // ==================================================================
  describe('abzeichenFingerabdruecke', () => {
    const personen = () => [
      { user_id: USERS.konfi1.id, organization_id: ORGS.testGemeinde.id },
      { user_id: USERS.konfi2.id, organization_id: ORGS.testGemeinde.id },
      { user_id: USERS.teamer1.id, organization_id: ORGS.testGemeinde.id }
    ];

    it('gleiche Datenlage ergibt gleichen Abdruck', async () => {
      const a = await abzeichenFingerabdruecke(db, personen());
      const b = await abzeichenFingerabdruecke(db, personen());
      expect([...b.entries()]).toEqual([...a.entries()]);
    });

    it('eine neue Aktivitaet aendert NUR den Abdruck dieser Person', async () => {
      const vorher = await abzeichenFingerabdruecke(db, personen());
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
        [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      const nachher = await abzeichenFingerabdruecke(db, personen());

      expect(nachher.get(USERS.konfi1.id)).not.toBe(vorher.get(USERS.konfi1.id));
      expect(nachher.get(USERS.konfi2.id)).toBe(vorher.get(USERS.konfi2.id));
      expect(nachher.get(USERS.teamer1.id)).toBe(vorher.get(USERS.teamer1.id));
    });

    it('geaenderte Punkte aendern den Abdruck', async () => {
      const vorher = await abzeichenFingerabdruecke(db, personen());
      await db.query('UPDATE konfi_profiles SET gemeinde_points = 7 WHERE user_id = $1',
        [USERS.konfi2.id]);
      const nachher = await abzeichenFingerabdruecke(db, personen());

      expect(nachher.get(USERS.konfi2.id)).not.toBe(vorher.get(USERS.konfi2.id));
      expect(nachher.get(USERS.konfi1.id)).toBe(vorher.get(USERS.konfi1.id));
    });

    it('ein umgestelltes Kriterium aendert den Abdruck, auch bei gleicher Schwelle', async () => {
      await db.query(
        `INSERT INTO custom_badges (name, description, icon, criteria_type, criteria_value,
           organization_id, is_active, target_role)
         VALUES ('Wandelbar', 'Test', 'star', 'total_points', 5, $1, true, 'konfi')`,
        [ORGS.testGemeinde.id]
      );
      const vorher = await abzeichenFingerabdruecke(db, personen());
      // Schwelle bleibt 5, nur der Typ wechselt. Ein Abdruck, der nur die
      // Summe der Schwellen faende, wuerde das uebersehen.
      await db.query(
        `UPDATE custom_badges SET criteria_type = 'activity_count' WHERE name = 'Wandelbar'`
      );
      const nachher = await abzeichenFingerabdruecke(db, personen());

      expect(nachher.get(USERS.konfi1.id)).not.toBe(vorher.get(USERS.konfi1.id));
    });

    it('leere Liste ergibt eine leere Zuordnung', async () => {
      const abdruecke = await abzeichenFingerabdruecke(db, []);
      expect(abdruecke.size).toBe(0);
    });
  });
});
