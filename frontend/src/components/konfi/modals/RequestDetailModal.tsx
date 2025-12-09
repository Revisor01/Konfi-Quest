import React, { useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
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
  trophy,
  trash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

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

interface RequestDetailModalProps {
  request: ActivityRequest | null;
  onClose: () => void;
  onDelete?: (request: ActivityRequest) => void;
}

const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  onClose,
  onDelete
}) => {
  const { setError } = useApp();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  useEffect(() => {
    if (request?.photo_filename && request.status === 'pending') {
      loadPhoto(request.id);
    }
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [request]);

  const loadPhoto = async (id: number) => {
    setLoadingPhoto(true);
    try {
      const response = await api.get(`/konfi/activity-requests/${id}/photo`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setPhotoUrl(url);
    } catch (err) {
      console.error('Error loading photo:', err);
    } finally {
      setLoadingPhoto(false);
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

  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const isRejected = request.status === 'rejected';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Antragsdetails</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
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
            {/* Aktivitaet */}
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
                backgroundColor: getTypeColor(request.activity_type),
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 2px 8px ${request.activity_type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.3)' : 'rgba(45, 211, 111, 0.3)'}`,
                flexShrink: 0
              }}>
                <IonIcon icon={getTypeIcon(request.activity_type)} style={{ fontSize: '0.95rem', color: 'white' }} />
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

            {/* Punkte */}
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
                backgroundColor: '#ff9500',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={trophy} style={{ fontSize: '0.95rem', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Punkte</div>
                <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                  {request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}
                </div>
              </div>
            </div>

            {/* Teilnahmedatum */}
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

            {/* Eingereicht */}
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
                <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                  {formatDateTime(request.created_at)}
                </div>
              </div>
            </div>

            {/* Kommentar */}
            {request.comment && (
              <div style={{
                background: '#f5f5f5',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Deine Anmerkung</div>
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
                backgroundColor: '#7045f6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(112, 69, 246, 0.3)',
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
                {loadingPhoto ? (
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
                ) : photoUrl ? (
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

        {/* SEKTION: Bearbeitungsstatus */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: isPending ? '#ff9500' : isApproved ? '#047857' : '#dc3545',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isPending
              ? '0 2px 8px rgba(255, 149, 0, 0.3)'
              : isApproved
              ? '0 2px 8px rgba(4, 120, 87, 0.3)'
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
            Status
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
              background: isPending ? 'rgba(255, 149, 0, 0.1)' : isApproved ? 'rgba(4, 120, 87, 0.1)' : 'rgba(220, 53, 69, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              border: `1px solid ${isPending ? 'rgba(255, 149, 0, 0.3)' : isApproved ? 'rgba(4, 120, 87, 0.3)' : 'rgba(220, 53, 69, 0.3)'}`,
              marginBottom: (isRejected && request.admin_comment) ? '12px' : '0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: isPending ? '#ff9500' : isApproved ? '#047857' : '#dc3545',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPending
                  ? '0 2px 8px rgba(255, 149, 0, 0.3)'
                  : isApproved
                  ? '0 2px 8px rgba(4, 120, 87, 0.3)'
                  : '0 2px 8px rgba(220, 53, 69, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon
                  icon={isPending ? hourglass : isApproved ? checkmarkCircle : closeCircle}
                  style={{ fontSize: '0.95rem', color: 'white' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Status</div>
                <div style={{
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  color: isPending ? '#ff9500' : isApproved ? '#047857' : '#dc3545'
                }}>
                  {isPending ? 'Wartend auf Bearbeitung' : isApproved ? 'Genehmigt und verbucht' : 'Abgelehnt'}
                </div>
              </div>
            </div>

            {/* Ablehnungsgrund */}
            {isRejected && request.admin_comment && (
              <div style={{
                background: 'rgba(220, 53, 69, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(220, 53, 69, 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#dc3545',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)',
                  flexShrink: 0
                }}>
                  <IonIcon
                    icon={chatbubbleEllipses}
                    style={{ fontSize: '0.95rem', color: 'white' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>
                    Grund der Ablehnung
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#dc3545',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.4'
                  }}>
                    {request.admin_comment}
                  </div>
                </div>
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* Loeschen Button - nur bei pending */}
        {isPending && onDelete && (
          <div style={{ padding: '0 16px 24px 16px' }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => onDelete(request)}
              style={{
                '--border-color': '#dc3545',
                '--color': '#dc3545',
                '--background-hover': 'rgba(220, 53, 69, 0.1)',
                '--border-width': '2px',
                height: '48px',
                fontWeight: '600'
              }}
            >
              <IonIcon icon={trash} slot="start" />
              Antrag loeschen
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default RequestDetailModal;
