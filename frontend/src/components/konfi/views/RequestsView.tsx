import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonList,
  IonListHeader,
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

  // Status-Infos für einen Request
  const getRequestStatusInfo = (request: ActivityRequest) => {
    const isPending = request.status === 'pending';
    const isApproved = request.status === 'approved';
    const isRejected = request.status === 'rejected';

    const statusColor = isPending ? '#ff9500' : isApproved ? '#059669' : '#dc3545';
    const statusText = isPending ? 'Offen' : isApproved ? 'Verbucht' : 'Abgelehnt';
    const statusIcon = isPending ? hourglass : isApproved ? checkmarkCircle : closeCircle;

    return { statusColor, statusText, statusIcon, isPending, isApproved, isRejected };
  };

  const getTypeColor = (type: string) => {
    return type === 'gottesdienst' ? '#007aff' : '#059669';
  };

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

      {/* Anträge Liste - Admin Pattern mit CSS-Klassen */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--success">
            <IonIcon icon={documentTextOutline} />
          </div>
          <IonLabel>Aktivitäten ({requests.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={documentTextOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#059669',
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
              <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                {requests.map((request, index) => {
                  const { statusColor, statusText, statusIcon, isPending, isApproved, isRejected } = getRequestStatusInfo(request);

                  return (
                    <IonItemSliding key={request.id} style={{ marginBottom: index < requests.length - 1 ? '8px' : '0' }}>
                      <IonItem
                        button
                        onClick={() => onSelectRequest?.(request)}
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
                              {/* Aktivitäts-Typ Icon */}
                              <div
                                className={`app-icon-circle app-icon-circle--lg app-icon-circle--${request.activity_type === 'gottesdienst' ? 'info' : 'activities'}`}
                              >
                                <IonIcon icon={request.activity_type === 'gottesdienst' ? home : people} />
                              </div>

                              {/* Content */}
                              <div className="app-list-item__content">
                                {/* Zeile 1: Aktivitätsname */}
                                <div
                                  className="app-list-item__title"
                                  style={{
                                    paddingRight: '70px'
                                  }}
                                >
                                  {request.activity_name}
                                </div>

                                {/* Zeile 2: Datum + Punkte + Typ + Foto */}
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={calendar} style={{ color: '#059669' }} />
                                    {formatDate(request.requested_date)}
                                  </span>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={trophy} style={{ color: '#ff9500' }} />
                                    {request.activity_points}P
                                  </span>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon
                                      icon={request.activity_type === 'gottesdienst' ? home : people}
                                      style={{ color: getTypeColor(request.activity_type) }}
                                    />
                                    {request.activity_type === 'gottesdienst' ? 'GD' : 'Gem.'}
                                  </span>
                                  {request.photo_filename && (
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={camera} style={{ color: '#7045f6' }} />
                                      Foto
                                    </span>
                                  )}
                                </div>

                                {/* Zeile 3: Kommentar (falls vorhanden) */}
                                {request.comment && (
                                  <div className="app-list-item__subtitle" style={{
                                    color: '#666',
                                    fontStyle: 'italic',
                                    marginTop: '4px'
                                  }}>
                                    "{request.comment}"
                                  </div>
                                )}

                                {/* Ablehnungsgrund bei rejected */}
                                {isRejected && request.admin_comment && (
                                  <div className="app-reason-box app-reason-box--danger" style={{ marginTop: '8px' }}>
                                    <div>
                                      <span className="app-reason-box__label" style={{
                                        fontSize: '0.7rem'
                                      }}>
                                        Grund der Ablehnung
                                      </span>
                                      <p style={{
                                        margin: '2px 0 0 0',
                                        fontSize: '0.8rem',
                                        lineHeight: '1.4'
                                      }}>
                                        {request.admin_comment}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      {/* Swipe Actions */}
                      {isPending && onDeleteRequest && (
                        <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                          <IonItemOption
                            onClick={() => onDeleteRequest(request)}
                            style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={trash} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  );
                })}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>
    </div>
  );
};

export default RequestsView;
