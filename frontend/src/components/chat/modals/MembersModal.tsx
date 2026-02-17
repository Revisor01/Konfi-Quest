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
  IonList,
  IonItemGroup,
  IonListHeader,
  IonCheckbox,
  IonAlert,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonInput,
  IonItem,
  IonCard,
  IonCardContent,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/react';
import {
  closeOutline,
  person,
  personAddOutline,
  checkmarkOutline,
  search,
  peopleOutline,
  trash,
  filterOutline,
  calendar
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Participant {
  user_id: number;
  user_type: 'admin' | 'konfi';
  name: string;
  role_title?: string;
  role_display_name?: string;
  jahrgang_id?: number;
  jahrgang_name?: string;
  joined_at: string;
}

interface User {
  id: number;
  name?: string;
  display_name?: string;
  type: 'admin' | 'konfi';
  jahrgang?: string;
  jahrgang_name?: string;
  role_title?: string;
  role_description?: string;
}

interface MembersModalProps {
  onClose: () => void;
  onSuccess: () => void;
  roomId: number;
  roomType: string;
  presentingElement?: HTMLElement | null;
}

const MembersModal: React.FC<MembersModalProps> = ({
  onClose,
  onSuccess,
  roomId,
  roomType
}) => {
  const { user, setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddMode, setShowAddMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [userToRemove, setUserToRemove] = useState<Participant | null>(null);

  useEffect(() => {
    if (roomId) {
      loadParticipants();
      loadAllUsers();
    }
  }, [roomId]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/chat/rooms/${roomId}/participants`);
      setParticipants(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Mitglieder');
 console.error('Error loading participants:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const [konfisRes, adminsRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/users').catch(() => ({ data: [] }))
      ]);

      const allUsers: User[] = [
        ...konfisRes.data.map((konfi: any) => ({
          ...konfi,
          type: 'konfi' as const,
          jahrgang_name: konfi.jahrgang_name || konfi.jahrgang
        })),
        ...adminsRes.data.map((admin: any) => ({
          ...admin,
          type: 'admin' as const,
          role_description: admin.role_title || admin.role_display_name
        }))
      ];

      setAllUsers(allUsers);
    } catch (err) {
 console.error('Error loading users:', err);
    }
  };

  const getAvailableUsers = () => {
    const participantIds = new Set(
      participants.map(p => `${p.user_type}-${p.user_id}`)
    );

    return allUsers.filter(user =>
      !participantIds.has(`${user.type}-${user.id}`)
    );
  };

  // Sortierung: Admins zuerst, dann alphabetisch nach Name
  const sortUsers = <T extends { name?: string; display_name?: string; type?: string; user_type?: string }>(users: T[]): T[] => {
    return [...users].sort((a, b) => {
      const aIsAdmin = ('user_type' in a ? a.user_type : a.type) === 'admin';
      const bIsAdmin = ('user_type' in b ? b.user_type : b.type) === 'admin';

      // Admins zuerst
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;

      // Dann alphabetisch nach Name
      const aName = (a.name || a.display_name || '').toLowerCase();
      const bName = (b.name || b.display_name || '').toLowerCase();
      return aName.localeCompare(bName, 'de');
    });
  };

  const filteredAvailableUsers = sortUsers(getAvailableUsers().filter(user => {
    const name = user.name || user.display_name || '';
    return name.toLowerCase().includes(searchText.toLowerCase()) ||
      (user.jahrgang && user.jahrgang.toLowerCase().includes(searchText.toLowerCase()));
  }));

  // Sortierte Teilnehmer
  const sortedParticipants = sortUsers(participants);

  const handleUserToggle = (user: User) => {
    const userId = `${user.type}-${user.id}`;
    const newSelected = new Set(selectedUsers);

    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }

    setSelectedUsers(newSelected);
  };

  const addSelectedUsers = async () => {
    if (selectedUsers.size === 0) return;

    setAdding(true);
    try {
      const promises = Array.from(selectedUsers).map(userId => {
        const [type, id] = userId.split('-');
        return api.post(`/chat/rooms/${roomId}/participants`, {
          user_id: parseInt(id),
          user_type: type
        });
      });

      await Promise.all(promises);

      setSuccess(`${selectedUsers.size} Mitglied${selectedUsers.size > 1 ? 'er' : ''} hinzugefügt`);
      setSelectedUsers(new Set());
      setShowAddMode(false);
      await loadParticipants();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Hinzufügen der Mitglieder');
 console.error('Error adding participants:', err);
    } finally {
      setAdding(false);
    }
  };

  const confirmRemoveUser = (participant: Participant) => {
    setUserToRemove(participant);
    setShowRemoveAlert(true);
  };

  const removeUser = async () => {
    if (!userToRemove) return;

    try {
      await api.delete(`/chat/rooms/${roomId}/participants/${userToRemove.user_id}/${userToRemove.user_type}`);

      setSuccess(`${userToRemove.name} wurde entfernt`);
      setUserToRemove(null);
      await loadParticipants();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Entfernen des Mitglieds');
 console.error('Error removing participant:', err);
    }
  };

  const handleClose = () => {
    setShowAddMode(false);
    setSelectedUsers(new Set());
    setSearchText('');
    setUserToRemove(null);
    onClose();
  };

  const getUserDisplayName = (user: User | Participant) => {
    if ('display_name' in user) {
      return user.name || user.display_name || 'Unbekannt';
    }
    return user.name || 'Unbekannt';
  };

  const isGroupChat = roomType === 'group';
  const canManageMembers = user?.type === 'admin' && isGroupChat;

  // Rolle/Funktion ermitteln (für Eselsohr)
  const getRoleText = (targetUser: User | Participant) => {
    const isAdmin = 'user_type' in targetUser
      ? targetUser.user_type === 'admin'
      : targetUser.type === 'admin';

    if (isAdmin) {
      if ('role_title' in targetUser && targetUser.role_title) {
        return targetUser.role_title;
      }
      if ('role_display_name' in targetUser && targetUser.role_display_name) {
        return targetUser.role_display_name;
      }
      if ('role_description' in targetUser && targetUser.role_description) {
        return targetUser.role_description;
      }
      return 'Admin';
    }

    return 'Konfi';
  };

  // Jahrgang ermitteln (für Meta-Zeile)
  const getJahrgang = (targetUser: User | Participant) => {
    if ('jahrgang_name' in targetUser && targetUser.jahrgang_name) {
      return targetUser.jahrgang_name;
    }
    if ('jahrgang' in targetUser && targetUser.jahrgang) {
      return targetUser.jahrgang;
    }
    return null;
  };

  // Render User Item - mit CSS-Klassen
  const renderUserItem = (
    targetUser: User | Participant,
    isSelectable: boolean,
    isSelected: boolean,
    onToggle?: () => void
  ) => {
    const isAdmin = 'user_type' in targetUser
      ? targetUser.user_type === 'admin'
      : targetUser.type === 'admin';
    const name = getUserDisplayName(targetUser);
    const participantId = `${isAdmin ? 'admin' : 'konfi'}-${'user_id' in targetUser ? targetUser.user_id : targetUser.id}`;
    const roleText = getRoleText(targetUser);
    const jahrgang = getJahrgang(targetUser);
    const badgeColor = isAdmin ? '#06b6d4' : '#ff9500';

    return (
      <div
        key={participantId}
        className={`app-list-item ${isAdmin ? 'app-list-item--chat' : 'app-list-item--warning'} ${isSelected ? 'app-list-item--selected' : ''}`}
        onClick={isSelectable ? onToggle : undefined}
        style={{ cursor: isSelectable ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', width: '100%' }}
      >
        {/* Eselsohr mit Rolle/Funktion */}
        <div
          className="app-corner-badge"
          style={{ backgroundColor: badgeColor }}
        >
          {roleText}
        </div>

        <div className="app-list-item__row">
          <div className="app-list-item__main">
            <div className={`app-icon-circle app-icon-circle--lg ${isAdmin ? 'app-icon-circle--chat' : 'app-icon-circle--warning'}`}>
              <IonIcon icon={person} />
            </div>
            <div className="app-list-item__content">
              <div className="app-list-item__title" style={{ paddingRight: '70px' }}>{name}</div>
              {/* Meta-Zeile: Jahrgang (wie in KonfisView) */}
              {!isAdmin && jahrgang && (
                <div className="app-list-item__meta">
                  <span className="app-list-item__meta-item">
                    <IonIcon icon={calendar} style={{ color: '#5b21b6' }} />
                    {jahrgang}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Checkbox für Add-Modus */}
          {isSelectable && (
            <IonCheckbox
              checked={isSelected}
              style={{
                '--checkbox-background-checked': '#06b6d4',
                '--border-color-checked': '#06b6d4',
                '--checkmark-color': 'white'
              }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>

          <IonTitle>
            {showAddMode ? 'Mitglied hinzufügen' : 'Mitglieder'}
          </IonTitle>

          {canManageMembers && (
            <IonButtons slot="end">
              {showAddMode ? (
                <IonButton
                  onClick={addSelectedUsers}
                  disabled={selectedUsers.size === 0 || adding}
                >
                  {adding ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
                </IonButton>
              ) : (
                <IonButton onClick={() => setShowAddMode(true)}>
                  <IonIcon icon={personAddOutline} slot="icon-only" />
                </IonButton>
              )}
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          Promise.all([loadParticipants(), loadAllUsers()]).finally(() => {
            e.detail.complete();
          });
        }}>
          <IonRefresherContent />
        </IonRefresher>

          {showAddMode ? (
            <>
              {/* Suche - iOS26 Pattern */}
              <IonList inset={true} style={{ margin: '16px' }}>
                <IonListHeader>
                  <div className="app-section-icon app-section-icon--chat">
                    <IonIcon icon={filterOutline} />
                  </div>
                  <IonLabel>Suche</IonLabel>
                </IonListHeader>
                <IonItemGroup>
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
                </IonItemGroup>
              </IonList>

              {/* Verfügbare Personen - IonListHeader über der Card */}
              <IonList inset={true} style={{ margin: '16px' }}>
                <IonListHeader>
                  <div className="app-section-icon app-section-icon--chat">
                    <IonIcon icon={peopleOutline} />
                  </div>
                  <IonLabel>Verfügbare Personen ({filteredAvailableUsers.length})</IonLabel>
                </IonListHeader>
                <IonCard className="app-card">
                  <IonCardContent>
                    {filteredAvailableUsers.length === 0 ? (
                      <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#666'
                      }}>
                        <IonIcon icon={search} style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '16px' }} />
                        <p style={{ margin: '0', fontSize: '1rem' }}>Keine verfügbaren Personen gefunden</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredAvailableUsers.map((u) => {
                          const userId = `${u.type}-${u.id}`;
                          return renderUserItem(
                            u,
                            true,
                            selectedUsers.has(userId),
                            () => handleUserToggle(u)
                          );
                        })}
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              </IonList>
            </>
          ) : (
            <>
              {loading ? (
                <LoadingSpinner message="Mitglieder werden geladen..." />
              ) : (
                <IonList inset={true} style={{ margin: '16px' }}>
                  <IonListHeader>
                    <div className="app-section-icon app-section-icon--chat">
                      <IonIcon icon={peopleOutline} />
                    </div>
                    <IonLabel>Mitglieder ({sortedParticipants.length})</IonLabel>
                  </IonListHeader>
                  <IonCard className="app-card">
                    <IonCardContent>
                      {sortedParticipants.length === 0 ? (
                        <div style={{
                          padding: '40px 20px',
                          textAlign: 'center',
                          color: '#666'
                        }}>
                          <IonIcon icon={peopleOutline} style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '16px' }} />
                          <p style={{ margin: '0', fontSize: '1rem' }}>Keine Mitglieder</p>
                        </div>
                      ) : (
                        <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                          {sortedParticipants.map((p, index) => (
                            <IonItemSliding key={`${p.user_type}-${p.user_id}`} disabled={!canManageMembers} style={{ marginBottom: index < sortedParticipants.length - 1 ? '8px' : '0' }}>
                              <IonItem
                                detail={false}
                                lines="none"
                                style={{
                                  '--background': 'transparent',
                                  '--padding-start': '0',
                                  '--padding-end': '0',
                                  '--inner-padding-end': '0',
                                  '--inner-border-width': '0',
                                  '--border-style': 'none',
                                  '--min-height': 'auto'
                                }}
                              >
                                {renderUserItem(p, false, false)}
                              </IonItem>
                              {canManageMembers && (
                                <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' }}>
                                  <IonItemOption
                                    onClick={() => confirmRemoveUser(p)}
                                    style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                                  >
                                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                      <IonIcon icon={trash} />
                                    </div>
                                  </IonItemOption>
                                </IonItemOptions>
                              )}
                            </IonItemSliding>
                          ))}
                        </IonList>
                      )}
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}
            </>
          )}
      </IonContent>

      {/* Remove Confirmation Alert */}
      <IonAlert
        isOpen={showRemoveAlert}
        onDidDismiss={() => setShowRemoveAlert(false)}
        header="Mitglied entfernen"
        message={`${userToRemove?.name} wirklich aus dem Chat entfernen?`}
        buttons={[
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Entfernen', role: 'destructive', handler: removeUser }
        ]}
      />
    </IonPage>
  );
};

export default MembersModal;
