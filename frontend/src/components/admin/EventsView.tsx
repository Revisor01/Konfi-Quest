import React, { useState, useRef } from 'react';
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
  flash,
  people,
  calendar,
  time,
  location,
  hourglass,
  copy,
  ban,
  trash,
  checkmarkCircle,
  close,
  trophy,
  listOutline,
  calendarOutline,
  lockOpenOutline,
  shieldCheckmark,
  bagHandle,
  attachOutline
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';
import { parseLocalTime, getLocalNow } from '../../utils/dateUtils';
import { SectionHeader, ListSection } from '../shared';

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
  mandatory?: boolean;
  bring_items?: string;
  teamer_count?: number;
  teamer_needed?: boolean;
  teamer_only?: boolean;
  jahrgang_names?: string;
  material_count?: number;
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
      <SectionHeader
        title="Events"
        subtitle="Termine und Veranstaltungen"
        icon={calendar}
        preset="events"
        stats={[
          { value: events.length, label: 'Gesamt' },
          { value: getUpcomingEvents().length, label: 'Anstehend' },
          { value: events.reduce((sum, e) => sum + e.registered_count, 0), label: 'Gebucht' }
        ]}
      />


      {/* Tab Navigation - einfaches IonSegment */}
      {onTabChange && (
        <div className="app-segment-wrapper">
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

      {/* Events Liste */}
      <ListSection
        icon={calendarOutline}
        title="Events"
        count={filteredAndSortedEvents.length}
        iconColorClass="events"
        isEmpty={filteredAndSortedEvents.length === 0}
        emptyIcon={calendarOutline}
        emptyTitle="Keine Events gefunden"
        emptyMessage={
          activeTab === 'konfirmation'
            ? 'Keine Konfirmationstermine verfügbar'
            : activeTab === 'all'
            ? 'Noch keine Events erstellt'
            : 'Keine anstehenden Events'
        }
        emptyIconColor="#dc2626"
      >
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
                if (event.mandatory && isPastEvent && hasUnprocessedBookings) return '#007aff';
                if (event.mandatory && isPastEvent) return '#6c757d';
                if (event.mandatory) return '#dc2626'; // Rot - Pflicht
                if (isKonfirmationEvent && !isPastEvent) return '#5b21b6'; // Lila für Konfirmation
                if (isFullyProcessed) return '#6c757d';
                if (hasUnprocessedBookings) return '#007aff'; // Blau für Verbuchen
                if (isPastEvent) return '#6c757d';
                if (calculateRegistrationStatus(event) === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants && event.waitlist_enabled) return '#fd7e14'; // Orange - Warteliste
                if (calculateRegistrationStatus(event) === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants) return '#dc3545'; // Rot - Ausgebucht
                if (calculateRegistrationStatus(event) === 'open') return '#34c759';
                if (calculateRegistrationStatus(event) === 'upcoming') return '#fd7e14'; // Orange für Bald
                return '#dc3545';
              })();

              // Status-Text
              const statusText = (() => {
                if (isCancelled) return 'Abgesagt';
                if (event.mandatory && hasUnprocessedBookings) return 'Verbuchen';
                if (event.mandatory && isFullyProcessed) return 'Verbucht';
                if (event.mandatory) return 'Pflicht';
                if (hasUnprocessedBookings) return 'Verbuchen';
                if (isFullyProcessed) return 'Verbucht';
                if (isKonfirmationEvent && !isPastEvent) return 'Konfirmation';
                const status = calculateRegistrationStatus(event);
                if (status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants && event.waitlist_enabled) return 'Warteliste';
                if (status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants) return 'Ausgebucht';
                if (status === 'open') return 'Offen';
                if (status === 'upcoming') return 'Bald';
                return 'Geschlossen';
              })();

              // Icon basierend auf Status
              const statusIcon = (() => {
                if (isCancelled) return close;
                if (event.mandatory && !isPastEvent) return shieldCheckmark;
                if (isFullyProcessed) return checkmarkCircle;
                if (hasUnprocessedBookings) return flash; // Blitz-Icon für "Verbuchen"
                if (isPastEvent) return checkmarkCircle;
                if (calculateRegistrationStatus(event) === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants) return event.waitlist_enabled ? hourglass : close;
                if (calculateRegistrationStatus(event) === 'open') return lockOpenOutline; // Offen = Schloss offen
                return time; // "Bald" = Uhr-Icon
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
                      opacity: shouldGrayOut ? 0.6 : 1,
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
                              gap: '6px',
                              paddingRight: '70px'
                            }}
                          >
                            {event.name}
                            {event.is_series && (
                              <IonIcon icon={copy} style={{ fontSize: '0.8rem', color: '#007aff', opacity: 0.7, flexShrink: 0 }} />
                            )}
                          </div>
                          {event.jahrgang_names && (
                            <div className="app-list-item__subtitle" style={{ color: shouldGrayOut ? '#999' : undefined }}>
                              {event.jahrgang_names.split(',').join(' \u00B7 ')}
                            </div>
                          )}

                          {/* Zeile 2: Buchungen + Teamer + Warteliste + Punkte */}
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={people} style={{ color: shouldGrayOut ? '#999' : '#34c759' }} />
                              {event.mandatory
                                ? `${event.registered_count - (event.teamer_count || 0)} Konfis`
                                : `${event.registered_count - (event.teamer_count || 0)}/${(event.max_participants || 0) > 0 ? event.max_participants : '\u221E'}`
                              }
                            </span>
                            {(event.teamer_count || 0) > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={people} style={{ color: shouldGrayOut ? '#999' : '#5b21b6' }} />
                                {event.teamer_count} Team
                              </span>
                            )}
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

                          {/* Zeile 3: Datum + Uhrzeit */}
                          <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={calendar} style={{ color: shouldGrayOut ? '#999' : '#dc2626' }} />
                              {formatDate(event.event_date)}
                            </span>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={time} style={{ color: shouldGrayOut ? '#999' : '#ff6b35' }} />
                              {formatTime(event.event_date)}
                            </span>
                          </div>

                          {/* Zeile 4: Ort (eigene Zeile) */}
                          {event.location && (
                            <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={location} style={{ color: shouldGrayOut ? '#999' : '#007aff' }} />
                                {event.location}
                              </span>
                            </div>
                          )}
                          {/* Zeile 5: Was mitbringen */}
                          {event.bring_items && (
                            <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={bagHandle} style={{ color: shouldGrayOut ? '#999' : '#8b5cf6' }} />
                                {event.bring_items}
                              </span>
                            </div>
                          )}
                          {/* Zeile 6: Material */}
                          {(event.material_count || 0) > 0 && (
                            <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={attachOutline} style={{ color: shouldGrayOut ? '#999' : '#d97706' }} />
                                {event.material_count} {event.material_count === 1 ? 'Material' : 'Materialien'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {(onDeleteEvent || onCancelEvent) && (
                  <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                    {onCancelEvent && (
                      <IonItemOption
                        onClick={() => onCancelEvent(event)}
                        style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                      >
                        <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                          <IonIcon icon={ban} />
                        </div>
                      </IonItemOption>
                    )}
                    {onDeleteEvent && (
                      <IonItemOption
                        onClick={() => onDeleteEvent(event)}
                        style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                      >
                        <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                          <IonIcon icon={trash} />
                        </div>
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                )}
              </IonItemSliding>
              );
            })}
      </ListSection>
    </>
  );
};

export default EventsView;