import React, { useMemo } from 'react';
import {
  IonIcon,
  IonItem,
  IonList,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonItemSliding
} from '@ionic/react';
import {
  calendar,
  time,
  location,
  people,
  checkmarkCircle,
  hourglass,
  close,
  trophy,
  listOutline,
  calendarOutline,
  lockOpenOutline,
  shieldCheckmark,
  bagHandle,
  closeCircle
} from 'ionicons/icons';
import { SectionHeader, ListSection } from '../../shared';

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
  is_registered?: boolean;
  can_register?: boolean;
  attendance_status?: 'present' | 'absent' | null;
  cancelled?: boolean;
  waitlist_count?: number;
  waitlist_position?: number;
  registration_status_detail?: string;
  booking_status?: 'confirmed' | 'waitlist' | 'pending' | 'opted_out' | null;
  is_opted_out?: boolean;
  mandatory?: boolean;
  bring_items?: string;
}

interface EventsViewProps {
  events: Event[];
  activeTab: 'upcoming' | 'registered' | 'konfirmation';
  onTabChange: (tab: 'upcoming' | 'registered' | 'konfirmation') => void;
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

  const konfirmationEvents = useMemo(() =>
    events.filter(e => e.category_names?.toLowerCase().includes('konfirmation')),
  [events]);

  const nonKonfirmationEvents = useMemo(() =>
    events.filter(e => !e.category_names?.toLowerCase().includes('konfirmation')),
  [events]);

  const eventCounts = useMemo(() => ({
    all: events.length,
    upcoming: nonKonfirmationEvents.filter(e => new Date(e.event_date) >= new Date()).length,
    registered: events.filter(e => e.is_registered).length,
    registeredUpcoming: events.filter(e => e.is_registered && new Date(e.event_date) >= new Date()).length,
    registeredPast: events.filter(e => e.is_registered && new Date(e.event_date) < new Date()).length,
    konfirmation: konfirmationEvents.length,
    konfirmationUpcoming: konfirmationEvents.filter(e => new Date(e.event_date) >= new Date()).length,
    konfirmationRegistered: konfirmationEvents.filter(e => e.is_registered).length
  }), [events, konfirmationEvents, nonKonfirmationEvents]);

  const getStatLabelsAndCounts = () => {
    switch (activeTab) {
      case 'upcoming':
        return [
          { label: 'Gesamt', count: eventCounts.upcoming, icon: calendar },
          { label: 'Anstehend', count: nonKonfirmationEvents.filter(e => new Date(e.event_date) >= new Date() && !e.is_registered).length, icon: time },
          { label: 'Gebucht', count: nonKonfirmationEvents.filter(e => e.is_registered).length, icon: checkmarkCircle }
        ];
      case 'registered':
        return [
          { label: 'Gebucht', count: eventCounts.registered, icon: calendar },
          { label: 'Anstehend', count: eventCounts.registeredUpcoming, icon: time },
          { label: 'Vergangen', count: eventCounts.registeredPast, icon: checkmarkCircle }
        ];
      case 'konfirmation':
        return [
          { label: 'Gesamt', count: eventCounts.konfirmation, icon: calendar },
          { label: 'Anstehend', count: eventCounts.konfirmationUpcoming, icon: time },
          { label: 'Gebucht', count: eventCounts.konfirmationRegistered, icon: checkmarkCircle }
        ];
      default:
        return [
          { label: 'Gesamt', count: eventCounts.all, icon: calendar },
          { label: 'Anstehend', count: eventCounts.upcoming, icon: time },
          { label: 'Gebucht', count: eventCounts.registered, icon: checkmarkCircle }
        ];
    }
  };

  const statsData = getStatLabelsAndCounts();

