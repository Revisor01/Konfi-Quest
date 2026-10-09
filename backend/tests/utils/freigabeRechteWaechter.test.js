// backend/tests/utils/freigabeRechteWaechter.test.js
//
// Waechter fuer „Darf freigeben" (09.10.2026): Liste (Feld darf_...),
// Zaehler (badge-counts), App-Symbol, Push-Empfaenger und Server-Pruefung
// lesen je Vorgang DIESELBE Regel-Stelle (utils/freigabeRechte.js plus die
// Bedingung des Vorgangs in antrag-/termin-/challengeLeitungSicht.js). Laeuft
// eine Stelle an ihr vorbei -- rechnet etwa wieder mit den can_view-
// Jahrgaengen statt mit denen des Rechts --, widersprechen sich die Stellen
// in mindestens einem Feld der Matrix unten, und der Test faellt.
//
// Dazu ein statischer Teil: Die drei Spalten liest nur, wer sie laden oder
// schreiben muss; jede Stelle, die Leitungs-Zahlen oder -Empfaenger fuer die
// drei Vorgaenge bestimmt, bindet die Regel-Stelle ein.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');
const { appIconSummenAllerGemeinden } = require('../../utils/appIconBadge');
const { ladeLeitungZumAntrag, darfAntragEntscheiden } = require('../../utils/antragLeitungSicht');
const { zaehleWartendeTermineJeLeitung, darfTerminVerbuchen } = require('../../utils/terminLeitungSicht');
const { ladeLeitungZumChallengeBeitrag, darfChallengeFreigeben } = require('../../utils/challengeLeitungSicht');

const BACKEND = path.join(__dirname, '..', '..');
const ORG1 = ORGS.testGemeinde.id;
const J1 = JAHRGAENGE.jahrgang1.id;
const J_ZWEI = 92;

