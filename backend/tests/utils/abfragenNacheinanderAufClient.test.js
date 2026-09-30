// Hilfsfunktionen mit Parameter `db` auf dem Client einer Transaktion:
// eine Abfrage nach der anderen (30.09.2026, Nebenbefund Großpaket).
//
// Diese Funktionen nehmen `db` entgegen -- Pool oder Client -- und buendelten
// ihre Abfragen mit Promise.all. Ueber den Pool ist das parallel und richtig.
// Mit dem CLIENT einer Transaktion liefen mehrere Abfragen gleichzeitig auf
// einer Verbindung: pg 8 reiht sie intern ein (und warnt ab der dritten
// wartenden: "Calling client.query() when the client is already executing a
// query is deprecated and will be removed in pg@9.0"), pg 9 nicht mehr.
// Heute ruft keine Route sie mit einem Client; der Test haelt fest, dass es
// ginge. Vorbild: checkAndAwardBadges (badgesEinClientNacheinander.test.js),
// derselbe Weg ueber utils/abfragenBuendeln.js.
//
// Die Attrappe ist strenger als pg 8: Sie WIRFT schon, wenn eine zweite
// Abfrage kommt, waehrend eine andere noch offen ist. Jede Funktion laeuft
// einmal ueber den Pool und einmal ueber die Attrappe in einer Transaktion;
// das Ergebnis muss dasselbe sein.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, EVENTS, ACTIVITIES } = require('../helpers/seed');
const { ladeLeitungZumTermin, zaehleWartendeTermineJeLeitung } = require('../../utils/terminLeitungSicht');
const { ladeLeitungZumAntrag } = require('../../utils/antragLeitungSicht');
const { ladeLeitungZumJahrgang } = require('../../utils/jahrgangLeitungSicht');
const { ladeMitgliedschaftenVieler, ladeMitgliedschaftenDerPerson } = require('../../utils/orgMitglieder');
const { appIconSummenAllerGemeinden, appIconSummenFuerAlle } = require('../../utils/appIconBadge');
const { getPunkteHistorie } = require('../../utils/punkteHistorie');
const { abzeichenFingerabdruecke } = require('../../utils/abzeichenKandidaten');
const { getKonfiBadgeProgress } = require('../../utils/konfiBadgeProgress');
const { getTeamerBadgeProgress } = require('../../utils/teamerBadgeProgress');
const PushService = require('../../services/pushService');

