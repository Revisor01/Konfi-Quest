import React, { useState, useCallback } from 'react';
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
import {
  logOut,
  add
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import { logout } from '../../../services/auth';
import OrganizationView from '../OrganizationView';
import LoadingSpinner from '../../common/LoadingSpinner';
import OrganizationManagementModal from '../modals/OrganizationManagementModal';
import { triggerPullHaptic } from '../../../utils/haptics';

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
  const { setSuccess, setError, isOnline } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-organizations');
  
  // SWR-Cache für Organisationen
  const { data: organizations, loading, revalidate: loadOrganizations } = useOfflineQuery<Organization[]>(
    'super-admin-organizations',
    useCallback(async () => {
      const response = await api.get('/organizations');
      return response.data;
    }, []),
    { ttl: CACHE_TTL.MEDIUM, fallback: [] }
  );

  // Modal state
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [modalOrganizationId, setModalOrganizationId] = useState<number | null>(null);

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Möchtest du dich wirklich abmelden?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: async () => {
            await logout();
            window.location.href = '/';
          }
        }
      ]
    });
  };

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

  // Subscribe to live updates for organizations
  useLiveRefresh('organizations', loadOrganizations);

  const handleDeleteOrganization = async (organization: Organization) => {
    if (!isOnline) return;
    presentAlert({
      header: 'Organisation löschen',
      message: `Organisation "${organization.display_name}" (${organization.name}) wirklich löschen?\n\nWarnung: Alle zugehörigen Daten (Benutzer, Konfis, Aktivitäten) werden ebenfalls gelöscht!`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/organizations/${organization.id}`);
              setSuccess(`Organisation "${organization.display_name}" gelöscht`);
              await loadOrganizations();
            } catch (err: any) {
              if (err.response?.data?.error) {
                setError(err.response.data.error);
              } else {
                setError('Fehler beim Löschen der Organisation');
              }
            }
          }
        }
      ]
    });
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
      <IonHeader translucent={true} collapse="condense">
        <IonToolbar>
        <IonButtons slot="start">
          <IonButton onClick={handleLogout}>
            <IonIcon icon={logOut} />
          </IonButton>
        </IonButtons>
          <IonTitle>Organisationen</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={presentOrganizationModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Organisationen</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadOrganizations();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
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