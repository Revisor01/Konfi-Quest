// backend/tests/services/vorgaengeAufraeumen.test.js
//
// Aufbewahrung der Support-Vorgaenge im naechtlichen Lauf (02:00,
// services/backgroundService.js; docs/planung/support-vorgaenge.md,
// Entscheidung 6; Datenschutzerklaerung 9e):
//
//   - cleanupArchivierteVorgaenge: Ein archivierter Vorgang geht 730 Tage nach
//     dem Archivieren (archiviert_am), wenn er sich seitdem nicht geaendert hat
//     (updated_at) -- samt seinen Mails in Konfi Quest. Vorgaenge einer Anfrage
//     sind ausgenommen: Sie folgen den Fristen der Anfrage. Alles, was nicht
//     archiviert ist, bleibt, wie alt es auch ist.
//   - cleanupNichtZugeordneteMails: der Posteingang (auch archivierte Mails)
//     nach 180 Tagen -- Mails eines Vorgangs gehoeren nicht dazu, auch wenn sie
//     (Vorgang ohne Gemeinde) weder Anfrage noch Gemeinde tragen.
//   - Beides haengt im Nachtlauf, fehler-isoliert.
//
// Alle Zeitpunkte fest relativ zu NOW() der Datenbank, mit Abstand zur Grenze:
// 731 und 729 Tage, 181 und 179 Tage.
const cron = require('node-cron');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');
const { vorgaengeDaten } = require('../helpers/vorgaengeDaten');

const { ARCHIVIERTE_VORGAENGE_TAGE, NICHT_ZUGEORDNETE_MAILS_TAGE } = BackgroundService;

