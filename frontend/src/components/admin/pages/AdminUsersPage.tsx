import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { add, arrowBack } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import UsersView from '../UsersView';
import LoadingSpinner from '../../common/LoadingSpinner';
import UserManagementModal from '../modals/UserManagementModal';

interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  role_name: string;
  role_display_name: string;
  assigned_jahrgaenge_count: number;
}

const AdminUsersPage: React.FC = () => {
  const { setSuccess, setError, user, isOnline } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-users');
  
  // Offline-Query: Users
  const { data: users, loading, refresh: refreshUsers } = useOfflineQuery<User[]>(
    'admin:users:' + user?.organization_id,
    async () => { const res = await api.get('/users'); return res.data; },
    { ttl: CACHE_TTL.KONFIS }
  );
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalUserId, setModalUserId] = useState<number | null>(null);

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentUserModalHook, dismissUserModalHook] = useIonModal(UserManagementModal, {
    userId: modalUserId,
    onClose: () => {
      dismissUserModalHook();
      setSelectedUser(null);
      setModalUserId(null);
    },
    onSuccess: () => {
      dismissUserModalHook();
      setSelectedUser(null);
      setModalUserId(null);
      refreshUsers();
    }
  });

  useEffect(() => {
    // Event-Listener fuer Updates
    const handleUsersUpdated = () => {
      refreshUsers();
    };

    window.addEventListener('users-updated', handleUsersUpdated);

    return () => {
      window.removeEventListener('users-updated', handleUsersUpdated);
    };
  }, [refreshUsers]);

  const handleDeleteUser = async (userToDelete: User) => {
    if (!isOnline) return;
    presentAlert({
      header: 'Benutzer löschen',
      message: `Benutzer "${userToDelete.display_name}" (@${userToDelete.username}) wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/users/${userToDelete.id}`);
              setSuccess(`Benutzer "${userToDelete.display_name}" gelöscht`);
              await refreshUsers();
            } catch (err: any) {
              if (err.response?.data?.error) {
                setError(err.response.data.error);
              } else {
                setError('Fehler beim Löschen des Benutzers');
              }
            }
          }
        }
      ]
    });
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setModalUserId(user.id);
    presentUserModalHook({
      presentingElement: presentingElement
    });
  };

  const presentUserModal = () => {
    setSelectedUser(null);
    setModalUserId(null);
    presentUserModalHook({
      presentingElement: presentingElement
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
        <IonButtons slot="start">
          <IonButton onClick={() => window.history.back()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonButtons>
          <IonTitle>Benutzer:innen</IonTitle>
          <IonButtons slot="end">
            {user?.role_name === 'org_admin' && (
              <IonButton onClick={presentUserModal}>
                <IonIcon icon={add} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Benutzer:innen</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshUsers();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Benutzer werden geladen..." />
        ) : (
          <UsersView 
            users={users || []}
            onUpdate={refreshUsers}
            onAddUserClick={presentUserModal}
            onSelectUser={handleSelectUser}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminUsersPage;