// backend/tests/routes/gemeindeLoeschenKonten.test.js
//
// GEMEINDE LOESCHEN UND DIE KONTEN DER GEMEINDE (Nebenbefund vom 29.09.2026).
//
// DELETE /organizations/:id raeumte je Tabelle ueber die Gemeinde und loeschte
// am Ende `users WHERE organization_id = :id`. Zwei Luecken:
//
//   1. Ein Konto, das NUR hier Mitglied ist, aber in einer anderen Gemeinde
//      Spuren hat (Antrag, Chat, Zweiergespraech, angelegter Termin -- aus
//      einer beendeten Mitgliedschaft), liess das DELETE FROM users am
//      Fremdschluessel scheitern (activity_requests_konfi_id_fkey,
//      events_created_by_fkey ... ohne ON DELETE): 500, die ganze Gemeinde
//      blieb stehen. Und wo es durchlief, blieben Dateien und Zweiergespraeche
//      in den anderen Gemeinden liegen. Jetzt dieselbe Kontoloeschung wie auf
//      allen anderen Wegen (utils/kontoLoeschen.js).
//   2. Ein Konto, das AUCH in einer anderen Gemeinde Mitglied ist, verschwand
//      ganz -- samt Mitgliedschaft und Arbeit dort. Jetzt zieht es um, wie
//      beim Entfernen aus der eigenen Gemeinde (DELETE /users/:id, Fall 2;
//      Simon, 27.09.2026: "Die andere Institution oder Organisation muss dann
//      den Account behalten.").
//
// Geloescht wird immer Org 2 ("Andere Gemeinde"); der Super-Admin des Seeds
// gehoert zu Org 1.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { REQUESTS_DIR, CHALLENGES_DIR, CHAT_DIR } = require('../../utils/photoStorage');
const { restVerweise, legeDateiAn, dateiDa, hexName } = require('../helpers/vollePerson');

