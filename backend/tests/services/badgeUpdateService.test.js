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
  // ==================================================================
  // Befund M3 (Push-Bericht 27.08.2026): Der Rollenfilter liess eine der
  // beiden Leitungsrollen aus.
  //
  // Jede Organisation hat ZWEI Leitungsrollen: `org_admin`
  // ("Organisations-Admin") und `admin` ("Hauptamt"). Der Filter lautete
  // `r.name != 'admin'` unter dem Kommentar "Alle Konfis und
  // Teamer:innen" — die Negation liess org_admin also MITLAUFEN und
  // schloss nur das Hauptamt aus. Dessen App-Icon wurde im Hintergrund
  // nie nachgefuehrt, obwohl es einen Zaehler hat (Chat + Antraege +
  // Termine + Freigaben, siehe BadgeContext).
  // ==================================================================
  it('M3: laedt beide Leitungsrollen, nicht nur eine', async () => {
    let empfaengerAbfrage = null;
    const db = {
      query: async (sql) => {
        if (/FROM users u/.test(sql) && /JOIN roles r/.test(sql)) {
          empfaengerAbfrage = String(sql);
          return { rows: [] };
        }
        return { rows: [] };
      }
    };

    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });

    expect(empfaengerAbfrage).not.toBeNull();
    // Verbotener Fall: die alte Negation, die nur eine Leitungsrolle traf.
    expect(empfaengerAbfrage).not.toMatch(/r\.name\s*!=\s*'admin'/);
    // Erlaubter Fall: beide Leitungsrollen ausdruecklich aufgezaehlt.
    for (const rolle of ['konfi', 'teamer', 'admin', 'org_admin']) {
      expect(empfaengerAbfrage).toContain(`'${rolle}'`);
    }
  });

  it('M3: die Abzeichen-Pruefung laeuft NICHT fuer die Leitung', async () => {
    // Die Leitung wird jetzt fuer den Zaehler mitgeladen. Abzeichen kann
    // sie aber nicht bekommen — `checkAndAwardBadges` wuerde je Lauf und
    // je Leitungskonto nur eine Rollen-Abfrage machen, um dann mit
    // `{count: 0}` abzubrechen. Diese Arbeit wird hier gespart.
    const abfragen = [];
    const db = {
      query: async (sql) => {
        abfragen.push(String(sql));
        if (/FROM users u/.test(sql) && /JOIN roles r/.test(sql)) {
          return { rows: [
            { user_id: 10, user_type: 'admin', role_name: 'org_admin', organization_id: 1, hat_push: false },
            { user_id: 11, user_type: 'admin', role_name: 'admin', organization_id: 1, hat_push: false },
          ] };
        }
        return { rows: [] };
      }
    };

    // Ohne nurZaehler: Die Vergabe-Pruefung waere hier grundsaetzlich erlaubt.
    await BackgroundService.updateAllUserBadges(db);

    const rollenAbfrageDerVergabe = abfragen.some(q =>
      /SELECT u\.organization_id, u\.display_name as name, r\.name as role_name/.test(q));
    expect(rollenAbfrageDerVergabe).toBe(false);
  });
});
