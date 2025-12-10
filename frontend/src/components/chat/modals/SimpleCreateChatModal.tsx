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
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonInput,
  IonAlert,
  IonItemGroup,
  IonListHeader,
  IonNote,
  IonSpinner,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  personCircleOutline
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

  const [settings, setSettings] = useState<Settings>({});
  const [chatType, setChatType] = useState<'direct' | 'group'>('direct');
  const [users, setUsers] = useState<User[]>([]);
  const [existingChats, setExistingChats] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('alle');
  const [selectedJahrgang, setSelectedJahrgang] = useState<string>('alle');
  const [availableJahrgaenge, setAvailableJahrgaenge] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    loadSettings();
    loadExistingChats();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [chatType]);

  useEffect(() => {
    if (user?.type === 'konfi') {
      setChatType('direct');
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
        const response = await api.get('/chat/available-users');
        const availableUsers = response.data.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          display_name: u.name,
          type: u.type as 'admin' | 'konfi',
          jahrgang_name: u.jahrgang_name
        }));
        const jahrgaenge = [...new Set(availableUsers
          .filter((u: any) => u.jahrgang_name)
          .map((u: any) => u.jahrgang_name!))]
          .sort() as string[];
        setAvailableJahrgaenge(jahrgaenge);
        setUsers(availableUsers);
      } else if (user?.type === 'admin') {
        const [konfisRes, userJahrgangRes] = await Promise.all([
          api.get('/admin/konfis'),
          api.get('/admin/users/me/jahrgaenge').catch(() => ({ data: [] }))
        ]);
        let allowedJahrgangIds: number[] = [];
        if (userJahrgangRes.data.length > 0) {
          allowedJahrgangIds = userJahrgangRes.data.map((j: any) => j.jahrgang_id);
        }
        let konfis: User[] = konfisRes.data
          .filter((konfi: any) => {
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
        let adminUsers: User[] = [];
        try {
          const usersRes = await api.get('/admin/users');
          adminUsers = usersRes.data
            .filter((u: any) => u.role_name !== 'konfi' && u.id !== user.id)
            .map((admin: any) => ({
              id: admin.id,
              name: admin.display_name || admin.name,
              display_name: admin.display_name || admin.name,
              type: 'admin' as const
            }));
        } catch (err) {
          console.log('Could not load admins for chat:', err);
        }
        const allUsers = [...konfis, ...adminUsers];
        const jahrgaenge = [...new Set(
          konfis
            .filter(u => u.jahrgang_name || u.jahrgang)
            .map(u => u.jahrgang_name || u.jahrgang)
        )].filter(Boolean) as string[];
        setAvailableJahrgaenge(jahrgaenge);
        if (chatType === 'direct') {
          setUsers(allUsers.filter(u => !(u.id === user?.id && u.type === user?.type)));
        } else {
          setUsers(allUsers);
        }
      }
    } catch (err) {
      setError('Fehler beim Laden der Benutzer');
    } finally {
      setLoading(false);
    }
  };

  const checkDirectChatExists = (targetUser: User) => {
    return existingChats.some(chat =>
      chat.type === 'direct' &&
      chat.participants?.some((p: any) => p.id === targetUser.id && p.type === targetUser.type)
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
    if (checkDirectChatExists(targetUser)) {
      setDuplicateMessage(`Ein Chat mit ${targetUser.name || targetUser.display_name} existiert bereits.`);
      setShowDuplicateAlert(true);
      return;
    }
    setCreating(true);
    try {
      await api.post('/chat/direct', {
        target_user_id: targetUser.id,
        target_user_type: targetUser.type
      });
      setSuccess(`Direktnachricht mit ${targetUser.name || targetUser.display_name} erstellt`);
      await refreshFromAPI();
      handleClose();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Erstellen der Direktnachricht');
    } finally {
      setCreating(false);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      setError('Bitte Gruppennamen eingeben');
      return;
    }
    if (selectedParticipants.size === 0) {
      setError('Bitte mindestens einen Teilnehmer auswaehlen');
      return;
    }
    setCreating(true);
    try {
      const participants = Array.from(selectedParticipants).map(participantId => {
        const [type, id] = participantId.split('-');
        return { user_id: parseInt(id), user_type: type };
      });
      await api.post('/chat/rooms', {
        name: groupName.trim(),
        type: 'group',
        participants
      });
      setSuccess(`Gruppenchat "${groupName}" erstellt`);
      await refreshFromAPI();
      handleClose();
      onSuccess();
    } catch (err: any) {
      setError(`Fehler: ${err.response?.data?.error || err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const name = u.name || u.display_name || '';
    const matchesSearch = name.toLowerCase().includes(searchText.toLowerCase()) ||
      (u.jahrgang?.toLowerCase().includes(searchText.toLowerCase()));
    if (!matchesSearch) return false;
    if (selectedRole !== 'alle') {
      if (selectedRole === 'konfi' && u.type !== 'konfi') return false;
      if (selectedRole === 'admin' && u.type !== 'admin') return false;
    }
    if (selectedJahrgang !== 'alle' && u.type === 'konfi') {
      const userJahrgang = u.jahrgang_name || u.jahrgang;
      if (userJahrgang !== selectedJahrgang) return false;
    }
    return true;
  });

  const getUserDisplayName = (u: User) => u.name || u.display_name || 'Unbekannt';
  const isFormValid = chatType === 'direct' || (chatType === 'group' && groupName.trim() && selectedParticipants.size > 0);
  const isAdmin = user?.type === 'admin';

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={creating}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Neu</IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={chatType === 'group' ? createGroupChat : undefined}
              disabled={chatType === 'group' ? (!isFormValid || creating) : true}
            >
              {creating ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {isAdmin && (
          <IonToolbar>
            <IonSegment value={chatType} onIonChange={(e) => setChatType(e.detail.value as 'direct' | 'group')}>
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

      <IonContent>
        {/* Gruppenname */}
        {chatType === 'group' && (
          <IonList inset={true}>
            <IonItemGroup>
              <IonItem>
                <IonInput
                  placeholder="Gruppenname"
                  value={groupName}
                  onIonInput={(e) => setGroupName(e.detail.value!)}
                  disabled={creating}
                />
              </IonItem>
            </IonItemGroup>
          </IonList>
        )}

        {/* Filter */}
        <IonList inset={true}>
          <IonListHeader>
            <IonLabel>Filter</IonLabel>
          </IonListHeader>
          <IonItemGroup>
            <IonItem>
              <IonSelect
                label="Rolle"
                value={selectedRole}
                onIonChange={(e) => setSelectedRole(e.detail.value!)}
                interface="popover"
              >
                <IonSelectOption value="alle">Alle</IonSelectOption>
                <IonSelectOption value="konfi">Konfis</IonSelectOption>
                <IonSelectOption value="admin">Admins</IonSelectOption>
              </IonSelect>
            </IonItem>
            {availableJahrgaenge.length > 0 && (
              <IonItem>
                <IonSelect
                  label="Jahrgang"
                  value={selectedJahrgang}
                  onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                  interface="popover"
                >
                  <IonSelectOption value="alle">Alle</IonSelectOption>
                  {availableJahrgaenge.map(jg => (
                    <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            )}
          </IonItemGroup>
        </IonList>

        {/* Suche */}
        <IonSearchbar
          value={searchText}
          onIonInput={(e) => setSearchText(e.detail.value!)}
          placeholder="Suchen"
          debounce={300}
        />

        {/* Personen */}
        <IonList inset={true}>
          <IonListHeader>
            <IonLabel>{chatType === 'direct' ? 'Person auswaehlen' : 'Teilnehmer auswaehlen'}</IonLabel>
            {chatType === 'group' && selectedParticipants.size > 0 && (
              <IonNote slot="end">{selectedParticipants.size} ausgewaehlt</IonNote>
            )}
          </IonListHeader>
          <IonItemGroup>
            {loading ? (
              <IonItem>
                <IonSpinner slot="start" name="crescent" />
                <IonLabel>Laden...</IonLabel>
              </IonItem>
            ) : filteredUsers.length === 0 ? (
              <IonItem>
                <IonLabel color="medium">Keine Personen gefunden</IonLabel>
              </IonItem>
            ) : (
              filteredUsers.map((targetUser) => {
                const participantId = `${targetUser.type}-${targetUser.id}`;
                const isSelected = selectedParticipants.has(participantId);
                return (
                  <IonItem
                    key={participantId}
                    button
                    onClick={() => chatType === 'direct' ? createDirectMessage(targetUser) : handleParticipantToggle(participantId)}
                    disabled={creating}
                    detail={chatType === 'direct'}
                  >
                    <IonAvatar slot="start">
                      <IonIcon
                        icon={personCircleOutline}
                        style={{ width: '100%', height: '100%' }}
                        color={targetUser.type === 'admin' ? 'tertiary' : 'primary'}
                      />
                    </IonAvatar>
                    <IonLabel>
                      <h2>{getUserDisplayName(targetUser)}</h2>
                      <p>
                        {targetUser.type === 'admin'
                          ? (targetUser.role_description || 'Admin')
                          : (targetUser.jahrgang_name || targetUser.jahrgang
                            ? `Jahrgang ${targetUser.jahrgang_name || targetUser.jahrgang}`
                            : 'Konfi')}
                      </p>
                    </IonLabel>
                    {chatType === 'group' && (
                      <IonCheckbox slot="end" checked={isSelected} />
                    )}
                  </IonItem>
                );
              })
            )}
          </IonItemGroup>
        </IonList>

        {/* Info fuer Konfis */}
        {!isAdmin && (
          <IonNote className="ion-padding">
            Du kannst Direktnachrichten an Admins senden.
          </IonNote>
        )}
      </IonContent>

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