  // Berechne Status-Infos für ein Event
  const getEventStatusInfo = (event: Event) => {
    const isPastEvent = new Date(event.event_date) < new Date();
    const isParticipated = isPastEvent && event.is_registered;
    const attendanceStatus = event.attendance_status;
    // Warteliste: booking_status kann 'waitlist' oder 'pending' sein (Backend sendet beides)
    const isOnWaitlist = event.booking_status === 'waitlist' || event.booking_status === 'pending';
    const isCancelled = event.cancelled;
    const isKonfirmationEvent = event.category_names?.toLowerCase().includes('konfirmation');
    // Ausstehend: vergangen, angemeldet (confirmed), aber noch keine attendance
    const isAusstehend = isPastEvent && event.is_registered && !isOnWaitlist && !attendanceStatus;

    // Pflicht-Events: eigene Status-Logik
    const isMandatory = event.mandatory;
    const isOptedOut = event.is_opted_out || event.booking_status === 'opted_out';

    // Bestimme Farbe - Konfirmation IMMER Lila (auch wenn angemeldet)
    let statusColor = '#fd7e14'; // Default: Orange
    if (isCancelled) statusColor = '#dc3545'; // Rot
    else if (isMandatory && isOptedOut) statusColor = '#dc2626'; // Rot - Abgemeldet
    else if (isMandatory && isPastEvent && attendanceStatus === 'present') statusColor = '#34c759'; // Gruen - Anwesend
    else if (isMandatory && isPastEvent && attendanceStatus === 'absent') statusColor = '#dc3545'; // Rot - Gefehlt
    else if (isMandatory && isPastEvent) statusColor = '#fd7e14'; // Orange - Ausstehend
    else if (isMandatory) statusColor = '#007aff'; // Blau - Pflicht (angemeldet)
    else if (isKonfirmationEvent && !isPastEvent) statusColor = '#5b21b6'; // Lila - Konfirmation (immer, auch wenn angemeldet)
    else if (isParticipated && attendanceStatus === 'present') statusColor = '#34c759'; // Gruen - Verbucht
    else if (isParticipated && attendanceStatus === 'absent') statusColor = '#dc3545'; // Rot - Verpasst
    else if (isAusstehend) statusColor = '#fd7e14'; // Orange - Ausstehend (auf Verbuchung wartend)
    else if (isOnWaitlist) statusColor = '#fd7e14'; // Orange - Warteliste
    else if (event.is_registered && !isPastEvent) statusColor = '#007aff'; // Blau - Angemeldet
    else if (isPastEvent) statusColor = '#6c757d'; // Grau - Vergangen
    else if (event.registration_status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants && event.waitlist_enabled) statusColor = '#fd7e14'; // Orange - Warteliste
    else if (event.registration_status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants) statusColor = '#dc3545'; // Rot - Ausgebucht
    else if (event.registration_status === 'open') statusColor = '#34c759'; // Gruen - Offen
    else if (event.registration_status === 'upcoming') statusColor = '#fd7e14'; // Orange - Bald
    else statusColor = '#dc3545'; // Rot - Geschlossen

    // Bestimme Text
    let statusText = 'Offen';
    if (isCancelled) statusText = 'Abgesagt';
    else if (isMandatory && isOptedOut) statusText = 'Abgemeldet';
    else if (isMandatory && isPastEvent && attendanceStatus === 'present') statusText = 'Anwesend';
    else if (isMandatory && isPastEvent && attendanceStatus === 'absent') statusText = 'Gefehlt';
    else if (isMandatory && isPastEvent) statusText = 'Ausstehend';
    else if (isMandatory) statusText = 'Pflicht';
    else if (isKonfirmationEvent && !isPastEvent) statusText = event.is_registered ? 'Angemeldet' : 'Konfirmation'; // Konfirmation Text
    else if (isParticipated && attendanceStatus === 'present') statusText = 'Verbucht';
    else if (isParticipated && attendanceStatus === 'absent') statusText = 'Verpasst';
    else if (isAusstehend) statusText = 'Ausstehend';
    else if (isOnWaitlist) statusText = `Warteliste (${event.waitlist_position || '?'})`;
    else if (event.is_registered && !isPastEvent) statusText = 'Angemeldet';
    else if (event.registration_status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants && event.waitlist_enabled) statusText = 'Warteliste';
    else if (event.registration_status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants) statusText = 'Ausgebucht';
    else if (event.registration_status === 'open') statusText = 'Offen';
    else if (event.registration_status === 'upcoming') statusText = 'Bald';
    else if (isPastEvent) statusText = 'Vergangen';
    else statusText = 'Geschlossen';

    // Bestimme Icon
    let statusIcon = calendar;
    if (isCancelled) statusIcon = close;
    else if (isMandatory && isOptedOut) statusIcon = closeCircle;
    else if (isMandatory) statusIcon = shieldCheckmark;
    else if (isParticipated && attendanceStatus === 'present') statusIcon = checkmarkCircle;
    else if (isParticipated && attendanceStatus === 'absent') statusIcon = close;
    else if (isAusstehend) statusIcon = hourglass;
    else if (isOnWaitlist) statusIcon = hourglass;
    else if (event.is_registered) statusIcon = checkmarkCircle;
    else if (isPastEvent) statusIcon = hourglass;
    else if (event.registration_status === 'open' && event.max_participants > 0 && event.registered_count >= event.max_participants) statusIcon = event.waitlist_enabled ? hourglass : close;
    else if (event.registration_status === 'open') statusIcon = lockOpenOutline;
    else statusIcon = time;

    const shouldGrayOut = isPastEvent && !isParticipated && !isAusstehend;

    return { statusColor, statusText, statusIcon, isPastEvent, shouldGrayOut, isParticipated };
  };

