// backend/tests/helpers/vollePerson.js
//
// Eine Person, die in JEDER Tabelle mit Personenbezug vorkommt -- fuer den
// Waechter "Konto loeschen loescht wirklich alles" (Simon, 28.09.2026) und die
// Tests je Loeschweg (tests/utils/kontoLoeschen.test.js,
// tests/routes/kontoLoeschenWege.test.js).
//
// legeVollePersonAn schreibt fuer jede Fremdschluessel-Spalte auf users
// mindestens eine Zeile, die auf die Person zeigt: als Eigentum (Buchung,
// Nachricht, Antrag ...) und als Urheberschaft an Dingen der Gemeinde oder
// anderer (Event angelegt, Punkte vergeben, Notiz gesetzt ...). Dazu das, was
// ohne Fremdschluessel an ihr haengt: Zaehler der Anmeldesperre, Mitteilungen
// UEBER sie bei der Leitung, ein Zweiergespraech mit ihrem Namen, Dateien auf
// der Platte.
//
// alleSpaltenBelegt prueft VOR der Loeschung, dass das wirklich so ist --
// kommt eine neue Spalte dazu, faellt der Test, bis sie hier eine Zeile
// bekommt. pruefeNachLoeschung prueft danach, dass nichts mehr auf die Person
// zeigt und dass die Dinge der Gemeinde stehen geblieben sind.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REQUESTS_DIR, CHALLENGES_DIR, CHAT_DIR } = require('../../utils/photoStorage');
const { LOESCHREGELN, fremdschluesselAufUsers } = require('../../utils/kontoLoeschen');

const ORG = 1;
const ANDERE_ORG = 2;
const JAHRGANG = 1;
// Gegenueber der Person: admin1 (Org 1) und konfi2. Beide werden in keinem
// der Tests geloescht.
const GEGENUEBER = 4;
const ANDERE_KONFI = 2;
// Rollen aus dem Seed: teamer in Org 2, org_admin in Org 2.
const TEAMER_ANDERE_ORG = 7;
const ORGADMIN_ANDERE_ORG = 9;
const TEAMER2 = 7; // Benutzer teamer2 (Org 2)

const hexName = () => crypto.randomBytes(32).toString('hex');

function legeDateiAn(verzeichnis, name) {
  fs.mkdirSync(verzeichnis, { recursive: true });
  fs.writeFileSync(path.join(verzeichnis, name), 'Testinhalt');
  return { verzeichnis, name };
}

const dateiDa = ({ verzeichnis, name }) => fs.existsSync(path.join(verzeichnis, name));

/**
 * @param {object} db  Test-Pool
 * @param {number} P   Kennung der Person
 * @param {object} [opt]
 * @param {boolean} [opt.weitereGemeinde=true]  Mitgliedschaft in Org 2 anlegen.
 *   DELETE /users/:id loescht ein Konto mit weiterer Gemeinde nicht, es zieht
 *   um (Simon, 27.09.2026) -- fuer diesen Weg ohne.
 */
