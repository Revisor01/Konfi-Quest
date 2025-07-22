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
  IonAlert,
  IonGrid,
  IonRow,
  IonCol
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
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

interface Settings {
  konfi_chat_permissions?: string;
}

const SimpleCreateChatModal: React.FC<SimpleCreateChatModalProps> = ({ onClose, onSuccess, dismiss }) => {
  const { user, setError, setSuccess, refreshChatNotifications } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  
  // State
  const [settings, setSettings] = useState<Settings>({});
  // Konfis standardmäßig auf direct setzen, aber je nach Settings flexibel
  const [chatType, setChatType] = useState<'direct' | 'group' | ''>('');

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const [users, setUsers] = useState<User[]>([]);
  const [existingChats, setExistingChats] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  
  // Filter states
  const [selectedRole, setSelectedRole] = useState<string>('alle');
  const [selectedJahrgang, setSelectedJahrgang] = useState<string>('alle');
  const [availableJahrgaenge, setAvailableJahrgaenge] = useState<string[]>([]);
  
  // Group chat specific
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
    loadExistingChats();
  }, []);

  useEffect(() => {
    if (chatType) {
      loadUsers();
    }
  }, [chatType]);

  useEffect(() => {
    // Set initial chat type based on user type and permissions
    if (user?.type === 'konfi') {
      const permissions = settings.konfi_chat_permissions || 'direct_only';
      setChatType('direct'); // Default to direct for konfis
      loadUsers();
    }
  }, [user, settings]);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

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
        api.get('/admin/konfis'),
        api.get('/admin/users').catch(() => ({ data: [] }))
      ]);
      
      const allUsers: User[] = [
        ...konfisRes.data.map((konfi: any) => ({ ...konfi, type: 'konfi' as const })),
        ...adminsRes.data.map((admin: any) => ({ ...admin, type: 'admin' as const }))
      ];
      
      // Extrahiere verfügbare Jahrgänge
      const jahrgaenge = [...new Set(
        allUsers
          .filter(u => u.jahrgang_name || u.jahrgang)
          .map(u => u.jahrgang_name || u.jahrgang)
      )].filter(Boolean) as string[];
      setAvailableJahrgaenge(jahrgaenge);
      
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
      await refreshChatNotifications(); // Update badges
      handleModalClose();
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

      console.log('Creating group chat with data:', groupData);
      const response = await api.post('/chat/rooms', groupData);
      console.log('Group chat created successfully:', response.data);
      
      setSuccess(`Gruppenchat "${groupName}" erstellt`);
      await refreshChatNotifications(); // Update badges
      handleModalClose();
      onSuccess();
    } catch (err: any) {
      console.error('Error creating group chat:', err);
      console.error('Error response:', err.response?.data);
      setError(`Fehler beim Erstellen des Gruppenchats: ${err.response?.data?.error || err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleModalClose = () => {
    setChatType('');
    setGroupName('');
    setSearchText('');
    setSelectedParticipants(new Set());
    setUsers([]);
    handleClose();
  };

  const filteredUsers = users.filter(user => {
    // Name/Suchfilter
    const name = user.name || user.display_name || '';
    const matchesSearch = name.toLowerCase().includes(searchText.toLowerCase()) ||
           (user.jahrgang && user.jahrgang.toLowerCase().includes(searchText.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    // Rollenfilter
    if (selectedRole !== 'alle') {
      if (selectedRole === 'konfi' && user.type !== 'konfi') return false;
      if (selectedRole === 'admin' && user.type !== 'admin') return false;
    }
    
    // Jahrgangsfilter (nur für Konfis)
    if (selectedJahrgang !== 'alle' && user.type === 'konfi') {
      const userJahrgang = user.jahrgang_name || user.jahrgang;
      if (userJahrgang !== selectedJahrgang) return false;
    }
    
    return true;
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

  const getAvailableChatTypes = () => {
    if (user?.type === 'admin') {
      return [
        { value: 'direct', label: 'Direktnachricht' },
        { value: 'group', label: 'Gruppenchat' }
      ];
    }
    
    const permissions = settings.konfi_chat_permissions || 'direct_only';
    const types = [];
    
    switch (permissions) {
      case 'direct_only':
        types.push({ value: 'direct', label: 'Direktnachricht' });
        break;
      case 'direct_and_group':
        types.push({ value: 'direct', label: 'Direktnachricht' });
        types.push({ value: 'group', label: 'Gruppenchat' });
        break;
      case 'all':
        types.push({ value: 'direct', label: 'Direktnachricht' });
        types.push({ value: 'group', label: 'Gruppenchat' });
        // Jahrgang und admin_team werden nur von Admins erstellt
        break;
    }
    
    return types;
  };

  return (
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
          {/* Chat Type Selection - Basierend auf Benutzerrechten */}
          {(() => {
            const availableTypes = getAvailableChatTypes();
            
            // Wenn nur eine Option verfügbar ist, zeige Info statt Select
            if (availableTypes.length === 1) {
              const singleType = availableTypes[0];
              return (
                <IonItem>
                  <IonLabel>
                    <h3>{singleType.label} erstellen</h3>
                    <p>
                      {singleType.value === 'direct' 
                        ? 'Sie können Direktnachrichten mit anderen Personen erstellen.'
                        : 'Sie können Gruppenchats mit mehreren Teilnehmern erstellen.'
                      }
                    </p>
                  </IonLabel>
                </IonItem>
              );
            }
            
            // Mehrere Optionen: Zeige Select
            return (
              <IonItem>
                <IonLabel position="stacked">Art des Chats</IonLabel>
                <IonSelect
                  value={chatType}
                  onIonChange={(e) => setChatType(e.detail.value)}
                  placeholder="Chat-Art wählen"
                  interface="action-sheet"
                >
                  {availableTypes.map(type => (
                    <IonSelectOption key={type.value} value={type.value}>
                      {type.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            );
          })()}

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
            <>
              <IonSearchbar
                value={searchText}
                onIonInput={(e) => setSearchText(e.detail.value!)}
                placeholder={chatType === 'direct' ? 'Person suchen...' : 'Teilnehmer suchen...'}
              />
              
              {/* Filter Controls */}
              <div style={{ padding: '0 16px 16px' }}>
                <IonGrid>
                  <IonRow>
                    <IonCol size="6">
                      <IonItem lines="none">
                        <IonSelect 
                          value={selectedRole} 
                          onSelectionChange={(e) => setSelectedRole(e.detail.value)}
                          placeholder="Alle Rollen"
                          interface="action-sheet"
                        >
                          <IonSelectOption value="alle">Alle Rollen</IonSelectOption>
                          <IonSelectOption value="konfi">Konfis</IonSelectOption>
                          <IonSelectOption value="admin">Admins</IonSelectOption>
                        </IonSelect>
                      </IonItem>
                    </IonCol>
                    <IonCol size="6">
                      <IonItem lines="none">
                        <IonSelect 
                          value={selectedJahrgang} 
                          onSelectionChange={(e) => setSelectedJahrgang(e.detail.value)}
                          placeholder="Alle Jahrgänge"
                          interface="action-sheet"
                        >
                          <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                          {availableJahrgaenge.map(jg => (
                            <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                          ))}
                        </IonSelect>
                      </IonItem>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </div>
            </>
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
                        
                        {chatType === 'group' && (
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

        {/* Duplicate Alert */}
        <IonAlert
          isOpen={showDuplicateAlert}
          onDidDismiss={() => setShowDuplicateAlert(false)}
          header="Chat existiert bereits"
          message={duplicateMessage}
          buttons={['OK']}
        />
      </IonPage>
  );
};

export default SimpleCreateChatModal;