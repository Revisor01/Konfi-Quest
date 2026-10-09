// Konfisprueche personenunabhaengig festhalten und auswerten
// (docs/messung/umami.md, S1; Migration 207; Simon, 09.10.2026: „volle
// Auswertung, auch wenn sie einzeln sind, insbesondere die, die selbst
// eingetragen werden ... personenunabhängig").
//
// Geprueft:
//   - Jede Wahl schreibt eine Zeile -- Konfi und Team, Vorschlag und eigener
//     Spruch; unveraendert erneut gespeichert zaehlt nicht.
//   - Die Tabelle hat KEINE Spalte, die auf eine Person zeigt, und die Zeile
//     bleibt nach dem Loeschen des Kontos stehen.
//   - GET /api/metrics/konfisprueche: nur super_admin; jeder Spruch mit
//     Anzahl, auch Einzelnennungen, eigene Sprueche im Wortlaut.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfisprueche: personenunabhaengige Statistik', () => {
  let db;
  let app;
  let josua;
  let psalm;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    ({ rows: [{ id: josua }] } = await db.query(
      `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
       VALUES ('Josua 1,9', 'Josua', 1, 9, NULL, 1) RETURNING id`));
    ({ rows: [{ id: psalm }] } = await db.query(
      `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
       VALUES ('Psalm 23,1', 'Psalm', 23, 1, NULL, 2) RETURNING id`));
  });

  afterAll(async () => {
    await closePool();
  });

  const bearer = (wer) => `Bearer ${generateToken(wer)}`;
  const spruchSetzen = (wer, rolle, body) => request(app)
    .patch(`/api/${rolle}/profile`)
    .set('Authorization', bearer(wer))
    .send(body);
  const wahlen = async () => (await db.query(
    `SELECT organization_id::int AS organization_id, quelle, konfspruch_id::int AS konfspruch_id, stelle,
            translation, freitext, freitext_referenz, monat = date_trunc('month', NOW())::date AS diesen_monat
       FROM konfspruch_wahlen ORDER BY id`)).rows;

  describe('Schreiben', () => {
    it('Konfi waehlt einen Vorschlag: eine Zeile mit Gemeinde, Stelle, Uebersetzung und Monat', async () => {
      const res = await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      expect(res.status).toBe(200);
      expect(await wahlen()).toEqual([{
        organization_id: ORGS.testGemeinde.id, quelle: 'vorschlag', konfspruch_id: Number(josua), stelle: 'Josua 1,9',
        translation: 'bigs', freitext: null, freitext_referenz: null, diesen_monat: true,
      }]);
    });

    it('eigener Spruch: im Wortlaut mit Stellenangabe', async () => {
      const res = await spruchSetzen('konfi1', 'konfi', { konfspruch_freitext: 'Mein eigener Vers', konfspruch_freitext_referenz: 'Röm 8,38' });
      expect(res.status).toBe(200);
      expect(await wahlen()).toEqual([{
        organization_id: ORGS.testGemeinde.id, quelle: 'eigen', konfspruch_id: null, stelle: null,
        translation: null, freitext: 'Mein eigener Vers', freitext_referenz: 'Röm 8,38', diesen_monat: true,
      }]);
    });

    it('unveraendert erneut gespeichert zaehlt nicht, eine andere Uebersetzung schon', async () => {
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      expect((await wahlen()).length).toBe(1);
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'luther2017' });
      expect((await wahlen()).map((w) => w.translation)).toEqual(['bigs', 'luther2017']);
      await spruchSetzen('konfi1', 'konfi', { konfspruch_freitext: 'Vers', konfspruch_freitext_referenz: 'Ps 1,1' });
      await spruchSetzen('konfi1', 'konfi', { konfspruch_freitext: 'Vers', konfspruch_freitext_referenz: 'Ps 1,1' });
      expect((await wahlen()).length).toBe(3);
    });

    it('das Team schreibt ebenso (Profil per Upsert)', async () => {
      const res = await spruchSetzen('teamer2', 'teamer', { konfspruch_id: psalm, translation: 'elberfelder' });
      expect(res.status).toBe(200);
      const [w] = await wahlen();
      expect(w).toMatchObject({ organization_id: ORGS.andereGemeinde.id, quelle: 'vorschlag', stelle: 'Psalm 23,1', translation: 'elberfelder' });
    });

    it('eine abgelehnte Wahl schreibt nichts', async () => {
      const res = await spruchSetzen('konfi1', 'konfi', { konfspruch_freitext: 'Ohne Stelle' });
      expect(res.status).toBe(400);
      expect(await wahlen()).toEqual([]);
    });
  });

  describe('Ohne Personenbezug', () => {
    it('keine Spalte der Tabelle zeigt auf users, und keine heisst nach einer Person', async () => {
      const { rows: fks } = await db.query(
        `SELECT ccu.table_name AS ziel
           FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
          WHERE tc.table_name = 'konfspruch_wahlen' AND tc.constraint_type = 'FOREIGN KEY'`);
      expect(fks.map((f) => f.ziel).sort()).toEqual(['konfsprueche', 'organizations']);
      const { rows: spalten } = await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'konfspruch_wahlen' ORDER BY ordinal_position`);
      expect(spalten.map((s) => s.column_name)).toEqual([
        'id', 'organization_id', 'quelle', 'konfspruch_id', 'stelle', 'translation', 'freitext', 'freitext_referenz', 'monat',
      ]);
    });

    it('die Wahl bleibt, wenn das Konto geloescht wird -- das Profil geht', async () => {
      await spruchSetzen('konfi1', 'konfi', { konfspruch_freitext: 'Bleibt stehen', konfspruch_freitext_referenz: 'Jes 43,1' });
      const res = await request(app)
        .delete(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', bearer('orgAdmin1'));
      await warteAufNachwehen(app);
      expect(res.status).toBe(200);
      const { rows: profil } = await db.query('SELECT 1 FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(profil).toEqual([]);
      expect((await wahlen()).map((w) => w.freitext)).toEqual(['Bleibt stehen']);
    });
  });

  describe('GET /api/metrics/konfisprueche', () => {
    const abrufen = (wer) => request(app).get('/api/metrics/konfisprueche').set('Authorization', bearer(wer));

    it('verweigert ohne Anmeldung', async () => {
      expect((await request(app).get('/api/metrics/konfisprueche')).status).toBe(401);
    });

    it.each(['orgAdmin1', 'admin1', 'teamer1', 'konfi1'])('verweigert %s (ueber alle Gemeinden)', async (wer) => {
      const res = await abrufen(wer);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Zugriff verweigert');
    });

    it('zeigt jeden Spruch mit Anzahl, auch einzelne, und eigene im Wortlaut', async () => {
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      await spruchSetzen('konfi2', 'konfi', { konfspruch_id: josua, translation: 'luther2017' });
      await spruchSetzen('konfi3', 'konfi', { konfspruch_id: psalm, translation: 'luther2017' });
      await spruchSetzen('teamer1', 'teamer', { konfspruch_freitext: 'Gott ist mein Licht', konfspruch_freitext_referenz: 'Ps 27,1' });
      // Bestand ohne Monat (wie aus der Migration)
      await db.query(
        `INSERT INTO konfspruch_wahlen (organization_id, quelle, freitext, freitext_referenz, monat)
         VALUES (1, 'eigen', 'Gott ist mein Licht', 'Ps 27,1', NULL)`);

      const res = await abrufen('superAdmin');
      expect(res.status).toBe(200);
      const monat = new Date().toISOString().slice(0, 7);
      expect(res.body).toEqual({
        gesamt: { wahlen: 5, vorschlag: 3, eigen: 2, aus_bestand: 1 },
        uebersetzungen: [{ translation: 'luther2017', anzahl: 2 }, { translation: 'bigs', anzahl: 1 }],
        sprueche: [{ stelle: 'Josua 1,9', anzahl: 2 }, { stelle: 'Psalm 23,1', anzahl: 1 }],
        eigene: [{ freitext: 'Gott ist mein Licht', freitext_referenz: 'Ps 27,1', anzahl: 2 }],
        monate: [{ monat: null, anzahl: 1 }, { monat, anzahl: 4 }],
      });
      // Weder Gemeinde noch Person in der Antwort.
      const text = JSON.stringify(res.body);
      for (const verboten of ['konfi1', 'Test Konfi', 'organization', 'user']) expect(text).not.toContain(verboten);
    });

    it('leer: Nullen und leere Listen', async () => {
      const res = await abrufen('superAdmin');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        gesamt: { wahlen: 0, vorschlag: 0, eigen: 0, aus_bestand: 0 },
        uebersetzungen: [], sprueche: [], eigene: [], monate: [],
      });
    });
  });
});
