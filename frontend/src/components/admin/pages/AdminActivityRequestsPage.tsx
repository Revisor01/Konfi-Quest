import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import ActivityRequestsView from '../ActivityRequestsView';
import LoadingSpinner from '../../common/LoadingSpinner';
import ActivityRequestModal from '../modals/ActivityRequestModal';

interface ActivityRequest {
  id: number;
  konfi_id: number;
  konfi_name: string;
  jahrgang_name?: string;
  activity_id: number;
  activity_name: string;
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by?: number;
  created_at: string;
  updated_at: string;
}

const AdminActivityRequestsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-requests');

  // Offline-Query: Requests
  const { data: requests, loading, refresh: refreshRequests } = useOfflineQuery<ActivityRequest[]>(
    'admin:requests:' + user?.organization_id,
    async () => { const res = await api.get('/admin/activities/requests'); return res.data; },
    { ttl: CACHE_TTL.REQUESTS }
  );
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);
  const [modalRequestId, setModalRequestId] = useState<number | null>(null);

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentRequestModalHook, dismissRequestModalHook] = useIonModal(ActivityRequestModal, {
    requestId: modalRequestId,
    onClose: () => {
      dismissRequestModalHook();
      setSelectedRequest(null);
      setModalRequestId(null);
    },
    onSuccess: () => {
      dismissRequestModalHook();
      setSelectedRequest(null);
      setModalRequestId(null);
      refreshRequests();
    }
  });

  // Subscribe to live updates for requests
  useLiveRefresh('requests', refreshRequests);

  useEffect(() => {
    // Event-Listener fuer Updates
    const handleRequestsUpdated = () => {
      refreshRequests();
    };

    window.addEventListener('activity-requests-updated', handleRequestsUpdated);

    return () => {
      window.removeEventListener('activity-requests-updated', handleRequestsUpdated);
    };
  }, [refreshRequests]);

  const handleResetRequest = async (request: ActivityRequest) => {
    const statusText = request.status === 'approved' ? 'genehmigten' : 'abgelehnten';
    presentAlert({
      header: 'Antrag zurücksetzen',
      message: `${statusText} Antrag von "${request.konfi_name}" zurücksetzen und wieder als offen markieren?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Zurücksetzen',
          handler: async () => {
            try {
              await api.put(`/admin/activities/requests/${request.id}/reset`);
              setSuccess(`Antrag wurde auf "Offen" zurückgesetzt`);
              await refreshRequests();
            } catch (err: any) {
              if (err.response?.data?.error) {
                setError(err.response.data.error);
              } else {
                setError('Fehler beim Zurücksetzen des Antrags');
              }
            }
          }
        }
      ]
    });
  };

  const handleDeleteRequest = async (request: ActivityRequest) => {
    presentAlert({
      header: 'Antrag löschen',
      message: `Antrag von "${request.konfi_name}" für "${request.activity_name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/activity-requests/${request.id}`);
              setSuccess(`Antrag von "${request.konfi_name}" gelöscht`);
              await refreshRequests();
            } catch (err: any) {
              if (err.response?.data?.error) {
                setError(err.response.data.error);
              } else {
                setError('Fehler beim Löschen des Antrags');
              }
            }
          }
        }
      ]
    });
  };

  const handleSelectRequest = (request: ActivityRequest) => {
    setSelectedRequest(request);
    setModalRequestId(request.id);
    presentRequestModalHook({
      presentingElement: presentingElement
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Anträge</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Anträge</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshRequests();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Anträge werden geladen..." />
        ) : (
          <ActivityRequestsView
            requests={requests || []}
            onUpdate={refreshRequests}
            onSelectRequest={handleSelectRequest}
            onDeleteRequest={handleDeleteRequest}
            onResetRequest={handleResetRequest}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminActivityRequestsPage;