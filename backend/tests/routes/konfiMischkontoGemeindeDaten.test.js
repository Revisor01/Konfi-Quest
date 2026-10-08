// backend/tests/routes/konfiMischkontoGemeindeDaten.test.js
//
// Leitung loescht ein Konfi-Konto mit weiterer Gemeinde (Altbestand,
// Simons Entscheidung 8 vom 08.10.2026): Nur die Mitgliedschaft in ihrer
// Gemeinde endet, das Konto bleibt fuer die andere. Bis hierher gingen dabei
// nur Mitgliedschaft, Jahrgaenge, Chat-Plaetze, Postfach, Buchungen und das
// Konfi-Profil -- Aktivitaeten, Bonuspunkte, Antraege samt Foto,
// Challenge-Beitraege samt Datei, Abzeichen und die uebrigen Konfi-Daten
// DIESER Gemeinde blieben liegen (offene Befunde, "Kleine Reste der
// Mehrfach-Konten"). Jetzt geht alles, was die Konfi in dieser Gemeinde
// hinterlassen hat (utils/kontoLoeschen.js, konfiDatenEinerGemeindeLoeschen);
// was sie in der anderen Gemeinde hat, bleibt unberuehrt.
//
// Beide Richtungen: Die weitere Gemeinde beendet ihre Mitgliedschaft, und die
// Stamm-Gemeinde entfernt die Person (das Konto zieht um).
//
// Gegenprobe: Ohne den Aufruf in routes/konfi-management.js fallen beide
// "verboten"-Tests -- die Zeilen der verlassenen Gemeinde stehen noch.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, ORGS, ACTIVITIES, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { REQUESTS_DIR, CHALLENGES_DIR } = require('../../utils/photoStorage');
const { LOESCHREGELN, GEMEINDE_DATEN_KONFI, GEMEINDE_DATEN_ANDERSWO } = require('../../utils/kontoLoeschen');

// konfi3 ist zuhause Konfi in Gemeinde 2 und hat (Altbestand) auch eine
// Konfi-Zeile in Gemeinde 1.
const K = USERS.konfi3;
const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;

const hexName = () => crypto.randomBytes(16).toString('hex');
function legeDateiAn(verzeichnis) {
  const name = hexName();
  fs.mkdirSync(verzeichnis, { recursive: true });
  fs.writeFileSync(path.join(verzeichnis, name), 'Testinhalt');
  return path.join(verzeichnis, name);
}

