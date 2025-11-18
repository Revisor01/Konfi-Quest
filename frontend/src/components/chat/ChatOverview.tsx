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
  IonItemOption,
  useIonModal
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
import { useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useModalPage } from '../../contexts/ModalContext';
import api from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import SimpleCreateChatModal from './modals/SimpleCreateChatModal';

interface ChatRoom {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
  participant_count?: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
    file_name?: string;
    message_type?: string;
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
}

interface ChatOverviewRef {
  loadChatRooms: () => void;
}

const ChatOverview = React.forwardRef<ChatOverviewRef, ChatOverviewProps>(({ onSelectRoom }, ref) => {
  const { user, setError, setSuccess } = useApp();
  const { refreshFromAPI, badgeCount } = useBadge();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Nutze den useModalPage Hook, um die Seite zu registrieren
  const location = useLocation();
  // Bestimme die korrekte Tab-ID basierend auf dem Pfad
  const tabId = location.pathname.startsWith('/admin') ? 'admin-chat' : 'chat';
  const { pageRef, presentingElement } = useModalPage(tabId);

  useEffect(() => {
    loadChatRooms();
  }, []);

  // Live-Update der Chat-Räume wenn Badge Count sich ändert
  useEffect(() => {
    if (rooms.length > 0) { // Nur wenn bereits Räume geladen sind
      console.log('📱 ChatOverview: Badge changed, refreshing room data');
      loadChatRooms(true); // Silent reload
    }
  }, [badgeCount]);

  const loadChatRooms = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/chat/rooms');
      setRooms(response.data);
      // Update badge context with fresh data nur beim ersten Load
      if (!silent && rooms.length === 0) {
        await refreshFromAPI();
      }
    } catch (err) {
      if (!silent) setError('Fehler beim Laden der Chaträume');
      console.error('Error loading chat rooms:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Modal mit useIonModal Hook
  const [presentChatModalHook, dismissChatModalHook] = useIonModal(SimpleCreateChatModal, {
    onClose: () => dismissChatModalHook(),
    onSuccess: () => {
      dismissChatModalHook();
      loadChatRooms(); // Chatliste neu laden
    }
  });

  const handleCreateNewChat = () => {
    console.log('🎯 ChatOverview: Opening modal with presentingElement:', pageRef.current);
    presentChatModalHook({
      presentingElement: pageRef.current || undefined
    });
  };

  // Expose loadChatRooms to parent component
  React.useImperativeHandle(ref, () => ({
    loadChatRooms
  }));

  const deleteRoom = async (room: ChatRoom, forceDelete = false) => {
    if (!forceDelete) {
      // Erste Bestätigung
      if (!window.confirm(`Chat "${room.name}" wirklich löschen?`)) return;
      
      // Zweite Bestätigung mit Warnung
      const confirmText = `ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!\n\nAlle Nachrichten, Dateien und Daten werden PERMANENT gelöscht.\n\nChat "${room.name}" wirklich endgültig löschen?`;
      if (!window.confirm(confirmText)) return;
    }

    try {
      const url = forceDelete ? `/chat/rooms/${room.id}?force=true` : `/chat/rooms/${room.id}`;
      await api.delete(url);
      setSuccess(`Chat "${room.name}" und alle Daten gelöscht`);
      await loadChatRooms();
    } catch (error: any) {
      if (error.response?.data?.canForceDelete) {
        // Org Admin kann trotzdem löschen
        const forceConfirm = window.confirm(
          `${error.response.data.error}\n\nAls Organisation-Admin können Sie dennoch löschen. Dadurch werden ALLE Chat-Nachrichten unwiderruflich gelöscht!\n\nDennoch löschen?`
        );
        if (forceConfirm) {
          await deleteRoom(room, true);
        }
      } else if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Fehler beim Löschen des Chats');
      }
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
      return 'Jahrgangschat';
    }
    if (room.type === 'admin') {
      return 'Admin-Team Chat';
    }
    if (room.type === 'group') {
      return 'Gruppenchat';
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
            <IonButton onClick={handleCreateNewChat}>
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

        {/* Chat Header - Dashboard-Style */}
        <div style={{
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(6, 182, 212, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Überschrift - groß und überlappend */}
          <div style={{
            position: 'absolute',
            top: '-5px',
            left: '12px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '4rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.1)',
              margin: '0',
              lineHeight: '0.8',
              letterSpacing: '-2px'
            }}>
              CHAT
            </h2>
          </div>
          
          {/* Content */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            padding: '70px 24px 24px 24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <IonGrid style={{ padding: '0', margin: '0 4px' }}>
              <IonRow>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={chatbubbles} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '8px', 
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{rooms.length}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Chats
                    </div>
                  </div>
                </IonCol>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={chatbubbles} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '8px', 
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{rooms.reduce((sum, room) => sum + room.unread_count, 0)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Ungelesen
                    </div>
                  </div>
                </IonCol>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={people} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '8px', 
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{rooms.filter(room => room.last_message && new Date(room.last_message.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Aktiv
                    </div>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Suchfeld Navigation */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '14px 16px' }}>
            <IonItem 
              lines="none" 
              style={{ 
                '--background': '#f8f9fa',
                '--border-radius': '12px',
                '--padding-start': '12px',
                '--padding-end': '12px',
                margin: '0'
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
          </IonCardContent>
        </IonCard>

        {/* Chat Rooms Liste - Events Design */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '8px 0' }}>
            <IonList lines="none" style={{ background: 'transparent' }}>
              {filteredRooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <IonIcon 
                  icon={chatbubbles} 
                  style={{ 
                    fontSize: '3rem', 
                    color: '#17a2b8', 
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }} 
                />
                  <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Chaträume gefunden</h3>
                  <p style={{ color: '#999', margin: '0' }}>Erstelle deinen ersten Chat!</p>
                </div>
              ) : (
                filteredRooms.map((room) => (
                  <IonItemSliding key={room.id}>
                    <IonItem
                      onClick={() => onSelectRoom(room)}
                      detail={false}
                      style={{
                        '--min-height': '110px',
                        '--padding-start': '16px',
                        '--padding-top': '0px',
                        '--padding-bottom': '0px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '6px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}
                    >
                      <IonLabel>
                        {/* Titel mit Icon und Status Badge in einer Reihe */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '8px',
                          position: 'relative'
                        }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px',
                            backgroundColor: room.type === 'admin' ? '#7045f6' : 
                                           room.type === 'jahrgang' ? '#17a2b8' :
                                           room.type === 'group' ? '#2dd36f' : '#ff6b35',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(23, 162, 184, 0.3)',
                            flexShrink: 0
                          }}>
                            <IonIcon 
                              icon={getRoomIcon(room)} 
                              style={{ 
                                fontSize: '1rem', 
                                color: 'white'
                              }} 
                            />
                          </div>
                          <h2 style={{ 
                            fontWeight: '600', 
                            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                            margin: '0',
                            color: '#333',
                            lineHeight: '1.3',
                            flex: 1,
                            minWidth: 0,
                            marginRight: '110px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {getDisplayRoomName(room)}
                          </h2>
                          
                          {/* Unread Badge rechts - Standard rot */}
                          {room.unread_count > 0 && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'white',
                              fontWeight: '600',
                              backgroundColor: '#dc3545',
                              padding: '3px 6px',
                              borderRadius: '10px',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              flexShrink: 0,
                              position: 'absolute',
                              right: '16px',
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}>
                              {room.unread_count > 99 ? '99+' : room.unread_count}
                            </span>
                          )}
                          
                          {/* Versteckter Platzhalter um Layout zu halten */}
                          {room.unread_count === 0 && room.last_message?.created_at && (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              padding: '3px 6px',
                              borderRadius: '10px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              position: 'absolute',
                              right: '16px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              opacity: 0,
                              visibility: 'hidden'
                            }}>
                              00
                            </span>
                          )}
                        </div>

                        {/* Chat-Typ und Teilnehmer */}
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          color: '#666',
                          marginBottom: '6px'
                        }}>
                          <span style={{ fontWeight: '400', color: '#666' }}>
                            {getRoomSubtitle(room)}
                          </span>
                        </div>
                        
                        {/* Letzte Nachricht - mit Zeitstempel unten rechts */}
                        {room.last_message && (room.last_message.content || room.last_message.file_name) && (
                          <div style={{ 
                            fontSize: '0.8rem',
                            color: '#666',
                            marginTop: '6px'
                          }}>
                            <div style={{ 
                              position: 'relative',
                              paddingRight: '60px',
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'flex-start'
                            }}>
                              {/* Nachricht */}
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px'
                              }}>
                                <span style={{ 
                                  fontWeight: '600',
                                  color: '#333',
                                  flexShrink: 0
                                }}>
                                  {room.last_message.sender_name}:
                                </span>
                                <span style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: '#666'
                                }}>
                                  {room.last_message.content || 
                                   (room.last_message.file_name ? 
                                     room.last_message.file_name 
                                     : 'Datei')}
                                </span>
                              </div>
                              
                              {/* Zeit Badge fest positioniert rechts */}
                              {room.last_message.created_at && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#17a2b8',
                                  fontWeight: '600',
                                  backgroundColor: '#e3f2fd',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #b3e5fc',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                  position: 'absolute',
                                  right: '0',
                                  bottom: '0'
                                }}>
                                  {formatLastMessageTime(room.last_message.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </IonLabel>
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
                ))
              )}
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
});

export default ChatOverview;