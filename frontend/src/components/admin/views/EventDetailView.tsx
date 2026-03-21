import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon, IonCard, IonCardContent,
  IonItem, IonLabel, IonList, IonListHeader,
  IonRefresher, IonRefresherContent, useIonModal,
  IonItemSliding, IonItemOptions, IonItemOption,
  useIonActionSheet, useIonAlert
} from '@ionic/react';
import {
  arrowBack, createOutline, calendar, people,
  personAdd, checkmarkCircle, closeCircle, checkmark, trash,
  returnUpBack, qrCodeOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { parseLocalTime, getLocalNow } from '../../../utils/dateUtils';
import { SectionHeader } from '../../shared';
import EventModal from '../modals/EventModal';
import ParticipantManagementModal from '../modals/ParticipantManagementModal';
import QRDisplayModal from '../modals/QRDisplayModal';
import TeamerMaterialDetailPage from '../../teamer/pages/TeamerMaterialDetailPage';
import { useLiveUpdate } from '../../../contexts/LiveUpdateContext';
import {
  EventInfoCard, DescriptionSection, SeriesEventsSection,
  UnregistrationsSection, EventMaterialSection, EventActionsSection,
  TimeslotsSection
} from './EventDetailSections';
import type { Participant, Unregistration } from './EventDetailSections';

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
  chat_room_id?: number | null;
  cancelled?: boolean;
}

interface Jahrgang {
  id: number;
  name: string;
}

interface Timeslot {
  id: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count: number;
}

interface EventDetailViewProps {
  eventId: number;
  onBack: () => void;
}

