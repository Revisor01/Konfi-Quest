// backend/tests/utils/zeitzone.test.js
//
// Zeitzonen-Tests (Befunde H1-H3 aus der Pruefung vom 01.09.2026).
//
// Vorgeschichte: Die Backend-Container liefen entgegen der Absicht in UTC --
// die Variable TZ stand im Stack nur beim Datenbank-Dienst. Jede Uhrzeit in
// Push-Nachrichten und E-Mails ging dadurch zwei Stunden zu frueh raus, und
// zwischen 00:00 und 02:00 Berliner Zeit hielt der Server den Vortag fuer
// "heute".
//
// Bis dahin gab es im ganzen Projekt keine einzige Zeitzonen-Testdatei, und
// die Testumgebung pinnte selbst TZ='UTC' -- die Tests konnten den Fehler
// also gar nicht sehen. Beides ist jetzt behoben; diese Datei haelt es fest.
//
// Wichtig: Die Funktionen tragen ihre Zeitzone SELBST. Deshalb pruefen die
// Tests unten zusaetzlich mit kuenstlich auf UTC gestelltem Prozess, dass das
// Ergebnis sich nicht aendert -- sonst haengt die Richtigkeit wieder an einer
// Umgebungsvariablen, die beim naechsten Umzug verlorengeht.

const { formatUhrzeit, formatDatum, heuteBerlin, BERLIN } = require('../../utils/zeitformat');
const { getTestPool, truncateAll } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS } = require('../helpers/seed');

describe('zeitformat: Uhrzeiten in Push und E-Mail', () => {
  it('formatiert einen Termin in Berliner Zeit, nicht in UTC', () => {
    // Der in der Pruefung gemessene echte Termin (ID 163): 2026-10-15 15:58:33+02.
    // Vor dem Fix ging "13:58" raus.
    const termin = new Date('2026-10-15T13:58:33Z');
    expect(formatUhrzeit(termin)).toBe('15:58');
  });

  it('kuendigt eine Konfirmation um 10:00 auch als 10:00 an', () => {
    // Der Fall aus dem Befund: "Eine Konfirmation um 10:00 wird als 08:00
    // angekuendigt." Sommerzeit, also UTC+2.
    const konfirmation = new Date('2026-05-10T08:00:00Z');
    expect(formatUhrzeit(konfirmation)).toBe('10:00');
  });

  it('formatiert das Datum in Berliner Zeit', () => {
    expect(formatDatum(new Date('2026-10-15T13:58:33Z'))).toBe('15.10.2026');
  });

  it('kippt ein Datum kurz vor Mitternacht Berliner Zeit nicht auf den Vortag', () => {
    // 22:30 UTC ist in Berlin bereits der Folgetag.
    expect(formatDatum(new Date('2026-09-01T22:30:00Z'), {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })).toBe('02.09.2026');
  });

  it('bleibt richtig, auch wenn der Prozess in UTC laeuft', () => {
    // Gegenprobe zur Container-Variablen: Die Funktion darf sich NICHT auf TZ
    // verlassen. Wir stellen den Prozess hart auf UTC und erwarten dasselbe.
    const vorher = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      expect(formatUhrzeit(new Date('2026-10-15T13:58:33Z'))).toBe('15:58');
      expect(formatDatum(new Date('2026-10-15T13:58:33Z'))).toBe('15.10.2026');
    } finally {
      process.env.TZ = vorher;
    }
  });

  it('nennt Europe/Berlin als Zone der App', () => {
    expect(BERLIN).toBe('Europe/Berlin');
  });
});

describe('zeitformat: Sommerzeitumstellung', () => {
  it('rechnet vor der Umstellung am 25.10.2026 mit UTC+2', () => {
    // 25.10.2026 ist der Tag der Rueckstellung. Um 00:30 Uhr UTC gilt noch
    // Sommerzeit (MESZ, UTC+2) -> 02:30 Berlin.
    expect(formatUhrzeit(new Date('2026-10-25T00:30:00Z'))).toBe('02:30');
  });

  it('rechnet nach der Umstellung am 25.10.2026 mit UTC+1', () => {
    // Die Umstellung faellt auf 01:00 UTC. Danach gilt MEZ (UTC+1),
    // 01:30 UTC -> 02:30 Berlin. Dieselbe Wandzeit wie oben, eine Stunde
    // spaeter -- genau die Doppelstunde. Eine feste Verschiebung um zwei
    // Stunden waere hier falsch.
    expect(formatUhrzeit(new Date('2026-10-25T01:30:00Z'))).toBe('02:30');
  });

  it('rechnet nach der Umstellung wieder eindeutig weiter', () => {
    expect(formatUhrzeit(new Date('2026-10-25T02:30:00Z'))).toBe('03:30');
  });

  it('rechnet im Winter mit UTC+1', () => {
    expect(formatUhrzeit(new Date('2026-12-24T17:00:00Z'))).toBe('18:00');
  });

  it('rechnet an der Fruehjahrsumstellung 29.03.2026 richtig', () => {
    // 01:00 UTC ist der Sprung von 02:00 auf 03:00 Berliner Zeit.
    expect(formatUhrzeit(new Date('2026-03-29T00:30:00Z'))).toBe('01:30');
    expect(formatUhrzeit(new Date('2026-03-29T01:30:00Z'))).toBe('03:30');
  });
});

