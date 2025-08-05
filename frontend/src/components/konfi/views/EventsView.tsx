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
  ribbon,
  listOutline,
  calendarOutline
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
  activeTab: 'registered' | 'upcoming' | 'past' | 'cancelled';
  onTabChange: (tab: 'registered' | 'upcoming' | 'past' | 'cancelled') => void;
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
            <IonSegmentButton value="upcoming">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Anstehend
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="registered">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Angemeldet
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="past">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                Vergangen
              </IonLabel>
            </IonSegmentButton>
            {eventCounts.cancelled > 0 && (
              <IonSegmentButton value="cancelled">
                <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem' }}>
                  Abgesagt ({eventCounts.cancelled})
                </IonLabel>
              </IonSegmentButton>
            )}
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Events Liste - Admin Design */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent' }}>
            {events.map((event) => (
              <IonItem 
                key={event.id}
                button 
                onClick={() => onSelectEvent(event)}
                style={{ 
                  '--min-height': '110px',
                  '--padding-start': '16px', 
                  '--padding-top': '0px', 
                  '--padding-bottom': '0px',
                  '--background': '#fbfbfb',
                  '--border-radius': '12px',
                  margin: '6px 8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid #f0f0f0',
                  borderRadius: '12px'
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
                      backgroundColor: (() => {
                        const isPastEvent = new Date(event.event_date) < new Date();
                        const isParticipated = isPastEvent && event.is_registered;
                        return isParticipated ? '#6c757d' :
                               (event as any).registration_status_detail === 'waitlist' ? '#fd7e14' :
                               event.is_registered ? '#28a745' : 
                               event.registration_status === 'cancelled' ? '#dc3545' : 
                               new Date(event.event_date) < new Date() ? '#6c757d' : '#dc2626';
                      })(),
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                      flexShrink: 0
                    }}>
                      <IonIcon 
                        icon={(() => {
                          const isPastEvent = new Date(event.event_date) < new Date();
                          const isParticipated = isPastEvent && event.is_registered;
                          return isParticipated ? checkmarkCircle :
                                 (event as any).registration_status_detail === 'waitlist' ? checkmarkCircle :
                                 event.is_registered ? checkmarkCircle : 
                                 event.registration_status === 'cancelled' ? close : 
                                 new Date(event.event_date) < new Date() ? hourglass : calendar;
                        })()}
                        style={{ 
                          fontSize: '1rem', 
                          color: 'white'
                        }} 
                      />
                    </div>
                    <h2 style={{ 
                      fontWeight: '600', 
                      fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', // Responsive Schriftgröße
                      margin: '0',
                      color: event.registration_status === 'cancelled' ? '#999' : '#333',
                      textDecoration: event.registration_status === 'cancelled' ? 'line-through' : 'none',
                      lineHeight: '1.3',
                      flex: 1,
                      minWidth: 0,
                      marginRight: '110px', // Fester Platz für Badge
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' // Titel wird automatisch mit ... abgekürzt
                    }}>
                      {event.name}
                    </h2>
                    
                    {/* Status Badge rechts */}
                    {(() => {
                      const isPastEvent = new Date(event.event_date) < new Date();
                      const showBadge = !isPastEvent || (isPastEvent && event.is_registered);
                      
                      if (!showBadge) return null;
                      
                      const isParticipated = isPastEvent && event.is_registered;
                      
                      return (
                        <span style={{
                          fontSize: '0.7rem',
                          color: isParticipated ? '#6c757d' : 
                                (event as any).registration_status_detail === 'waitlist' ? '#fd7e14' :
                                event.is_registered ? '#28a745' : 
                                event.registration_status === 'open' ? '#fd7e14' : 
                                event.registration_status === 'upcoming' ? '#ffc409' : 
                                event.registration_status === 'cancelled' ? '#dc3545' : '#dc3545',
                          fontWeight: '600',
                          backgroundColor: isParticipated ? '#e9ecef' : 
                                         (event as any).registration_status_detail === 'waitlist' ? '#fff4e6' :
                                         event.is_registered ? '#d4edda' : 
                                         event.registration_status === 'open' ? '#fff4e6' : 
                                         event.registration_status === 'upcoming' ? '#fff3cd' : 
                                         event.registration_status === 'cancelled' ? '#f8d7da' : '#f8d7da',
                          padding: '3px 6px',
                          borderRadius: '6px',
                          border: `1px solid ${isParticipated ? '#adb5bd' : 
                                             (event as any).registration_status_detail === 'waitlist' ? '#fdbf85' :
                                             event.is_registered ? '#c3e6cb' : 
                                             event.registration_status === 'open' ? '#fdbf85' : 
                                             event.registration_status === 'upcoming' ? '#ffeaa7' : 
                                             event.registration_status === 'cancelled' ? '#f5c6cb' : '#f5c6cb'}`,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          flexShrink: 0,
                          position: 'absolute',
                          right: '0',
                          top: '50%',
                          transform: 'translateY(-50%)'
                        }}>
                          {isParticipated ? 'TEILGENOMMEN' :
                           (event as any).registration_status_detail === 'waitlist' ? `WARTELISTE (${(event as any).waitlist_position || 1})` :
                           event.is_registered ? 'ANGEMELDET' : 
                           event.registration_status === 'open' && event.registered_count >= event.max_participants && event.waitlist_enabled ? 'WARTELISTE' :
                           event.registration_status === 'open' ? 'OFFEN' : 
                           event.registration_status === 'upcoming' ? 'BALD' : 
                           event.registration_status === 'cancelled' ? 'ABGESAGT' : 'GESCHLOSSEN'}
                        </span>
                      );
                    })()}
                  </div>

                  
                  {/* Datum und Zeit */}
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    color: '#666',
                    marginBottom: '6px'
                  }}>
                    <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: '#dc2626' }} />
                    <span style={{ fontWeight: '500', color: '#333' }}>
                      {formatDate(event.event_date)}
                    </span>
                    <IonIcon icon={time} style={{ fontSize: '0.9rem', color: '#ff6b35', marginLeft: '8px' }} />
                    <span style={{ color: '#666' }}>
                      {formatTime(event.event_date)}
                    </span>
                  </div>
                  
                  {/* Location und Teilnehmer */}
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '0.8rem',
                    color: '#666'
                  }}>
                    {event.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={location} style={{ fontSize: '0.8rem', color: '#007aff' }} />
                        <span>{event.location}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IonIcon icon={people} style={{ fontSize: '0.8rem', color: '#34c759' }} />
                      <span>{event.registered_count}/{event.max_participants}</span>
                      {event.waitlist_enabled && (event as any).waitlist_count > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '8px' }}>
                          <IonIcon icon={listOutline} style={{ fontSize: '0.7rem', color: '#fd7e14' }} />
                          <span style={{ color: '#666' }}>{(event as any).waitlist_count}/{event.max_waitlist_size || 10}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IonIcon icon={trophy} style={{ fontSize: '0.8rem', color: '#ff9500' }} />
                      <span>{event.points}P</span>
                    </div>
                  </div>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        </IonCardContent>
      </IonCard>

      {events.length === 0 && (
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent>
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <IonIcon 
                icon={calendarOutline} 
                style={{ 
                  fontSize: '3rem', 
                  color: '#dc2626', 
                  marginBottom: '16px',
                  display: 'block',
                  margin: '0 auto 16px auto'
                }} 
              />
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Events gefunden</h3>
              <p style={{ color: '#999', margin: '0' }}>
                {activeTab === 'registered' 
                  ? 'Du bist noch für keine Events angemeldet' 
                  : activeTab === 'upcoming'
                  ? 'Keine anstehenden Events'
                  : activeTab === 'past'
                  ? 'Keine vergangenen Events'
                  : 'Keine abgesagten Events'
                }
              </p>
            </div>
          </IonCardContent>
        </IonCard>
      )}
    </div>
  );
};

export default EventsView;