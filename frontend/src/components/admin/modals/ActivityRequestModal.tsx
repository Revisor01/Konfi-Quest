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
  IonImg,
  IonSpinner,
  IonList
} from '@ionic/react';
import {
  checkmarkOutline,
  closeOutline,
  person,
  calendar,
  document,
  image,
  chatbubbleEllipses,
  time,
  checkmarkCircle,
  closeCircle,
  hourglass
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
      await api.put(`/activities/requests/${request.id}`, {
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

  const isPending = request?.status === 'pending';
  const isApproved = request?.status === 'approved';
  const isRejected = request?.status === 'rejected';

  if (!request) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Antrag wird geladen...</IonTitle>
            <IonButtons slot="start">
              <IonButton
                onClick={onClose}
                style={{
                  '--background': '#f8f9fa',
                  '--background-hover': '#e9ecef',
                  '--color': '#6c757d',
                  '--border-radius': '8px'
                }}
              >
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <IonSpinner name="crescent" />
            <p style={{ marginTop: '16px', color: '#666' }}>Antrag wird geladen...</p>
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
            <IonButton
              onClick={onClose}
              disabled={loading}
              style={{
                '--background': '#f8f9fa',
                '--background-hover': '#e9ecef',
                '--color': '#6c757d',
                '--border-radius': '8px'
              }}
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          {isPending && (
            <IonButtons slot="end">
              <IonButton
                onClick={handleApprove}
                disabled={loading}
                color="primary"
                style={{
                  '--background': '#2dd36f',
                  '--background-hover': '#28ba62',
                  '--color': 'white',
                  '--border-radius': '8px',
                  marginRight: '8px'
                }}
              >
                {loading ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <IonIcon icon={checkmarkOutline} />
                )}
              </IonButton>
              <IonButton
                onClick={handleReject}
                disabled={loading || !adminComment.trim()}
                color="danger"
                style={{
                  '--background': '#dc3545',
                  '--background-hover': '#c82333',
                  '--color': 'white',
                  '--border-radius': '8px'
                }}
              >
                {loading ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <IonIcon icon={closeOutline} />
                )}
              </IonButton>
            </IonButtons>
          )}
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
            backgroundColor: isPending ? '#ff9500' : isApproved ? '#2dd36f' : '#dc3545',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isPending
              ? '0 2px 8px rgba(255, 149, 0, 0.3)'
              : isApproved
              ? '0 2px 8px rgba(45, 211, 111, 0.3)'
              : '0 2px 8px rgba(220, 53, 69, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon
              icon={isPending ? hourglass : isApproved ? checkmarkCircle : closeCircle}
              style={{ fontSize: '1rem', color: 'white' }}
            />
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
            <IonList style={{ background: 'transparent' }} lines="none">
              {/* Konfi */}
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#8b5cf6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                  }}>
                    <IonIcon icon={person} style={{ fontSize: '0.9rem', color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '1rem', color: '#333', marginBottom: '2px' }}>
                      {request.konfi_name}
                    </div>
                    {request.jahrgang_name && (
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        {request.jahrgang_name}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    color: isPending ? '#ff9500' : isApproved ? '#2dd36f' : '#dc3545',
                    fontWeight: '600',
                    backgroundColor: isPending
                      ? 'rgba(255, 149, 0, 0.15)'
                      : isApproved
                      ? 'rgba(45, 211, 111, 0.15)'
                      : 'rgba(220, 53, 69, 0.15)',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    border: isPending
                      ? '1px solid rgba(255, 149, 0, 0.3)'
                      : isApproved
                      ? '1px solid rgba(45, 211, 111, 0.3)'
                      : '1px solid rgba(220, 53, 69, 0.3)',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                  }}>
                    {isPending ? 'OFFEN' : isApproved ? 'GENEHMIGT' : 'ABGELEHNT'}
                  </span>
                </div>
              </IonItem>

              {/* Aktivität */}
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#2dd36f',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(45, 211, 111, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                  }}>
                    <IonIcon icon={document} style={{ fontSize: '0.9rem', color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>
                      Aktivität
                    </div>
                    <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                      {request.activity_name}
                    </div>
                  </div>
                </div>
              </IonItem>

              {/* Teilnahmedatum */}
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#dc2626',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                  }}>
                    <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>
                      Teilnahmedatum
                    </div>
                    <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                      {formatDate(request.requested_date)}
                    </div>
                  </div>
                </div>
              </IonItem>

              {/* Eingereicht am */}
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: request.comment ? '12px' : '0' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#ff6b35',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(255, 107, 53, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                  }}>
                    <IonIcon icon={time} style={{ fontSize: '0.9rem', color: 'white' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>
                      Eingereicht
                    </div>
                    <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                      {formatDateTime(request.created_at)}
                    </div>
                  </div>
                </div>
              </IonItem>

              {/* Kommentar vom Konfi */}
              {request.comment && (
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    width: '100%'
                  }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      backgroundColor: '#007aff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0, 122, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                    }}>
                      <IonIcon icon={chatbubbleEllipses} style={{ fontSize: '0.9rem', color: 'white' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>
                        Kommentar
                      </div>
                      <div style={{
                        fontSize: '0.9rem',
                        color: '#333',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.4'
                      }}>
                        {request.comment}
                      </div>
                    </div>
                  </div>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Nachweis-Foto */}
        {request.photo_filename && (
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
                backgroundColor: '#007aff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={image} style={{ fontSize: '1rem', color: 'white' }} />
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
                <div style={{ textAlign: 'center' }}>
                  <IonImg
                    src={`https://konfi-points.de/api/activity-requests/${request.id}/photo`}
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
          </>
        )}

        {/* SEKTION: Admin-Kommentar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#ff6b35',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={chatbubbleEllipses} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Admin-Kommentar
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
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">
                  Admin-Kommentar {isPending && isRejected && <span style={{ color: '#dc3545' }}> *</span>}
                </IonLabel>
                <IonTextarea
                  value={adminComment}
                  onIonInput={(e) => setAdminComment(e.detail.value!)}
                  placeholder={isPending ? 'Optionaler Kommentar zur Genehmigung/Ablehnung...' : 'Kein Kommentar'}
                  rows={3}
                  disabled={!isPending || loading}
                />
              </IonItem>
              {isPending && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  marginTop: '8px',
                  paddingLeft: '16px'
                }}>
                  * Kommentar erforderlich bei Ablehnung
                </div>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Status-Info bei bereits bearbeiteten Anträgen */}
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
                backgroundColor: isApproved ? '#2dd36f' : '#dc3545',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isApproved
                  ? '0 2px 8px rgba(45, 211, 111, 0.3)'
                  : '0 2px 8px rgba(220, 53, 69, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon
                  icon={isApproved ? checkmarkCircle : closeCircle}
                  style={{ fontSize: '1rem', color: 'white' }}
                />
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
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: isApproved ? '#2dd36f' : '#dc3545',
                  marginBottom: '8px'
                }}>
                  {isApproved ? 'Genehmigt' : 'Abgelehnt'}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  Bearbeitet am: {formatDateTime(request.updated_at)}
                </div>
                {request.admin_comment && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#333',
                    fontStyle: 'italic',
                    lineHeight: '1.4'
                  }}>
                    "{request.admin_comment}"
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
