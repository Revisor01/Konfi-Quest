import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge } from '@capawesome/capacitor-badge';
import { Capacitor } from '@capacitor/core';
import api from '../services/api';
import { writeQueue } from '../services/writeQueue';
import { networkMonitor } from '../services/networkMonitor';
import { initializeWebSocket } from '../services/websocket';
import { getToken } from '../services/tokenStore';
import { removeDeliveredForChatRoom } from '../services/notifications';
import { offlineCache } from '../services/offlineCache';
import { useApp } from './AppContext';
import { useLiveRefresh, useLiveUpdate, LiveUpdateType } from './LiveUpdateContext';

// Stabiles Array (Modul-Ebene) -> useLiveRefresh re-subscribt nicht bei jedem Render.
const BADGE_LIVE_TYPES: LiveUpdateType[] = ['requests', 'events', 'challenges'];

// Badge Context Interface
interface BadgeContextType {
  // Chat
  chatUnreadByRoom: Record<number, number>;
  chatUnreadTotal: number;
  // Admin-only
  pendingRequestsCount: number;
  pendingEventsCount: number;
  // Leitung (Admin + Teamer): offene Challenge-Freigaben
  pendingChallengesCount: number;
  /**
   * Offene Freigaben je Challenge (nur Team und Leitung) -- fuer die Kugel
   * am Listeneintrag, wie chatUnreadByRoom fuer den Chat. Der Server
   * liefert sie in challengeApprovals.byChallenge; die Summe ist
   * pendingChallengesCount. Konfis bekommen hier immer leer: ihre Zahl an
   * der Challenge sind die Neuigkeiten (challengeUpdatesByChallenge), das
   * ist etwas anderes und wird nicht vermischt.
   */
  pendingChallengesByChallenge: Record<number, number>;
  /** Ungesehene Abzeichen (Konfis und Teamer:innen). Die Leitung kann keine verdienen -> immer 0. */
  newBadgesCount: number;
  /**
   * Challenge-Neuigkeiten (nur Konfis), das Gegenstueck zu chatUnreadByRoom:
   * je laufender Challenge, was seit dem letzten Oeffnen dazukam -- die
   * Challenge selbst, fremde Galerie-Beitraege, Moderation eigener Beitraege.
   * Team und Leitung bekommen hier immer leer/0: ihr Reiter zaehlt Freigaben.
   */
  challengeUpdatesByChallenge: Record<number, number>;
  challengeUpdatesTotal: number;
  /**
   * Ungelesene Mitteilungen im Postfach (25.09.2026), ueber alle Gemeinden
   * des Kontos. Speist die Zahl an der Glocke in der Kopfzeile UND zaehlt in
   * totalBadgeCount mit -- fuer alle Rollen. Simon: "lass es dagegen
   * zaehlen, bitte! Das, was an Benachrichtigungen drin ist, wird mit
   * reingezaehlt, damit es logisch konsistent bleibt." Gemessen vorher am
   * Geraet: Glocke 23, Reiter 12, Symbol 12 -- die 23 fehlten. Der Server
   * addiert dieselbe Zahl (utils/appIconBadge.js, Paritaet B2b).
   */
  postfachUngelesen: number;
  /**
   * Meldet eine Challenge als geoeffnet -- wie markRoomAsRead fuer den Chat:
   * optimistisch sofort auf 0, dann POST. Fuer Team und Leitung ein No-op.
   */
  markChallengeAsRead: (challengeId: number) => Promise<void>;
  // Gesamt (Role-abhaengig)
  totalBadgeCount: number;
  // Actions
  refreshAllCounts: () => Promise<void>;
  /**
   * Meldet einen Raum als gelesen. Das Promise wird erfuellt, wenn der
   * Server den Lesevorgang verbucht hat -- WER DANACH ZAEHLER NEU LAEDT,
   * MUSS DARAUF WARTEN. Sonst liest er den Stand von vor dem Lesen.
   */
  markRoomAsRead: (roomId: number) => Promise<void>;
  // Legacy Alias (Abwaertskompatibilitaet)
  badgeCount: number;
  refreshFromAPI: () => Promise<void>;
}

