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

const KANAL_CHAT = 'konfi_chat';
const KANAL_TERMINE = 'konfi_termine';
const KANAL_FORTSCHRITT = 'konfi_fortschritt';
const KANAL_VERWALTUNG = 'konfi_verwaltung';

// Rueckfall fuer einen Typ, der hier (noch) nicht steht. Bewusst der
// Fortschritts-Kanal und nicht der Notfallkanal: ein vergessener Typ soll in
// einem benannten Kanal landen, nicht wieder unter "Sonstiges".
const KANAL_STANDARD = KANAL_FORTSCHRITT;

// Jeder `data.type` aus pushService.js gehoert genau einem Kanal. Kommt dort
// ein Typ dazu, gehoert er hier eingetragen.
const KANAL_JE_TYP = {
  // Unterhaltungen
  chat: KANAL_CHAT,

  // Termine: Anmeldung, Absage, Aenderung, Erinnerung, Warteliste, Teilnahme
  event_registered: KANAL_TERMINE,
  event_unregistered: KANAL_TERMINE,
  event_cancelled: KANAL_TERMINE,
  event_changed: KANAL_TERMINE,
  event_reminder: KANAL_TERMINE,
  event_attendance: KANAL_TERMINE,
  new_event: KANAL_TERMINE,
  mandatory_event_created: KANAL_TERMINE,
  waitlist_promotion: KANAL_TERMINE,

  // Eigener Fortschritt: Punkte, Abzeichen, Level, Challenges, Rueckblick
  activity_assigned: KANAL_FORTSCHRITT,
  activity_request_status: KANAL_FORTSCHRITT,
  bonus_points: KANAL_FORTSCHRITT,
  badge_earned: KANAL_FORTSCHRITT,
  level_up: KANAL_FORTSCHRITT,
  certificate: KANAL_FORTSCHRITT,
  challenge_started: KANAL_FORTSCHRITT,
  challenge_badge_earned: KANAL_FORTSCHRITT,
  challenge_submission_hidden: KANAL_FORTSCHRITT,
  wrapped: KANAL_FORTSCHRITT,

  // Meldungen an Leitung und Team: etwas wartet auf eine Entscheidung
  new_activity_request: KANAL_VERWALTUNG,
  new_konfi_registration: KANAL_VERWALTUNG,
  challenge_submission: KANAL_VERWALTUNG,
  events_pending_approval: KANAL_VERWALTUNG,
  event_unregistration: KANAL_VERWALTUNG,
  event_opt_in: KANAL_VERWALTUNG,
  event_opt_out: KANAL_VERWALTUNG,
  teamer_event_booking: KANAL_VERWALTUNG,
  teamer_event_cancellation: KANAL_VERWALTUNG,
  jahrgang_deletion_warning: KANAL_VERWALTUNG
};

const kanalFuerTyp = (typ) => KANAL_JE_TYP[typ] || KANAL_STANDARD;

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
        throw new Error('Firebase Service Account not found in file or environment variable');
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
    // etwas nicht. Dort müsste die App das Paket entgegennehmen und die Zahl
    // selbst ans Badge-Plugin geben; einen Empfaenger für 'badge_update' gibt
    // es im Frontend derzeit nicht (nachgesehen am 24.08.2026). Der
    // android-Block mit hoher Prioritaet ist die Voraussetzung dafuer, dass
    // ein solcher Empfaenger das Paket überhaupt erreichen wuerde; ohne ihn
    // stuft FCM Datenpakete an schlafende Geraete zurück. Solange der
    // Empfaenger fehlt, bleibt der Android-Zähler das, was die laufende App
    // über BadgeContext setzt.
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
