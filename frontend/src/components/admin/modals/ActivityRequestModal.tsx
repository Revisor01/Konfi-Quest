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
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader
} from '@ionic/react';
import {
  closeOutline,
  personOutline,
  calendarOutline,
  documentTextOutline,
  imageOutline,
  chatbubbleEllipsesOutline,
  timeOutline,
  home,
  people,
  checkmarkCircle,
  closeCircle,
  hourglass,
  trophyOutline,
  alertCircleOutline
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
  activity_type?: string;
  activity_points?: number;
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by?: number;
  approved_by_name?: string;
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showRejectField, setShowRejectField] = useState(false);

  useEffect(() => {
    if (requestId) {
      loadRequest();
    }
  }, [requestId]);

  const loadRequest = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const response = await api.get('/admin/activities/requests');
      const requests = response.data;
      const foundRequest = requests.find((r: ActivityRequest) => r.id === requestId);

      if (foundRequest) {
        setRequest(foundRequest);
        setAdminComment(foundRequest.admin_comment || '');

        if (foundRequest.photo_filename && foundRequest.status === 'pending') {
          loadPhoto(foundRequest.id);
        }
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

  const loadPhoto = async (id: number) => {
    try {
      const response = await api.get(`/admin/activities/requests/${id}/photo`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setPhotoUrl(url);
    } catch (err) {
      console.error('Error loading photo:', err);
    }
  };

  const handleApprove = async () => {
    if (!request) return;

    setLoading(true);
    try {
      await api.put(`/admin/activities/requests/${request.id}`, {
        status: 'approved',
        admin_comment: adminComment
      });
      setSuccess(`Antrag von "${request.konfi_name}" genehmigt`);
      window.dispatchEvent(new CustomEvent('requestStatusChanged'));
      onSuccess();
      onClose();
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
      await api.put(`/admin/activities/requests/${request.id}`, {
        status: 'rejected',
        admin_comment: adminComment
      });
      setSuccess(`Antrag von "${request.konfi_name}" abgelehnt`);
      window.dispatchEvent(new CustomEvent('requestStatusChanged'));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ablehnen des Antrags');
    } finally {
      setLoading(false);
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

  const isPending = request?.status === 'pending';
  const isApproved = request?.status === 'approved';
  const isRejected = request?.status === 'rejected';

  if (!request) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Antrag laden...</IonTitle>
            <IonButtons slot="start">
              <IonButton onClick={onClose}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <IonSpinner name="crescent" />
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
            <IonButton onClick={onClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Antragsdaten */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={documentTextOutline} />
            </div>
            <IonLabel>Antragsdaten</IonLabel>
          </IonListHeader>

          {/* Konfi */}
          <IonItem>
            <IonIcon icon={personOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
            <IonLabel>
              <p>Konfi</p>
              <h2>
                {request.konfi_name}
                {request.jahrgang_name && (
                  <span style={{ color: '#666', fontWeight: '400', marginLeft: '8px' }}>
                    ({request.jahrgang_name})
                  </span>
                )}
              </h2>
            </IonLabel>
          </IonItem>

          {/* Aktivität */}
          <IonItem>
            <IonIcon
              icon={request.activity_type === 'gottesdienst' ? home : people}
              slot="start"
              style={{ color: '#8e8e93', fontSize: '1rem' }}
            />
            <IonLabel>
              <p>Aktivität ({request.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'})</p>
              <h2>{request.activity_name}</h2>
            </IonLabel>
          </IonItem>

          {/* Punkte */}
          {request.activity_points && (
            <IonItem>
              <IonIcon icon={trophyOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
              <IonLabel>
                <p>Punkte</p>
                <h2>{request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}</h2>
              </IonLabel>
            </IonItem>
          )}

          {/* Teilnahmedatum */}
          <IonItem>
            <IonIcon icon={calendarOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
            <IonLabel>
              <p>Teilnahmedatum</p>
              <h2>{formatDate(request.requested_date)}</h2>
            </IonLabel>
          </IonItem>

          {/* Eingereicht */}
          <IonItem>
            <IonIcon icon={timeOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
            <IonLabel>
              <p>Eingereicht</p>
              <h2>{formatDateTime(request.created_at)}</h2>
            </IonLabel>
          </IonItem>

          {/* Kommentar */}
          {request.comment && (
            <IonItem>
              <IonIcon icon={chatbubbleEllipsesOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
              <IonLabel className="ion-text-wrap">
                <p>Kommentar vom Konfi</p>
                <h2 style={{ whiteSpace: 'pre-wrap' }}>{request.comment}</h2>
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        {/* SEKTION: Foto - nur bei pending anzeigen */}
        {isPending && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--purple">
                <IonIcon icon={imageOutline} />
              </div>
              <IonLabel>Nachweis-Foto</IonLabel>
            </IonListHeader>

            <IonItem lines="none">
              <div style={{ width: '100%', padding: '8px 0' }}>
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Antragsfoto"
                    style={{
                      maxWidth: '100%',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'block'
                    }}
                  />
                ) : request.photo_filename ? (
                  <div style={{
                    background: '#f5f5f5',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    textAlign: 'center'
                  }}>
                    <IonSpinner name="crescent" />
                    <p style={{ margin: '12px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                      Lade Foto...
                    </p>
                  </div>
                ) : (
                  <div style={{
                    background: '#f5f5f5',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={imageOutline}
                      style={{ fontSize: '2.5rem', color: '#999', marginBottom: '12px', display: 'block' }}
                    />
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                      Kein Foto hochgeladen
                    </p>
                  </div>
                )}
              </div>
            </IonItem>
          </IonList>
        )}

        {/* SEKTION: Bearbeitungsstatus für approved/rejected */}
        {!isPending && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div
                className="app-section-icon"
                style={{ backgroundColor: isApproved ? '#155724' : '#dc3545' }}
              >
                <IonIcon icon={isApproved ? checkmarkCircle : closeCircle} />
              </div>
              <IonLabel>Bearbeitungsstatus</IonLabel>
            </IonListHeader>

            <IonItem>
              <IonIcon
                icon={isApproved ? checkmarkCircle : closeCircle}
                slot="start"
                style={{ color: isApproved ? '#155724' : '#dc3545', fontSize: '1rem' }}
              />
              <IonLabel className="ion-text-wrap">
                <p>Status</p>
                <h2 style={{ color: isApproved ? '#155724' : '#dc3545' }}>
                  {isApproved ? 'Genehmigt' : 'Abgelehnt'} {request.approved_by_name ? `von ${request.approved_by_name}` : ''} am {formatDateTime(request.updated_at)}
                </h2>
              </IonLabel>
            </IonItem>

            {/* Begründung */}
            {request.admin_comment && (
              <IonItem>
                <IonIcon
                  icon={isApproved ? chatbubbleEllipsesOutline : alertCircleOutline}
                  slot="start"
                  style={{ color: isApproved ? '#8e8e93' : '#dc3545', fontSize: '1rem' }}
                />
                <IonLabel className="ion-text-wrap">
                  <p>{isApproved ? 'Kommentar' : 'Begründung'}</p>
                  <h2 style={{ color: isApproved ? '#333' : '#dc3545', whiteSpace: 'pre-wrap' }}>
                    {request.admin_comment}
                  </h2>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        )}

        {/* SEKTION: Aktion - NUR bei pending */}
        {isPending && (
          <>
            {showRejectField && (
              <IonList inset={true} style={{ margin: '16px' }}>
                <IonListHeader>
                  <div className="app-section-icon app-section-icon--danger">
                    <IonIcon icon={alertCircleOutline} />
                  </div>
                  <IonLabel>Ablehnungsgrund</IonLabel>
                </IonListHeader>

                <IonItem>
                  <IonTextarea
                    value={adminComment}
                    onIonInput={(e) => setAdminComment(e.detail.value!)}
                    placeholder="Bitte gib einen Grund für die Ablehnung an..."
                    rows={3}
                    disabled={loading}
                    style={{ width: '100%' }}
                  />
                </IonItem>
              </IonList>
            )}

            {/* Action Buttons */}
            <div style={{ padding: '0 16px 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <IonButton
                expand="block"
                fill="outline"
                onClick={handleApprove}
                disabled={loading}
                style={{
                  '--border-color': '#155724',
                  '--color': '#155724',
                  '--background-hover': 'rgba(21, 87, 36, 0.1)',
                  '--border-width': '2px',
                  height: '48px',
                  fontWeight: '600'
                }}
              >
                {loading ? <IonSpinner name="crescent" /> : 'Genehmigen'}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => {
                  if (!showRejectField) {
                    setShowRejectField(true);
                  } else {
                    handleReject();
                  }
                }}
                disabled={loading || (showRejectField && !adminComment.trim())}
                style={{
                  '--border-color': '#991b1b',
                  '--color': '#991b1b',
                  '--background-hover': 'rgba(153, 27, 27, 0.1)',
                  '--border-width': '2px',
                  height: '48px',
                  fontWeight: '600'
                }}
              >
                {loading ? <IonSpinner name="crescent" /> : showRejectField ? 'Ablehnen bestätigen' : 'Ablehnen'}
              </IonButton>
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
