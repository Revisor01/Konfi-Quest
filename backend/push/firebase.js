// Ab firebase-admin v14 gibt es den Legacy-Namespace `admin.credential` nicht
// mehr — `cert` und `initializeApp` liegen im Modul firebase-admin/app. Ohne
// diese Umstellung scheitert der Start mit "Cannot read properties of
// undefined (reading 'cert')" und es geht KEIN Push mehr raus (Prod 21.08.2026).
const { initializeApp, cert } = require('firebase-admin/app');
// Gleiches gilt für admin.messaging() — in v14 nur noch über getMessaging().
const { getMessaging } = require('firebase-admin/messaging');

// ---------------------------------------------------------------------------
// Android-Benachrichtigungskanäle
//
// Ab Android 8 haengt JEDE Mitteilung an einem Kanal, und die Einstellungen des
// Betriebssystems lassen sich nur PRO KANAL bedienen: Ton, Vibration,
// Stummschalten. Ohne eigenen Kanal legt das FCM-SDK die Mitteilung im
// Notfallkanal `fcm_fallback_notification_channel` ab — der heisst auf Deutsch
// "Sonstiges", hat keine Beschreibung und keine Vibration. In den
// Android-Einstellungen stand bei Konfi Quest deshalb genau ein Eintrag
// "Sonstiges", und wer die Terminmeldungen leiser stellen wollte, schaltete
// zwangslaeufig auch den Chat mit ab (gemessen am 11.09.2026 per
// `dumpsys notification`).
//
// AELTERE APP-FASSUNGEN BRECHEN DADURCH NICHT. Nachgemessen am 11.09.2026 im
// Emulator gegen die ausgelieferte Fassung: Eine channelId, die das Geraet
// nicht kennt, verhindert die Zustellung NICHT — das FCM-SDK faellt auf den
// Notfallkanal zurueck, Titel und Text erscheinen wie bisher. Ein frueherer
// Kommentar an dieser Stelle behauptete das Gegenteil ("eine unbekannte
// channelId wuerde die Zustellung verhindern") und nahm zusaetzlich an, das
// Capacitor-Plugin lege selbst einen Default-Kanal an. Beides ist falsch:
// PushNotificationsPlugin.createChannel() laeuft ausschliesslich auf
// ausdruecklichen Aufruf.
//
// Die Kanaele werden in der App angelegt (frontend/src/services/
// pushChannels.ts). Wer hier einen Kanal ergaenzt, muss ihn DORT ebenfalls
// anlegen — sonst landet er auf dem Geraet wieder unter "Sonstiges".
// ---------------------------------------------------------------------------

// Die Zuordnung Art -> Kanal wohnt seit dem 25.09.2026 in
// utils/pushGruppen.js: Dieselben vier Toepfe sind dort auch die Gruppen,
// die Nutzende IN DER APP ab- und anwaehlen koennen (auf iOS gibt es keine
// Kanaele). Eine Quelle fuer beides, damit "Termine" auf dem Geraet und
// "Termine" in der App nie zweierlei meinen. Hier bleiben nur die alten
// Namen als Aliasse, damit bestehende Aufrufer und Tests weiterlaufen.
const { GRUPPE_JE_ART, GRUPPE_STANDARD, gruppeFuerArt } = require('../utils/pushGruppen');
const KANAL_JE_TYP = GRUPPE_JE_ART;
const KANAL_STANDARD = GRUPPE_STANDARD;
const kanalFuerTyp = gruppeFuerArt;
const { APP_SYMBOL_WEGE, MITTEILUNG_TAG } = require('../utils/appSymbolWeg');
const { mitteilungsKennung } = require('../utils/mitteilungsKennung');

// Firebase Admin initialisieren (Service Account wird später hinzugefügt)
let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Service Account Key wird aus Datei geladen (bevorzugt) oder Environment Variable
    let serviceAccount;
    try {
      serviceAccount = require('./firebase-service-account.json');
    } catch (fileError) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } else {
        throw new Error('Firebase Service Account not found in file or environment variable', { cause: fileError });
      }
    }

    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    return firebaseApp;
  } catch (error) {
    console.error('Firebase initialization failed:', error.message);
    return null;
  }
};

