// backend/tests/helpers/gemeindeAbdruck.js
//
// Alles, was beim Anlegen einer Gemeinde entsteht, als ein vergleichbares
// Objekt (03.10.2026). Grundlage fuer zwei Pruefungen:
//
//   1. POST /organizations verhaelt sich nach dem Herausloesen der
//      gemeinsamen Funktion (utils/gemeindeAnlegen.js) genau wie vorher:
//      derselbe Abdruck wie vor dem Umbau (Pruefsumme).
//   2. Eine Gemeinde aus einer Anfrage (POST /support/anfragen/:id/anlegen)
//      entsteht genauso wie eine ueber POST /organizations.
//
// Kennungen und Zeitpunkte fallen heraus; Verweise auf das erste Konto der
// Gemeindeleitung stehen als 'leitung', Zeitpunkte relativ zum Anlegen in
// ganzen Tagen. Was je Weg verschieden sein darf (Name, Systemname,
// Benutzername), wird ueber `ersetzen` gleichgezogen.
const crypto = require('crypto');

const TAG_MS = 24 * 60 * 60 * 1000;

/** Tage zwischen zwei Zeitpunkten, gerundet (null bleibt null). */
const tageNach = (zeit, bezug) => (zeit == null ? null : Math.round((new Date(zeit) - new Date(bezug)) / TAG_MS));

async function gemeindeAbdruck(db, orgId) {
  const eine = async (sql) => (await db.query(sql, [orgId])).rows;
  const [org] = await eine('SELECT * FROM organizations WHERE id = $1');
  const [admin] = await eine(
    `SELECT u.id, u.username, u.email, u.display_name, u.is_active, u.is_super_admin,
            u.role_title, u.teamer_since, u.push_enabled, u.bible_translation, r.name AS rolle
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.organization_id = $1 ORDER BY u.id LIMIT 1`);
  const wer = (id) => (id == null ? null : (Number(id) === Number(admin.id) ? 'leitung' : `fremd:${id}`));

  return {
    gemeinde: {
      name: org.name,
      slug: org.slug,
      display_name: org.display_name,
      description: org.description,
      logo_url: org.logo_url,
      contact_name: org.contact_name,
      contact_email: org.contact_email,
      contact_phone: org.contact_phone,
      address: org.address,
      website_url: org.website_url,
      is_active: org.is_active,
      max_konfis: org.max_konfis,
      kirchenkreis: org.kirchenkreis,
      trial_tage: tageNach(org.trial_ends_at, org.created_at),
      is_trial: org.is_trial,
      license_reminder_sent_at: org.license_reminder_sent_at,
    },
    rollen: await eine(
      `SELECT name, display_name, description, is_system_role, is_active
         FROM roles WHERE organization_id = $1 ORDER BY name`),
    leitung: {
      username: admin.username,
      email: admin.email,
      display_name: admin.display_name,
      is_active: admin.is_active,
      is_super_admin: admin.is_super_admin,
      role_title: admin.role_title,
      teamer_since: admin.teamer_since,
      push_enabled: admin.push_enabled,
      bible_translation: admin.bible_translation,
      rolle: admin.rolle,
    },
    konten: (await eine('SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1'))[0].n,
    abzeichen: (await eine(
      `SELECT name, icon, description, criteria_type, criteria_value, criteria_extra, is_active,
              is_hidden, color, target_role, sort_order, created_by
         FROM custom_badges WHERE organization_id = $1 ORDER BY target_role, id`))
      .map((b) => ({ ...b, created_by: wer(b.created_by) })),
    zertifikatstypen: await eine(
      'SELECT name, icon, is_active FROM certificate_types WHERE organization_id = $1 ORDER BY id'),
    stufen: (await eine(
      `SELECT name, title, description, points_required, icon, color, reward_type, reward_value,
              is_active, sort_order, created_by
         FROM levels WHERE organization_id = $1 ORDER BY id`))
      .map((l) => ({ ...l, created_by: wer(l.created_by) })),
    kategorien: await eine(
      'SELECT name, description, type FROM categories WHERE organization_id = $1 ORDER BY id'),
    aktivitaeten: await eine(
      `SELECT a.name, a.points, a.type, a.is_special, a.category, a.target_role,
              COALESCE((SELECT array_agg(c.name ORDER BY c.name)
                          FROM activity_categories ac JOIN categories c ON c.id = ac.category_id
                         WHERE ac.activity_id = a.id), '{}') AS kategorien
         FROM activities a WHERE a.organization_id = $1 ORDER BY a.id`),
    challenges: (await eine(
      `SELECT title, description, challenge_type, visibility, moderated, allowed_media,
              allow_multiple, badge_icon, badge_name, author_user_id, author_freetext,
              created_by, starts_at, ends_at, created_at, is_draft, start_push_sent, audience,
              (SELECT COUNT(*)::int FROM challenge_jahrgang_assignments cja WHERE cja.challenge_id = c.id) AS jahrgaenge
         FROM challenges c WHERE c.organization_id = $1 ORDER BY id`))
      .map(({ starts_at: s, ends_at: e, created_at: c, ...rest }) => ({
        ...rest,
        author_user_id: wer(rest.author_user_id),
        created_by: wer(rest.created_by),
        beginnt_nach_tagen: tageNach(s, c),
        endet_nach_tagen: tageNach(e, c),
      })),
    sonst: (await eine(
      `SELECT (SELECT COUNT(*)::int FROM jahrgaenge WHERE organization_id = $1) AS jahrgaenge,
              (SELECT COUNT(*)::int FROM events WHERE organization_id = $1) AS termine,
              (SELECT COUNT(*)::int FROM chat_rooms WHERE organization_id = $1) AS chats,
              (SELECT COUNT(*)::int FROM user_organizations WHERE organization_id = $1) AS weitere_mitglieder,
              (SELECT COUNT(*)::int FROM settings WHERE organization_id = $1) AS einstellungen`))[0],
  };
}

/** Pruefsumme ueber den Abdruck (stabil: Schluessel sortiert). */
function pruefsumme(abdruck) {
  const sortiert = (wert) => {
    if (Array.isArray(wert)) return wert.map(sortiert);
    if (wert && typeof wert === 'object' && !(wert instanceof Date)) {
      return Object.fromEntries(Object.keys(wert).sort().map((k) => [k, sortiert(wert[k])]));
    }
    return wert;
  };
  return crypto.createHash('sha256').update(JSON.stringify(sortiert(abdruck))).digest('hex');
}

module.exports = { gemeindeAbdruck, pruefsumme };
