import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonButton,
  IonIcon,
  IonButtons,
  IonGrid,
  IonRow,
  IonCol,
  IonTextarea,
  IonInput,
  IonImg,
  IonSegment,
  IonSegmentButton,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { 
  checkmarkCircleOutline, 
  closeCircleOutline, 
  timeOutline, 
  homeOutline, 
  peopleOutline, 
  calendarOutline,
  personOutline,
  imageOutline,
  documentTextOutline,
  closeOutline,
  checkmarkOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface ActivityRequest {
  id: number;
  activity_id: number;
  activity_name: string; 
  activity_points: number;
  activity_type: 'gottesdienst' | 'gemeinde';
  konfi_name: string;
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by_name?: string;
  created_at: string;
  updated_at: string;
}

interface RequestDetailModalProps {
  request: ActivityRequest;
  onClose: () => void;
  onApprove: (requestId: number, comment?: string) => void;
  onReject: (requestId: number, comment: string) => void;
}

const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  onClose,
  onApprove,
  onReject
}) => {
  const [comment, setComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRequestedDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type: string) => {
    return type === 'gottesdienst' ? homeOutline : peopleOutline;
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{request.activity_name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        <div style={{ padding: '16px' }}>
          {/* Header Card */}
          <IonCard style={{
            background: request.activity_type === 'gottesdienst' 
              ? 'linear-gradient(135deg, #3880ff 0%, #5a9cff 100%)'
              : 'linear-gradient(135deg, #2dd36f 0%, #4ae884 100%)',
            color: 'white',
            textAlign: 'center'
          }}>
            <IonCardContent>
              <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <IonIcon 
                  icon={getTypeIcon(request.activity_type)} 
                  style={{ fontSize: '2rem' }} 
                />
              </div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '600' }}>
                {request.activity_name}
              </h1>
              <p style={{ margin: '0', opacity: 0.9, fontSize: '1rem' }}>
                {request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}
              </p>
            </IonCardContent>
          </IonCard>

          {/* Konfi Details */}
          <IonCard>
            <IonCardContent>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                Antragssteller
              </h3>
              
              <IonItem lines="none" style={{ '--padding-start': '0' }}>
                <IonIcon icon={personOutline} slot="start" color="primary" />
                <IonLabel>
                  <h4>{request.konfi_name}</h4>
                  <p>Eingereicht am {formatDate(request.created_at)}</p>
                </IonLabel>
              </IonItem>

              <IonItem lines="none" style={{ '--padding-start': '0' }}>
                <IonIcon icon={calendarOutline} slot="start" color="success" />
                <IonLabel>
                  <h4>Aktivitätsdatum</h4>
                  <p>{formatRequestedDate(request.requested_date)}</p>
                </IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>

          {/* Beschreibung */}
          {request.comment && (
            <IonCard>
              <IonCardContent>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <IonIcon icon={documentTextOutline} color="warning" style={{ fontSize: '1.2rem' }} />
                  <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                    Beschreibung
                  </h3>
                </div>
                <p style={{ 
                  margin: '0', 
                  lineHeight: '1.5',
                  backgroundColor: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {request.comment}
                </p>
              </IonCardContent>
            </IonCard>
          )}

          {/* Foto */}
          {request.photo_filename && (
            <IonCard>
              <IonCardContent>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <IonIcon icon={imageOutline} color="tertiary" style={{ fontSize: '1.2rem' }} />
                  <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>
                    Nachweis-Foto
                  </h3>
                </div>
                <IonImg 
                  src={`/api/uploads/${request.photo_filename}`}
                  alt="Nachweis-Foto"
                  style={{ 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef',
                    maxHeight: '300px',
                    objectFit: 'contain'
                  }}
                />
              </IonCardContent>
            </IonCard>
          )}

          {/* Status & Admin Actions */}
          {request.status === 'pending' ? (
            <IonCard>
              <IonCardContent>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Entscheidung treffen
                </h3>
                
                {!showRejectForm ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <IonButton 
                      expand="block" 
                      color="success"
                      onClick={() => onApprove(request.id, comment)}
                      style={{ flex: 1 }}
                    >
                      <IonIcon icon={checkmarkOutline} slot="start" />
                      Genehmigen
                    </IonButton>
                    <IonButton 
                      expand="block" 
                      color="danger"
                      fill="outline"
                      onClick={() => setShowRejectForm(true)}
                      style={{ flex: 1 }}
                    >
                      <IonIcon icon={closeCircleOutline} slot="start" />
                      Ablehnen
                    </IonButton>
                  </div>
                ) : (
                  <div>
                    <IonItem>
                      <IonLabel position="stacked">Ablehnungsgrund (erforderlich)</IonLabel>
                      <IonTextarea
                        value={rejectComment}
                        onIonInput={(e) => setRejectComment(e.detail.value!)}
                        placeholder="Warum wird der Antrag abgelehnt?"
                        autoGrow={true}
                        rows={3}
                      />
                    </IonItem>
                    
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                      <IonButton 
                        expand="block" 
                        color="danger"
                        onClick={() => onReject(request.id, rejectComment)}
                        disabled={!rejectComment.trim()}
                        style={{ flex: 1 }}
                      >
                        <IonIcon icon={closeCircleOutline} slot="start" />
                        Endgültig ablehnen
                      </IonButton>
                      <IonButton 
                        expand="block" 
                        fill="outline"
                        color="medium"
                        onClick={() => setShowRejectForm(false)}
                        style={{ flex: 1 }}
                      >
                        Abbrechen
                      </IonButton>
                    </div>
                  </div>
                )}

                {/* Optional comment for approval */}
                {!showRejectForm && (
                  <div style={{ marginTop: '16px' }}>
                    <IonItem>
                      <IonLabel position="stacked">Optionaler Kommentar</IonLabel>
                      <IonInput
                        value={comment}
                        onIonInput={(e) => setComment(e.detail.value!)}
                        placeholder="Zusätzliche Notiz..."
                      />
                    </IonItem>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          ) : (
            <IonCard>
              <IonCardContent>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                  Status
                </h3>
                
                <div style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: request.status === 'approved' ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${request.status === 'approved' ? '#c3e6cb' : '#f5c6cb'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <IonIcon 
                      icon={request.status === 'approved' ? checkmarkCircleOutline : closeCircleOutline}
                      color={request.status === 'approved' ? 'success' : 'danger'}
                      style={{ fontSize: '1.5rem' }}
                    />
                    <div>
                      <p style={{ 
                        margin: '0 0 4px 0', 
                        fontWeight: '600',
                        color: request.status === 'approved' ? '#155724' : '#721c24'
                      }}>
                        {request.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                      </p>
                      {request.approved_by_name && (
                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.85rem',
                          color: request.status === 'approved' ? '#155724' : '#721c24'
                        }}>
                          von {request.approved_by_name}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {request.admin_comment && (
                    <p style={{ 
                      margin: '8px 0 0 0', 
                      fontStyle: 'italic',
                      color: request.status === 'approved' ? '#155724' : '#721c24'
                    }}>
                      "{request.admin_comment}"
                    </p>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

const AdminRequestsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-requests');
  const [presentAlert] = useIonAlert();
  
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('pending');

  const [presentDetailModal, dismissDetailModal] = useIonModal(RequestDetailModal, {
    request: selectedRequest,
    onClose: () => dismissDetailModal(),
    onApprove: handleApproveRequest,
    onReject: handleRejectRequest
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/activities/requests');
      setRequests(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Anträge');
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  async function handleApproveRequest(requestId: number, comment?: string) {
    try {
      await api.put(`/admin/activities/requests/${requestId}`, {
        status: 'approved',
        admin_comment: comment
      });
      
      setSuccess('Antrag genehmigt');
      dismissDetailModal();
      await loadRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Genehmigen des Antrags');
    }
  }

  async function handleRejectRequest(requestId: number, comment: string) {
    try {
      await api.put(`/admin/activities/requests/${requestId}`, {
        status: 'rejected',
        admin_comment: comment
      });
      
      setSuccess('Antrag abgelehnt');
      dismissDetailModal();
      await loadRequests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ablehnen des Antrags');
    }
  }

  const handleSelectRequest = (request: ActivityRequest) => {
    setSelectedRequest(request);
    presentDetailModal({
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
    return type === 'gottesdienst' ? homeOutline : peopleOutline;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return checkmarkOutline;
      case 'rejected': return closeOutline;
      case 'pending': return timeOutline;
      default: return timeOutline;
    }
  };

  const getFilteredRequests = () => {
    return requests.filter(request => request.status === selectedTab);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

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
            <IonTitle size="large" style={{ color: 'black' }}>
              Anträge
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
              background: 'linear-gradient(135deg, #2dd36f 0%, #1a8a4a 100%)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(45, 211, 111, 0.3)'
            }}>
              <IonCardContent>
                <IonGrid>
                  <IonRow>
                    <IonCol size="4">
                      <div style={{ textAlign: 'center' }}>
                        <IonIcon icon={timeOutline} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
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
                        <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
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
                        <IonIcon icon={closeCircleOutline} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
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

            {/* Tab Navigation */}
            <IonCard style={{ margin: '16px' }}>
              <IonCardContent style={{ padding: '16px' }}>
                <IonSegment 
                  value={selectedTab} 
                  onIonChange={(e) => setSelectedTab(e.detail.value as string)}
                  style={{ 
                    '--background': '#f8f9fa',
                    borderRadius: '8px',
                    padding: '4px'
                  }}
                >
                  <IonSegmentButton value="pending">
                    <IonIcon icon={timeOutline} style={{ fontSize: '1rem', marginRight: '4px' }} />
                    <IonLabel>Offen</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="approved">
                    <IonIcon icon={checkmarkOutline} style={{ fontSize: '1rem', marginRight: '4px' }} />
                    <IonLabel>Genehmigt</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="rejected">
                    <IonIcon icon={closeOutline} style={{ fontSize: '1rem', marginRight: '4px' }} />
                    <IonLabel>Abgelehnt</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
              </IonCardContent>
            </IonCard>

            {/* Anträge Liste */}
            <IonCard style={{ margin: '16px' }}>
              <IonCardContent style={{ padding: '8px 0' }}>
                <IonList lines="none" style={{ background: 'transparent' }}>
                  {getFilteredRequests().map((request) => (
                    <IonItem
                      key={request.id}
                      button
                      onClick={() => handleSelectRequest(request)}
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
                        {/* Header */}
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
                              backgroundColor: getStatusColor(request.status) === 'success' ? '#2dd36f' : 
                                               getStatusColor(request.status) === 'danger' ? '#eb445a' : '#ffc409',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={getStatusIcon(request.status)}
                                style={{
                                  fontSize: '1rem',
                                  color: 'white'
                                }}
                              />
                            </div>
                            <div>
                              <h2 style={{
                                fontWeight: '600',
                                fontSize: '1.1rem',
                                margin: '0 0 2px 0'
                              }}>
                                {request.activity_name}
                              </h2>
                              <p style={{
                                margin: '0',
                                fontSize: '0.85rem',
                                color: '#666'
                              }}>
                                {request.konfi_name}
                              </p>
                            </div>
                          </div>
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
                            <IonIcon icon={calendarOutline} style={{ fontSize: '0.9rem', color: '#007aff' }} />
                            <span>{formatDate(request.requested_date)}</span>
                          </div>
                          
                          <span style={{ color: '#6c757d' }}>•</span>
                          
                          <span style={{ color: '#007aff', fontWeight: '500' }}>
                            {request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}
                          </span>

                          <span style={{ color: '#6c757d' }}>•</span>
                          
                          <span style={{ 
                            color: request.photo_filename ? '#2dd36f' : '#eb445a', 
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            textDecoration: request.photo_filename ? 'none' : 'line-through'
                          }}>
                            <IonIcon 
                              icon={imageOutline} 
                              style={{ fontSize: '0.9rem' }} 
                            />
                            Foto
                          </span>
                        </div>

                        {/* Comment Preview */}
                        {request.comment && (
                          <p style={{
                            margin: '0',
                            fontSize: '0.85rem',
                            color: '#666',
                            fontStyle: 'italic',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            "{request.comment}"
                          </p>
                        )}
                      </IonLabel>
                    </IonItem>
                  ))}

                  {getFilteredRequests().length === 0 && (
                    <IonItem>
                      <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                        <p>
                          {selectedTab === 'pending' && 'Keine offenen Anträge'}
                          {selectedTab === 'approved' && 'Keine genehmigten Anträge'}
                          {selectedTab === 'rejected' && 'Keine abgelehnten Anträge'}
                        </p>
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

export default AdminRequestsPage;