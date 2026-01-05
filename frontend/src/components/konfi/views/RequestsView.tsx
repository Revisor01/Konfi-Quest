import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  hourglass,
  checkmarkCircle,
  closeCircle,
  calendar,
  home,
  people,
  trash,
  trophy,
  camera,
  documentTextOutline
} from 'ionicons/icons';

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

interface RequestsViewProps {
  requests: ActivityRequest[];
  onDeleteRequest?: (request: ActivityRequest) => void;
  onSelectRequest?: (request: ActivityRequest) => void;
  activeTab: 'all' | 'pending' | 'approved' | 'rejected';
  onTabChange: (tab: 'all' | 'pending' | 'approved' | 'rejected') => void;
  formatDate: (dateString: string) => string;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  getTypeIcon: (type: string) => string;
  getTypeText: (type: string) => string;
}

const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  onDeleteRequest,
  onSelectRequest,
  activeTab,
  onTabChange,
  formatDate,
  getStatusColor,
  getStatusText,
  getTypeIcon,
  getTypeText
}) => {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  return (
    <div>
      {/* Anträge Header - Neues kompaktes Design */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: '20px',
        padding: '24px',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dekorative Kreise im Hintergrund */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-20px',
          left: '-20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)'
        }} />

        {/* Header mit Icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IonIcon icon={checkmarkCircle} style={{ fontSize: '1.6rem', color: 'white' }} />
          </div>
          <div>
            <h2 style={{
              margin: '0',
              fontSize: '1.4rem',
              fontWeight: '700',
              color: 'white'
            }}>
              Deine Aktivitäten
            </h2>
            <p style={{
              margin: '2px 0 0 0',
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              Anträge und Verbuchungen
            </p>
          </div>
        </div>

        {/* Stats Row - immer einzeilig */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'center',
            flex: '1 1 0',
            maxWidth: '100px'
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
              {pendingRequests.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
              OFFEN
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'center',
            flex: '1 1 0',
            maxWidth: '100px'
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
              {approvedRequests.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
              VERBUCHT
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'center',
            flex: '1 1 0',
            maxWidth: '100px'
          }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
              {rejectedRequests.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
              ABGELEHNT
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - wie Admin */}
      <div style={{ margin: '16px' }}>
        <IonSegment
          value={activeTab}
          onIonChange={(e) => onTabChange(e.detail.value as any)}
        >
          <IonSegmentButton value="all">
            <IonLabel>Alle</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="pending">
            <IonLabel>Offen</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="approved">
            <IonLabel>Verbucht</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="rejected">
            <IonLabel>Abgelehnt</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {/* Antraege Liste - Admin Design */}
      <IonCard className="app-card" style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <IonIcon
                icon={documentTextOutline}
                style={{
                  fontSize: '3rem',
                  color: '#28a745',
                  marginBottom: '16px',
                  display: 'block',
                  margin: '0 auto 16px auto'
                }}
              />
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Anträge gefunden</h3>
              <p style={{ color: '#999', margin: '0' }}>
                Noch keine Anträge gestellt
              </p>
            </div>
          ) : (
            <IonList lines="none" style={{ background: 'transparent' }}>
              {requests.map((request) => {
                const isPending = request.status === 'pending';
                const isApproved = request.status === 'approved';
                const isRejected = request.status === 'rejected';

                return (
                  <IonItemSliding key={request.id}>
                    <IonItem
                      button
                      onClick={() => onSelectRequest?.(request)}
                      detail={false}
                      style={{
                        '--min-height': '90px',
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
                        {/* Header mit Icon und Status Badge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '6px'
                        }}>
                          {/* Status Icon Kreis */}
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
                              style={{
                                fontSize: '1rem',
                                color: 'white'
                              }}
                            />
                          </div>

                          {/* Name gross */}
                          <h2 style={{
                            fontWeight: '600',
                            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                            margin: '0',
                            color: (isApproved || isRejected) ? '#999' : '#333',
                            lineHeight: '1.3',
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {request.activity_name}
                          </h2>

                          {/* Status Badge rechts oben */}
                          <div style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                            flexShrink: 0
                          }}>
                            <span style={{
                              fontSize: '0.7rem',
                              color: isPending ? '#ff9500' : isApproved ? '#047857' : '#dc3545',
                              fontWeight: '600',
                              backgroundColor: isPending
                                ? 'rgba(255, 149, 0, 0.15)'
                                : isApproved
                                ? 'rgba(4, 120, 87, 0.15)'
                                : 'rgba(220, 38, 38, 0.15)',
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: isPending
                                ? '1px solid rgba(255, 149, 0, 0.3)'
                                : isApproved
                                ? '1px solid rgba(4, 120, 87, 0.3)'
                                : '1px solid rgba(220, 38, 38, 0.3)',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                            }}>
                              {isPending ? 'OFFEN' : isApproved ? 'VERBUCHT' : 'ABGELEHNT'}
                            </span>
                          </div>
                        </div>

                        {/* Zweite Zeile: Datum, Punkte, Typ - MIT marginLeft */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '0.8rem',
                          color: (isApproved || isRejected) ? '#999' : '#666',
                          marginLeft: '44px',
                          marginBottom: '4px'
                        }}>
                          {/* Datum */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <IonIcon
                              icon={calendar}
                              style={{ fontSize: '0.8rem', color: (isApproved || isRejected) ? '#999' : '#dc2626' }}
                            />
                            <span>{formatDate(request.requested_date)}</span>
                          </div>

                          {/* Punkte */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <IonIcon
                              icon={trophy}
                              style={{ fontSize: '0.8rem', color: (isApproved || isRejected) ? '#999' : '#ff9500' }}
                            />
                            <span style={{ fontWeight: '500' }}>{request.activity_points}P</span>
                          </div>

                          {/* Typ */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <IonIcon
                              icon={request.activity_type === 'gottesdienst' ? home : people}
                              style={{
                                fontSize: '0.8rem',
                                color: (isApproved || isRejected) ? '#999' : request.activity_type === 'gottesdienst' ? '#007aff' : '#155724'
                              }}
                            />
                            <span>{request.activity_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}</span>
                          </div>

                          {/* Foto-Indikator */}
                          {request.photo_filename && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <IonIcon
                                icon={camera}
                                style={{ fontSize: '0.8rem', color: (isApproved || isRejected) ? '#999' : '#7045f6' }}
                              />
                              <span>Foto</span>
                            </div>
                          )}
                        </div>

                        {/* Dritte Zeile: Anmerkung - MIT marginLeft */}
                        {request.comment && (
                          <div style={{
                            fontSize: '0.8rem',
                            color: (isApproved || isRejected) ? '#999' : '#666',
                            marginLeft: '44px',
                            fontStyle: 'italic',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            "{request.comment}"
                          </div>
                        )}

                        {/* Ablehnungsgrund bei rejected */}
                        {isRejected && request.admin_comment && (
                          <div style={{
                            marginLeft: '44px',
                            marginTop: '6px',
                            padding: '8px 12px',
                            backgroundColor: 'rgba(220, 53, 69, 0.1)',
                            borderRadius: '8px',
                            border: '1px solid rgba(220, 53, 69, 0.2)'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px'
                            }}>
                              <IonIcon
                                icon={closeCircle}
                                style={{
                                  fontSize: '1rem',
                                  color: '#dc3545',
                                  flexShrink: 0,
                                  marginTop: '2px'
                                }}
                              />
                              <div>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  color: '#dc3545',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Grund der Ablehnung
                                </span>
                                <p style={{
                                  margin: '2px 0 0 0',
                                  fontSize: '0.8rem',
                                  color: '#666',
                                  lineHeight: '1.4'
                                }}>
                                  {request.admin_comment}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </IonLabel>
                    </IonItem>

                    {/* Swipe Actions */}
                    <IonItemOptions side="end" style={{
                      gap: '4px',
                      '--ion-item-background': 'transparent'
                    }}>
                      {/* Löschen-Button für pending */}
                      {isPending && onDeleteRequest && (
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
                      )}
                    </IonItemOptions>
                  </IonItemSliding>
                );
              })}
            </IonList>
          )}
        </IonCardContent>
      </IonCard>

    </div>
  );
};

export default RequestsView;