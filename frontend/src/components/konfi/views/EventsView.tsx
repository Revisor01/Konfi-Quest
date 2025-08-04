import React from 'react';
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
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import { 
  calendar,
  time,
  location,
  people,
  checkmarkCircle,
  hourglass,
  close,
  statsChart,
  trophy,
  ribbon
} from 'ionicons/icons';

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
  categories?: Category[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed' | 'cancelled';
  created_at: string;
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
  is_series?: boolean;
  series_id?: number;
  is_registered?: boolean;
  can_register?: boolean;
}

interface EventsViewProps {
  events: Event[];
  activeTab: 'all' | 'upcoming' | 'past' | 'cancelled';
  onTabChange: (tab: 'all' | 'upcoming' | 'past' | 'cancelled') => void;
  onSelectEvent: (event: Event) => void;
  onUpdate: () => void;
}

const EventsView: React.FC<EventsViewProps> = ({ 
  events, 
  activeTab,
  onTabChange,
  onSelectEvent,
  onUpdate
}) => {

  const getStatusColor = (event: Event) => {
    if (event.is_registered) return 'success';
    if (event.registration_status === 'open') return 'primary';
    if (event.registration_status === 'closed') return 'warning';
    if (event.registration_status === 'cancelled') return 'danger';
    return 'medium';
  };

  const getStatusText = (event: Event) => {
    if (event.is_registered) return 'Angemeldet';
    if (event.registration_status === 'open') return 'Anmeldung offen';
    if (event.registration_status === 'closed') return 'Anmeldung geschlossen';
    if (event.registration_status === 'cancelled') return 'Abgesagt';
    if (event.registration_status === 'upcoming') return 'Bald verfügbar';
    return 'Unbekannt';
  };

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

  const eventCounts = {
    all: events.length,
    upcoming: events.filter(e => new Date(e.event_date) >= new Date() && e.registration_status !== 'cancelled').length,
    past: events.filter(e => new Date(e.event_date) < new Date() && e.registration_status !== 'cancelled').length,
    cancelled: events.filter(e => e.registration_status === 'cancelled').length
  };

  return (
    <div>
      {/* Events Header - Dashboard-Style */}
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
        {/* Überschrift - groß und überlappend */}
        <div style={{
          position: 'absolute',
          top: '-10px',
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
            EVENTS
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
                    icon={calendar} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{eventCounts.all}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Gesamt
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
                    icon={time} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{eventCounts.upcoming}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Anstehend
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
                    icon={statsChart} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{eventCounts.past}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Vergangen
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
              <IonLabel style={{ fontWeight: '600' }}>
                Alle ({eventCounts.all})
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="upcoming">
              <IonLabel style={{ fontWeight: '600' }}>
                Anstehend ({eventCounts.upcoming})
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="past">
              <IonLabel style={{ fontWeight: '600' }}>
                Vergangen ({eventCounts.past})
              </IonLabel>
            </IonSegmentButton>
            {eventCounts.cancelled > 0 && (
              <IonSegmentButton value="cancelled">
                <IonLabel style={{ fontWeight: '600' }}>
                  Abgesagt ({eventCounts.cancelled})
                </IonLabel>
              </IonSegmentButton>
            )}
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Events List */}
      <IonList style={{ padding: '0 8px', paddingBottom: '32px' }}>
        {events.map((event) => (
          <IonCard 
            key={event.id} 
            button 
            onClick={() => onSelectEvent(event)}
            style={{ 
              margin: '8px 0',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
            }}
          >
            <IonCardHeader style={{ paddingBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <IonCardTitle style={{ fontSize: '1.1rem', fontWeight: '700', color: '#333' }}>
                  {event.name}
                </IonCardTitle>
                <IonBadge color={getStatusColor(event)} style={{ fontSize: '0.7rem' }}>
                  {getStatusText(event)}
                </IonBadge>
              </div>
            </IonCardHeader>
            
            <IonCardContent style={{ paddingTop: '0' }}>
              <IonGrid style={{ padding: '0' }}>
                <IonRow>
                  <IonCol size="6">
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <IonIcon icon={calendar} style={{ marginRight: '8px', color: '#666' }} />
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatDate(event.event_date)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <IonIcon icon={time} style={{ marginRight: '8px', color: '#666' }} />
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatTime(event.event_date)}
                      </span>
                    </div>
                    {event.location && (
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <IonIcon icon={location} style={{ marginRight: '8px', color: '#666' }} />
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>
                          {event.location}
                        </span>
                      </div>
                    )}
                  </IonCol>
                  <IonCol size="6">
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <IonIcon icon={people} style={{ marginRight: '8px', color: '#666' }} />
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        {event.registered_count}/{event.max_participants} Teilnehmer
                      </span>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <IonChip color="primary" style={{ fontSize: '0.8rem' }}>
                        {event.points} Punkte
                      </IonChip>
                      <IonChip color="secondary" style={{ fontSize: '0.8rem' }}>
                        {event.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                      </IonChip>
                    </div>
                  </IonCol>
                </IonRow>
              </IonGrid>
              
              {event.description && (
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#666', 
                  margin: '8px 0 0 0',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {event.description}
                </p>
              )}
            </IonCardContent>
          </IonCard>
        ))}
      </IonList>

      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '3rem', color: '#ccc', marginBottom: '16px' }}>📅</div>
          <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Events gefunden</h3>
          <p style={{ color: '#999', margin: '0' }}>
            {activeTab === 'all' 
              ? 'Es sind noch keine Events verfügbar' 
              : activeTab === 'upcoming'
              ? 'Keine anstehenden Events'
              : activeTab === 'past'
              ? 'Keine vergangenen Events'
              : 'Keine abgesagten Events'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default EventsView;