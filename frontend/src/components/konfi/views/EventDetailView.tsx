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
  useIonActionSheet,
  IonNote
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
  pricetag,
  personOutline,
  shieldCheckmark,
  bagHandle,
  qrCodeOutline,
  cloudOfflineOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader } from '../../shared';
import UnregisterModal from '../modals/UnregisterModal';
import QRScannerModal from '../modals/QRScannerModal';
import { Event, Category } from '../../../types/event';
import { useLiveUpdate } from '../../../contexts/LiveUpdateContext';
import { triggerPullHaptic } from '../../../utils/haptics';

interface EventDetailViewProps {
  eventId: number;
  onBack: () => void;
}

// Timeslot importiert aus types/event, lokaler Alias mit registered_count
interface DetailTimeslot {
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
  const { setSuccess, setError, isOnline } = useApp();
  const { triggerRefresh } = useLiveUpdate();
  const [presentAlert] = useIonAlert();
  const [presentActionSheet] = useIonActionSheet();

  // Event-Daten ueber useOfflineQuery mit 10min TTL Cache
  const { data: allEvents, loading, refresh: refreshEvents } = useOfflineQuery<Event[]>(
    `konfi:event-detail:${eventId}`,
    () => api.get('/konfi/events').then(r => r.data),
    { ttl: 10 * 60 * 1000 }
  );

  const eventData = allEvents?.find((e: Event) => e.id === eventId) || null;

