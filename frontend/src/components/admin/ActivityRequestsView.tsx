import React, { useState } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonBadge,
  IonList,
  IonChip,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonAvatar,
  IonImg,
  useIonActionSheet
} from '@ionic/react';
import { 
  checkmark,
  close,
  trash, 
  create, 
  search,
  document,
  time,
  person,
  calendar,
  image,
  eye
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
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
  const [presentActionSheet] = useIonActionSheet();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('alle');

  const filteredAndSortedRequests = (() => {
    let result = filterBySearchTerm(requests, searchTerm, ['konfi_name', 'activity_name', 'comment']);
    
    // Filter by status
    if (selectedStatus !== 'alle') {
      result = result.filter(request => request.status === selectedStatus);
    }
    
    // Sort by created_at (newest first)
    result = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return result;
  })();

  const getPendingRequests = () => {
    return requests.filter(request => request.status === 'pending');
  };

  const getApprovedRequests = () => {
    return requests.filter(request => request.status === 'approved');
  };

  const getRejectedRequests = () => {
    return requests.filter(request => request.status === 'rejected');
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
      case 'pending': return 'Ausstehend';
      case 'approved': return 'Genehmigt';
      case 'rejected': return 'Abgelehnt';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Header Card mit Statistiken - Grüner Gradient */}
      <IonCard style={{
        margin: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(40, 167, 69, 0.3)'
      }}>
        <IonCardContent>
          <IonGrid>
            <IonRow>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={document} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {requests.length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Anträge
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={time} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getPendingRequests().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Ausstehend
                  </p>
                </div>
              </IonCol>
              <IonCol size="4">
                <div style={{ textAlign: 'center' }}>
                  <IonIcon icon={checkmark} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                    {getApprovedRequests().length}
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                    Genehmigt
                  </p>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      {/* Search and Filter */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          {/* Search Bar */}
          <IonItem 
            lines="none" 
            style={{ 
              '--background': '#f8f9fa',
              '--border-radius': '8px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              '--padding-start': '12px',
              '--padding-end': '12px',
              '--min-height': '44px'
            }}
          >
            <IonIcon 
              icon={search} 
              slot="start" 
              style={{ 
                color: '#8e8e93',
                marginRight: '8px',
                fontSize: '1rem'
              }} 
            />
            <IonInput
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Antrag suchen..."
              style={{ 
                '--color': '#000',
                '--placeholder-color': '#8e8e93'
              }}
            />
          </IonItem>

          {/* Tab Filter */}
          <IonSegment 
            value={selectedStatus} 
            onIonChange={(e) => setSelectedStatus(e.detail.value as string)}
            style={{ 
              '--background': '#f8f9fa',
              borderRadius: '8px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonIcon icon={document} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="pending">
              <IonIcon icon={time} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Ausstehend</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="approved">
              <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Genehmigt</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="rejected">
              <IonIcon icon={close} style={{ fontSize: '1rem', marginRight: '4px' }} />
              <IonLabel>Abgelehnt</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Anträge Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '0' }}>
          <IonList>
            {filteredAndSortedRequests.map((request) => (
              <IonItemSliding key={request.id}>
                <IonItem 
                  button 
                  onClick={() => onSelectRequest(request)}
                  style={{ '--min-height': '80px', '--padding-start': '16px' }}
                >
                  {request.photo_filename && (
                    <IonAvatar slot="start" style={{ marginRight: '12px' }}>
                      <IonIcon 
                        icon={image} 
                        style={{ 
                          fontSize: '1.5rem', 
                          color: '#007aff' 
                        }} 
                      />
                    </IonAvatar>
                  )}
                  
                  <IonLabel>
                    <h2 style={{ 
                      fontWeight: '600', 
                      fontSize: '1.1rem',
                      margin: '0 0 6px 0'
                    }}>
                      {request.konfi_name}
                    </h2>
                    
                    <p style={{ 
                      margin: '0 0 6px 0',
                      fontSize: '0.85rem',
                      color: '#666',
                      fontWeight: '500'
                    }}>
                      {request.activity_name}
                    </p>
                    
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <IonChip 
                        color={getStatusColor(request.status)}
                        style={{ 
                          fontSize: '0.75rem', 
                          height: '22px',
                          opacity: 0.7,
                          '--background': getStatusColor(request.status) === 'success' ? 'rgba(45, 211, 111, 0.15)' : 
                                         getStatusColor(request.status) === 'warning' ? 'rgba(255, 204, 0, 0.15)' : 
                                         'rgba(245, 61, 61, 0.15)',
                          '--color': getStatusColor(request.status) === 'success' ? '#2dd36f' : 
                                    getStatusColor(request.status) === 'warning' ? '#ffcc00' : 
                                    '#f53d3d'
                        }}
                      >
                        {getStatusText(request.status)}
                      </IonChip>
                      
                      {request.jahrgang_name && (
                        <IonChip 
                          color="tertiary"
                          style={{ 
                            fontSize: '0.75rem', 
                            height: '22px',
                            opacity: 0.7,
                            '--background': 'rgba(112, 69, 246, 0.15)',
                            '--color': '#7045f6'
                          }}
                        >
                          {request.jahrgang_name}
                        </IonChip>
                      )}
                    </div>
                    
                    <p style={{ 
                      margin: '0',
                      fontSize: '0.8rem',
                      color: '#999'
                    }}>
                      Teilnahme: {formatDate(request.requested_date)} • Eingereicht: {formatDateTime(request.created_at)}
                    </p>
                    
                    {request.comment && (
                      <p style={{ 
                        margin: '4px 0 0 0',
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

                <IonItemOptions side="end">
                  <IonItemOption 
                    color="primary" 
                    onClick={() => onSelectRequest(request)}
                  >
                    <IonIcon icon={eye} />
                  </IonItemOption>
                  <IonItemOption 
                    color="danger" 
                    onClick={() => onDeleteRequest(request)}
                  >
                    <IonIcon icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
            
            {filteredAndSortedRequests.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Anträge gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default ActivityRequestsView;