async function legeVollePersonAn(db, P, { weitereGemeinde = true } = {}) {
  const eins = async (sql, params) => (await db.query(sql, params)).rows[0];
  const { rows: [person] } = await db.query(
    `SELECT u.username, u.display_name, r.name AS rolle
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [P]
  );
  const typ = person.rolle === 'konfi' ? 'konfi' : person.rolle === 'teamer' ? 'teamer' : 'admin';

  // Was stehen bleiben muss -- je Spalte die Kennungen der Zeilen.
  const bleibt = {};
  const merke = (spalte, id) => { (bleibt[spalte] = bleibt[spalte] || []).push(Number(id)); };
  const dateien = { eigene: [], zweierraum: [], fremde: [] };

  // ---------------- Grundlagen ----------------
  const fremdeChallenge = await eins(
    `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, created_by)
     VALUES ($1, 'Fremde Challenge', 'x', 'Stempel', NOW() - interval '1 day', NOW() + interval '7 days', $2)
     RETURNING id`, [ORG, GEGENUEBER]);
  const fremdeNachricht = await eins(
    `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (1, $1, 'admin', 'Wer kommt mit?') RETURNING id`,
    [GEGENUEBER]);
  const umfrage = await eins(
    `INSERT INTO chat_polls (message_id, question, options) VALUES ($1, 'Pizza?', '["ja","nein"]') RETURNING id`,
    [fremdeNachricht.id]);
  const zertifikat = await eins(
    `INSERT INTO certificate_types (name, organization_id) VALUES ('JuLeiCa', $1) RETURNING id`, [ORG]);

  // ---------------- was zur Person gehoert ----------------
  const foto = legeDateiAn(REQUESTS_DIR, hexName());
  dateien.eigene.push(foto);
  const antrag = await eins(
    `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, photo_filename, organization_id)
     VALUES ($1, 1, CURRENT_DATE, 'pending', $2, $3) RETURNING id`, [P, foto.name, ORG]);
  await db.query(
    `INSERT INTO bewahrte_stempel (user_id, organization_id, herkunft_challenge_id, title, badge_icon, badge_name)
     VALUES ($1, $2, 999, 'Alte Challenge', 'star', 'Stempel')`, [P, ORG]);
  await db.query(
    `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
     VALUES ($1, 2, 'gemeinde', 'Mitgebracht', $2, $3)`, [P, GEGENUEBER, ORG]);
  await db.query(
    `INSERT INTO challenge_read_status (challenge_id, user_id, user_type) VALUES ($1, $2, $3)`,
    [fremdeChallenge.id, P, typ]);
  const beitragsdatei = legeDateiAn(CHALLENGES_DIR, hexName());
  dateien.eigene.push(beitragsdatei);
  await db.query(
    `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path)
     VALUES ($1, $2, $3, 'photo', $4)`, [fremdeChallenge.id, P, ORG, beitragsdatei.name]);
  await db.query(
    `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (1, $1, $2) ON CONFLICT DO NOTHING`, [P, typ]);
  await db.query(
    `INSERT INTO chat_message_reactions (message_id, user_id, user_type, emoji) VALUES ($1, $2, $3, 'daumen')`,
    [fremdeNachricht.id, P, typ]);
  const anhang = legeDateiAn(CHAT_DIR, hexName());
  dateien.eigene.push(anhang);
  const eigeneNachricht = await eins(
    `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
     VALUES (1, $1, $2, 'Mein Bild', 'image', $3, 'bild.jpg') RETURNING id`, [P, typ, anhang.name]);
  // Eine Antwort der Leitung auf die Nachricht der Person: bleibt, ohne Zitat.
  const antwort = await eins(
    `INSERT INTO chat_messages (room_id, user_id, user_type, content, reply_to) VALUES (1, $1, 'admin', 'Schoen!', $2) RETURNING id`,
    [GEGENUEBER, eigeneNachricht.id]);
  await db.query(
    `INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index) VALUES ($1, $2, $3, 0)`,
    [umfrage.id, P, typ]);
  await db.query(
    `INSERT INTO chat_read_status (room_id, user_id, user_type) VALUES (1, $1, $2)`, [P, typ]);
  await db.query(
    `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, 1, 'confirmed', $2)`, [P, ORG]);
  await db.query(
    `INSERT INTO event_points (konfi_id, event_id, points, point_type, admin_id, organization_id)
     VALUES ($1, 1, 2, 'gottesdienst', $2, $3)`, [P, GEGENUEBER, ORG]);
  await db.query(
    `INSERT INTO event_reminders (event_id, user_id, reminder_type) VALUES (1, $1, '1_day')`, [P]);
  await db.query(
    `INSERT INTO event_unregistrations (user_id, event_id, reason, organization_id) VALUES ($1, 2, 'krank', $2)`, [P, ORG]);
  await db.query(
    `INSERT INTO konfi_historie (user_id, organization_id, anlass, daten) VALUES ($1, $2, 'befoerderung', '{}')`, [P, ORG]);
  await db.query(
    `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
     VALUES ($1, $2, 0, 0, $3) ON CONFLICT (user_id) DO NOTHING`, [P, JAHRGANG, ORG]);
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, organization_id) VALUES ($1, 'Eigene', 'x', 'bonus_points', $2)`, [P, ORG]);
  await db.query(
    `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + interval '14 days')`, [ANDERE_ORG, P, TEAMER_ANDERE_ORG, ORGADMIN_ANDERE_ORG]);
  await db.query(
    `INSERT INTO password_resets (user_id, user_type, token, expires_at) VALUES ($1, $2, $3, NOW() + interval '1 hour')`,
    [P, typ, hexName()]);
  await db.query(
    `INSERT INTO push_tokens (user_id, user_type, token, platform, device_id) VALUES ($1, $2, $3, 'ios', 'geraet')`,
    [P, typ, hexName()]);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + interval '1 day')`, [P, hexName()]);
  await db.query(
    `INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id) VALUES ($1, 1, $2, $3)`, [P, GEGENUEBER, ORG]);
  await db.query(
    `INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, 1, $2) ON CONFLICT DO NOTHING`, [P, ORG]);
  await db.query(
    `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date, admin_id)
     VALUES ($1, $2, $3, CURRENT_DATE, $4)`, [P, zertifikat.id, ORG, GEGENUEBER]);
  await db.query(
    `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [P, JAHRGANG]);
  if (weitereGemeinde) {
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [P, ANDERE_ORG, TEAMER_ANDERE_ORG]);
    // Was sie in der weiteren Gemeinde hinterlassen hat -- auch mit Dateien.
    // Bis zum 28.09.2026 sammelten die Loeschwege Dateien nur in der
    // Stamm-Gemeinde ein.
    const fotoAnderswo = legeDateiAn(REQUESTS_DIR, hexName());
    dateien.eigene.push(fotoAnderswo);
    await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, photo_filename, organization_id)
       VALUES ($1, 5, CURRENT_DATE, 'pending', $2, $3)`, [P, fotoAnderswo.name, ANDERE_ORG]);
    const challengeAnderswo = await eins(
      `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, created_by)
       VALUES ($1, 'Challenge anderswo', 'x', 'Stempel', NOW() - interval '1 day', NOW() + interval '7 days', $2)
       RETURNING id`, [ANDERE_ORG, ORGADMIN_ANDERE_ORG]);
    const beitragAnderswo = legeDateiAn(CHALLENGES_DIR, hexName());
    dateien.eigene.push(beitragAnderswo);
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, file_path)
       VALUES ($1, $2, $3, 'audio', $4)`, [challengeAnderswo.id, P, ANDERE_ORG, beitragAnderswo.name]);
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, 4, 'confirmed', $2)`,
      [P, ANDERE_ORG]);
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id) VALUES ($1, 5, $2, $3)`,
      [P, ORGADMIN_ANDERE_ORG, ANDERE_ORG]);
  }
  await db.query(
    `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data) VALUES ($1, $2, 'teamer', 2026, '{}')`,
    [P, ORG]);

  // Zweiergespraech mit der Leitung. Der Raum traegt den Namen der Person
  // (so legt POST /chat/direct ihn an), darin eine Datei der Leitung.
  const zweierraum = await eins(
    `INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ($1, 'direct', $2, $3) RETURNING id`,
    [person.display_name, GEGENUEBER, ORG]);
  await db.query(
    `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3), ($1, $4, 'admin')`,
    [zweierraum.id, P, typ, GEGENUEBER]);
  const leitungsdatei = legeDateiAn(CHAT_DIR, hexName());
  dateien.zweierraum.push(leitungsdatei);
  await db.query(
    `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
     VALUES ($1, $2, 'admin', 'Hier das Formular', 'file', $3, 'formular.pdf')`,
    [zweierraum.id, GEGENUEBER, leitungsdatei.name]);

  // ---------------- was der Gemeinde oder anderen gehoert ----------------
  merke('activity_requests.approved_by', (await eins(
    `INSERT INTO activity_requests (user_id, activity_id, status, approved_by, admin_comment, organization_id)
     VALUES ($1, 1, 'approved', $2, 'Gut gemacht', $3) RETURNING id`, [ANDERE_KONFI, P, ORG])).id);
  merke('bonus_points.admin_id', (await eins(
    `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
     VALUES ($1, 1, 'gemeinde', 'Vergeben von der Person', $2, $3) RETURNING id`, [ANDERE_KONFI, P, ORG])).id);
  const moderiert = await eins(
    `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, approved_by, hidden_by)
     VALUES ($1, $2, $3, 'text', 'Beitrag', $4::int, $4::int) RETURNING id`, [fremdeChallenge.id, ANDERE_KONFI, ORG, P]);
  merke('challenge_submissions.approved_by', moderiert.id);
  merke('challenge_submissions.hidden_by', moderiert.id);
  const eigeneChallenge = await eins(
    `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, created_by, author_user_id)
     VALUES ($1, 'Challenge der Person', 'x', 'Stempel', NOW(), NOW() + interval '7 days', $2::int, $2::int) RETURNING id`, [ORG, P]);
  merke('challenges.created_by', eigeneChallenge.id);
  merke('challenges.author_user_id', eigeneChallenge.id);
  const gruppe = await eins(
    `INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ('Gruppe', 'group', $1, $2) RETURNING id`, [P, ORG]);
  await db.query(
    `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3), ($1, $4, 'admin')`,
    [gruppe.id, P, typ, GEGENUEBER]);
  merke('chat_rooms.created_by', gruppe.id);
  merke('custom_badges.created_by', (await eins(
    `INSERT INTO custom_badges (name, criteria_type, criteria_value, created_by, organization_id)
     VALUES ('Badge der Person', 'total_points', 5, $1, $2) RETURNING id`, [P, ORG])).id);
  const fremdeBuchung = await eins(
    `INSERT INTO event_bookings (user_id, event_id, status, organization_id, attendance_status, attendance_set_by,
                                 attendance_note, note_set_by)
     VALUES ($1, 1, 'confirmed', $2, 'present', $3::int, 'Hat geholfen', $3::int) RETURNING id`, [ANDERE_KONFI, ORG, P]);
  merke('event_bookings.attendance_set_by', fremdeBuchung.id);
  merke('event_bookings.note_set_by', fremdeBuchung.id);
  merke('event_points.admin_id', (await eins(
    `INSERT INTO event_points (konfi_id, event_id, points, point_type, admin_id, organization_id)
     VALUES ($1, 1, 2, 'gottesdienst', $2, $3) RETURNING id`, [ANDERE_KONFI, P, ORG])).id);
  const eigenesEvent = await eins(
    `INSERT INTO events (name, event_date, organization_id, created_by, cancelled, cancelled_by,
                         cancelled_reason, cancelled_reason_set_by)
     VALUES ('Event der Person', NOW() + interval '3 days', $1, $2::int, true, $2::int, 'Regen', $2::int) RETURNING id`, [ORG, P]);
  merke('events.created_by', eigenesEvent.id);
  merke('events.cancelled_by', eigenesEvent.id);
  merke('events.cancelled_reason_set_by', eigenesEvent.id);
  merke('invite_codes.created_by', (await eins(
    `INSERT INTO invite_codes (code, organization_id, jahrgang_id, created_by, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + interval '7 days') RETURNING id`,
    [crypto.randomBytes(4).toString('hex').toUpperCase(), ORG, JAHRGANG, P])).id);
  merke('konfi_historie.erstellt_von', (await eins(
    `INSERT INTO konfi_historie (user_id, organization_id, anlass, daten, erstellt_von)
     VALUES ($1, $2, 'befoerderung', '{}', $3) RETURNING id`, [ANDERE_KONFI, ORG, P])).id);
  merke('levels.created_by', (await eins(
    `INSERT INTO levels (organization_id, name, title, points_required, created_by)
     VALUES ($1, 'meister', 'Meister', 99, $2) RETURNING id`, [ORG, P])).id);
  merke('materials.created_by', (await eins(
    `INSERT INTO materials (title, organization_id, created_by) VALUES ('Material der Person', $1, $2) RETURNING id`,
    [ORG, P])).id);
  merke('org_einladungen.eingeladen_von', (await eins(
    `INSERT INTO org_einladungen (organization_id, user_id, role_id, eingeladen_von, expires_at)
     VALUES ($1, $2, 2, $3, NOW() + interval '14 days') RETURNING id`, [ORG, TEAMER2, P])).id);
  merke('user_activities.admin_id', (await eins(
    `INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id) VALUES ($1, 1, $2, $3) RETURNING id`,
    [ANDERE_KONFI, P, ORG])).id);
  merke('user_certificates.admin_id', (await eins(
    `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date, admin_id)
     VALUES ($1, $2, $3, CURRENT_DATE, $4) RETURNING id`, [GEGENUEBER, zertifikat.id, ORG, P])).id);
  merke('user_jahrgang_assignments.assigned_by', (await eins(
    `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, assigned_by) VALUES ($1, $2, $3) RETURNING id`,
    [GEGENUEBER, JAHRGANG, P])).id);
  const ausgabe = await eins(
    `INSERT INTO wrapped_ausgaben (organization_id, wrapped_type, titel, zeitraum_start, zeitraum_ende,
                                   freigegeben_at, freigegeben_von, erstellt_von)
     VALUES ($1, 'teamer', 'Team-Rückblick', '2026-01-01', '2026-09-01', NOW(), $2::int, $2::int) RETURNING id`, [ORG, P]);
  merke('wrapped_ausgaben.erstellt_von', ausgabe.id);
  merke('wrapped_ausgaben.freigegeben_von', ausgabe.id);
  // Eine Anfrage vom Formular, die die Person (als Support) zuletzt
  // bearbeitet hat (Migration 191).
  merke('gemeinde_anfragen.bearbeitet_von', (await eins(
    `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, bearbeitet_von)
     VALUES ('Kirchengemeinde Probe', 'Pastorin Probe', 'probe@example.test', NOW(), 'in_arbeit', $1) RETURNING id`,
    [P])).id);

  // ---------------- ohne Fremdschluessel ----------------
  // Zaehler der Anmeldesperre (utils/kontoSperre.js): Hash ueber den Namen.
  await db.query(
    `INSERT INTO rate_limit_zaehler (schluessel, treffer, ablauf)
     SELECT 'konto:' || encode(sha256(convert_to(LOWER(username), 'UTF8')), 'hex'), 3, NOW() + interval '1 hour'
       FROM users WHERE id = $1`, [P]);
  // Mitteilungen UEBER die Person bei der Leitung -- und eine ueber jemand
  // anderen, die bleiben muss.
  await db.query(
    `INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES
       ($1, 'Neue Registrierung', $2, 'new_konfi_registration', $3, $5),
       ($1, 'Neuer Antrag', $2, 'new_activity_request', $4, $5),
       ($1, 'Neuer Beitrag', $2, 'challenge_submission', $6, $5)`,
    [GEGENUEBER, person.display_name,
      JSON.stringify({ konfi_id: P }), JSON.stringify({ request_id: antrag.id }), ORG,
      JSON.stringify({ user_id: P })]);
  const fremdeMitteilung = await eins(
    `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
     VALUES ($1, 'Neue Registrierung', 'Test Konfi 2', 'new_konfi_registration', $2, $3) RETURNING id`,
    [GEGENUEBER, JSON.stringify({ konfi_id: ANDERE_KONFI }), ORG]);
  // Eine Datei einer anderen Person, die nichts mit ihr zu tun hat.
  const fremdeDatei = legeDateiAn(CHAT_DIR, hexName());
  dateien.fremde.push(fremdeDatei);
  await db.query(
    `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, file_path, file_name)
     VALUES (1, $1, 'konfi', 'Mein Foto', 'image', $2, 'foto.jpg')`, [ANDERE_KONFI, fremdeDatei.name]);

  return {
    person: { id: P, ...person },
    bleibt,
    dateien,
    ids: {
      zweierraum: Number(zweierraum.id),
      gruppe: Number(gruppe.id),
      antwort: Number(antwort.id),
      umfrage: Number(umfrage.id),
      fremdeMitteilung: Number(fremdeMitteilung.id),
    },
  };
}