  const [hasExistingKonfirmation, setHasExistingKonfirmation] = useState(false);
  const [timeslots, setTimeslots] = useState<DetailTimeslot[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const handleOptOut = async (reason: string) => {
    if (!eventData || reason.trim().length < 5) {
      setError('Bitte gib einen Grund für die Abmeldung an (mind. 5 Zeichen)');
      return;
    }

    const clientId = crypto.randomUUID();

    if (networkMonitor.isOnline) {
      try {
        await api.post(`/konfi/events/${eventData.id}/opt-out`, {
          reason: reason.trim(),
          client_id: clientId,
        });
        setSuccess(`Von "${eventData.name}" abgemeldet`);
        await refreshEvents();
        triggerRefresh('events');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
      }
    } else {
      await writeQueue.enqueue({
        method: 'POST',
        url: `/konfi/events/${eventData.id}/opt-out`,
        body: { reason: reason.trim(), client_id: clientId },
        maxRetries: 5,
        hasFileUpload: false,
        metadata: {
          type: 'opt-out',
          clientId,
          label: `Abmeldung von "${eventData.name}"`,
        },
      });
      setSuccess('Abmeldung wird gesendet sobald du wieder online bist');
    }
  };

  const handleOptIn = async () => {
    if (!eventData) return;

    try {
      await api.post(`/konfi/events/${eventData.id}/opt-in`);
      setSuccess(`Wieder für "${eventData.name}" angemeldet`);
      await refreshEvents();
      triggerRefresh('events');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Wiederanmeldung');
    }
  };

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
      await refreshEvents();
      triggerRefresh('events');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
    }
  };

  const [presentUnregisterModal, dismissUnregisterModal] = useIonModal(UnregisterModal, {
    eventName: eventData?.name || '',
    onClose: () => {
      dismissUnregisterModal();
      refreshEvents();
    },
    onUnregister: handleUnregister,
    dismiss: (data?: string, role?: string) => {
      dismissUnregisterModal(data, role);
      refreshEvents();
    }
  });

  const [presentOptOutModal, dismissOptOutModal] = useIonModal(UnregisterModal, {
    eventName: eventData?.name || '',
    mandatory: true,
    onClose: () => {
      dismissOptOutModal();
    },
    onUnregister: handleOptOut,
    dismiss: (data?: string, role?: string) => {
      dismissOptOutModal(data, role);
    }
  });

  const [presentScannerModal, dismissScannerModal] = useIonModal(QRScannerModal, {
    onClose: () => dismissScannerModal(),
    onSuccess: (eventId: number, eventName: string) => {
      dismissScannerModal();
      refreshEvents();
      setSuccess('Erfolgreich eingecheckt!');
    }
  });

  // Timeslots, Participants und Konfirmations-Check separat laden (nicht gecacht)
  useEffect(() => {
    if (!eventData) return;
    const loadDetails = async () => {
      try {
        if (eventData.has_timeslots) {
          const tsRes = await api.get(`/konfi/events/${eventId}/timeslots`);
          setTimeslots(tsRes.data || []);
        } else {
          setTimeslots([]);
        }
        const partRes = await api.get(`/konfi/events/${eventId}/participants`);
        setParticipants(partRes.data || []);
        const hasKonf = await checkExistingKonfirmation();
        setHasExistingKonfirmation(hasKonf);
      } catch (err) {
        // Timeslot/Participant-Laden darf fehlschlagen ohne Error-State
      }
    };
    loadDetails();
  }, [eventData?.id]);

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
      await refreshEvents();
      triggerRefresh('events');
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

    const hasTimeslots = eventData.has_timeslots && timeslots.length > 0;
    if (hasTimeslots) {
      const timeslotButtons = timeslots.map((slot) => {
        const isFull = slot.max_participants > 0 && parseInt(String(slot.registered_count || 0)) >= slot.max_participants;
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

  // Status-Farben für SectionHeader (dynamisch basierend auf Event-Zustand)
  const getStatusColors = (): { primary: string; secondary: string } => {
    if (!eventData) return { primary: '#dc2626', secondary: '#b91c1c' };

    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfi = isKonfirmationEvent(eventData);
    const isOnWaitlist = eventData.booking_status === 'waitlist' || eventData.booking_status === 'pending';
    const isAusstehend = isPastEvent && eventData.is_registered && !isOnWaitlist && !eventData.attendance_status;

    if (eventData.cancelled) return { primary: '#dc3545', secondary: '#c82333' };
    if (eventData.is_opted_out || eventData.booking_status === 'opted_out') return { primary: '#dc2626', secondary: '#b91c1c' };
    if (isKonfi && !isPastEvent) return { primary: '#5b21b6', secondary: '#4c1d95' };
    if (isPastEvent && eventData.attendance_status === 'present') return { primary: '#34c759', secondary: '#2db84d' };
    if (isPastEvent && eventData.attendance_status === 'absent') return { primary: '#dc3545', secondary: '#c82333' };
    if (isAusstehend) return { primary: '#fd7e14', secondary: '#e8650e' };
    if (isOnWaitlist) return { primary: '#fd7e14', secondary: '#e8650e' };
    if (eventData.is_registered && !isPastEvent) return { primary: '#007aff', secondary: '#0066d6' };
    if (isPastEvent) return { primary: '#6c757d', secondary: '#5a6268' };
    if (eventData.registration_status === 'open' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants && eventData.waitlist_enabled) return { primary: '#fd7e14', secondary: '#e8650e' };
    if (eventData.registration_status === 'open' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants) return { primary: '#dc3545', secondary: '#c82333' };
    if (eventData.registration_status === 'open') return { primary: '#34c759', secondary: '#2db84d' };
    if (eventData.registration_status === 'upcoming') return { primary: '#fd7e14', secondary: '#e8650e' };
    return { primary: '#dc2626', secondary: '#b91c1c' };
  };

  // Status-Text für Header
  const getStatusText = () => {
    if (!eventData) return 'Event';
    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfi = isKonfirmationEvent(eventData);
    const isOnWaitlist = eventData.booking_status === 'waitlist' || eventData.booking_status === 'pending';
    const isAusstehend = isPastEvent && eventData.is_registered && !isOnWaitlist && !eventData.attendance_status;

    if (eventData.cancelled) return 'Abgesagt';
    if (eventData.is_opted_out || eventData.booking_status === 'opted_out') return 'Abgemeldet';
    if (isKonfi && !isPastEvent) return eventData.is_registered ? 'Angemeldet' : 'Konfirmation';
    if (isPastEvent && eventData.attendance_status === 'present') return 'Verbucht';
    if (isPastEvent && eventData.attendance_status === 'absent') return 'Verpasst';
    if (isAusstehend) return 'Ausstehend';
    if (isOnWaitlist) return `Warteliste (${eventData.waitlist_position || '?'})`;
    if (eventData.is_registered && !isPastEvent) return 'Angemeldet';
    if (isPastEvent) return 'Vergangen';
    // Voll aber Warteliste aktiv
    if (eventData.registration_status === 'open' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants && eventData.waitlist_enabled) return 'Warteliste';
    // Voll ohne Warteliste
    if (eventData.registration_status === 'open' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants) return 'Ausgebucht';
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
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">{eventData.name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshEvents();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Event Header - SectionHeader mit status-basierten Farben */}
        <SectionHeader
          title={eventData.name}
          subtitle={getStatusText()}
          icon={calendar}
          colors={getStatusColors()}
          stats={[
            { value: spotsLeft > 0 ? spotsLeft : 0, label: 'Frei' },
            { value: eventData.points, label: 'Punkte' },
            { value: eventData.registered_count, label: 'Dabei' }
          ]}
        />

        {/* QR Check-in Status / Button */}
        {eventData.attendance_status === 'present' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            margin: '0 16px 8px 16px',
            backgroundColor: 'rgba(52, 199, 89, 0.12)',
            borderRadius: '12px',
            color: '#34c759',
            fontWeight: '600',
            fontSize: '1rem'
          }}>
            <IonIcon icon={checkmarkCircle} style={{ fontSize: '1.3rem' }} />
            Anwesend
          </div>
        ) : (eventData.booking_status === 'confirmed' && !eventData.attendance_status) && (
          <div style={{ padding: '0 16px', marginBottom: '8px' }}>
            <IonButton
              expand="block"
              onClick={() => presentScannerModal({
                presentingElement: pageRef.current || undefined
              })}
              style={{
                '--background': '#007aff',
                '--background-activated': '#0066d6',
                '--color': 'white'
              }}
            >
              <IonIcon icon={qrCodeOutline} slot="start" />
              Einchecken
            </IonButton>
          </div>
        )}

        {/* Event Details - 1:1 wie Admin */}
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
                <div className="app-info-row app-info-row--top">
                  <IonIcon icon={time} className="app-info-row__icon app-icon-color--events app-event-detail__icon--align-top" />
                  <div className="app-event-detail__timeslot-list">
                    <div className="app-list-item__title">Zeitfenster:</div>
                    {timeslots.map((slot, idx) => (
                      <div key={slot.id || idx} className="app-info-row__sublabel app-event-detail__timeslot-entry">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)} ({slot.registered_count || 0}/{slot.max_participants} TN)
                      </div>
                    ))}
                    {/* Gebuchter Timeslot hervorheben wenn angemeldet */}
                    {eventData.is_registered && eventData.booked_timeslot_start && (
                      <div className="app-icon-color--success app-event-detail__booked-slot">
                        Dein Slot: {formatTime(eventData.booked_timeslot_start)}
                        {eventData.booked_timeslot_end && ` - ${formatTime(eventData.booked_timeslot_end)}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TN gesamt */}
              <div className="app-info-row">
                <IonIcon icon={people} className="app-info-row__icon app-icon-color--participants" />
                <div className="app-info-row__content">
                  {eventData.registered_count} / {eventData.max_participants > 0 ? eventData.max_participants : '∞'} Teilnehmer:innen
                </div>
              </div>

              {/* Warteliste */}
              {eventData.waitlist_enabled && (
                <div className="app-info-row">
                  <IonIcon icon={listOutline} className="app-info-row__icon app-icon-color--warning" />
                  <div className="app-info-row__content">
                    {eventData.waitlist_count || 0} / {eventData.max_waitlist_size || 10} auf Warteliste
                    {eventData.waitlist_position && <strong> (Du: Platz {eventData.waitlist_position})</strong>}
                  </div>
                </div>
              )}

              {/* Punkte */}
              <div className="app-info-row">
                <IonIcon icon={trophy} className="app-info-row__icon app-icon-color--badges" />
                <div className="app-info-row__content">
                  {eventData.points} Punkte
                </div>
              </div>

              {/* Typ */}
              <div className="app-info-row">
                <IonIcon
                  icon={eventData.point_type === 'gottesdienst' ? home : people}
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
                  <IonIcon icon={pricetag} className="app-info-row__icon app-icon-color--category" />
                  <div className="app-info-row__content">
                    {eventData.categories.map(c => c.name).join(', ')}
                  </div>
                </div>
              )}

              {/* Ort */}
              {eventData.location && (
                <div className="app-info-row">
                  <IonIcon icon={location} className="app-info-row__icon app-icon-color--events" />
                  <div
                    className="app-info-row__content app-event-detail__location-link"
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

              {/* Pflicht-Badge */}
              {eventData.mandatory && (
                <div className="app-info-row">
                  <IonIcon icon={shieldCheckmark} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                  <div className="app-info-row__content">
                    Pflicht-Event
                  </div>
                </div>
              )}

              {/* Was mitbringen */}
              {eventData.bring_items && (
                <div className="app-info-row">
                  <IonIcon icon={bagHandle} className="app-info-row__icon" style={{ color: '#8b5cf6' }} />
                  <div className="app-info-row__content">
                    {eventData.bring_items}
                  </div>
                </div>
              )}

              {/* Anmeldezeitraum - nicht bei Pflicht-Events */}
              {!eventData.mandatory && (
              <div className="app-info-row app-info-row--top">
                <IonIcon icon={time} className="app-info-row__icon app-icon-color--events app-event-detail__icon--align-top-sm" />
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

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Beschreibung - eigene Card mit rotem Icon */}
        {eventData.description && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={informationCircle} />
              </div>
              <IonLabel>Beschreibung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                <div className="app-description-text">
                  {eventData.description}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Teilnehmer-Liste */}
        {participants.length > 0 && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={people} />
              </div>
              <IonLabel>Teilnehmer:innen ({participants.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="app-list-item app-list-item--events"
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle app-icon-circle--events">
                            <IonIcon icon={personOutline} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">{participant.display_name}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Action Buttons */}
        <div className="app-event-detail__action-area">
          {eventData.mandatory ? (
            (() => {
              const isPastEvent = new Date(eventData.event_date) < new Date();
              const isOptedOut = eventData.is_opted_out || eventData.booking_status === 'opted_out';

              if (isPastEvent) {
                return (
                  <IonNote color="medium" style={{ display: 'block', textAlign: 'center', padding: '16px', fontSize: '0.95rem' }}>
                    <IonIcon icon={shieldCheckmark} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Pflicht-Event (vergangen)
                  </IonNote>
                );
              }

              if (isOptedOut) {
                return (
                  <div style={{ textAlign: 'center', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#dc2626', fontWeight: 600, fontSize: '0.95rem', marginBottom: '12px' }}>
                      <IonIcon icon={closeCircle} />
                      Du hast dich abgemeldet
                    </div>
                    <IonButton
                      className="app-action-button"
                      expand="block"
                      style={{
                        '--background': '#34c759',
                        '--background-activated': '#2da84e',
                        '--background-hover': '#30b853',
                        '--color': 'white'
                      }}
                      onClick={handleOptIn}
                    >
                      <IonIcon icon={checkmarkCircle} slot="start" />
                      Wieder anmelden
                    </IonButton>
                  </div>
                );
              }

              if (eventData.is_registered) {
                return (
                  <div style={{ textAlign: 'center', padding: '12px 16px' }}>
                    <IonNote color="medium" style={{ display: 'block', marginBottom: '12px', fontSize: '0.95rem' }}>
                      <IonIcon icon={shieldCheckmark} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                      Du bist automatisch angemeldet
                    </IonNote>
                    <IonButton
                      className="app-action-button"
                      expand="block"
                      fill="outline"
                      color="danger"
                      disabled={!isOnline}
                      onClick={() => presentOptOutModal({
                        presentingElement: pageRef.current || undefined
                      })}
                    >
                      <IonIcon icon={closeCircle} slot="start" />
                      {!isOnline ? <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</> : 'Abmelden'}
                    </IonButton>
                  </div>
                );
              }

              // Nicht angemeldet bei Pflicht-Event -- nur Hinweis, kein Button
              return (
                <IonNote color="medium" style={{ display: 'block', textAlign: 'center', padding: '16px', fontSize: '0.95rem' }}>
                  <IonIcon icon={shieldCheckmark} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Pflicht-Event
                </IonNote>
              );
            })()
          ) : eventData.is_registered ? (
            <div>
              {canUnregister(eventData) ? (
                <IonButton
                  className="app-action-button"
                  expand="block"
                  fill="outline"
                  color="danger"
                  disabled={!isOnline}
                  onClick={() => presentUnregisterModal({
                    presentingElement: pageRef.current || undefined
                  })}
                >
                  <IonIcon icon={closeCircle} slot="start" />
                  {!isOnline ? <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</> : 'Abmelden'}
                </IonButton>
              ) : (
                <IonButton
                  className="app-action-button"
                  expand="block"
                  fill="outline"
                  color="medium"
                  disabled
                >
                  <IonIcon icon={warning} slot="start" />
                  Abmeldung nicht mehr möglich
                </IonButton>
              )}
            </div>
          ) : (isKonfirmationEvent(eventData) && hasExistingKonfirmation) ? (
            <IonButton
              className="app-action-button"
              expand="block"
              disabled
              color="medium"
            >
              <IonIcon icon={warning} slot="start" />
              Konfirmationstermin bereits gebucht
            </IonButton>
          ) : eventData.can_register && eventData.registration_status === 'open' && (eventData.max_participants === 0 || eventData.registered_count < eventData.max_participants) ? (
            <IonButton
              className="app-action-button"
              expand="block"
              disabled={!isOnline}
              style={{
                '--background': '#34c759',
                '--background-activated': '#2da84e',
                '--background-hover': '#30b853',
                '--color': 'white'
              }}
              onClick={handleRegister}
            >
              <IonIcon icon={checkmarkCircle} slot="start" />
              {!isOnline ? <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</> : `Anmelden (${eventData.registered_count}/${eventData.max_participants})`}
            </IonButton>
          ) : eventData.waitlist_enabled && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants && eventData.registration_status === 'open' ? (
            <IonButton
              className="app-action-button"
              expand="block"
              disabled={!isOnline}
              style={{
                '--background': '#fd7e14',
                '--background-activated': '#e8650e',
                '--background-hover': '#f4720b',
                '--color': 'white'
              }}
              onClick={handleRegister}
            >
              <IonIcon icon={hourglass} slot="start" />
              {!isOnline ? <><IonIcon icon={cloudOfflineOutline} style={{ marginRight: 4 }} /> Du bist offline</> : `Warteliste offen (${eventData.waitlist_count || 0}/${eventData.max_waitlist_size || 0})`}
            </IonButton>
          ) : (
            <IonButton
              className="app-action-button"
              expand="block"
              disabled
              color="medium"
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
