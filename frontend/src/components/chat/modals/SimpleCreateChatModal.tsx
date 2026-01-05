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
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonInput,
  IonAlert,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonItem,
  IonItemGroup,
  IonListHeader,
  IonCard,
  IonCardContent
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  person,
  personOutline,
  search,
  chatbubbles,
  peopleOutline,
  filterOutline,
  calendarOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useBadge } from '../../../contexts/BadgeContext';
import api from '../../../services/api';

interface User {
  id: number;
  name?: string;
  display_name?: string;
  type: 'admin' | 'konfi';
  jahrgang?: string;
  jahrgang_name?: string;
  role_name?: string;
  role_description?: string;
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
  const { user, setError, setSuccess } = useApp();
  const { refreshFromAPI } = useBadge();
  const pageRef = useRef<HTMLElement>(null);

  // State
  const [settings, setSettings] = useState<Settings>({});
  const [chatType, setChatType] = useState<'direct' | 'group'>('direct');

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
    loadUsers();
  }, [chatType]);

  useEffect(() => {
    // DATENSCHUTZ: Konfis dürfen NUR Direktnachrichten an Admins senden
    if (user?.type === 'konfi') {
      setChatType('direct'); // Konfis haben nur Direktnachrichten
    }
  }, [user]);

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
      if (user?.type === 'konfi') {
        // Konfi: Verwende neue sichere API
        const response = await api.get('/chat/available-users');
        const availableUsers = response.data.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          display_name: u.name,
          type: u.type as 'admin' | 'konfi',
          jahrgang_name: u.jahrgang_name,
          // Funktionsbeschreibung vom Backend (bereits mit Fallback)
          role_description: u.role_description
        }));

        console.log('Loaded users for konfi chat:', {
          users: availableUsers.length,
          jahrgang: response.data.jahrgang,
          permissions: response.data.permissions,
          chatType
        });

        // Verfügbare Jahrgänge ermitteln
        const jahrgaenge = [...new Set(availableUsers
          .filter((u: any) => u.jahrgang_name)
          .map((u: any) => u.jahrgang_name!))]
          .sort() as string[];
        setAvailableJahrgaenge(jahrgaenge);

        setUsers(availableUsers);

      } else if (user?.type === 'admin') {
        // Admin: Verwende bestehende Admin-APIs
        const [konfisRes, userJahrgangRes] = await Promise.all([
          api.get('/admin/konfis'),
          api.get('/admin/users/me/jahrgaenge').catch(() => ({ data: [] }))
        ]);

        // Filtere Konfis basierend auf Jahrgangs-Zuweisungen
        let allowedJahrgangIds: number[] = [];
        if (userJahrgangRes.data.length > 0) {
          allowedJahrgangIds = userJahrgangRes.data.map((j: any) => j.jahrgang_id);
          console.log('Admin allowed jahrgang IDs:', allowedJahrgangIds);
        }

        let konfis: User[] = konfisRes.data
          .filter((konfi: any) => {
            // Nur Konfis mit erlaubten Jahrgängen zeigen
            if (allowedJahrgangIds.length > 0) {
              return konfi.jahrgang_id && allowedJahrgangIds.includes(konfi.jahrgang_id);
            }
            return true;
          })
          .map((konfi: any) => ({
            id: konfi.id,
            name: konfi.name || konfi.display_name,
            display_name: konfi.name || konfi.display_name,
            type: 'konfi' as const,
            jahrgang: konfi.jahrgang,
            jahrgang_name: konfi.jahrgang_name
          }));

        // Auch andere Admins laden
        let adminUsers: User[] = [];
        try {
          const usersRes = await api.get('/admin/users');
          adminUsers = usersRes.data
            .filter((u: any) => {
              if (u.role_name === 'konfi' || u.id === user.id) return false;
              return true;
            })
            .map((admin: any) => ({
              id: admin.id,
              name: admin.display_name || admin.name,
              display_name: admin.display_name || admin.name,
              type: 'admin' as const,
              // Funktionsbeschreibung (role_title) hat Priorität, dann Rollenname
              role_description: admin.role_title || admin.role_display_name || admin.role_name
            }));
        } catch (err) {
          console.log('Could not load admins for chat:', err);
        }

        const allUsers = [...konfis, ...adminUsers];
        console.log('Loaded users for admin chat:', {
          konfis: konfis.length,
          admins: adminUsers.length,
          total: allUsers.length,
          chatType
        });

        // Extrahiere verfügbare Jahrgänge (nur von gefilterten Konfis)
        const jahrgaenge = [...new Set(
          konfis
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
      await refreshFromAPI(); // Update badge context
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
      await refreshFromAPI(); // Update badge context
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
    setChatType('direct');
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

    // DATENSCHUTZ: Konfis dürfen NUR Direktnachrichten an Admins senden
    return [
      { value: 'direct', label: 'Direktnachricht' }
    ];
  };

  const isFormValid = chatType === 'direct' || (chatType === 'group' && groupName.trim() && selectedParticipants.size > 0);
  const isAdmin = user?.type === 'admin';

  return (
    <IonPage ref={pageRef}>
      {/* Fixierter Header */}
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={creating}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{chatType === 'direct' ? 'Neue Direktnachricht' : 'Neuer Gruppenchat'}</IonTitle>
          {chatType === 'group' && (
            <IonButtons slot="end">
              <IonButton onClick={createGroupChat} disabled={!isFormValid || creating}>
                {creating ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        {/* Segment im Header für Admin */}
        {isAdmin && (
          <IonToolbar>
            <IonSegment
              value={chatType}
              onIonChange={(e) => setChatType(e.detail.value as 'direct' | 'group')}
            >
              <IonSegmentButton value="direct">
                <IonLabel>Direktnachricht</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="group">
                <IonLabel>Gruppenchat</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent className="app-gradient-background">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Gruppenname Input für Group Chat - iOS26 Pattern */}
          {chatType === 'group' && (
            <IonList inset={true}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--chat">
                  <IonIcon icon={peopleOutline} />
                </div>
                <IonLabel>Gruppenname</IonLabel>
              </IonListHeader>
              <IonItemGroup>
                <IonItem>
                  <IonInput
                    value={groupName}
                    onIonInput={(e) => setGroupName(e.detail.value!)}
                    placeholder="Gruppenname eingeben"
                    clearInput={true}
                    disabled={creating}
                  />
                </IonItem>
              </IonItemGroup>
            </IonList>
          )}

          {/* Filter mit Suche - iOS26 Pattern */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={filterOutline} />
              </div>
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
                  placeholder="Person suchen..."
                />
              </IonItem>
              {/* Rolle Filter - nur für Admins */}
              {isAdmin && (
                <IonItem>
                  <IonIcon
                    icon={personOutline}
                    slot="start"
                    style={{ color: '#8e8e93', fontSize: '1rem' }}
                  />
                  <IonSelect
                    value={selectedRole}
                    onIonChange={(e) => setSelectedRole(e.detail.value!)}
                    placeholder="Alle Rollen"
                    interface="popover"
                    style={{ width: '100%' }}
                  >
                    <IonSelectOption value="alle">Alle Rollen</IonSelectOption>
                    <IonSelectOption value="konfi">Konfis</IonSelectOption>
                    <IonSelectOption value="admin">Admins</IonSelectOption>
                  </IonSelect>
                </IonItem>
              )}
              {/* Jahrgang Filter - nur für Admins */}
              {isAdmin && availableJahrgaenge.length > 0 && (
                <IonItem>
                  <IonIcon
                    icon={calendarOutline}
                    slot="start"
                    style={{ color: '#8e8e93', fontSize: '1rem' }}
                  />
                  <IonSelect
                    value={selectedJahrgang}
                    onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                    placeholder="Alle Jahrgänge"
                    interface="popover"
                    style={{ width: '100%' }}
                  >
                    <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                    {availableJahrgaenge.map(jg => (
                      <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}
            </IonItemGroup>
          </IonList>

          {/* Users List - IonListHeader ueber der Card */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--chat">
                <IonIcon icon={peopleOutline} />
              </div>
              <IonLabel>Personen ({filteredUsers.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {loading ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <IonSpinner name="crescent" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    <IonIcon icon={search} style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ margin: '0', fontSize: '1rem' }}>Keine Personen gefunden</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredUsers.map((targetUser) => {
                      const participantId = `${targetUser.type}-${targetUser.id}`;
                      const isSelected = selectedParticipants.has(participantId);
                      const isAdmin = targetUser.type === 'admin';

                      return (
                        <div
                          key={participantId}
                          className={`app-list-item ${isAdmin ? 'app-list-item--chat' : 'app-list-item--warning'} ${isSelected ? 'app-list-item--selected' : ''}`}
                          onClick={() => {
                            if (!creating) {
                              if (chatType === 'direct') {
                                createDirectMessage(targetUser);
                              } else {
                                handleParticipantToggle(participantId);
                              }
                            }
                          }}
                          style={{
                            cursor: creating ? 'default' : 'pointer',
                            opacity: creating ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0',
                            borderLeftColor: isAdmin ? '#06b6d4' : '#ff9500'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div className={`app-icon-circle app-icon-circle--lg ${isAdmin ? 'app-icon-circle--chat' : 'app-icon-circle--warning'}`}>
                              <IonIcon icon={person} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">
                                {getUserDisplayName(targetUser)}
                              </div>
                              <div className="app-list-item__subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`app-chip ${isAdmin ? 'app-chip--chat' : 'app-chip--warning'}`}>
                                  {isAdmin ? (targetUser.role_description || 'Admin') : 'Konfi'}
                                </span>
                                {!isAdmin && (targetUser.jahrgang_name || targetUser.jahrgang) && (
                                  <span style={{ color: '#666' }}>
                                    {targetUser.jahrgang_name || targetUser.jahrgang}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {chatType === 'group' && (
                            <IonCheckbox
                              checked={isSelected}
                              style={{
                                '--checkbox-background-checked': isAdmin ? '#06b6d4' : '#ff9500',
                                '--border-color-checked': isAdmin ? '#06b6d4' : '#ff9500',
                                '--checkmark-color': 'white'
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        </div>
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