describe('heuteBerlin: der Kalendertag der App', () => {
  it('liefert nach 22:00 UTC bereits den Berliner Folgetag', () => {
    // Der Kern von Befund H2: Ein Punkt, den eine Leitung um 00:30 Berliner
    // Zeit verbucht, trug mit toISOString() den Vortag.
    expect(heuteBerlin(new Date('2026-09-01T22:30:00Z'))).toBe('2026-09-02');
  });

  it('liefert tagsueber denselben Tag wie UTC', () => {
    expect(heuteBerlin(new Date('2026-09-01T10:00:00Z'))).toBe('2026-09-01');
  });

  it('liefert im Winter ab 23:00 UTC den Folgetag', () => {
    // Winter: UTC+1, die Grenze verschiebt sich um eine Stunde.
    expect(heuteBerlin(new Date('2026-12-01T22:30:00Z'))).toBe('2026-12-01');
    expect(heuteBerlin(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-02');
  });

  it('liefert ein Datum im Format JJJJ-MM-TT', () => {
    expect(heuteBerlin(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });

  it('bleibt richtig, auch wenn der Prozess in UTC laeuft', () => {
    const vorher = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      expect(heuteBerlin(new Date('2026-09-01T22:30:00Z'))).toBe('2026-09-02');
    } finally {
      process.env.TZ = vorher;
    }
  });
});

describe('Migration 138: angezeigte Zeitstempel tragen eine Zeitzone', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });

  const typVon = async (tabelle, spalte) => {
    const { rows } = await db.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tabelle, spalte]
    );
    return rows[0] && rows[0].data_type;
  };

  it('event_unregistrations.unregistered_at ist timestamptz', async () => {
    expect(await typVon('event_unregistrations', 'unregistered_at'))
      .toBe('timestamp with time zone');
  });

  it('organizations.trial_ends_at ist timestamptz', async () => {
    expect(await typVon('organizations', 'trial_ends_at'))
      .toBe('timestamp with time zone');
  });

  it('wrapped_snapshots.computed_at ist timestamptz', async () => {
    expect(await typVon('wrapped_snapshots', 'computed_at'))
      .toBe('timestamp with time zone');
  });

  it('liegt damit auf demselben Typ wie event_bookings.booking_date', async () => {
    // Die Spalte direkt daneben war schon immer timestamptz -- genau der
    // Widerspruch, an dem der Fehler sichtbar wurde.
    expect(await typVon('event_bookings', 'booking_date'))
      .toBe(await typVon('event_unregistrations', 'unregistered_at'));
  });

  it('gibt eine Abmeldung um 12:34 auch als 12:34 Berliner Zeit heraus', async () => {
    // DER konkrete Fall aus dem Auftrag: In der Datenbank steht 12:34:48.
    // Vorher haengte Node beim Serialisieren faelschlich ein Z an, das
    // Frontend rechnete +2h drauf und zeigte 14:34.
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO event_unregistrations (user_id, event_id, reason, unregistered_at, organization_id)
       VALUES ($1, $2, 'Test', TIMESTAMPTZ '2026-08-27 12:34:48+02', $3)`,
      [USERS.konfi1.id, EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id]
    );
    const { rows } = await db.query('SELECT unregistered_at FROM event_unregistrations');

    // Genau das, was das Frontend anzeigt (dort: new Date(...).toLocaleString).
    expect(formatUhrzeit(rows[0].unregistered_at)).toBe('12:34');
    // Und der ISO-String traegt jetzt einen echten Offset statt eines falschen Z.
    expect(rows[0].unregistered_at.toISOString()).toBe('2026-08-27T10:34:48.000Z');
  });
});
