import React, { useState, useEffect } from 'react';
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
import { add, home, people } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import RequestsView from '../views/RequestsView';
import ActivityRequestModal from '../modals/ActivityRequestModal';
import RequestDetailModal from '../modals/RequestDetailModal';

interface ActivityRequest {
  id: number;
  activity_id: number;
  activity_name: string;
  activity_points: number;
  activity_type: 'gottesdienst' | 'gemeinde';
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  created_at: string;
  updated_at: string;
}

const KonfiRequestsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('konfi-requests');
  const [presentAlert] = useIonAlert();

  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);

  const [presentRequestModal, dismissRequestModal] = useIonModal(
    ActivityRequestModal,
    {
      onClose: () => dismissRequestModal(),
      onSuccess: () => {
        dismissRequestModal();
        loadRequests();
      }
    }
  );

  const [presentDetailModal, dismissDetailModal] = useIonModal(
    RequestDetailModal,
    {
      request: selectedRequest,
      onClose: () => {
        dismissDetailModal();
        setSelectedRequest(null);
      },
      onDelete: (request: ActivityRequest) => {
        dismissDetailModal();
        setSelectedRequest(null);
        handleDeleteRequest(request);
      }
    }
  );

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/requests');
      setRequests(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Aktivitäten');
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRequest = () => {
    console.log('Request Modal: Opening modal with presentingElement:', pageRef.current, 'presentingElement:', presentingElement);
    presentRequestModal({
      presentingElement: pageRef.current || presentingElement || undefined
    });
  };

  const handleSelectRequest = (request: ActivityRequest) => {
    setSelectedRequest(request);
    presentDetailModal({
      presentingElement: pageRef.current || presentingElement || undefined
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      default: return 'medium';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Offen';
      case 'approved': return 'Verbucht';
      case 'rejected': return 'Abgelehnt';
      default: return 'Unbekannt';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'gottesdienst' ? home : people;
  };

  const getTypeText = (type: string) => {
    return type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';
  };

  const getFilteredRequests = () => {
    switch (activeTab) {
      case 'pending':
        return requests.filter(r => r.status === 'pending');
      case 'approved':
        return requests.filter(r => r.status === 'approved');
      case 'rejected':
        return requests.filter(r => r.status === 'rejected');
      default:
        return requests;
    }
  };

  const handleDeleteRequest = (request: ActivityRequest) => {
    if (request.status !== 'pending') {
      setError('Nur wartende Anträge können gelöscht werden');
      return;
    }

    presentAlert({
      header: 'Antrag löschen',
      message: `Möchtest du deinen Antrag für "${request.activity_name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/konfi/requests/${request.id}`);
              setSuccess('Antrag erfolgreich gelöscht');
              loadRequests();
            } catch (error: any) {
              setError(error.response?.data?.error || 'Fehler beim Löschen des Antrags');
            }
          }
        }
      ]
    });
  };


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Aktivitäten</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleAddRequest}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>
              Aktivitäten
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadRequests();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Aktivitäten werden geladen..." />
        ) : (
          <RequestsView
            requests={getFilteredRequests()}
            onDeleteRequest={handleDeleteRequest}
            onSelectRequest={handleSelectRequest}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            formatDate={formatDate}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            getTypeIcon={getTypeIcon}
            getTypeText={getTypeText}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiRequestsPage;