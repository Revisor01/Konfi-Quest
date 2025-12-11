import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
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
  IonListHeader
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  person,
  search
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
          jahrgang_name: u.jahrgang_name
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
              role_name: admin.role_display_name || admin.role_name,
              role_description: admin.role_description
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
      <IonContent className="app-gradient-background">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Icons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IonButtons>
              <IonButton onClick={handleClose} disabled={creating}>
                <IonIcon icon={closeOutline} slot="icon-only" />
              </IonButton>
            </IonButtons>
            {chatType === 'group' ? (
              <IonButtons>
                <IonButton onClick={createGroupChat} disabled={!isFormValid || creating}>
                  {creating ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
                </IonButton>
              </IonButtons>
            ) : (
              <div style={{ width: '44px' }} />
            )}
          </div>

          {/* Segment für Admin */}
          {isAdmin && (
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
          )}

          {/* Gruppenname Input für Group Chat - iOS26 Pattern */}
          {chatType === 'group' && (
            <IonList inset={true}>
              <IonListHeader>
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
                  placeholder={chatType === 'direct' ? 'Person suchen...' : 'Teilnehmer suchen...'}
                />
              </IonItem>
              {/* Filter in einer Zeile */}
              <IonItem>
                <div style={{ display: 'flex', gap: '8px', width: '100%', padding: '8px 0' }}>
                  <IonSelect
                    value={selectedRole}
                    onIonChange={(e) => setSelectedRole(e.detail.value!)}
                    placeholder="Alle Rollen"
                    interface="popover"
                    fill="solid"
                    style={{ flex: 1 }}
                  >
                    <IonSelectOption value="alle">Alle Rollen</IonSelectOption>
                    <IonSelectOption value="konfi">Konfis</IonSelectOption>
                    <IonSelectOption value="admin">Admins</IonSelectOption>
                  </IonSelect>
                  <IonSelect
                    value={selectedJahrgang}
                    onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                    placeholder="Alle Jahrgänge"
                    interface="popover"
                    fill="solid"
                    style={{ flex: 1 }}
                  >
                    <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                    {availableJahrgaenge.map(jg => (
                      <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </IonItem>
            </IonItemGroup>
          </IonList>

          {/* Users List - gleiche Breite wie inset Lists */}
          <div style={{ padding: '0 16px' }}>
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
                      const color = targetUser.type === 'admin' ? '#17a2b8' : '#ff6b35';

                      return (
                        <div
                          key={participantId}
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
                            borderLeft: `4px solid ${color}`,
                            border: '1px solid #e0e0e0',
                            borderLeftWidth: '4px',
                            borderLeftColor: color,
                            borderRadius: '12px',
                            padding: '10px 10px',
                            background: 'white',
                            cursor: creating ? 'default' : 'pointer',
                            opacity: creating ? 0.6 : 1
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            {/* Icon */}
                            <div style={{
                              width: '40px',
                              height: '40px',
                              backgroundColor: color,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={person}
                                style={{ fontSize: '1.2rem', color: 'white' }}
                              />
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
                                {getUserDisplayName(targetUser)}
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
                                  {targetUser.type === 'admin'
                                    ? (targetUser.role_description || targetUser.role_name || 'Admin')
                                    : 'Konfi'}
                                </span>
                                {targetUser.type === 'konfi' && (targetUser.jahrgang_name || targetUser.jahrgang) && (
                                  <span style={{
                                    fontSize: '0.75rem',
                                    color: '#666'
                                  }}>
                                    {targetUser.jahrgang_name || targetUser.jahrgang}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Checkbox für Gruppenchat */}
                            {chatType === 'group' && (
                              <IonCheckbox
                                checked={isSelected}
                                color={targetUser.type === 'admin' ? 'tertiary' : 'primary'}
                                style={{ flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </div>
                      );
                })}
              </div>
            )}
          </div>
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
