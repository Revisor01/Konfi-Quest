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
              <IonCardContent style={{ padding: '0' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem
                    lines="none"
                    style={{
                      '--min-height': '56px',
                      '--padding-start': '16px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '0',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: isApproved ? '#047857' : '#dc3545',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isApproved
                        ? '0 2px 8px rgba(4, 120, 87, 0.3)'
                        : '0 2px 8px rgba(220, 53, 69, 0.3)',
                      marginRight: '12px'
                    }}>
                      <IonIcon
                        icon={isApproved ? checkmarkCircle : closeCircle}
                        style={{
                          fontSize: '1rem',
                          color: 'white'
                        }}
                      />
                    </div>
                    <IonLabel>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#333'
                      }}>
                        {isApproved ? 'Antrag genehmigt' : 'Antrag abgelehnt'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
                        {isApproved ? 'Genehmigt' : 'Abgelehnt'} {request.approved_by_name ? `von ${request.approved_by_name}` : ''} am {formatDateTime(request.updated_at)}
                      </div>
                    </IonLabel>
                  </IonItem>

                  {request.admin_comment && !isApproved && (
                    <IonItem
                      lines="none"
                      style={{
                        '--padding-start': '16px',
                        '--padding-top': '12px',
                        '--padding-bottom': '12px',
                        '--background': 'rgba(220, 53, 69, 0.05)',
                        '--border-radius': '12px',
                        marginTop: '8px',
                        borderRadius: '12px',
                        border: '1px solid rgba(220, 53, 69, 0.2)'
                      }}
                    >
                      <IonLabel style={{ whiteSpace: 'normal' }}>
                        <div style={{ fontWeight: '600', marginBottom: '6px', color: '#dc3545', fontSize: '0.85rem' }}>
                          Begründung:
                        </div>
                        <div style={{
                          fontSize: '0.9rem',
                          color: '#dc3545',
                          lineHeight: '1.4'
                        }}>
                          {request.admin_comment}
                        </div>
                      </IonLabel>
                    </IonItem>
                  )}
                  {request.admin_comment && isApproved && (
                    <IonItem
                      lines="none"
                      style={{
                        '--padding-start': '16px',
                        '--padding-top': '12px',
                        '--padding-bottom': '12px',
                        '--background': 'transparent',
                        marginTop: '8px'
                      }}
                    >
                      <IonLabel style={{ whiteSpace: 'normal' }}>
                        <div style={{ fontWeight: '600', marginBottom: '6px', color: '#666', fontSize: '0.85rem' }}>
                          Kommentar:
                        </div>
                        <div style={{
                          fontSize: '0.9rem',
                          color: '#333',
                          lineHeight: '1.4'
                        }}>
                          {request.admin_comment}
                        </div>
                      </IonLabel>
                    </IonItem>
                  )}
                </IonList>
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

            {/* Action Buttons - untereinander, Line-Style */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <IonButton
                expand="block"
                fill="outline"
                onClick={handleApprove}
                disabled={loading}
                style={{
                  '--border-color': '#047857',
                  '--color': '#047857',
                  '--background-hover': 'rgba(4, 120, 87, 0.1)',
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
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ActivityRequestModal;
