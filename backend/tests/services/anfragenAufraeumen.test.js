// backend/tests/services/anfragenAufraeumen.test.js
//
// cleanupAbgelehnteAnfragen (03.10.2026): Abgelehnte Anfragen vom Formular
// auf konfi-quest.de gehen 180 Tage nach der Ablehnung (status_seit), im
// 02:00-Lauf. Neue, in Arbeit befindliche und angelegte fasst diese Frist
// nicht an -- unbewegte neue und in Arbeit befindliche gehen nach 365 Tagen
// (cleanupUnbewegteAnfragen, unten), eine angelegte geht mit ihrer Gemeinde
// (tests/routes/anfragen.test.js). Die Datenschutzerklaerung nennt beide
// Fristen (Abschnitt 9c).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');

describe('cleanupAbgelehnteAnfragen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });
  afterAll(async () => { await closePool(); });

  /** Anfrage mit Status seit `tage` Tagen; eingegangen 400 Tage vorher. */
  async function anfrage(status, tage) {
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, status_seit, created_at)
       VALUES ($1, 'K', 'k@example.test', NOW() - interval '400 days', $2,
               NOW() - ($3::int * interval '1 day'), NOW() - interval '400 days')
       RETURNING id`,
      [`${status}-${tage}`, status, tage]);
    return Number(id);
  }
  const uebrig = async () => (await db.query('SELECT gemeinde FROM gemeinde_anfragen ORDER BY id')).rows.map((r) => r.gemeinde);

  it('löscht eine seit 181 Tagen abgelehnte Anfrage, behält eine seit 179 Tagen abgelehnte; Rückgabe 1', async () => {
    await anfrage('abgelehnt', 181);
    await anfrage('abgelehnt', 179);
    expect(await BackgroundService.cleanupAbgelehnteAnfragen(db)).toBe(1);
    expect(await uebrig()).toEqual(['abgelehnt-179']);
  });

  it('gezählt wird ab der Ablehnung, nicht ab dem Eingang', async () => {
    // Eingegangen vor 400 Tagen, aber erst vor 10 Tagen abgelehnt: bleibt.
    await anfrage('abgelehnt', 10);
    expect(await BackgroundService.cleanupAbgelehnteAnfragen(db)).toBe(0);
    expect(await uebrig()).toEqual(['abgelehnt-10']);
  });

  it('neue, in Arbeit befindliche und angelegte Anfragen bleiben, auch nach 400 Tagen', async () => {
    await anfrage('neu', 400);
    await anfrage('in_arbeit', 400);
    await anfrage('angelegt', 400);
    expect(await BackgroundService.cleanupAbgelehnteAnfragen(db)).toBe(0);
    expect(await uebrig()).toEqual(['neu-400', 'in_arbeit-400', 'angelegt-400']);
  });

  it('das Protokoll nennt nur die Anzahl', async () => {
    await anfrage('abgelehnt', 200);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await BackgroundService.cleanupAbgelehnteAnfragen(db);
      expect(log.mock.calls).toEqual([['Anfragen aufraeumen: 1 abgelehnte Anfragen aelter als 180 Tage geloescht']]);
    } finally {
      log.mockRestore();
    }
  });
});

// cleanupUnbewegteAnfragen (Simon, 03.10.2026, Frage 3 zur Web-Version):
// Anfragen, die "neu" oder "in Arbeit" sind und sich 365 Tage nicht bewegt
// haben, gehen ebenfalls. "Bewegung" ist jede Aenderung an der Anfrage --
// Status oder Notiz --, gezaehlt ab updated_at (PATCH /support/anfragen/:id
// setzt es bei jeder Aenderung). Abgelehnte haben ihre eigene Frist, angelegte
// gehen mit ihrer Gemeinde.
describe('cleanupUnbewegteAnfragen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });
  afterAll(async () => { await closePool(); });

  /** Anfrage, zuletzt vor `tage` Tagen geaendert; eingegangen 800 Tage vorher. */
  async function anfrage(status, tage) {
    await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, status_seit, created_at, updated_at)
       VALUES ($1, 'K', 'k@example.test', NOW() - interval '800 days', $2,
               NOW() - interval '800 days', NOW() - interval '800 days', NOW() - ($3::int * interval '1 day'))`,
      [`${status}-${tage}`, status, tage]);
  }
  const uebrig = async () => (await db.query('SELECT gemeinde FROM gemeinde_anfragen ORDER BY id')).rows.map((r) => r.gemeinde);

  it('löscht neue und in Arbeit befindliche Anfragen nach 366 Tagen ohne Änderung, behält sie nach 364; Rückgabe 2', async () => {
    await anfrage('neu', 366);
    await anfrage('in_arbeit', 366);
    await anfrage('neu', 364);
    await anfrage('in_arbeit', 364);
    expect(await BackgroundService.cleanupUnbewegteAnfragen(db)).toBe(2);
    expect(await uebrig()).toEqual(['neu-364', 'in_arbeit-364']);
  });

  it('gezählt wird ab der letzten Änderung, nicht ab dem Eingang oder dem Status', async () => {
    // Eingegangen und auf "in Arbeit" gesetzt vor 800 Tagen, Notiz vor 10 Tagen: bleibt.
    await anfrage('in_arbeit', 10);
    expect(await BackgroundService.cleanupUnbewegteAnfragen(db)).toBe(0);
    expect(await uebrig()).toEqual(['in_arbeit-10']);
  });

  it('abgelehnte und angelegte Anfragen fasst diese Frist nicht an', async () => {
    await anfrage('angelegt', 800);
    await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, status_seit, created_at, updated_at)
       VALUES ('abgelehnt-frisch', 'K', 'k@example.test', NOW() - interval '800 days', 'abgelehnt',
               NOW() - interval '10 days', NOW() - interval '800 days', NOW() - interval '800 days')`);
    expect(await BackgroundService.cleanupUnbewegteAnfragen(db)).toBe(0);
    expect(await uebrig()).toEqual(['angelegt-800', 'abgelehnt-frisch']);
  });

  it('das Protokoll nennt nur die Anzahl', async () => {
    await anfrage('neu', 400);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await BackgroundService.cleanupUnbewegteAnfragen(db);
      expect(log.mock.calls).toEqual([['Anfragen aufraeumen: 1 unbewegte Anfragen aelter als 365 Tage geloescht']]);
    } finally {
      log.mockRestore();
    }
  });
});
