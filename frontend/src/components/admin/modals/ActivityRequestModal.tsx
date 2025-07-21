import React, { useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonTextarea,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonImg,
  IonChip,
  IonBadge,
  IonText
} from '@ionic/react';
import { 
  checkmark, 
  close, 
  person, 
  calendar, 
  star,
  image,
  chatbubble,
  time
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

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

interface ActivityRequestModalProps {
  requestId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ActivityRequestModal: React.FC<ActivityRequestModalProps> = ({
  requestId,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<ActivityRequest | null>(null);
  const [adminComment, setAdminComment] = useState('');

  useEffect(() => {
    if (requestId) {
      loadRequest();
    }
  }, [requestId]);

  const loadRequest = async () => {
    if (!requestId) return;
    
    setLoading(true);
    try {
      const response = await api.get('/activities/requests');
      const requests = response.data;
      const foundRequest = requests.find((r: ActivityRequest) => r.id === requestId);
      
      if (foundRequest) {
        setRequest(foundRequest);
        setAdminComment(foundRequest.admin_comment || '');
      } else {
        setError('Antrag nicht gefunden');
      }
    } catch (err) {
      setError('Fehler beim Laden des Antrags');
      console.error('Error loading request:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;

    setLoading(true);
    try {
      await api.put(`/activities/requests/${request.id}`, {
        status: 'approved',
        admin_comment: adminComment
      });
      setSuccess(`Antrag von "${request.konfi_name}" genehmigt`);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Genehmigen des Antrags');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;

    if (!adminComment.trim()) {
      setError('Bitte gib einen Grund für die Ablehnung an');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/activities/requests/${request.id}`, {
        status: 'rejected',
        admin_comment: adminComment
      });
      setSuccess(`Antrag von "${request.konfi_name}" abgelehnt`);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ablehnen des Antrags');
    } finally {
      setLoading(false);
    }
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
      case 'pending': return 'Ausstehend';
      case 'approved': return 'Genehmigt';
      case 'rejected': return 'Abgelehnt';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!request) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Antrag wird geladen...</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            Antrag wird geladen...
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Antrag prüfen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Antrag Informationen */}
        <IonCard>
          <IonCardContent>
            <IonItem lines="none">
              <IonIcon icon={person} slot="start" color="primary" />
              <IonLabel>
                <h2>{request.konfi_name}</h2>
                {request.jahrgang_name && <p>{request.jahrgang_name}</p>}
              </IonLabel>
              <IonChip 
                color={getStatusColor(request.status)}
                style={{ marginLeft: '8px' }}
              >
                {getStatusText(request.status)}
              </IonChip>
            </IonItem>

            <IonItem lines="none">
              <IonIcon icon={star} slot="start" color="warning" />
              <IonLabel>
                <h3>Aktivität</h3>
                <p>{request.activity_name}</p>
              </IonLabel>
            </IonItem>

            <IonItem lines="none">
              <IonIcon icon={calendar} slot="start" color="success" />
              <IonLabel>
                <h3>Teilnahmedatum</h3>
                <p>{formatDate(request.requested_date)}</p>
              </IonLabel>
            </IonItem>

            <IonItem lines="none">
              <IonIcon icon={time} slot="start" color="medium" />
              <IonLabel>
                <h3>Eingereicht</h3>
                <p>{formatDateTime(request.created_at)}</p>
              </IonLabel>
            </IonItem>

            {request.comment && (
              <IonItem lines="none">
                <IonIcon icon={chatbubble} slot="start" color="tertiary" />
                <IonLabel>
                  <h3>Kommentar</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{request.comment}</p>
                </IonLabel>
              </IonItem>
            )}
          </IonCardContent>
        </IonCard>

        {/* Foto */}
        {request.photo_filename && (
          <IonCard>
            <IonCardContent>
              <IonItem lines="none">
                <IonIcon icon={image} slot="start" color="primary" />
                <IonLabel>
                  <h2>Nachweis-Foto</h2>
                </IonLabel>
              </IonItem>
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <IonImg 
                  src={`https://konfipoints.godsapp.de/api/activity-requests/${request.id}/photo`}
                  style={{ 
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                  }}
                />
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Admin Kommentar */}
        <IonCard>
          <IonCardContent>
            <IonItem lines="none">
              <IonLabel position="stacked">
                Admin-Kommentar {request.status === 'pending' && <span style={{ color: 'red' }}>*</span>}
              </IonLabel>
              <IonTextarea
                value={adminComment}
                onIonInput={(e) => setAdminComment(e.detail.value!)}
                placeholder={request.status === 'pending' ? 
                  'Kommentar zur Genehmigung/Ablehnung...' : 
                  'Kein Kommentar'
                }
                rows={3}
                disabled={request.status !== 'pending'}
              />
            </IonItem>
            {request.status === 'rejected' && (
              <IonText color="danger">
                <p style={{ fontSize: '0.85rem', margin: '8px 16px 0' }}>
                  * Kommentar erforderlich bei Ablehnung
                </p>
              </IonText>
            )}
          </IonCardContent>
        </IonCard>

        {/* Aktionen */}
        {request.status === 'pending' && (
          <IonCard>
            <IonCardContent>
              <IonGrid>
                <IonRow>
                  <IonCol size="6">
                    <IonButton 
                      expand="block" 
                      color="success" 
                      onClick={handleApprove}
                      disabled={loading}
                    >
                      <IonIcon icon={checkmark} slot="start" />
                      Genehmigen
                    </IonButton>
                  </IonCol>
                  <IonCol size="6">
                    <IonButton 
                      expand="block" 
                      color="danger" 
                      onClick={handleReject}
                      disabled={loading || !adminComment.trim()}
                    >
                      <IonIcon icon={close} slot="start" />
                      Ablehnen
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>
        )}

        {/* Status-Info bei bereits bearbeiteten Anträgen */}
        {request.status !== 'pending' && (
          <IonCard>
            <IonCardContent>
              <IonItem lines="none">
                <IonLabel>
                  <h2>Status: {getStatusText(request.status)}</h2>
                  <p>Bearbeitet am: {formatDateTime(request.updated_at)}</p>
                  {request.admin_comment && (
                    <p style={{ marginTop: '8px', fontStyle: 'italic' }}>
                      "{request.admin_comment}"
                    </p>
                  )}
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;