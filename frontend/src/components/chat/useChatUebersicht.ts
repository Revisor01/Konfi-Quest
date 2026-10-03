import { useState, useEffect, useRef } from 'react';
import { useIonAlert, useIonModal, useIonViewWillEnter } from '@ionic/react';
import { fehlerText } from '../../utils/fehler';
import { useApp } from '../../contexts/AppContext';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { useBadge } from '../../contexts/BadgeContext';
import { useOfflineQuery } from '../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../services/offlineCache';
import api from '../../services/api';
import { onReconnect, initializeWebSocket } from '../../services/websocket';
import { getToken } from '../../services/tokenStore';
import { useLiveUpdate } from '../../contexts/LiveUpdateContext';
import SimpleCreateChatModal from './modals/SimpleCreateChatModal';
import type { ChatRoomOverview } from '../../types/chat';
import { istTeamTyp } from '../../utils/chatRoles';
import { bereinigeRaeume, raeumeFiltern } from './chatRaeume';

/**
 * Die Raumliste des Chats (beim Anlegen der Web-Fassung aus ChatOverview.tsx
 * hierher gezogen, Verhalten unveraendert): Raeume laden und live halten,
 * Suche und Reiter, Neuer Chat, Chat loeschen. Die App-Uebersicht
 * (ChatOverview) und die Raumliste der Web-Fassung (web/WebChatListe) lesen
 * denselben Hook -- Liste, Zahlen und Loeschrecht koennen nicht
 * auseinanderlaufen.
 */

interface ChatUebersichtDeps {
  /** Wird mit dem Raum aufgerufen, der nach "Neuer Chat" geoeffnet werden soll. */
  onSelectRoom: (room: ChatRoomOverview) => void;
}

