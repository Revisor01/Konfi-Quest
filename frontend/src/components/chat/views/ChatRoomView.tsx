// ChatRoomView.tsx

// 1. Benötigte Imports hinzufügen
import React, { useState, useEffect, useRef } from 'react'; // useRef hinzufügen
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useLocation } from 'react-router-dom'; // Hinzufügen
import { useModalPage } from '../../../contexts/ModalContext'; // Hinzufügen
import ChatRoom from '../ChatRoom';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
  participants?: Array<{ user_id: number; user_type: 'admin' | 'konfi'; name: string; display_name?: string; }>;
}

interface ChatRoomViewProps {
  roomId: number;
  onBack: () => void;
  // Split-View: Raumliste steht daneben -> kein Zurueck-Pfeil im Header, und
  // eigene tabId fuer die Modal-Registrierung (sonst ueberschreiben sich
  // Uebersicht und Raum gegenseitig als presentingElement).
  hideBackButton?: boolean;
}

const ChatRoomView: React.FC<ChatRoomViewProps> = ({ roomId, onBack, hideBackButton }) => {
  // Raum-Metadaten per Offline-Cache laden: offline (oder bei Reconnect) zeigt
  // der Cache sofort den Raum, sodass ChatRoom mit seinem Nachrichten-Cache
  // gerendert wird. Vorher war das ein ungecachter api.get -> offline blieb der
  // Raum null -> "Chat wird geladen" / Fehlerseite, OBWOHL Nachrichten im Cache lagen.
  const { data: room, loading, isOffline } = useOfflineQuery<ChatRoomData>(
    'chat:room:' + roomId,
    () => api.get(`/chat/rooms/${roomId}`).then(r => r.data),
    { ttl: CACHE_TTL.CHAT_ROOMS, enabled: !!roomId }
  );

  // 2. Den useModalPage-Hook HIER aufrufen
  const location = useLocation();
  const baseTabId = location.pathname.startsWith('/admin')
    ? 'admin-chat'
    : location.pathname.startsWith('/teamer')
      ? 'teamer-chat'
      : 'chat';
  // Im Split-View liegt gleichzeitig die Uebersicht auf derselben Route und
  // registriert bereits baseTabId -> eigener Schluessel fuer den Detail-Bereich.
  const tabId = hideBackButton ? `${baseTabId}-detail` : baseTabId;
  const { pageRef, presentingElement } = useModalPage(tabId);
  // Im Split-View liefert der Context zur aktuellen Route die Uebersichts-Page
  // (den Master) — Modals aus dem Raum sollen aber ueber dem Raum aufgehen.
  // Deshalb dort die eigene IonPage als presentingElement verwenden. pageRef ist
  // im ersten Render noch leer, daher nach dem Mount einmal in den State ziehen.
  const [ownPage, setOwnPage] = useState<HTMLElement | undefined>(undefined);
  useEffect(() => {
    if (hideBackButton) setOwnPage(pageRef.current ?? undefined);
  }, [hideBackButton, roomId, loading]);

  const effectivePresentingElement = hideBackButton ? ownPage : presentingElement;

  // Fehler nur dann zeigen, wenn weder Cache noch Netz einen Raum liefern konnten.
  const showError = !loading && !room;

  if (showError) {
    // 3. Wichtig: Die Fehlerseite muss auch eine IonPage mit dem Ref sein
    return (
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onBack}>
                <IonIcon icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>Fehler</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding" style={{ textAlign: 'center' }}>
          <p>{isOffline
            ? 'Dieser Chat ist offline noch nicht verfügbar. Sobald du wieder online bist, wird er geladen.'
            : 'Fehler beim Laden des Chat-Raums.'}</p>
          <IonButton onClick={onBack}>Zurück zur Übersicht</IonButton>
        </IonContent>
      </IonPage>
    );
  }

  // Erstes Laden ohne Cache (online): Spinner zeigen statt ChatRoom mit room=null.
  if (loading && !room) {
    return (
      <IonPage ref={pageRef}>
        <IonContent className="app-gradient-background">
          <LoadingSpinner />
        </IonContent>
      </IonPage>
    );
  }

  // 4. ChatRoom bekommt jetzt das `presentingElement` als Prop
  //    und wird innerhalb der IonPage von ChatRoomView gerendert.
  return (
    <IonPage ref={pageRef}>
      <ChatRoom
        room={room}
        onBack={onBack}
        presentingElement={effectivePresentingElement} // <-- HIER wird es durchgereicht
        hideBackButton={hideBackButton}
      />
    </IonPage>
  );
};

export default ChatRoomView;