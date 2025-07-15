import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
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
  IonText
} from '@ionic/react';
import { 
  chatbubbles, 
  people, 
  person, 
  settings,
  add,
  time
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
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
}

interface ChatOverviewProps {
  onSelectRoom: (room: ChatRoom) => void;
  onCreateGroupChat: () => void;
}

const ChatOverview: React.FC<ChatOverviewProps> = ({ onSelectRoom, onCreateGroupChat }) => {
  const { user, setError } = useApp();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadChatRooms();
  }, []);

  const loadChatRooms = async () => {
    setLoading(true);
    try {
      const response = await api.get('/chat/rooms');
      setRooms(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Chaträume');
      console.error('Error loading chat rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const formatLastMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
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
      return `Jahrgang ${room.jahrgang_name} • ${room.participant_count} Teilnehmer`;
    }
    if (room.type === 'admin') {
      return 'Admin-Team Chat';
    }
    if (room.type === 'group') {
      return `${room.participant_count} Teilnehmer`;
    }
    return 'Direktnachricht';
  };

  if (loading) {
    return <LoadingSpinner message="Chaträume werden geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Chat</IonTitle>
          {user?.type === 'admin' && (
            <IonButtons slot="end">
              <IonButton onClick={onCreateGroupChat}>
                <IonIcon icon={add} />
              </IonButton>
            </IonButtons>
          )}
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

        {/* Search */}
        <div style={{ padding: '16px', paddingBottom: '8px' }}>
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value!)}
            placeholder="Chaträume durchsuchen..."
            style={{
              '--background': '#f8f9fa',
              '--border-radius': '12px',
              '--box-shadow': '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
        </div>

        {/* Chat Statistics Card */}
        <IonCard style={{ margin: '16px', marginTop: '8px' }}>
          <IonCardContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0', fontSize: '1.2rem', fontWeight: '600' }}>
                  Meine Chats
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                  {rooms.length} Chaträume verfügbar
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <IonChip color="primary" style={{ margin: '0' }}>
                  <IonIcon icon={chatbubbles} />
                  <IonLabel>{rooms.reduce((sum, room) => sum + room.unread_count, 0)} ungelesen</IonLabel>
                </IonChip>
              </div>
            </div>
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
                  <IonItem 
                    key={room.id} 
                    button 
                    onClick={() => onSelectRoom(room)}
                    style={{ '--min-height': '70px' }}
                  >
                    <IonAvatar slot="start" style={{ 
                      width: '48px', 
                      height: '48px',
                      backgroundColor: room.type === 'admin' ? '#7045f6' : 
                                     room.type === 'jahrgang' ? '#3880ff' :
                                     room.type === 'group' ? '#2dd36f' : '#ff6b35'
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
                        {room.name}
                        {room.unread_count > 0 && (
                          <IonBadge 
                            color="danger" 
                            style={{ 
                              marginLeft: '8px',
                              fontSize: '0.75rem',
                              minWidth: '20px',
                              height: '20px'
                            }}
                          >
                            {room.unread_count > 99 ? '99+' : room.unread_count}
                          </IonBadge>
                        )}
                      </h2>
                      
                      <p style={{ 
                        margin: '0 0 4px 0', 
                        fontSize: '0.85rem', 
                        color: '#666' 
                      }}>
                        {getRoomSubtitle(room)}
                      </p>
                      
                      {room.last_message && (
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

                    {room.last_message && (
                      <div slot="end" style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'flex-end',
                        fontSize: '0.75rem',
                        color: '#999'
                      }}>
                        <IonIcon icon={time} style={{ fontSize: '0.8rem', marginBottom: '2px' }} />
                        {formatLastMessageTime(room.last_message.created_at)}
                      </div>
                    )}
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ChatOverview;