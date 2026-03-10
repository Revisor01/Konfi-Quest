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
  trophy,
  informationCircle,
  shieldCheckmark,
  bagHandle,
  qrCodeOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { parseLocalTime, getLocalNow } from '../../../utils/dateUtils';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader } from '../../shared';
import EventModal from '../modals/EventModal';
import ParticipantManagementModal from '../modals/ParticipantManagementModal';
import QRDisplayModal from '../modals/QRDisplayModal';

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
  mandatory?: boolean;
  bring_items?: string;
  teamer_needed?: boolean;
  teamer_only?: boolean;
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
  role_name?: string;
  created_at: string;
  status?: 'confirmed' | 'pending' | 'opted_out';
  attendance_status?: 'present' | 'absent' | null;
  timeslot_start_time?: string;
  timeslot_end_time?: string;
  opt_out_reason?: string;
  opt_out_date?: string;
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

  // QR Display Modal
  const [presentQRDisplayModal, dismissQRDisplayModal] = useIonModal(QRDisplayModal, {
    eventId: eventId,
    eventName: eventData?.name || '',
    eventDate: eventData?.event_date || '',
    onClose: () => dismissQRDisplayModal()
  });

  // Participant Management Modal
  const [presentParticipantModalHook, dismissParticipantModalHook] = useIonModal(ParticipantManagementModal, {
    eventId: eventId,
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
    // Optimistisches UI-Update: sofort anzeigen
    setParticipants(prev => prev.map(p =>
      p.id === participant.id ? { ...p, attendance_status: status } : p
    ));

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

      // Trigger events update for main list
      window.dispatchEvent(new CustomEvent('events-updated'));
    } catch (error) {
      // Rollback bei Fehler
      setParticipants(prev => prev.map(p =>
        p.id === participant.id ? { ...p, attendance_status: participant.attendance_status } : p
      ));
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
            <IonButton onClick={() => presentQRDisplayModal({ presentingElement: presentingElement || undefined })}>
              <IonIcon icon={qrCodeOutline} />
            </IonButton>
            <IonButton onClick={() => presentEventModalHook({ presentingElement: presentingElement || undefined })}>
              <IonIcon icon={createOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
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
          stats={(() => {
            const konfiOnly = participants.filter(p => p.role_name !== 'teamer');
            const teamerOnly = participants.filter(p => p.role_name === 'teamer');
            const hasTeamer = (eventData?.teamer_needed || eventData?.teamer_only) && teamerOnly.length > 0;
            const presentCount = konfiOnly.filter(p => p.attendance_status === 'present').length;
            const absentCount = konfiOnly.filter(p => p.attendance_status === 'absent' || p.status === 'opted_out').length;
            const konfiConfirmed = konfiOnly.filter(p => p.status === 'confirmed').length;
            if (eventData?.mandatory) {
              return [
                { value: presentCount, label: `von ${konfiOnly.length} TN` },
                { value: absentCount, label: 'Abwesend' },
                hasTeamer
                  ? { value: teamerOnly.length, label: 'Team' }
                  : { value: konfiOnly.filter(p => p.status === 'opted_out').length, label: 'Abgemeldet' }
              ];
            }
            const maxP = (eventData?.max_participants || 0) > 0 ? eventData?.max_participants : '\u221E';
            return [
              { value: konfiConfirmed, label: `von ${maxP} TN` },
              hasTeamer
                ? { value: teamerOnly.length, label: 'Team' }
                : { value: eventData?.points || 0, label: 'Punkte' },
              { value: konfiOnly.filter(p => p.status === 'pending').length, label: 'Warteliste' }
            ];
          })()}
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
                  <IonIcon icon={time} className="app-info-row__icon app-icon-color--events app-event-detail__icon--align-top" />
                  <div className="app-event-detail__timeslot-list">
                    <div className="app-list-item__title">Zeitfenster:</div>
                    {eventData.timeslots.map((slot, idx) => (
                      <div key={slot.id || idx} className="app-info-row__sublabel app-event-detail__timeslot-entry">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)} ({slot.registered_count || 0}/{slot.max_participants} TN)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TN gesamt - Konfis und Teamer getrennt */}
              {(() => {
                const konfiOnly = participants.filter(p => p.role_name !== 'teamer');
                const teamerOnly = participants.filter(p => p.role_name === 'teamer');
                const konfiPresent = konfiOnly.filter(p => p.attendance_status === 'present').length;
                const konfiConfirmed = konfiOnly.filter(p => p.status === 'confirmed').length;
                return (
                  <>
                    <div className="app-info-row">
                      <IonIcon icon={people} className="app-info-row__icon app-icon-color--participants" />
                      <div className="app-info-row__content">
                        {eventData?.mandatory
                          ? `${konfiPresent}/${konfiOnly.length} Konfis`
                          : `${konfiConfirmed} / ${(eventData?.max_participants || 0) > 0 ? eventData?.max_participants : '\u221E'} Konfis`
                        }
                      </div>
                    </div>
                    {teamerOnly.length > 0 && (
                      <div className="app-info-row">
                        <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                        <div className="app-info-row__content">
                          {teamerOnly.length} Teamer:innen
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Warteliste */}
              {(eventData as any)?.waitlist_enabled && (
                <div className="app-info-row">
                  <IonIcon icon={listOutline} className="app-info-row__icon app-icon-color--warning" />
                  <div className="app-info-row__content">
                    {participants.filter(p => p.status === 'pending').length} / {(eventData as any)?.max_waitlist_size || 10} auf Warteliste
                  </div>
                </div>
              )}

              {/* Punkte - bei Pflicht-Events ausblenden */}
              {!eventData?.mandatory && (
              <div className="app-info-row">
                <IonIcon icon={trophy} className="app-info-row__icon app-icon-color--badges" />
                <div className="app-info-row__content">
                  {eventData?.points || 0} Punkte
                </div>
              </div>
              )}

              {/* Typ - bei Pflicht-Events ausblenden */}
              {!eventData?.mandatory && (
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
              )}

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
              {eventData?.mandatory && (
                <div className="app-info-row">
                  <IonIcon icon={shieldCheckmark} className="app-info-row__icon" style={{ color: '#dc2626' }} />
                  <div className="app-info-row__content">
                    Pflicht-Event
                  </div>
                </div>
              )}

              {/* Teamer-Zugang Badge */}
              {(eventData?.teamer_needed || eventData?.teamer_only) && (
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#5b21b6' }} />
                  <div className="app-info-row__content">
                    {eventData?.teamer_only ? 'Nur Teamer:innen' : 'Teamer:innen gesucht'}
                  </div>
                </div>
              )}

              {/* Was mitbringen */}
              {eventData?.bring_items && (
                <div className="app-info-row">
                  <IonIcon icon={bagHandle} className="app-info-row__icon" style={{ color: '#8b5cf6' }} />
                  <div className="app-info-row__content">
                    {eventData.bring_items}
                  </div>
                </div>
              )}

              {/* Anmeldezeitraum */}
              {!eventData?.mandatory && (
              <div className="app-info-row app-info-row--top">
                <IonIcon icon={time} className="app-info-row__icon app-icon-color--events app-event-detail__icon--align-top-sm" />
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
              )}

              {/* Jahrgang */}
              {eventData?.jahrgaenge && eventData.jahrgaenge.length > 0 && (
                <div className="app-info-row">
                  <IonIcon icon={people} className="app-info-row__icon app-icon-color--jahrgang" />
                  <div className="app-info-row__content">
                    {eventData.jahrgaenge.map(j => j.name).join(', ')}
                  </div>
                </div>
              )}

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Beschreibung - eigene Card (wie Konfi-Ansicht) */}
        {eventData?.description && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={informationCircle} />
              </div>
              <IonLabel>Beschreibung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                <p className="app-info-row__sublabel">
                  {eventData.description}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

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
                    <div key={timeslot.id} className="app-event-detail__slot-group">
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
                        <div className="app-event-detail__slot-participants">
                          {slotParticipants.map((participant, pIndex) => {
                            const statusText = participant.attendance_status === 'present' ? 'Anwesend' :
                                               participant.attendance_status === 'absent' ? 'Abwesend' : 'Gebucht';
                            const cornerBadgeClass = participant.attendance_status === 'present' ? 'app-corner-badge--success' :
                                                     participant.attendance_status === 'absent' ? 'app-corner-badge--danger' : 'app-corner-badge--info';
                            return (
                              <IonItemSliding
                                key={participant.id}
                                className="app-event-detail__sliding-item"
                              >
                                <IonItem
                                  className="app-item-transparent"
                                  button
                                  detail={false}
                                  lines="none"
                                  onClick={() => showAttendanceActionSheet(participant)}
                                >
                                  <div className="app-list-item app-list-item--booked app-event-detail__list-item-flush">
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
                                {!eventData?.mandatory && (
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
                                )}
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
                      className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'} app-event-detail__series-link`}
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
          // Teilnehmer nach Rolle aufteilen
          const konfiParticipants = participants.filter(p => p.role_name !== 'teamer');
          const teamerParticipants = participants.filter(p => p.role_name === 'teamer');

          // Bei Timeslot-Events: zeige Teilnehmer ohne Slot-Zuordnung + Warteliste
          // Bei normalen Events: zeige alle Konfis
          const confirmedParticipants = konfiParticipants.filter(p => p.status === 'confirmed');
          const waitlistParticipants = konfiParticipants.filter(p => p.status === 'pending');

          // Bei Timeslot-Events: Teilnehmer ohne Slot-Zuordnung finden
          const unassignedParticipants = eventData?.has_timeslots
            ? confirmedParticipants.filter(p => !(p as any).timeslot_id && !p.timeslot_start_time)
            : [];

          const displayParticipants = eventData?.has_timeslots
            ? [...unassignedParticipants, ...waitlistParticipants]
            : konfiParticipants;

          const hasWaitlist = (eventData as any)?.waitlist_enabled && waitlistParticipants.length > 0;
          const hasUnassigned = unassignedParticipants.length > 0;

          // Helper: Einzelnen Teilnehmer rendern
          const renderParticipant = (participant: Participant) => {
            const isWaitlist = participant.status === 'pending';
            const isOptedOut = participant.status === 'opted_out';
            const listItemClass = isOptedOut ? 'app-list-item--danger' :
                                  participant.attendance_status === 'present' ? 'app-list-item--success' :
                                  participant.attendance_status === 'absent' ? 'app-list-item--danger' :
                                  isWaitlist ? 'app-list-item--warning' : 'app-list-item--info';
            const iconCircleClass = isOptedOut ? 'app-icon-circle--danger' :
                                    participant.attendance_status === 'present' ? 'app-icon-circle--success' :
                                    participant.attendance_status === 'absent' ? 'app-icon-circle--danger' :
                                    isWaitlist ? 'app-icon-circle--warning' : 'app-icon-circle--info';
            const statusIcon = isOptedOut ? closeCircle :
                               participant.attendance_status === 'present' ? checkmarkCircle :
                               participant.attendance_status === 'absent' ? closeCircle : people;
            const statusText = isOptedOut ? 'Abgemeldet' :
                               participant.attendance_status === 'present' ? 'Anwesend' :
                               participant.attendance_status === 'absent' ? 'Abwesend' :
                               isWaitlist ? 'Warteliste' : 'Gebucht';
            const cornerBadgeClass = isOptedOut ? 'app-corner-badge--danger' :
                                     participant.attendance_status === 'present' ? 'app-corner-badge--success' :
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
                className="app-event-detail__sliding-item"
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
                  <div className={`app-list-item ${listItemClass} app-event-detail__list-item-flush`}>
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
                          {isOptedOut && participant.opt_out_reason && (
                            <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '2px' }}>
                              {participant.opt_out_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>
                {(participant.role_name === 'teamer' || !eventData?.mandatory) && (
                <IonItemOptions className="app-swipe-actions" side="end">
                  {participant.role_name !== 'teamer' && participant.status === 'confirmed' && (
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
                )}
              </IonItemSliding>
            );
          };

          // Wenn keine Teilnehmer und keine Warteliste, nur Button zeigen
          if (displayParticipants.length === 0 && teamerParticipants.length === 0) {
            return (
              <IonList className="app-section-inset" inset={true}>
                <IonCard className="app-card">
                  <IonCardContent className="app-card-content">
                    <IonButton
                      expand="block"
                      fill="outline"
                      onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
                    >
                      <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                      Teilnehmer:in hinzufügen
                    </IonButton>
                  </IonCardContent>
                </IonCard>
              </IonList>
            );
          }

          // Konfis Header-Text bestimmen
          let konfiHeaderText = '';
          if (eventData?.has_timeslots) {
            if (hasUnassigned && hasWaitlist) {
              konfiHeaderText = `Nicht zugeordnet (${unassignedParticipants.length}) + Warteliste (${waitlistParticipants.length})`;
            } else if (hasUnassigned) {
              konfiHeaderText = `Nicht zugeordnet (${unassignedParticipants.length})`;
            } else {
              konfiHeaderText = `Warteliste (${waitlistParticipants.length})`;
            }
          } else if (eventData?.mandatory) {
            konfiHeaderText = `Konfis (${confirmedParticipants.length}/${konfiParticipants.length})`;
          } else {
            konfiHeaderText = `Konfis (${confirmedParticipants.length}${waitlistParticipants.length > 0 ? ` + ${waitlistParticipants.length}` : ''})`;
          }

          return (
            <>
              {/* Konfis Sektion */}
              {displayParticipants.length > 0 && (
                <IonList className="app-section-inset" inset={true}>
                  <IonListHeader>
                    <div className="app-section-icon app-section-icon--events">
                      <IonIcon icon={people} />
                    </div>
                    <IonLabel>{konfiHeaderText}</IonLabel>
                  </IonListHeader>
                  <IonCard className="app-card">
                    <IonCardContent className="app-card-content">
                      {displayParticipants.map(renderParticipant)}
                      <div className="app-event-detail__add-button-wrapper">
                        <IonButton
                          expand="block"
                          fill="outline"
                          onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
                        >
                          <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                          Teilnehmer:in hinzufügen
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}

              {/* Teamer:innen Sektion */}
              {(teamerParticipants.length > 0 || eventData?.teamer_needed || eventData?.teamer_only) && (
                <IonList className="app-section-inset" inset={true}>
                  <IonListHeader>
                    <div className="app-section-icon app-section-icon--events">
                      <IonIcon icon={people} />
                    </div>
                    <IonLabel>Teamer:innen ({teamerParticipants.length})</IonLabel>
                  </IonListHeader>
                  <IonCard className="app-card">
                    <IonCardContent className="app-card-content">
                      {teamerParticipants.map(renderParticipant)}
                      <div className="app-event-detail__add-button-wrapper">
                        <IonButton
                          expand="block"
                          fill="outline"
                          onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
                        >
                          <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                          Teamer:in hinzufügen
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}

              {/* Button wenn keine Konfis aber Teamer vorhanden */}
              {displayParticipants.length === 0 && teamerParticipants.length > 0 && (
                <IonList className="app-section-inset" inset={true}>
                  <IonCard className="app-card">
                    <IonCardContent className="app-card-content">
                      <IonButton
                        expand="block"
                        fill="outline"
                        onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
                      >
                        <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                        Teilnehmer:in hinzufügen
                      </IonButton>
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}
            </>
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
                        <IonIcon icon={closeCircle} className="app-icon-color--danger app-event-detail__icon-lg" />
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
                      <div className="app-reason-box app-reason-box--danger app-event-detail__reason-indent">
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