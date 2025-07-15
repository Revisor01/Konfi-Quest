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
  IonAlert
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

interface SimpleCreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SimpleCreateChatModal: React.FC<SimpleCreateChatModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  const [chatType, setChatType] = useState<'direct' | 'group' | ''>('');
  const [users, setUsers] = useState<User[]>([]);
  const [existingChats, setExistingChats] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  
  // Group chat specific
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadExistingChats();
      if (chatType) {
        loadUsers();
      }
    }
  }, [isOpen, chatType]);

  const loadExistingChats = async () => {
    try {
      const response = await api.get('/chat/rooms');
      setExistingChats(response.data);
    } catch (err) {
      console.error('Error loading existing chats:', err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [konfisRes, adminsRes] = await Promise.all([
        api.get('/konfis'),
        api.get('/admin/users').catch(() => ({ data: [] }))
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

  const checkDirectChatExists = (targetUser: User) => {
    return existingChats.some(chat => 
      chat.type === 'direct' && 
      chat.participants &&
      chat.participants.some((p: any) => 
        p.id === targetUser.id && p.type === targetUser.type
      )
    );
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
    // Check if chat already exists
    if (checkDirectChatExists(targetUser)) {
      setDuplicateMessage(`Ein Chat mit ${targetUser.name || targetUser.display_name} existiert bereits.`);
      setShowDuplicateAlert(true);
      return;
    }

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
      // Convert participant IDs from "type-id" format to objects
      const participants = Array.from(selectedParticipants).map(participantId => {
        const [type, id] = participantId.split('-');
        return {
          user_id: parseInt(id),
          user_type: type
        };
      });

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
          <IonItem>
            <IonLabel position="stacked">Art des Chats</IonLabel>
            <IonSelect
              value={chatType}
              onIonChange={(e) => setChatType(e.detail.value)}
              placeholder="Chat-Art wählen"
              interface="action-sheet"
            >
              <IonSelectOption value="direct">Direktnachricht</IonSelectOption>
              <IonSelectOption value="group">Gruppenchat</IonSelectOption>
            </IonSelect>
          </IonItem>

          {/* Group Name Input */}
          {chatType === 'group' && (
            <IonItem>
              <IonLabel position="stacked">Gruppenname</IonLabel>
              <IonInput
                value={groupName}
                onIonInput={(e) => setGroupName(e.detail.value!)}
                placeholder="Gruppenname eingeben"
                clearInput={true}
              />
            </IonItem>
          )}

          {/* Search */}
          {chatType && (
            <IonSearchbar
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder={chatType === 'direct' ? 'Person suchen...' : 'Teilnehmer suchen...'}
            />
          )}

          {/* Users List */}
          {chatType && (
            <>
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
                      >
                        <IonAvatar slot="start" style={{ 
                          width: '40px', 
                          height: '40px',
                          backgroundColor: targetUser.type === 'admin' ? '#7045f6' : '#3880ff',
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
                          <h3>{getUserDisplayName(targetUser)}</h3>
                          <p>
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
            </>
          )}
        </IonContent>
      </IonPage>

      {/* Duplicate Alert */}
      <IonAlert
        isOpen={showDuplicateAlert}
        onDidDismiss={() => setShowDuplicateAlert(false)}
        header="Chat existiert bereits"
        message={duplicateMessage}
        buttons={['OK']}
      />
    </IonModal>
  );
};

export default SimpleCreateChatModal;