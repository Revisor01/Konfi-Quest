// Challenge ohne Mehrfach-Einreichung: zwei gleichzeitige Beitraege ergeben
// genau einen (Audit 26.09.2026, Fachlogik Chat/Challenges/Rueckblick,
// Abschnitt "Unklar").
//
// POST /challenges/konfi/:id/submissions prueft bei allow_multiple = false
// erst "gibt es schon einen Beitrag?" und schreibt erst danach -- dazwischen
// liegen die Pruefung der Datei, das Verschluesseln und bei Links der Abruf
// der Titel beim Musikdienst (Sekunden). Zwei Anfragen, die beide vor dem
// ersten INSERT pruefen (Doppeltipp, Wiederholung aus der Warteschlange),
// kamen beide durch. Ein Unique-Index geht nicht: allow_multiple steht an der
// Challenge, nicht am Beitrag.
//
// Deterministisch nachgestellt: Der Abruf der Link-Titel wartet, bis BEIDE
// Anfragen ihn erreicht haben -- beide haben die fruehe Pruefung dann hinter
// sich. Erst danach schreiben sie.
const musikLinks = require('../../utils/musikLinks');

// VOR dem Laden der App ersetzen: challenges.js holt sich die Funktion beim
// require per Destrukturierung.
let schranke = [];
let schrankeGroesse = 2;
vi.spyOn(musikLinks, 'holeLinkMetadaten').mockImplementation(async () => {
  await new Promise((weiter) => {
    schranke.push(weiter);
    if (schranke.length >= schrankeGroesse) {
      schranke.forEach((w) => w());
      schranke = [];
    }
  });
  return null;
});

const request = require('supertest');
const { getTestApp, warteAufAlleNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const LINK = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC';

describe('Challenge-Beitrag: gleichzeitige Einreichungen', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    schranke = [];
    schrankeGroesse = 2;
  });

  afterAll(async () => {
    // Push an die Leitung laeuft nach der Antwort; vor dem Schliessen abwarten.
    await warteAufAlleNachwehen();
    await closePool();
  });

  async function challenge(allowMultiple) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges
         (organization_id, title, description, challenge_type, audience, visibility, moderated,
          allowed_media, allow_multiple, badge_icon, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Lieblingslied', 'Teile dein Lied', 'frei', 'konfis', 'public', false,
               '["text","link"]'::jsonb, $2, 'flag', 'Musik', $3,
               NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', false)
       RETURNING id`,
      [ORGS.testGemeinde.id, allowMultiple, USERS.admin1.id]
    );
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [c.id, JAHRGAENGE.jahrgang1.id]
    );
    return c.id;
  }

  const einreichen = (challengeId, userKey = 'konfi1') =>
    request(app)
      .post(`/api/challenges/konfi/${challengeId}/submissions`)
      .set('Authorization', `Bearer ${generateToken(userKey)}`)
      .send({ media_type: 'link', link_url: LINK });

  const anzahl = async (challengeId, userKey = 'konfi1') => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM challenge_submissions WHERE challenge_id = $1 AND user_id = $2',
      [challengeId, USERS[userKey].id]
    );
    return r.n;
  };

  it('allow_multiple = false: zwei gleichzeitige Anfragen -> ein Beitrag, einmal 201, einmal 409', async () => {
    const id = await challenge(false);

    const [a, b] = await Promise.all([einreichen(id), einreichen(id)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const abgelehnt = a.status === 409 ? a : b;
    expect(abgelehnt.body).toEqual({ error: 'Du hast für diese Challenge bereits einen Beitrag abgegeben.' });
    expect(await anzahl(id)).toBe(1);
  });

  it('Gegenprobe: allow_multiple = true -> beide gleichzeitigen Beitraege kommen an', async () => {
    const id = await challenge(true);

    const [a, b] = await Promise.all([einreichen(id), einreichen(id)]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await anzahl(id)).toBe(2);
  });

  it('Gegenprobe: zwei verschiedene Konfis gleichzeitig -> je ein Beitrag', async () => {
    const id = await challenge(false);

    const [a, b] = await Promise.all([einreichen(id, 'konfi1'), einreichen(id, 'konfi2')]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await anzahl(id, 'konfi1')).toBe(1);
    expect(await anzahl(id, 'konfi2')).toBe(1);
  });

  it('nacheinander bleibt es beim 409 fuer den zweiten Beitrag', async () => {
    schrankeGroesse = 1;
    const id = await challenge(false);

    const erster = await einreichen(id);
    const zweiter = await einreichen(id);

    expect(erster.status).toBe(201);
    expect(zweiter.status).toBe(409);
    expect(await anzahl(id)).toBe(1);
  });
});
