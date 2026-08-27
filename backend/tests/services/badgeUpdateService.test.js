// backend/tests/services/badgeUpdateService.test.js
//
// Der Hintergrunddienst tut zwei Dinge mit sehr verschiedenen Kosten:
// den App-Icon-Zähler setzen (billig, eine Bulk-Abfrage für alle) und die
// Abzeichen prüfen (teuer, rund 24 Abfragen PRO PERSON).
//
// Gemessen am 24.08.2026: 95 bis 292 ms je Person. Bei 82 Personen sind das
// 5 Sekunden, bei 1000 wären es rund drei Minuten — in einem
// Fuenf-Minuten-Takt liefe der Dienst sich selbst hinterher (63 Prozent
// Dauerlast). Deshalb läuft die Prüfung stündlich und der Zähler
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

    // Die teure Vergabe-Pruefung (checkAndAwardBadges) gehoert in den
    // Stundentakt, nicht in den 5-Minuten-Zaehlerlauf. Sie erkennt man an
    // ihren Kriterien-Abfragen: Sie liest `criteria_type`/`criteria_value`
    // aus `custom_badges`, um zu entscheiden, wer ein Abzeichen VERDIENT hat.
    //
    // Geprueft wird genau das — nicht der blosse Tabellenname. Seit dem
    // 27.08.2026 zaehlt der Zaehlerlauf ungesehene Abzeichen ueber einen
    // JOIN auf `custom_badges` (nur `target_role`, ein COUNT). Das ist die
    // guenstige Zaehlung, nicht die Vergabe — ein Test auf den Tabellennamen
    // wuerde sie faelschlich mitfangen.
    const vergabePruefung = abfragen.some(q =>
      /custom_badges/.test(q) && /criteria_type|criteria_value/.test(q));
    expect(vergabePruefung).toBe(false);

    // Gegenprobe, damit der Test nicht auch dann gruen bliebe, wenn die
    // Zaehlung ganz ausfiele: Die Zaehl-Abfrage MUSS gelaufen sein.
    expect(abfragen.some(q => /user_badges/.test(q) && /seen/.test(q))).toBe(true);
  });
});
