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
import { add } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import RolesView from '../RolesView';
import LoadingSpinner from '../../common/LoadingSpinner';
import RoleManagementModal from '../modals/RoleManagementModal';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
}

const AdminRolesPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('roles');
  
  // State
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [modalRoleId, setModalRoleId] = useState<number | null>(null);

  // Modal mit useIonModal Hook
  const [presentRoleModalHook, dismissRoleModalHook] = useIonModal(RoleManagementModal, {
    roleId: modalRoleId,
    onClose: () => {
      dismissRoleModalHook();
      setSelectedRole(null);
      setModalRoleId(null);
    },
    onSuccess: () => {
      dismissRoleModalHook();
      setSelectedRole(null);
      setModalRoleId(null);
      loadRoles();
    }
  });

  useEffect(() => {
    loadRoles();
    
    // Event-Listener für Updates
    const handleRolesUpdated = () => {
      loadRoles();
    };
    
    window.addEventListener('roles-updated', handleRolesUpdated);
    
    return () => {
      window.removeEventListener('roles-updated', handleRolesUpdated);
    };
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await api.get('/roles');
      setRoles(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Rollen');
      console.error('Error loading roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role) {
      setError('System-Rollen können nicht gelöscht werden');
      return;
    }

    if (!window.confirm(`Rolle "${role.display_name}" (${role.name}) wirklich löschen?`)) return;

    try {
      await api.delete(`/roles/${role.id}`);
      setSuccess(`Rolle "${role.display_name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadRoles();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Löschen der Rolle');
      }
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setModalRoleId(role.id);
    presentRoleModalHook({
      presentingElement: presentingElement
    });
  };

  const presentRoleModal = () => {
    setSelectedRole(null);
    setModalRoleId(null);
    presentRoleModalHook({
      presentingElement: presentingElement
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Rollen-Verwaltung</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={presentRoleModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Rollen-Verwaltung</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadRoles();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Rollen werden geladen..." />
        ) : (
          <RolesView 
            roles={roles}
            onUpdate={loadRoles}
            onAddRoleClick={presentRoleModal}
            onSelectRole={handleSelectRole}
            onDeleteRole={handleDeleteRole}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminRolesPage;