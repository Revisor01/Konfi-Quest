// backend/tests/utils/pushKanaele.test.js
//
// Android-Benachrichtigungskanaele (11.09.2026).
//
// Ohne eigene Kanaele legt das FCM-SDK jede Mitteilung im Notfallkanal
// `fcm_fallback_notification_channel` ab. In den Android-Einstellungen stand
// bei Konfi Quest deshalb genau ein Eintrag namens "Sonstiges" — wer die
// Terminmeldungen leiser stellen wollte, schaltete den Chat zwangslaeufig mit
// ab. Gemessen am 11.09.2026 im Emulator per `dumpsys notification`.
//
// Diese Tests halten zwei Dinge fest:
//   1. Jeder `data.type`, den pushService.js verschickt, hat einen Kanal.
//      Kommt ein Typ dazu und wird die Zuordnung vergessen, faellt das hier
//      auf — nicht erst auf dem Geraet.
//   2. Die Kanal-Kennungen des Servers und die der App sind dieselben.
//      Weichen sie ab, schickt der Server auf einen Kanal, den das Geraet
//      nicht kennt, und alles landet wieder unter "Sonstiges".
const fs = require('fs');
const path = require('path');
// firebase.js bindet die SDK-Funktionen beim Laden fest
// (`const { getMessaging } = require(...)` in Zeile 7). Ein Spy, der ERST
// danach gesetzt wird, erreicht diese Bindung nicht mehr — er ersetzt nur die
// Eigenschaft am Modul-Objekt. Die Spies muessen deshalb stehen, BEVOR
// firebase.js zum ersten Mal geladen wird; dasselbe Vorgehen wie in
// pushService.test.js, wo vi.spyOn ebenfalls vor dem Require steht.
const messagingModul = require('firebase-admin/messaging');
const appModul = require('firebase-admin/app');

// Alle an FCM uebergebenen Nachrichten. Die Spies stehen hier auf Modulebene
// und bleiben fuer die ganze Datei bestehen — kein restoreAllMocks, das sie
// abraeumen wuerde, waehrend firebase.js weiter die gespieten Bindungen haelt.
const gesendet = [];
vi.spyOn(messagingModul, 'getMessaging').mockReturnValue({
  send: async (message) => {
    gesendet.push(message);
    return 'test-message-id';
  }
});

// Die Initialisierung am SDK abfangen, NICHT per Spy auf
// firebaseModul.initializeFirebase: Die Sendefunktionen rufen
// `initializeFirebase()` lokal gebunden auf (firebase.js:125 und :174), ein
// Spy am Modul-Objekt erreicht diesen Aufruf also nie.
//
// Warum das in der CI auffiel und lokal nicht (11.09.2026): Auf dem
// Entwicklerrechner liegt eine echte push/firebase-service-account.json, die
// Initialisierung gelang dort auch ohne Spy. Im CI-Lauf fehlt die Datei — sie
// gehoert nicht ins oeffentliche Repo —, `initializeFirebase()` lieferte null
// und der Versand brach ab, bevor die Nachricht gebaut war. Mit diesen beiden
// Spies laeuft der Test unabhaengig davon, ob die Datei da ist.
vi.spyOn(appModul, 'cert').mockReturnValue({});
vi.spyOn(appModul, 'initializeApp').mockReturnValue({});
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });

const firebaseModul = require('../../push/firebase');

const {
  kanalFuerTyp,
  KANAL_JE_TYP,
  KANAL_STANDARD
} = firebaseModul;

// Alle `type: '...'`-Werte, die pushService.js tatsaechlich in einen
// data-Payload schreibt. Bewusst aus der Quelle gelesen statt abgetippt: eine
// abgetippte Liste veraltet still, sobald jemand einen Typ ergaenzt.
const typenAusPushService = () => {
  const quelle = fs.readFileSync(
    path.join(__dirname, '../../services/pushService.js'),
    'utf8'
  );
  const treffer = quelle.match(/type: '([a-z_]+)'/g) || [];
  const typen = treffer.map((t) => t.replace(/type: '([a-z_]+)'/, '$1'));
  // 'badge_update' ist der stille Push zur Icon-Zahl. Er zeigt nichts an und
  // braucht deshalb keinen Kanal (sendFirebaseSilentPush schickt bewusst
  // keinen notification-Block).
  return [...new Set(typen)].filter((t) => t !== 'badge_update');
};

// Kanal-Kennungen, die die App anlegt (services/notifications.ts). Ebenfalls
// aus der Quelle gelesen, damit die beiden Seiten nicht auseinanderlaufen.
const kanaeleAusApp = () => {
  const quelle = fs.readFileSync(
    path.join(__dirname, '../../../frontend/src/services/notifications.ts'),
    'utf8'
  );
  const block = quelle.match(/const KANAELE: Kanal\[\] = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('KANAELE-Block in notifications.ts nicht gefunden');
  const treffer = block[1].match(/id: '([a-z_]+)'/g) || [];
  return treffer.map((t) => t.replace(/id: '([a-z_]+)'/, '$1'));
};

describe('Push-Kanaele: jeder Typ hat einen', () => {
  it('ordnet jeden versendeten data.type einem Kanal zu', () => {
    const typen = typenAusPushService();

    // Gegenprobe, dass das Auslesen ueberhaupt etwas gefunden hat: eine leere
    // Liste wuerde die Schleife darunter stillschweigend durchwinken.
    //
    // DIE ZAHL IST EIN ZAEHLER, KEINE REGEL: Sie waechst mit jedem neuen
    // Push-Typ (zuletzt 'event_reactivated' am 16.09.2026). Die Regel steht
    // in der Zeile darunter -- KEIN Typ ohne Kanal. Wer hier hochzaehlt,
    // ohne den neuen Typ in KANAL_JE_TYP einzutragen, faellt weiterhin auf.
    // 26.09.2026: 31 -> 32. 'gemeinde_einladung' kam dazu.
    // 27.09.2026: 32 -> 34. 'event_removed' und 'event_waitlisted' (die
    // Leitung traegt aus bzw. setzt auf die Warteliste, F-06/BF-14).
    // 27.09.2026: 34 -> 35. 'gemeinde_einladung_beantwortet' (Antwort auf
    // eine Einladung an die einladende Leitung, F-13/BF-21).
    expect(typen.length).toBe(35);
    expect(typen).toContain('chat');
    expect(typen).toContain('event_reminder');

    const ohneKanal = typen.filter((typ) => !(typ in KANAL_JE_TYP));
    expect(ohneKanal).toEqual([]);
  });

  it('legt die vier Kanaele erwartungsgemaess an', () => {
    expect(kanalFuerTyp('chat')).toBe('konfi_chat');
    expect(kanalFuerTyp('event_reminder')).toBe('konfi_termine');
    expect(kanalFuerTyp('badge_earned')).toBe('konfi_fortschritt');
    expect(kanalFuerTyp('new_activity_request')).toBe('konfi_verwaltung');
  });

  it('faellt bei einem unbekannten Typ auf einen benannten Kanal zurueck', () => {
    // Nicht auf den FCM-Notfallkanal: ein vergessener Typ soll in einem Kanal
    // landen, den Nutzer:innen in den Einstellungen wiederfinden.
    expect(kanalFuerTyp('gibt_es_nicht')).toBe(KANAL_STANDARD);
    expect(kanalFuerTyp(undefined)).toBe(KANAL_STANDARD);
    expect(KANAL_STANDARD).toBe('konfi_fortschritt');
    expect(KANAL_STANDARD).not.toBe('fcm_fallback_notification_channel');
  });
});

describe('Push-Kanaele: die channelId steht im Payload', () => {
  // Hier laeuft die ECHTE sendFirebasePushNotification (in pushService.test.js
  // ist sie gemockt). Abgefangen wird nur der FCM-Versand — geprueft wird die
  // Nachricht, die dort ankaeme.
  //
  // Der Spy auf getMessaging steht oben auf Modulebene, vor dem Require von
  // firebase.js — die Begruendung dazu steht dort. Ein vi.resetModules() darf
  // hier nicht stehen: es laedt firebase.js neu, und das neue Exemplar bindet
  // dann wieder das echte getMessaging.
  beforeEach(() => {
    gesendet.length = 0;
  });

  it('setzt den Chat-Kanal bei einer Chat-Nachricht', async () => {
    const ergebnis = await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Jahrgang 2026/27',
      body: 'Lasse: Moin',
      data: { type: 'chat', roomId: '96' }
    });

    expect(ergebnis.success).toBe(true);
    expect(gesendet.length).toBe(1);
    expect(gesendet[0].android.notification.channelId).toBe('konfi_chat');
  });

  it('setzt den Termin-Kanal bei einer Erinnerung', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Morgen',
      body: 'Konfistunde',
      data: { type: 'event_reminder' }
    });

    expect(gesendet.length).toBe(1);
    expect(gesendet[0].android.notification.channelId).toBe('konfi_termine');
  });

  it('setzt auch ohne data-Feld einen benannten Kanal', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Konfi Quest',
      body: 'Ohne Typ'
    });

    expect(gesendet.length).toBe(1);
    expect(gesendet[0].android.notification.channelId).toBe('konfi_fortschritt');
  });

  it('laesst die hohe Prioritaet und den Ton unangetastet', async () => {
    // Die channelId kommt HINZU — sie darf nichts verdraengen, was die
    // Zustellung bisher sicherstellte.
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'T',
      body: 'B',
      badge: 3,
      data: { type: 'chat' }
    });

    expect(gesendet.length).toBe(1);
    expect(gesendet[0].android.priority).toBe('high');
    expect(gesendet[0].android.notification.sound).toBe('default');
    expect(gesendet[0].android.notification.defaultSound).toBe(true);
    expect(gesendet[0].apns.payload.aps.badge).toBe(3);
  });

  it('schickt beim stillen Badge-Push keinen Kanal mit', async () => {
    // sendFirebaseSilentPush soll nichts anzeigen. Ein notification-Block
    // (und damit ein Kanal) wuerde daraus eine sichtbare Mitteilung machen.
    await firebaseModul.sendFirebaseSilentPush('token-x', 5);

    expect(gesendet.length).toBe(1);
    expect(gesendet[0].android.notification).toBeUndefined();
    expect(gesendet[0].data.type).toBe('badge_update');
  });
});

