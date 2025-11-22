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
  IonIcon,
  IonSpinner,
  IonList
} from '@ionic/react';
import {
  closeOutline,
  person,
  calendar,
  document,
  image as imageIcon,
  chatbubbleEllipses,
  time,
  create,
  home,
  people,
  checkmarkCircle,
  closeCircle,
  hourglass,
  trophy
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

        // Load photo only if request is pending (not approved)
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
      // Don't show error to user, photo might be deleted
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

  const getTypeIcon = (type: string) => {
    return type === 'gottesdienst' ? home : people;
  };

  const getTypeColor = (type: string) => {
    return type === 'gottesdienst' ? '#007aff' : '#2dd36f';
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    const firstInitial = words[0][0] || '';
    const lastInitial = words[words.length - 1][0] || '';
    return (firstInitial + lastInitial).toUpperCase();
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#059669',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={document} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Antragsdaten
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            {/* Status Badge wie bei Events */}
            <div style={{
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                fontSize: '0.7rem',
                color: isPending ? '#ff9500' : isApproved ? '#34c759' : '#dc3545',
                fontWeight: '600',
                backgroundColor: isPending
                  ? 'rgba(255, 149, 0, 0.15)'
                  : isApproved
                  ? 'rgba(52, 199, 89, 0.15)'
                  : 'rgba(220, 38, 38, 0.15)',
                padding: '4px 8px',
                borderRadius: '6px',
                border: isPending
                  ? '1px solid rgba(255, 149, 0, 0.3)'
                  : isApproved
                  ? '1px solid rgba(52, 199, 89, 0.3)'
                  : '1px solid rgba(220, 38, 38, 0.3)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {isPending ? 'OFFEN' : isApproved ? 'GENEHMIGT' : 'ABGELEHNT'}
              </span>
            </div>

            <div style={{
              background: '#f5f5f5',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e0e0e0',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#9b59b6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(155, 89, 182, 0.3)',
                flexShrink: 0
              }}>
                <div style={{
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}>
                  {getInitials(request.konfi_name)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Konfi</div>
                <div style={{ fontWeight: '600', fontSize: '1rem', color: '#333' }}>
                  {request.konfi_name}
                  {request.jahrgang_name && (
                    <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: '400', marginLeft: '8px' }}>
                      ({request.jahrgang_name})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              background: '#f5f5f5',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e0e0e0',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: getTypeColor(request.activity_type || 'gemeinde'),
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 2px 8px ${request.activity_type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.3)' : 'rgba(45, 211, 111, 0.3)'}`,
                flexShrink: 0
              }}>
                <IonIcon icon={getTypeIcon(request.activity_type || 'gemeinde')} style={{ fontSize: '0.95rem', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>
                  {request.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                </div>
                <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                  {request.activity_name}
                </div>
              </div>
            </div>

            <div style={{
              background: '#f5f5f5',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e0e0e0',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#059669',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={calendar} style={{ fontSize: '0.95rem', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Teilnahmedatum</div>
                <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                  {formatDate(request.requested_date)}
                </div>
              </div>
            </div>

            <div style={{
              background: '#f5f5f5',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #e0e0e0',
              marginBottom: request.comment ? '12px' : '0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#059669',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={time} style={{ fontSize: '0.95rem', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Eingereicht</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  {formatDateTime(request.created_at)}
                </div>
              </div>
            </div>

            {request.comment && (
              <div style={{
                background: '#f5f5f5',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Kommentar</div>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#333',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.4'
                }}>
                  {request.comment}
                </div>
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Foto - nur bei pending anzeigen */}
        {isPending && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '24px 16px 12px 16px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#059669',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={imageIcon} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{
                fontWeight: '600',
                fontSize: '1.1rem',
                margin: '0',
                color: '#333'
              }}>
                Nachweis-Foto
              </h2>
            </div>

            <IonCard style={{
              margin: '0 16px 16px 16px',
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e0e0e0'
            }}>
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
                    textAlign: 'center',
                    border: '1px solid #e0e0e0'
                  }}>
                    <IonSpinner name="crescent" />
                    <p style={{
                      margin: '12px 0 0 0',
                      fontSize: '0.9rem',
                      color: '#666'
                    }}>
                      Lade Foto...
                    </p>
                  </div>
                ) : (
                  <div style={{
                    background: '#f5f5f5',
                    borderRadius: '12px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    border: '1px solid #e0e0e0'
                  }}>
                    <IonIcon
                      icon={imageIcon}
                      style={{
                        fontSize: '2.5rem',
                        color: '#999',
                        marginBottom: '12px',
                        display: 'block'
                      }}
                    />
                    <p style={{
                      margin: '0',
                      fontSize: '0.9rem',
                      color: '#666'
                    }}>
                      Kein Foto hochgeladen
                    </p>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* SEKTION: Bearbeitungsstatus für approved/rejected */}
        {!isPending && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '24px 16px 12px 16px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#059669',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={create} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{
                fontWeight: '600',
                fontSize: '1.1rem',
                margin: '0',
                color: '#333'
              }}>
                Bearbeitungsstatus
              </h2>
            </div>

            <IonCard style={{
              margin: '0 16px 16px 16px',
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e0e0e0'
            }}>
              <IonCardContent style={{ padding: '16px' }}>
                <div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: isApproved ? '#2dd36f' : '#dc3545',
                    marginBottom: '8px'
                  }}>
                    {isApproved ? 'Genehmigt' : 'Abgelehnt'}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
                    {formatDateTime(request.updated_at)}
                  </div>
                  {request.admin_comment && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      color: '#333',
                      fontStyle: 'italic'
                    }}>
                      "{request.admin_comment}"
                    </div>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* Buttons unten - nur bei pending */}
        {isPending && (
          <div style={{ padding: '0 16px 24px 16px' }}>
            {/* Ablehn-Kommentar Feld */}
            {showRejectField && (
              <IonCard style={{
                marginBottom: '16px',
                borderRadius: '12px',
                background: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                border: '1px solid #e0e0e0'
              }}>
                <IonCardContent style={{ padding: '16px' }}>
                  <IonItem lines="none" style={{
                    '--background': '#f5f5f5',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    margin: '0',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}>
                    <IonLabel position="stacked" style={{ marginBottom: '8px', color: '#666', fontWeight: '600' }}>
                      Grund für Ablehnung (erforderlich)
                    </IonLabel>
                    <IonTextarea
                      value={adminComment}
                      onIonInput={(e) => setAdminComment(e.detail.value!)}
                      placeholder="Bitte gib einen Grund für die Ablehnung an..."
                      rows={3}
                      disabled={loading}
                    />
                  </IonItem>
                </IonCardContent>
              </IonCard>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <IonButton
                expand="block"
                color="success"
                onClick={handleApprove}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? <IonSpinner name="crescent" /> : 'Genehmigen'}
              </IonButton>
              <IonButton
                expand="block"
                color="danger"
                onClick={() => {
                  if (!showRejectField) {
                    setShowRejectField(true);
                  } else {
                    handleReject();
                  }
                }}
                disabled={loading || (showRejectField && !adminComment.trim())}
                style={{ flex: 1 }}
              >
                {loading ? <IonSpinner name="crescent" /> : showRejectField ? 'Ablehnen bestätigen' : 'Ablehnen'}
              </IonButton>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
