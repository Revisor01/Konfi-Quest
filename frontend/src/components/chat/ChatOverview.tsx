import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonLabel,
  IonBadge,
  IonIcon,
  IonAvatar,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonChip,
  IonButton,
  IonButtons,
  IonText,
  IonGrid,
  IonRow,
  IonCol,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/react';
import { 
  chatbubbles, 
  people, 
  person, 
  settings,
  add,
  time,
  trash,
  search
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import api from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

interface ChatRoom {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
  participant_count?: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count: number;
  jahrgang_name?: string;
  participants?: Array<{
    user_id: number;
    user_type: 'admin' | 'konfi';
    name: string;
    display_name?: string;
  }>;
}

interface ChatOverviewProps {
  onSelectRoom: (room: ChatRoom) => void;
  onCreateNewChat: () => void;
  pageRef?: React.RefObject<HTMLElement | null>;
}

interface ChatOverviewRef {
  loadChatRooms: () => void;
}

const ChatOverview = React.forwardRef<ChatOverviewRef, ChatOverviewProps>(({ onSelectRoom, onCreateNewChat, pageRef: externalPageRef }, ref) => {
  const pageRef = externalPageRef || useRef<HTMLElement | null>(null);
  const { user, setError, setSuccess } = useApp();
  const { refreshFromAPI } = useBadge();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadChatRooms();
  }, []);

  const loadChatRooms = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/chat/rooms');
      setRooms(response.data);
      // Update badge context with fresh data
      await refreshFromAPI();
    } catch (err) {
      if (!silent) setError('Fehler beim Laden der Chaträume');
      console.error('Error loading chat rooms:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Expose loadChatRooms to parent component
  React.useImperativeHandle(ref, () => ({
    loadChatRooms
  }));

  const deleteRoom = async (room: ChatRoom) => {
    // Erste Bestätigung
    if (!window.confirm(`Chat "${room.name}" wirklich löschen?`)) return;
    
    // Zweite Bestätigung mit Warnung
    const confirmText = `ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!\n\nAlle Nachrichten, Dateien und Daten werden PERMANENT gelöscht.\n\nChat "${room.name}" wirklich endgültig löschen?`;
    if (!window.confirm(confirmText)) return;

    try {
      await api.delete(`/chat/rooms/${room.id}`);
      setSuccess(`Chat "${room.name}" und alle Daten gelöscht`);
      await loadChatRooms();
    } catch (err) {
      setError('Fehler beim Löschen des Chats');
      console.error('Error deleting chat room:', err);
    }
  };

  const filteredRooms = rooms
    .filter(room =>
      room.name.toLowerCase().includes(searchText.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by last message timestamp (newest first)
      const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return bTime - aTime; // Newest first
    });

  const formatLastMessageTime = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Prüfe auf gültiges Datum
    if (isNaN(date.getTime())) return '';
    
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes < 1 ? 'Jetzt' : `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  const getDisplayRoomName = (room: ChatRoom) => {
    // Für Direktchats: Zeige den Namen des Chat-Partners, nicht des eigenen Users
    if (room.type === 'direct') {
      // Finde den Chat-Partner (nicht der aktuelle User)
      const otherParticipant = room.participants?.find((p: { user_id: number; user_type: 'admin' | 'konfi'; name: string; display_name?: string }) => 
        !(p.user_id === user?.id && p.user_type === user?.type)
      );
      
      if (otherParticipant) {
        return otherParticipant.display_name || otherParticipant.name || 'Unbekannt';
      }
      
      // Fallback: verwende room.name wenn keine Participants geladen
      return room.name || 'Direktchat';
    }
    
    // Für alle anderen Chat-Typen: normaler Name
    return room.name || 'Chat';
  };

  const getRoomIcon = (room: ChatRoom) => {
    switch (room.type) {
      case 'admin':
        return settings;
      case 'jahrgang':
        return people;
      case 'group':
        return chatbubbles;
      case 'direct':
        return person;
      default:
        return chatbubbles;
    }
  };

  const getRoomSubtitle = (room: ChatRoom) => {
    if (room.type === 'jahrgang') {
      const jahrgangText = room.jahrgang_name ? `Jahrgang ${room.jahrgang_name}` : 'Jahrgangschat';
      const participantText = room.participant_count ? ` • ${room.participant_count} Teilnehmer:innen` : '';
      return jahrgangText + participantText;
    }
    if (room.type === 'admin') {
      return 'Admin-Team Chat';
    }
    if (room.type === 'group') {
      const participantText = room.participant_count ? `${room.participant_count} Teilnehmer:innen` : 'Gruppenchat';
      return participantText;
    }
    if (room.type === 'direct') {
      return 'Direktnachricht';
    }
    return '';
  };

  if (loading) {
    return <LoadingSpinner message="Chaträume werden geladen..." />;
  }

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Chat</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCreateNewChat}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Chat</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadChatRooms();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Chat Statistics Header */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
        }}>
          <IonCardContent>
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={chatbubbles} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {rooms.length}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Chats
                    </p>
                  </div>
                </IonCol>
                <IonCol size="6">
                  <div style={{ textAlign: 'center' }}>
                    <IonIcon icon={chatbubbles} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                    <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                      {rooms.reduce((sum, room) => sum + room.unread_count, 0)}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                      Ungelesen
                    </p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

<IonCard style={{ margin: '16px' }}>
  <IonCardContent style={{ padding: '16px' }}>
    <IonGrid>
      <IonRow>
        <IonCol size="12">
          <IonItem 
            lines="none" 
            style={{ 
              '--background': '#f8f9fa',
              '--border-radius': '8px',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              '--padding-start': '12px',
              '--padding-end': '12px',
              '--min-height': '44px'
            }}
          >
            <IonIcon 
              icon={search} 
              slot="start" 
              style={{ 
                color: '#8e8e93',
                marginRight: '8px',
                fontSize: '1rem'
              }} 
            />
            <IonInput
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder="Chaträume durchsuchen..."
              style={{ 
                '--color': '#000',
                '--placeholder-color': '#8e8e93'
              }}
            />
            </IonItem>
        </IonCol>
      </IonRow>
      </IonGrid>
  </IonCardContent>
</IonCard>
    
    


        {/* Chat Rooms List */}
        <IonCard style={{ margin: '16px', marginTop: '8px' }}>
          <IonCardContent style={{ padding: '0' }}>
            {filteredRooms.length === 0 ? (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Chaträume gefunden</p>
                </IonLabel>
              </IonItem>
            ) : (
              <IonList>
                {filteredRooms.map((room) => (
                  <IonItemSliding key={room.id}>
                    <IonItem 
                      button 
                      onClick={() => onSelectRoom(room)}
                      style={{ '--min-height': '70px' }}
                    >
                      <IonAvatar slot="start" style={{ 
                        width: '48px', 
                        height: '48px',
                        backgroundColor: room.type === 'admin' ? '#7045f6' : 
                                       room.type === 'jahrgang' ? '#3880ff' :
                                       room.type === 'group' ? '#2dd36f' : '#ff6b35',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IonIcon 
                          icon={getRoomIcon(room)} 
                          style={{ 
                            fontSize: '1.5rem', 
                            color: 'white'
                          }} 
                        />
                      </IonAvatar>
                      
                      <IonLabel>
                        <h2 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                          {getDisplayRoomName(room)}
                        </h2>
                        
                        <p style={{ 
                          margin: '0 0 4px 0', 
                          fontSize: '0.85rem', 
                          color: '#666' 
                        }}>
                          {getRoomSubtitle(room)}
                        </p>
                        
                        {room.last_message && room.last_message.content && (
                          <p style={{ 
                            margin: '0', 
                            fontSize: '0.8rem', 
                            color: '#999',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            <strong>{room.last_message.sender_name}:</strong> {room.last_message.content}
                          </p>
                        )}
                      </IonLabel>

                      {room.unread_count > 0 && (
                        <div slot="end" style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{
                            backgroundColor: '#007aff',
                            color: 'white',
                            borderRadius: '12px',
                            minWidth: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            padding: '0 6px'
                          }}>
                            {room.unread_count > 99 ? '99+' : room.unread_count}
                          </div>
                        </div>
                      )}
                    </IonItem>

                    {(room.type === 'direct' || room.type === 'group') && (
                      <IonItemOptions side="end">
                        <IonItemOption 
                          color="danger" 
                          onClick={() => deleteRoom(room)}
                        >
                          <IonIcon icon={trash} />
                        </IonItemOption>
                      </IonItemOptions>
                    )}
                  </IonItemSliding>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
});

export default ChatOverview;