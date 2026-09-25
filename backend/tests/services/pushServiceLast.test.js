// backend/tests/services/pushServiceLast.test.js
//
// Der Push-Versand unter Last. Anlass: Der EKD-weite Rollout hebt die
// Nutzerzahl von 138 auf ueber 15.000. Eine einzige Ankuendigung an eine
// grosse Gemeinde laeuft durch sendToMultipleUsers -- und genau dort stand
// bis zum 24.09.2026 ein unbegrenztes Promise.all ueber ALLE Empfaenger, in
// dem jede Kette die Badge-Summe fuer sich allein rechnete.
//
// Gemessen am 24.09.2026 gegen die Test-Datenbank (Zaehl-Wrapper um db.query,
// derselbe wie unten): 7 Abfragen bei 1 Empfaenger, 21 bei 3, 40 bei 5 --
// streng linear. Bei 15.000 Empfaengern waeren das rund 120.000 Abfragen
// gegen 20 Pool-Plaetze; die Ketten jenseits der 20 liefen in den
// Verbindungs-Timeout, berechneBadge fing ihn und lieferte null, und die
// Pushes gingen stumm ohne Zahl am App-Icon raus.
//
// Diese Suite prueft drei Dinge mit konkreten Zahlen:
//   1. Die Badge-Summe wird EINMAL fuer alle gerechnet, nicht je Kopf.
//   2. Die Empfaenger laufen in Bloecken, nicht alle gleichzeitig.
//   3. Zeitweilige FCM-Fehler werden wiederholt, dauerhafte nicht.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

