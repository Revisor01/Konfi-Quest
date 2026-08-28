// backend/tests/routes/konfspruchTexte.test.js
//
// Migration 093 legte 2026 fuer jeden der 32 Sprueche vier
// Uebersetzungszeilen mit LEEREM Text an — der Betreiber sollte sie
// nachtragen. Passiert ist es nie: 127 von 128 Zeilen standen leer, und die
// Konfis waehlten ihren Spruch aus blanken Stellenangaben.
//
// Migration 134 fuellt zwei der vier Uebersetzungen (Luther 2017, Gute
// Nachricht). BIGS und Elberfelder bleiben bewusst leer, bis die Verlage
// geantwortet haben.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');

describe('Konfispruch-Texte (Migration 134)', () => {
  let db;

  beforeAll(async () => { db = getTestPool(); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  // truncateAll leert auch konfsprueche und konfspruch_uebersetzungen (siehe
  // tests/helpers/db.js) — die Daten aus Migration 093/134 sind zur Testzeit
  // also weg. Deshalb wird hier beides frisch angewandt: erst die Struktur
  // von 093 nachbauen (Referenzen plus vier leere Uebersetzungszeilen), dann
  // die echte Migration 134 laufen lassen. Damit prueft der Test genau das,
  // was in Produktion passiert.
  beforeEach(async () => {
    const fs = require('fs');
    const path = require('path');

    const referenzen = [
      'Psalm 23,1', 'Psalm 31,4', 'Psalm 37,5', 'Psalm 91,11', 'Psalm 118,14',
      'Psalm 119,105', 'Psalm 121,1-2', 'Psalm 139,5', 'Psalm 139,14', '1. Mose 12,2',
      'Josua 1,9', '1. Samuel 16,7', 'Jesaja 41,10', 'Jesaja 43,1', 'Jesaja 40,31',
      'Jeremia 29,11', 'Micha 6,8', 'Matthaeus 5,9', 'Matthaeus 6,33', 'Matthaeus 28,20',
      'Johannes 3,16', 'Johannes 8,12', 'Johannes 13,34', 'Johannes 15,5', 'Roemer 8,28',
      'Roemer 12,12', '1. Korinther 13,13', '1. Korinther 16,14', 'Galater 5,22',
      'Philipper 4,13', '1. Johannes 4,16', '1. Johannes 4,19'
    ];
    for (let i = 0; i < referenzen.length; i++) {
      await db.query(
        `INSERT INTO konfsprueche (id, reference, book, chapter, verse, organization_id, sort_order)
         VALUES ($1, $2, 'x', 1, 1, NULL, $3)`,
        [i + 1, referenzen[i], i + 1]
      );
      for (const t of ['luther2017', 'bigs', 'gute_nachricht', 'elberfelder']) {
        await db.query(
          "INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text) VALUES ($1, $2, '')",
          [i + 1, t]
        );
      }
    }

    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'migrations', '134_konfspruch_texte.sql'), 'utf-8'
    );
    await db.query(sql);
  });

  it('Luther 2017 ist fuer jeden Spruch befuellt', async () => {
    const { rows } = await db.query(`
      SELECT k.reference, ku.text
        FROM konfsprueche k
        JOIN konfspruch_uebersetzungen ku ON ku.spruch_id = k.id
       WHERE ku.translation = 'luther2017' AND k.organization_id IS NULL
    `);

    expect(rows.length).toBeGreaterThan(0);
    const leer = rows.filter(r => !r.text || r.text.trim() === '');
    expect(leer.map(r => r.reference)).toEqual([]);
  });

  it('Gute Nachricht ist fuer jeden Spruch befuellt', async () => {
    const { rows } = await db.query(`
      SELECT k.reference, ku.text
        FROM konfsprueche k
        JOIN konfspruch_uebersetzungen ku ON ku.spruch_id = k.id
       WHERE ku.translation = 'gute_nachricht' AND k.organization_id IS NULL
    `);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter(r => !r.text || r.text.trim() === '').map(r => r.reference)).toEqual([]);
  });

  it('Die beiden Uebersetzungen unterscheiden sich', async () => {
    // Gegenprobe gegen einen Copy-Paste-Fehler beim Erheben: Waeren beide
    // Spalten aus derselben Quelle gefuellt, faellt das sonst niemandem auf.
    const { rows } = await db.query(`
      SELECT k.reference
        FROM konfsprueche k
        JOIN konfspruch_uebersetzungen l ON l.spruch_id = k.id AND l.translation = 'luther2017'
        JOIN konfspruch_uebersetzungen g ON g.spruch_id = k.id AND g.translation = 'gute_nachricht'
       WHERE k.organization_id IS NULL AND l.text = g.text
    `);
    expect(rows.map(r => r.reference)).toEqual([]);
  });

  it('BIGS und Elberfelder bleiben leer — Verlagsanfrage laeuft', async () => {
    // Der verbotene Fall: Texte, fuer die keine Erlaubnis vorliegt, im
    // Bestand. Dieser Test faellt, wenn jemand sie unbedacht nachtraegt.
    const { rows } = await db.query(`
      SELECT translation, COUNT(*)::int AS befuellt
        FROM konfspruch_uebersetzungen ku
        JOIN konfsprueche k ON k.id = ku.spruch_id
       WHERE k.organization_id IS NULL
         AND ku.translation IN ('bigs', 'elberfelder')
         AND ku.text <> ''
       GROUP BY translation
    `);
    expect(rows).toEqual([]);
  });

  it('Keine Psalmen-Ueberschrift im Text', async () => {
    // "Ein Psalm Davids." gehoert zum Bibeltext, ist aber kein Konfispruch
    // und stuende sonst auf der Urkunde.
    const { rows } = await db.query(`
      SELECT k.reference, ku.text
        FROM konfsprueche k
        JOIN konfspruch_uebersetzungen ku ON ku.spruch_id = k.id
       WHERE k.organization_id IS NULL
         AND ku.text <> ''
         AND ku.text ~ '^(Ein Psalm|Ein Lied|Ein Wallfahrtslied|Ein Gebet)'
    `);
    expect(rows.map(r => `${r.reference}: ${r.text.slice(0, 40)}`)).toEqual([]);
  });

  it('Kein Text enthaelt HTML-Reste', async () => {
    const { rows } = await db.query(`
      SELECT k.reference FROM konfsprueche k
        JOIN konfspruch_uebersetzungen ku ON ku.spruch_id = k.id
       WHERE k.organization_id IS NULL AND ku.text LIKE '%<%'
    `);
    expect(rows.map(r => r.reference)).toEqual([]);
  });
});
