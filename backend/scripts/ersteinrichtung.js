// backend/scripts/ersteinrichtung.js
//
// Der erste Zugang einer NEUEN Instanz: ein Support-Konto ohne Gemeinde mit
// Super-Admin-Recht.
//
// Anlass (Audit 26.09.2026, Datenbank "Erst-Einrichtung"; durchgespielt am
// 29.09.2026 mit postgres:15-alpine nach der Referenz-Compose): Das Schema
// entsteht vollstaendig, aber leer. Gemeinden legt nur ein Super-Admin an
// (POST /api/organizations), Konten nur eine Leitung -- auf einer frischen
// Instanz gibt es beides nicht, und nichts im Repo beschrieb den Weg hinein.
//
// SEIT 03.10.2026 (Simon: "ja", "wird aber nie vorkommen"): Bis dahin legte
// das Skript eine Gemeinde "Betrieb" mit vier Rollen und einer
// Gemeindeleitung mit Merkmal an -- eine versteckte Betriebs-Gemeinde, wie es
// sie nach Simons Entscheidung 12 (docs/planung/web-version.md) nicht geben
// soll. Jetzt entsteht ein Support-Konto wie ueber
// POST /organizations/support-konten (routes/supportKonten.js): ohne
// Gemeinde, mit der gemeindefreien Systemrolle super_admin (Migration 190)
// und dem Merkmal is_super_admin. Es meldet sich nur im Browser an
// (docs/betrieb/support-konto.md). Die Gemeinden entstehen danach dort --
// mit Abzeichen, Zertifikatstypen und Stufen, wie jede andere auch.
//
// Aufruf IM BACKEND-CONTAINER, nachdem das Backend einmal gestartet ist (dann
// sind alle Migrationen gelaufen, auch 190 mit der Systemrolle):
//   docker exec -e ERST_BENUTZERNAME=... -e ERST_PASSWORT=... \
//     -e ERST_ANZEIGENAME=... [-e ERST_EMAIL=...] \
//     <backend-container> node scripts/ersteinrichtung.js
// Benutzername und Passwort folgen den Regeln der Support-Konten
// (3 bis 50 Zeichen aus Buchstaben, Ziffern, Punkt und Bindestrich;
// utils/passwordUtils.js). Danach im Browser anmelden und das Passwort
// aendern.
//
// Laeuft nur auf einer LEEREN Datenbank: Gibt es schon eine Gemeinde oder
// ein Konto, bricht es ab und aendert nichts.
//
// Eigener Pool (NICHT database.js importieren -- das wuerde Migrationen starten).

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { validatePassword } = require('../utils/passwordUtils');

// Dieselbe Regel wie commonValidations.username (middleware/validation.js),
// die auch POST /organizations/support-konten anwendet.
const BENUTZERNAME = /^[a-zA-Z0-9.-]{3,50}$/;

/**
 * @param {import('pg').Pool} pool
 * @param {{benutzername: string, passwort: string, anzeigename: string, email?: string}} angaben
 * @returns {Promise<{konto: number}>}
 */
async function ersteinrichtung(pool, angaben) {
  const benutzername = (angaben.benutzername || '').trim();
  const anzeigename = (angaben.anzeigename || '').trim();
  const email = (angaben.email || '').trim() || null;
  const passwort = angaben.passwort || '';

  if (!benutzername || !anzeigename) {
    throw new Error('ERST_BENUTZERNAME und ERST_ANZEIGENAME fehlen.');
  }
  if (!BENUTZERNAME.test(benutzername)) {
    throw new Error('ERST_BENUTZERNAME: 3 bis 50 Zeichen, nur Buchstaben, Ziffern, Punkt und Bindestrich.');
  }
  const passwortFehler = validatePassword(passwort);
  if (passwortFehler) throw new Error(`ERST_PASSWORT: ${passwortFehler}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Nur auf einer leeren Datenbank -- auch nicht "nachlegen", wenn schon
    // eine Gemeinde oder ein Konto da ist: Dafuer gibt es die Support-Ansicht.
    const { rows: [bestand] } = await client.query(
      'SELECT (SELECT count(*) FROM organizations)::int AS gemeinden, (SELECT count(*) FROM users)::int AS konten'
    );
    if (bestand.gemeinden > 0 || bestand.konten > 0) {
      throw new Error(
        `Die Datenbank ist nicht leer (${bestand.gemeinden} Gemeinden, ${bestand.konten} Konten). `
        + 'Die Ersteinrichtung laeuft nur auf einer neuen Instanz; weitere Konten und Gemeinden legt ein Super-Admin an.'
      );
    }

    const { rows: [rolle] } = await client.query(
      "SELECT id FROM roles WHERE organization_id IS NULL AND name = 'super_admin'"
    );
    if (!rolle) {
      throw new Error(
        'Die Systemrolle super_admin fehlt (Migration 190). Das Backend einmal starten, damit alle Migrationen laufen, dann erneut aufrufen.'
      );
    }

    const hash = await bcrypt.hash(passwort, 10);
    const { rows: [konto] } = await client.query(
      `INSERT INTO users (organization_id, role_id, username, email, password_hash, display_name, is_active, is_super_admin)
       VALUES (NULL, $1, $2, $3, $4, $5, true, true) RETURNING id`,
      [rolle.id, benutzername, email, hash, anzeigename]
    );

    await client.query('COMMIT');
    return { konto: Number(konto.id) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { ersteinrichtung, BENUTZERNAME };

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write('FEHLER: DATABASE_URL fehlt.\n');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  ersteinrichtung(pool, {
    benutzername: process.env.ERST_BENUTZERNAME,
    passwort: process.env.ERST_PASSWORT,
    anzeigename: process.env.ERST_ANZEIGENAME,
    email: process.env.ERST_EMAIL,
  })
    .then(({ konto }) => {
      process.stdout.write(
        `OK: Support-Konto ${konto} ohne Gemeinde angelegt (Super-Admin).\n`
        + 'Jetzt im Browser anmelden (die Apps nehmen Konten ohne Gemeinde nicht an), '
        + 'das Passwort aendern und die Gemeinden anlegen.\n'
        + (process.env.ERST_GEMEINDE ? 'Hinweis: ERST_GEMEINDE wird nicht mehr gebraucht; es entsteht keine Gemeinde.\n' : '')
      );
      return pool.end().then(() => process.exit(0));
    })
    .catch((err) => {
      process.stderr.write(`FEHLER: ${err.message}\n`);
      return pool.end().then(() => process.exit(1));
    });
}
