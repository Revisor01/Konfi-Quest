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

// Seit 27.09.2026 (Befund BF-12) holt der Lauf die Gemeinden JE PERSON mit
// der dortigen Rolle ueber orgMitglieder.ladeMitgliedschaftenVieler --
// dieselbe Stelle wie Push und Gemeinde-Umschalter. Die Abfrage ist an
// is_primary zu erkennen; die Attrappen beantworten sie VOR der
// Personen-Abfrage, weil sie ebenfalls FROM users u / JOIN roles r enthaelt.
const istMitgliedschaftsAbfrage = (sql) => /is_primary/.test(sql);
const mitgliedschaft = (userId, organizationId, roleName, isPrimary = true) =>
  ({ user_id: userId, organization_id: organizationId, role_name: roleName, is_primary: isPrimary, org_aktiv: true });

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
        if (istMitgliedschaftsAbfrage(sql)) {
          return { rows: [mitgliedschaft(1, 1, 'konfi')] };
        }
        if (/FROM users u/.test(sql)) {
          return { rows: [{ user_id: 1, organization_id: 1, user_type: 'konfi', role_name: 'konfi', hat_push: false }] };
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
  // ("Org-Leitung") und `admin` ("Leitung"). Der Filter lautete
  // `r.name != 'admin'` unter dem Kommentar "Alle Konfis und
  // Teamer:innen" — die Negation liess org_admin also MITLAUFEN und
  // schloss nur die Rolle `admin` aus. Deren App-Icon wurde im Hintergrund
  // nie nachgefuehrt, obwohl es einen Zaehler hat (Chat + Antraege +
  // Termine + Freigaben, siehe BadgeContext).
  // ==================================================================
  it('M3: laedt beide Leitungsrollen, nicht nur eine', async () => {
    let empfaengerAbfrage = null;
    const db = {
      query: async (sql) => {
        if (istMitgliedschaftsAbfrage(sql)) return { rows: [] };
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
        if (istMitgliedschaftsAbfrage(sql)) {
          return { rows: [mitgliedschaft(10, 1, 'org_admin'), mitgliedschaft(11, 1, 'admin')] };
        }
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
  // ==================================================================
  // Multi-Org (Befund 28.08.2026, am Geraet nachgestellt): Der
  // Fuenf-Minuten-Sync rechnete nur mit der PRIMAER-Organisation.
  //
  // Gemessen an einem echten Konto: Org 1 = 6, Org 2 = 0, Org 4 = 29.
  // Der Push sendete nach seinem Fix korrekt 35 -- der Sync ueberschrieb
  // sie kurz darauf mit 6. Beobachtbar war genau das: Push zeigt 35,
  // App oeffnen zeigt 6, wenig spaeter 0.
  // ==================================================================
  it('Multi-Org: fragt alle Organisationen ab, nicht nur die Primaer-Org', async () => {
    const gefragteOrgs = [];
    const db = {
      query: async (sql, params) => {
        // Stamm-Gemeinde 1 aus dem Nutzerkonto, 4 und 2 ueber
        // user_organizations.
        if (istMitgliedschaftsAbfrage(sql)) {
          return { rows: [
            mitgliedschaft(41, 1, 'org_admin'),
            mitgliedschaft(41, 2, 'org_admin', false),
            mitgliedschaft(41, 4, 'org_admin', false),
          ] };
        }
        if (/FROM users u/.test(sql) && /JOIN roles r/.test(sql)) {
          return { rows: [{ user_id: 41, user_type: 'admin', role_name: 'org_admin', organization_id: 1, hat_push: false }] };
        }
        if (Array.isArray(params)) {
          for (const p of params.flat()) {
            if ([1, 2, 4].includes(p) && !gefragteOrgs.includes(p)) gefragteOrgs.push(p);
          }
        }
        return { rows: [] };
      }
    };

    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });

    // Verbotener Fall: nur die Primaer-Org -- so war es vor dem Fix.
    expect(gefragteOrgs).not.toEqual([1]);
    // Erlaubter Fall: alle drei, die Primaer-Org eingeschlossen.
    expect(gefragteOrgs.sort()).toEqual([1, 2, 4]);
  });

  it('Single-Org bleibt bei einer Organisation', async () => {
    const gefragteOrgs = [];
    const db = {
      query: async (sql, params) => {
        if (istMitgliedschaftsAbfrage(sql)) return { rows: [mitgliedschaft(58, 1, 'konfi')] };
        if (/FROM users u/.test(sql) && /JOIN roles r/.test(sql)) {
          return { rows: [{ user_id: 58, user_type: 'konfi', role_name: 'konfi', organization_id: 1, hat_push: false }] };
        }
        if (Array.isArray(params)) {
          for (const p of params.flat()) {
            if ([1, 2, 4].includes(p) && !gefragteOrgs.includes(p)) gefragteOrgs.push(p);
          }
        }
        return { rows: [] };
      }
    };
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(gefragteOrgs).toEqual([1]);
  });
});
