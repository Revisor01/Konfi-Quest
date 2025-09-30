import React, { useState, useRef } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  useIonActionSheet
} from '@ionic/react';
import {
  add,
  trash,
  create,
  search,
  swapVertical,
  flash,
  people,
  calendar,
  time,
  location,
  hourglass,
  copy,
  ban,
  list,
  checkmarkCircle,
  close,
  trophy,
  listOutline
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';
import { parseLocalTime, getLocalNow } from '../../utils/dateUtils';

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
  category_names?: string;
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
  waitlist_count?: number;
}

interface EventsViewProps {
  events: Event[];
  onUpdate: () => void;
  onAddEventClick: () => void;
  onSelectEvent: (event: Event) => void;
  onDeleteEvent?: (event: Event) => void;
  onCopyEvent?: (event: Event) => void;
  onCancelEvent?: (event: Event) => void;
  activeTab?: 'all' | 'upcoming' | 'past' | 'konfirmation';
  onTabChange?: (tab: 'all' | 'upcoming' | 'past' | 'konfirmation') => void;
  eventCounts?: {
    all: number;
    upcoming: number;
    past: number;
    konfirmation: number;
  };
}

const EventsView: React.FC<EventsViewProps> = ({
  events,
  onUpdate,
  onAddEventClick,
  onSelectEvent,
  onDeleteEvent,
  onCopyEvent,
  onCancelEvent,
  activeTab = 'upcoming',
  onTabChange,
  eventCounts
}) => {
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

  // Events nach Datum sortieren
  const filteredAndSortedEvents = (() => {
    return [...events].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  })();

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.event_date) > now);
  };

  const getPastEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.event_date) <= now);
  };

  const getOpenEvents = () => {
    return events.filter(event => calculateRegistrationStatus(event) === 'open');
  };

  const getTotalPoints = () => {
    return events.reduce((sum, event) => sum + event.points, 0);
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

  const calculateRegistrationStatus = (event: Event): 'upcoming' | 'open' | 'closed' | 'cancelled' => {
    // Use the backend-calculated status directly
    return event.registration_status;
  };

  const getRegistrationStatusColor = (event: Event) => {
    const status = calculateRegistrationStatus(event);
    switch (status) {
      case 'upcoming': return 'medium';
      case 'open': return 'success';
      case 'closed': return 'danger';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  };

  const getRegistrationStatusText = (event: Event) => {
    const status = calculateRegistrationStatus(event);
    switch (status) {
      case 'upcoming': return 'Bald verfügbar';
      case 'open': return 'Anmeldung offen';
      case 'closed': return 'Anmeldung geschlossen';
      case 'cancelled': return 'Abgesagt';
      default: return 'Unbekannt';
    }
  };

  const getTotalRegistrations = () => {
    return events.reduce((sum, event) => sum + event.registered_count, 0);
  };

  const getAverageParticipation = () => {
    if (events.length === 0) return 0;
    const total = events.reduce((sum, event) => sum + (event.registered_count / event.max_participants), 0);
    return Math.round((total / events.length) * 100);
  };

  return (
    <>
      {/* Header - Dashboard-Style */}
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
                    <span style={{ fontSize: '1.5rem' }}>{events.length}</span>
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
                    <span style={{ fontSize: '1.5rem' }}>{getUpcomingEvents().length}</span>
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
                    icon={people}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{events.reduce((sum, e) => sum + e.registered_count, 0)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Gebucht
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>


      {/* Tab Navigation */}
      {onTabChange && (
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '14px 16px' }}>
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
                <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Anstehend</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="all">
                <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Alle</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="past">
                <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Vergangen</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="konfirmation">
                <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Konfirmation</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonCardContent>
        </IonCard>
      )}

      {/* Events Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent' }}>
            {filteredAndSortedEvents.map((event) => {
              const isPastEvent = new Date(event.event_date) < new Date();
              const isCancelled = event.registration_status === 'cancelled';
              const isKonfirmationEvent = event.category_names?.toLowerCase().includes('konfirmation');

              return (
              <IonItemSliding key={event.id}>
                <IonItem
                  button
                  onClick={() => onSelectEvent(event)}
                  detail={false}
                  style={{
                    '--min-height': '130px',
                    '--padding-start': '16px',
                    '--padding-top': '0px',
                    '--padding-bottom': '0px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 8px',
                    boxShadow: isCancelled ? '0 2px 8px rgba(239, 68, 68, 0.2)' : isKonfirmationEvent ? '0 2px 8px rgba(139, 92, 246, 0.15)' : '0 2px 8px rgba(0,0,0,0.06)',
                    border: isCancelled ? '1px solid #fca5a5' : isKonfirmationEvent ? '1px solid #c4b5fd' : '1px solid #e0e0e0',
                    borderRadius: '12px',
                    opacity: isPastEvent ? 0.6 : 1
                  }}
                >
                  <IonLabel>
                    {/* Header mit Icon und Status Badge */}
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
                          if (isCancelled) return '#dc3545'; // Rot für abgesagt
                          if (isPastEvent) return '#6c757d'; // Grau für vergangen
                          if (calculateRegistrationStatus(event) === 'open') return '#007aff'; // Blau für offen
                          return '#fd7e14'; // Orange für bald/geschlossen
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
                            if (isCancelled) return close; // X für abgesagt
                            if (isPastEvent) return checkmarkCircle; // Häkchen für vergangen
                            if (calculateRegistrationStatus(event) === 'open') return checkmarkCircle; // Häkchen für offen
                            return hourglass; // Sanduhr für bald/geschlossen
                          })()}
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
                        color: isCancelled ? '#999' : isPastEvent ? '#999' : '#333',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
                        marginRight: '110px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {event.name}
                        {event.is_series && (
                          <IonIcon
                            icon={copy}
                            style={{
                              fontSize: '0.8rem',
                              color: '#007aff',
                              marginLeft: '6px',
                              opacity: 0.7
                            }}
                          />
                        )}
                      </h2>

                      {/* Status Badge */}
                      <span style={{
                        fontSize: '0.7rem',
                        color: (() => {
                          const status = calculateRegistrationStatus(event);
                          if (isCancelled) return '#dc3545';
                          if (status === 'open') return '#007aff';
                          if (status === 'upcoming') return '#fd7e14';
                          return '#dc3545';
                        })(),
                        fontWeight: '600',
                        backgroundColor: (() => {
                          const status = calculateRegistrationStatus(event);
                          if (isCancelled) return 'rgba(220, 38, 38, 0.15)';
                          if (status === 'open') return 'rgba(0, 122, 255, 0.15)';
                          if (status === 'upcoming') return 'rgba(253, 126, 20, 0.15)';
                          return 'rgba(220, 38, 38, 0.15)';
                        })(),
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: (() => {
                          const status = calculateRegistrationStatus(event);
                          if (isCancelled) return '1px solid rgba(220, 38, 38, 0.3)';
                          if (status === 'open') return '1px solid rgba(0, 122, 255, 0.3)';
                          if (status === 'upcoming') return '1px solid rgba(253, 126, 20, 0.3)';
                          return '1px solid rgba(220, 38, 38, 0.3)';
                        })(),
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        position: 'absolute',
                        right: '0px',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}>
                        {(() => {
                          const status = calculateRegistrationStatus(event);
                          if (isCancelled) return 'ABGESAGT';
                          if (status === 'open') return 'OFFEN';
                          if (status === 'upcoming') return 'BALD';
                          return 'GESCHLOSSEN';
                        })()}
                      </span>
                    </div>

                    {/* Datum und Zeit - Zeile 1 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      color: isPastEvent ? '#999' : '#666',
                      marginBottom: '6px',
                      marginLeft: '44px'
                    }}>
                      <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: isPastEvent ? '#999' : '#dc2626' }} />
                      <span style={{ fontWeight: '500', color: isPastEvent ? '#999' : '#333' }}>
                        {formatDate(event.event_date)}
                      </span>
                      <IonIcon icon={time} style={{ fontSize: '0.9rem', color: isPastEvent ? '#999' : '#ff6b35', marginLeft: '8px' }} />
                      <span style={{ color: isPastEvent ? '#999' : '#666' }}>
                        {formatTime(event.event_date)}
                      </span>
                    </div>

                    {/* Location - Zeile 2 */}
                    {event.location && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.8rem',
                        color: isPastEvent ? '#999' : '#666',
                        marginBottom: '6px',
                        marginLeft: '44px'
                      }}>
                        <IonIcon icon={location} style={{ fontSize: '0.8rem', color: isPastEvent ? '#999' : '#007aff' }} />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {/* Teilnehmer, Warteliste, Punkte - Zeile 3 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '0.8rem',
                      color: isPastEvent ? '#999' : '#666',
                      marginLeft: '44px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={people} style={{ fontSize: '0.8rem', color: isPastEvent ? '#999' : '#34c759' }} />
                        <span>{event.registered_count}/{event.max_participants}</span>
                      </div>
                      {event.waitlist_enabled && event.waitlist_count && event.waitlist_count > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={listOutline} style={{ fontSize: '0.8rem', color: isPastEvent ? '#999' : '#fd7e14' }} />
                          <span>{event.waitlist_count}/{event.max_waitlist_size || 10}</span>
                        </div>
                      )}
                      {event.points > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={trophy} style={{ fontSize: '0.8rem', color: isPastEvent ? '#999' : '#ff9500' }} />
                          <span>{event.points}P</span>
                        </div>
                      )}
                    </div>
                  </IonLabel>
                </IonItem>

                {(onDeleteEvent || onCopyEvent || onCancelEvent) && (
                  <IonItemOptions side="end">
                    {onCopyEvent && (
                      <IonItemOption 
                        color="primary" 
                        onClick={() => onCopyEvent(event)}
                      >
                        <IonIcon icon={copy} />
                      </IonItemOption>
                    )}
                    {onCancelEvent && (
                      <IonItemOption 
                        color="warning" 
                        onClick={() => onCancelEvent(event)}
                      >
                        <IonIcon icon={ban} />
                      </IonItemOption>
                    )}
                    {onDeleteEvent && (
                      <IonItemOption 
                        color="danger" 
                        onClick={() => onDeleteEvent(event)}
                      >
                        <IonIcon icon={trash} />
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                )}
              </IonItemSliding>
              );
            })}

            {filteredAndSortedEvents.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Events gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default EventsView;