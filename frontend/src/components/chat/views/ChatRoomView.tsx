import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  const loadRoom = async () => {
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

  // Loading Screen entfernt - direkt rendern
  // if (loading) {
  //   return <LoadingSpinner fullScreen message="Chat wird geladen..." />;
  // }

  if (error) {
    return (
      <IonPage>
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

  // Render ChatRoom auch wenn room noch null ist (loading state)
  // ChatRoom wird dann eine leere Seite mit Header zeigen bis room geladen ist
  return (
    <ChatRoom
      room={room}
      onBack={onBack}
    />
  );
};

export default ChatRoomView;