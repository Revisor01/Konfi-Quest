// Einladung in eine weitere Gemeinde
//
// SIMONS ENTWURF (26.09.2026): "ORG Admin kann bestehenden anderen User
// hinzufuegen, der bekommt Einladung und bestaetigt. Schon ist der switcher
// da." Dazu: "Nur org Admin kann Einladung senden. Und er kann ihm dann die
// Rolle geben. Konfi ist nie moeglich. Ist logisch."
//
// Jede Grenze steht hier als eigener Test -- der erlaubte UND der verbotene
// Fall. Die wichtigste: canCreateRole('org_admin', 'konfi') liefert TRUE,
// die Rollenhierarchie allein wuerde einen Konfi also durchlassen.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const emailService = require('../../services/emailService');
const PushService = require('../../services/pushService');
const { warteAufNachwehen } = require('../../utils/nachAntwort');

describe('Einladung in eine weitere Gemeinde', () => {
  let app;
  let db;
  let orgAdmin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdmin2Token = generateToken('orgAdmin2');

    // Kein SMTP und kein Firebase in der Testumgebung. vi.spyOn statt
    // vi.mock, weil Route und Test dieselbe Modul-Instanz teilen muessen.
    // mockReset, weil die Suite die Zaehler sonst ueber alle Tests aufaddiert
    // (es gibt kein globales restoreMocks).
    vi.spyOn(emailService, 'sendGemeindeEinladungEmail').mockReset().mockResolvedValue({ success: true });
    vi.spyOn(PushService, 'sendGemeindeEinladungToUser').mockReset().mockResolvedValue({ success: true });
  });

  const einladen = (token, body) =>
    request(app).post('/api/einladungen').set('Authorization', `Bearer ${token}`).send(body);

  /** Wartet auf Push und Mail, die erst nach der Antwort laufen. */
  const nachwehen = () => warteAufNachwehen(app);

  // ---- der erlaubte Fall --------------------------------------------------

  it('laedt eine bestehende Person per Benutzername ein', async () => {
    const res = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('offen');
    expect(Number(res.body.user_id)).toBe(USERS.teamer1.id);
    expect(res.body.role_name).toBe('teamer');

    // 14 Tage, nicht 7 (Simon, 26.09.2026).
    const tage = (new Date(res.body.expires_at) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(tage).toBeGreaterThan(13.5);
    expect(tage).toBeLessThan(14.5);

    // Die Mitgliedschaft entsteht NOCH NICHT -- erst mit der Annahme.
    const { rows } = await db.query(
      'SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id = 2',
      [USERS.teamer1.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('findet die Person auch ueber ihre E-Mail-Adresse', async () => {
    await db.query(`UPDATE users SET email = 'teamer.eins@example.org' WHERE id = $1`, [USERS.teamer1.id]);

    const res = await einladen(orgAdmin2Token, {
      kennung: 'Teamer.Eins@Example.ORG', // Gross-/Kleinschreibung egal
      role_id: ROLES.teamer2.id
    });
    expect(res.status).toBe(201);
    expect(Number(res.body.user_id)).toBe(USERS.teamer1.id);
  });

  it('meldet die Einladung per Postfach-Push und E-Mail', async () => {
    await db.query(`UPDATE users SET email = 'ziel@example.org' WHERE id = $1`, [USERS.teamer1.id]);
    await einladen(orgAdmin2Token, { kennung: USERS.teamer1.username, role_id: ROLES.teamer2.id });
    await nachwehen();

    expect(PushService.sendGemeindeEinladungToUser).toHaveBeenCalledTimes(1);
    expect(emailService.sendGemeindeEinladungEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendGemeindeEinladungEmail.mock.calls[0][0]).toBe('ziel@example.org');
  });

  it('die eingeladene Person nimmt an -- danach ist sie Mitglied', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });

    const zielToken = generateToken('teamer1');
    const offen = await request(app).get('/api/einladungen/meine')
      .set('Authorization', `Bearer ${zielToken}`);
    expect(offen.status).toBe(200);
    expect(offen.body).toHaveLength(1);
    expect(offen.body[0].organization_display_name).toBe('Andere Gemeinde');

    const res = await request(app).post(`/api/einladungen/${einladung.id}/annehmen`)
      .set('Authorization', `Bearer ${zielToken}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.organization.id)).toBe(2);

    // DAS ist der Kern: die Mitgliedschaft mit der vergebenen Rolle.
    const { rows } = await db.query(
      'SELECT role_id FROM user_organizations WHERE user_id = $1 AND organization_id = 2',
      [USERS.teamer1.id]
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].role_id)).toBe(ROLES.teamer2.id);
  });

  it('die eingeladene Person lehnt ab -- keine Mitgliedschaft', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });

    const res = await request(app).post(`/api/einladungen/${einladung.id}/ablehnen`)
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(res.status).toBe(200);

    const { rows } = await db.query(
      'SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id = 2',
      [USERS.teamer1.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('die Leitung zieht eine Einladung zurueck', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });

    const res = await request(app).delete(`/api/einladungen/${einladung.id}`)
      .set('Authorization', `Bearer ${orgAdmin2Token}`);
    expect(res.status).toBe(200);

    const offen = await request(app).get('/api/einladungen/meine')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(offen.body).toHaveLength(0);
  });

  // ---- die verbotenen Faelle ---------------------------------------------

  it('weist die konfi-Rolle ab -- auch wenn die Hierarchie sie zuliesse', async () => {
    // canCreateRole('org_admin', 'konfi') liefert TRUE. Ohne die eigene
    // Pruefung in der Route entstuende hier eine Konfi ohne Jahrgang.
    const res = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.konfi2.id
    });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('konfi_nicht_moeglich');
  });

  it('weist eine Rolle aus einer FREMDEN Gemeinde ab', async () => {
    // ROLES.teamer gehoert zu Org 1, der Aufrufer leitet Org 2.
    const res = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer.id
    });
    expect(res.status).toBe(400);
  });

  it('laesst niemanden sich selbst einladen', async () => {
    const res = await einladen(orgAdmin2Token, {
      kennung: USERS.orgAdmin2.username,
      role_id: ROLES.teamer2.id
    });
    expect(res.status).toBe(400);
  });

  it('weist eine Person ab, die schon in der Gemeinde arbeitet', async () => {
    const res = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer2.username, // Stamm-Gemeinde ist Org 2
      role_id: ROLES.teamer2.id
    });
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe('schon_mitglied');
  });

  it('laesst keine zweite offene Einladung zu', async () => {
    const eins = await einladen(orgAdmin2Token, { kennung: USERS.teamer1.username, role_id: ROLES.teamer2.id });
    expect(eins.status).toBe(201);

    const zwei = await einladen(orgAdmin2Token, { kennung: USERS.teamer1.username, role_id: ROLES.teamer2.id });
    expect(zwei.status).toBe(409);
    expect(zwei.body.error_code).toBe('schon_eingeladen');
  });

  it('meldet eine unbekannte Kennung, ohne den Bestand preiszugeben', async () => {
    const res = await einladen(orgAdmin2Token, { kennung: 'gibtesnicht', role_id: ROLES.teamer2.id });
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe('nicht_gefunden');
  });

  // Audit 26.09.2026 (Sicherheit BF-03, HOCH): Die Route pruefte nur die zu
  // vergebende Rolle, nicht die Rolle der eingeladenen Person. konfi3 (Org 2)
  // liess sich von orgAdmin1 als Teamer:in in Org 1 einladen -- und die
  // Antwort verriet zu jeder E-Mail-Adresse im System Anzeigename und
  // Benutzername, auch von Kindern fremder Gemeinden. Ein Konfi muss aussehen
  // wie eine unbekannte Kennung: gleicher Status, gleiche Meldung, kein Name,
  // keine Einladung, kein Push, keine Mail.
  describe('Konfis sind kein Ziel -- und nicht von Unbekannten unterscheidbar', () => {
    let orgAdmin1Token;
    beforeEach(async () => {
      orgAdmin1Token = generateToken('orgAdmin1');
      await db.query("UPDATE users SET email = 'kind@example.org' WHERE id = $1", [USERS.konfi3.id]);
    });

    it('Konfi einer FREMDEN Gemeinde per Benutzername -> 404 wie unbekannt, keine Einladung', async () => {
      const res = await einladen(orgAdmin1Token, { kennung: 'konfi3', role_id: ROLES.teamer.id });
      await nachwehen();

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'Kein Konto mit diesem Benutzernamen oder dieser E-Mail-Adresse.',
        error_code: 'nicht_gefunden'
      });
      const { rows } = await db.query('SELECT id FROM org_einladungen');
      expect(rows).toHaveLength(0);
      expect(PushService.sendGemeindeEinladungToUser).not.toHaveBeenCalled();
      expect(emailService.sendGemeindeEinladungEmail).not.toHaveBeenCalled();
    });

    it('Konfi einer FREMDEN Gemeinde per E-Mail -> 404, kein Anzeigename', async () => {
      const res = await einladen(orgAdmin1Token, { kennung: 'Kind@example.org', role_id: ROLES.teamer.id });

      expect(res.status).toBe(404);
      expect(res.body.error_code).toBe('nicht_gefunden');
      expect(res.body.display_name).toBeUndefined();
      expect(res.body.user_id).toBeUndefined();
    });

    it('Konfi der EIGENEN Gemeinde -> ebenfalls 404, nicht 409 "schon Mitglied"', async () => {
      const res = await einladen(orgAdmin1Token, { kennung: USERS.konfi1.username, role_id: ROLES.teamer.id });

      expect(res.status).toBe(404);
      expect(res.body.error_code).toBe('nicht_gefunden');
    });

    it('die Antwort auf einen Konfi und auf eine unbekannte Kennung ist identisch', async () => {
      const konfi = await einladen(orgAdmin1Token, { kennung: 'konfi3', role_id: ROLES.teamer.id });
      const niemand = await einladen(orgAdmin1Token, { kennung: 'niemand@example.org', role_id: ROLES.teamer.id });

      expect(konfi.status).toBe(niemand.status);
      expect(konfi.body).toEqual(niemand.body);
    });

    it('eine Teamer:in einer fremden Gemeinde bleibt einladbar -> 201', async () => {
      const res = await einladen(orgAdmin1Token, { kennung: USERS.teamer2.username, role_id: ROLES.teamer.id });

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(USERS.teamer2.id);
    });
  });

  it('nur org_admin darf einladen', async () => {
    for (const [name, status] of [['admin2', 403], ['teamer2', 403], ['konfi3', 403]]) {
      const res = await einladen(generateToken(name), {
        kennung: USERS.teamer1.username,
        role_id: ROLES.teamer2.id
      });
      expect(res.status, `${name} durfte einladen`).toBe(status);
    }
    const ohne = await request(app).post('/api/einladungen')
      .send({ kennung: USERS.teamer1.username, role_id: ROLES.teamer2.id });
    expect(ohne.status).toBe(401);
  });

  it('eine FREMDE Einladung laesst sich nicht annehmen', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });

    // admin1 ist nicht die eingeladene Person -- 404 wie "gibt es nicht",
    // damit sich durch Durchprobieren nichts erkennen laesst.
    const res = await request(app).post(`/api/einladungen/${einladung.id}/annehmen`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`);
    expect(res.status).toBe(404);

    const { rows } = await db.query(
      'SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id = 2',
      [USERS.admin1.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('eine abgelaufene Einladung laesst sich nicht mehr annehmen', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });
    await db.query(`UPDATE org_einladungen SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [einladung.id]);

    const res = await request(app).post(`/api/einladungen/${einladung.id}/annehmen`)
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(res.status).toBe(410);
    expect(res.body.error_code).toBe('expired');

    const { rows } = await db.query(
      'SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id = 2',
      [USERS.teamer1.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('eine schon beantwortete Einladung laesst sich nicht erneut annehmen', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });
    const zielToken = generateToken('teamer1');
    await request(app).post(`/api/einladungen/${einladung.id}/ablehnen`)
      .set('Authorization', `Bearer ${zielToken}`).expect(200);

    const res = await request(app).post(`/api/einladungen/${einladung.id}/annehmen`)
      .set('Authorization', `Bearer ${zielToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error_code).toBe('schon_beantwortet');
  });

  it('abgelaufene Einladungen stehen in keiner Liste', async () => {
    const { body: einladung } = await einladen(orgAdmin2Token, {
      kennung: USERS.teamer1.username,
      role_id: ROLES.teamer2.id
    });
    await db.query(`UPDATE org_einladungen SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [einladung.id]);

    const meine = await request(app).get('/api/einladungen/meine')
      .set('Authorization', `Bearer ${generateToken('teamer1')}`);
    expect(meine.body).toHaveLength(0);

    const liste = await request(app).get('/api/einladungen')
      .set('Authorization', `Bearer ${orgAdmin2Token}`);
    expect(liste.body).toHaveLength(0);
  });
});