describe('Zahl am App-Symbol auf Android: kommt aus den liegenden Mitteilungen', () => {
  // Simon, 29.09.2026: "auf dem Icon keine Badges auf Android". Naheliegend
  // waere, die iOS-Zahl (aps.badge) auch als android.notification.
  // notificationCount mitzuschicken. Das waere falsch:
  //
  // notificationCount heisst laut firebase-admin "the number of items this
  // notification represents". Der Launcher ADDIERT die Zahlen aller
  // liegenden Mitteilungen einer App (AOSP Launcher3, DotInfo: mTotalCount
  // += notificationKey.count, count = max(1, notification.number)). Truege
  // jede Mitteilung die Gesamtzahl, ergaeben drei Pushes mit 3, 4 und 5
  // offenen Dingen am Symbol 12 statt 5. Ohne das Feld zaehlt jede
  // Mitteilung als eine -- das ist, was Samsung als Zahl und Pixel als Punkt
  // zeigt. Die Zahl der App selbst setzt auf Android die App (AppSymbolZahl,
  // frontend/src/__tests__/config/androidPushEmpfang.test.ts). Einzige
  // Ausnahme: Geraete mit Weg "mitteilungen" (naechster Block) -- dort
  // zusammen mit einem festen tag, damit nur eine Mitteilung liegt.
  beforeEach(() => {
    gesendet.length = 0;
  });

  it('schickt die iOS-Zahl nicht als notificationCount an Android', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Neue Nachricht',
      body: 'Jahrgang 2026/27',
      badge: 7,
      data: { type: 'chat', roomId: '96' }
    });

    expect(gesendet.length).toBe(1);
    expect(Object.keys(gesendet[0].android.notification).sort()).toEqual(
      ['channelId', 'defaultSound', 'sound']
    );
    expect(gesendet[0].android.notification.notificationCount).toBeUndefined();
    // iOS bleibt, wie es ist: dort setzt aps.badge die Zahl direkt.
    expect(gesendet[0].apns.payload.aps.badge).toBe(7);
  });

  it('schickt auch Geraeten mit Weg "anbieter" keinen tag und keine Zahl', async () => {
    // Dort setzt die App die Zahl selbst (stilles badge_update hinterher);
    // die Mitteilungen bleiben einzeln in der Leiste wie auf dem iPhone.
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Neue Nachricht', body: 'B', badge: 7, appSymbolWeg: 'anbieter', data: { type: 'chat' }
    });

    expect(Object.keys(gesendet[0].android.notification).sort()).toEqual(['channelId', 'defaultSound', 'sound']);
  });
});

