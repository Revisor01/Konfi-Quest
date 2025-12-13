import React, { useState, useRef } from 'react';
import {
  IonCard,
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
  IonListHeader,
  IonItemGroup,
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
  listOutline,
  calendarOutline,
  filterOutline
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
  pending_bookings_count?: number;
}

interface EventsViewProps {
  events: Event[];
  onUpdate: () => void;
  onAddEventClick: () => void;
  onSelectEvent: (event: Event) => void;
  onDeleteEvent?: (event: Event) => void;
  onCopyEvent?: (event: Event) => void;
  onCancelEvent?: (event: Event) => void;
  activeTab?: 'all' | 'upcoming' | 'konfirmation';
  onTabChange?: (tab: 'all' | 'upcoming' | 'konfirmation') => void;
  eventCounts?: {
    all: number;
    upcoming: number;
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

  // Events werden bereits von der Page sortiert übergeben
  const filteredAndSortedEvents = events;

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


      {/* Tab Navigation - IonList Pattern */}
      {onTabChange && (
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#dc2626',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px'
            }}>
              <IonIcon icon={filterOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
            </div>
            <IonLabel>Filter</IonLabel>
          </IonListHeader>
          <IonItemGroup>
            <IonItem
              button={false}
              style={{
                '--background-activated': 'transparent',
                '--background-focused': 'transparent',
                '--background-hover': 'transparent',
                '--ripple-color': 'transparent'
              }}
            >
              <IonSegment
                value={activeTab}
                onIonChange={(e) => onTabChange(e.detail.value as any)}
                style={{
                  '--background': 'transparent',
                  borderRadius: '12px',
                  padding: '0',
                  width: '100%',
                  boxShadow: 'none'
                }}
              >
                <IonSegmentButton value="upcoming">
                  <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Aktuell</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="all">
                  <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Alle</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="konfirmation">
                  <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Konfi</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </IonItem>
          </IonItemGroup>
        </IonList>
      )}

