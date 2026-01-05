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
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRefresher,
  IonRefresherContent,
  IonChip,
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
  ribbon,
  listOutline,
  home,
  calendarOutline,
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
  booking_status?: 'confirmed' | 'waitlist' | null;
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

      // Trigger events update for parent page
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
    }
  };

  // Modal mit useIonModal Hook - korrekte Ionic Implementierung
  const [presentUnregisterModal, dismissUnregisterModal] = useIonModal(UnregisterModal, {
    eventName: eventData?.name || '',
    onClose: () => {
      dismissUnregisterModal();
      loadEventData(); // Seite aktualisieren nach Modal schließen
    },
    onUnregister: handleUnregister,
    dismiss: (data?: string, role?: string) => {
      dismissUnregisterModal(data, role);
      loadEventData(); // Seite aktualisieren nach Abmeldung
    }
  });

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      // Get event details from konfi API with konfi-specific data
      const eventsResponse = await api.get('/konfi/events');
      const event = eventsResponse.data.find((e: Event) => e.id === eventId);

      if (!event) {
        setError('Event nicht gefunden');
        return;
      }

      // Event already has all konfi-specific data from /konfi/events
      setEventData(event);

      // Load timeslots if event has them
      if ((event as any).has_timeslots) {
        try {
          const timeslotsResponse = await api.get(`/konfi/events/${eventId}/timeslots`);
          setTimeslots(timeslotsResponse.data || []);
        } catch (err) {
          console.error('Error loading timeslots:', err);
          setTimeslots([]);
        }
      } else {
        setTimeslots([]);
      }

      // Check if user already has a konfirmation booked
      const hasKonfirmation = await checkExistingKonfirmation();
      setHasExistingKonfirmation(hasKonfirmation);

      // Load participants (anonymized)
      try {
        const participantsResponse = await api.get(`/konfi/events/${eventId}/participants`);
        setParticipants(participantsResponse.data || []);
      } catch (err) {
        console.error('Error loading participants:', err);
        setParticipants([]);
      }

    } catch (err) {
      setError('Fehler beim Laden der Event-Details');
      console.error('Error loading event details:', err);
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
      const hasKonfirmation = myEvents.some((e: Event) =>
        e.category_names?.toLowerCase().includes('konfirmation') ||
        isKonfirmationEvent(e)
      );
      return hasKonfirmation;
    } catch (err) {
      console.error('Error checking existing konfirmation:', err);
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

      // Trigger events update for parent page
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  const handleRegister = async () => {
    if (!eventData) return;

    // Check if this is a Konfirmation event and if user already has one
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

    // Check if event has timeslots - show ActionSheet to select
    const hasTimeslots = (eventData as any).has_timeslots && timeslots.length > 0;
    if (hasTimeslots) {
      // Build ActionSheet buttons from timeslots
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

      // Add cancel button
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

    // No timeslots - register directly
    doRegister();
  };

  // Status-Infos berechnen
  const getStatusInfo = () => {
    if (!eventData) return { color: '#666', text: 'Laden...', icon: hourglass };

    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isParticipated = isPastEvent && eventData.is_registered;
    const attendanceStatus = eventData.attendance_status;
    const isKonfi = isKonfirmationEvent(eventData);

    if (eventData.cancelled) return { color: '#dc3545', text: 'ABGESAGT' };
    if (isParticipated && attendanceStatus === 'present') return { color: '#34c759', text: 'VERBUCHT' };
    if (isParticipated && attendanceStatus === 'absent') return { color: '#dc3545', text: 'VERPASST' };
    if (isParticipated && !attendanceStatus) return { color: '#fd7e14', text: 'AUSSTEHEND' };
    if ((eventData as any).booking_status === 'waitlist') return { color: '#fd7e14', text: `WARTELISTE (${eventData.waitlist_position || 1})` };
    if (eventData.is_registered) return { color: '#007aff', text: 'ANGEMELDET' };
    if (isKonfi && !isPastEvent) return { color: '#8b5cf6', text: 'KONFIRMATION' };
    if (!isPastEvent) {
      if (eventData.registration_status === 'open') return { color: '#34c759', text: 'OFFEN' };
      if (eventData.registration_status === 'upcoming') return { color: '#fd7e14', text: 'BALD' };
      return { color: '#dc3545', text: 'GESCHLOSSEN' };
    }
    return { color: '#6c757d', text: 'VERGANGEN' };
  };

  const statusInfo = getStatusInfo();

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

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{eventData.name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEventData();
          e.detail.complete();
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Event Header - Dashboard-Style wie Admin */}
        <div style={{
          background: `linear-gradient(135deg, ${statusInfo.color} 0%, ${statusInfo.color}dd 100%)`,
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: `0 20px 40px ${statusInfo.color}44`,
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
              fontSize: '3rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.1)',
              margin: '0',
              lineHeight: '0.8',
              letterSpacing: '-2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '280px'
            }}>
              {(eventData?.name || 'EVENT').toUpperCase()}
            </h2>
          </div>

          {/* Content */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            padding: '60px 24px 24px 24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {/* Status Badge */}
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              padding: '6px 12px'
            }}>
              <span style={{
                color: statusInfo.color,
                fontSize: '0.75rem',
                fontWeight: '700'
              }}>
                {statusInfo.text}
              </span>
            </div>

            {/* Event Info Grid */}
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <div style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '16px 12px',
                color: 'white',
                textAlign: 'center'
              }}>
                <IonIcon icon={people} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', display: 'block', margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  {eventData.max_participants - eventData.registered_count}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  FREI
                </div>
              </div>
              <div style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '16px 12px',
                color: 'white',
                textAlign: 'center'
              }}>
                <IonIcon icon={trophy} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', display: 'block', margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  {eventData.points}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  PUNKTE
                </div>
              </div>
              <div style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '16px 12px',
                color: 'white',
                textAlign: 'center'
              }}>
                <IonIcon icon={checkmarkCircle} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', display: 'block', margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  {eventData.registered_count}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  DABEI
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Details - Admin Pattern mit IonListHeader */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={calendarOutline} />
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

              {/* Gebuchter Timeslot anzeigen wenn angemeldet */}
              {eventData.has_timeslots && eventData.is_registered && eventData.booked_timeslot_start && (
                <div className="app-info-row">
                  <IonIcon icon={time} className="app-info-row__icon" style={{ color: '#34c759' }} />
                  <div>
                    <div className="app-info-row__sublabel">Dein Zeitslot:</div>
                    <div className="app-info-row__content" style={{ fontWeight: '600', color: '#34c759' }}>
                      {formatTime(eventData.booked_timeslot_start)}
                      {eventData.booked_timeslot_end && ` - ${formatTime(eventData.booked_timeslot_end)}`}
                    </div>
                  </div>
                </div>
              )}

              {/* TN gesamt */}
              <div className="app-info-row">
                <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#34c759' }} />
                <div className="app-info-row__content">
                  {eventData.registered_count} / {eventData.max_participants} Teilnehmer:innen
                </div>
              </div>

              {/* Ort */}
              {eventData.location && (
                <div
                  className="app-info-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (eventData.location_maps_url) {
                      window.open(eventData.location_maps_url, '_blank');
                    } else {
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                      const encodedLocation = encodeURIComponent(eventData.location || '');
                      const mapsUrl = isIOS
                        ? `maps://maps.apple.com/?q=${encodedLocation}`
                        : `https://maps.google.com/maps?q=${encodedLocation}`;
                      window.open(mapsUrl, '_blank');
                    }
                  }}
                >
                  <IonIcon icon={location} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                  <div className="app-info-row__content" style={{ color: '#007aff', textDecoration: 'underline' }}>
                    {eventData.location}
                  </div>
                </div>
              )}

              {/* Anmeldezeitraum */}
              {(eventData.registration_opens_at || eventData.registration_closes_at) && (
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
              )}

              {/* Warteliste */}
              {eventData.waitlist_enabled && (
                <div className="app-info-row">
                  <IonIcon icon={listOutline} className="app-info-row__icon" style={{ color: '#fd7e14' }} />
                  <div className="app-info-row__content">
                    Warteliste: {(eventData as any).waitlist_count || 0} / {eventData.max_waitlist_size || 10}
                    {(eventData as any).waitlist_position && ` (Du: Platz ${(eventData as any).waitlist_position})`}
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
                  style={{ color: eventData.point_type === 'gottesdienst' ? '#007aff' : '#059669' }}
                />
                <div className="app-info-row__content">
                  {eventData.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                </div>
              </div>

              {/* Kategorien als Tags */}
              {eventData.categories && eventData.categories.length > 0 && (
                <div className="app-info-row" style={{ alignItems: 'flex-start' }}>
                  <IonIcon icon={pricetag} className="app-info-row__icon" style={{ color: '#8b5cf6', marginTop: '4px' }} />
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {eventData.categories.map(c => (
                      <span key={c.id} className="app-tag app-tag--purple">
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Description */}
        {eventData.description && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--info">
                <IonIcon icon={informationCircle} />
              </div>
              <IonLabel>Beschreibung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <p style={{ margin: '0', fontSize: '1rem', color: '#666', lineHeight: '1.5' }}>
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
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {participants.map((participant) => (
                    <IonChip
                      key={participant.id}
                      style={{
                        margin: 0,
                        backgroundColor: 'rgba(52, 199, 89, 0.1)',
                        border: '1px solid rgba(52, 199, 89, 0.3)'
                      }}
                    >
                      <IonLabel style={{ color: '#2d7d46', fontWeight: '500' }}>
                        {participant.display_name}
                      </IonLabel>
                    </IonChip>
                  ))}
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
                '--background': '#1e7e34',
                '--background-activated': '#155724',
                '--background-hover': '#1c7430',
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
