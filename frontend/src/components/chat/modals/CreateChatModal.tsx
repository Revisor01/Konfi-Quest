import React, { useState, useEffect, useRef } from 'react';
import {
  IonModal,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonAvatar,
  IonText,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonInput,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip
} from '@ionic/react';
import { close, checkmark, person, people, chevronForward } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface User {
  id: number;
  name?: string;
  display_name?: string;
  type: 'admin' | 'konfi';
  jahrgang?: string;
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  const [chatType, setChatType] = useState<'direct' | 'group' | ''>('');
  const [users, setUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Group chat specific
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && chatType) {
      loadUsers();
    }
  }, [isOpen, chatType]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [konfisRes, adminsRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/admin/users').catch(() => ({ data: [] })) // Fallback if endpoint doesn't exist
      ]);
      
      const allUsers: User[] = [
        ...konfisRes.data.map((konfi: any) => ({ ...konfi, type: 'konfi' as const })),
        ...adminsRes.data.map((admin: any) => ({ ...admin, type: 'admin' as const }))
      ];
      
      // Filter out current user for direct messages
      if (chatType === 'direct') {
        const filteredUsers = allUsers.filter(u => 
          !(u.id === user?.id && u.type === user?.type)
        );
        setUsers(filteredUsers);
      } else {
        setUsers(allUsers);
      }
    } catch (err) {
      setError('Fehler beim Laden der Benutzer');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantToggle = (id: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
  };

  const createDirectMessage = async (targetUser: User) => {
    setCreating(true);
    try {
      const response = await api.post('/chat/direct', {
        target_user_id: targetUser.id,
        target_user_type: targetUser.type
      });
      
      setSuccess(`Direktnachricht mit ${targetUser.name || targetUser.display_name} erstellt`);
      handleClose();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Erstellen der Direktnachricht');
      console.error('Error creating direct message:', err);
    } finally {
      setCreating(false);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      setError('Bitte geben Sie einen Gruppennamen ein');
      return;
    }

    if (selectedParticipants.size === 0) {
      setError('Bitte wählen Sie mindestens einen Teilnehmer aus');
      return;
    }

    setCreating(true);
    try {
      const participants = Array.from(selectedParticipants);
      const groupData = {
        name: groupName.trim(),
        type: 'group',
        participants: participants
      };

      await api.post('/chat/rooms', groupData);
      
      setSuccess(`Gruppenchat "${groupName}" erstellt`);
      handleClose();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Erstellen des Gruppenchats');
      console.error('Error creating group chat:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setChatType('');
    setGroupName('');
    setSearchText('');
    setSelectedParticipants(new Set());
    setUsers([]);
    onClose();
  };

  const filteredUsers = users.filter(user => {
    const name = user.name || user.display_name || '';
    return name.toLowerCase().includes(searchText.toLowerCase()) ||
           (user.jahrgang && user.jahrgang.toLowerCase().includes(searchText.toLowerCase()));
  });

  const getUserDisplayName = (user: User) => {
    return user.name || user.display_name || 'Unbekannt';
  };

  const canCreate = () => {
    if (chatType === 'group') {
      return groupName.trim() && selectedParticipants.size > 0;
    }
    return chatType === 'direct';
  };

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={handleClose}
      presentingElement={pageRef.current || undefined}
      canDismiss={true}
      backdropDismiss={true}
    >
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Neuen Chat erstellen</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={handleClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
            {chatType === 'group' && (
              <IonButtons slot="end">
                <IonButton 
                  onClick={createGroupChat} 
                  disabled={!canCreate() || creating}
                  color="primary"
                >
                  <IonIcon icon={checkmark} />
                </IonButton>
              </IonButtons>
            )}
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          {/* Chat Type Selection */}
          <IonCard className="app-card" style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: '1.1rem' }}>Chat-Art wählen</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Art des Chats</IonLabel>
                <IonSelect
                  value={chatType}
                  onIonChange={(e) => setChatType(e.detail.value)}
                  placeholder="Chat-Art wählen"
                  interface="action-sheet"
                  interfaceOptions={{
                    header: 'Chat-Art auswählen'
                  }}
                >
                  <IonSelectOption value="direct">Direktnachricht</IonSelectOption>
                  <IonSelectOption value="group">Gruppenchat</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonCardContent>
          </IonCard>

          {/* Group Name Input (only for group chats) */}
          {chatType === 'group' && (
            <IonCard className="app-card" style={{ margin: '16px' }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: '1.1rem' }}>Gruppendetails</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonItem>
                  <IonLabel position="stacked">Gruppenname *</IonLabel>
                  <IonInput
                    value={groupName}
                    onIonInput={(e) => setGroupName(e.detail.value!)}
                    placeholder="z.B. Konfi 2025 Projektgruppe"
                    clearInput={true}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>
          )}

          {/* Selected Participants Display (only for group chats) */}
          {chatType === 'group' && selectedParticipants.size > 0 && (
            <IonCard className="app-card" style={{ margin: '16px' }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: '1rem' }}>
                  Ausgewählte Teilnehmer ({selectedParticipants.size})
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Array.from(selectedParticipants).map(participantId => {
                    const [type, id] = participantId.split('-');
                    let name = '';
                    
                    if (type === 'konfi') {
                      const konfi = users.find(k => k.type === 'konfi' && k.id.toString() === id);
                      name = konfi?.name || 'Unbekannt';
                    } else if (type === 'admin') {
                      const admin = users.find(a => a.type === 'admin' && a.id.toString() === id);
                      name = admin?.display_name || 'Unbekannt';
                    }
                    
                    return (
                      <IonChip
                        key={participantId}
                        color={type === 'admin' ? 'tertiary' : 'primary'}
                        onClick={() => handleParticipantToggle(participantId)}
                      >
                        <IonIcon icon={type === 'admin' ? person : people} />
                        <IonLabel>{name}</IonLabel>
                        <IonIcon icon={close} />
                      </IonChip>
                    );
                  })}
                </div>
              </IonCardContent>
            </IonCard>
          )}

          {/* User Selection */}
          {chatType && (
            <>
              {/* Search */}
              <div style={{ padding: '0 16px' }}>
                <IonSearchbar
                  value={searchText}
                  onIonInput={(e) => setSearchText(e.detail.value!)}
                  placeholder={chatType === 'direct' ? 'Person suchen...' : 'Teilnehmer suchen...'}
                  style={{
                    '--background': '#f8f9fa',
                    '--border-radius': '12px'
                  }}
                />
              </div>

              {/* Users List */}
              <div style={{ padding: '0 16px' }}>
                {loading ? (
                  <LoadingSpinner message="Benutzer werden geladen..." />
                ) : filteredUsers.length === 0 ? (
                  <IonText color="medium" style={{ 
                    display: 'block', 
                    textAlign: 'center', 
                    padding: '32px 16px' 
                  }}>
                    <p>Keine Personen gefunden</p>
                  </IonText>
                ) : (
                  <IonList>
                    {filteredUsers.map((targetUser) => {
                      const participantId = `${targetUser.type}-${targetUser.id}`;
                      const isSelected = selectedParticipants.has(participantId);
                      
                      return (
                        <IonItem 
                          key={participantId}
                          button 
                          onClick={() => {
                            if (chatType === 'direct') {
                              createDirectMessage(targetUser);
                            } else {
                              handleParticipantToggle(participantId);
                            }
                          }}
                          disabled={creating}
                          style={{ '--min-height': '60px' }}
                        >
                          <IonAvatar slot="start" style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: '#17a2b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IonIcon
                              icon={targetUser.type === 'admin' ? person : people}
                              style={{
                                fontSize: '1.2rem',
                                color: 'white'
                              }}
                            />
                          </IonAvatar>
                          
                          <IonLabel>
                            <h3 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                              {getUserDisplayName(targetUser)}
                            </h3>
                            <p style={{ 
                              margin: '0', 
                              fontSize: '0.9rem', 
                              color: '#666' 
                            }}>
                              {targetUser.type === 'admin' ? 'Admin' : 
                               (targetUser.jahrgang ? `Jahrgang ${targetUser.jahrgang}` : 'Konfi')}
                            </p>
                          </IonLabel>
                          
                          {chatType === 'direct' ? (
                            <IonIcon 
                              icon={chevronForward} 
                              slot="end" 
                              style={{ color: '#c7c7cc' }}
                            />
                          ) : (
                            <IonCheckbox 
                              slot="end" 
                              checked={isSelected}
                              color={targetUser.type === 'admin' ? 'tertiary' : 'primary'}
                            />
                          )}
                        </IonItem>
                      );
                    })}
                  </IonList>
                )}
              </div>

              {/* Info */}
              <div style={{ 
                margin: '24px 16px 0 16px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px'
              }}>
                <IonText color="medium">
                  <p style={{ 
                    margin: '0', 
                    fontSize: '0.9rem',
                    lineHeight: '1.4' 
                  }}>
                    {chatType === 'direct' 
                      ? 'Wählen Sie eine Person aus, um eine private Unterhaltung zu starten.'
                      : 'Wählen Sie Teilnehmer für den Gruppenchat aus. Jahrgangschats werden automatisch erstellt.'
                    }
                  </p>
                </IonText>
              </div>
            </>
          )}
        </IonContent>
      </IonPage>
    </IonModal>
  );
};

export default CreateChatModal;