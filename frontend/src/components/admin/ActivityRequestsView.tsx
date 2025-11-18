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
  IonSearchbar
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
  chatbubbleEllipses
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';

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

  const filteredAndSortedRequests = (() => {
    let result = filterBySearchTerm(requests, searchTerm, ['konfi_name', 'activity_name', 'comment']);

    // Sort: pending first, then by created_at (newest first)
    result = result.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
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

  return (
    <>
      {/* Header Gradient - Aktivitäten-Grün */}
      <div style={{
        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(22, 163, 74, 0.3)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '32px 24px 24px 24px',
          background: 'radial-gradient(circle at top right, rgba(255,255,255,0.15) 0%, transparent 70%)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px'
          }}>
            <div>
              <h1 style={{
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: '700',
                color: 'white',
                margin: '0 0 4px 0',
                letterSpacing: '-0.02em'
              }}>
                Anträge
              </h1>
              <p style={{
                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                color: 'rgba(255, 255, 255, 0.85)',
                margin: '0'
              }}>
                Aktivitäten-Anträge verwalten
              </p>
            </div>
          </div>

          {/* Statistiken */}
          <IonGrid style={{ padding: '0' }}>
            <IonRow>
              <IonCol size="4">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <IonIcon icon={document} style={{
                    fontSize: '1.8rem',
                    color: 'white',
                    display: 'block',
                    margin: '0 auto 8px'
                  }} />
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: 'white',
                    lineHeight: '1',
                    marginBottom: '4px'
                  }}>
                    {requests.length}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: '500'
                  }}>
                    Gesamt
                  </div>
                </div>
              </IonCol>

              <IonCol size="4">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <IonIcon icon={hourglass} style={{
                    fontSize: '1.8rem',
                    color: 'white',
                    display: 'block',
                    margin: '0 auto 8px'
                  }} />
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: 'white',
                    lineHeight: '1',
                    marginBottom: '4px'
                  }}>
                    {getPendingCount()}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: '500'
                  }}>
                    Offen
                  </div>
                </div>
              </IonCol>

              <IonCol size="4">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <IonIcon icon={checkmarkCircle} style={{
                    fontSize: '1.8rem',
                    color: 'white',
                    display: 'block',
                    margin: '0 auto 8px'
                  }} />
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    color: 'white',
                    lineHeight: '1',
                    marginBottom: '4px'
                  }}>
                    {getApprovedCount()}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: '500'
                  }}>
                    Genehmigt
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
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
                        '--min-height': '110px',
                        '--padding-start': '16px',
                        '--padding-top': '0px',
                        '--padding-bottom': '0px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '4px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        opacity: (isApproved || isRejected) ? 0.6 : 1
                      }}
                    >
                      <IonLabel>
                        {/* ZEILE 1: Header mit Icon und Status Badge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '6px'
                        }}>
                          {/* 32px Status Icon */}
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

                          {/* Konfi Name */}
                          <h2 style={{
                            fontWeight: '600',
                            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
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
                          </h2>

                          {/* Status Badge */}
                          <div style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                            flexShrink: 0
                          }}>
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
                        </div>

                        {/* ZEILE 2: Aktivitäts-Name und Datum */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          color: '#666',
                          marginBottom: '4px'
                        }}>
                          <IonIcon icon={document} style={{ fontSize: '0.9rem', color: '#2dd36f' }} />
                          <span style={{ fontWeight: '500', color: '#333' }}>{request.activity_name}</span>
                          <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: '#dc2626', marginLeft: '8px' }} />
                          <span>{formatDate(request.requested_date)}</span>
                        </div>

                        {/* ZEILE 3: Zusatzinfos */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '0.8rem',
                          color: '#666'
                        }}>
                          {request.jahrgang_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IonIcon icon={person} style={{ fontSize: '0.8rem', color: '#8b5cf6' }} />
                              <span>{request.jahrgang_name}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={time} style={{ fontSize: '0.8rem', color: '#ff6b35' }} />
                            <span>{formatDate(request.created_at)} {formatTime(request.created_at)}</span>
                          </div>
                          {request.comment && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IonIcon icon={chatbubbleEllipses} style={{ fontSize: '0.8rem', color: '#007aff' }} />
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