  // Filtere Events basierend auf aktivem Tab
  const getFilteredEvents = () => {
    switch (activeTab) {
      case 'upcoming':
        return nonKonfirmationEvents.filter(e => new Date(e.event_date) >= new Date());
      case 'registered':
        return events.filter(e => e.is_registered);
      case 'konfirmation':
        return konfirmationEvents;
      default:
        return events;
    }
  };

  const filteredEvents = getFilteredEvents();

  return (
    <div>
      <SectionHeader
        title="Deine Events"
        subtitle="Termine und Veranstaltungen"
        icon={calendar}
        preset="events"
        stats={statsData.map(s => ({ value: s.count, label: s.label }))}
      />

      {/* Tab Navigation - wie Admin */}
      <div className="app-segment-wrapper">
        <IonSegment
          value={activeTab}
          onIonChange={(e) => onTabChange(e.detail.value as any)}
        >
          <IonSegmentButton value="upcoming">
            <IonLabel>Anstehend</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="registered">
            <IonLabel>Meine</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="konfirmation">
            <IonLabel>Konfi</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {/* Events Liste */}
      <ListSection
        icon={calendarOutline}
        title="Events"
        count={filteredEvents.length}
        iconColorClass="events"
        isEmpty={filteredEvents.length === 0}
        emptyIcon={calendarOutline}
        emptyTitle="Keine Events gefunden"
        emptyMessage={
          activeTab === 'registered'
            ? 'Du bist noch für keine Events angemeldet'
            : activeTab === 'konfirmation'
            ? 'Keine Konfirmationstermine verfügbar'
            : 'Keine anstehenden Events'
        }
        emptyIconColor="#dc2626"
      >
        {filteredEvents.map((event, index) => {
          const { statusColor, statusText, statusIcon, isPastEvent, shouldGrayOut, isParticipated } = getEventStatusInfo(event);
          const isCancelled = event.cancelled;
          const isOptedOut = event.is_opted_out || event.booking_status === 'opted_out';
          const showBadge = !isPastEvent || isParticipated || isCancelled || isOptedOut;

          return (
            <IonItemSliding key={event.id} style={{ marginBottom: index < filteredEvents.length - 1 ? '8px' : '0' }}>
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
                  {showBadge && (
                    <div
                      className="app-corner-badge"
                      style={{ backgroundColor: statusColor }}
                    >
                      {statusText}
                    </div>
                  )}

                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      {/* Status Icon */}
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
                            paddingRight: showBadge ? '70px' : '0'
                          }}
                        >
                          {event.name}
                        </div>

                        {/* Zeile 2: Buchungen + Warteliste + Punkte */}
                        <div className="app-list-item__meta">
                          {!event.mandatory && (
                          <span className="app-list-item__meta-item">
                            <IonIcon icon={people} style={{ color: shouldGrayOut ? '#999' : '#34c759' }} />
                            {event.registered_count}/{event.max_participants}
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
                            <span className="app-list-item__meta-item" style={{ color: '#8b5cf6', fontWeight: '500' }}>
                              <IonIcon icon={bagHandle} style={{ color: '#8b5cf6' }} />
                              {event.bring_items}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </IonItem>
            </IonItemSliding>
          );
        })}
      </ListSection>
    </div>
  );
};

export default EventsView;
