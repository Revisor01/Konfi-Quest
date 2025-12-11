import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonButtons,
  IonGrid,
  IonRow,
  IonCol,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonList,
  IonListHeader,
  IonItemGroup,
  IonLabel,
  IonSelect,
  IonSelectOption,
  useIonModal,
  useIonAlert
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
import { initializeWebSocket, getSocket } from '../../services/websocket';
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
  const [presentAlert] = useIonAlert();
  const { refreshFromAPI, badgeCount, setBadgeCount } = useBadge();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('alle');

  const isAdmin = user?.type === 'admin';

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

  // WebSocket: Live-Update wenn neue Nachrichten ankommen
  useEffect(() => {
    const token = localStorage.getItem('konfi_token');
    if (!token) return;

    const socket = initializeWebSocket(token);

    const handleNewMessage = () => {
      console.log('📡 ChatOverview: New message via WebSocket, refreshing rooms');
      loadChatRooms(true); // Silent reload
    };

    const handleReconnect = () => {
      console.log('📡 ChatOverview: WebSocket reconnected, refreshing rooms');
      loadChatRooms(true); // Silent reload
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('connect', handleReconnect); // Bei jedem (Re-)Connect Rooms aktualisieren

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('connect', handleReconnect);
    };
  }, []);

  const loadChatRooms = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/chat/rooms');
      setRooms(response.data);

      // Badge Context immer aktualisieren wenn Räume geladen werden
      // Berechne Total aus geladenen Daten (schneller als erneuter API Call)
      const totalUnread = response.data.reduce((sum: number, room: any) => sum + (room.unread_count || 0), 0);
      setBadgeCount(totalUnread);
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
    presentChatModalHook({
      presentingElement: pageRef.current || undefined
    });
  };

  // Expose loadChatRooms to parent component
  React.useImperativeHandle(ref, () => ({
    loadChatRooms
  }));

  const deleteRoom = async (room: ChatRoom, forceDelete = false) => {
    const executeDelete = async (force: boolean) => {
      try {
        const url = force ? `/chat/rooms/${room.id}?force=true` : `/chat/rooms/${room.id}`;
        await api.delete(url);
        setSuccess(`Chat "${room.name}" und alle Daten gelöscht`);
        await loadChatRooms();
      } catch (error: any) {
        if (error.response?.data?.canForceDelete) {
          // Org Admin kann trotzdem löschen
          presentAlert({
            header: 'Als Admin löschen?',
            message: `${error.response.data.error}\n\nAls Organisation-Admin können Sie dennoch löschen. Dadurch werden ALLE Chat-Nachrichten unwiderruflich gelöscht!`,
            buttons: [
              { text: 'Abbrechen', role: 'cancel' },
              {
                text: 'Dennoch löschen',
                role: 'destructive',
                handler: async () => {
                  await executeDelete(true);
                }
              }
            ]
          });
        } else if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else {
          setError('Fehler beim Löschen des Chats');
        }
      }
    };

    if (forceDelete) {
      await executeDelete(true);
      return;
    }

    // Erste Bestätigung
    presentAlert({
      header: 'Chat löschen',
      message: `Chat "${room.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            // Zweite Bestätigung mit Warnung
            presentAlert({
              header: 'Endgültig löschen?',
              message: `ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!\n\nAlle Nachrichten, Dateien und Daten werden PERMANENT gelöscht.\n\nChat "${room.name}" wirklich endgültig löschen?`,
              buttons: [
                { text: 'Abbrechen', role: 'cancel' },
                {
                  text: 'Endgültig löschen',
                  role: 'destructive',
                  handler: async () => {
                    await executeDelete(false);
                  }
                }
              ]
            });
          }
        }
      ]
    });
  };

  const filteredRooms = rooms
    .filter(room => {
      // Suchfilter
      const matchesSearch = room.name.toLowerCase().includes(searchText.toLowerCase());
      if (!matchesSearch) return false;

      // Typ-Filter
      if (filterType === 'alle') return true;
      if (filterType === 'direkt') return room.type === 'direct';
      if (filterType === 'gruppe') return room.type === 'group' || room.type === 'admin';
      if (filterType === 'jahrgang') return room.type === 'jahrgang';
      return true;
    })
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

        {/* Suche & Filter - iOS26 Pattern wie im Modal */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <IonIcon icon={search} style={{ color: '#06b6d4', marginRight: '8px', fontSize: '1.1rem' }} />
            <IonLabel>Suche & Filter</IonLabel>
          </IonListHeader>
          <IonItemGroup>
            {/* Suchfeld */}
            <IonItem>
              <IonIcon
                icon={search}
                slot="start"
                style={{
                  color: '#8e8e93',
                  fontSize: '1rem'
                }}
              />
              <IonInput
                value={searchText}
                onIonInput={(e) => setSearchText(e.detail.value!)}
                placeholder="Chaträume durchsuchen..."
              />
            </IonItem>
            {/* Filter */}
            <IonItem lines="none">
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                <IonSelect
                  value={filterType}
                  onIonChange={(e) => setFilterType(e.detail.value!)}
                  placeholder="Alle Chats"
                  interface="popover"
                  style={{
                    '--background': '#f2f2f7',
                    '--border-radius': '8px',
                    '--padding-start': '12px',
                    '--padding-end': '12px',
                    minWidth: '160px'
                  }}
                >
                  <IonSelectOption value="alle">Alle Chats</IonSelectOption>
                  <IonSelectOption value="direkt">Direktnachrichten</IonSelectOption>
                  <IonSelectOption value="gruppe">Gruppenchats</IonSelectOption>
                  <IonSelectOption value="jahrgang">Jahrgangschats</IonSelectOption>
                </IonSelect>
              </div>
            </IonItem>
          </IonItemGroup>
        </IonList>

        {/* Chat Rooms Liste - Karten-Design mit farbigem Rand + Swipe */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <IonCard style={{ margin: '0' }}>
            <IonCardContent style={{ padding: '16px' }}>
              {filteredRooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
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
                <IonList lines="none" style={{ background: 'transparent', padding: '0' }}>
                  {filteredRooms.map((room, index) => {
                    const color = room.type === 'admin' ? '#17a2b8' :
                                  room.type === 'jahrgang' ? '#06b6d4' :
                                  room.type === 'group' ? '#2dd36f' : '#ff6b35';
                    // Nur Admins dürfen direct/group Chats löschen
                    const canDelete = isAdmin && (room.type === 'direct' || room.type === 'group');

                    return (
                      <IonItemSliding key={room.id} disabled={!canDelete} style={{ marginBottom: index < filteredRooms.length - 1 ? '8px' : '0' }}>
                        <IonItem
                          onClick={() => onSelectRoom(room)}
                          lines="none"
                          detail={false}
                          style={{
                            '--background': 'white',
                            '--padding-start': '0',
                            '--padding-end': '0',
                            '--inner-padding-end': '0',
                            '--inner-border-width': '0',
                            '--border-style': 'none',
                            '--min-height': 'auto',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            border: '1px solid #e0e0e0',
                            borderLeft: `4px solid ${color}`,
                            borderRadius: '12px'
                          }}
                        >
                          <div style={{ padding: '12px 16px', width: '100%' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}>
                              {/* Icon mit Unread-Badge */}
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  backgroundColor: color,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <IonIcon
                                    icon={getRoomIcon(room)}
                                    style={{ fontSize: '1.2rem', color: 'white' }}
                                  />
                                </div>
                                {room.unread_count > 0 && (
                                  <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    fontSize: '0.55rem',
                                    color: 'white',
                                    fontWeight: '700',
                                    backgroundColor: '#dc3545',
                                    width: room.unread_count > 9 ? '18px' : '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                  }}>
                                    {room.unread_count > 9 ? '9+' : room.unread_count}
                                  </span>
                                )}
                              </div>

                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontWeight: '600',
                                  fontSize: '0.95rem',
                                  color: '#333',
                                  marginBottom: '4px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {getDisplayRoomName(room)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    backgroundColor: `${color}20`,
                                    color: color
                                  }}>
                                    {getRoomSubtitle(room)}
                                  </span>
                                  {room.last_message?.created_at && (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: '#666',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      <IonIcon icon={time} style={{ fontSize: '0.75rem' }} />
                                      {formatLastMessageTime(room.last_message.created_at)}
                                    </span>
                                  )}
                                </div>
                                {/* Letzte Nachricht */}
                                {room.last_message && (room.last_message.content || room.last_message.file_name) && (
                                  <div style={{
                                    marginTop: '4px',
                                    fontSize: '0.8rem',
                                    color: '#666',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    <span style={{ fontWeight: '600', color: '#333' }}>
                                      {room.last_message.sender_name}:
                                    </span>{' '}
                                    {room.last_message.content || room.last_message.file_name || 'Datei'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </IonItem>

                        {/* Swipe Delete für direct/group chats */}
                        {canDelete && (
                          <IonItemOptions side="end" style={{
                            '--ion-item-background': 'transparent',
                            '--border-style': 'none'
                          }}>
                            <IonItemOption
                              onClick={() => deleteRoom(room)}
                              style={{
                                '--background': 'transparent',
                                '--background-activated': 'transparent',
                                '--background-focused': 'transparent',
                                '--background-hover': 'transparent',
                                '--color': 'transparent',
                                '--ripple-color': 'transparent',
                                '--border-style': 'none',
                                padding: '0 12px 0 16px',
                                minWidth: '72px',
                                maxWidth: '72px'
                              }}
                            >
                              <div style={{
                                width: '44px',
                                height: '44px',
                                backgroundColor: '#dc3545',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                              }}>
                                <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                              </div>
                            </IonItemOption>
                          </IonItemOptions>
                        )}
                      </IonItemSliding>
                    );
                  })}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
});

export default ChatOverview;