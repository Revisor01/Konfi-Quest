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
  useIonModal
} from '@ionic/react';
import { add, arrowBack } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
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
  const { setSuccess, setError, user } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-users');
  
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalUserId, setModalUserId] = useState<number | null>(null);

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
      loadUsers();
    }
  });

  useEffect(() => {
    loadUsers();
    
    // Event-Listener für Updates
    const handleUsersUpdated = () => {
      loadUsers();
    };
    
    window.addEventListener('users-updated', handleUsersUpdated);
    
    return () => {
      window.removeEventListener('users-updated', handleUsersUpdated);
    };
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Benutzer');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Benutzer "${user.display_name}" (@${user.username}) wirklich löschen?`)) return;

    try {
      await api.delete(`/users/${user.id}`);
      setSuccess(`Benutzer "${user.display_name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadUsers();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Löschen des Benutzers');
      }
    }
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
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Benutzer:innen</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadUsers();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Benutzer werden geladen..." />
        ) : (
          <UsersView 
            users={users}
            onUpdate={loadUsers}
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