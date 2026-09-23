import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema } from '@capacitor/push-notifications';

// Zugestellte Notifications aus dem Mitteilungszentrum/Sperrbildschirm entfernen.
//
// Strategie (bewusst NICHT "beim App-Start alles löschen", damit ungelesene
// Erinnerungen nicht verschwinden, nur weil die App geoeffnet wurde):
//   1) Beim Antippen einer Notification -> genau diese entfernen.
//   2) Beim Oeffnen des zugehörigen Bereichs (Chat-Raum, Events) -> die
//      Notifications dieses Bereichs entfernen (an die Read-/Badge-Logik gekoppelt).
//
// Alle Funktionen sind no-ops im Web (kein natives Mitteilungszentrum) und
// schlucken Fehler defensiv: ein fehlgeschlagenes Aufräumen darf den Flow
// (Navigation, Mark-Read) nie blockieren.

/**
 * Nutzdaten eines Pushes, soweit die App sie liest.
 *
 * FCM liefert alle data-Werte als String, APNs teils als Zahl — deshalb sind
 * die Kennungen bewusst offen und werden vor dem Vergleich per String()
 * normalisiert.
 */
export interface PushNutzdaten {
  type?: string;
  roomId?: string | number;
  room_id?: string | number;
  organization_id?: string | number;
  [feld: string]: unknown;
}

// ---------------------------------------------------------------------------
// Benachrichtigungskanaele (nur Android)
//
// Ab Android 8 haengt jede Mitteilung an einem Kanal, und die Einstellungen des
// Betriebssystems lassen sich nur PRO KANAL bedienen: Ton, Vibration,
// Stummschalten. Legt die App keinen an, landet alles im Notfallkanal des
// FCM-SDK — der heisst "Sonstiges" und vibriert nicht. Wer dann die
// Terminmeldungen leiser stellen wollte, schaltete den Chat zwangslaeufig mit
// ab (gemessen 11.09.2026).
//
// Die Kennungen muessen zu KANAL_JE_TYP in backend/push/firebase.js passen —
// der Server schickt die channelId mit. Wer hier einen Kanal ergaenzt, traegt
// ihn DORT ebenfalls ein, sonst wird er nie benutzt.
//
// Nur Android: iOS kennt keine Kanaele, dort ist createChannel nicht
// verfuegbar. Ein erneuter Aufruf fuer einen bestehenden Kanal ist harmlos —
// Android aktualisiert dann nur Name und Beschreibung. Was Nutzer:innen selbst
// eingestellt haben (Ton, Wichtigkeit), bleibt dabei unangetastet; deshalb ist
// das hier bei jedem App-Start gefahrlos.
// ---------------------------------------------------------------------------

interface Kanal {
  id: string;
  name: string;
  description: string;
}

const KANAELE: Kanal[] = [
  {
    id: 'konfi_chat',
    name: 'Nachrichten',
    description: 'Neue Nachrichten in deinen Chats',
  },
  {
    id: 'konfi_termine',
    name: 'Termine',
    description: 'Anmeldungen, Aenderungen, Absagen und Erinnerungen',
  },
  {
    id: 'konfi_fortschritt',
    name: 'Punkte und Abzeichen',
    description: 'Punkte, Abzeichen, Level, Challenges und der Rueckblick',
  },
  {
    // Geht an Leitung und org_admin; bei der Challenge-Einreichung zusaetzlich
    // an die Teamer:innen des betroffenen Jahrgangs (siehe
    // sendChallengeSubmissionToLeadership). Deshalb kein Name wie "Fuer die
    // Leitung" — Teamer:innen bekaemen sonst Meldungen in einer Kategorie, die
    // ihnen sagt, sie sei nicht fuer sie. Bei Konfis bleibt der Kanal leer und
    // Android blendet ihn aus.
    id: 'konfi_verwaltung',
    name: 'Anfragen und Freigaben',
    description: 'Was auf deine Entscheidung wartet',
  },
];

// IMPORTANCE_DEFAULT (3): Ton und Einblendung, aber kein Vollbild-Overlay.
// Bewusst derselbe Wert wie beim bisherigen Notfallkanal, damit sich fuer
// niemanden die Lautstaerke aendert — neu ist nur, dass es mehrere Kanaele
// gibt und sie Namen haben.
const WICHTIGKEIT_STANDARD = 3;

export const benachrichtigungskanaeleAnlegen = async (): Promise<void> => {
  if (Capacitor.getPlatform() !== 'android') return;
  for (const kanal of KANAELE) {
    try {
      await PushNotifications.createChannel({
        id: kanal.id,
        name: kanal.name,
        description: kanal.description,
        importance: WICHTIGKEIT_STANDARD,
        visibility: 1, // VISIBILITY_PUBLIC: auch auf dem Sperrbildschirm lesbar
        vibration: true,
      });
    } catch (error) {
      // Kein Hard-Fail: ohne Kanal landet die Mitteilung im Notfallkanal und
      // kommt trotzdem an. Das darf den App-Start nicht aufhalten.
      console.warn(`notifications: Kanal ${kanal.id} nicht angelegt:`, error);
    }
  }
};

// ALLE zugestellten Notifications entfernen. Bewusst sparsam einsetzen
// (z.B. für Admins, die ohnehin laufend Erinnerungen bekommen) — für
// normale Nutzer wäre "beim App-Start alles weg" zu aggressiv.
export const removeAllDelivered = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.warn('notifications: removeAllDelivered fehlgeschlagen:', error);
  }
};

