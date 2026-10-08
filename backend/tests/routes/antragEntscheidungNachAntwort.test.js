// DIE ENTSCHEIDUNG UEBER EINEN ANTRAG ANTWORTET VOR DEN MITTEILUNGEN (07.10.2026).
//
// PUT /api/admin/activities/requests/:id wartete vor res.json nacheinander auf
// die Abzeichen-Pushes, den Level-Up-Push, den Postfach-Eintrag
// "activity_request_decision" und den Status-Push an die antragstellende
// Person. Jeder Push geht abgewartet an FCM (kalt 330-450 ms, warm 90-130 ms
// je Sendung); in Produktion stand die Leitung einmal 1524 ms vor dem Knopf,
// lokal ohne Push sind es 10 ms im Median.
//
// Jetzt laufen die Mitteilungen nach der Antwort (utils/nachAntwort.js). Die
// Abzeichen selbst werden weiter VOR der Antwort angelegt, weil die Antwort
// sie als newBadges meldet.
//
// Die Antwortform ist ein Vertrag mit den ausgelieferten Apps und bleibt:
//   genehmigt: { message, newBadges: { count, badges } }
//   abgelehnt: { message, newBadges: 0 }
//
// Gegen die echte DB; Firebase ist gemockt, die betroffenen PushService-
// Methoden je Test.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');
const warteschlange = require('../../utils/warteschlange');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG1 = ORGS.testGemeinde.id;

