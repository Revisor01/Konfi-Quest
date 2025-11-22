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
  IonButton,
  IonIcon,
  IonButtons,
  IonTextarea,
  IonImg,
  IonSegment,
  IonSegmentButton,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner,
  useIonModal
} from '@ionic/react';
import {
  arrowBack,
  document,
  trash,
  hourglass,
  checkmarkCircle,
  closeCircle,
  closeOutline,
  checkmarkOutline,
  calendarOutline,
  imageOutline,
  homeOutline,
  peopleOutline,
  create,
  chatbubbleEllipses
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
  const [submitting, setSubmitting] = useState(false);

  const formatDate = (dateString: string) => {
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

  const handleApprove = async () => {
    setSubmitting(true);
    await onApprove(request.id, comment);
    setSubmitting(false);
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) return;
    setSubmitting(true);
    await onReject(request.id, rejectComment);
    setSubmitting(false);
  };

  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const isRejected = request.status === 'rejected';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Antrag prüfen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={submitting}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          {isPending && (
            <IonButtons slot="end">
              <IonButton onClick={handleApprove} disabled={submitting}>
                {submitting ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <IonIcon icon={checkmarkOutline} />
                )}
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px', '--background': '#f8f9fa' }}>
        {/* SEKTION: Foto */}
        {request.photo_filename && (
          <>
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
                <IonIcon icon={imageOutline} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{
                fontWeight: '600',
                fontSize: '1.1rem',
                margin: '0',
                color: '#333'
              }}>
                Foto
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
                <IonImg
                  src={`https://konfi-quest.de/api/admin/activities/requests/${request.id}/photo`}
                  alt="Antragsfoto"
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    borderRadius: '12px'
                  }}
                />
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* SEKTION: Aktivität */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: getTypeColor(request.activity_type),
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={getTypeIcon(request.activity_type)} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Aktivität
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
            <IonList style={{ background: 'transparent' }}>
              {/* Aktivität mit Icon */}
              <IonItem lines="none" style={{
                '--background': '#f5f5f5',
                '--border-radius': '12px',
                '--padding-start': '16px',
                margin: '0 0 12px 0',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                '--min-height': '60px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: getTypeColor(request.activity_type),
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)',
                  marginRight: '12px',
                  flexShrink: 0
                }}>
                  <IonIcon
                    icon={getTypeIcon(request.activity_type)}
                    style={{ fontSize: '1.2rem', color: 'white' }}
                  />
                </div>
                <IonLabel>
                  <h2 style={{ fontWeight: '600', fontSize: '1rem', margin: '0 0 4px 0', color: '#333' }}>
                    {request.activity_name}
                  </h2>
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: '0' }}>
                    {getTypeName(request.activity_type)} • {request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}
                  </p>
                </IonLabel>
              </IonItem>

              {/* Konfi mit Initialen */}
              <IonItem lines="none" style={{
                '--background': '#f5f5f5',
                '--border-radius': '12px',
                '--padding-start': '16px',
                margin: '0 0 12px 0',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                '--min-height': '60px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#059669',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                  marginRight: '12px',
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
                <IonLabel>
                  <p style={{ color: '#666', fontSize: '0.75rem', margin: '0 0 2px 0' }}>Konfi</p>
                  <h3 style={{ margin: '0', fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>{request.konfi_name}</h3>
                </IonLabel>
              </IonItem>

              {/* Datum mit Icon */}
              <IonItem lines="none" style={{
                '--background': '#f5f5f5',
                '--border-radius': '12px',
                '--padding-start': '16px',
                margin: '0 0 12px 0',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                '--min-height': '60px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#059669',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                  marginRight: '12px',
                  flexShrink: 0
                }}>
                  <IonIcon icon={calendarOutline} style={{ fontSize: '1.2rem', color: 'white' }} />
                </div>
                <IonLabel>
                  <p style={{ color: '#666', fontSize: '0.75rem', margin: '0 0 2px 0' }}>Datum</p>
                  <h3 style={{ margin: '0', fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>{formatDate(request.requested_date)}</h3>
                </IonLabel>
              </IonItem>

              {/* Kommentar falls vorhanden */}
              {request.comment && (
                <IonItem lines="none" style={{
                  '--background': '#f5f5f5',
                  '--border-radius': '12px',
                  '--padding-start': '16px',
                  margin: '0',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  '--min-height': '60px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#059669',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
                    marginRight: '12px',
                    flexShrink: 0
                  }}>
                    <IonIcon icon={chatbubbleEllipses} style={{ fontSize: '1.2rem', color: 'white' }} />
                  </div>
                  <IonLabel>
                    <p style={{ color: '#666', fontSize: '0.75rem', margin: '0 0 2px 0' }}>Kommentar</p>
                    <h3 style={{ margin: '0', fontWeight: '500', fontSize: '0.9rem', color: '#333', whiteSpace: 'normal' }}>{request.comment}</h3>
                  </IonLabel>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Status */}
        {!isPending && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '16px 16px 12px 16px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: isApproved ? '#2dd36f' : '#dc3545',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)',
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
                  padding: '16px',
                  borderRadius: '12px',
                  background: isApproved
                    ? 'rgba(45, 211, 111, 0.1)'
                    : 'rgba(220, 53, 69, 0.1)',
                  border: `2px solid ${isApproved ? '#2dd36f' : '#dc3545'}`
                }}>
                  <h3 style={{ margin: '0 0 8px 0', color: isApproved ? '#2dd36f' : '#dc3545' }}>
                    {isApproved ? 'Genehmigt' : 'Abgelehnt'}
                  </h3>
                  {request.admin_comment && (
                    <p style={{ margin: '0', color: '#666' }}>
                      {request.admin_comment}
                    </p>
                  )}
                  {request.approved_by_name && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#999' }}>
                      von {request.approved_by_name}
                    </p>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          </>
        )}

        {/* SEKTION: Aktion (nur bei pending) */}
        {isPending && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '16px 16px 12px 16px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#3880ff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(56, 128, 255, 0.3)',
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
                Entscheidung
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
                {!showRejectForm ? (
                  <>
                    {/* Kommentar für Genehmigung */}
                    <IonList style={{ background: 'transparent', marginBottom: '16px' }}>
                      <IonItem lines="none" style={{
                        '--background': '#f5f5f5',
                        '--border-radius': '12px',
                        '--padding-start': '16px',
                        margin: '0',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}>
                        <IonLabel position="stacked" style={{ marginBottom: '8px', color: '#666' }}>Kommentar (optional)</IonLabel>
                        <IonTextarea
                          value={comment}
                          onIonInput={(e) => setComment(e.detail.value!)}
                          placeholder="Optionaler Kommentar..."
                          rows={3}
                          disabled={submitting}
                        />
                      </IonItem>
                    </IonList>

                    {/* Action Items */}
                    <IonList style={{ background: 'transparent' }}>
                      <IonItem
                        button
                        lines="none"
                        onClick={handleApprove}
                        disabled={submitting}
                        detail={false}
                        style={{
                          '--background': 'white',
                          '--background-hover': '#f0fdf4',
                          '--color': '#059669',
                          '--border-radius': '12px',
                          margin: '0 0 8px 0',
                          borderRadius: '12px',
                          '--min-height': '54px',
                          border: '2px solid #059669'
                        }}
                      >
                        <IonIcon icon={checkmarkCircle} slot="start" style={{ color: '#059669' }} />
                        <IonLabel style={{ fontWeight: '600', color: '#059669' }}>Genehmigen</IonLabel>
                        {submitting && <IonSpinner name="crescent" slot="end" style={{ color: '#059669' }} />}
                      </IonItem>

                      <IonItem
                        button
                        lines="none"
                        onClick={() => setShowRejectForm(true)}
                        disabled={submitting}
                        detail={false}
                        style={{
                          '--background': 'white',
                          '--background-hover': '#fef2f2',
                          '--color': '#dc3545',
                          '--border-radius': '12px',
                          margin: '0',
                          borderRadius: '12px',
                          '--min-height': '54px',
                          border: '2px solid #dc3545'
                        }}
                      >
                        <IonIcon icon={closeCircle} slot="start" style={{ color: '#dc3545' }} />
                        <IonLabel style={{ fontWeight: '600', color: '#dc3545' }}>Ablehnen</IonLabel>
                      </IonItem>
                    </IonList>
                  </>
                ) : (
                  <>
                    {/* Ablehnungsgrund */}
                    <IonList style={{ background: 'transparent', marginBottom: '16px' }}>
                      <IonItem lines="none" style={{
                        '--background': '#f5f5f5',
                        '--border-radius': '12px',
                        '--padding-start': '16px',
                        margin: '0',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}>
                        <IonLabel position="stacked" style={{ marginBottom: '8px', color: '#666' }}>Begründung für Ablehnung *</IonLabel>
                        <IonTextarea
                          value={rejectComment}
                          onIonInput={(e) => setRejectComment(e.detail.value!)}
                          placeholder="Bitte begründen Sie die Ablehnung..."
                          rows={4}
                          disabled={submitting}
                        />
                      </IonItem>
                    </IonList>

                    {/* Reject Action Items */}
                    <IonList style={{ background: 'transparent' }}>
                      <IonItem
                        button
                        lines="none"
                        onClick={handleReject}
                        disabled={!rejectComment.trim() || submitting}
                        detail={false}
                        style={{
                          '--background': 'white',
                          '--background-hover': '#fef2f2',
                          '--color': '#dc3545',
                          '--border-radius': '12px',
                          margin: '0 0 8px 0',
                          borderRadius: '12px',
                          '--min-height': '54px',
                          border: '2px solid #dc3545',
                          opacity: (!rejectComment.trim() || submitting) ? 0.5 : 1
                        }}
                      >
                        <IonIcon icon={closeCircle} slot="start" style={{ color: '#dc3545' }} />
                        <IonLabel style={{ fontWeight: '600', color: '#dc3545' }}>Ablehnen bestätigen</IonLabel>
                        {submitting && <IonSpinner name="crescent" slot="end" style={{ color: '#dc3545' }} />}
                      </IonItem>

                      <IonItem
                        button
                        lines="none"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectComment('');
                        }}
                        disabled={submitting}
                        detail={false}
                        style={{
                          '--background': 'white',
                          '--background-hover': '#f5f5f5',
                          '--color': '#666',
                          '--border-radius': '12px',
                          margin: '0',
                          borderRadius: '12px',
                          border: '2px solid #e0e0e0',
                          '--min-height': '54px'
                        }}
                      >
                        <IonIcon icon={closeOutline} slot="start" style={{ color: '#666' }} />
                        <IonLabel style={{ fontWeight: '600', color: '#666' }}>Abbrechen</IonLabel>
                      </IonItem>
                    </IonList>
                  </>
                )}
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

const AdminRequestsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-requests');
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
            {/* Header - Dashboard-Style mit 3 Statistik-Items */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              borderRadius: '24px',
              padding: '0',
              margin: '16px',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(5, 150, 105, 0.3)',
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

              {/* Content - 3 Statistik-Items */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '70px 24px 24px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <IonGrid style={{ padding: '0', margin: '0 4px' }}>
                  <IonRow>
                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={hourglass}
                          style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            marginBottom: '8px',
                            display: 'block',
                            margin: '0 auto 8px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                          {pendingRequests.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                          Offen
                        </div>
                      </div>
                    </IonCol>

                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={checkmarkCircle}
                          style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            marginBottom: '8px',
                            display: 'block',
                            margin: '0 auto 8px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                          {approvedRequests.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                          Genehmigt
                        </div>
                      </div>
                    </IonCol>

                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={closeCircle}
                          style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            marginBottom: '8px',
                            display: 'block',
                            margin: '0 auto 8px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                          {rejectedRequests.length}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                          Abgelehnt
                        </div>
                      </div>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </div>
            </div>

            {/* Tab Navigation - Einzeilig ohne Icons */}
            <IonCard style={{ margin: '16px' }}>
              <IonCardContent style={{ padding: '8px' }}>
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
                    <IonLabel style={{ fontSize: '0.75rem', fontWeight: '600' }}>Offen</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="approved">
                    <IonLabel style={{ fontSize: '0.75rem', fontWeight: '600' }}>Genehmigt</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="rejected">
                    <IonLabel style={{ fontSize: '0.75rem', fontWeight: '600' }}>Abgelehnt</IonLabel>
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
                                gap: '12px'
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

                                  {/* Aktivität */}
                                  <p style={{
                                    margin: '0 0 2px 0',
                                    fontSize: '0.85rem',
                                    color: '#555',
                                    fontWeight: '500'
                                  }}>
                                    {request.activity_name}
                                  </p>

                                  {/* Details */}
                                  <p style={{
                                    margin: '0',
                                    fontSize: '0.75rem',
                                    color: '#999'
                                  }}>
                                    {formatDate(request.requested_date)} • {request.activity_points} P
                                    {request.comment && ' • Kommentar'}
                                  </p>
                                </div>

                                {/* Foto Badge */}
                                {request.photo_filename && (
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    backgroundColor: '#2dd36f',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)',
                                    flexShrink: 0
                                  }}>
                                    <IonIcon
                                      icon={imageOutline}
                                      style={{ fontSize: '1rem', color: 'white' }}
                                    />
                                  </div>
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