      {/* Events Liste - IonListHeader Pattern */}
      {filteredAndSortedEvents.length > 0 && (
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div style={{
            width: '24px',
            height: '24px',
            backgroundColor: '#dc2626',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '8px'
          }}>
            <IonIcon icon={calendarOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
          </div>
          <IonLabel>Events ({filteredAndSortedEvents.length})</IonLabel>
        </IonListHeader>
        <IonCard style={{ margin: '0' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent', padding: '0' }}>
            {filteredAndSortedEvents.map((event) => {
              const isPastEvent = new Date(event.event_date) < new Date();
              const isCancelled = event.registration_status === 'cancelled';
              const isKonfirmationEvent = event.category_names?.toLowerCase().includes('konfirmation');
              const hasUnprocessedBookings = isPastEvent && event.registered_count > 0 && event.pending_bookings_count && event.pending_bookings_count > 0;
              const isFullyProcessed = isPastEvent && event.registered_count > 0 && (!event.pending_bookings_count || event.pending_bookings_count === 0);
              const shouldGrayOut = isPastEvent && !hasUnprocessedBookings;

              return (
              <IonItemSliding key={event.id}>
                <IonItem
                  button
                  onClick={() => onSelectEvent(event)}
                  detail={false}
                  style={{
                    '--min-height': '110px',
                    '--padding-start': '16px',
                    '--padding-top': '0px',
                    '--padding-bottom': '0px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '4px 8px',
                    boxShadow: isCancelled ? '0 2px 8px rgba(239, 68, 68, 0.2)' : isKonfirmationEvent ? '0 2px 8px rgba(139, 92, 246, 0.15)' : '0 2px 8px rgba(0,0,0,0.06)',
                    border: isCancelled ? '1px solid #fca5a5' : isKonfirmationEvent ? '1px solid #c4b5fd' : '1px solid #e0e0e0',
                    borderRadius: '12px',
                    opacity: shouldGrayOut ? 0.6 : 1
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
                      <div style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: (() => {
                          if (isCancelled) return '#dc3545'; // Rot für abgesagt
                          if (isFullyProcessed) return '#6c757d'; // Grau für vollständig verbucht
                          if (hasUnprocessedBookings) return '#ff6b35'; // Orange für zu verbuchen
                          if (isPastEvent) return '#6c757d'; // Grau für vergangen ohne Teilnehmer
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
                            if (isFullyProcessed) return checkmarkCircle; // Häkchen für vollständig verbucht
                            if (hasUnprocessedBookings) return hourglass; // Sanduhr für zu verbuchen
                            if (isPastEvent) return checkmarkCircle; // Häkchen für vergangen ohne Teilnehmer
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
                        color: isCancelled ? '#999' : shouldGrayOut ? '#999' : '#333',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: 0,
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

                      {/* Status Badge - vereinfacht, nur ein Badge */}
                      <div style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center',
                        flexShrink: 0
                      }}>
                        <span style={{
                          fontSize: '0.7rem',
                          color: (() => {
                            if (isCancelled) return '#dc3545';
                            if (hasUnprocessedBookings) return '#ff6b35'; // Orange für zu verbuchen
                            if (isFullyProcessed) return '#34c759'; // Grün für verbucht
                            const status = calculateRegistrationStatus(event);
                            if (status === 'open') return '#007aff';
                            if (status === 'upcoming') return '#fd7e14';
                            return '#dc3545'; // Geschlossen
                          })(),
                          fontWeight: '600',
                          backgroundColor: (() => {
                            if (isCancelled) return 'rgba(220, 38, 38, 0.15)';
                            if (hasUnprocessedBookings) return 'rgba(255, 107, 53, 0.15)';
                            if (isFullyProcessed) return 'rgba(52, 199, 89, 0.15)';
                            const status = calculateRegistrationStatus(event);
                            if (status === 'open') return 'rgba(0, 122, 255, 0.15)';
                            if (status === 'upcoming') return 'rgba(253, 126, 20, 0.15)';
                            return 'rgba(220, 38, 38, 0.15)';
                          })(),
                          padding: '3px 6px',
                          borderRadius: '6px',
                          border: (() => {
                            if (isCancelled) return '1px solid rgba(220, 38, 38, 0.3)';
                            if (hasUnprocessedBookings) return '1px solid rgba(255, 107, 53, 0.3)';
                            if (isFullyProcessed) return '1px solid rgba(52, 199, 89, 0.3)';
                            const status = calculateRegistrationStatus(event);
                            if (status === 'open') return '1px solid rgba(0, 122, 255, 0.3)';
                            if (status === 'upcoming') return '1px solid rgba(253, 126, 20, 0.3)';
                            return '1px solid rgba(220, 38, 38, 0.3)';
                          })(),
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {(() => {
                            if (isCancelled) return 'ABGESAGT';
                            if (hasUnprocessedBookings) return 'VERBUCHEN';
                            if (isFullyProcessed) return 'VERBUCHT';
                            const status = calculateRegistrationStatus(event);
                            if (status === 'open') return 'OFFEN';
                            if (status === 'upcoming') return 'BALD';
                            return 'GESCHLOSSEN';
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Datum und Zeit - Zeile 1 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      color: shouldGrayOut ? '#999' : '#666',
                      marginBottom: '4px',
                      marginLeft: '44px'
                    }}>
                      <IonIcon icon={calendar} style={{ fontSize: '0.9rem', color: shouldGrayOut ? '#999' : '#dc2626' }} />
                      <span style={{ fontWeight: '500', color: shouldGrayOut ? '#999' : '#333' }}>
                        {formatDate(event.event_date)}
                      </span>
                      <IonIcon icon={time} style={{ fontSize: '0.9rem', color: shouldGrayOut ? '#999' : '#ff6b35', marginLeft: '8px' }} />
                      <span style={{ color: shouldGrayOut ? '#999' : '#666' }}>
                        {formatTime(event.event_date)}
                      </span>
                    </div>

                    {/* Location, Teilnehmer, Warteliste, Punkte - Zeile 2 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '0.8rem',
                      color: shouldGrayOut ? '#999' : '#666',
                      marginLeft: '44px'
                    }}>
                      {event.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={location} style={{ fontSize: '0.8rem', color: shouldGrayOut ? '#999' : '#007aff' }} />
                          <span>{event.location}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={people} style={{ fontSize: '0.8rem', color: shouldGrayOut ? '#999' : '#34c759' }} />
                        <span>{event.registered_count}/{event.max_participants}</span>
                        {event.waitlist_enabled && (event.waitlist_count ?? 0) > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '8px' }}>
                            <IonIcon icon={listOutline} style={{ fontSize: '0.7rem', color: shouldGrayOut ? '#999' : '#fd7e14' }} />
                            <span style={{ color: shouldGrayOut ? '#999' : '#666' }}>{event.waitlist_count}/{event.max_waitlist_size || 10}</span>
                          </span>
                        )}
                      </div>
                      {event.points > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={trophy} style={{ fontSize: '0.8rem', color: shouldGrayOut ? '#999' : '#ff9500' }} />
                          <span>{event.points}P</span>
                        </div>
                      )}
                    </div>
                  </IonLabel>
                </IonItem>

                {(onDeleteEvent || onCancelEvent) && (
                  <IonItemOptions side="end" style={{
                    gap: '4px',
                    '--ion-item-background': 'transparent'
                  }}>
                    {onCancelEvent && (
                      <IonItemOption
                        onClick={() => onCancelEvent(event)}
                        style={{
                          '--background': 'transparent',
                          '--background-activated': 'transparent',
                          '--background-focused': 'transparent',
                          '--background-hover': 'transparent',
                          '--color': 'transparent',
                          '--ripple-color': 'transparent',
                          padding: '0 2px',
                          minWidth: '48px',
                          maxWidth: '48px'
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          backgroundColor: '#ff9500',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                        }}>
                          <IonIcon icon={ban} style={{ fontSize: '1.2rem', color: 'white' }} />
                        </div>
                      </IonItemOption>
                    )}
                    {onDeleteEvent && (
                      <IonItemOption
                        onClick={() => onDeleteEvent(event)}
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
                )}
              </IonItemSliding>
              );
            })}
          </IonList>
        </IonCardContent>
        </IonCard>
      </IonList>
      )}

      {/* Keine Events gefunden */}
      {filteredAndSortedEvents.length === 0 && (
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#dc2626',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px'
            }}>
              <IonIcon icon={calendarOutline} style={{ color: 'white', fontSize: '0.8rem' }} />
            </div>
            <IonLabel>Events (0)</IonLabel>
          </IonListHeader>
          <IonCard style={{ margin: '0' }}>
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
                  {activeTab === 'konfirmation'
                    ? 'Keine Konfirmationstermine verfuegbar'
                    : activeTab === 'all'
                    ? 'Noch keine Events erstellt'
                    : 'Keine anstehenden Events'
                  }
                </p>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
      )}
    </>
  );
};

export default EventsView;