/** Spalten, in denen VOR der Loeschung keine Zeile auf die Person zeigt. */
async function unbelegteSpalten(db, P, { ausser = [] } = {}) {
  const spalten = await fremdschluesselAufUsers(db);
  const leer = [];
  for (const spalte of spalten) {
    if (ausser.includes(spalte)) continue;
    const [tabelle, feld] = spalte.split('.');
    const { rows: [z] } = await db.query(`SELECT COUNT(*)::int AS n FROM ${tabelle} WHERE ${feld} = $1`, [P]);
    if (z.n === 0) leer.push(spalte);
  }
  return leer;
}

/** Spalten, in denen NACH der Loeschung noch eine Zeile auf die Person zeigt. */
async function restVerweise(db, P) {
  const spalten = await fremdschluesselAufUsers(db);
  const rest = [];
  for (const spalte of spalten) {
    const [tabelle, feld] = spalte.split('.');
    const { rows: [z] } = await db.query(`SELECT COUNT(*)::int AS n FROM ${tabelle} WHERE ${feld} = $1`, [P]);
    if (z.n > 0) rest.push(`${spalte} (${z.n})`);
  }
  return rest;
}

/**
 * Alles, was nach der Loeschung gelten muss -- als ein Objekt, damit ein
 * Fehlschlag alle Abweichungen auf einmal zeigt.
 */