describe('Hilfsfunktionen mit db auf einem Transaktions-Client: nie zwei Abfragen gleichzeitig', () => {
  let db;
  let antragId;
  let challengeId;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Ein offener Antrag und eine laufende Challenge fuer Konfis und Team,
    // damit die Empfaenger-Regeln etwas zu finden haben.
    ({ rows: [{ id: antragId }] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
       VALUES ($1, $2, 'pending', $3, CURRENT_DATE) RETURNING id`,
      [USERS.konfi1.id, ACTIVITIES.kirchenchor.id, ORGS.testGemeinde.id]
    ));
    ({ rows: [{ id: challengeId }] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Runde', 'd', 'konfis_und_team', 'public', true, '["text"]'::jsonb, 'A', $2,
               NOW() - interval '1 day', NOW() + interval '7 days', false)
       RETURNING id`,
      [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
    ));
    await db.query(
      'INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
      [challengeId, JAHRGAENGE.jahrgang1.id]
    );
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // Client-Attrappe: echter Client einer Transaktion, der wirft, sobald eine
  // Abfrage kommt, waehrend eine andere noch offen ist. Hat release() --
  // daran erkennt abfragenBuendeln einen Client.
  async function strengerClient() {
    const client = await db.getClient();
    let offen = 0;
    let laufend = Promise.resolve();
    const attrappe = {
      abfragen: 0,
      query(...args) {
        if (offen > 0) {
          throw new Error('client.query() waehrend eine andere Abfrage offen ist');
        }
        offen += 1;
        attrappe.abfragen += 1;
        const p = client.query(...args);
        // Vor dem await des Aufrufers eingehaengt: Die Zahl sinkt, bevor er
        // weitermacht.
        const fertig = () => { offen -= 1; };
        laufend = p.then(fertig, fertig);
        return p;
      },
      release() { /* in aufraeumen */ },
      async aufraeumen() {
        await laufend;
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      },
    };
    return attrappe;
  }

  // Einmal ueber den Pool, einmal ueber die Attrappe in einer Transaktion.
  async function vergleiche(aufruf) {
    const erwartet = await aufruf(db);
    const attrappe = await strengerClient();
    let ergebnis;
    try {
      await attrappe.query('BEGIN');
      ergebnis = await aufruf(attrappe);
    } finally {
      await attrappe.aufraeumen();
    }
    expect(ergebnis).toEqual(erwartet);
    // Mehr als BEGIN und eine Abfrage: der gebuendelte Teil lief wirklich.
    expect(attrappe.abfragen).toBeGreaterThan(2);
    return erwartet;
  }

  it('ladeLeitungZumTermin', async () => {
    const leitung = await vergleiche((d) => ladeLeitungZumTermin(d, EVENTS.gottesdienstEvent.id));
    expect(leitung.map(Number)).toContain(USERS.orgAdmin1.id);
  });

  it('zaehleWartendeTermineJeLeitung', async () => {
    await vergleiche((d) => zaehleWartendeTermineJeLeitung(d, [ORGS.testGemeinde.id, ORGS.andereGemeinde.id]));
  });

  it('ladeLeitungZumAntrag', async () => {
    const leitung = await vergleiche((d) => ladeLeitungZumAntrag(d, antragId));
    expect(leitung.map(Number)).toContain(USERS.orgAdmin1.id);
  });

  it('ladeLeitungZumJahrgang', async () => {
    const leitung = await vergleiche((d) => ladeLeitungZumJahrgang(d, ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id));
    expect(leitung.map(Number)).toContain(USERS.orgAdmin1.id);
  });

  it('ladeMitgliedschaftenVieler und ladeMitgliedschaftenDerPerson', async () => {
    const alle = Object.values(USERS).map((u) => u.id);
    const jePerson = await vergleiche((d) => ladeMitgliedschaftenVieler(d, alle));
    expect(jePerson.size).toBe(alle.length);
    await vergleiche((d) => ladeMitgliedschaftenDerPerson(d, USERS.admin1.id));
  });

  it('appIconSummenAllerGemeinden und appIconSummenFuerAlle', async () => {
    const alle = Object.values(USERS).map((u) => u.id);
    const summen = await vergleiche((d) => appIconSummenAllerGemeinden(d, alle));
    expect(summen.size).toBe(alle.length);
    await vergleiche((d) => appIconSummenFuerAlle(d, [
      { id: USERS.orgAdmin1.id, type: 'admin', role_name: 'org_admin', organization_id: ORGS.testGemeinde.id, assigned_jahrgaenge: [] },
      { id: USERS.konfi1.id, type: 'konfi', role_name: 'konfi', organization_id: ORGS.testGemeinde.id, assigned_jahrgaenge: [] },
    ]));
  });

  it('getPunkteHistorie', async () => {
    const historie = await vergleiche((d) => getPunkteHistorie(d, USERS.konfi1.id, ORGS.testGemeinde.id));
    expect(Object.keys(historie)).toEqual(['history', 'totals']);
  });

  it('abzeichenFingerabdruecke', async () => {
    const personen = [
      { user_id: USERS.konfi1.id, organization_id: ORGS.testGemeinde.id },
      { user_id: USERS.teamer1.id, organization_id: ORGS.testGemeinde.id },
      { user_id: USERS.konfi3.id, organization_id: ORGS.andereGemeinde.id },
    ];
    const abdruecke = await vergleiche((d) => abzeichenFingerabdruecke(d, personen));
    expect(abdruecke.size).toBe(3);
  });

  it('getKonfiBadgeProgress', async () => {
    await vergleiche((d) => getKonfiBadgeProgress(d, USERS.konfi1.id, ORGS.testGemeinde.id));
  });

  it('getTeamerBadgeProgress', async () => {
    await vergleiche((d) => getTeamerBadgeProgress(d, USERS.teamer1.id, ORGS.testGemeinde.id));
  });

  // Die beiden Push-Wege: verglichen wird, an wen die Mitteilung ginge. Der
  // Versand selbst ist abgeklemmt.
  const empfaengerVon = async (aufruf) => {
    const versand = vi.spyOn(PushService, 'sendToMultipleUsers').mockResolvedValue({ success: true });
    await aufruf();
    const listen = versand.mock.calls.map((c) => c[1].map(Number).sort((a, b) => a - b));
    versand.mockRestore();
    return listen;
  };

  it('PushService.sendChallengeStartedToJahrgaenge', async () => {
    const empfaenger = await vergleiche((d) => empfaengerVon(
      () => PushService.sendChallengeStartedToJahrgaenge(d, challengeId, 'Runde')
    ));
    expect(empfaenger).toHaveLength(1);
    expect(empfaenger[0]).toContain(USERS.konfi1.id);
  });

  it('PushService.sendChallengeSubmissionToLeadership', async () => {
    const empfaenger = await vergleiche((d) => empfaengerVon(
      () => PushService.sendChallengeSubmissionToLeadership(
        d, ORGS.testGemeinde.id, challengeId, 'Runde', 'Konfi', true, USERS.konfi1.id
      )
    ));
    expect(empfaenger).toHaveLength(1);
    expect(empfaenger[0]).toContain(USERS.orgAdmin1.id);
  });
});
