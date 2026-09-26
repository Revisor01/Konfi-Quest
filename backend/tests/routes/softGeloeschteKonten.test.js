// Soft-geloeschte Konten kommen nicht mehr hinein
// (Audit 26.09.2026, Sicherheit BF-07, MITTEL).
//
// 60 Tage nach der Konfirmation setzt der Auto-Loeschlauf deleted_at
// (services/backgroundService.js); ab Tag 120 wird hart geloescht. Dazwischen
// blendet der Soft-Delete die Person fuer die Leitung aus -- jede Liste
// filtert deleted_at IS NULL --, liess sie selbst aber weiterarbeiten:
// Login 200, Chat 200, Termine buchen. Socket-Auth und Datei-Auslieferung
// pruefen deleted_at laengst; Login, Refresh und rbac.js taten es nicht.
//
// Jetzt antworten alle drei wie bei einem deaktivierten Konto -- exakt
// dieselbe Antwort, damit sich aus dem Fehler nicht ablesen laesst, dass es
// das Konto noch gibt.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD, JAHRGAENGE } = require('../helpers/seed');
const { generateTokenMitAlter } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const BackgroundService = require('../../services/backgroundService');

describe('Soft-geloeschte Konten werden abgewiesen', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Der Rechte-Cache lebt im Prozess und ueberdauert truncate + seed.
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  afterAll(async () => {
    await closePool();
  });

  const softLoeschen = (userId) =>
    db.query('UPDATE users SET deleted_at = NOW(), archived_at = NOW() WHERE id = $1', [userId]);
  const deaktivieren = (userId) =>
    db.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);

  const login = (userKey) =>
    request(app).post('/api/auth/login').send({ username: USERS[userKey].username, password: PASSWORD });
  const me = (token) =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  const refresh = (refreshToken) =>
    request(app).post('/api/auth/refresh').send({ refresh_token: refreshToken });

  describe('verboten -- deleted_at ist gesetzt', () => {
    it('Login mit richtigem Passwort: 403, dieselbe Antwort wie bei einem deaktivierten Konto', async () => {
      await softLoeschen(USERS.konfi1.id);
      await deaktivieren(USERS.konfi2.id);

      const geloescht = await login('konfi1');
      const deaktiviert = await login('konfi2');

      expect(deaktiviert.status).toBe(403);
      expect(deaktiviert.body.error_code).toBe('user_inactive');
      expect(geloescht.status).toBe(403);
      expect(geloescht.body).toEqual(deaktiviert.body);
    });

    it('Login mit falschem Passwort: 401 wie bei jedem anderen Konto (kein Existenz-Leak)', async () => {
      await softLoeschen(USERS.konfi1.id);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: USERS.konfi1.username, password: 'falsch' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Ungültige Anmeldedaten' });
    });

    it('bestehende Sitzung: 401, dieselbe Antwort wie bei einem deaktivierten Konto', async () => {
      const tokenGeloescht = generateTokenMitAlter('konfi1', 60);
      const tokenDeaktiviert = generateTokenMitAlter('konfi2', 60);
      await softLoeschen(USERS.konfi1.id);
      await deaktivieren(USERS.konfi2.id);

      const geloescht = await me(tokenGeloescht);
      const deaktiviert = await me(tokenDeaktiviert);

      expect(deaktiviert.status).toBe(401);
      expect(geloescht.status).toBe(401);
      expect(geloescht.body).toEqual(deaktiviert.body);
    });

    it('der Auto-Loeschlauf beendet eine laufende Sitzung sofort, auch wenn sie im Rechte-Cache liegt', async () => {
      const token = generateTokenMitAlter('konfi1', 60);
      // Sitzung ist aktiv und liegt danach im 30-Sekunden-Cache von rbac.js.
      expect((await me(token)).status).toBe(200);

      // Konfirmation vor 60 Tagen -> Soft-Delete-Fenster des Auto-Loeschlaufs.
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, mandatory, has_timeslots)
         VALUES (9001, 'Konfirmation', CURRENT_DATE - INTERVAL '60 days', 1, true, false, false, false)`
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (9001, $1)',
        [JAHRGAENGE.jahrgang1.id]
      );
      await BackgroundService.runAutoDeletion(db);

      const { rows: [u] } = await db.query('SELECT deleted_at FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(u.deleted_at).not.toBeNull();

      expect((await me(token)).status).toBe(401);
    });

    it('Refresh: 403, dieselbe Antwort wie bei einem deaktivierten Konto', async () => {
      const paarGeloescht = (await login('konfi1')).body;
      const paarDeaktiviert = (await login('konfi2')).body;
      expect(typeof paarGeloescht.refresh_token).toBe('string');
      expect(typeof paarDeaktiviert.refresh_token).toBe('string');

      await softLoeschen(USERS.konfi1.id);
      await deaktivieren(USERS.konfi2.id);

      const geloescht = await refresh(paarGeloescht.refresh_token);
      const deaktiviert = await refresh(paarDeaktiviert.refresh_token);

      expect(deaktiviert.status).toBe(403);
      expect(deaktiviert.body.error_code).toBe('user_inactive');
      expect(geloescht.status).toBe(403);
      expect(geloescht.body).toEqual(deaktiviert.body);
    });

    it('Refresh eines soft-geloeschten Kontos stellt kein neues Token-Paar aus', async () => {
      const paar = (await login('konfi1')).body;
      await softLoeschen(USERS.konfi1.id);

      const res = await refresh(paar.refresh_token);
      expect(res.status).toBe(403);
      expect(res.body.token).toBeUndefined();
      expect(res.body.refresh_token).toBeUndefined();

      const { rows: [{ gesamt, offen }] } = await db.query(
        `SELECT COUNT(*)::int AS gesamt,
                COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > NOW())::int AS offen
           FROM refresh_tokens WHERE user_id = $1`,
        [USERS.konfi1.id]
      );
      // Nur das Token aus dem Login steht in der Tabelle -- der Refresh hat
      // keines dazugelegt. Und dieses eine ist widerrufen: Die Route rotiert
      // vor der Sperrpruefung, ein gesperrtes Konto behaelt so kein offenes
      // Refresh-Token (wie beim deaktivierten Konto).
      expect(gesamt).toBe(1);
      expect(offen).toBe(0);
    });
  });

  describe('erlaubt -- deleted_at ist NULL', () => {
    it('Login, Sitzung und Refresh funktionieren wie zuvor', async () => {
      const loginRes = await login('konfi1');
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.id).toBe(USERS.konfi1.id);

      const meRes = await me(loginRes.body.token);
      expect(meRes.status).toBe(200);
      expect(meRes.body.id).toBe(USERS.konfi1.id);

      const refreshRes = await refresh(loginRes.body.refresh_token);
      expect(refreshRes.status).toBe(200);
      expect(typeof refreshRes.body.token).toBe('string');
      expect(typeof refreshRes.body.refresh_token).toBe('string');
    });

    it('ein anderes, nicht geloeschtes Konto derselben Gemeinde bleibt unberuehrt', async () => {
      await softLoeschen(USERS.konfi1.id);

      const res = await login('konfi2');
      expect(res.status).toBe(200);
      expect((await me(res.body.token)).status).toBe(200);
    });
  });
});
