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
  IonAvatar,
  IonText,
  IonSearchbar,
  IonCheckbox,
  IonAlert,
  IonSpinner,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { 
  close, 
  person, 
  people, 
  add, 
  trash, 
  personAdd,
  checkmark
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Participant {
  user_id: number;
  user_type: 'admin' | 'konfi';
  name: string;
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
}

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roomId: number;
  roomType: string;
  presentingElement?: HTMLElement | null;
}

const MembersModal: React.FC<MembersModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  roomId, 
  roomType,
  presentingElement 
}) => {
  const { user, setError, setSuccess } = useApp();
  const pageRef = useRef<HTMLElement>(null);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showAddMode, setShowAddMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showRemoveAlert, setShowRemoveAlert] = useState(false);
  const [userToRemove, setUserToRemove] = useState<Participant | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadParticipants();
      loadAllUsers();
    }
  }, [isOpen, roomId]);

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
        api.get('/konfis'),
        api.get('/admin/users').catch(() => ({ data: [] }))
      ]);
      
      const allUsers: User[] = [
        ...konfisRes.data.map((konfi: any) => ({ ...konfi, type: 'konfi' as const })),
        ...adminsRes.data.map((admin: any) => ({ ...admin, type: 'admin' as const }))
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

  const filteredAvailableUsers = getAvailableUsers().filter(user => {
    const name = user.name || user.display_name || '';
    return name.toLowerCase().includes(searchText.toLowerCase()) ||
           (user.jahrgang && user.jahrgang.toLowerCase().includes(searchText.toLowerCase()));
  });

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
    
    setRemoving(true);
    try {
      await api.delete(`/chat/rooms/${roomId}/participants/${userToRemove.user_id}/${userToRemove.user_type}`);
      
      setSuccess(`${userToRemove.name} wurde entfernt`);
      setUserToRemove(null);
      await loadParticipants();
      onSuccess();
    } catch (err) {
      setError('Fehler beim Entfernen des Mitglieds');
      console.error('Error removing participant:', err);
    } finally {
      setRemoving(false);
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

  return (
    <IonModal 
      isOpen={isOpen} 
      onDidDismiss={handleClose}
      presentingElement={presentingElement || undefined}
      canDismiss={true}
      backdropDismiss={true}
    >
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={handleClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
            
            <IonTitle>
              {showAddMode ? 'Mitglied hinzufügen' : 'Mitglieder'}
            </IonTitle>
            
            {canManageMembers && (
              <IonButtons slot="end">
                {showAddMode ? (
                  <>
                    <IonButton 
                      onClick={() => setShowAddMode(false)}
                      color="medium"
                    >
                      Abbrechen
                    </IonButton>
                    <IonButton 
                      onClick={addSelectedUsers}
                      disabled={selectedUsers.size === 0 || adding}
                      color="primary"
                    >
                      {adding ? <IonSpinner /> : <IonIcon icon={checkmark} />}
                    </IonButton>
                  </>
                ) : (
                  <IonButton onClick={() => setShowAddMode(true)}>
                    <IonIcon icon={personAdd} />
                  </IonButton>
                )}
              </IonButtons>
            )}
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          <IonRefresher slot="fixed" onIonRefresh={(e) => {
            Promise.all([loadParticipants(), loadAllUsers()]).finally(() => {
              e.detail.complete();
            });
          }}>
            <IonRefresherContent />
          </IonRefresher>

          {showAddMode ? (
            <>
              <IonSearchbar
                value={searchText}
                onIonInput={(e) => setSearchText(e.detail.value!)}
                placeholder="Person suchen..."
              />
              
              {filteredAvailableUsers.length === 0 ? (
                <IonText color="medium" style={{ 
                  display: 'block', 
                  textAlign: 'center', 
                  padding: '32px 16px' 
                }}>
                  <p>Keine verfügbaren Personen gefunden</p>
                </IonText>
              ) : (
                <IonList>
                  {filteredAvailableUsers.map((user) => {
                    const userId = `${user.type}-${user.id}`;
                    const isSelected = selectedUsers.has(userId);
                    
                    return (
                      <IonItem 
                        key={userId}
                        button 
                        onClick={() => handleUserToggle(user)}
                      >
                        <IonAvatar slot="start" style={{ 
                          width: '40px', 
                          height: '40px',
                          backgroundColor: user.type === 'admin' ? '#7045f6' : '#3880ff'
                        }}>
                          <div style={{ 
                            color: 'white', 
                            fontSize: '0.8rem', 
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%'
                          }}>
                            {getUserDisplayName(user).charAt(0).toUpperCase()}
                          </div>
                        </IonAvatar>
                        
                        <IonLabel>
                          <h3>{getUserDisplayName(user)}</h3>
                          <p>
                            {user.type === 'admin' ? 'Admin' : 
                             (user.jahrgang ? `Jahrgang ${user.jahrgang}` : 'Konfi')}
                          </p>
                        </IonLabel>
                        
                        <IonCheckbox 
                          slot="end" 
                          checked={isSelected}
                          color={user.type === 'admin' ? 'tertiary' : 'primary'}
                        />
                      </IonItem>
                    );
                  })}
                </IonList>
              )}
            </>
          ) : (
            <>
              {loading ? (
                <LoadingSpinner message="Mitglieder werden geladen..." />
              ) : (
                <IonList>
                  {participants.map((participant) => (
                    <IonItem key={`${participant.user_type}-${participant.user_id}`}>
                      <IonAvatar slot="start" style={{ 
                        width: '40px', 
                        height: '40px',
                        backgroundColor: participant.user_type === 'admin' ? '#7045f6' : '#3880ff'
                      }}>
                        <div style={{ 
                          color: 'white', 
                          fontSize: '0.8rem', 
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%'
                        }}>
                          {participant.name.charAt(0).toUpperCase()}
                        </div>
                      </IonAvatar>
                      
                      <IonLabel>
                        <h3>{participant.name}</h3>
                        <p>
                          {participant.user_type === 'admin' ? 'Admin' : 
                           (participant.jahrgang_name ? `Jahrgang ${participant.jahrgang_name}` : 'Konfi')}
                        </p>
                      </IonLabel>
                      
                      {canManageMembers && (
                        <IonButton 
                          slot="end"
                          fill="clear"
                          color="danger"
                          onClick={() => confirmRemoveUser(participant)}
                          disabled={removing}
                        >
                          <IonIcon icon={trash} />
                        </IonButton>
                      )}
                    </IonItem>
                  ))}
                </IonList>
              )}
            </>
          )}
        </IonContent>
      </IonPage>

      {/* Remove Confirmation Alert */}
      <IonAlert
        isOpen={showRemoveAlert}
        onDidDismiss={() => setShowRemoveAlert(false)}
        header="Mitglied entfernen"
        message={`Möchten Sie ${userToRemove?.name} wirklich aus dem Chat entfernen?`}
        buttons={[
          {
            text: 'Abbrechen',
            role: 'cancel'
          },
          {
            text: 'Entfernen',
            role: 'destructive',
            handler: removeUser
          }
        ]}
      />
    </IonModal>
  );
};

export default MembersModal;