describe('PushService unter Last', () => {
  let db;
  let zaehler;
  let sqls;

  // Zaehl-Wrapper um den Pool: dieselbe Schnittstelle wie database.js
  // (query/getClient), zaehlt aber jede Abfrage mit. So laesst sich "wie viele
  // Abfragen entstehen bei N Empfaengern" als konkrete Zahl pruefen, statt sie
  // zu schaetzen.
  const zaehlDb = () => ({
    query: (text, params) => {
      zaehler++;
      sqls.push(String(text).replace(/\s+/g, ' ').trim());
      return db.query(text, params);
    },
    getClient: () => db.getClient(),
  });

  // Wie oft lief eine Abfrage, die auf das Muster passt?
  const anzahlMit = (muster) => sqls.filter((q) => q.includes(muster)).length;

  beforeAll(async () => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    const tokens = [
      [USERS.konfi1.id, 'last-konfi1', 'ios', 'dev-k1'],
      [USERS.konfi2.id, 'last-konfi2', 'ios', 'dev-k2'],
      [USERS.konfi3.id, 'last-konfi3', 'ios', 'dev-k3'],
      [USERS.teamer1.id, 'last-teamer1', 'ios', 'dev-t1'],
      [USERS.admin1.id, 'last-admin1', 'ios', 'dev-a1'],
      [USERS.orgAdmin1.id, 'last-orgadmin1', 'ios', 'dev-oa1'],
    ];
    for (const [userId, token, platform, deviceId] of tokens) {
      await db.query(
        'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
        [userId, token, platform, deviceId]
      );
    }
    sendFirebasePushNotification.mockClear();
    sendFirebasePushNotification.mockResolvedValue({ success: true });
    zaehler = 0;
    sqls = [];
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // 1. Badge-Summe einmal fuer alle statt einmal je Kopf
  // ================================================================
  describe('Badge-Summe fuer alle Empfaenger zusammen', () => {
    it('die Rollen-Abfrage laeuft EINMAL, nicht je Empfaenger', async () => {
      // Vorher: `ladeEmpfaengerFuerBadge` lief je Kopf, also 4x bei 4
      // Empfaengern. Der Kern des Befunds -- nachher genau einmal, egal wie
      // viele Empfaenger und welche Rollen.
      await PushService.sendToMultipleUsers(
        zaehlDb(),
        [USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, USERS.admin1.id],
        { title: 'Neues Event!', body: 'Melde dich an', data: { type: 'new_event' } }
      );

      expect(anzahlMit('r.name AS role_name')).toBe(1);
    });

    it('die Chat-Zaehler-Abfrage laeuft EINMAL je Organisation, nicht je Empfaenger', async () => {
      // chatZaehler ist eine der Abfragen INNERHALB von
      // appIconSummenFuerAlle. Vorher lief die ganze Bulk-Funktion je Kopf
      // mit einem einelementigen Array -- also 4x bei 4 Empfaengern.
      //
      // Hier bewusst nur Empfaenger EINER Organisation: appIconSummenFuerAlle
      // schluesselt nach `id_type` und wird deshalb je Organisation einmal
      // gerufen (Begruendung in berechneBadgesFuerAlle). Mit Empfaengern aus
      // zwei Gemeinden waeren zwei Aufrufe richtig, nicht einer.
      await PushService.sendToMultipleUsers(
        zaehlDb(),
        [USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, USERS.admin1.id],
        { title: 'Neues Event!', body: 'Melde dich an', data: { type: 'new_event' } }
      );

      expect(anzahlMit('FROM chat_messages m')).toBe(1);
    });

    it('bei 6 Empfaengern entstehen hoechstens 20 Abfragen (vorher 62)', async () => {
      // Gemessen am 24.09.2026 mit dem Zaehl-Wrapper: der alte Weg brauchte
      // 7-8 Abfragen je Kopf, bei diesen 6 gemischten Rollen 62. Die Grenze
      // hier ist bewusst absolut und nicht "weniger als vorher": Was zaehlt,
      // ist dass der Aufwand nicht mehr linear je Kopf waechst.
      await PushService.sendToMultipleUsers(
        zaehlDb(),
        [
          USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id,
          USERS.teamer1.id, USERS.admin1.id, USERS.orgAdmin1.id,
        ],
        { title: 'Neues Event!', body: 'Melde dich an', data: { type: 'new_event' } }
      );

      // 24.09.2026: 20 -> 22. Der Neuigkeiten-Zaehler fuer Challenges kam als
      // sechster Baustein dazu (utils/challengeNeuigkeiten). Er bringt zwei
      // KONSTANTE Abfragen mit -- nicht eine je Kopf. Die Aussage dieses Tests
      // bleibt damit unberuehrt: Der Aufwand waechst nicht linear je Empfaenger.
      // Genau das prueft der naechste Test ("je zusaetzlichem Empfaenger kommt
      // genau 1 Abfrage dazu") unabhaengig von dieser absoluten Zahl.
      // 25.09.2026: 22 -> 24. Das Postfach kam als Baustein in die App-Icon-
      // Summe (utils/appIconBadge.js, postfachZaehler): EINE Abfrage je
      // Summenlauf, nicht eine je Kopf -- und die Summe laeuft hier zweimal
      // (Stamm-Organisationen und Zweit-Organisationen, siehe
      // berechneBadgesFuerAlle), also zwei. new_event selbst schreibt keinen
      // Postfach-Eintrag (utils/postfachArten.js), sonst kaeme noch eine
      // konstante Abfrage je Block dazu.
      expect(zaehler).toBeLessThanOrEqual(24);
    });

    it('die Token-Abfrage laeuft EINMAL fuer alle, nicht je Empfaenger', async () => {
      // Nach dem Umbau der Badge-Rechnung war das die groesste verbliebene
      // Abfrage je Kopf -- bei 15.000 Empfaengern 15.000 Token-Abfragen, jede
      // mit Unterabfrage.
      await PushService.sendToMultipleUsers(
        zaehlDb(),
        [USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, USERS.admin1.id],
        { title: 'a', body: 'b', data: { type: 'new_event', organization_id: 1 } }
      );

      expect(anzahlMit('FROM push_tokens pt')).toBe(1);
    });

    it('je zusaetzlichem Empfaenger kommt genau 1 Abfrage dazu, nicht 8', async () => {
      // Die eigentliche Aussage in Zahlen, ohne absolute Grenze: Was je Kopf
      // bleibt, ist genau EINE Abfrage -- den Token als erreichbar vermerken.
      // Die ist unvermeidlich, sie schreibt je Geraet eine eigene Zeile.
      // Alles andere laeuft einmal fuer alle.
      //
      // Vorher waren es 7 bis 8 je Kopf (gemessen 24.09.2026: 7 bei einem
      // Empfaenger, 21 bei drei, 40 bei fuenf).
      //
      // Bewusst Konfis EINER Organisation mit je EINEM Geraet: Dann ist der
      // Unterschied zwischen zwei und vier Empfaengern genau der Aufwand je
      // Kopf. Eine zweite Organisation oder eine zweite Rolle wuerde zusaetzlich
      // Bulk-Abfragen ausloesen (je Organisation einmal, und rollenabhaengige
      // Zaehler fuer Antraege und Termine) -- das waere dann nicht mehr der
      // Preis je Kopf, sondern der Preis der Vielfalt.
      const zweiWeitereKonfis = [];
      for (const nr of [4, 5]) {
        const { rows: [u] } = await db.query(
          `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
           VALUES ($1, $1, 'x', $2, 1) RETURNING id`,
          [`lastkonfi${nr}`, USERS.konfi1.role_id]
        );
        await db.query(
          'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
          [u.id, `last-extra-${nr}`, 'ios', `dev-extra-${nr}`]
        );
        zweiWeitereKonfis.push(u.id);
      }

      await PushService.sendToMultipleUsers(
        zaehlDb(),
        [USERS.konfi1.id, USERS.konfi2.id],
        { title: 'a', body: 'b', data: { type: 'new_event', organization_id: 1 } }
      );
      const beiZwei = zaehler;

      zaehler = 0;
      sqls = [];
      await PushService.sendToMultipleUsers(
        zaehlDb(),
        [USERS.konfi1.id, USERS.konfi2.id, ...zweiWeitereKonfis],
        { title: 'a', body: 'b', data: { type: 'new_event', organization_id: 1 } }
      );
      const beiVier = zaehler;

      // Zwei Empfaenger mehr -> zwei Abfragen mehr (eine je Kopf).
      expect(beiVier - beiZwei).toBe(2);
    });

    it('die Zahl am App-Icon bleibt dieselbe wie beim Einzelversand', async () => {
      // Der Umbau darf die Summe nicht veraendern -- nur die Zahl der
      // Abfragen. Referenz ist der Einzelweg (sendToUser), der schon vorher
      // richtig rechnete.
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content)
         VALUES (1, $1, 'admin', 'Hallo')`,
        [USERS.admin1.id]
      );

      // new_event statt bonus_points (25.09.2026): bonus_points schreibt
      // seit dem Postfach je Versand eine ungelesene Mitteilung, die in der
      // Zahl am App-Icon mitzaehlt -- der zweite Versand haette dann
      // zwangslaeufig eine hoehere Zahl als der erste. Hier geht es um den
      // Rechenweg, nicht um die Art; new_event laesst das Postfach unberuehrt
      // (utils/postfachArten.js).
      await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'new_event' }
      });
      const einzeln = sendFirebasePushNotification.mock.calls
        .map(([, p]) => p.badge);
      sendFirebasePushNotification.mockClear();

      await PushService.sendToMultipleUsers(db, [USERS.konfi1.id], {
        title: 'a', body: 'b', data: { type: 'new_event' }
      });
      const inMenge = sendFirebasePushNotification.mock.calls
        .map(([, p]) => p.badge);

      expect(einzeln.length).toBe(1);
      expect(inMenge).toEqual(einzeln);
    });

    it('ein ausdruecklich uebergebener Badge hat weiter Vorrang', async () => {
      await PushService.sendToMultipleUsers(
        db,
        [USERS.konfi1.id, USERS.konfi2.id],
        { title: 'a', body: 'b', badge: 42, data: { type: 'new_event' } }
      );

      const badges = sendFirebasePushNotification.mock.calls.map(([, p]) => p.badge);
      expect(badges).toEqual([42, 42]);
    });
  });

  // ================================================================
  // 2. Blockweise Drosselung statt Promise.all ueber alle
  // ================================================================
  describe('Drosselung in Bloecken', () => {
    it('drei Bloecke ergeben genau zwei Pausen -- keine nach dem letzten', async () => {
      // Mit BLOCK = 2 (hier herabgesetzt) und 6 Empfaengern sind es drei
      // Bloecke und damit ZWEI Pausen dazwischen. Nach dem letzten Block wird
      // nicht mehr pausiert -- sonst verzoegerte jede Meldung an eine Handvoll
      // Leute ohne Grund.
      //
      // Gezaehlt wird die Pause an `schlafen`, nicht an der Uhr: Eine
      // gefaelschte Uhr muesste hier zwischen echten Datenbank-Zugriffen
      // vorgespult werden, und die Zahl der Pausen ist genau das, was die
      // Drosselung ausmacht.
      const originalBlock = PushService.EMPFAENGER_BLOCK;
      const schlafen = vi.spyOn(PushService, 'schlafen').mockResolvedValue(undefined);
      PushService.EMPFAENGER_BLOCK = 2;
      try {
        const ergebnis = await PushService.sendToMultipleUsers(
          db,
          [
            USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id,
            USERS.teamer1.id, USERS.admin1.id, USERS.orgAdmin1.id,
          ],
          { title: 'a', body: 'b', data: { type: 'new_event' } }
        );

        expect(ergebnis).toHaveLength(6);
        expect(schlafen).toHaveBeenCalledTimes(2);
        // Und zwar mit der Pause aus backgroundService, nicht mit einer
        // eigenen Zahl.
        expect(schlafen).toHaveBeenCalledWith(PushService.EMPFAENGER_PAUSE_MS);
      } finally {
        PushService.EMPFAENGER_BLOCK = originalBlock;
        schlafen.mockRestore();
      }
    });

    it('passen alle Empfaenger in einen Block, gibt es KEINE Pause', async () => {
      // Der erlaubte Gegenfall: Eine Meldung an drei Admins soll nicht
      // langsamer werden, nur weil es die Drosselung gibt.
      const schlafen = vi.spyOn(PushService, 'schlafen').mockResolvedValue(undefined);
      try {
        await PushService.sendToMultipleUsers(
          db,
          [USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id],
          { title: 'a', body: 'b', data: { type: 'new_event' } }
        );

        expect(schlafen).toHaveBeenCalledTimes(0);
      } finally {
        schlafen.mockRestore();
      }
    });

    it('nie mehr als EMPFAENGER_BLOCK Versandketten gleichzeitig offen', async () => {
      // Der eigentliche Zweck der Drosselung: Die Zahl der gleichzeitig
      // offenen Ketten ist begrenzt. Gemessen am Firebase-Mock, der jeden
      // Aufruf offen haelt, bis der Test ihn freigibt.
      const originalBlock = PushService.EMPFAENGER_BLOCK;
      PushService.EMPFAENGER_BLOCK = 2;
      try {
        let offen = 0;
        let maximalOffen = 0;
        const freigeben = [];
        sendFirebasePushNotification.mockImplementation(() => {
          offen++;
          maximalOffen = Math.max(maximalOffen, offen);
          return new Promise((resolve) => {
            freigeben.push(() => { offen--; resolve({ success: true }); });
          });
        });

        const lauf = PushService.sendToMultipleUsers(
          db,
          [
            USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id,
            USERS.teamer1.id, USERS.admin1.id, USERS.orgAdmin1.id,
          ],
          { title: 'a', body: 'b', data: { type: 'new_event' } }
        );

        // Warten, bis der erste Block wirklich sendet. Feste Microtask-Ticks
        // reichen hier nicht: Vor dem ersten FCM-Aufruf liegen echte
        // Datenbank-Zugriffe (die gemeinsame Badge-Rechnung und die Tokens).
        const warteAufOffene = async (wieViele) => {
          for (let i = 0; i < 200 && offen < wieViele; i++) {
            await new Promise((r) => setTimeout(r, 5));
          }
        };
        await warteAufOffene(2);

        // Solange nichts freigegeben wird, kommt der Lauf nicht weiter als
        // einen Block -- auch wenn wir ihm reichlich Zeit lassen.
        await new Promise((r) => setTimeout(r, 100));
        expect(offen).toBe(2);
        expect(maximalOffen).toBe(2);

        // Jetzt laufend freigeben, bis der Lauf durch ist. Die Schleife
        // endet, sobald `lauf` erfuellt ist -- und nicht nach einer geratenen
        // Zahl von Runden.
        let fertig = false;
        lauf.then(() => { fertig = true; });
        for (let runde = 0; runde < 200 && !fertig; runde++) {
          const jetzt = freigeben.splice(0, freigeben.length);
          for (const f of jetzt) f();
          await new Promise((r) => setTimeout(r, 10));
        }
        const ergebnis = await lauf;

        expect(ergebnis).toHaveLength(6);
        // Der Kern: NIE mehr als ein Block gleichzeitig offen, obwohl sechs
        // Empfaenger anstanden. Vorher waeren alle sechs auf einmal gelaufen.
        expect(maximalOffen).toBe(2);
      } finally {
        PushService.EMPFAENGER_BLOCK = originalBlock;
        sendFirebasePushNotification.mockResolvedValue({ success: true });
      }
    });

    it('die Antwortform bleibt ein Array mit einem Eintrag je Empfaenger', async () => {
      // Vertrag: sendToMultipleUsers liefert ein ARRAY. backgroundService
      // liest darauf `.success === false`, und aus einem Array darf kein
      // Objekt werden.
      const ergebnis = await PushService.sendToMultipleUsers(
        db,
        [USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id],
        { title: 'a', body: 'b', data: { type: 'new_event' } }
      );

      expect(Array.isArray(ergebnis)).toBe(true);
      expect(ergebnis).toHaveLength(3);
      expect(ergebnis.map((r) => r.userId)).toEqual([
        USERS.konfi1.id, USERS.konfi2.id, USERS.konfi3.id,
      ]);
      for (const eintrag of ergebnis) {
        expect(eintrag.sent).toBe(1);
        expect(eintrag.errors).toBe(0);
        expect(eintrag.total).toBe(1);
      }
    });
  });

  // ================================================================
  // 3. Wiederholen bei zeitweiligen FCM-Fehlern
  // ================================================================
  describe('Wiederholung bei zeitweiligen Fehlern', () => {
    // Die Pausen werden an `schlafen` gezaehlt und nicht echt abgewartet.
    // Eine gefaelschte Uhr ginge hier nicht: Zwischen den Versuchen liegen
    // echte Datenbank-Zugriffe, und pg haengt an eigenen Timern -- werden die
    // mit gefaelscht, reisst die Verbindung mitten im Test.
    const pausenZaehler = () => vi.spyOn(PushService, 'schlafen').mockResolvedValue(undefined);

    it('quota-exceeded wird wiederholt und kommt beim zweiten Versuch an', async () => {
      const schlafen = pausenZaehler();
      sendFirebasePushNotification
        .mockResolvedValueOnce({ success: false, error: 'quota', errorCode: 'messaging/quota-exceeded' })
        .mockResolvedValue({ success: true });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(2);
      // Genau eine Pause vor dem zweiten Versuch -- nicht sofort nachfassen.
      expect(schlafen).toHaveBeenCalledTimes(1);
      expect(ergebnis.sent).toBe(1);
      expect(ergebnis.errors).toBe(0);
      schlafen.mockRestore();
    });

    it('server-unavailable wird wiederholt', async () => {
      const schlafen = pausenZaehler();
      sendFirebasePushNotification
        .mockResolvedValueOnce({ success: false, error: 'weg', errorCode: 'messaging/server-unavailable' })
        .mockResolvedValue({ success: true });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(2);
      expect(ergebnis.sent).toBe(1);
      schlafen.mockRestore();
    });

    it('der Abstand waechst und nach drei Versuchen ist Schluss', async () => {
      const schlafen = pausenZaehler();
      sendFirebasePushNotification
        .mockResolvedValue({ success: false, error: 'weg', errorCode: 'messaging/server-unavailable' });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      // Kein endloses Wiederholen: genau WIEDERHOLUNG_VERSUCHE Versuche.
      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(3);
      expect(PushService.WIEDERHOLUNG_VERSUCHE).toBe(3);

      // Zwei Pausen zwischen drei Versuchen, und der Abstand VERDOPPELT sich:
      // 200 ms, dann 400 ms. Ein gleichbleibender Abstand waere bei
      // quota-exceeded falsch -- der Fehler sagt gerade, dass zu viel
      // gleichzeitig laeuft.
      expect(schlafen.mock.calls.map(([ms]) => ms)).toEqual([
        PushService.WIEDERHOLUNG_PAUSE_MS,
        PushService.WIEDERHOLUNG_PAUSE_MS * 2,
      ]);

      expect(ergebnis.sent).toBe(0);
      expect(ergebnis.errors).toBe(1);
      schlafen.mockRestore();
    });

    it('ein ungueltiger Token wird NICHT wiederholt, sondern geloescht', async () => {
      // Der erlaubte Gegenfall zum verbotenen: Bei einem dauerhaften Fehler
      // ist Wiederholen sinnlos -- der Token bleibt ungueltig, egal wie oft
      // man fragt. Genau ein Versuch, dann weg.
      sendFirebasePushNotification.mockResolvedValue({
        success: false,
        error: 'nicht registriert',
        errorCode: 'messaging/registration-token-not-registered',
      });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
      expect(ergebnis.sent).toBe(0);
      const { rows } = await db.query(
        'SELECT count(*)::int AS c FROM push_tokens WHERE token = $1', ['last-konfi1']
      );
      expect(rows[0].c).toBe(0);
    });

    it('ein unbekannter Fehler wird NICHT wiederholt', async () => {
      // Nur die zwei ausdruecklich als zeitweilig bekannten Codes werden
      // wiederholt. Alles andere koennte ein dauerhafter Fehler sein, und
      // blindes Wiederholen vervielfacht dann nur die Last.
      sendFirebasePushNotification.mockResolvedValue({
        success: false, error: 'kaputt', errorCode: 'messaging/invalid-argument',
      });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(1);
      expect(ergebnis.errors).toBe(1);
    });
  });

  // ================================================================
  // 4. Der Rueckgabewert sagt die Wahrheit
  // ================================================================
  describe('Rueckgabewert bildet den Versand ab', () => {
    it('schlaegt JEDER Token fehl, ist success false', async () => {
      // Vorher stand hier hart `success: true`, auch wenn kein einziger Push
      // ankam. Ein Versand, der nichts zugestellt hat, sah wie ein Erfolg aus.
      sendFirebasePushNotification.mockResolvedValue({
        success: false, error: 'kaputt', errorCode: 'messaging/invalid-argument',
      });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(ergebnis.success).toBe(false);
      expect(ergebnis.sent).toBe(0);
      expect(ergebnis.errors).toBe(1);
      expect(ergebnis.total).toBe(1);
    });

    it('kommt mindestens einer durch, bleibt success true (Teilerfolg)', async () => {
      // Zwei Geraete, eines scheitert dauerhaft. Der Versand hat etwas
      // zugestellt -- also Erfolg, mit der Fehlerzahl daneben.
      await db.query(
        'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
        [USERS.konfi1.id, 'last-konfi1-zweit', 'android', 'dev-k1b']
      );
      sendFirebasePushNotification
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValue({ success: false, error: 'kaputt', errorCode: 'messaging/invalid-argument' });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(ergebnis.success).toBe(true);
      expect(ergebnis.sent).toBe(1);
      expect(ergebnis.errors).toBe(1);
      expect(ergebnis.total).toBe(2);
    });

    it('bei Erfolg bleiben alle bisherigen Felder unveraendert', async () => {
      // Vertrag: Die Felder success/sent/errors/total behalten Name und Typ.
      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(ergebnis.success).toBe(true);
      expect(ergebnis.sent).toBe(1);
      expect(ergebnis.errors).toBe(0);
      expect(ergebnis.total).toBe(1);
    });
  });

  // ================================================================
  // 5. Mehrere Geraete einer Person
  // ================================================================
  describe('Mehrere Geraete einer Person', () => {
    it('jedes Geraet bekommt genau einen Aufruf', async () => {
      // Bewusst EIN Aufruf je Geraet und kein Sammelversand: Gemessen in
      // Produktion am 24.09.2026 haben 60 von 69 Konten genau ein Geraet, im
      // Schnitt 1,19 -- ein Sammelversand buendelte fast immer eine einzige
      // Nachricht. Die Begruendung steht ausfuehrlich in pushService.js.
      for (const [token, device] of [['last-k1-b', 'dev-k1b'], ['last-k1-c', 'dev-k1c']]) {
        await db.query(
          'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
          [USERS.konfi1.id, token, 'android', device]
        );
      }

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(sendFirebasePushNotification).toHaveBeenCalledTimes(3);
      expect(ergebnis.sent).toBe(3);
      expect(ergebnis.total).toBe(3);
    });

    it('Teilerfolg: der ungueltige Token wird geloescht, der gute bleibt', async () => {
      // Das Aufraeumen haengt an der Fehlerbehandlung PRO TOKEN. Sie muss den
      // Umbau ueberleben, sonst sammeln sich totgeglaubte Geraete an.
      await db.query(
        'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
        [USERS.konfi1.id, 'last-k1-kaputt', 'android', 'dev-k1b']
      );
      sendFirebasePushNotification.mockImplementation(async (token) => token === 'last-k1-kaputt'
        ? { success: false, error: 'weg', errorCode: 'messaging/registration-token-not-registered' }
        : { success: true });

      const ergebnis = await PushService.sendToUser(db, USERS.konfi1.id, {
        title: 'a', body: 'b', data: { type: 'bonus_points' }
      });

      expect(ergebnis.sent).toBe(1);
      expect(ergebnis.errors).toBe(1);
      const { rows } = await db.query(
        'SELECT token FROM push_tokens WHERE user_id = $1 ORDER BY token', [USERS.konfi1.id]
      );
      expect(rows.map((r) => r.token)).toEqual(['last-konfi1']);
    });
  });
});
