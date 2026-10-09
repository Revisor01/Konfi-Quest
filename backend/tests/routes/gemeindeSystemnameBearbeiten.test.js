// PUT /api/organizations/:id -- der Systemname beim Bearbeiten einer Gemeinde
// (offene Befunde „Benutzernamen und Systemnamen", 09.10.2026)
//
// Die Store-App 2.2.x bildet name und slug bei JEDEM Speichern neu aus dem
// Anzeigenamen und wirft dabei Umlaute weg („Travemünde" -> `travemnde`). Der
// Server bildet beim Anlegen `travemuende`; speicherte die Gemeindeleitung mit
// der alten App die Gemeinde, stand danach wieder `travemnde` da. Ab 2.3.0
// behaelt die App den gespeicherten Systemnamen, solange der Anzeigename
// gleich bleibt, und bildet ihn sonst mit ae/oe/ue/ss
// (frontend/src/utils/gemeindeSystemname.ts).
//
// Erwartet: Beide Apps kommen zum selben Ergebnis. Bestehende Systemnamen
// (auch alte ohne Umlaut) bleiben, solange der Anzeigename bleibt; ein
// eigener Systemname ueber die Schnittstelle bleibt, wie er geschickt wird.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

/** So bildet die Store-App 2.2.x den Systemnamen (generateSystemName). */
const wieDieAlteApp = (anzeige) => anzeige.toLowerCase().replace(/[^a-z0-9\s]/g, '')
  .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

describe('PUT /api/organizations/:id: Systemname beim Bearbeiten', () => {
  let app, db, superAdminToken, orgAdminToken;
  const ID = ORGS.testGemeinde.id;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    superAdminToken = generateToken('superAdmin');
    orgAdminToken = generateToken('orgAdmin1');
  });

  const setze = (name, slug, display_name) => db.query(
    'UPDATE organizations SET name = $1, slug = $2, display_name = $3 WHERE id = $4',
    [name, slug, display_name, ID]
  );
  const gespeichert = async (id = ID) => {
    const { rows: [o] } = await db.query('SELECT name, slug, display_name FROM organizations WHERE id = $1', [id]);
    return o;
  };
  const speichern = (felder, token = orgAdminToken, id = ID) => request(app)
    .put(`/api/organizations/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ description: 'Neu beschrieben', ...felder });

  it('Gegenprobe zur Eingabe: die alte App verliert den Umlaut', () => {
    expect(wieDieAlteApp('Travemünde')).toBe('travemnde');
  });

  describe('Anzeigename bleibt', () => {
    it('alte App (Gemeindeleitung): `travemuende` bleibt, wird nicht zu `travemnde`', async () => {
      await setze('travemuende', 'travemuende', 'Travemünde');

      const res = await speichern({ name: 'travemnde', slug: 'travemnde', display_name: 'Travemünde' });

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'travemuende', slug: 'travemuende', display_name: 'Travemünde' });
    });

    it('alte App (Super-Admin): ebenso', async () => {
      await setze('travemuende', 'travemuende', 'Travemünde');

      const res = await speichern({ name: 'travemnde', slug: 'travemnde', display_name: 'Travemünde' }, superAdminToken);

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'travemuende', slug: 'travemuende', display_name: 'Travemünde' });
    });

    it('neue App schickt den gespeicherten Namen: bleibt', async () => {
      await setze('travemuende', 'travemuende', 'Travemünde');

      const res = await speichern({ name: 'travemuende', slug: 'travemuende', display_name: 'Travemünde' });

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'travemuende', slug: 'travemuende', display_name: 'Travemünde' });
    });

    it('alter Systemname ohne Umlaut (`bsum`) bleibt -- mit alter wie neuer App', async () => {
      await setze('bsum', 'bsum', 'Büsum');

      expect((await speichern({ name: 'bsum', slug: 'bsum', display_name: 'Büsum' })).status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'bsum', slug: 'bsum', display_name: 'Büsum' });
    });

    it('eigener Systemname bleibt auch, wenn die alte App ihn aus dem Anzeigenamen neu bildet', async () => {
      // Die neue App schickt `ks-west` zurueck; die alte `kirchspiel-west`.
      await setze('ks-west', 'ks-west', 'Kirchspiel West');

      const res = await speichern({ name: 'kirchspiel-west', slug: 'kirchspiel-west', display_name: 'Kirchspiel West' });

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'ks-west', slug: 'ks-west', display_name: 'Kirchspiel West' });
    });
  });

  describe('Anzeigename aendert sich', () => {
    it('alte App: der neue Systemname behaelt den Umlaut als ue', async () => {
      await setze('travemuende', 'travemuende', 'Travemünde');

      const anzeige = 'St. Lorenz Travemünde';
      const res = await speichern({ name: wieDieAlteApp(anzeige), slug: wieDieAlteApp(anzeige), display_name: anzeige });

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'st-lorenz-travemuende', slug: 'st-lorenz-travemuende', display_name: anzeige });
    });

    it('neue App: derselbe Systemname', async () => {
      await setze('travemuende', 'travemuende', 'Travemünde');

      const anzeige = 'St. Lorenz Travemünde';
      const res = await speichern({ name: 'st-lorenz-travemuende', slug: 'st-lorenz-travemuende', display_name: anzeige });

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'st-lorenz-travemuende', slug: 'st-lorenz-travemuende', display_name: anzeige });
    });

    it('ohne Umlaute aendert sich nichts am geschickten Namen', async () => {
      const res = await speichern({ name: 'kirchspiel-ost', slug: 'kirchspiel-ost', display_name: 'Kirchspiel Ost' });

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'kirchspiel-ost', slug: 'kirchspiel-ost', display_name: 'Kirchspiel Ost' });
    });

    it('ein eigener Systemname ueber die Schnittstelle bleibt, wie er geschickt wird', async () => {
      const res = await speichern({ name: 'kirchspiel-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd' }, superAdminToken);

      expect(res.status).toBe(200);
      expect(await gespeichert()).toEqual({ name: 'kirchspiel-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd' });
    });

    it('ist der gebildete Systemname schon vergeben: 409, nichts geaendert', async () => {
      await db.query('UPDATE organizations SET slug = $1 WHERE id = $2', ['buesum', ORGS.andereGemeinde.id]);
      const vorher = await gespeichert();

      const res = await speichern({ name: 'bsum', slug: 'bsum', display_name: 'Büsum' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Gemeinde-Slug existiert bereits');
      expect(await gespeichert()).toEqual(vorher);
    });
  });

  it('fremde Gemeinde bleibt verboten (403), unbekannte 404', async () => {
    const fremd = await speichern({ name: 'x', slug: 'x', display_name: 'X' }, orgAdminToken, ORGS.andereGemeinde.id);
    expect(fremd.status).toBe(403);

    const unbekannt = await speichern({ name: 'x', slug: 'x', display_name: 'X' }, superAdminToken, 999999);
    expect(unbekannt.status).toBe(404);
    expect(unbekannt.body.error).toBe('Gemeinde nicht gefunden');
  });
});
