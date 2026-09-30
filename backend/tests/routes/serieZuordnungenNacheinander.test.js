// POST /events/series: die Zuordnungen eines Termins nacheinander auf dem
// Client der Transaktion (30.09.2026, Folgeauftrag J1).
//
// Die Serien-Anlage legte je Termin Kategorien, Jahrgaenge und jedes
// Zeitfenster per Promise.all an -- auf dem CLIENT ihrer Transaktion. Mit
// einer Kategorie, einem Jahrgang und zwei Zeitfenstern liefen vier Abfragen
// gleichzeitig auf einer Verbindung: pg 8 reiht sie ein und warnt ab der
// dritten ("Calling client.query() when the client is already executing a
// query is deprecated and will be removed in pg@9.0"), pg 9 nicht mehr.
// Jetzt ueber utils/abfragenBuendeln.js, wie checkAndAwardBadges und die
// Hilfsfunktionen mit Parameter db.
//
// Geprueft ueber die Route: Die App bekommt einen db-Stellvertreter, dessen
// getClient() Clients liefert, die WERFEN, sobald eine Abfrage kommt,
// waehrend eine andere noch offen ist (strenger als pg 8).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, CATEGORIES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('POST /events/series: Zuordnungen nie gleichzeitig auf dem Transaktions-Client', () => {
  let db, app, token;
  const stand = { clients: 0, abfragen: 0 };

  // Client, der bei einer zweiten offenen Abfrage wirft. release() wartet die
  // offene Abfrage ab und rollt eine liegengebliebene Transaktion zurueck,
  // damit der Pool nach einem Fehlschlag sauber weiterarbeitet.
  async function strengerClient() {
    const client = await db.getClient();
    stand.clients += 1;
    let offen = 0;
    let laufend = Promise.resolve();
    return {
      query(...args) {
        if (offen > 0) {
          throw new Error('client.query() waehrend eine andere Abfrage offen ist');
        }
        offen += 1;
        stand.abfragen += 1;
        const p = client.query(...args);
        const fertig = () => { offen -= 1; };
        laufend = p.then(fertig, fertig);
        return p;
      },
      release() {
        laufend
          .then(() => client.query('ROLLBACK').catch(() => {}))
          .finally(() => client.release());
      },
    };
  }

  beforeAll(() => {
    db = getTestPool();
    // Alles wie der Test-Pool, nur getClient() liefert den strengen Client.
    const stellvertreter = new Proxy(db, {
      get(ziel, name) {
        if (name === 'getClient') return strengerClient;
        const wert = ziel[name];
        return typeof wert === 'function' ? wert.bind(ziel) : wert;
      },
    });
    app = getTestApp(stellvertreter);
  });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    token = generateToken('orgAdmin1');
    stand.clients = 0;
    stand.abfragen = 0;
  });

  const inTagen = (tage, stunde) => {
    const d = new Date(Date.now() + tage * 24 * 60 * 60 * 1000);
    d.setHours(stunde, 0, 0, 0);
    return d.toISOString();
  };

  it('Kategorie, Jahrgang und zwei Zeitfenster: 201, jeder Termin mit allen Zuordnungen', async () => {
    const res = await request(app)
      .post('/api/events/series')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Werkstatt',
        description: 'Serie mit Zeitfenstern',
        location: 'Gemeindehaus',
        points: 1,
        point_type: 'gemeinde',
        type: 'event',
        max_participants: 20,
        event_date: inTagen(7, 10),
        event_end_time: inTagen(7, 12),
        category_ids: [CATEGORIES.gottesdienst1.id],
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        has_timeslots: true,
        timeslots: [
          { start_time: inTagen(7, 10), end_time: inTagen(7, 11), max_participants: 10 },
          { start_time: inTagen(7, 11), end_time: inTagen(7, 12), max_participants: 10 },
        ],
        series_count: 3,
        series_interval: 'week',
      });

    expect(res.status).toBe(201);
    expect(res.body.events_created).toBe(3);
    // Die Route lief wirklich ueber den strengen Client.
    expect(stand.clients).toBeGreaterThan(0);

    const { rows } = await db.query(
      `SELECT e.id,
              (SELECT COUNT(*)::int FROM event_categories ec WHERE ec.event_id = e.id) AS kategorien,
              (SELECT COUNT(*)::int FROM event_jahrgang_assignments eja WHERE eja.event_id = e.id) AS jahrgaenge,
              (SELECT COUNT(*)::int FROM event_timeslots et WHERE et.event_id = e.id) AS zeitfenster
         FROM events e
        WHERE e.series_id = $1 OR e.id = $1
        ORDER BY e.event_date`,
      [res.body.series_id]
    );
    expect(rows.map((r) => [r.kategorien, r.jahrgaenge, r.zeitfenster])).toEqual([
      [1, 1, 2],
      [1, 1, 2],
      [1, 1, 2],
    ]);
  });
});