const sendFirebasePushNotification = async (deviceToken, notificationData) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    // Zahl am App-Symbol auf Startbildschirmen, die sie aus den liegenden
    // Mitteilungen rechnen (Samsung One UI, Xiaomi; Weg "mitteilungen",
    // 29.09.2026, Simons Wahl "Zahl wie iOS"). Der Startbildschirm ADDIERT
    // die Zahlen aller liegenden Mitteilungen der App (Launcher3, DotInfo:
    // count = max(1, notification.number)). Deshalb beides zusammen:
    //   tag               jede Mitteilung ersetzt die vorige -- es liegt immer
    //                     nur eine, in der Leiste steht die neueste;
    //   notificationCount die Gesamtzahl, dieselbe wie aps.badge.
    // Nur fuer Geraete, deren App diesen Weg gemeldet hat
    // (utils/appSymbolWeg.js); fuer alle anderen bleibt der Block, wie er war.
    const zahlInDerMitteilung = notificationData.appSymbolWeg === APP_SYMBOL_WEGE.MITTEILUNGEN;

    const message = {
      token: deviceToken,
      notification: {
        title: notificationData.title || 'Konfi Quest',
        body: notificationData.body || notificationData.alert,
      },
      data: notificationData.data || {},
      android: {
        // Hohe Prioritaet, damit die Notification auf Android 8+ zuverlaessig
        // und sofort zugestellt wird.
        priority: 'high',
        notification: {
          // Kanal nach Art der Mitteilung (siehe KANAL_JE_TYP oben). Kennt das
          // Geraet den Kanal nicht — aeltere App-Fassung —, faellt das
          // FCM-SDK auf den Notfallkanal zurueck und stellt normal zu.
          channelId: kanalFuerTyp((notificationData.data || {}).type),
          sound: notificationData.sound || 'default',
          defaultSound: true,
          // notificationCount NUR zusammen mit dem festen tag (oben,
          // zahlInDerMitteilung). Das Feld heisst "the number of items this
          // notification represents", und der Launcher addiert es ueber alle
          // liegenden Mitteilungen der App (AOSP Launcher3, DotInfo). Mit der
          // iOS-Zahl in JEDER liegenden Mitteilung ergaeben drei Pushes mit
          // 3, 4 und 5 offenen Dingen am Symbol 12. Ohne das Feld zaehlt jede
          // Mitteilung als eine; die Zahl der App selbst setzt auf Android
          // die App (AppSymbolZahl). Test: pushKanaele.test.js.
          //
          // Alle anderen Geraete bekommen eine Kennung, an der die App die
          // Mitteilung beim Lesen des Chats oder beim Oeffnen der Events
          // wiederfindet (30.09.2026, utils/mitteilungsKennung.js): Auf
          // Android ist nur der tag zuruecklesbar, nicht data. Jede Kennung
          // ist einmalig -- in der Leiste liegt weiter jede Mitteilung
          // einzeln, wie ohne tag.
          ...(zahlInDerMitteilung
            ? { tag: MITTEILUNG_TAG, notificationCount: Math.max(0, Math.floor(Number(notificationData.badge) || 0)) }
            : { tag: mitteilungsKennung(notificationData.data || {}) }),
        },
      },
      apns: {
        payload: {
          aps: {
            badge: notificationData.badge || 0,
            sound: notificationData.sound || 'default',
          },
        },
        headers: {
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
      },
    };

    const response = await getMessaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Firebase notification error:', error);
    return { success: false, error: error.message, errorCode: error.code || null };
  }
};

const sendFirebaseSilentPush = async (deviceToken, badgeCount) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    // Auf iOS setzt aps.badge die Zahl am App-Icon direkt — Android kennt so
    // etwas nicht. Dort nimmt der Push-Dienst der App das Paket entgegen,
    // auch bei geschlossener App (KonfiMessagingService, seit 29.09.2026),
    // und setzt die Zahl ueber den Startbildschirm; laeuft die App, laedt
    // BadgeContext ausserdem die Zaehler neu ('push:received'). Der
    // android-Block mit hoher Prioritaet ist die Voraussetzung dafuer, dass
    // das Paket ein schlafendes Geraet ueberhaupt erreicht; ohne ihn stuft FCM
    // Datenpakete zurück. Ob der Startbildschirm eine Zahl annimmt, haengt vom
    // Hersteller ab (utils/appSymbolWeg.js; Handbuch "Die Zahl am App-Symbol
    // auf Android lesen").
    //
    // ALTE APPS (Store 2.2.x, kein eigener Dienst; nachgesehen am Tag 2.2.0):
    // Das Paket hat keinen notification-Block, das Push-Plugin zeigt deshalb
    // nichts an und reicht es nur als 'pushNotificationReceived' weiter; die
    // App laedt daraufhin ihre Zaehler neu. Sichtbar wird nichts.
    const message = {
      token: deviceToken,
      apns: {
        payload: {
          aps: {
            badge: badgeCount,
            'content-available': 1,
          },
        },
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
        },
      },
      android: {
        priority: 'high',
        // Bewusst ohne notification-Block: Das hier soll nichts anzeigen,
        // sondern nur die Zahl nachfuehren.
      },
      data: { type: 'badge_update', count: badgeCount.toString() },
    };

    const response = await getMessaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Firebase silent push error:', error);
    return { success: false, error: error.message, errorCode: error.code || null };
  }
};

module.exports = {
  initializeFirebase,
  sendFirebasePushNotification,
  sendFirebaseSilentPush,
  kanalFuerTyp,
  KANAL_JE_TYP,
  KANAL_STANDARD
};
