// backend/tests/services/badgeUpdateService.test.js
//
// Der Hintergrunddienst tut zwei Dinge mit sehr verschiedenen Kosten:
// den App-Icon-Zaehler setzen (billig, eine Bulk-Abfrage fuer alle) und die
// Abzeichen pruefen (teuer, rund 24 Abfragen PRO PERSON).
//
// Gemessen am 24.08.2026: 95 bis 292 ms je Person. Bei 82 Personen sind das
// 5 Sekunden, bei 1000 waeren es rund drei Minuten — in einem
// Fuenf-Minuten-Takt liefe der Dienst sich selbst hinterher (63 Prozent
// Dauerlast). Deshalb laeuft die Pruefung stuendlich und der Zaehler
// weiterhin alle fuenf Minuten.
//
// Diese Tests halten die Trennung fest, damit sie nicht versehentlich
// zurueckgedreht wird.
const BackgroundService = require('../../services/backgroundService');

describe('Hintergrunddienst: Zaehler und Abzeichen-Pruefung sind getrennt', () => {
  afterEach(() => {
    BackgroundService.stopBadgeUpdateService();
  });

  it('startet zwei Zeitgeber mit unterschiedlichem Takt', () => {
    const takte = [];
    const echt = global.setInterval;
    global.setInterval = (fn, ms) => { takte.push(ms); return echt(() => {}, 1e9); };

    try {
      BackgroundService.startBadgeUpdateService({ query: async () => ({ rows: [] }) });
    } finally {
      global.setInterval = echt;
    }

    expect(takte).toContain(5 * 60 * 1000);
    expect(takte).toContain(60 * 60 * 1000);
    expect(takte.length).toBe(2);
  });

  it('stopBadgeUpdateService raeumt BEIDE Zeitgeber ab', () => {
    BackgroundService.startBadgeUpdateService({ query: async () => ({ rows: [] }) });
    expect(BackgroundService.badgeUpdateInterval).not.toBeNull();
    expect(BackgroundService.badgeCheckInterval).not.toBeNull();

    BackgroundService.stopBadgeUpdateService();
    expect(BackgroundService.badgeUpdateInterval).toBeNull();
    expect(BackgroundService.badgeCheckInterval).toBeNull();
  });

  it('nurZaehler laesst die teure Abzeichen-Pruefung aus', async () => {
    // Eine Person mit ungelesener Nachricht, damit die Schleife etwas zu tun hat.
    const abfragen = [];
    const db = {
      query: async (sql) => {
        abfragen.push(String(sql));
        if (/FROM users u/.test(sql)) {
          return { rows: [{ user_id: 1, user_type: 'konfi', role_name: 'konfi', hat_push: false }] };
        }
        return { rows: [] };
      }
    };

    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });

    // Die Abzeichen-Pruefung liest custom_badges — im Zaehler-Lauf darf das
    // nicht vorkommen.
    expect(abfragen.some(q => /custom_badges/.test(q))).toBe(false);
  });
});
