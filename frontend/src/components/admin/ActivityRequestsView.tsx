import React, { useState } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSearchbar,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  checkmarkCircle,
  closeCircle,
  trash,
  hourglass,
  document,
  time,
  person,
  calendar,
  chatbubbleEllipses,
  home,
  people
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';

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

interface ActivityRequestsViewProps {
  requests: ActivityRequest[];
  onUpdate: () => void;
  onSelectRequest: (request: ActivityRequest) => void;
  onDeleteRequest: (request: ActivityRequest) => void;
}

const ActivityRequestsView: React.FC<ActivityRequestsViewProps> = ({
  requests,
  onUpdate,
  onSelectRequest,
  onDeleteRequest
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const filteredAndSortedRequests = (() => {
    let result = filterBySearchTerm(requests, searchTerm, ['konfi_name', 'activity_name', 'comment']);

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Sort by created_at (newest first)
    result = result.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  })();

  const getPendingCount = () => requests.filter(r => r.status === 'pending').length;
  const getApprovedCount = () => requests.filter(r => r.status === 'approved').length;
  const getRejectedCount = () => requests.filter(r => r.status === 'rejected').length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
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

  return (
    <>
      {/* Header - Dashboard-Style */}
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
          top: '-10px',
          left: '20px',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: '4rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.9',
            letterSpacing: '-0.02em'
          }}>
            ANTRÄGE
          </h2>
        </div>

        {/* Content - 3 Statistiken */}
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
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              color: 'white',
              textAlign: 'center'
            }}>
              <IonIcon
                icon={hourglass}
                style={{
                  fontSize: '1.5rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  display: 'block',
                  margin: '0 auto 8px auto'
                }}
              />
              <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                {getPendingCount()}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Offen
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              color: 'white',
              textAlign: 'center'
            }}>
              <IonIcon
                icon={checkmarkCircle}
                style={{
                  fontSize: '1.5rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  display: 'block',
                  margin: '0 auto 8px auto'
                }}
              />
              <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                {getApprovedCount()}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Genehmigt
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              color: 'white',
              textAlign: 'center'
            }}>
              <IonIcon
                icon={closeCircle}
                style={{
                  fontSize: '1.5rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  display: 'block',
                  margin: '0 auto 8px auto'
                }}
              />
              <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                {getRejectedCount()}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Abgelehnt
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suchfeld */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonSearchbar
            value={searchTerm}
            onIonInput={(e) => setSearchTerm(e.detail.value!)}
            placeholder="Antrag suchen..."
            style={{
              '--background': '#f8f9fa',
              '--border-radius': '12px',
              '--placeholder-color': '#999',
              padding: '0'
            }}
          />
        </IonCardContent>
      </IonCard>

      {/* Tab-Leiste */}
      <IonCard style={{ margin: '16px', marginTop: '0' }}>
        <IonCardContent style={{ padding: '12px' }}>
          <IonSegment
            value={statusFilter}
            onIonChange={(e) => setStatusFilter(e.detail.value as any)}
            mode="md"
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
          {filteredAndSortedRequests.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#666'
            }}>
              <IonIcon
                icon={document}
                style={{
                  fontSize: '3rem',
                  opacity: 0.3,
                  marginBottom: '16px'
                }}
              />
              <p style={{ margin: '0', fontSize: '1rem' }}>
                {searchTerm ? 'Keine Anträge gefunden' : 'Noch keine Anträge'}
              </p>
            </div>
          ) : (
            <IonList lines="none" style={{ background: 'transparent' }}>
              {filteredAndSortedRequests.map((request) => {
                const isPending = request.status === 'pending';
                const isApproved = request.status === 'approved';
                const isRejected = request.status === 'rejected';

                return (
                  <IonItemSliding key={request.id}>
                    <IonItem
                      button
                      onClick={() => onSelectRequest(request)}
                      detail={false}
                      style={{
                        '--min-height': '90px',
                        '--padding-start': '16px',
                        '--padding-top': '0px',
                        '--padding-bottom': '0px',
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
                            width: '28px',
                            height: '28px',
                            backgroundColor: isPending ? '#ff9500' : isApproved ? '#2dd36f' : '#dc3545',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: isPending
                              ? '0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                              : isApproved
                              ? '0 2px 8px rgba(45, 211, 111, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                              : '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                          }}>
                            <IonIcon
                              icon={isPending ? hourglass : isApproved ? checkmarkCircle : closeCircle}
                              style={{ fontSize: '0.9rem', color: 'white' }}
                            />
                          </div>

                          {/* Konfi Name */}
                          <h3 style={{
                            fontWeight: '600',
                            fontSize: '1rem',
                            margin: '0',
                            color: '#333',
                            lineHeight: '1.3',
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {request.konfi_name}
                          </h3>

                          {/* Status Badge */}
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
                            borderRadius: '10px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                          }}>
                            {isPending ? 'OFFEN' : isApproved ? 'OK' : 'ABG'}
                          </span>
                        </div>

                        {/* Details - zweite Zeile */}
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: '40px'
                        }}>
                          <span>{request.activity_name}</span>
                          {request.activity_points && (
                            <>
                              <span>•</span>
                              <span style={{ fontWeight: '600', color: '#333' }}>
                                {request.activity_points} {request.activity_points === 1 ? 'Punkt' : 'Punkte'}
                              </span>
                            </>
                          )}
                          {request.jahrgang_name && (
                            <>
                              <span>•</span>
                              <span>{request.jahrgang_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatDate(request.requested_date)}</span>
                        </div>
                      </IonLabel>
                    </IonItem>

                    {/* Swipe Actions */}
                    <IonItemOptions side="end" style={{
                      gap: '4px',
                      '--ion-item-background': 'transparent'
                    }}>
                      <IonItemOption
                        onClick={() => onDeleteRequest(request)}
                        style={{
                          '--background': 'transparent',
                          '--background-activated': 'transparent',
                          '--background-focused': 'transparent',
                          '--background-hover': 'transparent',
                          '--color': 'transparent',
                          '--ripple-color': 'transparent',
                          padding: '0 2px',
                          paddingRight: '20px',
                          minWidth: '48px',
                          maxWidth: '68px'
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
  );
};

export default ActivityRequestsView;
