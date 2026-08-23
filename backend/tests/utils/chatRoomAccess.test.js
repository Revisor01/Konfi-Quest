// backend/tests/utils/chatRoomAccess.test.js
//
// Regression zum Befund vom 23.08.2026: Der Socket-Beitritt (joinRoom, typing,
// stopTyping in server.js) prueft nur die Organisation, nicht die
// Teilnehmerschaft. Ueber `room_<id>` verteilt chat.js das vollstaendige
// Nachrichtenobjekt — jeder angemeldete Nutzer derselben Gemeinde konnte damit
// fremde Direktchats live mitlesen.
//
// Geprueft werden der verbotene UND der erlaubte Fall.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { darfRaumBetreten } = require('../../utils/chatRoomAccess');

const ORG_1 = 1;
const ORG_2 = 2;

// Nutzer so bauen, wie server.js sie aus dem Socket-Handshake ableitet.
const alsNutzer = (u, orgId = ORG_1) => ({
  id: u.id,
  organization_id: orgId,
  type: u.type,
});

describe('darfRaumBetreten (Socket-Raum-Zugriff)', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  describe('verboten', () => {
    it('Konfi2 darf NICHT in den Direktchat von Konfi1 und Admin1 — der eigentliche Befund', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, alsNutzer(USERS.konfi2));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('kein Teilnehmer');
    });

    it('Konfi1 darf NICHT in die Team-Gruppe, in der er kein Teilnehmer ist', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.group.id, alsNutzer(USERS.konfi1));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('kein Teilnehmer');
    });

    it('Konfi3 aus Org 2 darf NICHT in einen Raum aus Org 1', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang.id, alsNutzer(USERS.konfi3, ORG_2));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe(`Org-Isolation (Raum-Org ${ORG_1})`);
    });

    it('Admin2 aus Org 2 darf NICHT in einen Raum aus Org 1 — der Admin-Bypass gilt nur in der eigenen Org', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, alsNutzer(USERS.admin2, ORG_2));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe(`Org-Isolation (Raum-Org ${ORG_1})`);
    });

    it('Ein nicht existierender Raum wird abgelehnt', async () => {
      const res = await darfRaumBetreten(db, 999999, alsNutzer(USERS.admin1));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('nicht gefunden');
    });

    it('Ohne Nutzer wird abgelehnt', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, null);
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('ungueltige Anfrage');
    });
  });

  describe('erlaubt', () => {
    it('Konfi1 darf in seinen eigenen Direktchat', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, alsNutzer(USERS.konfi1));
      expect(res.ok).toBe(true);
    });

    it('Konfi1 darf in seinen Jahrgangs-Chat', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang.id, alsNutzer(USERS.konfi1));
      expect(res.ok).toBe(true);
    });

    it('Teamer1 darf in die Team-Gruppe, in der er als user_type "teamer" steht', async () => {
      // Kernpunkt: chat_participants fuehrt 'teamer' als eigenen Wert. Wuerde
      // hier auf 'admin' geprueft, faende die Teamer:in ihren eigenen Raum nicht.
      const res = await darfRaumBetreten(db, CHAT_ROOMS.group.id, alsNutzer(USERS.teamer1));
      expect(res.ok).toBe(true);
    });

    it('Admin1 darf in die Team-Gruppe, in der er Teilnehmer ist', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.group.id, alsNutzer(USERS.admin1));
      expect(res.ok).toBe(true);
    });

    it('Admin1 darf org-weit auch ohne Teilnehmerschaft (Admin-Bypass wie in den HTTP-Routen)', async () => {
      // Admin1 ist NICHT Teilnehmer dieses Raums — nachweislich:
      const { rows } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.jahrgang2.id, USERS.admin1.id]
      );
      expect(rows.length).toBe(0);

      // ...aber der Raum liegt in Org 2, also greift die Org-Grenze zuerst.
      const fremd = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsNutzer(USERS.admin1));
      expect(fremd.ok).toBe(false);

      // In der eigenen Org greift der Bypass: Admin2 ist nicht Teilnehmer von
      // Raum 4, gehoert aber zu Org 2.
      const eigen = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsNutzer(USERS.admin2, ORG_2));
      expect(eigen.ok).toBe(true);
    });

    it('Org-Admin1 darf org-weit (type "admin" deckt org_admin mit ab)', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, alsNutzer(USERS.orgAdmin1));
      expect(res.ok).toBe(true);
    });
  });

  describe('Teamer:innen bekommen KEINEN Admin-Bypass', () => {
    it('Teamer1 darf NICHT in einen Raum, in dem er kein Teilnehmer ist', async () => {
      // Teamer1 ist in Raum 1 und 3, nicht in Raum 2 (Direktchat Konfi1/Admin1).
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, alsNutzer(USERS.teamer1));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('kein Teilnehmer');
    });
  });
});
