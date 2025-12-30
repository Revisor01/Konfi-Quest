import React, { useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  checkmarkCircle,
  closeCircle,
  trash,
  hourglass,
  documentOutline,
  calendar,
  home,
  people,
  trophy,
  returnUpBack
} from 'ionicons/icons';

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

interface ActivityRequestsViewProps {
  requests: ActivityRequest[];
  onUpdate: () => void;
  onSelectRequest: (request: ActivityRequest) => void;
  onDeleteRequest: (request: ActivityRequest) => void;
  onResetRequest: (request: ActivityRequest) => void;
}

const ActivityRequestsView: React.FC<ActivityRequestsViewProps> = ({
  requests,
  onUpdate,
  onSelectRequest,
  onDeleteRequest,
  onResetRequest
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const filteredAndSortedRequests = (() => {
    let result = [...requests];

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

  const getTypeIcon = (type: string) => {
    return type === 'gottesdienst' ? home : people;
  };

  const getTypeColor = (type: string) => {
    return type === 'gottesdienst' ? '#007aff' : '#155724';
  };

  return (
    <>
      {/* Header - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #1e7b34 0%, #155724 100%)',
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
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Tab Filter - wie bei Events */}
      <div style={{ margin: '16px' }}>
        <IonSegment
          value={statusFilter}
          onIonChange={(e) => setStatusFilter(e.detail.value as any)}
        >
          <IonSegmentButton value="pending">
            <IonLabel>Offen</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="approved">
            <IonLabel>Genehmigt</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="rejected">
            <IonLabel>Abgelehnt</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {/* Anträge Liste - iOS26 Pattern */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--success">
            <IonIcon icon={documentOutline} />
          </div>
          <IonLabel>Anträge ({filteredAndSortedRequests.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            {filteredAndSortedRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={documentOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#155724',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Anträge vorhanden</h3>
                <p style={{ color: '#999', margin: '0' }}>Konfirmand:innen können Aktivitäten beantragen</p>
              </div>
            ) : (
              <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                {filteredAndSortedRequests.map((request, index) => {
                  const isPending = request.status === 'pending';
                  const isApproved = request.status === 'approved';
                  const isRejected = request.status === 'rejected';

                  // Status-Farbe und Text
                  const statusColor = isPending ? '#ff9500' : isApproved ? '#155724' : '#dc3545';
                  const statusText = isPending ? 'Offen' : isApproved ? 'Genehmigt' : 'Abgelehnt';

                  return (
                    <IonItemSliding key={request.id} style={{ marginBottom: index < filteredAndSortedRequests.length - 1 ? '8px' : '0' }}>
                      <IonItem
                        button
                        onClick={() => onSelectRequest(request)}
                        detail={false}
                        lines="none"
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          '--inner-padding-end': '0',
                          '--inner-border-width': '0',
                          '--border-style': 'none',
                          '--min-height': 'auto'
                        }}
                      >
                        <div
                          className="app-list-item app-list-item--success"
                          style={{
                            width: '100%',
                            borderLeftColor: statusColor,
                            opacity: (isApproved || isRejected) ? 0.7 : 1,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Eselsohr-Style Corner Badge */}
                          <div
                            className="app-corner-badge"
                            style={{ backgroundColor: statusColor }}
                          >
                            {statusText}
                          </div>
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              {/* Status Icon */}
                              <div
                                className="app-icon-circle app-icon-circle--lg"
                                style={{ backgroundColor: statusColor }}
                              >
                                <IonIcon icon={isPending ? hourglass : isApproved ? checkmarkCircle : closeCircle} />
                              </div>

                              {/* Content */}
                              <div className="app-list-item__content">
                                {/* Zeile 1: Konfi-Name */}
                                <div
                                  className="app-list-item__title"
                                  style={{
                                    color: (isApproved || isRejected) ? '#999' : undefined,
                                    paddingRight: '70px'
                                  }}
                                >
                                  {request.konfi_name}
                                </div>

                                {/* Zeile 2: Aktivitätsname */}
                                <div className="app-list-item__subtitle" style={{
                                  color: (isApproved || isRejected) ? '#999' : '#666',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {request.activity_name}
                                </div>

                                {/* Zeile 3: Meta-Infos */}
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={calendar} style={{ color: (isApproved || isRejected) ? '#999' : '#155724' }} />
                                    {formatDate(request.requested_date)}
                                  </span>
                                  {request.activity_points && (
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={trophy} style={{ color: (isApproved || isRejected) ? '#999' : '#ff9500' }} />
                                      {request.activity_points}P
                                    </span>
                                  )}
                                  <span className="app-list-item__meta-item">
                                    <IonIcon
                                      icon={getTypeIcon(request.activity_type || 'gemeinde')}
                                      style={{ color: (isApproved || isRejected) ? '#999' : getTypeColor(request.activity_type || 'gemeinde') }}
                                    />
                                    {request.activity_type === 'gottesdienst' ? 'GD' : 'Gem.'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      {/* Swipe Actions */}
                      <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '4px' } as any}>
                        {/* Reset-Button für approved/rejected */}
                        {!isPending && (
                          <IonItemOption
                            onClick={() => onResetRequest(request)}
                            style={{ '--background': 'transparent', '--color': 'transparent', padding: '0 4px', minWidth: 'auto', '--border-width': '0' }}
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                              <IonIcon icon={returnUpBack} />
                            </div>
                          </IonItemOption>
                        )}

                        {/* Löschen-Button für alle */}
                        <IonItemOption
                          onClick={() => onDeleteRequest(request)}
                          style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={trash} />
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
      </IonList>
    </>
  );
};

export default ActivityRequestsView;
