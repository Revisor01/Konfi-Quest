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
//   - Ebenen (Migration 208; Simon, 09.10.2026: „nach Gemeinde, Kirchenkreis
//     und Landeskirche"): Kirchenkreis und Landeskirche wie beim Waehlen;
//     die Zahl bleibt, wenn die Gemeinde umgehaengt oder geloescht wird;
//     ohne Zuordnung beim Waehlen gilt die heutige.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { spruchWahlMerken } = require('../../utils/konfspruch');

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
      expect(fks.map((f) => f.ziel).sort()).toEqual(['kirchenkreise', 'konfsprueche', 'landeskirchen', 'organizations']);
      const { rows: spalten } = await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'konfspruch_wahlen' ORDER BY ordinal_position`);
      expect(spalten.map((s) => s.column_name)).toEqual([
        'id', 'organization_id', 'quelle', 'konfspruch_id', 'stelle', 'translation', 'freitext', 'freitext_referenz', 'monat',
        'kirchenkreis_id', 'landeskirche_id',
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
        ebene: { art: 'alle', id: null },
        auswahl: {
          landeskirchen: [],
          kirchenkreise: [],
          gemeinden: [
            { id: ORGS.andereGemeinde.id, name: 'Andere Gemeinde', kirchenkreis: null, anzahl: 1 },
            { id: ORGS.testGemeinde.id, name: 'Test-Gemeinde St. Martin', kirchenkreis: null, anzahl: 4 },
          ],
        },
      });
      // Keine Person in der Antwort (Gemeinden ja, siehe Ebenen).
      const text = JSON.stringify(res.body);
      for (const verboten of ['konfi1', 'Test Konfi', 'organization', 'user']) expect(text).not.toContain(verboten);
    });

    it('leer: Nullen und leere Listen', async () => {
      const res = await abrufen('superAdmin');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        gesamt: { wahlen: 0, vorschlag: 0, eigen: 0, aus_bestand: 0 },
        uebersetzungen: [], sprueche: [], eigene: [], monate: [],
        ebene: { art: 'alle', id: null },
        auswahl: { landeskirchen: [], kirchenkreise: [], gemeinden: [] },
      });
    });
  });

  describe('Ebenen: Landeskirche, Kirchenkreis, Gemeinde', () => {
    let nordkirche;
    let ekbo;
    let dithmarschen;
    let ploen;
    let mitte;

    beforeEach(async () => {
      ({ rows: [{ id: nordkirche }] } = await db.query("INSERT INTO landeskirchen (name) VALUES ('Nordkirche') RETURNING id::int AS id"));
      ({ rows: [{ id: ekbo }] } = await db.query("INSERT INTO landeskirchen (name) VALUES ('EKBO') RETURNING id::int AS id"));
      ({ rows: [{ id: dithmarschen }] } = await db.query(
        "INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Dithmarschen', $1) RETURNING id::int AS id", [nordkirche]));
      ({ rows: [{ id: ploen }] } = await db.query(
        "INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Plön-Segeberg', NULL) RETURNING id::int AS id"));
      ({ rows: [{ id: mitte }] } = await db.query(
        "INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Berlin Stadtmitte', $1) RETURNING id::int AS id", [ekbo]));
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [dithmarschen, ORGS.testGemeinde.id]);
    });

    const abrufen = (query) => request(app).get('/api/metrics/konfisprueche').query(query)
      .set('Authorization', bearer('superAdmin'));
    const anzahl = async (query) => {
      const res = await abrufen(query);
      expect(res.status).toBe(200);
      return res.body.gesamt.wahlen;
    };
    const ebenen = async () => (await db.query(
      'SELECT kirchenkreis_id::int AS kk, landeskirche_id::int AS lk FROM konfspruch_wahlen ORDER BY id')).rows;

    it('die Wahl haelt Kirchenkreis und Landeskirche ihrer Gemeinde fest', async () => {
      expect((await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' })).status).toBe(200);
      expect((await spruchSetzen('konfi3', 'konfi', { konfspruch_id: josua, translation: 'bigs' })).status).toBe(200);
      expect(await ebenen()).toEqual([{ kk: dithmarschen, lk: nordkirche }, { kk: null, lk: null }]);
    });

    it('je Ebene nur deren Sprueche, eigene im Wortlaut; die Auswahl nennt alle mit Anzahl', async () => {
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [mitte, ORGS.andereGemeinde.id]);
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      await spruchSetzen('teamer1', 'teamer', { konfspruch_freitext: 'Gott ist mein Licht', konfspruch_freitext_referenz: 'Ps 27,1' });
      await spruchSetzen('konfi3', 'konfi', { konfspruch_freitext: 'Fürchte dich nicht', konfspruch_freitext_referenz: 'Jes 43,1' });

      const res = await abrufen({ ebene: 'landeskirche', id: nordkirche });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        gesamt: { wahlen: 2, vorschlag: 1, eigen: 1, aus_bestand: 0 },
        sprueche: [{ stelle: 'Josua 1,9', anzahl: 1 }],
        eigene: [{ freitext: 'Gott ist mein Licht', freitext_referenz: 'Ps 27,1', anzahl: 1 }],
        ebene: { art: 'landeskirche', id: nordkirche },
      });
      expect(res.body.auswahl).toEqual({
        landeskirchen: [
          { id: ekbo, name: 'EKBO', anzahl: 1 },
          { id: nordkirche, name: 'Nordkirche', anzahl: 2 },
        ],
        kirchenkreise: [
          { id: mitte, name: 'Berlin Stadtmitte', landeskirche: 'EKBO', anzahl: 1 },
          { id: dithmarschen, name: 'Dithmarschen', landeskirche: 'Nordkirche', anzahl: 2 },
        ],
        gemeinden: [
          { id: ORGS.andereGemeinde.id, name: 'Andere Gemeinde', kirchenkreis: 'Berlin Stadtmitte', anzahl: 1 },
          { id: ORGS.testGemeinde.id, name: 'Test-Gemeinde St. Martin', kirchenkreis: 'Dithmarschen', anzahl: 2 },
        ],
      });

      const kreis = await abrufen({ ebene: 'kirchenkreis', id: mitte });
      expect(kreis.body.eigene).toEqual([{ freitext: 'Fürchte dich nicht', freitext_referenz: 'Jes 43,1', anzahl: 1 }]);
      expect(kreis.body.sprueche).toEqual([]);
      const gemeinde = await abrufen({ ebene: 'gemeinde', id: ORGS.testGemeinde.id });
      expect(gemeinde.body.gesamt).toEqual({ wahlen: 2, vorschlag: 1, eigen: 1, aus_bestand: 0 });
      expect(JSON.stringify(gemeinde.body)).not.toContain('Test Konfi');
    });

    it('umgehaengte Gemeinde: die Wahl bleibt beim Kirchenkreis und der Landeskirche von damals', async () => {
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [mitte, ORGS.testGemeinde.id]);
      expect(await anzahl({ ebene: 'kirchenkreis', id: dithmarschen })).toBe(1);
      expect(await anzahl({ ebene: 'landeskirche', id: nordkirche })).toBe(1);
      expect(await anzahl({ ebene: 'kirchenkreis', id: mitte })).toBe(0);
      expect(await anzahl({ ebene: 'landeskirche', id: ekbo })).toBe(0);
      expect(await anzahl({ ebene: 'gemeinde', id: ORGS.testGemeinde.id })).toBe(1);
    });

    it('geloeschte Gemeinde: die Wahl zaehlt weiter im Kirchenkreis und in der Landeskirche', async () => {
      const { rows: [{ id: klein }] } = await db.query(
        `INSERT INTO organizations (name, slug, display_name, kirchenkreis_id)
         VALUES ('Klein', 'klein', 'Kleine Gemeinde', $1) RETURNING id::int AS id`, [dithmarschen]);
      expect(await spruchWahlMerken(db, klein, { quelle: 'eigen', freitext: 'Nur hier', referenz: 'Ps 1,1' }, null)).toBe(true);
      await db.query('DELETE FROM organizations WHERE id = $1', [klein]);
      expect(await anzahl({ ebene: 'kirchenkreis', id: dithmarschen })).toBe(1);
      expect(await anzahl({ ebene: 'landeskirche', id: nordkirche })).toBe(1);
      expect(await anzahl({ ebene: 'gemeinde', id: klein })).toBe(0);
      expect(await anzahl({})).toBe(1);
    });

    it('beim Waehlen ohne Zuordnung: es gilt die heutige Zuordnung der Gemeinde', async () => {
      await spruchSetzen('konfi3', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      expect(await anzahl({ ebene: 'kirchenkreis', id: mitte })).toBe(0);
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [mitte, ORGS.andereGemeinde.id]);
      expect(await anzahl({ ebene: 'kirchenkreis', id: mitte })).toBe(1);
      expect(await anzahl({ ebene: 'landeskirche', id: ekbo })).toBe(1);
      expect(await ebenen()).toEqual([{ kk: null, lk: null }]);
    });

    it('Kirchenkreis ohne Landeskirche beim Waehlen: es gilt dessen heutige Landeskirche', async () => {
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [ploen, ORGS.andereGemeinde.id]);
      await spruchSetzen('konfi3', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      expect(await ebenen()).toEqual([{ kk: ploen, lk: null }]);
      expect(await anzahl({ ebene: 'landeskirche', id: nordkirche })).toBe(0);
      await db.query('UPDATE kirchenkreise SET landeskirche_id = $1 WHERE id = $2', [nordkirche, ploen]);
      expect(await anzahl({ ebene: 'landeskirche', id: nordkirche })).toBe(1);
    });

    it('geloeschter Kirchenkreis: die Landeskirche bleibt', async () => {
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      await db.query('DELETE FROM kirchenkreise WHERE id = $1', [dithmarschen]);
      expect(await ebenen()).toEqual([{ kk: null, lk: nordkirche }]);
      expect(await anzahl({ ebene: 'landeskirche', id: nordkirche })).toBe(1);
      const res = await abrufen({});
      expect(res.body.auswahl.kirchenkreise).toEqual([]);
    });

    it('interne Gemeinde zaehlt nirgends, die nicht-interne schon (wie die Support-Ansicht)', async () => {
      await db.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE id = $2', [dithmarschen, ORGS.andereGemeinde.id]);
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      await spruchSetzen('konfi3', 'konfi', { konfspruch_freitext: 'Nur intern', konfspruch_freitext_referenz: 'Ps 2,1' });
      await db.query('UPDATE organizations SET intern = true WHERE id = $1', [ORGS.andereGemeinde.id]);

      const alle = await abrufen({});
      expect(alle.body.gesamt).toEqual({ wahlen: 1, vorschlag: 1, eigen: 0, aus_bestand: 0 });
      expect(alle.body.eigene).toEqual([]);
      expect(alle.body.monate.map((m) => m.anzahl)).toEqual([1]);
      expect(alle.body.auswahl).toEqual({
        landeskirchen: [{ id: nordkirche, name: 'Nordkirche', anzahl: 1 }],
        kirchenkreise: [{ id: dithmarschen, name: 'Dithmarschen', landeskirche: 'Nordkirche', anzahl: 1 }],
        gemeinden: [{ id: ORGS.testGemeinde.id, name: 'Test-Gemeinde St. Martin', kirchenkreis: 'Dithmarschen', anzahl: 1 }],
      });
      expect(await anzahl({ ebene: 'kirchenkreis', id: dithmarschen })).toBe(1);
      expect(await anzahl({ ebene: 'gemeinde', id: ORGS.andereGemeinde.id })).toBe(0);
      expect(await anzahl({ ebene: 'gemeinde', id: ORGS.testGemeinde.id })).toBe(1);
    });

    it('unbekannte Kennung: Nullen und leere Listen', async () => {
      await spruchSetzen('konfi1', 'konfi', { konfspruch_id: josua, translation: 'bigs' });
      const res = await abrufen({ ebene: 'gemeinde', id: 999999 });
      expect(res.status).toBe(200);
      expect(res.body.gesamt).toEqual({ wahlen: 0, vorschlag: 0, eigen: 0, aus_bestand: 0 });
      expect(res.body.sprueche).toEqual([]);
    });

    it.each([
      [{ ebene: 'bistum', id: 1 }],
      [{ ebene: 'gemeinde' }],
      [{ ebene: 'kirchenkreis', id: 'abc' }],
      [{ ebene: 'landeskirche', id: '-1' }],
    ])('ungueltige Ebene %o: 400', async (query) => {
      const res = await abrufen(query);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ungültige Ebene');
    });

    it('die Gemeindeleitung bekommt auch die eigene Gemeinde hier nicht (403)', async () => {
      const res = await request(app).get('/api/metrics/konfisprueche')
        .query({ ebene: 'gemeinde', id: ORGS.testGemeinde.id })
        .set('Authorization', bearer('orgAdmin1'));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Zugriff verweigert');
    });
  });
});
