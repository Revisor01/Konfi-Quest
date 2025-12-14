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
  filterOutline,
  lockOpenOutline
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


      {/* Tab Navigation - einfaches IonSegment */}
      {onTabChange && (
        <div style={{ margin: '16px' }}>
          <IonSegment
            value={activeTab}
            onIonChange={(e) => onTabChange(e.detail.value as any)}
          >
            <IonSegmentButton value="upcoming">
              <IonLabel>Aktuell</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="all">
              <IonLabel>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="konfirmation">
              <IonLabel>Konfi</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>
      )}

      {/* Events Liste - IonListHeader Pattern */}
      {filteredAndSortedEvents.length > 0 && (
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--events">
            <IonIcon icon={calendarOutline} />
          </div>
          <IonLabel>Events ({filteredAndSortedEvents.length})</IonLabel>
        </IonListHeader>
        <IonCard className="app-card">
        <IonCardContent style={{ padding: '16px' }}>
          <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
            {filteredAndSortedEvents.map((event, index) => {
              const isPastEvent = new Date(event.event_date) < new Date();
              const isCancelled = event.registration_status === 'cancelled';
              const isKonfirmationEvent = event.category_names?.toLowerCase().includes('konfirmation');
              const hasUnprocessedBookings = isPastEvent && event.registered_count > 0 && event.pending_bookings_count && event.pending_bookings_count > 0;
              const isFullyProcessed = isPastEvent && event.registered_count > 0 && (!event.pending_bookings_count || event.pending_bookings_count === 0);
              const shouldGrayOut = isPastEvent && !hasUnprocessedBookings;

              // Farbe basierend auf Status - Konfirmation in Lila!
              const statusColor = (() => {
                if (isCancelled) return '#dc3545';
                if (isKonfirmationEvent && !isPastEvent) return '#8b5cf6'; // Lila fuer Konfirmation
                if (isFullyProcessed) return '#6c757d';
                if (hasUnprocessedBookings) return '#ff6b35';
                if (isPastEvent) return '#6c757d';
                if (calculateRegistrationStatus(event) === 'open') return '#34c759';
                if (calculateRegistrationStatus(event) === 'upcoming') return '#fd7e14';
                return '#dc3545';
              })();

              // Status-Text
              const statusText = (() => {
                if (isCancelled) return 'Abgesagt';
                if (hasUnprocessedBookings) return 'Verbuchen';
                if (isFullyProcessed) return 'Verbucht';
                if (isKonfirmationEvent && !isPastEvent) return 'Konfirmation';
                const status = calculateRegistrationStatus(event);
                if (status === 'open') return 'Offen';
                if (status === 'upcoming') return 'Bald';
                return 'Geschlossen';
              })();

              // Icon basierend auf Status
              const statusIcon = (() => {
                if (isCancelled) return close;
                if (isFullyProcessed) return checkmarkCircle;
                if (hasUnprocessedBookings) return hourglass;
                if (isPastEvent) return checkmarkCircle;
                if (calculateRegistrationStatus(event) === 'open') return lockOpenOutline; // Offen = Schloss offen
                return hourglass;
              })();

              return (
              <IonItemSliding key={event.id} style={{ marginBottom: index < filteredAndSortedEvents.length - 1 ? '8px' : '0' }}>
                <IonItem
                  button
                  onClick={() => onSelectEvent(event)}
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
                    className="app-list-item app-list-item--events"
                    style={{
                      width: '100%',
                      borderLeftColor: statusColor,
                      opacity: shouldGrayOut ? 0.6 : 1
                    }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        {/* Icon */}
                        <div
                          className="app-icon-circle app-icon-circle--lg"
                          style={{ backgroundColor: statusColor }}
                        >
                          <IonIcon icon={statusIcon} />
                        </div>

                        {/* Content */}
                        <div className="app-list-item__content">
                          {/* Zeile 1: Titel */}
                          <div
                            className="app-list-item__title"
                            style={{
                              color: isCancelled || shouldGrayOut ? '#999' : undefined,
                              textDecoration: isCancelled ? 'line-through' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {event.name}
                            {event.is_series && (
                              <IonIcon icon={copy} style={{ fontSize: '0.8rem', color: '#007aff', opacity: 0.7, flexShrink: 0 }} />
                            )}
                          </div>

                          {/* Zeile 2: Buchungen + Warteliste + Punkte */}
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={people} style={{ color: shouldGrayOut ? '#999' : '#34c759' }} />
                              {event.registered_count}/{event.max_participants}
                            </span>
                            {event.waitlist_enabled && (event.waitlist_count ?? 0) > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={listOutline} style={{ color: shouldGrayOut ? '#999' : '#fd7e14' }} />
                                {event.waitlist_count}/{event.max_waitlist_size || 10}
                              </span>
                            )}
                            {event.points > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={trophy} style={{ color: shouldGrayOut ? '#999' : '#ff9500' }} />
                                {event.points}P
                              </span>
                            )}
                          </div>

                          {/* Zeile 3: Datum + Uhrzeit + Ort */}
                          <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={calendar} style={{ color: shouldGrayOut ? '#999' : '#dc2626' }} />
                              {formatDate(event.event_date)}
                            </span>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={time} style={{ color: shouldGrayOut ? '#999' : '#ff6b35' }} />
                              {formatTime(event.event_date)}
                            </span>
                            {event.location && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={location} style={{ color: shouldGrayOut ? '#999' : '#007aff' }} />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status-Chip rechts außen */}
                      <span
                        className="app-chip"
                        style={{
                          backgroundColor: `${statusColor}20`,
                          color: statusColor
                        }}
                      >
                        {statusText}
                      </span>
                    </div>
                  </div>
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
                          paddingLeft: '12px',
                          minWidth: '48px',
                          maxWidth: '60px'
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
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={calendarOutline} />
            </div>
            <IonLabel>Events (0)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
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