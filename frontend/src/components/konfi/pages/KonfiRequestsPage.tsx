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
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  useIonModal
} from '@ionic/react';
import { add, calendar, checkmarkCircle, closeCircle, hourglass, home, people } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import ActivityRequestModal from '../modals/ActivityRequestModal';

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
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('konfi-requests');
  
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [presentRequestModal, dismissRequestModal] = useIonModal(ActivityRequestModal, {
    onClose: () => dismissRequestModal(),
    onSuccess: () => {
      dismissRequestModal();
      loadRequests();
    }
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/requests');
      setRequests(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Anträge');
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRequest = () => {
    presentRequestModal({
      presentingElement: presentingElement
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
      case 'pending': return 'Wartend';
      case 'approved': return 'Genehmigt';
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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Meine Anträge</IonTitle>
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
              Meine Anträge
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
          <LoadingSpinner message="Anträge werden geladen..." />
        ) : (
          <>
            {/* Statistik Card */}
            <IonCard style={{
              margin: '16px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3880ff 0%, #2dd36f 100%)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(56, 128, 255, 0.3)'
            }}>
              <IonCardContent>
                <IonGrid>
                  <IonRow>
                    <IonCol size="4">
                      <div style={{ textAlign: 'center' }}>
                        <IonIcon icon={hourglass} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                        <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                          {pendingRequests.length}
                        </h3>
                        <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                          Wartend
                        </p>
                      </div>
                    </IonCol>
                    <IonCol size="4">
                      <div style={{ textAlign: 'center' }}>
                        <IonIcon icon={checkmarkCircle} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                        <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                          {approvedRequests.length}
                        </h3>
                        <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                          Genehmigt
                        </p>
                      </div>
                    </IonCol>
                    <IonCol size="4">
                      <div style={{ textAlign: 'center' }}>
                        <IonIcon icon={closeCircle} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                        <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                          {rejectedRequests.length}
                        </h3>
                        <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                          Abgelehnt
                        </p>
                      </div>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </IonCardContent>
            </IonCard>

            {/* Anträge Liste */}
            <IonCard style={{ margin: '16px' }}>
              <IonCardContent style={{ padding: '8px 0' }}>
                <IonList lines="none" style={{ background: 'transparent' }}>
                  {requests.map((request) => (
                    <IonItem
                      key={request.id}
                      style={{
                        '--min-height': '90px',
                        '--padding-start': '16px',
                        '--padding-top': '12px',
                        '--padding-bottom': '12px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '6px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #f0f0f0',
                        borderRadius: '12px'
                      }}
                    >
                      <IonLabel>
                        {/* Header mit Status */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: request.activity_type === 'gottesdienst' ? '#3880ff' : '#2dd36f',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={getTypeIcon(request.activity_type)}
                                style={{
                                  fontSize: '1rem',
                                  color: 'white'
                                }}
                              />
                            </div>
                            <h2 style={{
                              fontWeight: '600',
                              fontSize: '1.1rem',
                              margin: '0'
                            }}>
                              {request.activity_name}
                            </h2>
                          </div>
                          
                          <IonBadge color={getStatusColor(request.status)} style={{ fontSize: '0.75rem' }}>
                            {getStatusText(request.status)}
                          </IonBadge>
                        </div>

                        {/* Details */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '6px',
                          fontSize: '0.85rem',
                          color: '#666'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: '#007aff' }} />
                            <span>{formatDate(request.requested_date)}</span>
                          </div>
                          
                          <span style={{ color: '#6c757d' }}>•</span>
                          
                          <span style={{ color: '#007aff', fontWeight: '500' }}>
                            {request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}
                          </span>
                        </div>

                        {/* Kommentar */}
                        {request.comment && (
                          <p style={{
                            margin: '0 0 6px 0',
                            fontSize: '0.85rem',
                            color: '#666',
                            fontStyle: 'italic'
                          }}>
                            "{request.comment}"
                          </p>
                        )}

                        {/* Admin Kommentar bei Ablehnung */}
                        {request.status === 'rejected' && request.admin_comment && (
                          <div style={{
                            background: '#fee',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            marginTop: '8px',
                            border: '1px solid #fcc'
                          }}>
                            <p style={{
                              margin: '0',
                              fontSize: '0.85rem',
                              color: '#c33',
                              fontWeight: '500'
                            }}>
                              Ablehnungsgrund: {request.admin_comment}
                            </p>
                          </div>
                        )}

                        {/* Foto anzeigen */}
                        {request.photo_filename && (
                          <div style={{ marginTop: '8px' }}>
                            <IonChip style={{ fontSize: '0.75rem' }}>
                              📷 Foto vorhanden
                            </IonChip>
                          </div>
                        )}
                      </IonLabel>
                    </IonItem>
                  ))}

                  {requests.length === 0 && (
                    <IonItem>
                      <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                        <p>Noch keine Anträge gestellt</p>
                        <IonButton
                          fill="clear"
                          onClick={handleAddRequest}
                          style={{ marginTop: '8px' }}
                        >
                          <IonIcon icon={add} slot="start" />
                          Ersten Antrag stellen
                        </IonButton>
                      </IonLabel>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiRequestsPage;