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
import { 
  arrowBack
} from 'ionicons/icons';
import { add } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import OrganizationView from '../OrganizationView';
import LoadingSpinner from '../../common/LoadingSpinner';
import OrganizationManagementModal from '../modals/OrganizationManagementModal';

interface Organization {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  contact_email?: string;
  website?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
  konfi_count: number;
  activity_count: number;
  event_count: number;
  badge_count: number;
}

const AdminOrganizationsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-organizations');
  
  // State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [modalOrganizationId, setModalOrganizationId] = useState<number | null>(null);

  // Modal mit useIonModal Hook
  const [presentOrganizationModalHook, dismissOrganizationModalHook] = useIonModal(OrganizationManagementModal, {
    organizationId: modalOrganizationId,
    onClose: () => {
      dismissOrganizationModalHook();
      setSelectedOrganization(null);
      setModalOrganizationId(null);
    },
    onSuccess: () => {
      dismissOrganizationModalHook();
      setSelectedOrganization(null);
      setModalOrganizationId(null);
      loadOrganizations();
    }
  });

  useEffect(() => {
    loadOrganizations();
    
    // Event-Listener für Updates
    const handleOrganizationsUpdated = () => {
      loadOrganizations();
    };
    
    window.addEventListener('organizations-updated', handleOrganizationsUpdated);
    
    return () => {
      window.removeEventListener('organizations-updated', handleOrganizationsUpdated);
    };
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/organizations');
      setOrganizations(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Organisationen');
      console.error('Error loading organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrganization = async (organization: Organization) => {
    if (!window.confirm(`Organisation "${organization.display_name}" (${organization.name}) wirklich löschen?\n\nWarnung: Alle zugehörigen Daten (Benutzer, Konfis, Aktivitäten) werden ebenfalls gelöscht!`)) return;

    try {
      await api.delete(`/admin/organizations/${organization.id}`);
      setSuccess(`Organisation "${organization.display_name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadOrganizations();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Löschen der Organisation');
      }
    }
  };

  const handleSelectOrganization = (organization: Organization) => {
    setSelectedOrganization(organization);
    setModalOrganizationId(organization.id);
    presentOrganizationModalHook({
      presentingElement: presentingElement
    });
  };

  const presentOrganizationModal = () => {
    setSelectedOrganization(null);
    setModalOrganizationId(null);
    presentOrganizationModalHook({
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
          <IonTitle>Organisations-Verwaltung</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={presentOrganizationModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Organisations-Verwaltung</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadOrganizations();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Organisationen werden geladen..." />
        ) : (
          <OrganizationView 
            organizations={organizations}
            onUpdate={loadOrganizations}
            onAddOrganizationClick={presentOrganizationModal}
            onSelectOrganization={handleSelectOrganization}
            onDeleteOrganization={handleDeleteOrganization}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminOrganizationsPage;