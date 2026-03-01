import React from 'react';
import {
  IonIcon,
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
import { SectionHeader, ListSection } from '../../shared';

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
      <SectionHeader
        title="Deine Aktivitäten"
        subtitle="Anträge und Verbuchungen"
        icon={checkmarkCircle}
        colors={{ primary: '#10b981', secondary: '#059669' }}
        stats={[
          { value: pendingRequests.length, label: 'Offen' },
          { value: approvedRequests.length, label: 'Verbucht' },
          { value: rejectedRequests.length, label: 'Abgelehnt' }
        ]}
      />

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

      {/* Anträge Liste */}
      <ListSection
        icon={documentTextOutline}
        title="Aktivitäten"
        count={requests.length}
        iconColorClass="success"
        isEmpty={requests.length === 0}
        emptyIcon={documentTextOutline}
        emptyTitle="Keine Anträge gefunden"
        emptyMessage="Noch keine Anträge gestellt"
        emptyIconColor="#059669"
      >
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
      </ListSection>
    </div>
  );
};

export default RequestsView;