describe('PUT /admin/activities/requests/:id: Antwort vor Postfach und Push', () => {
  let app, db;
  let badgeId;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => {
    vi.restoreAllMocks();
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Ein Abzeichen, das die Genehmigung sicher ausloest: ab einem Punkt.
    const { rows: [b] } = await db.query(
      `INSERT INTO custom_badges (name, description, criteria_type, criteria_value, organization_id, icon, color, is_active)
       VALUES ('Erster Punkt', 'Der erste Punkt ist da', 'total_points', 1, $1, 'star', '#22c55e', true)
       RETURNING id`,
      [ORG1]
    );
    badgeId = b.id;
  });

  afterEach(() => {
    vi.mocked(PushService.sendActivityRequestStatusToKonfi).mockRestore?.();
    vi.mocked(PushService.sendBadgeEarnedToKonfi).mockRestore?.();
    vi.mocked(PushService.checkAndSendLevelUp).mockRestore?.();
  });

  async function offenerAntrag() {
    const { rows: [r] } = await db.query(
      `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
       VALUES ($1, $2, 'pending', $3, CURRENT_DATE) RETURNING id`,
      [USERS.konfi1.id, ACTIVITIES.kirchenchor.id, ORG1]
    );
    return r.id;
  }

  // Kurze Antwort-Frist: Wartet die Route vor res.json auf einen Push, der
  // nie fertig wird, laeuft der Test hier in den Timeout, statt zu haengen.
  const entscheiden = (id, body) => request(app)
    .put(`/api/admin/activities/requests/${id}`)
    .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
    .timeout({ response: 2000 })
    .send(body);

  const imPostfach = async (art) => (await db.query(
    `SELECT title, data->>'request_id' AS request_id, data->>'badge_id' AS badge_id
       FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY id`,
    [USERS.konfi1.id, art]
  )).rows;

  /** Ein Versprechen, das erst auf Zuruf aufgeht. */
  function schranke() {
    let oeffnen;
    const zu = new Promise((resolve) => { oeffnen = resolve; });
    return { zu, oeffnen };
  }

  it('die Antwort kommt, waehrend die Pushes noch haengen -- danach laufen Postfach und Push wirklich', async () => {
    const sperre = schranke();
    const postfachBeimStatusPush = [];
    const statusPush = vi.spyOn(PushService, 'sendActivityRequestStatusToKonfi')
      .mockImplementation(async () => {
        postfachBeimStatusPush.push((await imPostfach('activity_request_decision')).length);
        await sperre.zu;
        return { success: true };
      });
    const badgePush = vi.spyOn(PushService, 'sendBadgeEarnedToKonfi')
      .mockImplementation(async () => { await sperre.zu; return { success: true }; });
    const levelUp = vi.spyOn(PushService, 'checkAndSendLevelUp')
      .mockImplementation(async () => { await sperre.zu; });

    const id = await offenerAntrag();
    const res = await entscheiden(id, { status: 'approved' });

    // Antwort ist da, obwohl kein Push fertig ist.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Antragsstatus aktualisiert',
      newBadges: {
        count: 1,
        badges: [{ id: badgeId, name: 'Erster Punkt', icon: 'star', description: 'Der erste Punkt ist da' }],
      },
    });
    // Das Abzeichen steht schon (vor der Antwort angelegt) ...
    const { rows: vergeben } = await db.query(
      'SELECT badge_id FROM user_badges WHERE user_id = $1 AND organization_id = $2', [USERS.konfi1.id, ORG1]);
    expect(vergeben.map((r) => r.badge_id)).toEqual([badgeId]);
    // ... der Status-Push ist noch nicht einmal gerufen: Der erste Abzeichen-Push haengt.
    expect(statusPush).toHaveBeenCalledTimes(0);
    expect(await imPostfach('activity_request_decision')).toEqual([]);

    sperre.oeffnen();
    await warteAufNachwehen(app);

    expect(badgePush).toHaveBeenCalledTimes(1);
    expect(badgePush).toHaveBeenCalledWith(
      db, USERS.konfi1.id, 'Erster Punkt', 'star', 'Der erste Punkt ist da', badgeId, ORG1);
    expect(levelUp).toHaveBeenCalledTimes(1);
    expect(levelUp).toHaveBeenCalledWith(db, USERS.konfi1.id, ORG1);
    expect(statusPush).toHaveBeenCalledTimes(1);
    expect(statusPush).toHaveBeenCalledWith(
      db, USERS.konfi1.id, 'Kirchenchor', 1, 'approved', undefined, String(id), ORG1);
    // Postfach-Eintrag VOR dem Status-Push geschrieben (Reihenfolge wie zuvor).
    expect(postfachBeimStatusPush).toEqual([1]);
    expect(await imPostfach('activity_request_decision')).toEqual([
      { title: 'Antrag genehmigt!', request_id: String(id), badge_id: null },
    ]);
    expect(await imPostfach('badge_earned')).toEqual([
      { title: 'Neues Badge erhalten!', request_id: null, badge_id: String(badgeId) },
    ]);
  });

  it('ablehnen: Antwort mit newBadges 0, Postfach und Push folgen danach', async () => {
    const sperre = schranke();
    const statusPush = vi.spyOn(PushService, 'sendActivityRequestStatusToKonfi')
      .mockImplementation(async () => { await sperre.zu; return { success: true }; });
    const levelUp = vi.spyOn(PushService, 'checkAndSendLevelUp').mockResolvedValue(undefined);

    const id = await offenerAntrag();
    const res = await entscheiden(id, { status: 'rejected', admin_comment: 'Foto fehlt' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Antragsstatus aktualisiert', newBadges: 0 });

    sperre.oeffnen();
    await warteAufNachwehen(app);

    expect(levelUp).toHaveBeenCalledTimes(0);
    expect(statusPush).toHaveBeenCalledTimes(1);
    expect(statusPush).toHaveBeenCalledWith(
      db, USERS.konfi1.id, 'Kirchenchor', 1, 'rejected', 'Foto fehlt', String(id), ORG1);
    expect(await imPostfach('activity_request_decision')).toEqual([
      { title: 'Antrag abgelehnt', request_id: String(id), badge_id: null },
    ]);
    const { rows: vergeben } = await db.query('SELECT 1 FROM user_badges WHERE user_id = $1', [USERS.konfi1.id]);
    expect(vergeben).toEqual([]);
  });

  it('ein Push, der nach der Antwort scheitert, kippt nichts: Antrag genehmigt, Postfach-Eintrag steht', async () => {
    vi.spyOn(PushService, 'sendBadgeEarnedToKonfi').mockRejectedValue(new Error('FCM weg'));
    vi.spyOn(PushService, 'checkAndSendLevelUp').mockRejectedValue(new Error('FCM weg'));
    const statusPush = vi.spyOn(PushService, 'sendActivityRequestStatusToKonfi')
      .mockRejectedValue(new Error('FCM weg'));
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = await offenerAntrag();
    const res = await entscheiden(id, { status: 'approved' });
    await warteAufNachwehen(app);
    fehler.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body.newBadges.count).toBe(1);
    expect(statusPush).toHaveBeenCalledTimes(1);
    const { rows: [antrag] } = await db.query('SELECT status FROM activity_requests WHERE id = $1', [id]);
    expect(antrag.status).toBe('approved');
    expect(await imPostfach('activity_request_decision')).toEqual([
      { title: 'Antrag genehmigt!', request_id: String(id), badge_id: null },
    ]);
  });

  // BEFUND "Mitteilungen nach der Antwort gehen bei einem Neustart verloren":
  // Endete der Prozess direkt nach der Antwort (Deploy), fehlten Postfach und
  // Push -- die Arbeit lebte nur im Speicher. Jetzt steht sie als Auftrag in
  // der Datenbank, und der Arbeiter einer anderen Replica holt sie nach.
  it('Prozess endet direkt nach der Antwort: der Auftrag steht in der Datenbank, eine andere Replica stellt Abzeichen, Postfach und Push zu', async () => {
    const statusPush = vi.spyOn(PushService, 'sendActivityRequestStatusToKonfi').mockResolvedValue({ success: true });
    const badgePush = vi.spyOn(PushService, 'sendBadgeEarnedToKonfi').mockResolvedValue({ success: true });
    const levelUp = vi.spyOn(PushService, 'checkAndSendLevelUp').mockResolvedValue(undefined);

    const id = await offenerAntrag();
    warteschlange._lokalAnhalten(true);
    let res;
    try {
      res = await entscheiden(id, { status: 'approved' });
      await warteAufNachwehen(app);
    } finally {
      warteschlange._lokalAnhalten(false);
    }
    expect(res.status).toBe(200);
    expect(res.body.newBadges.count).toBe(1);

    // Der Prozess ist "weg": nichts zugestellt, aber der Auftrag liegt bereit.
    expect(statusPush).toHaveBeenCalledTimes(0);
    expect(await imPostfach('activity_request_decision')).toEqual([]);
    const { rows: auftraege } = await db.query(
      "SELECT art, status FROM nachlauf_auftraege ORDER BY id");
    expect(auftraege).toEqual([{ art: 'antrag_entschieden', status: 'offen' }]);

    // Der Arbeiter (hier: derselbe Testprozess als andere Replica) holt ihn.
    expect(await warteschlange.einTakt(db)).toBe(1);

    expect(badgePush).toHaveBeenCalledTimes(1);
    expect(badgePush).toHaveBeenCalledWith(
      db, USERS.konfi1.id, 'Erster Punkt', 'star', 'Der erste Punkt ist da', badgeId, ORG1);
    expect(levelUp).toHaveBeenCalledTimes(1);
    expect(statusPush).toHaveBeenCalledTimes(1);
    expect(statusPush).toHaveBeenCalledWith(
      db, USERS.konfi1.id, 'Kirchenchor', 1, 'approved', undefined, String(id), ORG1);
    expect(await imPostfach('activity_request_decision')).toEqual([
      { title: 'Antrag genehmigt!', request_id: String(id), badge_id: null },
    ]);
    expect(await imPostfach('badge_earned')).toEqual([
      { title: 'Neues Badge erhalten!', request_id: null, badge_id: String(badgeId) },
    ]);
    const { rows: [erledigt] } = await db.query(
      'SELECT status, erledigte_schritte FROM nachlauf_auftraege');
    expect(erledigt).toEqual({ status: 'erledigt', erledigte_schritte: ['abzeichen:0', 'levelup', 'postfach', 'push'] });
  });

  it('ein Status-Push, der scheitert, wird spaeter wiederholt -- ohne zweiten Postfach-Eintrag und ohne zweiten Abzeichen-Push', async () => {
    const statusPush = vi.spyOn(PushService, 'sendActivityRequestStatusToKonfi')
      .mockRejectedValueOnce(new Error('FCM weg'))
      .mockResolvedValue({ success: true });
    const badgePush = vi.spyOn(PushService, 'sendBadgeEarnedToKonfi').mockResolvedValue({ success: true });
    vi.spyOn(PushService, 'checkAndSendLevelUp').mockResolvedValue(undefined);
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = await offenerAntrag();
    await entscheiden(id, { status: 'approved' });
    await warteAufNachwehen(app);
    expect(statusPush).toHaveBeenCalledTimes(1);
    const { rows: [nachErstem] } = await db.query('SELECT status, versuche FROM nachlauf_auftraege');
    expect(nachErstem).toEqual({ status: 'offen', versuche: 1 });

    await db.query('UPDATE nachlauf_auftraege SET faellig_ab = NOW()');
    expect(await warteschlange.einTakt(db)).toBe(1);
    fehler.mockRestore();

    expect(statusPush).toHaveBeenCalledTimes(2);
    expect(badgePush).toHaveBeenCalledTimes(1);
    expect(await imPostfach('activity_request_decision')).toHaveLength(1);
    expect(await imPostfach('badge_earned')).toHaveLength(1);
    const { rows: [fertig] } = await db.query('SELECT status, versuche FROM nachlauf_auftraege');
    expect(fertig).toEqual({ status: 'erledigt', versuche: 2 });
  });
});
