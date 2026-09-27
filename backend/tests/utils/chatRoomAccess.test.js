// backend/tests/utils/chatRoomAccess.test.js
//
// Regression zum Befund vom 23.08.2026: Der Socket-Beitritt (joinRoom, typing,
// stopTyping in server.js) prüft nur die Organisation, nicht die
// Teilnehmerschaft. Über `room_<id>` verteilt chat.js das vollstaendige
// Nachrichtenobjekt — jeder angemeldete Nutzer derselben Gemeinde konnte damit
// fremde Direktchats live mitlesen.
//
// Geprueft werden der verbotene UND der erlaubte Fall.
//
// Seit dem 27.09.2026 (Audit "Wer bekommt was", BF-05) gilt ohne Teilnahme
// nur noch der Org-Admin gemeindeweit; ein Admin nur in Raeumen seiner
// Jahrgaenge, Terminen aus seiner Liste und reinen Team-Raeumen. Die
// Regel-Tests dazu stehen in tests/routes/chatZugangNachJahrgang.test.js.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, CHAT_ROOMS } = require('../helpers/seed');
const { darfRaumBetreten } = require('../../utils/chatRoomAccess');

const ORG_1 = 1;
const ORG_2 = 2;

// Rolle aus der Seed-Rolle des Kontos (role_id -> name).
const rolleVon = (u) => Object.values(ROLES).find(r => r.id === u.role_id).name;

// Nutzer so bauen, wie server.js sie aus dem Socket-Handshake ableitet —
// MIT role_name (server.js setzt ihn seit jeher; die Regel unterscheidet
// seit dem 27.09.2026 Org-Admin und Admin).
const alsNutzer = (u, orgId = ORG_1) => ({
  id: u.id,
  organization_id: orgId,
  role_name: rolleVon(u),
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
      expect(res.grund).toBe('ungültige Anfrage');
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
      // hier auf 'admin' geprüft, faende die Teamer:in ihren eigenen Raum nicht.
      const res = await darfRaumBetreten(db, CHAT_ROOMS.group.id, alsNutzer(USERS.teamer1));
      expect(res.ok).toBe(true);
    });

    it('Admin1 darf in die Team-Gruppe, in der er Teilnehmer ist', async () => {
      const res = await darfRaumBetreten(db, CHAT_ROOMS.group.id, alsNutzer(USERS.admin1));
      expect(res.ok).toBe(true);
    });

    it('Admin darf NICHT in einen fremden Direktchat — auch nicht per Socket', async () => {
      // Befund 24.08.2026: Die HTTP-Historie war gesperrt, der Live-Kanal aber
      // offen. Über newMessage wären alle neuen Nachrichten mitlesbar
      // gewesen. orgAdmin1 steht nicht in Raum 2 (konfi1 <-> admin1).
      const res = await darfRaumBetreten(db, CHAT_ROOMS.direct.id, alsNutzer(USERS.orgAdmin1));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('kein Teilnehmer');
    });

    it('Org-Admin darf gemeindeweit auch ohne Teilnehmerschaft — nur in der eigenen Gemeinde', async () => {
      // Bis 27.09.2026 hiess dieser Test "Admin1 darf org-weit auch ohne
      // Teilnehmerschaft" und liess admin2 (Admin OHNE Jahrgang) in den
      // Jahrgangs-Chat von Org 2. Das ist genau BF-05: Seit der Regel vom
      // 27.09.2026 gilt der Zugang ohne Teilnahme gemeindeweit nur fuer den
      // Org-Admin. Der Kern des Tests (Org-Grenze vor dem Bypass) bleibt.
      const { rows } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id IN ($2, $3)',
        [CHAT_ROOMS.jahrgang2.id, USERS.orgAdmin1.id, USERS.orgAdmin2.id]
      );
      expect(rows.length).toBe(0);

      // Raum liegt in Org 2 — die Org-Grenze greift zuerst, auch fuer den Org-Admin.
      const fremd = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsNutzer(USERS.orgAdmin1));
      expect(fremd.ok).toBe(false);
      expect(fremd.grund).toBe(`Org-Isolation (Raum-Org ${ORG_2})`);

      // In der eigenen Gemeinde darf der Org-Admin ohne Teilnahme.
      const eigen = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsNutzer(USERS.orgAdmin2, ORG_2));
      expect(eigen.ok).toBe(true);
    });

    it('Admin ohne Zuweisung darf NICHT in den Jahrgangs-Chat seiner Gemeinde', async () => {
      // Gegenstueck: admin2 (Rolle admin, keine Zuweisung auf Jahrgang 2,
      // nicht Teilnehmer von Raum 4) — vor dem 27.09.2026 ok:true.
      const res = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsNutzer(USERS.admin2, ORG_2));
      expect(res.ok).toBe(false);
      expect(res.grund).toBe('Jahrgang nicht zugewiesen');
    });

    it('Org-Admin1 darf org-weit in Gruppen (Rolle org_admin)', async () => {
      // Bewusst der Gruppenraum, nicht der Direktchat: Dort gilt seit dem
      // 24.08.2026 die Ausnahme, siehe Test oben.
      const res = await darfRaumBetreten(db, CHAT_ROOMS.group.id, alsNutzer(USERS.orgAdmin1));
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
  describe('Typen aus Token und Datenbank', () => {
    // Befund 24.08.2026, gegen Produktion gemessen: Der pg-Treiber liefert
    // bigint als String ("1"), die Socket-Auth setzt organization_id nach
    // einem Organisationswechsel dagegen als Zahl (parseInt). Ein strikter
    // Vergleich der beiden sperrte Mehr-Organisations-Leitungen aus JEDEM
    // Chat ihrer aktiven Zweitgemeinde aus — auch aus ihren eigenen.
    // Seit dem 27.09.2026 mit orgAdmin2 statt admin2: admin2 hat keinen
    // Jahrgang und kommt ohne Teilnahme nicht mehr in Raum 4 (BF-05). Die
    // Tests pruefen den Typvergleich der Organisation, dafuer braucht es
    // jemanden, der den Raum oeffnen darf.
    it('Eine Zahl als organization_id wird wie der String aus der Datenbank behandelt', async () => {
      const alsZahl = { id: USERS.orgAdmin2.id, organization_id: Number(ORG_2), role_name: 'org_admin', type: 'admin' };
      const res = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsZahl);
      expect(res.ok).toBe(true);
    });

    it('Ein String als organization_id wird ebenso behandelt', async () => {
      const alsText = { id: USERS.orgAdmin2.id, organization_id: String(ORG_2), role_name: 'org_admin', type: 'admin' };
      const res = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang2.id, alsText);
      expect(res.ok).toBe(true);
    });

    it('Die Organisationsgrenze haelt auch bei gemischten Typen', async () => {
      const alsText = { id: USERS.orgAdmin2.id, organization_id: String(ORG_2), role_name: 'org_admin', type: 'admin' };
      const res = await darfRaumBetreten(db, CHAT_ROOMS.jahrgang.id, alsText);
      expect(res.ok).toBe(false);
      expect(res.grund).toBe(`Org-Isolation (Raum-Org ${ORG_1})`);
    });
  });
});
