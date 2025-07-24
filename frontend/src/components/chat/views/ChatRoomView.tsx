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

interface ChatRoomData {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
  participants?: Array<{ user_id: number; user_type: 'admin' | 'konfi'; name: string; display_name?: string; }>;
}

interface ChatRoomViewProps {
  roomId: number;
  onBack: () => void;
}

const ChatRoomView: React.FC<ChatRoomViewProps> = ({ roomId, onBack }) => {
  const [room, setRoom] = useState<ChatRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 2. Den useModalPage-Hook HIER aufrufen
  const location = useLocation();
  const tabId = location.pathname.startsWith('/admin') ? 'admin-chat' : 'chat';
  const { pageRef, presentingElement } = useModalPage(tabId);


  useEffect(() => {
    loadRoom();
  }, [roomId]);

  const loadRoom = async () => {
    // ... (Funktion bleibt unverändert)
    if (!roomId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/chat/rooms/${roomId}`);
      setRoom(response.data);
    } catch (err) {
      console.error('Error loading room:', err);
      setError('Fehler beim Laden des Chat-Raums.');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
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
          <p>{error}</p>
          <IonButton onClick={onBack}>Zurück zur Übersicht</IonButton>
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
        presentingElement={presentingElement} // <-- HIER wird es durchgereicht
      />
    </IonPage>
  );
};

export default ChatRoomView;