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
  useIonModal,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonActionSheet
} from '@ionic/react';
import {
  arrowBack,
  createOutline,
  calendar,
  location,
  people,
  time,
  flash,
  personAdd,
  checkmarkCircle,
  closeCircle,
  checkmark,
  trash,
  list,
  listOutline,
  home,
  pricetag,
  returnUpBack,
  trophy
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { parseLocalTime, getLocalNow } from '../../../utils/dateUtils';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader } from '../../shared';
import EventModal from '../modals/EventModal';
import ParticipantManagementModal from '../modals/ParticipantManagementModal';

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
  jahrgaenge?: Jahrgang[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed';
  available_spots: number;
  participants: Participant[];
  timeslots?: Timeslot[];
  has_timeslots?: boolean;
  is_series?: boolean;
  series_id?: string;
  series_events?: Event[];
  created_at: string;
}

interface Jahrgang {
  id: number;
  name: string;
}

interface Participant {
  id: number;
  user_id?: number;
  participant_name: string;
  jahrgang_name?: string;
  created_at: string;
  status?: 'confirmed' | 'pending';
  attendance_status?: 'present' | 'absent' | null;
  timeslot_start_time?: string;
  timeslot_end_time?: string;
}

interface Timeslot {
  id: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count: number;
}

interface Unregistration {
  id: number;
  user_id: number;
  konfi_name: string;
  reason?: string;
  unregistered_at: string;
}

interface EventDetailViewProps {
  eventId: number;
  onBack: () => void;
}

const EventDetailView: React.FC<EventDetailViewProps> = ({ eventId, onBack }) => {
  const pageRef = useRef<HTMLElement>(null);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());
  const { setSuccess, setError } = useApp();
  const [presentActionSheet] = useIonActionSheet();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [unregistrations, setUnregistrations] = useState<Unregistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);

  // Event Modal mit useIonModal Hook
  const [presentEventModalHook, dismissEventModalHook] = useIonModal(EventModal, {
    event: eventData,
    onClose: () => dismissEventModalHook(),
    onSuccess: () => {
      dismissEventModalHook();
      handleEditSuccess();
    },
    dismiss: () => dismissEventModalHook()
  });

  // Participant Management Modal
  const [presentParticipantModalHook, dismissParticipantModalHook] = useIonModal(ParticipantManagementModal, {
    eventId: eventId,
    participants: participants,
    onClose: () => dismissParticipantModalHook(),
    onSuccess: () => {
      dismissParticipantModalHook();
      loadEventData(); // Reload to get updated participant list
    },
    dismiss: () => dismissParticipantModalHook()
  });

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  useEffect(() => {
    // Setze das presentingElement nach dem ersten Mount
    setPresentingElement(pageRef.current);
  }, []);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const eventRes = await api.get(`/events/${eventId}`);
      setEventData(eventRes.data);
      setParticipants(eventRes.data.participants || []);
      setUnregistrations(eventRes.data.unregistrations || []);
    } catch (error) {
      setError('Fehler beim Laden der Event-Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadEventData();
    (event.target as HTMLIonRefresherElement).complete();
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
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'medium';
      case 'open': return 'success';
      case 'closed': return 'danger';
      default: return 'medium';
    }
  };

  const getRegistrationStatusText = (status: string, event?: Event | null) => {
    switch (status) {
      case 'upcoming': return 'Bald verfügbar';
      case 'open': return 'Anmeldung offen';
      case 'closed': {
        if (event) {
          const waitlistEnabled = (event as any)?.waitlist_enabled;
          const maxWaitlistSize = (event as any)?.max_waitlist_size || 0;
          const pendingCount = participants.filter(p => p.status === 'pending').length;
          const eventFull = event.max_participants > 0 && event.registered_count >= event.max_participants;

          if (eventFull) {
            if (waitlistEnabled && pendingCount < maxWaitlistSize) {
              return 'Warteliste offen';
            }
            return 'Ausgebucht';
          }
        }
        return 'Anmeldung geschlossen';
      }
      default: return 'Unbekannt';
    }
  };

  const calculateRegistrationStatus = (event: Event): 'upcoming' | 'open' | 'closed' => {
    const now = getLocalNow();

    // If registration hasn't opened yet
    if (event.registration_opens_at) {
      const opensAt = parseLocalTime(event.registration_opens_at);
      if (now < opensAt) {
        return 'upcoming';
      }
    }

    // If registration has closed
    if (event.registration_closes_at) {
      const closesAt = parseLocalTime(event.registration_closes_at);
      if (now > closesAt) {
        return 'closed';
      }
    }

    // If event is full (nur wenn max_participants > 0, sonst unbegrenzt)
    if (event.max_participants > 0 && event.registered_count >= event.max_participants) {
      return 'closed';
    }

    return 'open';
  };

  const handleEditSuccess = () => {
    // Reload event data
    onBack();
  };

  // Status-Farben fuer SectionHeader (dynamisch basierend auf Event-Zustand)
  const getStatusColors = (): { primary: string; secondary: string } => {
    if (!eventData) return { primary: '#dc2626', secondary: '#b91c1c' };

    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfirmationEvent = eventData.categories?.some(cat =>
      cat.name.toLowerCase().includes('konfirmation')
    );
    const isCancelled = eventData.registration_status === 'cancelled' as string;
    const hasUnprocessedBookings = isPastEvent && eventData.registered_count > 0 &&
      participants.some(p => p.status === 'confirmed' && !p.attendance_status);

    if (isCancelled) return { primary: '#dc3545', secondary: '#c82333' };
    if (isKonfirmationEvent && !isPastEvent) return { primary: '#5b21b6', secondary: '#4c1d95' };
    if (hasUnprocessedBookings) return { primary: '#007aff', secondary: '#0066d6' };
    if (isPastEvent) return { primary: '#6c757d', secondary: '#5a6268' };

    const regStatus = calculateRegistrationStatus(eventData);
    if (regStatus === 'closed' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants && (eventData as any).waitlist_enabled) return { primary: '#fd7e14', secondary: '#e8650e' };
    if (regStatus === 'closed' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants) return { primary: '#dc3545', secondary: '#c82333' };
    if (regStatus === 'open') return { primary: '#34c759', secondary: '#2db84d' };
    if (regStatus === 'upcoming') return { primary: '#fd7e14', secondary: '#e8650e' };
    return { primary: '#dc2626', secondary: '#b91c1c' };
  };

  // Status-Text fuer SectionHeader
  const getStatusText = () => {
    if (!eventData) return 'Event';

    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfirmationEvent = eventData.categories?.some(cat =>
      cat.name.toLowerCase().includes('konfirmation')
    );
    const isCancelled = eventData.registration_status === 'cancelled' as string;
    const hasUnprocessedBookings = isPastEvent && eventData.registered_count > 0 &&
      participants.some(p => p.status === 'confirmed' && !p.attendance_status);

    if (isCancelled) return 'Abgesagt';
    if (isKonfirmationEvent && !isPastEvent) return 'Konfirmation';
    if (hasUnprocessedBookings) return 'Verbuchen';
    if (isPastEvent && !hasUnprocessedBookings) return 'Verbucht';

    const regStatus = calculateRegistrationStatus(eventData);
    if (regStatus === 'closed' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants && (eventData as any).waitlist_enabled) return 'Warteliste';
    if (regStatus === 'closed' && eventData.max_participants > 0 && eventData.registered_count >= eventData.max_participants) return 'Ausgebucht';
    if (regStatus === 'open') return 'Offen';
    if (regStatus === 'upcoming') return 'Bald';
    return 'Geschlossen';
  };

  const handleAttendanceUpdate = async (participant: Participant, status: 'present' | 'absent') => {
    try {
      // Update attendance status using new API
      const response = await api.put(`/events/${eventId}/participants/${participant.id}/attendance`, {
        attendance_status: status
      });

      // Show appropriate success message based on response
      if (response.data.points_awarded) {
        setSuccess(`Anwesenheit bestätigt und ${response.data.points} ${response.data.point_type} Punkte vergeben`);
      } else if (response.data.points_removed) {
        setSuccess(`Anwesenheit als abwesend markiert und ${response.data.points} ${response.data.point_type} Punkte entfernt`);
      } else {
        setSuccess(`Anwesenheit ${status === 'present' ? 'bestätigt' : 'als abwesend markiert'}`);
      }

      await loadEventData(); // Reload to update status

      // Trigger events update for main list
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (error) {
      setError('Fehler beim Aktualisieren der Anwesenheit');
    }
  };

  const showAttendanceActionSheet = (participant: Participant) => {
    const buttons: any[] = [];

    // Anwesend Button
    if (participant.attendance_status !== 'present') {
      buttons.push({
        text: 'Anwesend',
        icon: checkmarkCircle,
        handler: () => handleAttendanceUpdate(participant, 'present')
      });
    }

    // Abwesend Button
    if (participant.attendance_status !== 'absent') {
      buttons.push({
        text: 'Abwesend',
        icon: closeCircle,
        handler: () => handleAttendanceUpdate(participant, 'absent')
      });
    }

    // Cancel Button
    buttons.push({
      text: 'Abbrechen',
      role: 'cancel'
    });

    presentActionSheet({
      header: participant.participant_name,
      subHeader: 'Anwesenheit verwalten',
      buttons
    });
  };

  const showWaitlistActionSheet = (participant: Participant) => {
    presentActionSheet({
      header: participant.participant_name,
      subHeader: 'Warteliste verwalten',
      buttons: [
        {
          text: 'Bestätigen',
          icon: checkmark,
          handler: () => handlePromoteParticipant(participant)
        },
        {
          text: 'Entfernen',
          icon: trash,
          role: 'destructive',
          handler: () => handleRemoveParticipant(participant)
        },
        {
          text: 'Abbrechen',
          role: 'cancel'
        }
      ]
    });
  };

  const handlePromoteParticipant = async (participant: Participant) => {
    try {
      await api.put(`/events/${eventId}/participants/${participant.id}/status`, {
        status: 'confirmed'
      });
      setSuccess(`${participant.participant_name} von Warteliste bestätigt`);
      await loadEventData(); // Reload to update list

      // Trigger events update for main list
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (error) {
 console.error('Promote participant error:', error);
      setError('Fehler beim Bestätigen des Teilnehmers');
    }
  };

  const handleDemoteParticipant = async (participant: Participant) => {
    try {
      await api.put(`/events/${eventId}/participants/${participant.id}/status`, {
        status: 'pending'
      });
      setSuccess(`${participant.participant_name} auf Warteliste gesetzt`);

      // Close sliding item
      const slidingItem = slidingRefs.current.get(participant.id);
      if (slidingItem) {
        await slidingItem.close();
      }

      await loadEventData(); // Reload to update list

      // Trigger events update for main list
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (error) {
 console.error('Demote participant error:', error);
      setError('Fehler beim Verschieben auf Warteliste');
    }
  };

  const handleRemoveParticipant = async (participant: Participant) => {
    try {
      // Use booking ID for deletion, not user ID
      await api.delete(`/events/${eventId}/bookings/${participant.id}`);
      setSuccess('Teilnehmer entfernt');
      await loadEventData(); // Reload to update list

      // Trigger events update for main list
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (error) {
 console.error('Delete participant error:', error);
      setError('Fehler beim Entfernen des Teilnehmers');
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{eventData?.name || 'Event Details'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => presentEventModalHook({ presentingElement: presentingElement || undefined })}>
              <IonIcon icon={createOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large">{eventData?.name || 'Event Details'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {/* Event Header - SectionHeader mit status-basierten Farben */}
        <SectionHeader
          title={eventData?.name || 'Event'}
          subtitle={getStatusText()}
          icon={calendar}
          colors={getStatusColors()}
          stats={[
            { value: participants.filter(p => p.status === 'confirmed').length, label: 'TN' },
            { value: eventData?.points || 0, label: 'Punkte' },
            { value: participants.filter(p => p.attendance_status === 'present').length, label: 'Anwesend' }
          ]}
        />

        {/* Event Details */}
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
                    {formatDate(eventData?.event_date || '')}
                  </div>
                  <div className="app-info-row__sublabel">
                    {formatTime(eventData?.event_date || '')}
                    {eventData?.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
                  </div>
                </div>
              </div>

              {/* Zeitslots anzeigen wenn vorhanden */}
              {eventData?.has_timeslots && eventData?.timeslots && eventData.timeslots.length > 0 && (
                <div className="app-info-row app-info-row--top">
                  <IonIcon icon={time} className="app-info-row__icon app-icon-color--events" style={{ marginTop: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="app-list-item__title">Zeitfenster:</div>
                    {eventData.timeslots.map((slot, idx) => (
                      <div key={slot.id || idx} className="app-info-row__sublabel" style={{ marginBottom: '4px' }}>
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)} ({slot.registered_count || 0}/{slot.max_participants} TN)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TN gesamt */}
              <div className="app-info-row">
                <IonIcon icon={people} className="app-info-row__icon app-icon-color--participants" />
                <div className="app-info-row__content">
                  {eventData?.registered_count || 0} / {(eventData?.max_participants || 0) > 0 ? eventData?.max_participants : '∞'} Teilnehmer:innen
                </div>
              </div>

              {/* Warteliste */}
              {(eventData as any)?.waitlist_enabled && (
                <div className="app-info-row">
                  <IonIcon icon={listOutline} className="app-info-row__icon app-icon-color--warning" />
                  <div className="app-info-row__content">
                    {participants.filter(p => p.status === 'pending').length} / {(eventData as any)?.max_waitlist_size || 10} auf Warteliste
                  </div>
                </div>
              )}

              {/* Punkte */}
              <div className="app-info-row">
                <IonIcon icon={trophy} className="app-info-row__icon app-icon-color--badges" />
                <div className="app-info-row__content">
                  {eventData?.points || 0} Punkte
                </div>
              </div>

              {/* Typ */}
              <div className="app-info-row">
                <IonIcon
                  icon={eventData?.point_type === 'gottesdienst' ? home : people}
                  className="app-info-row__icon"
                  style={{ color: eventData?.point_type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
                />
                <div className="app-info-row__content">
                  {eventData?.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                </div>
              </div>

              {/* Kategorien */}
              {eventData?.categories && eventData.categories.length > 0 && (
                <div className="app-info-row">
                  <IonIcon icon={pricetag} className="app-info-row__icon app-icon-color--category" />
                  <div className="app-info-row__content">
                    {eventData.categories.map(c => c.name).join(', ')}
                  </div>
                </div>
              )}

              {/* Ort */}
              {eventData?.location && (
                <div className="app-info-row">
                  <IonIcon icon={location} className="app-info-row__icon app-icon-color--events" />
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
              <div className="app-info-row app-info-row--top">
                <IonIcon icon={time} className="app-info-row__icon app-icon-color--events" style={{ marginTop: '2px' }} />
                <div className="app-info-row__content">
                  {eventData?.registration_opens_at ? (
                    <>
                      <div>von {new Date(eventData.registration_opens_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_opens_at)}</div>
                      {eventData?.registration_closes_at && (
                        <div className="app-info-row__sublabel">bis {new Date(eventData.registration_closes_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_closes_at)}</div>
                      )}
                    </>
                  ) : (
                    'Sofort möglich'
                  )}
                </div>
              </div>

              {/* Jahrgang */}
              {eventData?.jahrgaenge && eventData.jahrgaenge.length > 0 && (
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon app-icon-color--jahrgang" />
                  <div className="app-info-row__content">
                    {eventData.jahrgaenge.map(j => j.name).join(', ')}
                  </div>
                </div>
              )}

              {/* Beschreibung */}
              {eventData?.description && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                  <h3 className="app-list-item__title">
                    Beschreibung
                  </h3>
                  <p className="app-info-row__sublabel">
                    {eventData.description}
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Timeslots mit Teilnehmern */}
        {eventData?.has_timeslots && eventData?.timeslots && eventData.timeslots.length > 0 && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={time} />
              </div>
              <IonLabel>Zeitslots ({eventData.timeslots.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {eventData.timeslots.map((timeslot, slotIndex) => {
                  // Vergleiche über timeslot_id (primär) oder formatierte Zeiten (fallback)
                  const slotStartFormatted = formatTime(timeslot.start_time);
                  const slotEndFormatted = formatTime(timeslot.end_time);
                  const slotParticipants = participants.filter(p => {
                    if (p.status !== 'confirmed') return false;
                    // Wenn timeslot_id vorhanden, nutze diese
                    if ((p as any).timeslot_id && (timeslot as any).id) {
                      return (p as any).timeslot_id === (timeslot as any).id;
                    }
                    // Fallback: Zeit-Vergleich
                    if (p.timeslot_start_time && p.timeslot_end_time) {
                      return formatTime(p.timeslot_start_time) === slotStartFormatted &&
                             formatTime(p.timeslot_end_time) === slotEndFormatted;
                    }
                    return false;
                  });
                  const isFull = (timeslot.registered_count || 0) >= timeslot.max_participants;

                  return (
                    <div key={timeslot.id} style={{ marginBottom: slotIndex < eventData.timeslots!.length - 1 ? '20px' : '0' }}>
                      {/* Slot Header */}
                      <div className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'}`} >
                        {/* Corner Badge für Verfügbar/Voll */}
                        <div className={`app-corner-badge ${isFull ? 'app-corner-badge--danger' : 'app-corner-badge--success'}`}>
                          {isFull ? 'Voll' : 'Frei'}
                        </div>
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className={`app-icon-circle ${isFull ? 'app-icon-circle--danger' : 'app-icon-circle--success'}`}>
                              <IonIcon icon={time} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title app-list-item__title--badge-space">
                                {slotStartFormatted} - {slotEndFormatted}
                              </div>
                              <div className="app-list-item__subtitle">
                                {timeslot.registered_count || 0}/{timeslot.max_participants} Teilnehmer
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Teilnehmer dieses Slots */}
                      {slotParticipants.length > 0 && (
                        <div style={{ marginLeft: '16px', marginTop: '8px' }}>
                          {slotParticipants.map((participant, pIndex) => {
                            const statusText = participant.attendance_status === 'present' ? 'Anwesend' :
                                               participant.attendance_status === 'absent' ? 'Abwesend' : 'Gebucht';
                            const cornerBadgeClass = participant.attendance_status === 'present' ? 'app-corner-badge--success' :
                                                     participant.attendance_status === 'absent' ? 'app-corner-badge--danger' : 'app-corner-badge--info';
                            return (
                              <IonItemSliding
                                key={participant.id}
                                style={{ marginBottom: pIndex < slotParticipants.length - 1 ? '8px' : '0', '--border-width': '0', '--inner-border-width': '0' } as any}
                              >
                                <IonItem
                                  className="app-item-transparent"
                                  button
                                  detail={false}
                                  lines="none"
                                  onClick={() => showAttendanceActionSheet(participant)}
                                >
                                  <div className="app-list-item app-list-item--booked" style={{ marginBottom: '0' }}>
                                    {/* Eselsohr-Style Status Badge */}
                                    <div className={`app-corner-badge ${cornerBadgeClass}`}>
                                      {statusText}
                                    </div>
                                    <div className="app-list-item__row">
                                      <div className="app-list-item__main">
                                        <div className={`app-icon-circle ${
                                          participant.attendance_status === 'present' ? 'app-icon-circle--success' :
                                          participant.attendance_status === 'absent' ? 'app-icon-circle--danger' : 'app-icon-circle--info'
                                        }`}>
                                          <IonIcon icon={participant.attendance_status === 'present' ? checkmarkCircle :
                                                participant.attendance_status === 'absent' ? closeCircle : people} />
                                        </div>
                                        <div className="app-list-item__content">
                                          <div className="app-list-item__title app-list-item__title--badge-space-lg">{participant.participant_name}</div>
                                          <div className="app-list-item__subtitle">
                                            {participant.jahrgang_name || ''}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </IonItem>
                                <IonItemOptions className="app-swipe-actions" side="end">
                                  <IonItemOption
                                    className="app-swipe-action"
                                    onClick={() => handleDemoteParticipant(participant)}
                                  >
                                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                                      <IonIcon icon={returnUpBack} />
                                    </div>
                                  </IonItemOption>
                                  <IonItemOption
                                    className="app-swipe-action"
                                    onClick={() => handleRemoveParticipant(participant)}
                                  >
                                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                      <IonIcon icon={trash} />
                                    </div>
                                  </IonItemOption>
                                </IonItemOptions>
                              </IonItemSliding>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Series Events */}
        {eventData?.is_series && eventData?.series_events && eventData.series_events.length > 0 && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--info">
                <IonIcon icon={calendar} />
              </div>
              <IonLabel>Weitere Termine dieser Serie</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {eventData.series_events.map((seriesEvent) => {
                  const isFull = (seriesEvent.registered_count || 0) >= seriesEvent.max_participants;
                  return (
                    <div
                      key={seriesEvent.id}
                      className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/admin/events/${seriesEvent.id}`}
                    >
                      {/* Eselsohr-Style Status Badge */}
                      <div className={`app-corner-badge ${isFull ? 'app-corner-badge--danger' : 'app-corner-badge--success'}`}>
                        {isFull ? 'Voll' : 'Frei'}
                      </div>
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className={`app-icon-circle ${isFull ? 'app-icon-circle--danger' : 'app-icon-circle--success'}`}>
                            <IonIcon icon={calendar} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title app-list-item__title--badge-space-md">
                              {seriesEvent.name}
                            </div>
                            <div className="app-list-item__subtitle">
                              {formatDate(seriesEvent.event_date)} {formatTime(seriesEvent.event_date)} | {seriesEvent.registered_count || 0}/{seriesEvent.max_participants} TN
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Participants List */}
        {(() => {
          // Bei Timeslot-Events: zeige Teilnehmer ohne Slot-Zuordnung + Warteliste
          // Bei normalen Events: zeige alle Teilnehmer
          const confirmedParticipants = participants.filter(p => p.status === 'confirmed');
          const waitlistParticipants = participants.filter(p => p.status === 'pending');

          // Bei Timeslot-Events: Teilnehmer ohne Slot-Zuordnung finden
          const unassignedParticipants = eventData?.has_timeslots
            ? confirmedParticipants.filter(p => !(p as any).timeslot_id && !p.timeslot_start_time)
            : [];

          const displayParticipants = eventData?.has_timeslots
            ? [...unassignedParticipants, ...waitlistParticipants]
            : participants;

          const hasWaitlist = (eventData as any)?.waitlist_enabled && waitlistParticipants.length > 0;
          const hasUnassigned = unassignedParticipants.length > 0;

          // Wenn keine Teilnehmer und keine Warteliste, nur Button zeigen
          if (displayParticipants.length === 0) {
            return (
              <IonList className="app-section-inset" inset={true}>
                <IonCard className="app-card">
                  <IonCardContent className="app-card-content">
                    <IonButton
                      expand="block"
                      fill="outline"
                      onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
                    >
                      <IonIcon icon={personAdd} style={{ marginRight: '8px' }} />
                      Teilnehmer:in hinzufügen
                    </IonButton>
                  </IonCardContent>
                </IonCard>
              </IonList>
            );
          }

          // Header-Text bestimmen
          let headerText = '';
          if (eventData?.has_timeslots) {
            if (hasUnassigned && hasWaitlist) {
              headerText = `Nicht zugeordnet (${unassignedParticipants.length}) + Warteliste (${waitlistParticipants.length})`;
            } else if (hasUnassigned) {
              headerText = `Nicht zugeordnet (${unassignedParticipants.length})`;
            } else {
              headerText = `Warteliste (${waitlistParticipants.length})`;
            }
          } else {
            headerText = `Teilnehmer:innen (${confirmedParticipants.length}${waitlistParticipants.length > 0 ? ` + ${waitlistParticipants.length}` : ''})`;
          }

          return (
            <IonList className="app-section-inset" inset={true}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--events">
                  <IonIcon icon={people} />
                </div>
                <IonLabel>{headerText}</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
              {(
              <IonCardContent className="app-card-content">
                {displayParticipants.map((participant, index) => {
                  const isWaitlist = participant.status === 'pending';
                  // Strich-Farbe matcht Status-Farbe
                  const listItemClass = participant.attendance_status === 'present' ? 'app-list-item--success' :
                                        participant.attendance_status === 'absent' ? 'app-list-item--danger' :
                                        isWaitlist ? 'app-list-item--warning' : 'app-list-item--info';
                  const iconCircleClass = participant.attendance_status === 'present' ? 'app-icon-circle--success' :
                                          participant.attendance_status === 'absent' ? 'app-icon-circle--danger' :
                                          isWaitlist ? 'app-icon-circle--warning' : 'app-icon-circle--info';
                  const statusIcon = participant.attendance_status === 'present' ? checkmarkCircle :
                                     participant.attendance_status === 'absent' ? closeCircle : people;
                  const statusText = participant.attendance_status === 'present' ? 'Anwesend' :
                                     participant.attendance_status === 'absent' ? 'Abwesend' :
                                     isWaitlist ? 'Warteliste' : 'Gebucht';
                  const cornerBadgeClass = participant.attendance_status === 'present' ? 'app-corner-badge--success' :
                                           participant.attendance_status === 'absent' ? 'app-corner-badge--danger' :
                                           isWaitlist ? 'app-corner-badge--warning' : 'app-corner-badge--info';

                  return (
                    <IonItemSliding
                      key={participant.id}
                      ref={(el) => {
                        if (el) {
                          slidingRefs.current.set(participant.id, el);
                        } else {
                          slidingRefs.current.delete(participant.id);
                        }
                      }}
                      style={{ marginBottom: index < displayParticipants.length - 1 ? '8px' : '0', '--border-width': '0', '--inner-border-width': '0' } as any}
                    >
                      <IonItem
                        className="app-item-transparent"
                        button
                        detail={false}
                        lines="none"
                        onClick={() => {
                          if (participant.status === 'confirmed') {
                            showAttendanceActionSheet(participant);
                          } else if (participant.status === 'pending') {
                            showWaitlistActionSheet(participant);
                          }
                        }}
                      >
                        <div className={`app-list-item ${listItemClass}`} style={{ marginBottom: '0' }}>
                          {/* Eselsohr-Style Status Badge */}
                          <div className={`app-corner-badge ${cornerBadgeClass}`}>
                            {statusText}
                          </div>
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className={`app-icon-circle ${iconCircleClass}`}>
                                <IonIcon icon={statusIcon} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title app-list-item__title--badge-space-lg">
                                  {participant.participant_name}
                                </div>
                                <div className="app-list-item__subtitle">
                                  {participant.jahrgang_name && <>{participant.jahrgang_name}</>}
                                  {participant.timeslot_start_time && participant.timeslot_end_time && (
                                    <>{participant.jahrgang_name ? ' | ' : ''}{formatTime(participant.timeslot_start_time)} - {formatTime(participant.timeslot_end_time)}</>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>
                      <IonItemOptions className="app-swipe-actions" side="end">
                        {participant.status === 'confirmed' && (
                          <IonItemOption
                            className="app-swipe-action"
                            onClick={() => handleDemoteParticipant(participant)}
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                              <IonIcon icon={returnUpBack} />
                            </div>
                          </IonItemOption>
                        )}
                        <IonItemOption
                          className="app-swipe-action"
                          onClick={() => handleRemoveParticipant(participant)}
                        >
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                            <IonIcon icon={trash} />
                          </div>
                        </IonItemOption>
                      </IonItemOptions>
                    </IonItemSliding>
                  );
                })}
                <div style={{ marginTop: '16px' }}>
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
                  >
                    <IonIcon icon={personAdd} style={{ marginRight: '8px' }} />
                    Teilnehmer:in hinzufügen
                  </IonButton>
                </div>
              </IonCardContent>
              )}
              </IonCard>
            </IonList>
          );
        })()}

        {/* Abmeldungen (Unregistrations) */}
        {unregistrations.length > 0 && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--danger">
                <IonIcon icon={closeCircle} />
              </div>
              <IonLabel>Abmeldungen ({unregistrations.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {unregistrations.map((unreg) => (
                  <div key={unreg.id} className="app-list-item app-list-item--danger">
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <IonIcon icon={closeCircle} className="app-icon-color--danger" style={{ fontSize: '1.2rem' }} />
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">
                            {unreg.konfi_name}
                          </div>
                          <div className="app-list-item__subtitle">
                            Abgemeldet am {new Date(unreg.unregistered_at).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    {unreg.reason && (
                      <div className="app-reason-box app-reason-box--danger" style={{ marginLeft: '32px' }}>
                        <span className="app-reason-box__label">Grund:</span> {unreg.reason}
                      </div>
                    )}
                  </div>
                ))}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

      </IonContent>
    </IonPage>
  );
};

export default EventDetailView;