const EventDetailView: React.FC<EventDetailViewProps> = ({ eventId, onBack }) => {
  const pageRef = useRef<HTMLElement>(null);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());
  const { setSuccess, setError, isOnline } = useApp();
  const { triggerRefresh } = useLiveUpdate();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [unregistrations, setUnregistrations] = useState<Unregistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [eventMaterials, setEventMaterials] = useState<any[]>([]);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);

  // Material Detail Modal (wie Teamer)
  const materialIdRef = useRef<number | null>(null);
  const [presentMaterialModal, dismissMaterialModal] = useIonModal(TeamerMaterialDetailPage, {
    get materialId() { return materialIdRef.current; },
    onClose: () => dismissMaterialModal()
  });

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
      loadEventData();
    },
    dismiss: () => dismissParticipantModalHook()
  });

  // Teamer Modal (filterRole: 'teamer')
  const [presentTeamerModal, dismissTeamerModal] = useIonModal(ParticipantManagementModal, {
    eventId: eventId,
    onClose: () => dismissTeamerModal(),
    onSuccess: () => {
      dismissTeamerModal();
      loadEventData();
    },
    dismiss: () => dismissTeamerModal(),
    filterRole: 'teamer'
  });

  // Konfi Modal (filterRole: 'konfi')
  const [presentKonfiModal, dismissKonfiModal] = useIonModal(ParticipantManagementModal, {
    eventId: eventId,
    onClose: () => dismissKonfiModal(),
    onSuccess: () => {
      dismissKonfiModal();
      loadEventData();
    },
    dismiss: () => dismissKonfiModal(),
    filterRole: 'konfi'
  });

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  useEffect(() => {
    setPresentingElement(pageRef.current);
  }, []);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const eventRes = await api.get(`/events/${eventId}`);
      setEventData(eventRes.data);
      setParticipants(eventRes.data.participants || []);
      setUnregistrations(eventRes.data.unregistrations || []);
      try {
        const matRes = await api.get(`/material/by-event/${eventId}`);
        setEventMaterials(matRes.data || []);
      } catch {
        setEventMaterials([]);
      }
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
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateRegistrationStatus = (event: Event): 'upcoming' | 'open' | 'closed' => {
    const now = getLocalNow();
    if (event.registration_opens_at) {
      const opensAt = parseLocalTime(event.registration_opens_at);
      if (now < opensAt) return 'upcoming';
    }
    if (event.registration_closes_at) {
      const closesAt = parseLocalTime(event.registration_closes_at);
      if (now > closesAt) return 'closed';
    }
    if (event.max_participants > 0 && event.registered_count >= event.max_participants) return 'closed';
    return 'open';
  };

  const handleEditSuccess = () => { onBack(); };

  const getStatusColors = (): { primary: string; secondary: string } => {
    if (!eventData) return { primary: '#dc2626', secondary: '#b91c1c' };
    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfirmationEvent = eventData.categories?.some(cat => cat.name.toLowerCase().includes('konfirmation'));
    const isCancelledStatus = eventData.registration_status === 'cancelled' as string;
    const hasUnprocessedBookings = isPastEvent && eventData.registered_count > 0 &&
      participants.some(p => p.status === 'confirmed' && !p.attendance_status);

    if (isCancelledStatus) return { primary: '#dc3545', secondary: '#c82333' };
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

  const getStatusText = () => {
    if (!eventData) return 'Event';
    const isPastEvent = new Date(eventData.event_date) < new Date();
    const isKonfirmationEvent = eventData.categories?.some(cat => cat.name.toLowerCase().includes('konfirmation'));
    const isCancelledStatus = eventData.registration_status === 'cancelled' as string;
    const hasUnprocessedBookings = isPastEvent && eventData.registered_count > 0 &&
      participants.some(p => p.status === 'confirmed' && !p.attendance_status);

    if (isCancelledStatus) return 'Abgesagt';
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
    if (!isOnline) return;
    setParticipants(prev => prev.map(p =>
      p.id === participant.id ? { ...p, attendance_status: status } : p
    ));
    try {
      const response = await api.put(`/events/${eventId}/participants/${participant.id}/attendance`, {
        attendance_status: status
      });
      if (response.data.points_awarded) {
        setSuccess(`Anwesenheit bestätigt und ${response.data.points} ${response.data.point_type} Punkte vergeben`);
      } else if (response.data.points_removed) {
        setSuccess(`Anwesenheit als abwesend markiert und ${response.data.points} ${response.data.point_type} Punkte entfernt`);
      } else {
        setSuccess(`Anwesenheit ${status === 'present' ? 'bestätigt' : 'als abwesend markiert'}`);
      }
      triggerRefresh('events');
    } catch (error) {
      setParticipants(prev => prev.map(p =>
        p.id === participant.id ? { ...p, attendance_status: participant.attendance_status } : p
      ));
      setError('Fehler beim Aktualisieren der Anwesenheit');
    }
  };

  const showAttendanceActionSheet = (participant: Participant) => {
    if (!isOnline) return;
    const buttons: any[] = [];
    if (participant.attendance_status !== 'present') {
      buttons.push({ text: 'Anwesend', icon: checkmarkCircle, handler: () => handleAttendanceUpdate(participant, 'present') });
    }
    if (participant.attendance_status !== 'absent') {
      buttons.push({ text: 'Abwesend', icon: closeCircle, handler: () => handleAttendanceUpdate(participant, 'absent') });
    }
    buttons.push({ text: 'Abbrechen', role: 'cancel' });
    presentActionSheet({ header: participant.participant_name, subHeader: 'Anwesenheit verwalten', buttons });
  };

  const showWaitlistActionSheet = (participant: Participant) => {
    if (!isOnline) return;
    presentActionSheet({
      header: participant.participant_name,
      subHeader: 'Warteliste verwalten',
      buttons: [
        { text: 'Bestätigen', icon: checkmark, handler: () => handlePromoteParticipant(participant) },
        { text: 'Entfernen', icon: trash, role: 'destructive', handler: () => handleRemoveParticipant(participant) },
        { text: 'Abbrechen', role: 'cancel' }
      ]
    });
  };

  const handlePromoteParticipant = async (participant: Participant) => {
    try {
      await api.put(`/events/${eventId}/participants/${participant.id}/status`, { status: 'confirmed' });
      setSuccess(`${participant.participant_name} von Warteliste bestätigt`);
      await loadEventData();
      triggerRefresh('events');
    } catch (error) {
 console.error('Promote participant error:', error);
      setError('Fehler beim Bestätigen des Teilnehmers');
    }
  };

  const handleDemoteParticipant = async (participant: Participant) => {
    try {
      await api.put(`/events/${eventId}/participants/${participant.id}/status`, { status: 'waitlist' });
      setSuccess(`${participant.participant_name} auf Warteliste gesetzt`);
      const slidingItem = slidingRefs.current.get(participant.id);
      if (slidingItem) await slidingItem.close();
      await loadEventData();
      triggerRefresh('events');
    } catch (error) {
 console.error('Demote participant error:', error);
      setError('Fehler beim Verschieben auf Warteliste');
    }
  };

  const handleRemoveParticipant = async (participant: Participant) => {
    if (!isOnline) return;
    try {
      await api.delete(`/events/${eventId}/bookings/${participant.id}`);
      setSuccess('Teilnehmer entfernt');
      await loadEventData();
      triggerRefresh('events');
    } catch (error) {
 console.error('Delete participant error:', error);
      setError('Fehler beim Entfernen des Teilnehmers');
    }
  };

  const isCancelled = eventData?.cancelled || eventData?.registration_status === ('cancelled' as string);

  const handleCancelEvent = async () => {
    if (!isOnline) return;
    presentAlert({
      header: 'Event absagen',
      message: 'Wirklich absagen? Alle Teilnehmer:innen werden benachrichtigt.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Absagen', role: 'destructive',
          handler: async () => {
            try {
              await api.put(`/events/${eventData?.id}/cancel`);
              setSuccess('Event wurde abgesagt');
              loadEventData();
              triggerRefresh('events');
            } catch (error: any) {
              setError(error.response?.data?.error || 'Fehler beim Absagen');
            }
          }
        }
      ]
    });
  };

  const handleCreateEventChat = async () => {
    if (!isOnline) return;
    try {
      await api.post(`/events/${eventData?.id}/chat`);
      setSuccess('Chat erstellt');
      loadEventData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Erstellen des Chats');
    }
  };

  const handleNavigateToChat = () => {
    window.location.href = `/admin/chat/${eventData?.chat_room_id}`;
  };

  const handleMaterialClick = (materialId: number) => {
    materialIdRef.current = materialId;
    presentMaterialModal({ presentingElement: presentingElement || pageRef.current || undefined });
  };

  // Helper: Einzelnen Teilnehmer rendern
  const renderParticipant = (participant: Participant) => {
    const isWaitlist = participant.status === 'waitlist';
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
          if (el) { slidingRefs.current.set(participant.id, el); }
          else { slidingRefs.current.delete(participant.id); }
        }}
        className="app-event-detail__sliding-item"
      >
        <IonItem
          className="app-item-transparent"
          button detail={false} lines="none"
          onClick={() => {
            if (participant.status === 'confirmed') showAttendanceActionSheet(participant);
            else if (participant.status === 'waitlist') showWaitlistActionSheet(participant);
          }}
        >
          <div className={`app-list-item ${listItemClass} app-event-detail__list-item-flush`}>
            <div className="app-corner-badges">
              <div className={`app-corner-badge ${cornerBadgeClass}`}>{statusText}</div>
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
            <IonItemOption className="app-swipe-action" onClick={() => handleDemoteParticipant(participant)}>
              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                <IonIcon icon={returnUpBack} />
              </div>
            </IonItemOption>
          )}
          <IonItemOption className="app-swipe-action" onClick={() => handleRemoveParticipant(participant)}>
            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
              <IonIcon icon={trash} />
            </div>
          </IonItemOption>
        </IonItemOptions>
        )}
      </IonItemSliding>
    );
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}><IonIcon icon={arrowBack} /></IonButton>
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

        {/* Event Header */}
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
              { value: konfiOnly.filter(p => p.status === 'waitlist').length, label: 'Warteliste' }
            ];
          })()}
        />

        {/* Event Details */}
        {eventData && (
          <EventInfoCard
            eventData={eventData as any}
            participants={participants}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        )}

        {/* Beschreibung */}
        {eventData?.description && (
          <DescriptionSection description={eventData.description} />
        )}

        {/* Timeslots mit Teilnehmern */}
        {eventData?.has_timeslots && eventData?.timeslots && eventData.timeslots.length > 0 && (
          <TimeslotsSection
            timeslots={eventData.timeslots}
            participants={participants}
            eventMandatory={eventData?.mandatory}
            formatTime={formatTime}
            showAttendanceActionSheet={showAttendanceActionSheet}
            handleDemoteParticipant={handleDemoteParticipant}
            handleRemoveParticipant={handleRemoveParticipant}
          />
        )}

        {/* Series Events */}
        {eventData?.is_series && eventData?.series_events && eventData.series_events.length > 0 && (
          <SeriesEventsSection
            seriesEvents={eventData.series_events as any}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        )}

        {/* Participants List */}
        {(() => {
          const konfiParticipants = participants.filter(p => p.role_name !== 'teamer');
          const teamerParticipants = participants.filter(p => p.role_name === 'teamer');
          const confirmedParticipants = konfiParticipants.filter(p => p.status === 'confirmed');
          const waitlistParticipants = konfiParticipants.filter(p => p.status === 'waitlist');
          const unassignedParticipants = eventData?.has_timeslots
            ? confirmedParticipants.filter(p => !(p as any).timeslot_id && !p.timeslot_start_time) : [];
          const displayParticipants = eventData?.has_timeslots
            ? [...unassignedParticipants, ...waitlistParticipants] : konfiParticipants;
          const hasWaitlist = (eventData as any)?.waitlist_enabled && waitlistParticipants.length > 0;
          const hasUnassigned = unassignedParticipants.length > 0;

          if (displayParticipants.length === 0 && teamerParticipants.length === 0) {
            return (
              <IonList className="app-section-inset" inset={true}>
                <IonCard className="app-card">
                  <IonCardContent className="app-card-content">
                    <IonButton expand="block" fill="outline"
                      onClick={() => presentKonfiModal({ presentingElement: presentingElement || undefined })}>
                      <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                      Kind hinzufügen
                    </IonButton>
                  </IonCardContent>
                </IonCard>
              </IonList>
            );
          }

          let konfiHeaderText = '';
          if (eventData?.has_timeslots) {
            if (hasUnassigned && hasWaitlist) konfiHeaderText = `Nicht zugeordnet (${unassignedParticipants.length}) + Warteliste (${waitlistParticipants.length})`;
            else if (hasUnassigned) konfiHeaderText = `Nicht zugeordnet (${unassignedParticipants.length})`;
            else konfiHeaderText = `Warteliste (${waitlistParticipants.length})`;
          } else if (eventData?.mandatory) {
            konfiHeaderText = `Konfis (${confirmedParticipants.length}/${konfiParticipants.length})`;
          } else {
            konfiHeaderText = `Konfis (${confirmedParticipants.length}${waitlistParticipants.length > 0 ? ` + ${waitlistParticipants.length}` : ''})`;
          }

          return (
            <>
              {displayParticipants.length > 0 && (
                <IonList className="app-section-inset" inset={true}>
                  <IonListHeader>
                    <div className="app-section-icon app-section-icon--events"><IonIcon icon={people} /></div>
                    <IonLabel>{konfiHeaderText}</IonLabel>
                  </IonListHeader>
                  <IonCard className="app-card">
                    <IonCardContent className="app-card-content">
                      {displayParticipants.map(renderParticipant)}
                      <div className="app-event-detail__add-button-wrapper">
                        <IonButton expand="block" fill="outline"
                          onClick={() => presentKonfiModal({ presentingElement: presentingElement || undefined })}>
                          <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                          Kind hinzufügen
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}
              {(teamerParticipants.length > 0 || eventData?.teamer_needed || eventData?.teamer_only) && (
                <IonList className="app-section-inset" inset={true}>
                  <IonListHeader>
                    <div className="app-section-icon app-section-icon--events"><IonIcon icon={people} /></div>
                    <IonLabel>Teamer:innen ({teamerParticipants.length})</IonLabel>
                  </IonListHeader>
                  <IonCard className="app-card">
                    <IonCardContent className="app-card-content">
                      {teamerParticipants.map(renderParticipant)}
                      <div className="app-event-detail__add-button-wrapper">
                        <IonButton expand="block" fill="outline"
                          onClick={() => presentTeamerModal({ presentingElement: presentingElement || undefined })}>
                          <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                          Teamer:in hinzufügen
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}
              {displayParticipants.length === 0 && teamerParticipants.length > 0 && (
                <IonList className="app-section-inset" inset={true}>
                  <IonCard className="app-card">
                    <IonCardContent className="app-card-content">
                      <IonButton expand="block" fill="outline"
                        onClick={() => presentKonfiModal({ presentingElement: presentingElement || undefined })}>
                        <IonIcon icon={personAdd} className="app-event-detail__icon-gap" />
                        Kind hinzufügen
                      </IonButton>
                    </IonCardContent>
                  </IonCard>
                </IonList>
              )}
            </>
          );
        })()}

        {/* Abmeldungen */}
        {unregistrations.length > 0 && (
          <UnregistrationsSection unregistrations={unregistrations} />
        )}

        {/* Material */}
        {eventMaterials.length > 0 && (
          <EventMaterialSection
            eventMaterials={eventMaterials}
            onMaterialClick={handleMaterialClick}
          />
        )}

        {/* Event-Chat + Event absagen */}
        {eventData && (
          <EventActionsSection
            eventData={eventData as any}
            isCancelled={!!isCancelled}
            isOnline={isOnline}
            handleNavigateToChat={handleNavigateToChat}
            handleCreateEventChat={handleCreateEventChat}
            handleCancelEvent={handleCancelEvent}
          />
        )}

      </IonContent>
    </IonPage>
  );
};

export default EventDetailView;