describe('Gemeinde löschen: Konten der Gemeinde', () => {
  let app;
  let db;
  const dateien = [];

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterEach(() => {
    for (const d of dateien.splice(0)) {
      try { fs.unlinkSync(path.join(d.verzeichnis, d.name)); } catch { /* schon weg */ }
    }
  });
  afterAll(async () => { await closePool(); });

  const datei = (verzeichnis) => {
    const d = legeDateiAn(verzeichnis, hexName());
    dateien.push(d);
    return d;
  };
  const eins = async (sql, params) => (await db.query(sql, params)).rows[0];
  const zahl = async (sql, params) => (await db.query(sql, params)).rows[0].n;

  const loescheOrg2 = async () => {
    const res = await request(app)
      .delete(`/api/organizations/${ORGS.andereGemeinde.id}`)
      .set('Authorization', `Bearer ${generateToken('superAdmin')}`);
    await warteAufNachwehen(app);
    return res;
  };

  describe('Konto nur in dieser Gemeinde, mit Spuren in einer anderen', () => {
    // teamer2 (Org 2) hat frueher in Org 1 mitgearbeitet; die Mitgliedschaft
    // dort ist beendet, die Spuren sind geblieben. Dazu die Stamm-Zeile in
    // user_organizations, die Migration 101 fuer jedes Konto angelegt hat --
    // sie ist KEINE weitere Mitgliedschaft.
    const P = USERS.teamer2.id;
    let spur;

    beforeEach(async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
        [P, ORGS.andereGemeinde.id, ROLES.teamer2.id]);
      const foto = datei(REQUESTS_DIR);
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, photo_filename, organization_id)
         VALUES ($1, 1, CURRENT_DATE, 'pending', $2, $3)`, [P, foto.name, ORGS.testGemeinde.id]);
      const challenge = await eins(
        `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, created_by)
         VALUES ($1, 'Challenge in Org 1', 'x', 'Stempel', NOW() - interval '1 day', NOW() + interval '7 days', $2)
         RETURNING id`, [ORGS.testGemeinde.id, USERS.admin1.id]);
      const beitrag = datei(CHALLENGES_DIR);
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path)
         VALUES ($1, $2, $3, 'photo', $4)`, [challenge.id, P, ORGS.testGemeinde.id, beitrag.name]);
      const anhang = datei(CHAT_DIR);
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
         VALUES (3, $1, 'teamer', 'Mein Bild', 'image', $2, 'bild.jpg')`, [P, anhang.name]);
      const zweierraum = await eins(
        `INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ($1, 'direct', $2, $3) RETURNING id`,
        [USERS.teamer2.display_name, USERS.admin1.id, ORGS.testGemeinde.id]);
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'teamer'), ($1, $3, 'admin')`,
        [zweierraum.id, P, USERS.admin1.id]);
      const leitungsdatei = datei(CHAT_DIR);
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
         VALUES ($1, $2, 'admin', 'Hier das Formular', 'file', $3, 'formular.pdf')`,
        [zweierraum.id, USERS.admin1.id, leitungsdatei.name]);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, 1, 'confirmed', $2)`,
        [P, ORGS.testGemeinde.id]);
      const termin = await eins(
        `INSERT INTO events (name, event_date, organization_id, created_by)
         VALUES ('Termin von teamer2 in Org 1', NOW() + interval '3 days', $1, $2) RETURNING id`,
        [ORGS.testGemeinde.id, P]);
      spur = {
        dateien: [foto, beitrag, anhang, leitungsdatei],
        zweierraum: Number(zweierraum.id),
        termin: Number(termin.id),
      };
    });

    it('Gemeinde löschen gelingt (200) statt am Fremdschlüssel zu scheitern', async () => {
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM organizations WHERE id = $1', [ORGS.andereGemeinde.id])).toBe(0);
    });

    it('das Konto geht samt allen Spuren in der anderen Gemeinde', async () => {
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [P])).toBe(0);
      expect(await restVerweise(db, P)).toEqual([]);
      // Das Zweiergespraech mit ihrem Namen geht ganz, die Gruppe bleibt.
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE id = $1', [spur.zweierraum])).toBe(0);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE id = 3', [])).toBe(1);
      // Der Termin gehoert Org 1 und bleibt, nur der Verweis faellt.
      const termin = await eins('SELECT created_by FROM events WHERE id = $1', [spur.termin]);
      expect(termin).toEqual({ created_by: null });
    });

    it('ihre Dateien in der anderen Gemeinde verschwinden von der Platte', async () => {
      expect(spur.dateien.filter(dateiDa).length).toBe(4);
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      expect(spur.dateien.filter(dateiDa).length).toBe(0);
    });
  });

  describe('Konto auch in einer anderen Gemeinde Mitglied', () => {
    // admin2 (Org 2) arbeitet in Org 1 als Teamer:in mit.
    const P = USERS.admin2.id;
    let spur;

    beforeEach(async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3), ($1, $4, $5)',
        [P, ORGS.testGemeinde.id, ROLES.teamer.id, ORGS.andereGemeinde.id, ROLES.admin2.id]);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, 1), ($1, 2)', [P]);
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (3, $1, 'teamer')`, [P]);
      const anhangOrg1 = datei(CHAT_DIR);
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
         VALUES (3, $1, 'teamer', 'Plan', 'file', $2, 'plan.pdf')`, [P, anhangOrg1.name]);
      const anhangOrg2 = datei(CHAT_DIR);
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
         VALUES (4, $1, 'admin', 'Plan', 'file', $2, 'plan.pdf')`, [P, anhangOrg2.name]);
      const termin = await eins(
        `INSERT INTO events (name, event_date, organization_id, created_by)
         VALUES ('Termin von admin2 in Org 1', NOW() + interval '3 days', $1, $2) RETURNING id`,
        [ORGS.testGemeinde.id, P]);
      await db.query(
        `INSERT INTO push_tokens (user_id, user_type, token, platform, device_id) VALUES ($1, 'admin', $2, 'ios', 'geraet')`,
        [P, hexName()]);
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval '1 day')`,
        [P, hexName()]);
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, organization_id)
         VALUES ($1, 'Aus Org 1', 'x', 'test', $2), ($1, 'Aus Org 2', 'x', 'test', $3)`,
        [P, ORGS.testGemeinde.id, ORGS.andereGemeinde.id]);
      spur = { anhangOrg1, anhangOrg2, termin: Number(termin.id) };
    });

    it('das Konto bleibt und zieht in die andere Gemeinde um, mit der Rolle von dort', async () => {
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      const konto = await eins('SELECT organization_id, role_id FROM users WHERE id = $1', [P]);
      expect(konto).toEqual({ organization_id: ORGS.testGemeinde.id, role_id: ROLES.teamer.id });
      // Die weitere Mitgliedschaft ist jetzt die Stamm-Gemeinde; keine Zeile
      // mehr, weder fuer Org 1 noch fuer die geloeschte Org 2.
      expect(await zahl('SELECT COUNT(*)::int AS n FROM user_organizations WHERE user_id = $1', [P])).toBe(0);
    });

    it('ihre Arbeit in der anderen Gemeinde bleibt: Termin, Nachricht, Datei, Jahrgang, Chat-Platz', async () => {
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      expect(await eins('SELECT created_by FROM events WHERE id = $1', [spur.termin])).toEqual({ created_by: P });
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_messages WHERE user_id = $1 AND room_id = 3', [P])).toBe(1);
      expect(dateiDa(spur.anhangOrg1)).toBe(true);
      expect(await zahl(
        'SELECT COUNT(*)::int AS n FROM user_jahrgang_assignments WHERE user_id = $1 AND jahrgang_id = 1', [P])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_participants WHERE user_id = $1 AND room_id = 3', [P])).toBe(1);
    });

    it('Anmeldung und Geräte bleiben; nur die Mitteilungen der gelöschten Gemeinde gehen', async () => {
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM push_tokens WHERE user_id = $1', [P])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE user_id = $1', [P])).toBe(1);
      const { rows } = await db.query('SELECT title FROM notifications WHERE user_id = $1 ORDER BY id', [P]);
      expect(rows).toEqual([{ title: 'Aus Org 1' }]);
    });

    it('was sie in der gelöschten Gemeinde hinterlassen hat, geht mit der Gemeinde — auch die Datei', async () => {
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_messages WHERE user_id = $1 AND room_id = 4', [P])).toBe(0);
      expect(await zahl(
        'SELECT COUNT(*)::int AS n FROM user_jahrgang_assignments WHERE user_id = $1 AND jahrgang_id = 2', [P])).toBe(0);
      // Die Dateien der Gemeinde laufen nach der Antwort; kurz nachfassen.
      for (let i = 0; i < 50 && dateiDa(spur.anhangOrg2); i++) await new Promise((r) => setTimeout(r, 20));
      expect(dateiDa(spur.anhangOrg2)).toBe(false);
    });

    it('die angemeldete Sitzung arbeitet in der neuen Stamm-Gemeinde weiter', async () => {
      // Warmer Rechte-Cache vor der Loeschung: danach muss die Rolle aus Org 1
      // gelten, nicht die geloeschte aus Org 2.
      const token = generateToken('admin2');
      const vorher = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(vorher.body.role_name).toBe('admin');
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      const nachher = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(nachher.status).toBe(200);
      expect(nachher.body.role_name).toBe('teamer');
    });
  });

  describe('Gegenprobe: niemand sonst ist betroffen', () => {
    it('Konten ohne Bezug zur gelöschten Gemeinde bleiben unverändert', async () => {
      const vorher = (await db.query(
        'SELECT id, organization_id, role_id FROM users WHERE organization_id = $1 ORDER BY id', [ORGS.testGemeinde.id])).rows;
      const res = await loescheOrg2();
      expect(res.status).toBe(200);
      const nachher = (await db.query(
        'SELECT id, organization_id, role_id FROM users WHERE organization_id = $1 ORDER BY id', [ORGS.testGemeinde.id])).rows;
      expect(nachher).toEqual(vorher);
      // Die Konten, die nur in Org 2 waren, sind weg.
      expect(await zahl('SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1', [ORGS.andereGemeinde.id])).toBe(0);
    });
  });
});
