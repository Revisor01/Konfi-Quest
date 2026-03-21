import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { useLocation, useHistory } from 'react-router-dom';
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
  navigateOutline,
  informationCircle,
  pricetag,
  shieldCheckmark,
  home,
  document as documentIcon,
  attachOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import { SectionHeader, ListSection } from '../../shared';
import EmptyState from '../../shared/EmptyState';
import LoadingSpinner from '../../common/LoadingSpinner';
import QRScannerModal from '../../konfi/modals/QRScannerModal';
import TeamerMaterialDetailPage from './TeamerMaterialDetailPage';

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
  material_count?: number;
}

const TeamerEventsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('teamer-events');
  const routerLocation = useLocation<{ selectedEventId?: number }>();

  const [activeTab, setActiveTab] = useState<'meine' | 'alle' | 'team'>('meine');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [initialEventHandled, setInitialEventHandled] = useState(false);
  const [eventMaterials, setEventMaterials] = useState<any[]>([]);
  const materialIdRef = useRef<number | null>(null);
  const history = useHistory();

  // Offline-Query: Events
  const { data: events, loading, refresh } = useOfflineQuery<Event[]>(
    'teamer:events:' + user?.id,
    async () => { const res = await api.get('/events'); return res.data; },
    { ttl: CACHE_TTL.EVENTS }
  );

  // Material Detail Modal (useRef fuer dynamische materialId)
  const [presentMaterialModal, dismissMaterialModal] = useIonModal(TeamerMaterialDetailPage, {
    get materialId() { return materialIdRef.current; },
    onClose: () => dismissMaterialModal()
  });

  // QR Scanner Modal
  const [presentScannerModal, dismissScannerModal] = useIonModal(QRScannerModal, {
    onClose: () => dismissScannerModal(),
    onSuccess: (_eventId: number, eventName: string) => {
      dismissScannerModal();
      setSuccess(`Eingecheckt bei: ${eventName}`);
      refresh();
    }
  });

  useLiveRefresh('events', refresh);

  // Material fuer ausgewaehltes Event laden
  useEffect(() => {
    if (selectedEvent) {
      api.get(`/material/by-event/${selectedEvent.id}`)
        .then(res => setEventMaterials(res.data || []))
        .catch(() => setEventMaterials([]));
    } else {
      setEventMaterials([]);
    }
  }, [selectedEvent?.id]);

  // Wenn von Dashboard mit selectedEventId navigiert wurde, Event direkt oeffnen
  useEffect(() => {
    if (!initialEventHandled && !loading && events && events.length > 0 && routerLocation.state?.selectedEventId) {
      const eventToSelect = events.find(e => e.id === routerLocation.state!.selectedEventId);
      if (eventToSelect) {
        setSelectedEvent(eventToSelect);
      }
      setInitialEventHandled(true);
    }
  }, [loading, events, routerLocation.state, initialEventHandled]);

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

  const safeEvents = events || [];

  // Gefilterte Events per Segment
  const meineEvents = useMemo(() =>
    sortEvents(safeEvents.filter(e => e.is_registered)),
  [safeEvents]);

  const alleEvents = useMemo(() =>
    sortEvents(safeEvents.filter(e => !e.teamer_only)),
  [safeEvents]);

  const teamEvents = useMemo(() =>
    sortEvents(safeEvents.filter(e => e.teamer_needed || e.teamer_only)),
  [safeEvents]);

  const getFilteredEvents = () => {
    switch (activeTab) {
      case 'meine': return meineEvents;
      case 'alle': return alleEvents;
      case 'team': return teamEvents;
      default: return safeEvents;
    }
  };

  const filteredEvents = getFilteredEvents();

  // Stats
  const eventCounts = useMemo(() => ({
    gesamt: safeEvents.length,
    anstehend: safeEvents.filter(e => new Date(e.event_date) >= new Date()).length,
    gebucht: safeEvents.filter(e => e.is_registered).length
  }), [safeEvents]);

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
      await refresh();
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
      await refresh();
      const updated = (await api.get('/events')).data.find((e: Event) => e.id === event.id);
      if (updated) setSelectedEvent(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Stornieren');
    } finally {
      setBookingLoading(false);
    }
  };

  // Status-Farben fuer SectionHeader (1:1 wie Konfi EventDetailView)
  const getStatusColors = (event: Event): { primary: string; secondary: string } => {
    const isPastEvent = new Date(event.event_date) < new Date();
    const isOnWaitlist = event.booking_status === 'waitlist' || event.booking_status === 'pending';

    if (event.registration_status === 'cancelled') return { primary: '#dc3545', secondary: '#c82333' };
    if (isPastEvent && event.attendance_status === 'present') return { primary: '#34c759', secondary: '#2db84d' };
    if (isPastEvent && event.attendance_status === 'absent') return { primary: '#dc3545', secondary: '#c82333' };
    if (isPastEvent && event.is_registered && !event.attendance_status) return { primary: '#fd7e14', secondary: '#e8650e' };
    if (isOnWaitlist) return { primary: '#fd7e14', secondary: '#e8650e' };
    if (event.is_registered && !isPastEvent) return { primary: '#007aff', secondary: '#0066d6' };
    if (isPastEvent) return { primary: '#6c757d', secondary: '#5a6268' };
    if (event.registration_status === 'open') return { primary: '#34c759', secondary: '#2db84d' };
    return { primary: '#dc2626', secondary: '#b91c1c' };
  };

  // Status-Text fuer Header (1:1 wie Konfi EventDetailView)
  const getStatusText = (event: Event): string => {
    const isPastEvent = new Date(event.event_date) < new Date();
    const isOnWaitlist = event.booking_status === 'waitlist' || event.booking_status === 'pending';

    if (event.registration_status === 'cancelled') return 'Abgesagt';
    if (isPastEvent && event.attendance_status === 'present') return 'Anwesend';
    if (isPastEvent && event.attendance_status === 'absent') return 'Abwesend';
    if (isPastEvent && event.is_registered && !event.attendance_status) return 'Ausstehend';
    if (isOnWaitlist) return 'Warteliste';
    if (event.is_registered && !isPastEvent) return 'Dabei';
    if (isPastEvent) return 'Vergangen';
    if (event.registration_status === 'open') return 'Offen';
    return 'Geschlossen';
  };

  // Formatierung lang (wie Konfi EventDetailView)
  const formatDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
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

  // Event Detail Ansicht - 1:1 wie Konfi EventDetailView
  if (selectedEvent) {
    const isPast = new Date(selectedEvent.event_date) < new Date();
    const isTeamerEvent = selectedEvent.teamer_needed || selectedEvent.teamer_only;

    return (
      <IonPage ref={pageRef}>
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
            await refresh();
            const updated = safeEvents.find(ev => ev.id === selectedEvent.id);
            if (updated) setSelectedEvent(updated);
            e.detail.complete();
          }}>
            <IonRefresherContent />
          </IonRefresher>

          {/* SectionHeader mit Status-Farben */}
          {(() => {
            const konfiCount = selectedEvent.registered_count - (selectedEvent.teamer_count || 0);
            return (
              <SectionHeader
                title={selectedEvent.name}
                subtitle={getStatusText(selectedEvent)}
                icon={calendar}
                colors={getStatusColors(selectedEvent)}
                stats={[
                  { value: konfiCount, label: 'Konfis' },
                  { value: selectedEvent.teamer_count || 0, label: 'Team' },
                  { value: selectedEvent.points, label: 'Punkte' }
                ]}
              />
            );
          })()}

          {/* Details Card - wie Admin EventDetailView */}
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={calendar} />
              </div>
              <IonLabel>Details</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {/* Datum */}
                <div className="app-info-row">
                  <IonIcon icon={calendar} className="app-info-row__icon app-icon-color--events" />
                  <div>
                    <div className="app-info-row__content app-list-item__title">
                      {formatDateLong(selectedEvent.event_date)}
                    </div>
                    <div className="app-info-row__sublabel">
                      {formatTime(selectedEvent.event_date)}
                      {selectedEvent.event_end_time && ` - ${formatTime(selectedEvent.event_end_time)}`}
                    </div>
                  </div>
                </div>

                {/* Konfis - ohne Teamer */}
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon app-icon-color--participants" />
                  <div className="app-info-row__content">
                    {selectedEvent.registered_count - (selectedEvent.teamer_count || 0)} / {selectedEvent.max_participants > 0 ? selectedEvent.max_participants : '\u221E'} Konfis
                  </div>
                </div>

                {/* Team */}
                {(selectedEvent.teamer_count !== undefined && selectedEvent.teamer_count > 0) && (
                  <div className="app-info-row">
                    <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                    <div className="app-info-row__content">
                      {selectedEvent.teamer_count} Team
                    </div>
                  </div>
                )}

                {/* Punkte */}
                <div className="app-info-row">
                  <IonIcon icon={trophy} className="app-info-row__icon app-icon-color--badges" />
                  <div className="app-info-row__content">
                    {selectedEvent.points} Punkte
                  </div>
                </div>

                {/* Typ */}
                {selectedEvent.type && (
                  <div className="app-info-row">
                    <IonIcon
                      icon={selectedEvent.type === 'gottesdienst' ? home : people}
                      className="app-info-row__icon"
                      style={{ color: selectedEvent.type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
                    />
                    <div className="app-info-row__content">
                      {selectedEvent.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                    </div>
                  </div>
                )}

                {/* Kategorien */}
                {selectedEvent.category_names && (
                  <div className="app-info-row">
                    <IonIcon icon={pricetag} className="app-info-row__icon app-icon-color--category" />
                    <div className="app-info-row__content">
                      {selectedEvent.category_names}
                    </div>
                  </div>
                )}

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

                {/* Pflicht-Event */}
                {selectedEvent.mandatory && (
                  <div className="app-info-row">
                    <IonIcon icon={shieldCheckmark} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                    <div className="app-info-row__content">
                      Pflicht-Event
                    </div>
                  </div>
                )}

                {/* Team gesucht */}
                {isTeamerEvent && (
                  <div className="app-info-row">
                    <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                    <div className="app-info-row__content">
                      {selectedEvent.teamer_only ? 'Nur Team' : 'Team gesucht'}
                    </div>
                  </div>
                )}

                {/* Was mitbringen */}
                {selectedEvent.bring_items && (
                  <div className="app-info-row">
                    <IonIcon icon={bagHandle} className="app-info-row__icon" style={{ color: '#8b5cf6' }} />
                    <div className="app-info-row__content">
                      {selectedEvent.bring_items}
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>

          {/* Beschreibung - eigene Card wie Konfi */}
          {selectedEvent.description && (
            <IonList className="app-section-inset" inset={true}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--events">
                  <IonIcon icon={informationCircle} />
                </div>
                <IonLabel>Beschreibung</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent className="app-card-content">
                  <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: '#374151', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {selectedEvent.description}
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          )}

          {/* Material */}
          {eventMaterials.length > 0 && (
            <IonList className="app-section-inset" inset={true}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--events">
                  <IonIcon icon={documentIcon} />
                </div>
                <IonLabel>Material ({eventMaterials.length})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent className="app-card-content">
                  {eventMaterials.map((mat: any) => (
                    <div
                      key={mat.id}
                      className="app-list-item"
                      style={{
                        borderLeftColor: '#d97706',
                        cursor: 'pointer',
                        marginBottom: '8px'
                      }}
                      onClick={() => {
                        materialIdRef.current = mat.id;
                        presentMaterialModal({ presentingElement: presentingElement || pageRef.current || undefined });
                      }}
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle" style={{ backgroundColor: '#d97706' }}>
                            <IonIcon icon={documentIcon} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">{mat.title}</div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={attachOutline} style={{ color: '#d97706' }} />
                                {mat.file_count || 0} {(mat.file_count || 0) === 1 ? 'Datei' : 'Dateien'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </IonCardContent>
              </IonCard>
            </IonList>
          )}

          {/* Action Buttons */}
          <div className="app-event-detail__action-area">
            {isPast ? (
              selectedEvent.is_registered ? (
                <div style={{ textAlign: 'center', padding: '12px 16px' }}>
                  {selectedEvent.attendance_status === 'present' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '12px 16px', backgroundColor: 'rgba(52, 199, 89, 0.12)',
                      borderRadius: '12px', color: '#34c759', fontWeight: '600', fontSize: '1rem'
                    }}>
                      <IonIcon icon={checkmarkCircle} style={{ fontSize: '1.3rem' }} />
                      Anwesend
                    </div>
                  )}
                  {selectedEvent.attendance_status === 'absent' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '12px 16px', backgroundColor: 'rgba(220, 53, 69, 0.12)',
                      borderRadius: '12px', color: '#dc3545', fontWeight: '600', fontSize: '1rem'
                    }}>
                      <IonIcon icon={closeCircle} style={{ fontSize: '1.3rem' }} />
                      Abwesend
                    </div>
                  )}
                  {!selectedEvent.attendance_status && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '12px 16px', backgroundColor: 'rgba(253, 126, 20, 0.12)',
                      borderRadius: '12px', color: '#fd7e14', fontWeight: '600', fontSize: '1rem'
                    }}>
                      <IonIcon icon={hourglass} style={{ fontSize: '1.3rem' }} />
                      Anwesenheit ausstehend
                    </div>
                  )}
                </div>
              ) : null
            ) : (
              selectedEvent.is_registered ? (
                <IonButton
                  className="app-action-button"
                  expand="block"
                  fill="outline"
                  color="danger"
                  onClick={() => handleUnbook(selectedEvent)}
                  disabled={bookingLoading}
                >
                  <IonIcon icon={closeCircle} slot="start" />
                  {bookingLoading ? 'Wird verarbeitet...' : 'Nicht mehr dabei'}
                </IonButton>
              ) : (
                <IonButton
                  className="app-action-button"
                  expand="block"
                  style={{
                    '--background': '#34c759',
                    '--background-activated': '#2da84e',
                    '--background-hover': '#30b853',
                    '--color': 'white'
                  }}
                  onClick={() => handleBook(selectedEvent)}
                  disabled={bookingLoading}
                >
                  <IonIcon icon={checkmarkCircle} slot="start" />
                  {bookingLoading ? 'Wird verarbeitet...' : 'Ich bin dabei'}
                </IonButton>
              )
            )}
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // Events-Liste
  return (
    <IonPage ref={pageRef}>
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
          refresh();
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
                        {/* Corner Badges Container - oben rechts */}
                        {(showBadge || isTeamerEvent) && (
                          <div className="app-corner-badges">
                            {isTeamerEvent && (
                              <>
                                <div className="app-corner-badge app-corner-badge--purple">
                                  TEAM
                                </div>
                                {showBadge && <div className="app-corner-badges__separator" />}
                              </>
                            )}
                            {showBadge && (
                              <div className="app-corner-badge" style={{ backgroundColor: statusColor }}>
                                {statusText}
                              </div>
                            )}
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
                                  paddingRight: (showBadge || isTeamerEvent) ? '70px' : '0',
                                  paddingTop: (showBadge || isTeamerEvent) ? '4px' : '0'
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
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={bagHandle} style={{ color: '#8b5cf6' }} />
                                    {event.bring_items}
                                  </span>
                                </div>
                              )}
                              {/* Material */}
                              {(event.material_count || 0) > 0 && (
                                <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={attachOutline} style={{ color: '#d97706' }} />
                                    {event.material_count} {event.material_count === 1 ? 'Material' : 'Materialien'}
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