describe('Aufbewahrung der Support-Vorgänge', () => {
  let db;
  let d;

  beforeAll(() => { db = getTestPool(); d = vorgaengeDaten(db); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  /** Datum vor `tage` Tagen (für Spalten, die der Testdaten-Helfer als Wert nimmt). */
  const vor = (tage) => new Date(Date.now() - tage * 24 * 60 * 60 * 1000);
  const betreffe = async () => (await db.query('SELECT betreff FROM support_vorgaenge ORDER BY id')).rows.map((r) => r.betreff);

  it('die Fristen sind 730 und 180 Tage', () => {
    expect(ARCHIVIERTE_VORGAENGE_TAGE).toBe(730);
    expect(NICHT_ZUGEORDNETE_MAILS_TAGE).toBe(180);
  });

  describe('cleanupArchivierteVorgaenge', () => {
    it('löscht einen seit 731 Tagen archivierten, seitdem nicht geänderten Vorgang samt Mails; behält einen seit 729 Tagen archivierten; Rückgabe = Anzahl', async () => {
      const alt = await d.vorgang({ betreff: 'alt', status: 'erledigt', archiviert_am: vor(731), updated_at: vor(731) });
      const jung = await d.vorgang({ betreff: 'jung', status: 'erledigt', archiviert_am: vor(729), updated_at: vor(729) });
      await d.mail({ vorgang_id: alt });
      await d.mail({ vorgang_id: alt, richtung: 'aus' });
      const bleibt = await d.mail({ vorgang_id: jung });
      const posteingang = await d.mail({});
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(1);
      expect(await betreffe()).toEqual(['jung']);
      expect((await db.query('SELECT id FROM mail_nachrichten ORDER BY id')).rows.map((r) => Number(r.id))).toEqual([bleibt, posteingang]);
    });

    it('auch ein von Hand archivierter Vorgang (ohne Status erledigt) geht nach 730 Tagen -- archiviert heißt archiviert', async () => {
      await d.vorgang({ betreff: 'von Hand', status: 'in_arbeit', archiviert_am: vor(800), updated_at: vor(800) });
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(1);
      expect(await betreffe()).toEqual([]);
    });

    it('gezählt wird ab dem Archivieren, nicht ab dem Anlegen oder dem Abschluss', async () => {
      // vor 1000 Tagen angelegt, vor 10 Tagen archiviert
      await d.vorgang({ betreff: 'spät archiviert', status: 'erledigt', created_at: vor(1000), status_seit: vor(1000), archiviert_am: vor(10), updated_at: vor(10) });
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(0);
      expect(await betreffe()).toEqual(['spät archiviert']);
    });

    it('hat sich der Vorgang seitdem geändert (updated_at: Mail, Notiz, Einordnen), bleibt er', async () => {
      await d.vorgang({ betreff: 'geändert', status: 'erledigt', archiviert_am: vor(900), updated_at: vor(100) });
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(0);
      expect(await betreffe()).toEqual(['geändert']);
    });

    it('nicht archivierte Vorgänge bleiben, wie alt sie auch sind (neu, in Arbeit, wartet)', async () => {
      for (const status of ['neu', 'in_arbeit', 'wartet']) {
        await d.vorgang({ betreff: status, status, created_at: vor(1500), status_seit: vor(1500), updated_at: vor(1500) });
      }
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(0);
      expect(await betreffe()).toEqual(['neu', 'in_arbeit', 'wartet']);
    });

    it('Vorgänge einer Anfrage sind ausgenommen -- sie folgen den Fristen der Anfrage (abgelehnt 180, unbewegt 365 Tage)', async () => {
      const { anfrage, vorgang } = await d.anfrageMitVorgang({ status: 'abgelehnt' });
      await db.query(
        "UPDATE support_vorgaenge SET status = 'erledigt', archiviert_am = $2, updated_at = $2 WHERE id = $1", [vorgang, vor(2000)]);
      expect(await BackgroundService.cleanupArchivierteVorgaenge(db)).toBe(0);
      expect(await betreffe()).toEqual(['Anfrage: Kirchengemeinde Büsum']);
      // Die Anfrage geht nach ihrer Frist -- mit ihr Vorgang und Mails.
      await d.mail({ vorgang_id: vorgang, postfach: 'moin' });
      await db.query('UPDATE gemeinde_anfragen SET status_seit = $2 WHERE id = $1', [anfrage, vor(181)]);
      expect(await BackgroundService.cleanupAbgelehnteAnfragen(db)).toBe(1);
      expect(await betreffe()).toEqual([]);
      expect(await d.anzahl('mail_nachrichten')).toBe(0);
    });

    it('das Protokoll nennt nur die Anzahl', async () => {
      await d.vorgang({ betreff: 'Geheimer Betreff', status: 'erledigt', archiviert_am: vor(800), updated_at: vor(800), kontakt_email: 'erika@geheim.example' });
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        await BackgroundService.cleanupArchivierteVorgaenge(db);
        expect(log.mock.calls).toEqual([['Vorgaenge aufraeumen: 1 archivierte Vorgaenge aelter als 730 Tage geloescht']]);
      } finally {
        log.mockRestore();
      }
    });

    it('Gegenprobe: ohne die Bedingung „archiviert“ würde der alte offene Vorgang mitgehen -- er bleibt', async () => {
      await d.vorgang({ betreff: 'offen und alt', status: 'neu', created_at: vor(900), updated_at: vor(900) });
      await d.vorgang({ betreff: 'archiviert und alt', status: 'neu', archiviert_am: vor(900), updated_at: vor(900) });
      await BackgroundService.cleanupArchivierteVorgaenge(db);
      expect(await betreffe()).toEqual(['offen und alt']);
    });
  });

  describe('cleanupNichtZugeordneteMails mit Vorgängen', () => {
    it('der Posteingang geht nach 181 Tagen (auch archivierte Mails), nach 179 bleibt er; Mails eines Vorgangs bleiben -- auch eines Vorgangs ohne Gemeinde', async () => {
      const ohneGemeinde = await d.vorgang({ organization_id: null });
      const mitGemeinde = await d.vorgang({ organization_id: 2 });
      await d.mail({ betreff: 'alt', created_at: vor(181) });
      await d.mail({ betreff: 'alt archiviert', created_at: vor(181), archiviert_am: vor(100) });
      await d.mail({ betreff: 'jung', created_at: vor(179) });
      const imVorgangOhne = await d.mail({ vorgang_id: ohneGemeinde, created_at: vor(400) });
      const imVorgangMit = await d.mail({ vorgang_id: mitGemeinde, created_at: vor(400) });
      expect(await BackgroundService.cleanupNichtZugeordneteMails(db)).toBe(2);
      const uebrig = (await db.query('SELECT id, betreff FROM mail_nachrichten ORDER BY id')).rows;
      expect(uebrig.map((m) => m.betreff).slice(0, 1)).toEqual(['jung']);
      expect(uebrig.map((m) => Number(m.id)).slice(1)).toEqual([imVorgangOhne, imVorgangMit]);
    });
  });

  describe('der Nachtlauf', () => {
    it('ruft beides auf: archivierte Vorgänge und den Posteingang gehen im 02:00-Lauf; die Fehler sind getrennt isoliert', async () => {
      await d.vorgang({ betreff: 'alt', status: 'erledigt', archiviert_am: vor(731), updated_at: vor(731) });
      await d.vorgang({ betreff: 'jung', status: 'erledigt', archiviert_am: vor(729), updated_at: vor(729) });
      await d.mail({ betreff: 'Posteingang alt', created_at: vor(181) });

      let nachtlauf = null;
      const planSpy = vi.spyOn(cron, 'schedule').mockImplementation((ausdruck, fn) => {
        if (ausdruck === '0 2 * * *') nachtlauf = fn;
        return { stop: vi.fn() };
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        BackgroundService.stopAutoDeletionCron();
        BackgroundService.startAutoDeletionCron(db);
        expect(typeof nachtlauf).toBe('function');
        await nachtlauf();
        expect(await betreffe()).toEqual(['jung']);
        expect(await d.anzahl('mail_nachrichten')).toBe(0);

        // Schlägt das Aufräumen der Vorgänge fehl, laufen die übrigen Schritte weiter (und umgekehrt).
        const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
        const kaputt = vi.spyOn(BackgroundService, 'cleanupArchivierteVorgaenge').mockRejectedValue(Object.assign(new Error('boom'), { code: 'XX000' }));
        const mailAlt = await d.mail({ betreff: 'noch eine', created_at: vor(181) });
        try {
          await nachtlauf();
          expect(fehler.mock.calls).toContainEqual(['Vorgaenge aufraeumen failed:', 'XX000', 'boom']);
          expect((await db.query('SELECT id FROM mail_nachrichten WHERE id = $1', [mailAlt])).rows).toEqual([]);
        } finally {
          kaputt.mockRestore();
          fehler.mockRestore();
        }
      } finally {
        BackgroundService.stopAutoDeletionCron();
        planSpy.mockRestore();
        log.mockRestore();
      }
    });
  });
});