describe('Konfi-Mischkonto: mit der Mitgliedschaft gehen die Konfi-Daten dieser Gemeinde', () => {
  let app;
  let db;
  let dateien;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach((u) => invalidateUserCache(u.id));
    await db.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [K.id, ORG1, ROLES.konfi.id]);
    dateien = {
      [ORG1]: await legeKonfiDatenAn(ORG1, { aktivitaet: ACTIVITIES.sonntagsgottesdienst.id, event: EVENTS.gottesdienstEvent.id, leitung: USERS.orgAdmin1.id }),
      [ORG2]: await legeKonfiDatenAn(ORG2, { aktivitaet: ACTIVITIES.gottesdienst2.id, event: EVENTS.event2.id, leitung: USERS.orgAdmin2.id }),
    };
  });

  afterEach(() => {
    for (const liste of Object.values(dateien || {})) {
      for (const d of liste) fs.rmSync(d, { force: true });
    }
  });

  // Je Gemeinde eine Zeile in jeder Tabelle mit Konfi-Daten und Gemeinde.
  async function legeKonfiDatenAn(org, { aktivitaet, event, leitung }) {
    const eins = async (sql, params) => (await db.query(sql, params)).rows[0];
    const foto = legeDateiAn(REQUESTS_DIR);
    const beitrag = legeDateiAn(CHALLENGES_DIR);
    const challenge = await eins(
      `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, created_by)
       VALUES ($1, 'Challenge', 'x', 'Stempel', NOW() - interval '1 day', NOW() + interval '7 days', $2) RETURNING id`,
      [org, leitung]);
    const badge = await eins(
      `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, icon, is_active)
       VALUES ('Abzeichen', 'total_points', 1, $1, 'star', true) RETURNING id`, [org]);
    const zertifikat = await eins(
      `INSERT INTO certificate_types (name, organization_id) VALUES ('Urkunde', $1) RETURNING id`, [org]);
    const antrag = await eins(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, photo_filename, organization_id)
       VALUES ($1, $2, CURRENT_DATE, 'pending', $3, $4) RETURNING id`, [K.id, aktivitaet, path.basename(foto), org]);
    // Leitungs-Mitteilung zum Antrag und ueber die Person.
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
       VALUES ($1, 'Neuer Antrag', 'x', 'new_activity_request', $2, $3)`,
      [leitung, JSON.stringify({ request_id: String(antrag.id), konfi_id: String(K.id) }), org]);
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id) VALUES ($1, $2, $3, $4)`,
      [K.id, aktivitaet, leitung, org]);
    await db.query(
      `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
       VALUES ($1, 3, 'gemeinde', 'Mitgeholfen', $2, $3)`, [K.id, leitung, org]);
    await db.query(
      `INSERT INTO event_points (konfi_id, event_id, points, point_type, admin_id, organization_id)
       VALUES ($1, $2, 2, 'gottesdienst', $3, $4)`, [K.id, event, leitung, org]);
    await db.query(
      `INSERT INTO event_unregistrations (user_id, event_id, reason, organization_id) VALUES ($1, $2, 'krank', $3)`,
      [K.id, event, org]);
    await db.query(
      `INSERT INTO event_reminders (event_id, user_id, reminder_type) VALUES ($1, $2, '1_day')`, [event, K.id]);
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3)`, [K.id, badge.id, org]);
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path)
       VALUES ($1, $2, $3, 'photo', $4)`, [challenge.id, K.id, org, path.basename(beitrag)]);
    await db.query(
      `INSERT INTO challenge_read_status (challenge_id, user_id, user_type) VALUES ($1, $2, 'konfi')`, [challenge.id, K.id]);
    await db.query(
      `INSERT INTO bewahrte_stempel (user_id, organization_id, herkunft_challenge_id, title, badge_icon, badge_name)
       VALUES ($1, $2, $3, 'Alt', 'star', 'Stempel')`, [K.id, org, 900 + org]);
    await db.query(
      `INSERT INTO konfi_historie (user_id, organization_id, anlass, daten) VALUES ($1, $2, 'befoerderung', '{}')`, [K.id, org]);
    await db.query(
      `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data) VALUES ($1, $2, 'konfi', 2024 + $2, '{}')`,
      [K.id, org]);
    await db.query(
      `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date, admin_id)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)`, [K.id, zertifikat.id, org, leitung]);
    return [foto, beitrag];
  }

  // Wie viele Zeilen der Person stehen je Tabelle in dieser Gemeinde?
  async function bestand(org) {
    const zaehle = async (sql) => Number((await db.query(sql, [K.id, org])).rows[0].n);
    return {
      activity_requests: await zaehle('SELECT COUNT(*) n FROM activity_requests WHERE user_id = $1 AND organization_id = $2'),
      user_activities: await zaehle('SELECT COUNT(*) n FROM user_activities WHERE user_id = $1 AND organization_id = $2'),
      bonus_points: await zaehle('SELECT COUNT(*) n FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2'),
      event_points: await zaehle('SELECT COUNT(*) n FROM event_points WHERE konfi_id = $1 AND organization_id = $2'),
      event_unregistrations: await zaehle('SELECT COUNT(*) n FROM event_unregistrations WHERE user_id = $1 AND organization_id = $2'),
      event_reminders: await zaehle(
        'SELECT COUNT(*) n FROM event_reminders r JOIN events e ON e.id = r.event_id WHERE r.user_id = $1 AND e.organization_id = $2'),
      user_badges: await zaehle('SELECT COUNT(*) n FROM user_badges WHERE user_id = $1 AND organization_id = $2'),
      challenge_submissions: await zaehle('SELECT COUNT(*) n FROM challenge_submissions WHERE user_id = $1 AND organization_id = $2'),
      challenge_read_status: await zaehle(
        'SELECT COUNT(*) n FROM challenge_read_status s JOIN challenges c ON c.id = s.challenge_id WHERE s.user_id = $1 AND c.organization_id = $2'),
      bewahrte_stempel: await zaehle('SELECT COUNT(*) n FROM bewahrte_stempel WHERE user_id = $1 AND organization_id = $2'),
      konfi_historie: await zaehle('SELECT COUNT(*) n FROM konfi_historie WHERE user_id = $1 AND organization_id = $2'),
      wrapped_snapshots: await zaehle('SELECT COUNT(*) n FROM wrapped_snapshots WHERE user_id = $1 AND organization_id = $2'),
      user_certificates: await zaehle('SELECT COUNT(*) n FROM user_certificates WHERE user_id = $1 AND organization_id = $2'),
      mitteilungen_der_leitung: await zaehle(
        "SELECT COUNT(*) n FROM notifications WHERE data->>'konfi_id' = $1::text AND organization_id = $2"),
    };
  }
  const alleEins = (b) => Object.fromEntries(Object.keys(b).map((k) => [k, 1]));
  const alleNull = (b) => Object.fromEntries(Object.keys(b).map((k) => [k, 0]));
  const dateiDa = (d) => fs.existsSync(d);

  it('Vorbedingung: in beiden Gemeinden steht je eine Zeile', async () => {
    const b1 = await bestand(ORG1);
    expect(b1).toEqual(alleEins(b1));
    const b2 = await bestand(ORG2);
    expect(b2).toEqual(alleEins(b2));
  });

  it('verboten: die weitere Gemeinde beendet die Mitgliedschaft -> ihre Konfi-Daten und Dateien gehen', async () => {
    const res = await request(app).delete(`/api/admin/konfis/${K.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    await warteAufNachwehen(app);
    expect(res.status).toBe(200);
    expect(res.body.konto_bleibt).toBe(true);

    const b1 = await bestand(ORG1);
    expect(b1).toEqual(alleNull(b1));
    expect(dateien[ORG1].map(dateiDa)).toEqual([false, false]);
  });

  it('erlaubt: dabei bleibt alles der Stamm-Gemeinde stehen, samt Dateien', async () => {
    const res = await request(app).delete(`/api/admin/konfis/${K.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    await warteAufNachwehen(app);
    expect(res.status).toBe(200);

    const b2 = await bestand(ORG2);
    expect(b2).toEqual(alleEins(b2));
    expect(dateien[ORG2].map(dateiDa)).toEqual([true, true]);
    const { rows: [profil] } = await db.query('SELECT organization_id FROM konfi_profiles WHERE user_id = $1', [K.id]);
    expect(Number(profil.organization_id)).toBe(ORG2);
  });

  it('verboten: die Stamm-Gemeinde entfernt die Person -> ihre Konfi-Daten gehen; erlaubt: die der weiteren bleiben', async () => {
    const res = await request(app).delete(`/api/admin/konfis/${K.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
    await warteAufNachwehen(app);
    expect(res.status).toBe(200);
    expect(res.body.konto_bleibt).toBe(true);

    const b2 = await bestand(ORG2);
    expect(b2).toEqual(alleNull(b2));
    expect(dateien[ORG2].map(dateiDa)).toEqual([false, false]);
    const b1 = await bestand(ORG1);
    expect(b1).toEqual(alleEins(b1));
    expect(dateien[ORG1].map(dateiDa)).toEqual([true, true]);
  });

  it('Waechter: jede Loesch-Spalte mit Gemeinde ist zugeordnet', async () => {
    // Kommt eine Tabelle mit Personenbezug UND organization_id dazu, muss
    // entschieden werden, ob sie beim Ende einer Konfi-Mitgliedschaft mitgeht
    // (GEMEINDE_DATEN_KONFI) oder anderswo geraeumt wird
    // (GEMEINDE_DATEN_ANDERSWO).
    const { rows } = await db.query(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name = 'organization_id'`);
    const mitGemeinde = new Set(rows.map((r) => r.table_name));
    const zuLoeschen = Object.entries(LOESCHREGELN)
      .filter(([spalte, regel]) => regel === 'loeschen' && mitGemeinde.has(spalte.split('.')[0]))
      .map(([spalte]) => spalte);
    const zugeordnet = new Set([...Object.keys(GEMEINDE_DATEN_KONFI), ...GEMEINDE_DATEN_ANDERSWO]);
    expect(zuLoeschen.filter((s) => !zugeordnet.has(s))).toEqual([]);
  });
});
