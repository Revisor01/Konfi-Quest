import React, { useState, useEffect, useRef } from 'react';
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
  IonTextarea,
  IonInput,
  IonImg,
  IonSegment,
  IonSegmentButton,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
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
  checkmarkOutline,
  arrowBack,
  document,
  trash,
  hourglass,
  checkmarkCircle,
  closeCircle
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

  const getTypeName = (type: string) => {
    return type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeindeaktivität';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Antrag Details</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: '16px' }}>
          {/* Foto (falls vorhanden) */}
          {request.photo_filename && (
            <IonCard style={{ marginBottom: '16px' }}>
              <IonImg
                src={`https://konfi-points.de/api/activity-requests/${request.id}/photo`}
                alt="Antragsfoto"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </IonCard>
          )}

          {/* Aktivität Info */}
          <IonCard>
            <IonCardContent>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <IonIcon
                  icon={getTypeIcon(request.activity_type)}
                  style={{ fontSize: '2rem', color: '#007aff' }}
                />
                <div>
                  <h2 style={{ margin: '0', fontSize: '1.2rem' }}>
                    {request.activity_name}
                  </h2>
                  <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
                    {getTypeName(request.activity_type)}
                  </p>
                </div>
              </div>

              <IonList lines="none">
                <IonItem>
                  <IonIcon icon={personOutline} slot="start" />
                  <IonLabel>
                    <p>Konfi</p>
                    <h3>{request.konfi_name}</h3>
                  </IonLabel>
                </IonItem>

                <IonItem>
                  <IonIcon icon={calendarOutline} slot="start" />
                  <IonLabel>
                    <p>Datum</p>
                    <h3>{formatRequestedDate(request.requested_date)}</h3>
                  </IonLabel>
                </IonItem>

                <IonItem>
                  <IonIcon icon={documentTextOutline} slot="start" />
                  <IonLabel>
                    <p>Punkte</p>
                    <h3>{request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}</h3>
                  </IonLabel>
                </IonItem>

                {request.comment && (
                  <IonItem>
                    <IonIcon icon={documentTextOutline} slot="start" />
                    <IonLabel>
                      <p>Kommentar</p>
                      <h3 style={{ whiteSpace: 'normal' }}>{request.comment}</h3>
                    </IonLabel>
                  </IonItem>
                )}
              </IonList>
            </IonCardContent>
          </IonCard>

          {/* Aktionen (nur bei pending) */}
          {request.status === 'pending' && (
            <>
              {!showRejectForm ? (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <IonButton
                    expand="block"
                    color="success"
                    onClick={() => onApprove(request.id, comment)}
                    style={{ flex: 1 }}
                  >
                    <IonIcon icon={checkmarkCircleOutline} slot="start" />
                    Genehmigen
                  </IonButton>

                  <IonButton
                    expand="block"
                    color="danger"
                    onClick={() => setShowRejectForm(true)}
                    style={{ flex: 1 }}
                  >
                    <IonIcon icon={closeCircleOutline} slot="start" />
                    Ablehnen
                  </IonButton>
                </div>
              ) : (
                <IonCard style={{ marginTop: '16px' }}>
                  <IonCardContent>
                    <h3 style={{ margin: '0 0 12px 0' }}>Begründung für Ablehnung</h3>
                    <IonTextarea
                      value={rejectComment}
                      onIonInput={(e) => setRejectComment(e.detail.value!)}
                      placeholder="Bitte begründen Sie die Ablehnung..."
                      rows={4}
                      style={{
                        '--background': '#f8f9fa',
                        '--border-radius': '12px'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <IonButton
                        expand="block"
                        color="danger"
                        onClick={() => onReject(request.id, rejectComment)}
                        disabled={!rejectComment.trim()}
                        style={{ flex: 1 }}
                      >
                        Ablehnen bestätigen
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectComment('');
                        }}
                        style={{ flex: 1 }}
                      >
                        Abbrechen
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

              {/* Optional: Kommentar für Genehmigung */}
              <IonCard style={{ marginTop: '16px' }}>
                <IonCardContent>
                  <h3 style={{ margin: '0 0 12px 0' }}>Kommentar (optional)</h3>
                  <IonTextarea
                    value={comment}
                    onIonInput={(e) => setComment(e.detail.value!)}
                    placeholder="Optionaler Kommentar zur Genehmigung..."
                    rows={3}
                    style={{
                      '--background': '#f8f9fa',
                      '--border-radius': '12px'
                    }}
                  />
                </IonCardContent>
              </IonCard>
            </>
          )}

          {/* Status-Info (bei approved/rejected) */}
          {request.status !== 'pending' && (
            <IonCard style={{ marginTop: '16px' }}>
              <IonCardContent>
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: request.status === 'approved'
                    ? 'rgba(45, 211, 111, 0.1)'
                    : 'rgba(235, 68, 90, 0.1)',
                  border: `2px solid ${request.status === 'approved' ? '#2dd36f' : '#eb445a'}`
                }}>
                  <IonIcon
                    icon={request.status === 'approved' ? checkmarkCircleOutline : closeCircleOutline}
                    style={{
                      fontSize: '2rem',
                      color: request.status === 'approved' ? '#2dd36f' : '#eb445a',
                      marginBottom: '8px'
                    }}
                  />
                  <h3 style={{ margin: '0 0 8px 0' }}>
                    {request.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                  </h3>
                  {request.admin_comment && (
                    <p style={{ margin: '0', color: '#666' }}>
                      {request.admin_comment}
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
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

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

  const handleDeleteRequest = async (request: ActivityRequest) => {
    if (!confirm(`Antrag von "${request.konfi_name}" wirklich löschen?`)) return;

    const slidingElement = slidingRefs.current.get(request.id);

    try {
      await api.delete(`/activity-requests/${request.id}`);
      setSuccess('Antrag gelöscht');
      await loadRequests();
    } catch (error: any) {
      if (slidingElement) {
        await slidingElement.close();
      }
      const errorMessage = error.response?.data?.error || 'Fehler beim Löschen des Antrags';
      alert(errorMessage);
    }
  };

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
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Anträge</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Anträge</IonTitle>
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
            {/* Header - Dashboard-Style */}
            <div style={{
              background: 'linear-gradient(135deg, #2dd36f 0%, #28ba62 100%)',
              borderRadius: '24px',
              padding: '0',
              margin: '16px',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(45, 211, 111, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '12px',
                zIndex: 1
              }}>
                <h2 style={{
                  fontSize: '4rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.1)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  ANTRÄGE
                </h2>
              </div>

              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '70px 24px 24px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 32px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={document}
                      style={{
                        fontSize: '2rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '8px',
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }}
                    />
                    <div style={{ fontSize: '2rem', fontWeight: '800' }}>
                      {pendingRequests.length}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                      Offen
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
                {getFilteredRequests().length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    <IonIcon
                      icon={document}
                      style={{
                        fontSize: '3rem',
                        color: '#2dd36f',
                        marginBottom: '16px',
                        display: 'block',
                        margin: '0 auto 16px auto'
                      }}
                    />
                    <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>
                      {selectedTab === 'pending' && 'Keine offenen Anträge'}
                      {selectedTab === 'approved' && 'Keine genehmigten Anträge'}
                      {selectedTab === 'rejected' && 'Keine abgelehnten Anträge'}
                    </h3>
                  </div>
                ) : (
                  <IonList lines="none" style={{ background: 'transparent' }}>
                    {getFilteredRequests().map((request) => {
                      const isPending = request.status === 'pending';
                      const isApproved = request.status === 'approved';
                      const isRejected = request.status === 'rejected';

                      return (
                        <IonItemSliding
                          key={request.id}
                          ref={(el) => {
                            if (el) {
                              slidingRefs.current.set(request.id, el);
                            } else {
                              slidingRefs.current.delete(request.id);
                            }
                          }}
                        >
                          <IonItem
                            button
                            onClick={() => handleSelectRequest(request)}
                            detail={false}
                            style={{
                              '--min-height': '90px',
                              '--padding-start': '16px',
                              '--background': '#f5f5f5',
                              '--border-radius': '12px',
                              margin: '6px 8px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                              border: '1px solid #e0e0e0',
                              borderRadius: '12px',
                              opacity: (isApproved || isRejected) ? 0.6 : 1
                            }}
                          >
                            <IonLabel>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '4px'
                              }}>
                                {/* Status Icon Circle */}
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  backgroundColor: isPending ? '#ff9500' : isApproved ? '#2dd36f' : '#dc3545',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 8px rgba(155, 89, 182, 0.3)'
                                }}>
                                  <IonIcon
                                    icon={isPending ? hourglass : isApproved ? checkmarkCircle : closeCircle}
                                    style={{ fontSize: '1.2rem', color: 'white' }}
                                  />
                                </div>

                                <div style={{ flex: 1 }}>
                                  {/* Konfi Name */}
                                  <h2 style={{
                                    fontWeight: '600',
                                    fontSize: '0.95rem',
                                    margin: '0 0 4px 0',
                                    color: '#333'
                                  }}>
                                    {request.konfi_name}
                                  </h2>

                                  {/* Details */}
                                  <p style={{
                                    margin: '0',
                                    fontSize: '0.8rem',
                                    color: '#666'
                                  }}>
                                    {request.activity_name} • {formatDate(request.requested_date)} • {request.activity_points} P
                                  </p>
                                </div>

                                {/* Foto Badge */}
                                {request.photo_filename && (
                                  <IonIcon
                                    icon={imageOutline}
                                    style={{ fontSize: '1.2rem', color: '#2dd36f' }}
                                  />
                                )}
                              </div>
                            </IonLabel>
                          </IonItem>

                          {/* Swipe Actions */}
                          <IonItemOptions side="end" style={{
                            gap: '4px',
                            '--ion-item-background': 'transparent'
                          }}>
                            <IonItemOption
                              onClick={() => handleDeleteRequest(request)}
                              style={{
                                '--background': 'transparent',
                                '--background-activated': 'transparent',
                                '--background-focused': 'transparent',
                                '--background-hover': 'transparent',
                                '--color': 'transparent',
                                '--ripple-color': 'transparent',
                                padding: '0 8px',
                                paddingRight: '20px',
                                minWidth: '56px',
                                maxWidth: '56px'
                              }}
                            >
                              <div style={{
                                width: '44px',
                                height: '44px',
                                backgroundColor: '#dc3545',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                              }}>
                                <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                              </div>
                            </IonItemOption>
                          </IonItemOptions>
                        </IonItemSliding>
                      );
                    })}
                  </IonList>
                )}
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminRequestsPage;
