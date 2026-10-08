// Sperre und Kontofelder JE GEMEINDE (Simon, 08.10.2026; Migration 196,
// docs/planung/mehrfach-konten.md Entscheidungen 5 bis 8).
//
// Wer in mehreren Gemeinden mitarbeitet, hat in jeder eine eigene Sperre,
// Funktionsbezeichnung und ein eigenes "Teamer:in seit". Bis hierher hingen
// alle drei am Konto: Sperrte Gemeinde A eine Person, war sie auch in B
// gesperrt; die Funktionsbezeichnung aus A stand in B.
//
//  - Sperrt A eine Person, die auch in B ist, ist sie NUR in A gesperrt: Die
//    Anmeldung geht weiter, A taucht fuer sie nicht mehr auf (Liste, Wechsel,
//    403 beim Zugriff wie beim Verlust einer Mitgliedschaft).
//  - Ist sie in ALLEN Gemeinden gesperrt, scheitert die Anmeldung.
//  - Ein Super-Admin sperrt das ganze Konto.
//  - Die Sperre wirkt sofort, auch auf einer Replica, die nichts von ihr
//    weiss (Befund "Sperre wirkt auf der zweiten Replica erst nach 30 s",
//    Sicherheit BF-10): Hier wird der Zustand in der Datenbank geaendert,
//    ohne dass jemand den Zwischenspeicher leert -- genau das, was die zweite
//    Replica erlebt.
//  - Leitung loescht ein Konfi-Konto mit weiterer Gemeinde: nur die
//    Mitgliedschaft in der eigenen Gemeinde endet (Entscheidung 8).
//
// Aufbau: teamer2 ist zuhause Teamer:in in Gemeinde 2 und ueber
// user_organizations auch Teamer:in in Gemeinde 1.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, PASSWORD } = require('../helpers/seed');
const { generateToken, generateTokenMitAlter } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { ladeLeitungDerOrganisation } = require('../../utils/orgMitglieder');

const T = USERS.teamer2;

