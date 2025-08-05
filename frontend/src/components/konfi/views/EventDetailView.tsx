import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonChip,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import {
  arrowBack,
  calendar,
  location,
  people,
  time,
  trophy,
  checkmarkCircle,
  closeCircle,
  informationCircle,
  warning,
  hourglass,
  ribbon
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import UnregisterModal from '../modals/UnregisterModal';

interface Category {
  id: number;
  name: string;
}

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  event_end_time?: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  point_type?: 'gottesdienst' | 'gemeinde';
  categories?: Category[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed' | 'cancelled';
  is_registered?: boolean;
  can_register?: boolean;
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
}

interface EventDetailViewProps {
  eventId: number;
  onBack: () => void;
}

const EventDetailView: React.FC<EventDetailViewProps> = ({ eventId, onBack }) => {
  const pageRef = useRef<HTMLElement>(null);
  const { setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Event | null>(null);

  const handleUnregister = async (reason: string) => {
    if (!eventData || !reason.trim()) {
      setError('Bitte gib einen Grund für die Abmeldung an');
      return;
    }

    try {
      await api.delete(`/konfi/events/${eventData.id}/register`, {
        data: { reason: reason.trim() }
      });
      
      // Modal schließen BEVOR andere Aktionen
      dismissUnregisterModal();
      
      setSuccess(`Von "${eventData.name}" abgemeldet`);
      await loadEventData();
      
      // Trigger events update for parent page
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
    }
  };

  // Modal mit useIonModal Hook - gleiche Pattern wie Admin
  const [presentUnregisterModal, dismissUnregisterModal] = useIonModal(UnregisterModal, {
    eventName: eventData?.name || '',
    onClose: () => dismissUnregisterModal(),
    onUnregister: handleUnregister,
    dismiss: () => dismissUnregisterModal()
  });

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      // Get event details from admin API (same as used in EventsView)
      const eventsResponse = await api.get('/events');
      const event = eventsResponse.data.find((e: Event) => e.id === eventId);
      
      if (!event) {
        setError('Event nicht gefunden');
        return;
      }
      
      // Get registration status for konfi using the existing route
      try {
        const statusResponse = await api.get(`/konfi/events/${eventId}/status`);
        const eventWithStatus = {
          ...event,
          is_registered: statusResponse.data.is_registered,
          can_register: statusResponse.data.can_register,
          waitlist_count: statusResponse.data.waitlist_count,
          waitlist_position: statusResponse.data.waitlist_position,
          registration_status_detail: statusResponse.data.registration_status
        };
        setEventData(eventWithStatus);
      } catch (statusErr) {
        // If status check fails, assume not registered
        const eventWithStatus = {
          ...event,
          is_registered: false,
          can_register: event.registration_status === 'open'
        };
        setEventData(eventWithStatus);
      }
      
    } catch (err) {
      setError('Fehler beim Laden der Event-Details');
      console.error('Error loading event details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'success';
      case 'closed': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Anmeldung offen';
      case 'closed': return 'Anmeldung geschlossen';
      case 'cancelled': return 'Abgesagt';
      default: return 'Bald verfügbar';
    }
  };

  const canUnregister = (event: Event) => {
    if (!event.is_registered) return false;
    
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const twoDaysBeforeEvent = new Date(eventDate.getTime() - (2 * 24 * 60 * 60 * 1000));
    
    return now < twoDaysBeforeEvent;
  };

  const handleRegister = async () => {
    if (!eventData) return;
    
    try {
      await api.post(`/konfi/events/${eventData.id}/register`);
      setSuccess(`Erfolgreich für "${eventData.name}" angemeldet!`);
      await loadEventData();
      
      // Trigger events update for parent page
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  if (loading) {
    return (
      <IonPage ref={pageRef}>
        <IonHeader translucent>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onBack}>
                <IonIcon icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>Event Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <LoadingSpinner message="Event wird geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  if (!eventData) {
    return (
      <IonPage ref={pageRef}>
        <IonHeader translucent>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onBack}>
                <IonIcon icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>Event nicht gefunden</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen />
      </IonPage>
    );
  }

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{eventData.name}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{eventData.name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEventData();
          e.detail.complete();
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Event Header - Dashboard-Style Gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Event-Titel - groß und überlappend über Rand hinaus */}
          <div style={{
            position: 'absolute',
            top: '-5px',
            left: '8px',
            right: '8px',
            zIndex: 1,
            overflow: 'visible'
          }}>
            <h2 style={{
              fontSize: '2.8rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.1)',
              margin: '0',
              lineHeight: '0.85',
              letterSpacing: '-2px',
              wordBreak: 'break-word',
              textTransform: 'uppercase',
              transform: 'scale(1.05)'
            }}>
              {eventData.name}
            </h2>
          </div>
          
          {/* Status Badge - separate row at top right */}
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '24px',
            zIndex: 3
          }}>
            <div style={{
              backgroundColor: eventData.is_registered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '8px 12px',
              border: `1px solid ${eventData.is_registered ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {eventData.is_registered && (
                <IonIcon 
                  icon={checkmarkCircle} 
                  style={{ 
                    fontSize: '1rem', 
                    color: '#28a745'
                  }} 
                />
              )}
              <span style={{ 
                color: eventData.is_registered ? '#28a745' : 
                       eventData.registration_status === 'open' ? '#fd7e14' :
                       eventData.registration_status === 'upcoming' ? '#ffc409' :
                       eventData.registration_status === 'cancelled' ? '#dc3545' : 
                       'white', 
                fontSize: '0.8rem', 
                fontWeight: '600'
              }}>
                {eventData.is_registered ? 'ANGEMELDET' : 
                 eventData.registration_status === 'open' ? 'OFFEN' : 
                 eventData.registration_status === 'upcoming' ? 'BALD' : 
                 eventData.registration_status === 'cancelled' ? 'ABGESAGT' : 'GESCHLOSSEN'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div style={{
            position: 'relative',
            zIndex: 2,  
            padding: '60px 24px 24px 24px',
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
                    padding: '12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={people} 
                      style={{ 
                        fontSize: '1.2rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '4px', 
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.3rem' }}>{eventData.max_participants - eventData.registered_count}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      frei
                    </div>
                  </div>
                </IonCol>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon 
                      icon={trophy} 
                      style={{ 
                        fontSize: '1.2rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '4px', 
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.3rem' }}>{eventData.points}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      Punkte
                    </div>
                  </div>
                </IonCol>
                <IonCol size="4" style={{ padding: '0 4px' }}>
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
                        fontSize: '1.2rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '4px', 
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.3rem' }}>{eventData.registered_count}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      dabei
                    </div>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Event Details Card */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <IonGrid style={{ padding: '0' }}>
              <IonRow>
                <IonCol size="12">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={calendar} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#333' }}>
                        {formatDate(eventData.event_date)}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatTime(eventData.event_date)}
                        {eventData.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
                      </div>
                    </div>
                  </div>

                  {eventData.location && (
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '12px',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '8px',
                        transition: 'background-color 0.2s'
                      }}
                      onClick={() => {
                        if (eventData.location_maps_url) {
                          window.open(eventData.location_maps_url, '_blank');
                        } else {
                          // Fallback to Apple Maps on iOS, Google Maps otherwise
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          const encodedLocation = encodeURIComponent(eventData.location || '');
                          const mapsUrl = isIOS 
                            ? `maps://maps.apple.com/?q=${encodedLocation}`
                            : `https://maps.google.com/maps?q=${encodedLocation}`;
                          window.open(mapsUrl, '_blank');
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <IonIcon icon={location} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#007aff', textDecoration: 'underline' }}>
                        {eventData.location}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={people} style={{ marginRight: '12px', color: '#34c759', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData.registered_count} / {eventData.max_participants} Teilnehmer
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={trophy} style={{ marginRight: '12px', color: '#ff9500', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData.points} Punkte • {eventData.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                    </div>
                  </div>

                  {eventData.waitlist_enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={hourglass} style={{ marginRight: '12px', color: '#ff6b35', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        Warteliste: {(eventData as any).waitlist_count || 0}/{eventData.max_waitlist_size || 10}
                        {(eventData as any).waitlist_position && ` (Platz ${(eventData as any).waitlist_position})`}
                      </div>
                    </div>
                  )}

                  {eventData.categories && eventData.categories.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={ribbon} style={{ marginRight: '12px', color: '#007aff', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {eventData.categories.map(cat => cat.name).join(', ')}
                      </div>
                    </div>
                  )}
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Description */}
        {eventData.description && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: '#333' }}>
                Beschreibung
              </h3>
              <p style={{ margin: '0', fontSize: '1rem', color: '#666', lineHeight: '1.5' }}>
                {eventData.description}
              </p>
            </IonCardContent>
          </IonCard>
        )}


        {/* Action Buttons - same width as admin cards */}
        <div style={{ padding: '16px', paddingBottom: '32px' }}>
          {eventData.is_registered ? (
            <div>              
              {canUnregister(eventData) ? (
                <IonButton 
                  expand="block" 
                  fill="outline" 
                  color="danger"
                  onClick={() => presentUnregisterModal({ 
                    presentingElement: pageRef.current || undefined
                  })}
                  style={{ 
                    height: '48px',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  <IonIcon icon={closeCircle} slot="start" />
                  Abmelden
                </IonButton>
              ) : (
                <IonButton 
                  expand="block" 
                  fill="outline" 
                  color="medium"
                  disabled
                  style={{ 
                    height: '48px',
                    borderRadius: '12px',
                    fontWeight: '600'
                  }}
                >
                  <IonIcon icon={warning} slot="start" />
                  Abmeldung nicht mehr möglich
                </IonButton>
              )}
            </div>
          ) : eventData.can_register && eventData.registration_status === 'open' ? (
            <IonButton 
              expand="block" 
              style={{ 
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600',
                '--background': '#1e7e34',
                '--background-activated': '#155724',
                '--background-hover': '#1c7430',
                '--color': 'white'
              }}
              onClick={handleRegister}
            >
              <IonIcon icon={checkmarkCircle} slot="start" />
              Anmelden ({eventData.registered_count}/{eventData.max_participants})
            </IonButton>
          ) : eventData.waitlist_enabled && eventData.registered_count >= eventData.max_participants && eventData.registration_status === 'open' ? (
            <IonButton 
              expand="block" 
              style={{ 
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600',
                '--background': '#fd7e14',
                '--background-activated': '#e8650e',
                '--background-hover': '#f4720b',
                '--color': 'white'
              }}
              onClick={handleRegister}
            >
              <IonIcon icon={hourglass} slot="start" />
              Warteliste ({(eventData as any).waitlist_count || 0}/{eventData.max_waitlist_size || 0})
            </IonButton>
          ) : (
            <IonButton 
              expand="block" 
              disabled
              color="medium"
              style={{ 
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600'
              }}
            >
              <IonIcon icon={informationCircle} slot="start" />
              {eventData.registration_status === 'closed' ? 'Anmeldung geschlossen' : 'Nicht verfügbar'}
            </IonButton>
          )}
        </div>

      </IonContent>
    </IonPage>
  );
};

export default EventDetailView;