describe('Zahl am App-Symbol auf Android, Weg "mitteilungen" (Samsung, Xiaomi)', () => {
  // Simon, 29.09.2026: "Ich will Android exakt gleich wie iOS" -- gewaehlt
  // "Zahl wie iOS". Wo der Startbildschirm die Zahl nur aus den liegenden
  // Mitteilungen rechnet, gibt es keinen anderen Weg: Jede Mitteilung
  // ersetzt die vorige (fester tag) und traegt die Gesamtzahl. Weil dann
  // immer nur EINE liegt, ist die Summe des Startbildschirms die Zahl --
  // das Problem der Addition (Test oben) tritt nicht auf.
  beforeEach(() => {
    gesendet.length = 0;
  });

  it('gibt der Mitteilung den festen tag und die Gesamtzahl mit', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Neue Nachricht', body: 'B', badge: 7, appSymbolWeg: 'mitteilungen', data: { type: 'chat', roomId: '96' }
    });

    expect(gesendet).toHaveLength(1);
    expect(gesendet[0].android.notification).toEqual({
      channelId: 'konfi_chat',
      sound: 'default',
      defaultSound: true,
      tag: 'konfi_app_symbol',
      notificationCount: 7,
    });
    // Alles andere bleibt: Prioritaet, iOS-Zahl, data ohne Zusatzfeld.
    expect(gesendet[0].android.priority).toBe('high');
    expect(gesendet[0].apns.payload.aps.badge).toBe(7);
    expect(gesendet[0].data).toEqual({ type: 'chat', roomId: '96' });
  });

  it('traegt auch die 0, wenn nichts offen ist', async () => {
    await firebaseModul.sendFirebasePushNotification('token-x', {
      title: 'Morgen', body: 'Konfistunde', badge: 0, appSymbolWeg: 'mitteilungen', data: { type: 'event_reminder' }
    });

    expect(gesendet[0].android.notification.tag).toBe('konfi_app_symbol');
    expect(gesendet[0].android.notification.notificationCount).toBe(0);
  });

  it('der tag ist derselbe, unter dem die App die liegende Mitteilung sucht', () => {
    const { MITTEILUNG_TAG } = require('../../utils/appSymbolWeg');
    const java = fs.readFileSync(path.join(__dirname,
      '../../../frontend/android/app/src/main/java/de/godsapp/konfiquest/AppSymbolZahl.java'), 'utf8');
    expect(MITTEILUNG_TAG).toBe('konfi_app_symbol');
    expect(java).toContain(`static final String MITTEILUNG_TAG = "${MITTEILUNG_TAG}";`);
  });
});

describe('Push-Kanaele: Server und App meinen dieselben', () => {
  it('kennt in der App genau die Kanaele, auf die der Server schickt', () => {
    const inDerApp = kanaeleAusApp().sort();
    const vomServer = [...new Set(Object.values(KANAL_JE_TYP))].sort();

    // Gegenprobe: leeres Auslesen wuerde sonst als Gleichheit durchgehen.
    expect(inDerApp.length).toBe(4);
    expect(inDerApp).toEqual(vomServer);
  });

  it('legt auch den Rueckfall-Kanal in der App an', () => {
    expect(kanaeleAusApp()).toContain(KANAL_STANDARD);
  });

  it('nennt die Kanaele Wort fuer Wort wie die Auswahl in der App', () => {
    // Audit 26.09.2026, UI BF-11: Die Android-Kanaele beschrieben sich als
    // "Anmeldungen, Aenderungen, ..." und "... der Rueckblick", die
    // Push-Auswahl in der App (utils/pushGruppen.js, geliefert ueber
    // GET /notifications/preferences) als "Änderungen" und "Rückblick".
    // pushGruppen.js verspricht "Wort fuer Wort dieselben" -- geprueft hat
    // das bisher niemand. Die Namen stehen in den Android-Einstellungen,
    // die Gruppen in der App; heissen sie verschieden, sucht man das eine
    // unter dem Namen des anderen.
    const quelle = fs.readFileSync(
      path.join(__dirname, '../../../frontend/src/services/notifications.ts'),
      'utf8'
    );
    const block = quelle.match(/const KANAELE: Kanal\[\] = \[([\s\S]*?)\n\];/)[1];
    const inDerApp = [...block.matchAll(/id: '([a-z_]+)',\s*name: '([^']+)',\s*description: '([^']+)'/g)]
      .map(([, id, name, beschreibung]) => ({ id, name, beschreibung }));
    const { GRUPPEN } = require('../../utils/pushGruppen');
    const vomServer = GRUPPEN.map(({ id, name, beschreibung }) => ({ id, name, beschreibung }));

    // Gegenprobe: vier Kanaele, sonst hat das Muster nichts gefunden.
    expect(inDerApp).toHaveLength(4);
    expect(inDerApp).toEqual(vomServer);
  });
});
