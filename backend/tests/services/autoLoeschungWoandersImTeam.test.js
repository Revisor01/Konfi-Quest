// Auto-Loeschung nach der Konfirmation: ein Konfi-Konto, das in einer anderen
// Gemeinde im Team ist, bleibt stehen.
//
// BEFUND (Audit Punkte/Termine, Nachtrag 27.09.2026 "Rolle je Gemeinde",
// die schwerste Zeile der Tabelle): runAutoDeletion waehlt nach der
// Stamm-Rolle 'konfi' und loescht ab Tag 120 das GANZE Konto
// (deleteKonfiCascade), ab Tag 60 sperrt es das ganze Konto (deleted_at).
// Ist die Person ueber user_organizations in einer anderen Gemeinde im Team,
// verliert diese Gemeinde sie mit -- samt Anmeldung, Chats und allem, was an
// dem Konto haengt.
//
// Seit dem 28.09.2026 kann dieser Mischzustand nicht mehr entstehen ("Konfi
// und Team geht nicht parallel", utils/konfiOderTeam.js). Fuer den
// Altbestand ueberspringt der Lauf solche Konten und protokolliert sie NUR mit
// Kennung, ohne Namen; was mit ihnen geschieht, entscheidet ein Mensch
// (docs/planung/mehrfach-konten.md).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');
const emailService = require('../../services/emailService');

let naechsteEventId = 9101;

describe('Auto-Loeschung: Konfi-Konto, das woanders im Team ist', () => {
  let db;
  let protokoll;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Konfi 1 (Stamm Org 1) ist in Org 2 Teamer:in -- Altbestand.
    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)',
      [USERS.konfi1.id, ROLES.teamer2.id]
    );
    protokoll = [];
    const mitschreiben = (...a) => { protokoll.push(a.map(String).join(' ')); };
    vi.spyOn(console, 'warn').mockImplementation(mitschreiben);
    vi.spyOn(console, 'log').mockImplementation(mitschreiben);
  });
  afterEach(() => { vi.restoreAllMocks(); });
  afterAll(async () => { await closePool(); });

  const konfirmationVorTagen = async (tage) => {
    const id = naechsteEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Konfirmation', CURRENT_DATE - ($2 || ' days')::interval, 1, true, false, false, false)`,
      [id, String(tage)]
    );
    await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [id, JAHRGAENGE.jahrgang1.id]);
  };

  const konto = async (id) => {
    const { rows: [u] } = await db.query('SELECT id, deleted_at FROM users WHERE id = $1', [id]);
    return u || null;
  };

  it('Tag 120: das Konto bleibt, die Mitgliedschaft in Org 2 auch', async () => {
    await konfirmationVorTagen(120);
    await BackgroundService.runAutoDeletion(db);

    const k1 = await konto(USERS.konfi1.id);
    expect(k1).not.toBeNull();
    expect(k1.deleted_at).toBeNull();
    const { rows } = await db.query(
      'SELECT 1 FROM user_organizations WHERE user_id = $1 AND organization_id = 2', [USERS.konfi1.id]);
    expect(rows).toHaveLength(1);
  });

  it('Tag 120: eine Konfi ohne weitere Gemeinde wird weiterhin geloescht', async () => {
    await konfirmationVorTagen(120);
    const ergebnis = await BackgroundService.runAutoDeletion(db);

    expect(await konto(USERS.konfi2.id)).toBeNull();
    expect(ergebnis.hard).toBe(1);
  });

  it('Tag 60: das Konto wird nicht gesperrt, die Konfi ohne weitere Gemeinde schon', async () => {
    await konfirmationVorTagen(60);
    const ergebnis = await BackgroundService.runAutoDeletion(db);

    expect((await konto(USERS.konfi1.id)).deleted_at).toBeNull();
    expect((await konto(USERS.konfi2.id)).deleted_at).not.toBeNull();
    expect(ergebnis.soft).toBe(1);
  });

  it('protokolliert das uebersprungene Konto mit Kennung, ohne Namen', async () => {
    await konfirmationVorTagen(120);
    await BackgroundService.runAutoDeletion(db);

    const zeilen = protokoll.filter(z => z.includes('übersprungen'));
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toContain(`Konto ${USERS.konfi1.id}`);
    for (const z of protokoll) {
      expect(z).not.toContain(USERS.konfi1.display_name);
      expect(z).not.toContain(USERS.konfi1.username);
    }
  });

  it('vor Tag 60 wird nichts protokolliert', async () => {
    await konfirmationVorTagen(30);
    await BackgroundService.runAutoDeletion(db);
    expect(protokoll.filter(z => z.includes('übersprungen'))).toHaveLength(0);
  });

  it('die Loesch-Warnung an die Leitung zaehlt uebersprungene Konten nicht', async () => {
    // Nur noch Konfi 1 im Jahrgang -- und die wird nicht geloescht.
    await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [ROLES.teamer.id, USERS.konfi2.id]);
    await konfirmationVorTagen(55);
    vi.spyOn(PushService, 'sendJahrgangDeletionWarningToLeadership').mockResolvedValue({ success: true });
    vi.spyOn(emailService, 'sendJahrgangDeletionWarningEmail').mockResolvedValue({ success: true });

    await BackgroundService.runJahrgangDeletionReminders(db);

    expect(PushService.sendJahrgangDeletionWarningToLeadership).toHaveBeenCalledTimes(0);
  });
});
