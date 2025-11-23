import React, { useState, useEffect, useRef } from 'react';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonRefresher,
  IonRefresherContent,
  useIonModal
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
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
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-requests');
  
  // State
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);
  const [modalRequestId, setModalRequestId] = useState<number | null>(null);

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
      loadRequests();
    }
  });

  useEffect(() => {
    loadRequests();
    
    // Event-Listener für Updates
    const handleRequestsUpdated = () => {
      loadRequests();
    };
    
    window.addEventListener('activity-requests-updated', handleRequestsUpdated);
    
    return () => {
      window.removeEventListener('activity-requests-updated', handleRequestsUpdated);
    };
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/activities/requests');
      setRequests(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Anträge');
      console.error('Error loading activity requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (request: ActivityRequest) => {
    const statusText = request.status === 'approved' ? 'genehmigte' : 'abgelehnte';
    if (!window.confirm(`${statusText} Antrag von "${request.konfi_name}" zurücksetzen und wieder als offen markieren?`)) return;

    try {
      await api.put(`/admin/activities/requests/${request.id}/reset`);
      setSuccess(`Antrag wurde auf "Offen" zurückgesetzt`);
      await loadRequests();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Zurücksetzen des Antrags');
      }
    }
  };

  const handleDeleteRequest = async (request: ActivityRequest) => {
    if (!window.confirm(`Antrag von "${request.konfi_name}" für "${request.activity_name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/activity-requests/${request.id}`);
      setSuccess(`Antrag von "${request.konfi_name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadRequests();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Löschen des Antrags');
      }
    }
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
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Anträge</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadRequests();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Anträge werden geladen..." />
        ) : (
          <ActivityRequestsView
            requests={requests}
            onUpdate={loadRequests}
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