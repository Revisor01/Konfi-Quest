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
  IonCardContent,
  IonLabel,
  IonList,
  IonListHeader,
  IonRefresher,
  IonRefresherContent,
  useIonAlert,
  useIonModal,
  useIonActionSheet
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
  listOutline,
  home,
  pricetag
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
  category_names?: string;
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
  cancelled?: boolean;
  attendance_status?: 'present' | 'absent' | null;
  waitlist_count?: number;
  waitlist_position?: number;
  registration_status_detail?: string;
  booking_status?: 'confirmed' | 'waitlist' | 'pending' | null;
  has_timeslots?: boolean;
  booked_timeslot_id?: number;
  booked_timeslot_start?: string;
  booked_timeslot_end?: string;
}

interface EventDetailViewProps {
  eventId: number;
  onBack: () => void;
}

interface Timeslot {
  id: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count: number;
}

interface Participant {
  id: number;
  display_name: string;
}

const EventDetailView: React.FC<EventDetailViewProps> = ({ eventId, onBack }) => {
  const pageRef = useRef<HTMLElement>(null);
  const { setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  const [presentActionSheet] = useIonActionSheet();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [hasExistingKonfirmation, setHasExistingKonfirmation] = useState(false);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const handleUnregister = async (reason: string) => {
    if (!eventData || !reason.trim()) {
      setError('Bitte gib einen Grund für die Abmeldung an');
      return;
    }

    try {
      await api.delete(`/konfi/events/${eventData.id}/register`, {
        data: { reason: reason.trim() }
      });

      setSuccess(`Von "${eventData.name}" abgemeldet`);
      await loadEventData();
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
    }
  };

  const [presentUnregisterModal, dismissUnregisterModal] = useIonModal(UnregisterModal, {
    eventName: eventData?.name || '',
    onClose: () => {
      dismissUnregisterModal();
      loadEventData();
    },
    onUnregister: handleUnregister,
    dismiss: (data?: string, role?: string) => {
      dismissUnregisterModal(data, role);
      loadEventData();
    }
  });

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const eventsResponse = await api.get('/konfi/events');
      const event = eventsResponse.data.find((e: Event) => e.id === eventId);

      if (!event) {
        setError('Event nicht gefunden');
        return;
      }

      setEventData(event);

      if ((event as any).has_timeslots) {
        try {
          const timeslotsResponse = await api.get(`/konfi/events/${eventId}/timeslots`);
          setTimeslots(timeslotsResponse.data || []);
        } catch (err) {
          setTimeslots([]);
        }
      } else {
        setTimeslots([]);
      }

      const hasKonfirmation = await checkExistingKonfirmation();
      setHasExistingKonfirmation(hasKonfirmation);

      try {
        const participantsResponse = await api.get(`/konfi/events/${eventId}/participants`);
        setParticipants(participantsResponse.data || []);
      } catch (err) {
        setParticipants([]);
      }
    } catch (err) {
      setError('Fehler beim Laden der Event-Details');
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

  const canUnregister = (event: Event) => {
    if (!event.is_registered) return false;
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const twoDaysBeforeEvent = new Date(eventDate.getTime() - (2 * 24 * 60 * 60 * 1000));
    return now < twoDaysBeforeEvent;
  };

  const isKonfirmationEvent = (event: Event) => {
    return event.categories?.some(cat => cat.name.toLowerCase().includes('konfirmation')) ||
           event.category_names?.toLowerCase().includes('konfirmation') ||
           false;
  };

  const checkExistingKonfirmation = async () => {
    try {
      const response = await api.get('/konfi/events');
      const myEvents = response.data.filter((e: Event) => e.is_registered);
      return myEvents.some((e: Event) =>
        e.category_names?.toLowerCase().includes('konfirmation') ||
        isKonfirmationEvent(e)
      );
    } catch (err) {
      return false;
    }
  };

  const doRegister = async (timeslotId?: number) => {
    if (!eventData) return;

    try {
      const payload: any = {};
      if (timeslotId) {
        payload.timeslot_id = timeslotId;
      }
      await api.post(`/konfi/events/${eventData.id}/register`, payload);
      setSuccess(`Erfolgreich für "${eventData.name}" angemeldet!`);
      await loadEventData();
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  const handleRegister = async () => {
    if (!eventData) return;

    if (isKonfirmationEvent(eventData)) {
      const hasExistingKonfirmation = await checkExistingKonfirmation();
      if (hasExistingKonfirmation) {
        presentAlert({
          header: 'Konfirmationstermin bereits gebucht',
          message: 'Du hast bereits einen Konfirmationstermin gebucht. Bitte melde dich zuerst vom bisherigen Termin ab, bevor du einen neuen buchst.',
          buttons: ['OK']
        });
        return;
      }
    }

    const hasTimeslots = (eventData as any).has_timeslots && timeslots.length > 0;
    if (hasTimeslots) {
      const timeslotButtons = timeslots.map((slot) => {
        const isFull = parseInt(String(slot.registered_count || 0)) >= slot.max_participants;
        const startTime = formatTime(slot.start_time);
        const endTime = formatTime(slot.end_time);
        const spotsLeft = slot.max_participants - (slot.registered_count || 0);

        return {
          text: `${startTime} - ${endTime} (${spotsLeft} frei)`,
          handler: () => {
            if (isFull) {
              setError('Dieser Zeitslot ist leider voll');
              return false;
            }
            doRegister(slot.id);
          },
          cssClass: isFull ? 'action-sheet-disabled' : ''
        };
      });

      timeslotButtons.push({
        text: 'Abbrechen',
        role: 'cancel' as any,
        handler: () => {}
      } as any);

      presentActionSheet({
        header: 'Zeitslot auswählen',
        buttons: timeslotButtons
      });
      return;
    }

    doRegister();
  };

  // Header-Farbe basierend auf Status
  const getHeaderColor = () => {
    if (!eventData) return '#dc2626';

    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfi = isKonfirmationEvent(eventData);
    const isOnWaitlist = (eventData as any).booking_status === 'waitlist' || (eventData as any).booking_status === 'pending';
    const isAusstehend = isPastEvent && eventData.is_registered && !isOnWaitlist && !eventData.attendance_status;

    if (eventData.cancelled) return '#dc3545';
    if (isKonfi && !isPastEvent) return '#8b5cf6'; // Lila für Konfirmation
    if (isPastEvent && eventData.attendance_status === 'present') return '#34c759';
    if (isPastEvent && eventData.attendance_status === 'absent') return '#dc3545';
    if (isAusstehend) return '#fd7e14';
    if (isOnWaitlist) return '#fd7e14';
    if (eventData.is_registered && !isPastEvent) return '#007aff';
    if (isPastEvent) return '#6c757d';
    if (eventData.registration_status === 'open') return '#34c759';
    if (eventData.registration_status === 'upcoming') return '#fd7e14';
    return '#dc2626';
  };

  const headerColor = getHeaderColor();

  // Status-Text für Header
  const getStatusText = () => {
    if (!eventData) return 'Event';
    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfi = isKonfirmationEvent(eventData);
    const isOnWaitlist = (eventData as any).booking_status === 'waitlist' || (eventData as any).booking_status === 'pending';
    const isAusstehend = isPastEvent && eventData.is_registered && !isOnWaitlist && !eventData.attendance_status;

    if (eventData.cancelled) return 'Abgesagt';
    if (isKonfi && !isPastEvent) return eventData.is_registered ? 'Angemeldet' : 'Konfirmation';
    if (isPastEvent && eventData.attendance_status === 'present') return 'Verbucht';
    if (isPastEvent && eventData.attendance_status === 'absent') return 'Verpasst';
    if (isAusstehend) return 'Ausstehend';
    if (isOnWaitlist) return `Warteliste (${eventData.waitlist_position || '?'})`;
    if (eventData.is_registered && !isPastEvent) return 'Angemeldet';
    if (isPastEvent) return 'Vergangen';
    if (eventData.registration_status === 'open') return 'Offen';
    if (eventData.registration_status === 'upcoming') return 'Bald';
    return 'Geschlossen';
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

  const spotsLeft = eventData.max_participants - eventData.registered_count;

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

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>{eventData.name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEventData();
          e.detail.complete();
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Event Header - Kompaktes Banner-Design wie EventsView */}
        <div style={{
          background: `linear-gradient(135deg, ${headerColor} 0%, ${headerColor}cc 100%)`,
          borderRadius: '20px',
          padding: '24px',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: `0 8px 32px ${headerColor}40`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Dekorative Kreise im Hintergrund */}
          <div style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '-20px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)'
          }} />

          {/* Header mit Icon und Event-Name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <IonIcon icon={calendar} style={{ fontSize: '1.6rem', color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                margin: '0',
                fontSize: '1.3rem',
                fontWeight: '700',
                color: 'white',
                lineHeight: '1.2'
              }}>
                {eventData.name}
              </h2>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                {getStatusText()}
              </p>
            </div>
          </div>

          {/* Stats Row - 3 Boxen */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 12px',
              textAlign: 'center',
              flex: '1 1 0',
              maxWidth: '100px'
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
                {spotsLeft > 0 ? spotsLeft : 0}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
                FREI
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 12px',
              textAlign: 'center',
              flex: '1 1 0',
              maxWidth: '100px'
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
                {eventData.points}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
                PUNKTE
              </div>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 12px',
              textAlign: 'center',
              flex: '1 1 0',
              maxWidth: '100px'
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>
                {eventData.registered_count}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>
                DABEI
              </div>
            </div>
          </div>
        </div>

        {/* Event Details - 1:1 wie Admin */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={calendar} />
            </div>
            <IonLabel>Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              {/* Datum */}
              <div className="app-info-row">
                <IonIcon icon={calendar} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                <div>
                  <div className="app-info-row__content" style={{ fontWeight: '600' }}>
                    {formatDate(eventData.event_date)}
                  </div>
                  <div className="app-info-row__sublabel">
                    {formatTime(eventData.event_date)}
                    {eventData.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
                  </div>
                </div>
              </div>

              {/* Zeitslots anzeigen wenn vorhanden (wie Admin) */}
              {eventData.has_timeslots && timeslots.length > 0 && (
                <div className="app-info-row" style={{ alignItems: 'flex-start' }}>
                  <IonIcon icon={time} className="app-info-row__icon" style={{ color: '#dc2626', marginTop: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '6px' }}>Zeitfenster:</div>
                    {timeslots.map((slot, idx) => (
                      <div key={slot.id || idx} style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)} ({slot.registered_count || 0}/{slot.max_participants} TN)
                      </div>
                    ))}
                    {/* Gebuchter Timeslot hervorheben wenn angemeldet */}
                    {eventData.is_registered && eventData.booked_timeslot_start && (
                      <div style={{ fontSize: '0.9rem', color: '#34c759', fontWeight: '600', marginTop: '8px' }}>
                        Dein Slot: {formatTime(eventData.booked_timeslot_start)}
                        {eventData.booked_timeslot_end && ` - ${formatTime(eventData.booked_timeslot_end)}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TN gesamt */}
              <div className="app-info-row">
                <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#34c759' }} />
                <div className="app-info-row__content">
                  {eventData.registered_count} / {eventData.max_participants > 0 ? eventData.max_participants : '∞'} Teilnehmer:innen
                </div>
              </div>

              {/* Warteliste */}
              {eventData.waitlist_enabled && (
                <div className="app-info-row">
                  <IonIcon icon={listOutline} className="app-info-row__icon" style={{ color: '#fd7e14' }} />
                  <div className="app-info-row__content">
                    {(eventData as any).waitlist_count || 0} / {eventData.max_waitlist_size || 10} auf Warteliste
                    {(eventData as any).waitlist_position && <span style={{ fontWeight: '700' }}> (Du: Platz {(eventData as any).waitlist_position})</span>}
                  </div>
                </div>
              )}

              {/* Punkte */}
              <div className="app-info-row">
                <IonIcon icon={trophy} className="app-info-row__icon" style={{ color: '#ff9500' }} />
                <div className="app-info-row__content">
                  {eventData.points} Punkte
                </div>
              </div>

              {/* Typ */}
              <div className="app-info-row">
                <IonIcon
                  icon={home}
                  className="app-info-row__icon"
                  style={{ color: eventData.point_type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
                />
                <div className="app-info-row__content">
                  {eventData.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                </div>
              </div>

              {/* Kategorien */}
              {eventData.categories && eventData.categories.length > 0 && (
                <div className="app-info-row">
                  <IonIcon icon={pricetag} className="app-info-row__icon" style={{ color: '#8b5cf6' }} />
                  <div className="app-info-row__content">
                    {eventData.categories.map(c => c.name).join(', ')}
                  </div>
                </div>
              )}

              {/* Ort */}
              {eventData.location && (
                <div className="app-info-row">
                  <IonIcon icon={location} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                  <div
                    className="app-info-row__content"
                    style={{ color: '#007aff', textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={() => {
                      if (eventData.location_maps_url) {
                        window.open(eventData.location_maps_url, '_blank');
                      } else if (eventData.location) {
                        const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(eventData.location)}`;
                        window.open(mapsUrl, '_blank');
                      }
                    }}
                  >
                    {eventData.location}
                  </div>
                </div>
              )}

              {/* Anmeldezeitraum */}
              <div className="app-info-row" style={{ alignItems: 'flex-start' }}>
                <IonIcon icon={time} className="app-info-row__icon" style={{ color: '#dc2626', marginTop: '2px' }} />
                <div className="app-info-row__content">
                  {eventData.registration_opens_at ? (
                    <>
                      <div>von {new Date(eventData.registration_opens_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_opens_at)}</div>
                      {eventData.registration_closes_at && (
                        <div className="app-info-row__sublabel">bis {new Date(eventData.registration_closes_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_closes_at)}</div>
                      )}
                    </>
                  ) : (
                    'Sofort möglich'
                  )}
                </div>
              </div>

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Beschreibung - eigene Card mit rotem Icon */}
        {eventData.description && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={informationCircle} />
              </div>
              <IonLabel>Beschreibung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <p style={{ margin: '0', fontSize: '0.95rem', color: '#666', lineHeight: '1.5' }}>
                  {eventData.description}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Teilnehmer-Liste */}
        {participants.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--success">
                <IonIcon icon={people} />
              </div>
              <IonLabel>Teilnehmer:innen ({participants.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#34c759' }} />
                  <div className="app-info-row__content">
                    {participants.map(p => p.display_name).join(', ')}
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Action Buttons */}
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
          ) : (isKonfirmationEvent(eventData) && hasExistingKonfirmation) ? (
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
              <IonIcon icon={warning} slot="start" />
              Konfirmationstermin bereits gebucht
            </IonButton>
          ) : eventData.can_register && eventData.registration_status === 'open' && eventData.registered_count < eventData.max_participants ? (
            <IonButton
              expand="block"
              style={{
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600',
                '--background': '#34c759',
                '--background-activated': '#2da84e',
                '--background-hover': '#30b853',
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
              Warteliste offen ({(eventData as any).waitlist_count || 0}/{eventData.max_waitlist_size || 0})
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