async function befundNachLoeschung(db, voll) {
  const P = voll.person.id;
  const zahl = async (sql, params) => (await db.query(sql, params)).rows[0].n;

  // Die Dinge der Gemeinde: Zeile noch da, Verweis NULL.
  const verschwunden = [];
  const nichtGenullt = [];
  for (const [spalte, ids] of Object.entries(voll.bleibt)) {
    const [tabelle, feld] = spalte.split('.');
    for (const id of ids) {
      const { rows } = await db.query(`SELECT ${feld} AS wert FROM ${tabelle} WHERE id = $1`, [id]);
      if (rows.length === 0) verschwunden.push(`${spalte}#${id}`);
      else if (rows[0].wert !== null) nichtGenullt.push(`${spalte}#${id}`);
    }
  }
  // Jede 'nullen'-Regel muss hier geprueft worden sein.
  const ungeprueft = Object.entries(LOESCHREGELN)
    .filter(([s, r]) => r === 'nullen' && !voll.bleibt[s])
    .map(([s]) => s);

  return {
    konto: await zahl('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [P]),
    restVerweise: await restVerweise(db, P),
    verschwunden,
    nichtGenullt,
    ungeprueft,
    anmeldesperre: await zahl(
      `SELECT COUNT(*)::int AS n FROM rate_limit_zaehler
        WHERE schluessel = 'konto:' || encode(sha256(convert_to(LOWER($1::text), 'UTF8')), 'hex')`,
      [voll.person.username]),
    mitteilungenUeberPerson: await zahl(
      `SELECT COUNT(*)::int AS n FROM notifications WHERE message = $1`, [voll.person.display_name]),
    fremdeMitteilung: await zahl('SELECT COUNT(*)::int AS n FROM notifications WHERE id = $1', [voll.ids.fremdeMitteilung]),
    raeumeMitNamen: await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE name = $1', [voll.person.display_name]),
    zweierraum: await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE id = $1', [voll.ids.zweierraum]),
    gruppe: await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE id = $1', [voll.ids.gruppe]),
    antwortOhneZitat: await zahl(
      'SELECT COUNT(*)::int AS n FROM chat_messages WHERE id = $1 AND reply_to IS NULL', [voll.ids.antwort]),
    stimmenInUmfrage: await zahl('SELECT COUNT(*)::int AS n FROM chat_poll_votes WHERE poll_id = $1', [voll.ids.umfrage]),
    eigeneDateien: voll.dateien.eigene.filter(dateiDa).length,
    dateienImZweierraum: voll.dateien.zweierraum.filter(dateiDa).length,
    fremdeDateien: voll.dateien.fremde.filter(dateiDa).length,
  };
}

/** Der Befund, wenn alles stimmt. */
function erwarteterBefund(voll) {
  return {
    konto: 0,
    restVerweise: [],
    verschwunden: [],
    nichtGenullt: [],
    ungeprueft: [],
    anmeldesperre: 0,
    mitteilungenUeberPerson: 0,
    fremdeMitteilung: 1,
    raeumeMitNamen: 0,
    zweierraum: 0,
    gruppe: 1,
    antwortOhneZitat: 1,
    stimmenInUmfrage: 0,
    eigeneDateien: 0,
    dateienImZweierraum: 0,
    fremdeDateien: voll.dateien.fremde.length,
  };
}

/** Raeumt die Testdateien weg, die stehen bleiben durften. */
function dateienAufraeumen(voll) {
  if (!voll) return;
  for (const d of [...voll.dateien.eigene, ...voll.dateien.zweierraum, ...voll.dateien.fremde]) {
    try { fs.unlinkSync(path.join(d.verzeichnis, d.name)); } catch { /* schon weg */ }
  }
}

module.exports = {
  legeVollePersonAn,
  unbelegteSpalten,
  restVerweise,
  befundNachLoeschung,
  erwarteterBefund,
  dateienAufraeumen,
  dateiDa,
  hexName,
  legeDateiAn,
};