describe('Sperre und Kontofelder je Gemeinde', () => {
  let app;
  let db;

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
    Object.values(USERS).forEach((u) => invalidateUserCache(u.id));
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
      [T.id, ROLES.teamer.id]
    );
  });

  const me = (token, org) => {
    const r = request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    return org ? r.set('X-Active-Organization', String(org)) : r;
  };
  const sperren = (leitung, userId, aktiv, org) => {
    const r = request(app).put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${generateToken(leitung)}`)
      .send({ is_active: aktiv });
    return org ? r.set('X-Active-Organization', String(org)) : r;
  };
  const anmelden = () => request(app).post('/api/auth/login').send({ username: T.username, password: PASSWORD });
  const stand = async () => {
    const { rows: [k] } = await db.query('SELECT is_active FROM users WHERE id = $1', [T.id]);
    const { rows } = await db.query(
      'SELECT organization_id, is_active FROM user_organizations WHERE user_id = $1 ORDER BY organization_id', [T.id]);
    return { konto: k.is_active, zeilen: rows.map((z) => ({ org: Number(z.organization_id), aktiv: z.is_active })) };
  };
  const decode = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

  describe('eine weitere Gemeinde sperrt', () => {
    beforeEach(async () => {
      const res = await sperren('orgAdmin1', T.id, false);
      expect(res.status).toBe(200);
    });

    it('nur dort: Konto frei, Zeile der Gemeinde gesperrt', async () => {
      expect(await stand()).toEqual({ konto: true, zeilen: [{ org: 1, aktiv: false }] });
    });

    it('verboten: Zugriff auf die sperrende Gemeinde -> 403 org_kein_zugriff', async () => {
      const res = await me(generateToken('teamer2'), 1);
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('org_kein_zugriff');
    });

    it('verboten: Wechsel in die sperrende Gemeinde -> 403, und sie steht nicht in der Liste', async () => {
      const token = generateToken('teamer2');
      const wechsel = await request(app).post('/api/auth/switch-org')
        .set('Authorization', `Bearer ${token}`).send({ organization_id: 1 });
      expect(wechsel.status).toBe(403);
      const liste = await request(app).get('/api/auth/my-organizations').set('Authorization', `Bearer ${token}`);
      expect(liste.status).toBe(200);
      expect(liste.body.map((o) => o.id)).toEqual([ORGS.andereGemeinde.id]);
    });

    it('erlaubt: Anmeldung und Arbeit in der Stamm-Gemeinde gehen weiter', async () => {
      const login = await anmelden();
      expect(login.status).toBe(200);
      expect(decode(login.body.token).active_organization_id).toBeUndefined();
      const res = await me(login.body.token);
      expect(res.status).toBe(200);
      expect(res.body.organization_id).toBe(ORGS.andereGemeinde.id);
      expect(res.body.role_name).toBe('teamer');
    });

    it.each([
      ['Chat', '/api/chat/files/abc123'],
      ['Challenges', '/api/challenges/files/abc123'],
    ])('verboten: Dateien (%s) aus der sperrenden Gemeinde -> 403 org_kein_zugriff', async (_art, pfad) => {
      const res = await request(app).get(pfad)
        .set('Authorization', `Bearer ${generateToken('teamer2')}`).set('X-Active-Organization', '1');
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('org_kein_zugriff');
    });

    it.each([
      ['Chat', '/api/chat/files/abc123'],
      ['Challenges', '/api/challenges/files/abc123'],
    ])('erlaubt: Dateien (%s) in der Stamm-Gemeinde -> nicht 403 (Datei fehlt: 404)', async (_art, pfad) => {
      const res = await request(app).get(pfad).set('Authorization', `Bearer ${generateToken('teamer2')}`);
      expect(res.status).toBe(404);
    });

    it('die Benutzerverwaltung zeigt die Sperre nur in der sperrenden Gemeinde', async () => {
      const inA = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      const inB = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(inA.body.find((u) => u.id === T.id).is_active).toBe(false);
      expect(inB.body.find((u) => u.id === T.id).is_active).toBe(true);
    });

    it('freigeben macht die Gemeinde wieder zugaenglich', async () => {
      const res = await sperren('orgAdmin1', T.id, true);
      expect(res.status).toBe(200);
      expect(await stand()).toEqual({ konto: true, zeilen: [{ org: 1, aktiv: true }] });
      expect((await me(generateToken('teamer2'), 1)).status).toBe(200);
    });
  });

  describe('die Stamm-Gemeinde sperrt', () => {
    beforeEach(async () => {
      const res = await sperren('orgAdmin2', T.id, false);
      expect(res.status).toBe(200);
    });

    it('nur dort: Konto frei, Stamm-Zeile mit Sperre angelegt', async () => {
      expect(await stand()).toEqual({ konto: true, zeilen: [{ org: 1, aktiv: true }, { org: 2, aktiv: false }] });
    });

    it('erlaubt: Anmeldung landet in der freien weiteren Gemeinde', async () => {
      const login = await anmelden();
      expect(login.status).toBe(200);
      expect(decode(login.body.token).active_organization_id).toBe(ORGS.testGemeinde.id);
      expect(login.body.user.organization).toBe(ORGS.testGemeinde.name);
      expect(login.body.user.role_name).toBe('teamer');
      const res = await me(login.body.token);
      expect(res.body.organization_id).toBe(ORGS.testGemeinde.id);
    });

    it('ein altes Token ohne Gemeinde arbeitet in der freien weiteren Gemeinde (Store-App 2.3.0)', async () => {
      const res = await me(generateToken('teamer2'));
      expect(res.status).toBe(200);
      expect(res.body.organization_id).toBe(ORGS.testGemeinde.id);
    });

    it('verboten: ausdruecklich die Stamm-Gemeinde -> 403', async () => {
      const res = await me(generateToken('teamer2'), 2);
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('org_kein_zugriff');
    });

    it('der Refresh stellt das Token fuer die freie Gemeinde aus', async () => {
      const login = await anmelden();
      const refresh = await request(app).post('/api/auth/refresh').send({ refresh_token: login.body.refresh_token });
      expect(refresh.status).toBe(200);
      expect(decode(refresh.body.token).active_organization_id).toBe(ORGS.testGemeinde.id);
    });
  });

  describe('in allen Gemeinden gesperrt', () => {
    it('verboten: die Anmeldung scheitert, das Konto ist gesperrt', async () => {
      expect((await sperren('orgAdmin1', T.id, false)).status).toBe(200);
      expect((await sperren('orgAdmin2', T.id, false)).status).toBe(200);
      expect((await stand()).konto).toBe(false);
      const login = await anmelden();
      expect(login.status).toBe(403);
      expect(login.body.error_code).toBe('user_inactive');
    });

    it('erlaubt: eine Gemeinde gibt frei -> Anmeldung geht wieder, dort', async () => {
      await sperren('orgAdmin1', T.id, false);
      await sperren('orgAdmin2', T.id, false);
      expect((await sperren('orgAdmin1', T.id, true)).status).toBe(200);
      const login = await anmelden();
      expect(login.status).toBe(200);
      expect(decode(login.body.token).active_organization_id).toBe(ORGS.testGemeinde.id);
    });
  });

  it('ein Konto mit nur einer Gemeinde: Sperre sperrt das Konto (wie bisher)', async () => {
    expect((await sperren('orgAdmin1', USERS.teamer1.id, false)).status).toBe(200);
    const { rows: [k] } = await db.query('SELECT is_active FROM users WHERE id = $1', [USERS.teamer1.id]);
    expect(k.is_active).toBe(false);
    const login = await request(app).post('/api/auth/login').send({ username: USERS.teamer1.username, password: PASSWORD });
    expect(login.status).toBe(403);
  });

  it('ein Super-Admin sperrt das ganze Konto, auch die weitere Gemeinde', async () => {
    const res = await sperren('orgAdminSuper', T.id, false, 1);
    expect(res.status).toBe(200);
    expect(await stand()).toEqual({ konto: false, zeilen: [{ org: 1, aktiv: false }] });
  });

  describe('die Sperre wirkt sofort, auch ohne geleerten Zwischenspeicher (zweite Replica)', () => {
    it('Sperre in der Gemeinde: naechste Anfrage der warmen Sitzung -> 403', async () => {
      const token = generateToken('teamer2');
      expect((await me(token, 1)).status).toBe(200);
      // So erlebt es die zweite Replica: Die Datenbank ist geaendert, ihr
      // Zwischenspeicher wurde von niemandem geleert.
      await db.query('UPDATE user_organizations SET is_active = false WHERE user_id = $1 AND organization_id = 1', [T.id]);
      const danach = await me(token, 1);
      expect(danach.status).toBe(403);
      expect(danach.body.error_code).toBe('org_kein_zugriff');
    });

    it('Sperre des Kontos: naechste Anfrage der warmen Sitzung -> 401', async () => {
      const token = generateToken('teamer1');
      expect((await me(token)).status).toBe(200);
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.teamer1.id]);
      const danach = await me(token);
      expect(danach.status).toBe(401);
      expect(danach.body).toEqual({ error: 'User account is inactive' });
    });

    it('Abmelden aller Sitzungen (token_invalidated_at): sofort 401', async () => {
      const token = generateTokenMitAlter('teamer1', 120);
      expect((await me(token)).status).toBe(200);
      await db.query('UPDATE users SET token_invalidated_at = NOW() WHERE id = $1', [USERS.teamer1.id]);
      expect((await me(token)).status).toBe(401);
    });

    it('Rollenwechsel: die warme Sitzung arbeitet sofort mit der neuen Rolle', async () => {
      const token = generateToken('teamer2');
      expect((await me(token, 1)).body.role_name).toBe('teamer');
      await db.query('UPDATE user_organizations SET role_id = $2 WHERE user_id = $1 AND organization_id = 1',
        [T.id, ROLES.admin.id]);
      expect((await me(token, 1)).body.role_name).toBe('admin');
    });

    it('erlaubt: ohne Aenderung bleibt die Sitzung gueltig', async () => {
      const token = generateToken('teamer2');
      expect((await me(token, 1)).status).toBe(200);
      expect((await me(token, 1)).status).toBe(200);
    });
  });

  describe('Funktionsbezeichnung je Gemeinde', () => {
    it('die eigene Bezeichnung in der weiteren Gemeinde aendert die Stamm-Gemeinde nicht', async () => {
      const token = generateToken('teamer2');
      const res = await request(app).post('/api/auth/update-role-title')
        .set('Authorization', `Bearer ${token}`).set('X-Active-Organization', '1')
        .send({ role_title: 'Jugendarbeit' });
      expect(res.status).toBe(200);
      const { rows: [k] } = await db.query('SELECT role_title FROM users WHERE id = $1', [T.id]);
      expect(k.role_title).toBe(null);
      expect((await me(token, 1)).body.role_title).toBe('Jugendarbeit');
      expect((await me(token)).body.role_title).toBe(null);
    });

    it('die Leitung der weiteren Gemeinde darf die Bezeichnung dort setzen, nicht den Namen', async () => {
      const leitung = generateToken('orgAdmin1');
      const titel = await request(app).put(`/api/admin/users/${T.id}`)
        .set('Authorization', `Bearer ${leitung}`).send({ role_title: 'Kinderfreizeit' });
      expect(titel.status).toBe(200);
      const name = await request(app).put(`/api/admin/users/${T.id}`)
        .set('Authorization', `Bearer ${leitung}`).send({ display_name: 'Anders' });
      expect(name.status).toBe(400);
      expect(name.body.error_code).toBe('nur_rolle_in_weiterer_gemeinde');
      const inA = await request(app).get(`/api/admin/users/${T.id}`).set('Authorization', `Bearer ${leitung}`);
      expect(inA.body.role_title).toBe('Kinderfreizeit');
      const inB = await request(app).get(`/api/admin/users/${T.id}`).set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(inB.body.role_title).toBe(null);
    });
  });

  describe('"Teamer:in seit" je Gemeinde', () => {
    it('erlaubt: die weitere Gemeinde setzt ihr Datum (vorher 404), die Stamm-Gemeinde bleibt', async () => {
      await db.query("UPDATE users SET teamer_since = '2020-09-01' WHERE id = $1", [T.id]);
      const res = await request(app).put(`/api/admin/konfis/${T.id}/teamer-since`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`).send({ teamer_since: '2024-09-01' });
      expect(res.status).toBe(200);
      // Datum als Text aus der Datenbank: Die Antwort serialisiert ein Date
      // und verschiebt sich dabei je nach Zeitzone des Prozesses.
      const { rows: [z] } = await db.query(
        'SELECT teamer_since::text AS t FROM user_organizations WHERE user_id = $1 AND organization_id = 1', [T.id]);
      expect(z.t).toBe('2024-09-01');
      const { rows: [k] } = await db.query('SELECT teamer_since::text AS t FROM users WHERE id = $1', [T.id]);
      expect(k.t).toBe('2020-09-01');
      // Liste und Antwort liefern denselben Wert wie die Zeile, nicht den vom Konto.
      const liste = await request(app).get('/api/admin/konfis/teamer').set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      const ausListe = liste.body.find((p) => p.id === T.id).teamer_since;
      expect(new Date(ausListe).getTime()).toBe(new Date(res.body.teamer_since).getTime());
      expect(new Date(ausListe).getFullYear()).toBe(2024);
    });

    it('verboten: eine Gemeinde ohne Mitgliedschaft -> 404', async () => {
      const res = await request(app).put(`/api/admin/konfis/${USERS.teamer1.id}/teamer-since`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`).send({ teamer_since: '2024-09-01' });
      expect(res.status).toBe(404);
    });
  });

  describe('Stamm-Zeilen', () => {
    it('ein Rollenwechsel in der Stamm-Gemeinde schreibt Konto und Stamm-Zeile', async () => {
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.teamer1.id, ROLES.teamer.id]);
      const res = await request(app).put(`/api/admin/users/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`).send({ role_id: ROLES.admin.id, role_title: 'Diakonin' });
      expect(res.status).toBe(200);
      const { rows: [k] } = await db.query('SELECT role_id, role_title FROM users WHERE id = $1', [USERS.teamer1.id]);
      const { rows: [z] } = await db.query(
        'SELECT role_id, role_title FROM user_organizations WHERE user_id = $1 AND organization_id = 1', [USERS.teamer1.id]);
      expect([Number(k.role_id), k.role_title]).toEqual([ROLES.admin.id, 'Diakonin']);
      expect([Number(z.role_id), z.role_title]).toEqual([ROLES.admin.id, 'Diakonin']);
    });

    it('eine veraltete Stamm-Zeile macht niemanden zur Leitung', async () => {
      // teamer1 ist zuhause Teamer:in; die Stamm-Zeile behauptet Org-Leitung.
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.teamer1.id, ROLES.orgAdmin.id]);
      const leitung = (await ladeLeitungDerOrganisation(db, 1)).map(Number);
      expect(leitung).not.toContain(USERS.teamer1.id);
      expect(leitung).toContain(USERS.orgAdmin1.id);
    });
  });

  describe('Leitung loescht ein Konfi-Konto mit weiterer Gemeinde (Altbestand)', () => {
    beforeEach(async () => {
      // konfi3 ist zuhause Konfi in Gemeinde 2 und hat (Altbestand) auch eine
      // Konfi-Zeile in Gemeinde 1.
      await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 1, $2)',
        [USERS.konfi3.id, ROLES.konfi.id]);
    });

    it('die weitere Gemeinde beendet nur ihre Mitgliedschaft, das Konto bleibt', async () => {
      const res = await request(app).delete(`/api/admin/konfis/${USERS.konfi3.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.konto_bleibt).toBe(true);
      const { rows: [k] } = await db.query('SELECT organization_id, deleted_at FROM users WHERE id = $1', [USERS.konfi3.id]);
      expect(Number(k.organization_id)).toBe(2);
      const { rows } = await db.query('SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id = 1', [USERS.konfi3.id]);
      expect(rows).toHaveLength(0);
      const login = await request(app).post('/api/auth/login').send({ username: USERS.konfi3.username, password: PASSWORD });
      expect(login.status).toBe(200);
    });

    it('die Stamm-Gemeinde entfernt die Person, das Konto zieht in die weitere um', async () => {
      const res = await request(app).delete(`/api/admin/konfis/${USERS.konfi3.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      expect(res.body.konto_bleibt).toBe(true);
      const { rows: [k] } = await db.query('SELECT organization_id FROM users WHERE id = $1', [USERS.konfi3.id]);
      expect(Number(k.organization_id)).toBe(1);
    });

    it('ohne weitere Gemeinde wird das Konto geloescht (wie bisher)', async () => {
      const res = await request(app).delete(`/api/admin/konfis/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.konto_bleibt).toBeUndefined();
      const { rows } = await db.query('SELECT 1 FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(rows).toHaveLength(0);
    });

    it('verboten: eine Gemeinde, in der die Person nicht Konfi ist -> 404', async () => {
      const res = await request(app).delete(`/api/admin/konfis/${USERS.konfi3.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .set('X-Active-Organization', '1');
      // Erst Mitgliedschaft beenden, dann noch einmal: jetzt nicht mehr dort.
      expect(res.status).toBe(200);
      const nochmal = await request(app).delete(`/api/admin/konfis/${USERS.konfi3.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(nochmal.status).toBe(404);
    });
  });
});