export function useChatUebersicht({ onSelectRoom }: ChatUebersichtDeps) {
  const { user, setError, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const { chatUnreadByRoom } = useBadge();
  // socketEpoch: nach Reconnect-mit-neuem-Token ist getSocket() ein anderes
  // Objekt -> Listener am frischen Socket neu binden (gleiches Muster wie im
  // BadgeContext).
  const { socketEpoch } = useLiveUpdate();
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('alle');

  // Loeschrecht: nur Leitung/Admins (so prueft es auch das Backend,
  // DELETE /chat/rooms/:roomId verlangt type === 'admin').
  const isAdmin = user?.type === 'admin';
  // Reiter "Team": alle, die selbst zum Team gehoeren -- also auch Teamer:innen.
  // Sie sind in Produktion in 4 Team-Chats, sahen den Reiter aber nicht, weil
  // hier auf 'admin' geprueft wurde (gleiche Verwechslung wie in chatRoles).
  const gehoertZumTeam = istTeamTyp(user?.type);

  const { data: rooms, loading, refresh } = useOfflineQuery<ChatRoomOverview[]>(
    'chat:rooms:' + user?.id,
    () => api.get('/chat/rooms').then(r => r.data),
    { ttl: CACHE_TTL.CHAT_ROOMS, select: bereinigeRaeume }
  );

  // Live-Update der Chat-Raeume, wenn Badge Count sich aendert.
  // Das ist der EINZIGE newMessage-getriebene Refresh-Trigger der Uebersicht:
  // BadgeContext haelt einen eigenen (socketEpoch-rebindenden) 'newMessage'-
  // Listener, der refreshAllCounts() ruft -> chatUnreadByRoom aendert sich ->
  // dieser Effect feuert refresh(). Ein zusaetzlicher eigener socket.on(
  // 'newMessage')-Handler waere redundant (3x /chat/rooms pro Nachricht) und
  // haette zudem KEIN socketEpoch-Rebind nach Reconnect -- deshalb bewusst
  // entfernt (Audit Achse 4, Fund 2).
  useEffect(() => {
    if (rooms && rooms.length > 0) { // Nur wenn bereits Raeume geladen sind
      refresh(); // Silent reload via useOfflineQuery
    }
  }, [chatUnreadByRoom]);

  // Bei Socket-Reconnect Raumliste neu laden
  useEffect(() => {
    const unsubReconnect = onReconnect(() => {
      refresh(); // Silent reload bei Reconnect
    });
    return () => { unsubReconnect(); };
  }, [refresh]);

  // Live-Update der Raumliste bei Raum-Aenderungen (Raum erstellt/geloescht,
  // Teilnehmer hinzugefuegt/entfernt/verlassen). Der Server sendet 'roomsChanged'
  // an die persoenlichen User-Raeume der betroffenen Nutzer (Audit Achse 2,
  // Luecke 14). socketEpoch in den Deps -> Rebind am frischen Socket nach
  // Reconnect-mit-neuem-Token (gleiche Disziplin wie der BadgeContext-Listener).
  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;

    const socket = initializeWebSocket(token);
    const handleRoomsChanged = () => {
      refresh();
    };
    socket.on('roomsChanged', handleRoomsChanged);

    return () => {
      socket.off('roomsChanged', handleRoomsChanged);
    };
  }, [refresh, user, socketEpoch]);

  // Bei Rueckkehr zur View (z.B. nach ChatRoom) Raumliste aktualisieren.
  // NICHT beim allerersten Betreten direkt nach dem Mount: Da laedt
  // useOfflineQuery bereits -- ionViewWillEnter feuert bei der Tab-Transition
  // erst ~450 ms nach dem Mount (gemessen 24.08.2026), also NACH Abschluss
  // des Mount-Fetches, und loeste so in allen drei Rollen einen zweiten,
  // identischen GET /chat/rooms aus.
  const mountedAtRef = useRef(Date.now());
  useIonViewWillEnter(() => {
    if (Date.now() - mountedAtRef.current > 2000) {
      refresh();
    }
  });

  // Modal mit useIonModal Hook
  const [presentChatModalHook, dismissChatModalHook] = useIonModal(SimpleCreateChatModal, {
    onClose: () => dismissChatModalHook(),
    onSuccess: async (roomId?: number) => {
      dismissChatModalHook();
      await refresh(); // Chatliste neu laden
      // Direkt in den neu erstellten/gefundenen Chat springen statt auf der Liste
      // zu bleiben. Raum frisch von der API holen (refresh-State ist evtl. noch
      // nicht durchgereicht).
      if (roomId) {
        try {
          const freshRooms: ChatRoomOverview[] = (await api.get('/chat/rooms')).data;
          const target = freshRooms.find(r => r.id === roomId);
          if (target) onSelectRoom(target);
        } catch (err) {
          console.error('Konnte neuen Chat nicht oeffnen:', err);
        }
      }
    }
  });

  /** Das Fenster "Neuer Chat" oeffnen (die App gibt die Seite fuer die Kartenform mit). */
  const neuenChatStarten = (presentingElement?: HTMLElement, cssClass?: string) => {
    presentChatModalHook({
      presentingElement,
      ...(cssClass ? { cssClass } : {}),
    });
  };

  /**
   * Einen Chat fuer alle loeschen (nur Leitung): mit Rueckfrage, bei einem Chat
   * mit Nachrichten mit einer zweiten ("Trotzdem loeschen?"). `nachher` laeuft
   * nach dem Loeschen, etwa um den Raum rechts zu schliessen.
   */
  const deleteRoom = (room: ChatRoomOverview, nachher?: () => void) => {
    if (offlineBlockiert(isOnline, setError)) return;
    const geloescht = () => {
      refresh();
      nachher?.();
    };
    presentAlert({
      header: 'Chat löschen?',
      message: `"${room.name}" wird für alle Teilnehmer:innen gelöscht. Alle Nachrichten und Dateien gehen unwiderruflich verloren.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            // Direkt löschen
            api.delete(`/chat/rooms/${room.id}`)
              .then(geloescht)
              .catch((error: unknown) => {
                const data = typeof error === 'object' && error !== null
                  ? (error as { response?: { data?: { canForceDelete?: boolean; error?: string } } }).response?.data
                  : undefined;
                if (data?.canForceDelete) {
                  // Hat Nachrichten - Force Delete nötig
                  setTimeout(() => {
                    presentAlert({
                      header: 'Chat hat Nachrichten',
                      message: `${data.error}\n\nTrotzdem löschen?`,
                      buttons: [
                        { text: 'Abbrechen', role: 'cancel' },
                        {
                          text: 'Trotzdem löschen',
                          role: 'destructive',
                          handler: () => {
                            api.delete(`/chat/rooms/${room.id}?force=true`)
                              .then(geloescht)
                              .catch(() => setError('Fehler beim Löschen'));
                          }
                        }
                      ]
                    });
                  }, 300);
                } else {
                  setError(fehlerText(error, 'Fehler beim Löschen'));
                }
              });
          }
        }
      ]
    });
  };

  const filteredRooms = raeumeFiltern(rooms || [], {
    suche: searchText,
    filter: filterType,
    ungelesen: chatUnreadByRoom,
  });

  return {
    user,
    rooms,
    loading,
    refresh,
    chatUnreadByRoom,
    searchText,
    setSearchText,
    filterType,
    setFilterType,
    isAdmin,
    gehoertZumTeam,
    filteredRooms,
    neuenChatStarten,
    deleteRoom,
  };
}
