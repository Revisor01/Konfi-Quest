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
  IonListHeader,
  IonCard,
  IonCardContent,
  IonCheckbox
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
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null);

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

  const handleSubmit = async () => {
    if (!request || !selectedAction) return;

    if (selectedAction === 'reject' && !adminComment.trim()) {
      setError('Bitte gib einen Grund für die Ablehnung an');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/admin/activities/requests/${request.id}`, {
        status: selectedAction === 'approve' ? 'approved' : 'rejected',
        admin_comment: adminComment
      });
      setSuccess(`Antrag von "${request.konfi_name}" ${selectedAction === 'approve' ? 'genehmigt' : 'abgelehnt'}`);
      window.dispatchEvent(new CustomEvent('requestStatusChanged'));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || `Fehler beim ${selectedAction === 'approve' ? 'Genehmigen' : 'Ablehnen'} des Antrags`);
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
          {isPending && selectedAction && (
            <IonButtons slot="end">
              <IonButton onClick={handleSubmit} disabled={loading || (selectedAction === 'reject' && !adminComment.trim())}>
                {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkCircle} />}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Antragsdaten */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={documentTextOutline} />
            </div>
            <IonLabel>Antragsdaten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList>
                {/* Konfi */}
                <IonItem lines="inset">
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
                <IonItem lines="inset">
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
                  <IonItem lines="inset">
                    <IonIcon icon={trophyOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
                    <IonLabel>
                      <p>Punkte</p>
                      <h2>{request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}</h2>
                    </IonLabel>
                  </IonItem>
                )}

                {/* Teilnahmedatum */}
                <IonItem lines="inset">
                  <IonIcon icon={calendarOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
                  <IonLabel>
                    <p>Teilnahmedatum</p>
                    <h2>{formatDate(request.requested_date)}</h2>
                  </IonLabel>
                </IonItem>

                {/* Eingereicht */}
                <IonItem lines="inset">
                  <IonIcon icon={timeOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
                  <IonLabel>
                    <p>Eingereicht</p>
                    <h2>{formatDateTime(request.created_at)}</h2>
                  </IonLabel>
                </IonItem>

                {/* Kommentar */}
                {request.comment && (
                  <IonItem lines="none">
                    <IonIcon icon={chatbubbleEllipsesOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
                    <IonLabel className="ion-text-wrap">
                      <p>Kommentar vom Konfi</p>
                      <h2 style={{ whiteSpace: 'pre-wrap' }}>{request.comment}</h2>
                    </IonLabel>
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* SEKTION: Foto - nur bei pending anzeigen */}
        {isPending && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--requests">
                <IonIcon icon={imageOutline} />
              </div>
              <IonLabel>Nachweis-Foto</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
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
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Bearbeitungsstatus für approved/rejected */}
        {!isPending && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div
                className="app-section-icon"
                style={{ backgroundColor: isApproved ? '#059669' : '#dc3545' }}
              >
                <IonIcon icon={isApproved ? checkmarkCircle : closeCircle} />
              </div>
              <IonLabel>Bearbeitungsstatus</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList>
                  <IonItem lines="inset">
                    <IonIcon
                      icon={isApproved ? checkmarkCircle : closeCircle}
                      slot="start"
                      style={{ color: isApproved ? '#059669' : '#dc3545', fontSize: '1rem' }}
                    />
                    <IonLabel className="ion-text-wrap">
                      <p>Status</p>
                      <h2 style={{ color: isApproved ? '#059669' : '#dc3545' }}>
                        {isApproved ? 'Genehmigt' : 'Abgelehnt'} {request.approved_by_name ? `von ${request.approved_by_name}` : ''} am {formatDateTime(request.updated_at)}
                      </h2>
                    </IonLabel>
                  </IonItem>

                  {/* Begründung */}
                  {request.admin_comment && (
                    <IonItem lines="none">
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
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* SEKTION: Aktion - NUR bei pending */}
        {isPending && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--requests">
                <IonIcon icon={checkmarkCircle} />
              </div>
              <IonLabel>Entscheidung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Genehmigen */}
                  <div
                    className={`app-list-item app-list-item--activities ${selectedAction === 'approve' ? 'app-list-item--selected' : ''}`}
                    onClick={() => !loading && setSelectedAction('approve')}
                    style={{
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <IonIcon icon={checkmarkCircle} style={{ color: '#059669', fontSize: '1.2rem' }} />
                      <span style={{ fontWeight: '500', color: '#333' }}>Genehmigen</span>
                    </div>
                    <IonCheckbox
                      checked={selectedAction === 'approve'}
                      disabled={loading}
                      style={{
                        '--checkbox-background-checked': '#059669',
                        '--border-color-checked': '#059669',
                        '--checkmark-color': 'white'
                      }}
                    />
                  </div>

                  {/* Ablehnen */}
                  <div
                    className={`app-list-item app-list-item--events ${selectedAction === 'reject' ? 'app-list-item--selected' : ''}`}
                    onClick={() => !loading && setSelectedAction('reject')}
                    style={{
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <IonIcon icon={closeCircle} style={{ color: '#dc3545', fontSize: '1.2rem' }} />
                      <span style={{ fontWeight: '500', color: '#333' }}>Ablehnen</span>
                    </div>
                    <IonCheckbox
                      checked={selectedAction === 'reject'}
                      disabled={loading}
                      style={{
                        '--checkbox-background-checked': '#dc3545',
                        '--border-color-checked': '#dc3545',
                        '--checkmark-color': 'white'
                      }}
                    />
                  </div>
                </div>

                {/* Ablehnungsgrund - nur wenn Ablehnen gewählt */}
                {selectedAction === 'reject' && (
                  <div style={{ marginTop: '16px' }}>
                    <IonLabel style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px', display: 'block' }}>
                      Grund für die Ablehnung *
                    </IonLabel>
                    <IonTextarea
                      value={adminComment}
                      onIonInput={(e) => setAdminComment(e.detail.value!)}
                      placeholder="Bitte gib einen Grund für die Ablehnung an..."
                      rows={3}
                      disabled={loading}
                      style={{
                        width: '100%',
                        background: '#f5f5f5',
                        borderRadius: '8px',
                        padding: '8px',
                        '--padding-start': '12px',
                        '--padding-end': '12px'
                      }}
                    />
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