/*
 * Genau EINE zugestellte Notification anhand ihrer id entfernen.
 *
 * DIE ID MUSS EINE ZAHL SEIN — sonst stuerzt die App ab (Android Vitals,
 * gemessen 23.09.2026: 4 betroffene Nutzende, 16 Abstuerze in 28 Tagen, alle
 * im Vordergrund, vier verschiedene Geraete, Android 16):
 *
 *   java.lang.NullPointerException: Attempt to invoke virtual method
 *   'int java.lang.Integer.intValue()' on a null object reference
 *     at PushNotificationsPlugin.removeDeliveredNotifications (…:170)
 *
 * Hier stand der Kommentar "restliche Felder werden vom Plugin ignoriert" —
 * das war falsch, und zwar gerade fuer die id. Das Plugin macht (Quelle:
 * capacitor-plugins/push-notifications, Android):
 *
 *   Integer id = notif.getInteger("id");
 *   if (tag == null) { notificationManager.cancel(id); }
 *
 * `getInteger` liefert null, sobald der Wert keine Zahl ist. Das folgende
 * `cancel(id)` erwartet ein primitives int, entpackt die null — und wirft.
 * Der Absturz passiert NATIV, im Bridge-Thread: Das try/catch hier unten
 * faengt ihn NICHT. Die Notification-ids von FCM sind auf Android Zahlen,
 * koennen aber als String ankommen; alles andere (etwa APNs-Kennungen, oder
 * eine leere Angabe) darf diesen Aufruf nie erreichen.
 *
 * Deshalb: nur numerische ids weitergeben, und zwar als Zahl. Ist die id
 * keine, wird NICHT aufgeraeumt — eine liegenbleibende Mitteilung im
 * Mitteilungszentrum ist ungleich harmloser als eine abstuerzende App.
 */
export const removeDeliveredById = async (id: string | number): Promise<void> => {
  if (!Capacitor.isNativePlatform() || id === '' || id === null || id === undefined) return;

  // Number() statt parseInt: "12abc" darf NICHT als 12 durchgehen, sonst
  // loeschen wir eine fremde Mitteilung. Number('') waere 0 — deshalb steht
  // die Leerpruefung oben.
  const nummer = Number(id);
  if (!Number.isInteger(nummer)) {
    // Kein Fehlerfall fuer die Nutzenden, nur nichts zu tun. Als Warnung, weil
    // es bedeutet, dass eine Mitteilung stehen bleibt.
    console.warn('notifications: id ist keine Zahl, kein Aufraeumen:', id);
    return;
  }

  try {
    await PushNotifications.removeDeliveredNotifications({
      // `as` bleibt noetig: Das Schema verlangt Felder, die das Plugin beim
      // Entfernen nicht liest — die id liest es sehr wohl (siehe oben).
      notifications: [{ id: nummer } as unknown as PushNotificationSchema],
    });
  } catch (error) {
    // Faengt nur JS-seitige Fehler; der native NPE oben ist damit NICHT
    // abgedeckt und deshalb vorher ausgeschlossen.
    console.warn('notifications: removeDeliveredById fehlgeschlagen:', error);
  }
};

// Alle zugestellten Notifications entfernen, die ein Praedikat erfuellen.
// Das Praedikat bekommt das vom Plugin gelieferte PushNotificationSchema
// (inkl. data-Payload). Liefert getDeliveredNotifications keine data (kommt
// auf manchen iOS-Versionen vor), wird die Notification NICHT entfernt
// (lieber liegen lassen als faelschlich löschen).
export const removeDeliveredWhere = async (
  predicate: (n: PushNotificationSchema) => boolean
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const delivered = await PushNotifications.getDeliveredNotifications();
    const match = (delivered.notifications || []).filter((n) => {
      try {
        return predicate(n);
      } catch {
        return false;
      }
    });
    if (match.length === 0) return;
    await PushNotifications.removeDeliveredNotifications({ notifications: match });
  } catch (error) {
    console.warn('notifications: removeDeliveredWhere fehlgeschlagen:', error);
  }
};

// Bequemer Wrapper: alle Chat-Notifications eines Raums entfernen.
// roomId kann im Push-Payload als String oder Number liegen -> beide vergleichen.
export const removeDeliveredForChatRoom = (roomId: number): Promise<void> =>
  removeDeliveredWhere((n) => {
    const data = (n.data ?? {}) as PushNutzdaten;
    if (data.type !== 'chat') return false;
    const rid = data.roomId ?? data.room_id;
    return rid != null && String(rid) === String(roomId);
  });

// Bequemer Wrapper: alle event-bezogenen Notifications entfernen
// (wird beim Oeffnen der Events-Seite genutzt).
const EVENT_NOTIFICATION_TYPES = new Set([
  'new_event',
  'event_registered',
  'event_unregistered',
  'waitlist_promotion',
  'event_attendance',
  'event_reminder',
  'event_cancelled',
  'event_reactivated',
  'event_unregistration',
  'events_pending_approval',
]);

export const removeDeliveredForEvents = (): Promise<void> =>
  removeDeliveredWhere((n) => {
    const typ = (n.data as PushNutzdaten | undefined)?.type;
    return typeof typ === 'string' && EVENT_NOTIFICATION_TYPES.has(typ);
  });
