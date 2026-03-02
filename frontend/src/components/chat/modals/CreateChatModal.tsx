import React, { useState, useEffect, useRef } from 'react';
import {
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
  IonChip,
  IonListHeader
} from '@ionic/react';
import { close, checkmark, person, people, chevronForward, chatbubblesOutline, peopleOutline, informationCircleOutline } from 'ionicons/icons';
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
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({ onClose, onSuccess, dismiss }) => {
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
    if (chatType) {
      loadUsers();
    }
  }, [chatType]);

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
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
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
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Neuen Chat erstellen</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={handleClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          {chatType === 'group' && (
            <IonButtons slot="end">
              <IonButton
                className="app-modal-submit-btn app-modal-submit-btn--chat"
                onClick={createGroupChat}
                disabled={!canCreate() || creating}
              >
                <IonIcon icon={checkmark} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Chat-Art wählen */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--chat">
              <IonIcon icon={chatbubblesOutline} />
            </div>
            <IonLabel>Chat-Art wählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonItem>
              <IonIcon
                icon={chatbubblesOutline}
                slot="start"
                style={{ color: '#8e8e93', fontSize: '1rem' }}
              />
              <IonSelect
                value={chatType}
                onIonChange={(e) => setChatType(e.detail.value)}
                placeholder="Chat-Art wählen"
                interface="popover"
                style={{ width: '100%' }}
              >
                <IonSelectOption value="direct">Direktnachricht</IonSelectOption>
                <IonSelectOption value="group">Gruppenchat</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* Group Name Input (only for group chats) */}
        {chatType === 'group' && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={peopleOutline} />
              </div>
              <IonLabel>Gruppendetails</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
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
          </IonList>
        )}

        {/* Selected Participants Display (only for group chats) */}
        {chatType === 'group' && selectedParticipants.size > 0 && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={peopleOutline} />
              </div>
              <IonLabel>Ausgewählte Teilnehmer ({selectedParticipants.size})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
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
          </IonList>
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

            {/* Hinweis */}
            <IonList inset={true} className="app-modal-section">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--chat">
                  <IonIcon icon={informationCircleOutline} />
                </div>
                <IonLabel>Hinweis</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>
                    {chatType === 'direct'
                      ? 'Wähle eine Person aus, um eine private Unterhaltung zu starten.'
                      : 'Wähle Teilnehmer für den Gruppenchat aus. Jahrgangschats werden automatisch erstellt.'
                    }
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default CreateChatModal;
