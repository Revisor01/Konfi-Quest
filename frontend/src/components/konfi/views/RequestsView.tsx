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
  IonBadge,
  IonChip,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
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
  chatbox,
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
  activeTab,
  onTabChange,
  formatDate,
  getStatusColor,
  getStatusText,
  getTypeIcon,
  getTypeText
}) => {
  const { setError } = useApp();

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  const handleRequestClick = async (request: ActivityRequest) => {
    if (!request.photo_filename) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      
      // Download image with authentication first, then save locally
      const response = await api.get(`/konfi/activity-requests/${request.id}/photo`, {
        responseType: 'blob'
      });
      const blob = response.data;
      const fileName = `request_${request.id}.jpg`;
      
      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
      
      // Ensure temp directory exists first
      try {
        await Filesystem.mkdir({
          path: 'temp',
          directory: Directory.Documents,
          recursive: true
        });
      } catch (e) {
        // Directory might already exist
      }
      
      // Write file (not directory!)
      const path = `temp/${fileName}`;
      await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: Directory.Documents
      });
      
      console.log('✅ Image saved to:', path);
      console.log('📁 File size:', base64Data.length, 'bytes (base64)');
      
      // Get local file URI
      const fileUri = await Filesystem.getUri({
        directory: Directory.Documents,
        path
      });
      
      // Open with native file opener
      await FileOpener.open({
        filePath: fileUri.uri,
        contentType: 'image/jpeg'
      });
    } catch (error) {
      console.error('Error opening image:', error);
      setError('Fehler beim Öffnen des Fotos');
    }
  };

  return (
    <div>
      {/* Anträge Header - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #28a745 0%, #155724 100%)',
        borderRadius: '24px',
        padding: '0',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 20px 40px rgba(40, 167, 69, 0.3)',
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
            ANT
          </h2>
          <h2 style={{
            fontSize: '4rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            RÄGE
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
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{pendingRequests.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Wartend
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
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{approvedRequests.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
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
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{rejectedRequests.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Abgelehnt
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Tab Navigation */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonSegment 
            value={activeTab} 
            onIonChange={(e) => onTabChange(e.detail.value as any)}
            style={{ 
              '--background': '#f8f9fa',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="all">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Alle
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="pending">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Wartend
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="approved">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Genehmigt
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="rejected">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Abgelehnt
              </IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Anträge Liste - Events Design */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent' }}>
            {requests.map((request) => (
              <IonItemSliding key={request.id}>
                <IonItem
                  button={false}
                  onClick={request.photo_filename ? () => handleRequestClick(request) : undefined}
                  style={{
                    '--min-height': '110px',
                    '--padding-start': '16px',
                    '--padding-top': '0px',
                    '--padding-bottom': '0px',
                    '--background': request.activity_type === 'gottesdienst' ? '#f0f9ff' : '#f0f9f0',
                    '--border-radius': '12px',
                    margin: '6px 8px',
                    boxShadow: request.activity_type === 'gottesdienst' ? '0 2px 8px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(40, 167, 69, 0.15)',
                    border: request.activity_type === 'gottesdienst' ? '1px solid #93c5fd' : '1px solid #90ee90',
                    borderRadius: '12px',
                    cursor: request.photo_filename ? 'pointer' : 'default'
                  }}
                >
                  <IonLabel>
                    {/* Titel mit Icon und Status Badge in einer Reihe */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                      position: 'relative'
                    }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px',
                        backgroundColor: request.activity_type === 'gottesdienst' 
                          ? '#3880ff' : '#28a745',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: request.activity_type === 'gottesdienst' 
                          ? '0 2px 8px rgba(56, 128, 255, 0.3)' 
                          : '0 2px 8px rgba(40, 167, 69, 0.3)',
                        flexShrink: 0
                      }}>
                        <IonIcon 
                          icon={getTypeIcon(request.activity_type)}
                          style={{ 
                            fontSize: '1rem', 
                            color: 'white'
                          }} 
                        />
                      </div>
                      <h2 style={{ 
                        fontWeight: '600', 
                        fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                        margin: '0',
                        color: '#333',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
                        marginRight: '110px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {request.activity_name}
                      </h2>
                      
                      {/* Status Badge rechts */}
                      <span style={{
                        fontSize: '0.7rem',
                        color: request.status === 'pending' ? '#ffc409' :
                               request.status === 'approved' ? '#28a745' : '#dc3545',
                        fontWeight: '600',
                        backgroundColor: request.status === 'pending' ? '#fff3cd' :
                                       request.status === 'approved' ? '#d4edda' : '#f8d7da',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: `1px solid ${request.status === 'pending' ? '#ffeaa7' :
                                            request.status === 'approved' ? '#c3e6cb' : '#f5c6cb'}`,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        flexShrink: 0,
                        position: 'absolute',
                        right: '0',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}>
                        {getStatusText(request.status).toUpperCase()}
                      </span>
                    </div>

                    {/* Datum und Punkte */}
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '6px'
                    }}>
                      <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: '#28a745' }} />
                      <span style={{ fontWeight: '500', color: '#333' }}>
                        {formatDate(request.requested_date)}
                      </span>
                    </div>
                    
                    {/* Typ, Punkte und Foto - kompakt in einer Zeile */}
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '0.8rem',
                      color: '#666'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={request.activity_type === 'gottesdienst' ? home : people} style={{ fontSize: '0.8rem', color: '#007aff' }} />
                        <span>{getTypeText(request.activity_type)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={trophy} style={{ fontSize: '0.8rem', color: '#ff9500' }} />
                        <span>{request.activity_points}P</span>
                      </div>
                      {request.photo_filename && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={camera} style={{ fontSize: '0.8rem', color: '#7045f6' }} />
                          <span>Foto</span>
                        </div>
                      )}
                    </div>

                    {/* Anmerkung - lesbar in separater Zeile */}
                    {request.comment && (
                      <div style={{
                        margin: '6px 0 0 0',
                        fontSize: '0.85rem',
                        color: '#666',
                        fontStyle: 'italic',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px'
                      }}>
                        <IonIcon icon={chatbox} style={{ fontSize: '0.8rem', color: '#34c759', marginTop: '2px', flexShrink: 0 }} />
                        <span>"{request.comment}"</span>
                      </div>
                    )}


                    {/* Admin Kommentar bei Ablehnung - kompakter */}
                    {request.status === 'rejected' && request.admin_comment && (
                      <div style={{
                        background: '#fee',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        marginTop: '6px',
                        border: '1px solid #fcc',
                        fontSize: '0.8rem',
                        color: '#c33'
                      }}>
                        <strong>Grund:</strong> {request.admin_comment}
                      </div>
                    )}
                  </IonLabel>
                </IonItem>

                {request.status === 'pending' && onDeleteRequest && (
                  <IonItemOptions side="end">
                    <IonItemOption 
                      color="danger" 
                      onClick={() => onDeleteRequest(request)}
                    >
                      <IonIcon icon={trash} />
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
            ))}

            {requests.length === 0 && (
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
            )}
          </IonList>
        </IonCardContent>
      </IonCard>

    </div>
  );
};

export default RequestsView;