// Create Context
const BadgeContext = createContext<BadgeContextType | undefined>(undefined);

// Badge Provider Component
export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useApp();
  // Erhoeht sich nach Socket-Reconnect-mit-neuem-Token (LiveUpdateContext). Als
  // Dependency des newMessage-Effekts unten nötig, damit der Listener nach
  // reconnectWithToken am NEUEN Socket-Objekt neu gebunden wird (der alte Socket
  // wurde verworfen -> ohne Neubindung kaeme kein 'newMessage' mehr an).
  const { socketEpoch } = useLiveUpdate();

  const [chatUnreadByRoom, setChatUnreadByRoom] = useState<Record<number, number>>({});
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const [pendingChallengesCount, setPendingChallengesCount] = useState(0);
  const [pendingChallengesByChallenge, setPendingChallengesByChallenge] = useState<Record<number, number>>({});
  const [newBadgesCount, setNewBadgesCount] = useState(0);
  const [challengeUpdatesByChallenge, setChallengeUpdatesByChallenge] = useState<Record<number, number>>({});
  const [challengeUpdatesTotal, setChallengeUpdatesTotal] = useState(0);
  const [postfachUngelesen, setPostfachUngelesen] = useState(0);

  /**
   * Laufende Nummer der aktiven Gemeinde (26.09.2026, Simons Befund am Geraet:
   * "Konfi-Ansicht Testgemeinde Challenge 9+, Wechsel auf Hennstedt -- bleibt
   * dieser Badge, obwohl es nicht mal Challenges gibt.").
   *
   * Sie zaehlt bei jedem Gemeindewechsel hoch und entscheidet, WESSEN Antwort
   * noch gelten darf: refreshAllCounts merkt sich beim Start den Stand und
   * verwirft seine Antwort, wenn inzwischen gewechselt wurde. Ohne das
   * ueberschreibt eine noch laufende Abfrage der ALTEN Gemeinde die Zahlen der
   * neuen -- derselbe Wettlauf, der bei markRoomAsRead schon einmal zugeschlagen
   * hat (Befund 03.09.2026, siehe dort).
   *
   * Als ref, nicht als State: Der Wert muss in der laufenden Abfrage sofort
   * sichtbar sein, nicht erst im naechsten Rendern.
   */
  const gemeindeLauf = useRef(0);

  /**
   * Fuer welchen Lauf der Wechsel-Horcher schon geladen hat.
   *
   * Beim Gemeindewechsel setzt AppContext ein neues user-Objekt UND feuert
   * 'org:switched'. Beides loest einen Refresh aus -- gemessen am 26.09.2026
   * zwei GET /notifications/badge-counts je Wechsel. Der Horcher laedt zuerst
   * (dispatchEvent laeuft sofort), der user-Effekt kommt hinterher und waere
   * eine Wiederholung derselben Abfrage. Dieser Merker laesst ihn genau einmal
   * aus -- fuer jeden weiteren Anlass (Push, Reconnect, Live-Ereignis) laedt er
   * unveraendert.
   */
  const bereitsGeladenFuerLauf = useRef<number | null>(null);

  const isAdmin = user?.type === 'admin' && user?.role_name !== 'super_admin';
  // Challenge-Freigaben betreffen die ganze Leitung — Teamer moderieren ihre
  // zugewiesenen Jahrgänge selbst (das Backend zählt entsprechend gefiltert).
  const isLeadership = isAdmin || user?.type === 'teamer';

  // totalBadgeCount: Admin = chat + requests + events + challenges,
  // Teamer = chat + challenges + badges, Konfi = chat + badges + Challenge-Neuigkeiten
  // -- und fuer ALLE Rollen plus die ungelesenen Postfach-Mitteilungen.
  // Seit 27.08.2026 zaehlen die ungesehenen Abzeichen mit: Vorher fehlten sie
  // im App-Icon, obwohl sie an einem Reiter als rote Zahl standen -- das Icon
  // stimmte nie mit der Summe der Reiter ueberein (Befund B2a).
  // Seit 24.09.2026 kommen fuer Konfis die Challenge-Neuigkeiten dazu.
  // Seit 25.09.2026 zaehlt das Postfach mit (Simons Messung am Geraet:
  // Glocke 23 + Challenges 9 + Chat 3, das Symbol zeigte 12 -- jetzt 35).
  // Das Symbol ist die Summe ALLER Zahlen, die die App zeigt: Reiter UND
  // Glocke. Warum auch die Mitteilungen zaehlen, deren Gegenstand ein Reiter
  // schon zaehlt (offener Antrag + "Neuer Antrag eingegangen"), steht in
  // backend/utils/postfachArten.js.
  //
  // DIESELBE ZUSAMMENSETZUNG steht serverseitig in utils/appIconBadge.js
  // (App-Icon-Zahl im Push bei geschlossener App). Wer hier etwas aendert,
  // zieht dort nach -- tests/utils/appIconBadgeParitaet.test.js haelt beide
  // Seiten fest. Laufen sie auseinander, zeigt das Icon eine andere Zahl als
  // die Reiter (Befund B2b, 27.08.2026).
  const totalBadgeCount = useMemo(() => {
    if (isAdmin) {
      return chatUnreadTotal + pendingRequestsCount + pendingEventsCount + pendingChallengesCount + postfachUngelesen;
    }
    if (isLeadership) {
      return chatUnreadTotal + pendingChallengesCount + newBadgesCount + postfachUngelesen;
    }
    return chatUnreadTotal + newBadgesCount + challengeUpdatesTotal + postfachUngelesen;
  }, [chatUnreadTotal, pendingRequestsCount, pendingEventsCount, pendingChallengesCount, newBadgesCount, challengeUpdatesTotal, postfachUngelesen, isAdmin, isLeadership]);

  // Zentraler Refresh aller Counts. Nutzt den leichtgewichtigen Zähler-Endpoint
  // (Audit Achse 4, Fund 3) statt der frueheren drei Voll-Fetches (/chat/rooms +
  // /admin/activities/requests + /events), die nur für Zahlen geladen wurden.
  // Die Semantik der Zähler repliziert der Server exakt aus den Listen-Queries
  // (unread pro Raum, pending-Anträge, unverarbeitete vergangene Events).
  const refreshAllCounts = useCallback(async () => {
    if (!user) return;

    // Zu welcher Gemeinde diese Abfrage gehoert. Wird beim Eintreffen der
    // Antwort gegen den aktuellen Stand geprueft (siehe gemeindeLauf oben).
    const lauf = gemeindeLauf.current;

    try {
      const { data } = await api.get('/notifications/badge-counts');

      // Inzwischen die Gemeinde gewechselt? Dann gehoert diese Antwort der
      // ALTEN Gemeinde und wird verworfen -- sonst schreibt sie deren Zahlen
      // ueber die der neuen und Simons Befund waere nur verschoben.
      if (lauf !== gemeindeLauf.current) return;

      // chatUnreadByRoom-Struktur (Record<number, number>) beibehalten —
      // ChatRoom (initialUnreadRef) und ChatOverview (Effect-Trigger) hängen dran.
      const byRoomRaw: Record<string, number> = data?.chat?.byRoom || {};
      const unreadByRoom: Record<number, number> = {};
      let totalUnread = 0;
      Object.entries(byRoomRaw).forEach(([roomId, count]) => {
        const unread = Number(count) || 0;
        unreadByRoom[Number(roomId)] = unread;
        totalUnread += unread;
      });
      // Referenz nur wechseln, wenn sich INHALTLICH etwas geändert hat.
      // ChatOverview refresht die Raumliste bei jeder neuen Referenz — vorher
      // erzeugte jeder refreshAllCounts() ein neues Objekt mit identischen
      // Werten, und beim Öffnen des Chat-Tabs lief GET /chat/rooms dadurch
      // doppelt (gemessen 24.08.2026, in allen drei Rollen: zweiter Request
      // ~200 ms nach dem ersten, direkt nach Eintreffen der Zähler).
      setChatUnreadByRoom(prev => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(unreadByRoom);
        const unveraendert = prevKeys.length === nextKeys.length
          && nextKeys.every(k => prev[Number(k)] === unreadByRoom[Number(k)]);
        return unveraendert ? prev : unreadByRoom;
      });
      setChatUnreadTotal(totalUnread);

      if (isAdmin) {
        setPendingRequestsCount(Number(data?.pendingRequests) || 0);
        setPendingEventsCount(Number(data?.pendingEvents) || 0);
      }
      // Abzeichen fuer ALLE Rollen uebernehmen (die Leitung bekommt vom Server
      // 0). Befund 25.09.2026: Seit der Konsolidierung vom 27.08.2026 stand
      // diese Zeile im Leitungs-Zweig darunter -- Konfis bekamen die Zahl am
      // Badges-Reiter nie, waehrend der Server sie ins App-Icon summierte.
      // Genau der Widerspruch Icon <-> Reiter, den B2b ausschliessen sollte.
      setNewBadgesCount(Number(data?.newBadges) || 0);
      // Postfach (25.09.2026): fuer alle Rollen, ueber alle Gemeinden --
      // Glocke und Anteil am App-Symbol. Aeltere Server ohne das Feld: 0,
      // keine Zahl an der Glocke, kein Fehler.
      setPostfachUngelesen(Number(data?.postfach?.ungelesen) || 0);

      if (isLeadership) {
        // pendingChallenges bleibt die Quelle fuer den Reiter (Altfeld, das
        // auch aeltere Server liefern). Die Aufschluesselung je Challenge
        // (25.09.2026) kommt additiv in challengeApprovals -- aeltere Server
        // ohne das Feld: keine Kugel am Eintrag, kein Fehler.
        setPendingChallengesCount(Number(data?.pendingChallenges) || 0);
        const byChallengeRaw: Record<string, number> = data?.challengeApprovals?.byChallenge || {};
        const freigaben: Record<number, number> = {};
        Object.entries(byChallengeRaw).forEach(([challengeId, count]) => {
          const n = Number(count) || 0;
          if (n > 0) freigaben[Number(challengeId)] = n;
        });
        setPendingChallengesByChallenge(prev => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(freigaben);
          const unveraendert = prevKeys.length === nextKeys.length
            && nextKeys.every(k => prev[Number(k)] === freigaben[Number(k)]);
          return unveraendert ? prev : freigaben;
        });
      } else {
        // Konfis (24.09.2026): Challenge-Neuigkeiten wie chat.byRoom -- Zahl
        // je Challenge fuer den Listeneintrag, Summe fuer Reiter und Icon.
        // Nur im Konfi-Zweig, wie pendingRequests nur im Admin-Zweig: Der
        // Server liefert das Feld fuer Team und Leitung ohnehin leer, aber
        // die Rollen-Aufteilung soll HIER lesbar sein, nicht nur dort.
        // Aeltere Server ohne das Feld: leer, keine Zahl, kein Fehler.
        const byChallengeRaw: Record<string, number> = data?.challengeUpdates?.byChallenge || {};
        const neuigkeiten: Record<number, number> = {};
        let neuigkeitenTotal = 0;
        Object.entries(byChallengeRaw).forEach(([challengeId, count]) => {
          const n = Number(count) || 0;
          if (n > 0) {
            neuigkeiten[Number(challengeId)] = n;
            neuigkeitenTotal += n;
          }
        });
        // Referenz stabil halten, wenn sich inhaltlich nichts geaendert hat
        // (dasselbe Argument wie bei chatUnreadByRoom oben).
        setChallengeUpdatesByChallenge(prev => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(neuigkeiten);
          const unveraendert = prevKeys.length === nextKeys.length
            && nextKeys.every(k => prev[Number(k)] === neuigkeiten[Number(k)]);
          return unveraendert ? prev : neuigkeiten;
        });
        setChallengeUpdatesTotal(neuigkeitenTotal);
      }
    } catch (error) {
      console.error('BadgeContext: refreshAllCounts fehlgeschlagen:', error);
    }
  }, [user, isAdmin, isLeadership]);

  /**
   * Setzt alle Zaehler zurueck, die zur AKTIVEN GEMEINDE gehoeren.
   *
   * Das Postfach bleibt bewusst stehen: Es zaehlt die Mitteilungen des KONTOS
   * ueber alle Gemeinden (routes/notifications.js zaehlt sie ohne Org-Filter,
   * die Begruendung steht dort). Wer wechselt, hat nicht weniger ungelesene
   * Mitteilungen -- die Zahl an der Glocke darf nicht kurz auf 0 springen.
   */
  const setzeGemeindeZaehlerZurueck = useCallback(() => {
    setChatUnreadByRoom({});
    setChatUnreadTotal(0);
    setPendingRequestsCount(0);
    setPendingEventsCount(0);
    setPendingChallengesCount(0);
    setPendingChallengesByChallenge({});
    setNewBadgesCount(0);
    setChallengeUpdatesByChallenge({});
    setChallengeUpdatesTotal(0);
  }, []);

  /*
   * Gemeindewechsel (26.09.2026, Simons Befund am Geraet: "Wechsel ich die
   * Ansicht, wird der Badge auf Challenges nicht ordentlich zurueckgesetzt.
   * Der wird mitgenommen. Konfi-Ansicht Testgemeinde Challenge 9+, Wechsel auf
   * Hennstedt -- bleibt dieser Badge, obwohl es nicht mal Challenges gibt.")
   *
   * WARUM DAS HIER STEHEN MUSS: Der BadgeProvider liegt in App.tsx AUSSERHALB
   * des Routers -- und nur der Router haengt am orgVersion-Schluessel. Der
   * Remount, der alle Ansichten frisch laedt, erreicht diesen Provider also
   * nie; seine Zahlen ueberleben den Wechsel unberuehrt. Dass sie sich
   * ueberhaupt irgendwann erneuerten, lag allein daran, dass AppContext beim
   * Wechsel ein neues user-Objekt setzt und damit refreshAllCounts neu
   * erzeugt. Darauf ist kein Verlass: Rolle und Gemeinde koennen gleich
   * bleiben, und bis die Antwort da ist, steht die alte Zahl weiter am Reiter.
   *
   * DIE REIHENFOLGE IST DER FIX: erst zuruecksetzen, dann neu laden. Umgekehrt
   * (oder nur neu laden) bleibt die Zahl der alten Gemeinde sichtbar, bis der
   * Server antwortet -- und in einer Gemeinde ohne Challenges verschwindet sie
   * nur, weil die Antwort sie auf 0 setzt. Sind Rollen verschieden (Teamer:in
   * in A, Konfi in B), setzt refreshAllCounts die Zaehler der anderen Rolle
   * gar nicht: pendingChallenges stuende in der Konfi-Gemeinde dauerhaft auf
   * dem Wert aus A.
   *
   * gemeindeLauf hochzaehlen verwirft zugleich alle noch laufenden Abfragen
   * der alten Gemeinde (siehe refreshAllCounts).
   *
   * Das Postfach bleibt stehen, siehe setzeGemeindeZaehlerZurueck.
   *
   * 'auth:org-fallback' gehoert dazu: Verliert jemand den Zugang zur
   * Zweitgemeinde (403), setzt AppContext die App auf die Stamm-Gemeinde
   * zurueck -- ohne 'org:switched' zu feuern. Das ist derselbe Wechsel und
   * braucht dieselbe Behandlung, sonst zeigten die Reiter weiter die Zahlen
   * einer Gemeinde, die die Person nicht mehr sehen darf.
   */
  useEffect(() => {
    const beiWechsel = () => {
      gemeindeLauf.current += 1;
      setzeGemeindeZaehlerZurueck();
      // Dieser Lauf ist damit bedient -- der user-Effekt unten, den AppContext
      // im selben Wechsel ebenfalls anstoesst, laesst ihn aus.
      bereitsGeladenFuerLauf.current = gemeindeLauf.current;
      refreshAllCounts();
    };
    window.addEventListener('org:switched', beiWechsel);
    window.addEventListener('auth:org-fallback', beiWechsel);
    return () => {
      window.removeEventListener('org:switched', beiWechsel);
      window.removeEventListener('auth:org-fallback', beiWechsel);
    };
  }, [setzeGemeindeZaehlerZurueck, refreshAllCounts]);

  // markRoomAsRead: Optimistisch + API Call
  const markRoomAsRead = useCallback(async (roomId: number): Promise<void> => {
    // Zugestellte Chat-Notifications dieses Raums aus dem Mitteilungszentrum
    // entfernen (Bereich wurde geoeffnet/gelesen). Fire-and-forget.
    removeDeliveredForChatRoom(roomId);

    // Beide Zaehler aus DERSELBEN Quelle bedienen.
    //
    // Befund vom 02.09.2026 (Simon: "Warum wird der Badge-Count nicht
    // geloescht, wenn ich live im System bin?"): setChatUnreadTotal las
    // `chatUnreadByRoom[roomId]` aus der Closure -- also aus dem Stand, den
    // die Funktion beim Erzeugen gesehen hat. Kommt eine Nachricht herein und
    // der Chat wird sofort geoeffnet, ist dieser Wert veraltet (meist 0, weil
    // der Raum vorher gelesen war). Die Gesamtzahl wurde dann um den falschen
    // Betrag verringert -- und der Badge an der Tab-Leiste blieb stehen,
    // obwohl der Raum selbst auf 0 sprang.
    //
    // Jetzt merkt sich der erste Setter den tatsaechlich abgezogenen Wert und
    // der zweite rechnet damit. React fuehrt beide Updater nacheinander mit
    // dem jeweils aktuellen Zustand aus, deshalb stimmt die Reihenfolge.
    let abgezogen = 0;
    setChatUnreadByRoom(prev => {
      abgezogen = prev[roomId] || 0;
      if (abgezogen === 0) return prev;
      return { ...prev, [roomId]: 0 };
    });
    setChatUnreadTotal(prev => Math.max(0, prev - abgezogen));

    // API Call im Hintergrund — offline: Queue-Fallback
    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'POST',
        url: `/chat/rooms/${roomId}/mark-read`,
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `mark-read-${roomId}-${Date.now()}`, label: 'Mark-Read' },
      });
      return;
    }
    // AWAIT, NICHT FIRE-AND-FORGET (Befund 03.09.2026).
    //
    // Simon: "Ich gehe in den Chats, Badge wird nie geloescht." Der Grund war
    // ein Wettlauf, den der Fix vom 02.09.2026 nicht erfasst hat:
    // ChatRoom.markRoomAsRead() rief diese Funktion und direkt danach
    // refreshAllCounts(). Weil der POST hier nur angestossen und nicht
    // abgewartet wurde, fragte refreshAllCounts die Zaehler ab, BEVOR der
    // Server das Lesen verbucht hatte. Es bekam den alten Stand zurueck --
    // und setChatUnreadTotal setzt HART auf den Serverwert, nicht relativ.
    // Die optimistische Null wurde also zuverlaessig wieder ueberschrieben.
    // Sichtbar als: Badge blinkt kurz weg und ist sofort wieder da.
    await api.post(`/chat/rooms/${roomId}/mark-read`)
      .then(() => {
        // Den zwischengespeicherten Raum-Stand verwerfen.
        //
        // Befund vom 02.09.2026 (Simon: "Mach ich aus und wieder an, ist sogar
        // die rote Linie im Chat da" / "Auch der Badge-Count bleibt immer
        // drin"): Die Chat-Uebersicht laedt ihre Raeume ueber useOfflineQuery
        // aus dem Cache ('chat:rooms:<userId>'). Jeder Raum bringt dort sein
        // unread_count MIT. Nach dem Lesen wurde dieser Cache nirgends
        // aktualisiert -- beim naechsten App-Start kam der ALTE Stand zurueck,
        // und daraus baute die Oberflaeche erneut Badge UND den roten
        // "Neue Nachrichten"-Trenner auf (useChatSocket friert
        // room.unread_count als initialUnreadRef ein).
        //
        // Die Datenbank war dabei die ganze Zeit richtig: Fuer Simons
        // Jahrgangschat stand dort last_read_at von gestern und 0 ungelesen.
        // Der Fehler lag allein im veralteten Zwischenspeicher.
        //
        // remove() statt set(): Der naechste Aufruf der Uebersicht holt die
        // Raeume frisch vom Server, statt dass wir hier eine zweite Wahrheit
        // pflegen, die wieder auseinanderlaufen kann.
        if (user?.id) offlineCache.remove(`chat:rooms:${user.id}`);
      })
      .catch(err => {
        console.error('BadgeContext: markRoomAsRead API fehlgeschlagen:', err);
      });
  }, [chatUnreadByRoom, user?.id]);

  // markChallengeAsRead: das Gegenstueck zu markRoomAsRead fuer Challenges.
  // Optimistisch die Zahl dieser Challenge herausnehmen, dann den Server
  // informieren -- ab jetzt zaehlt utils/challengeNeuigkeiten.js neu.
  // Nur Konfis tragen den Zaehler; fuer Team und Leitung passiert nichts
  // (kein Request fuer eine Zahl, die es fuer sie nicht gibt).
  const markChallengeAsRead = useCallback(async (challengeId: number): Promise<void> => {
    if (user?.type !== 'konfi') return;

    // Beide Zaehler aus DERSELBEN Quelle bedienen -- dasselbe Muster wie in
    // markRoomAsRead (Befund 02.09.2026): der erste Updater merkt sich, was
    // tatsaechlich abgezogen wurde, der zweite rechnet damit.
    let abgezogen = 0;
    setChallengeUpdatesByChallenge(prev => {
      abgezogen = prev[challengeId] || 0;
      if (abgezogen === 0) return prev;
      const next = { ...prev };
      delete next[challengeId];
      return next;
    });
    setChallengeUpdatesTotal(prev => Math.max(0, prev - abgezogen));

    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'POST',
        url: `/challenges/konfi/${challengeId}/mark-read`,
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `challenge-mark-read-${challengeId}-${Date.now()}`, label: 'Challenge gelesen' },
      });
      return;
    }
    // AWAIT wie bei markRoomAsRead (Befund 03.09.2026): Wer danach die
    // Zaehler neu laedt, muss den verbuchten Stand bekommen.
    await api.post(`/challenges/konfi/${challengeId}/mark-read`)
      .catch(err => {
        console.error('BadgeContext: markChallengeAsRead API fehlgeschlagen:', err);
      });
  }, [user?.type]);

  // Sync Device Badge bei Änderung von totalBadgeCount.
  // Nur auf nativen Plattformen: im Desktop-Browser existiert navigator.setAppBadge/
  // clearAppBadge nicht (z.B. Firefox) -> der Web-Fallback des Plugins wirft eine
  // unhandled rejection. Promises zusaetzlich mit .catch absichern.
  const setzeGeraeteBadge = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return;
    const p = totalBadgeCount > 0
      ? Badge.set({ count: totalBadgeCount })
      : Badge.clear();
    Promise.resolve(p).catch((error) => {
      console.warn('BadgeContext: Badge nicht verfügbar:', error);
    });
  }, [totalBadgeCount]);

  useEffect(() => { setzeGeraeteBadge(); }, [setzeGeraeteBadge]);

  // Ausdrueckliches Neusetzen auf Zuruf (Befund 28.08.2026): Der Effekt oben
  // haengt am WERT und feuert nicht, wenn sich dieser nicht geaendert hat. Nach
  // removeAllDeliveredNotifications() ist das Icon aber leer, waehrend
  // totalBadgeCount unveraendert im Speicher steht -- die Zahl kaeme erst
  // zurueck, wenn zufaellig eine andere hereinkommt. AppContext schickt dieses
  // Signal deshalb direkt nach dem Aufraeumen.
  useEffect(() => {
    const bei = () => setzeGeraeteBadge();
    window.addEventListener('badge:resync', bei);
    return () => window.removeEventListener('badge:resync', bei);
  }, [setzeGeraeteBadge]);

  // WebSocket: Live-Update bei neuen Nachrichten
  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;

    const socket = initializeWebSocket(token);

    const handleNewMessage = () => {
      refreshAllCounts();
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
    // socketEpoch in den Deps: nach Reconnect-mit-neuem-Token (reconnectWithToken)
    // ist getSocket() ein anderes Objekt -> Listener am frischen Socket neu binden.
  }, [refreshAllCounts, user, socketEpoch]);

  // LiveUpdateContext-basierte Subscriptions für Daten-Events.
  // Stabiles Array (Modul-Konstante BADGE_LIVE_TYPES) -> kein Re-Subscribe pro Render.
  useLiveRefresh(BADGE_LIVE_TYPES, refreshAllCounts);

  // Sync: Reconnect + Resume Badge-Refresh
  useEffect(() => {
    if (!user) return;

    const handleSyncReconnect = () => {
      refreshAllCounts();
    };

    // Push-Empfang/-Tap: Counts sofort aktualisieren. Der Push-Listener
    // (inkl. Navigation) liegt zentral in AppContext und feuert dieses Event,
    // damit hier KEIN zweiter PushNotifications-Listener nötig ist.
    window.addEventListener('sync:reconnect', handleSyncReconnect);
    window.addEventListener('push:received', handleSyncReconnect);
    return () => {
      window.removeEventListener('sync:reconnect', handleSyncReconnect);
      window.removeEventListener('push:received', handleSyncReconnect);
    };
  }, [user, refreshAllCounts]);

  // Initialer Load der Counts. KEIN Dauer-Polling mehr:
  // - Chat-Unread aktualisiert der WebSocket ('newMessage')
  // - Aktivitäten/Events aktualisiert LiveUpdate ('requests'/'events', s. useLiveRefresh oben)
  // - Nach Verbindungsabriss/Push feuert sync:reconnect bzw. push:received einen Refresh
  // Das frühere 30s-Intervall war durch diese Live-Kanäle redundant und erzeugte den
  // Großteil des /chat/rooms-Traffics (Admin-App offen = 120 Requests/h ohne Nutzen).
  useEffect(() => {
    if (!user) return;
    // Hat der Wechsel-Horcher fuer diesen Lauf schon geladen, waere das hier
    // dieselbe Abfrage ein zweites Mal (siehe bereitsGeladenFuerLauf oben).
    // Den Merker danach loeschen: Jeder weitere Anlass soll wieder laden.
    if (bereitsGeladenFuerLauf.current === gemeindeLauf.current) {
      bereitsGeladenFuerLauf.current = null;
      return;
    }
    refreshAllCounts();
  }, [user, refreshAllCounts]);

  // Reset bei Logout. Hier faellt AUCH das Postfach, anders als beim
  // Gemeindewechsel: Ohne Konto gibt es keine Mitteilungen, die zaehlen
  // koennten -- die Zahl an der Glocke waere die des abgemeldeten Kontos.
  useEffect(() => {
    if (!user) {
      setzeGemeindeZaehlerZurueck();
      setPostfachUngelesen(0);
    }
  }, [user, setzeGemeindeZaehlerZurueck]);

  return (
    <BadgeContext.Provider value={{
      chatUnreadByRoom,
      chatUnreadTotal,
      pendingRequestsCount,
      pendingEventsCount,
      pendingChallengesCount,
      pendingChallengesByChallenge,
      newBadgesCount,
      challengeUpdatesByChallenge,
      challengeUpdatesTotal,
      postfachUngelesen,
      totalBadgeCount,
      refreshAllCounts,
      markRoomAsRead,
      markChallengeAsRead,
      // Legacy Alias
      badgeCount: chatUnreadTotal,
      refreshFromAPI: refreshAllCounts,
    }}>
      {children}
    </BadgeContext.Provider>
  );
};

// Custom Hook for easy access
export const useBadge = () => {
  const context = useContext(BadgeContext);
  if (context === undefined) {
    throw new Error('useBadge must be used within a BadgeProvider');
  }
  return context;
};
