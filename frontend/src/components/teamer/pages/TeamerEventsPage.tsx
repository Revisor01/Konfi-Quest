import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonFab,
  IonFabButton,
  IonItem,
  IonItemSliding,
  IonButtons,
  IonBackButton,
  useIonModal
} from '@ionic/react';
import {
  calendar,
  time,
  location,
  people,
  checkmarkCircle,
  closeCircle,
  hourglass,
  calendarOutline,
  arrowBack,
  trophy,
  bagHandle,
  qrCodeOutline,
  navigateOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { SectionHeader, ListSection } from '../../shared';
import EmptyState from '../../shared/EmptyState';
import LoadingSpinner from '../../common/LoadingSpinner';
import QRScannerModal from '../../konfi/modals/QRScannerModal';

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
  is_registered?: boolean;
  can_register?: boolean;
  attendance_status?: 'present' | 'absent' | null;
  booking_status?: 'confirmed' | 'waitlist' | 'pending' | 'opted_out' | null;
  mandatory?: boolean;
  bring_items?: string;
  teamer_needed?: boolean;
  teamer_only?: boolean;
  teamer_count?: number;
}

const TeamerEventsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meine' | 'alle' | 'team'>('meine');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // QR Scanner Modal
  const [presentScannerModal, dismissScannerModal] = useIonModal(QRScannerModal, {
    onClose: () => dismissScannerModal(),
    onSuccess: (_eventId: number, eventName: string) => {
      dismissScannerModal();
      setSuccess(`Eingecheckt bei: ${eventName}`);
      loadEvents();
    }
  });

  const refreshEvents = useCallback(() => {
    loadEvents();
  }, []);

  useLiveRefresh('events', refreshEvents);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/events');
      setEvents(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  // Formatierung
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

  // Sortierung: naechstes Event zuerst, vergangene am Ende
  const sortEvents = (eventsList: Event[]) => {
    const now = new Date();
    return [...eventsList].sort((a, b) => {
      const dateA = new Date(a.event_date);
      const dateB = new Date(b.event_date);
      const isPastA = dateA < now;
      const isPastB = dateB < now;

      if ((isPastA && isPastB) || (!isPastA && !isPastB)) {
        return dateA.getTime() - dateB.getTime();
      }
      if (!isPastA && isPastB) return -1;
      if (isPastA && !isPastB) return 1;
      return 0;
    });
  };

  // Gefilterte Events per Segment
  const meineEvents = useMemo(() =>
    sortEvents(events.filter(e => e.is_registered)),
  [events]);

  const alleEvents = useMemo(() =>
    sortEvents(events.filter(e => !e.teamer_only)),
  [events]);

  const teamEvents = useMemo(() =>
    sortEvents(events.filter(e => e.teamer_needed || e.teamer_only)),
  [events]);

  const getFilteredEvents = () => {
    switch (activeTab) {
      case 'meine': return meineEvents;
      case 'alle': return alleEvents;
      case 'team': return teamEvents;
      default: return events;
    }
  };

  const filteredEvents = getFilteredEvents();

  // Stats
  const eventCounts = useMemo(() => ({
    gesamt: events.length,
    anstehend: events.filter(e => new Date(e.event_date) >= new Date()).length,
    gebucht: events.filter(e => e.is_registered).length
  }), [events]);

  const statsData = [
    { value: eventCounts.gesamt, label: 'Gesamt' },
    { value: eventCounts.anstehend, label: 'Anstehend' },
    { value: eventCounts.gebucht, label: 'Gebucht' }
  ];

  // Status-Infos fuer Event-Karten
  const getEventStatusInfo = (event: Event) => {
    const isPastEvent = new Date(event.event_date) < new Date();
    const isTeamerEvent = event.teamer_needed || event.teamer_only;

    let statusColor = '#fd7e14';
    let statusText = 'Offen';
    let statusIcon = calendar;

    if (isPastEvent && event.is_registered) {
      if (event.attendance_status === 'present') {
        statusColor = '#34c759';
        statusText = 'Anwesend';
        statusIcon = checkmarkCircle;
      } else if (event.attendance_status === 'absent') {
        statusColor = '#dc3545';
        statusText = 'Abwesend';
        statusIcon = closeCircle;
      } else {
        statusColor = '#fd7e14';
        statusText = 'Ausstehend';
        statusIcon = hourglass;
      }
    } else if (event.is_registered && !isPastEvent) {
      statusColor = '#007aff';
      statusText = 'Dabei';
      statusIcon = checkmarkCircle;
    } else if (isPastEvent) {
      statusColor = '#6c757d';
      statusText = 'Vergangen';
      statusIcon = hourglass;
    } else if (isTeamerEvent) {
      statusColor = '#5b21b6';
      statusText = 'Offen';
      statusIcon = calendar;
    }

    const shouldGrayOut = isPastEvent && !event.is_registered;

    return { statusColor, statusText, statusIcon, isPastEvent, shouldGrayOut };
  };

  // Buchung/Storno
  const handleBook = async (event: Event) => {
    setBookingLoading(true);
    try {
      await api.post(`/events/${event.id}/book`);
      setSuccess('Du bist dabei!');
      await loadEvents();
      // Update selectedEvent
      const updated = (await api.get('/events')).data.find((e: Event) => e.id === event.id);
      if (updated) setSelectedEvent(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Buchung');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleUnbook = async (event: Event) => {
    setBookingLoading(true);
    try {
      await api.delete(`/events/${event.id}/book`);
      setSuccess('Du bist nicht mehr dabei');
      await loadEvents();
      const updated = (await api.get('/events')).data.find((e: Event) => e.id === event.id);
      if (updated) setSelectedEvent(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Stornieren');
    } finally {
      setBookingLoading(false);
    }
  };

  // Leere-Segment Texte
  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'meine': return 'Du bist noch bei keinem Event dabei';
      case 'alle': return 'Keine Events vorhanden';
      case 'team': return 'Keine Events für Teamer:innen verfügbar';
      default: return 'Keine Events';
    }
  };

  // Event Detail Ansicht
  if (selectedEvent) {
    const isTeamerEvent = selectedEvent.teamer_needed || selectedEvent.teamer_only;
    const isPast = new Date(selectedEvent.event_date) < new Date();

    return (
      <IonPage>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setSelectedEvent(null)}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
            </IonButtons>
            <IonTitle>{selectedEvent.name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="app-gradient-background" fullscreen>
          <IonHeader collapse="condense">
            <IonToolbar className="app-condense-toolbar">
              <IonTitle size="large">{selectedEvent.name}</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonRefresher slot="fixed" onIonRefresh={async (e) => {
            await loadEvents();
            const updated = events.find(ev => ev.id === selectedEvent.id);
            if (updated) setSelectedEvent(updated);
            e.detail.complete();
          }}>
            <IonRefresherContent />
          </IonRefresher>

          {/* Event Info */}
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={calendar} />
              </div>
              <IonLabel>Details</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {/* Beschreibung */}
                {selectedEvent.description && (
                  <div className="app-info-row">
                    <div className="app-info-row__content">
                      {selectedEvent.description}
                    </div>
                  </div>
                )}

                {/* Datum */}
                <div className="app-info-row">
                  <IonIcon icon={calendar} className="app-info-row__icon app-icon-color--events" />
                  <div>
                    <div className="app-info-row__content app-list-item__title">
                      {formatDate(selectedEvent.event_date)}
                    </div>
                    <div className="app-info-row__sublabel">
                      {formatTime(selectedEvent.event_date)}
                      {selectedEvent.event_end_time && ` - ${formatTime(selectedEvent.event_end_time)}`}
                    </div>
                  </div>
                </div>

                {/* Ort */}
                {selectedEvent.location && (
                  <div className="app-info-row">
                    <IonIcon icon={location} className="app-info-row__icon app-icon-color--events" />
                    <div
                      className="app-info-row__content app-event-detail__location-link"
                      onClick={() => {
                        if (selectedEvent.location_maps_url) {
                          window.open(selectedEvent.location_maps_url, '_blank');
                        } else if (selectedEvent.location) {
                          window.open(`https://maps.apple.com/?q=${encodeURIComponent(selectedEvent.location)}`, '_blank');
                        }
                      }}
                    >
                      {selectedEvent.location}
                    </div>
                  </div>
                )}

                {/* Teilnehmer */}
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon app-icon-color--participants" />
                  <div className="app-info-row__content">
                    {selectedEvent.registered_count} Konfis
                    {(selectedEvent.teamer_count !== undefined && selectedEvent.teamer_count > 0) && (
                      <> + {selectedEvent.teamer_count} Teamer:innen</>
                    )}
                  </div>
                </div>

                {/* Kategorie */}
                {selectedEvent.category_names && (
                  <div className="app-info-row">
                    <IonIcon icon={trophy} className="app-info-row__icon app-icon-color--badges" />
                    <div className="app-info-row__content">
                      {selectedEvent.category_names}
                    </div>
                  </div>
                )}

                {/* Was mitbringen */}
                {selectedEvent.bring_items && (
                  <div className="app-info-row">
                    <IonIcon icon={bagHandle} className="app-info-row__icon" style={{ color: '#8b5cf6' }} />
                    <div>
                      <div className="app-info-row__content app-list-item__title">Was mitbringen</div>
                      <div className="app-info-row__sublabel">{selectedEvent.bring_items}</div>
                    </div>
                  </div>
                )}

                {/* Teamer-Status Badge */}
                {isTeamerEvent && (
                  <div className="app-info-row">
                    <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                    <div className="app-info-row__content" style={{ fontWeight: '600', color: '#5b21b6' }}>
                      {selectedEvent.teamer_only ? 'Nur Teamer:innen' : 'Teamer:innen gesucht'}
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>

          {/* Buchungsbereich */}
          {!isPast && (
            <IonList className="app-section-inset" inset={true}>
              <IonCard className="app-card">
                <IonCardContent className="app-card-content">
                  {isTeamerEvent ? (
                    selectedEvent.is_registered ? (
                      <IonButton
                        expand="block"
                        color="danger"
                        onClick={() => handleUnbook(selectedEvent)}
                        disabled={bookingLoading}
                      >
                        {bookingLoading ? 'Wird verarbeitet...' : 'Nicht mehr dabei'}
                      </IonButton>
                    ) : (
                      <IonButton
                        expand="block"
                        onClick={() => handleBook(selectedEvent)}
                        disabled={bookingLoading}
                      >
                        {bookingLoading ? 'Wird verarbeitet...' : 'Ich bin dabei'}
                      </IonButton>
                    )
                  ) : (
                    <div style={{ textAlign: 'center', color: '#666', padding: '8px 0' }}>
                      Dieses Event ist nur für Konfis buchbar
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>
          )}

          {/* Vergangenes Event: Anwesenheitsstatus */}
          {isPast && selectedEvent.is_registered && (
            <IonList className="app-section-inset" inset={true}>
              <IonCard className="app-card">
                <IonCardContent className="app-card-content">
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    {selectedEvent.attendance_status === 'present' && (
                      <div style={{ color: '#34c759', fontWeight: '600' }}>
                        <IonIcon icon={checkmarkCircle} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Anwesend
                      </div>
                    )}
                    {selectedEvent.attendance_status === 'absent' && (
                      <div style={{ color: '#dc3545', fontWeight: '600' }}>
                        <IonIcon icon={closeCircle} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Abwesend
                      </div>
                    )}
                    {!selectedEvent.attendance_status && (
                      <div style={{ color: '#fd7e14', fontWeight: '600' }}>
                        <IonIcon icon={hourglass} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Anwesenheit ausstehend
                      </div>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>
          )}
        </IonContent>
      </IonPage>
    );
  }

  // Events-Liste
  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Events</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEvents();
          e.detail.complete();
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <>
            {/* Header mit Stats */}
            <SectionHeader
              title="Events"
              subtitle="Termine und Veranstaltungen"
              icon={calendar}
              preset="events"
              stats={statsData}
            />

            {/* 3 Segmente */}
            <div className="app-segment-wrapper">
              <IonSegment
                value={activeTab}
                onIonChange={(e) => setActiveTab(e.detail.value as any)}
              >
                <IonSegmentButton value="meine">
                  <IonLabel>Meine</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="alle">
                  <IonLabel>Alle</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="team">
                  <IonLabel>Team</IonLabel>
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
              emptyTitle="Keine Events"
              emptyMessage={getEmptyMessage()}
              emptyIconColor="#dc2626"
            >
              {filteredEvents.map((event, index) => {
                const { statusColor, statusText, statusIcon, isPastEvent, shouldGrayOut } = getEventStatusInfo(event);
                const showBadge = !isPastEvent || event.is_registered;
                const isTeamerEvent = event.teamer_needed || event.teamer_only;

                return (
                  <IonItemSliding key={event.id} style={{ marginBottom: index < filteredEvents.length - 1 ? '8px' : '0' }}>
                    <IonItem
                      button
                      onClick={() => setSelectedEvent(event)}
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
                        {/* Status Corner Badge */}
                        {showBadge && (
                          <div
                            className="app-corner-badge"
                            style={{ backgroundColor: statusColor }}
                          >
                            {statusText}
                          </div>
                        )}

                        {/* TEAM Corner Badge - zweites Badge versetzt */}
                        {isTeamerEvent && (
                          <div
                            className="app-corner-badge"
                            style={{ backgroundColor: '#5b21b6', top: showBadge ? '26px' : '0' }}
                          >
                            TEAM
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
                              {/* Titel */}
                              <div
                                className="app-list-item__title"
                                style={{
                                  color: shouldGrayOut ? '#999' : undefined,
                                  paddingRight: showBadge ? '70px' : '0'
                                }}
                              >
                                {event.name}
                              </div>

                              {/* Buchungen + Punkte */}
                              <div className="app-list-item__meta">
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={people} style={{ color: shouldGrayOut ? '#999' : '#34c759' }} />
                                  {event.registered_count}{event.max_participants > 0 ? `/${event.max_participants}` : ''}
                                </span>
                                {(event.teamer_count !== undefined && event.teamer_count > 0) && (
                                  <span className="app-list-item__meta-item" style={{ color: '#5b21b6' }}>
                                    <IonIcon icon={people} style={{ color: '#5b21b6' }} />
                                    {event.teamer_count} T
                                  </span>
                                )}
                                {event.points > 0 && (
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={trophy} style={{ color: shouldGrayOut ? '#999' : '#ff9500' }} />
                                    {event.points}P
                                  </span>
                                )}
                              </div>

                              {/* Datum + Uhrzeit */}
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

                              {/* Ort */}
                              {event.location && (
                                <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={location} style={{ color: shouldGrayOut ? '#999' : '#007aff' }} />
                                    {event.location}
                                  </span>
                                </div>
                              )}

                              {/* Was mitbringen */}
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

            {/* FAB für QR-Scanner */}
            <IonFab vertical="bottom" horizontal="end" slot="fixed">
              <IonFabButton onClick={() => presentScannerModal()}>
                <IonIcon icon={qrCodeOutline} />
              </IonFabButton>
            </IonFab>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TeamerEventsPage;