describe('Waechter: eine Regel-Stelle je Vorgang', () => {
  describe('statisch', () => {
    const SPALTEN = /darf_antraege_entscheiden|darf_events_verbuchen|darf_challenges_freigeben/;
    const dateien = (ordner) => fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
      const voll = path.join(ordner, e.name);
      if (e.isDirectory()) return dateien(voll);
      return e.name.endsWith('.js') ? [voll] : [];
    });

    it('die drei Spalten nennt nur, wer sie laden oder schreiben muss', () => {
      const alle = ['routes', 'services', 'utils', 'middleware'].flatMap((o) => dateien(path.join(BACKEND, o)));
      const treffer = alle.filter((f) => SPALTEN.test(fs.readFileSync(f, 'utf8')))
        .map((f) => path.relative(BACKEND, f)).sort();
      expect(treffer).toEqual([
        'middleware/rbac.js',           // laedt sie in req.user.assigned_jahrgaenge
        'routes/users.js',              // liefert sie an der Zuweisung aus
        'utils/freigabeRechte.js',      // DIE Stelle, die sie auswertet
        'utils/orgMitglieder.js'        // laedt sie je Gemeinde fuers App-Symbol
      ]);
    });

    it('jede Stelle mit Leitungs-Zahlen oder -Empfaengern bindet die Regel-Stelle ein', () => {
      const stellen = [
        'routes/notifications.js',        // badge-counts
        'utils/appIconBadge.js',          // App-Symbol, Gemeinde-Umschalter
        'utils/antragLeitungSicht.js',    // Antraege: Empfaenger, Pruefung, Feld
        'utils/terminLeitungSicht.js',    // Verbuchen: Erinnerung, Pruefung, Feld
        'utils/challengeLeitungSicht.js'  // Freigaben: Push, Pruefung, Feld
      ];
      const ohne = stellen.filter((f) => !/require\(['"][./]+(utils\/)?freigabeRechte['"]\)/
        .test(fs.readFileSync(path.join(BACKEND, f), 'utf8')));
      expect(ohne).toEqual([]);
    });
  });

  describe('alle Stellen sagen dasselbe', () => {
    let app;
    let db;

    beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
    afterAll(async () => { await closePool(); });

    // Die Lagen eines Admins: [Name, Zuweisungen [Jahrgang, Recht]]
    const LAGEN = [
      ['ohne Zuweisung', []],
      ['J1 mit Recht', [[J1, true]]],
      ['J1 ohne Recht', [[J1, false]]],
      ['J1 ohne, zweiter Jahrgang mit Recht', [[J1, false], [J_ZWEI, true]]]
    ];

    // person: 'admin1' oder (seit 09.10.2026, nur Challenges) 'teamer1' --
    // deren Seed-Zuweisung an J1 wird ersetzt; can_edit wie im Normalfall
    // der Teamer:innen false.
    async function aufbauen(zuweisungen, spalte, person = 'admin1') {
      await truncateAll(db);
      await seed(db);
      await db.query(
        `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, 'Zweiter', $2, '2027-05-01')`,
        [J_ZWEI, ORG1]
      );
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS[person].id]);
      for (const [jg, recht] of zuweisungen) {
        await db.query(
          `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit, ${spalte})
           VALUES ($1, $2, true, $4, $3)`,
          [USERS[person].id, jg, recht, person === 'admin1']
        );
      }
      for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    }

    let person = 'admin1';
    const auth = () => ({ Authorization: `Bearer ${generateToken(person)}` });
    const req = { user: null };
    async function reqUser() {
      // Derselbe req.user wie in den Routen (rbac.js), ueber /api/auth/me waere
      // es dieselbe Abfrage -- hier direkt aus der Middleware.
      const { verifyTokenRBAC } = require('../../middleware/rbac');
      const fake = { headers: { authorization: auth().Authorization }, get: () => undefined, header: () => undefined };
      await new Promise((resolve, reject) => {
        verifyTokenRBAC(db)(fake, { status: () => ({ json: (b) => reject(new Error(JSON.stringify(b))) }) }, resolve);
      });
      req.user = fake.user;
      return req;
    }
    const symbol = async () => (await appIconSummenAllerGemeinden(db, [USERS[person].id])).get(USERS[person].id).jeOrganisation.get(ORG1);
    const zaehler = async () => (await request(app).get('/api/notifications/badge-counts').set(auth())).body;
    beforeEach(() => { person = 'admin1'; });

    for (const [lage, zuweisungen] of LAGEN) {
      for (const teamer of [false, true]) {
        it(`Antrag ${teamer ? 'einer Teamer:in' : 'einer Konfi'} -- ${lage}`, async () => {
          await aufbauen(zuweisungen, 'darf_antraege_entscheiden');
          let activityId = ACTIVITIES.sonntagsgottesdienst.id;
          if (teamer) {
            ({ rows: [{ id: activityId }] } = await db.query(
              `INSERT INTO activities (name, points, type, organization_id, target_role)
               VALUES ('T', 0, 'gemeinde', $1, 'teamer') RETURNING id`, [ORG1]));
          }
          const { rows: [{ id }] } = await db.query(
            `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
             VALUES ($1, $2, '2026-06-01', 'pending', $3) RETURNING id`,
            [teamer ? USERS.teamer1.id : USERS.konfi1.id, activityId, ORG1]);

          const liste = (await request(app).get('/api/admin/activities/requests?status=pending').set(auth())).body;
          const feld = (liste.find((a) => a.id === id) || {}).darf_entscheiden === true;
          const zahl = (await zaehler()).pendingRequests === 1;
          const amSymbol = (await symbol()) === 1;
          const empfaenger = (await ladeLeitungZumAntrag(db, id)).includes(USERS.admin1.id);
          const pruefung = await darfAntragEntscheiden(db, await reqUser(), id);
          expect({ zahl, amSymbol, empfaenger, pruefung }).toEqual({ zahl: feld, amSymbol: feld, empfaenger: feld, pruefung: feld });
        });
      }

      for (const ohneJahrgang of [false, true]) {
        it(`Termin ${ohneJahrgang ? 'ohne Jahrgang' : 'in J1'} -- ${lage}`, async () => {
          await aufbauen(zuweisungen, 'darf_events_verbuchen');
          await db.query(
            `INSERT INTO events (id, name, event_date, organization_id, mandatory, max_participants, has_timeslots)
             VALUES (501, 'E', NOW() - interval '1 day', $1, false, 0, false)`, [ORG1]);
          if (!ohneJahrgang) await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (501, $1)', [J1]);
          await db.query(
            `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, 501, 'confirmed', $2)`,
            [USERS.konfi1.id, ORG1]);

          const feld = (await request(app).get('/api/events/501').set(auth())).body.darf_verbuchen === true;
          const zahl = (await zaehler()).pendingEvents === 1;
          const amSymbol = (await symbol()) === 1;
          const erinnerung = (await zaehleWartendeTermineJeLeitung(db, [ORG1])).some((z) => z.user_id === USERS.admin1.id);
          const pruefung = await darfTerminVerbuchen(db, await reqUser(), 501);
          expect({ zahl, amSymbol, erinnerung, pruefung }).toEqual({ zahl: feld, amSymbol: feld, erinnerung: feld, pruefung: feld });
        });
      }

      for (const [wer, nurTeam] of [['admin1', false], ['admin1', true], ['teamer1', false], ['teamer1', true]]) {
        it(`Challenge ${nurTeam ? '"Nur das Team"' : 'in J1'} -- ${wer === 'teamer1' ? 'Teamer:in' : 'Admin'} ${lage}`, async () => {
          person = wer;
          await aufbauen(zuweisungen, 'darf_challenges_freigeben', wer);
          const { rows: [c] } = await db.query(
            `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
               allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
             VALUES ($1, 'R', 'd', $2, 'public', true, '["text"]'::jsonb, 'A', $3,
                     NOW() - interval '1 day', NOW() + interval '7 days', false) RETURNING id`,
            [ORG1, nurTeam ? 'nur_team' : 'konfis', USERS.orgAdmin1.id]);
          if (!nurTeam) await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, J1]);
          await db.query(
            `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status)
             VALUES ($1, $2, $3, 'text', 'B', 'pending')`,
            [c.id, nurTeam ? (wer === 'teamer1' ? USERS.admin1.id : USERS.teamer1.id) : USERS.konfi1.id, ORG1]);
          // Geoeffnet: Die Challenge selbst zaehlt dann nicht mehr als
          // Neuigkeit ("nie geoeffnet"), nur der wartende Beitrag bleibt.
          await db.query(
            `INSERT INTO challenge_read_status (challenge_id, user_id, user_type, last_read_at)
             VALUES ($1, $2, $3, NOW() + interval '1 minute')`, [c.id, USERS[wer].id, wer === 'teamer1' ? 'teamer' : 'admin']);

          const detail = await request(app).get(`/api/challenges/admin/${c.id}`).set(auth());
          const feld = detail.body.darf_freigeben === true;
          const zahl = (await zaehler()).pendingChallenges === 1;
          const amSymbol = (await symbol()) === 1;
          const empfaenger = (await ladeLeitungZumChallengeBeitrag(db, c.id, { moderiert: true })).includes(USERS[wer].id);
          const pruefung = await darfChallengeFreigeben(db, await reqUser(), c.id);
          expect({ zahl, amSymbol, empfaenger, pruefung }).toEqual({ zahl: feld, amSymbol: feld, empfaenger: feld, pruefung: feld });
        });
      }
    }
  });
});
