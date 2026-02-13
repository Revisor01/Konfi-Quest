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
  IonText,
  IonChip,
  IonAvatar,
  useIonModal,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonGrid,
  IonRow,
  IonCol,
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
        // Prüfe ob ausgebucht (Event voll UND Warteliste voll/deaktiviert)
        if (event) {
          const waitlistEnabled = (event as any)?.waitlist_enabled;
          const maxWaitlistSize = (event as any)?.max_waitlist_size || 0;
          const pendingCount = participants.filter(p => p.status === 'pending').length;
          const eventFull = event.registered_count >= event.max_participants;

          if (eventFull) {
            if (!waitlistEnabled || pendingCount >= maxWaitlistSize) {
              return 'Ausgebucht';
            }
          }
        }
        return 'Anmeldung geschlossen';
      }
      default: return 'Unbekannt';
    }
  };

  const calculateRegistrationStatus = (event: Event): 'upcoming' | 'open' | 'closed' => {
    const now = getLocalNow();
    
 console.log('EventDetailView - Calculating status for event:', event.name);
 console.log('EventDetailView - Current local time:', now.toLocaleString('de-DE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour12: false }));
 console.log('EventDetailView - Current UTC:', now.toISOString());
 console.log('EventDetailView - User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
 console.log('EventDetailView - Registration opens at (UTC):', event.registration_opens_at);
 console.log('EventDetailView - Registration closes at (UTC):', event.registration_closes_at);
    
    // If registration hasn't opened yet
    if (event.registration_opens_at) {
      const opensAt = parseLocalTime(event.registration_opens_at);
 console.log('EventDetailView - Opens at local time:', opensAt.toLocaleString('de-DE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour12: false }));
      if (now < opensAt) {
 console.log('EventDetailView - Status: upcoming (not opened yet)');
        return 'upcoming';
      }
    }
    
    // If registration has closed
    if (event.registration_closes_at) {
      const closesAt = parseLocalTime(event.registration_closes_at);
 console.log('EventDetailView - Closes at local time:', closesAt.toLocaleString('de-DE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour12: false }));
      if (now > closesAt) {
 console.log('EventDetailView - Status: closed (deadline passed)');
        return 'closed';
      }
    }
    
    // If event is full
    if (event.registered_count >= event.max_participants) {
 console.log('EventDetailView - Status: closed (event full)');
      return 'closed';
    }
    
 console.log('EventDetailView - Status: open');
    return 'open';
  };

  const handleEditSuccess = () => {
    // Reload event data
    onBack();
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
            <IonTitle size="large" style={{ color: 'black' }}>{eventData?.name || 'Event Details'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {/* Event Header - Dashboard-Style */}
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)',
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
            {/* Event Info */}
            <IonGrid style={{ padding: '0', margin: '0 4px' }}>
              <IonRow>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={people} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', display: 'block', margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{participants.filter(p => p.status === 'confirmed').length}/{(eventData?.max_participants || 0) > 0 ? eventData?.max_participants : '∞'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      TN
                    </div>
                  </div>
                </IonCol>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={flash} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', display: 'block', margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{eventData?.points || 0}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Punkte
                    </div>
                  </div>
                </IonCol>
                <IonCol size="4" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={checkmarkCircle} style={{ fontSize: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', display: 'block', margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{participants.filter(p => p.attendance_status === 'present').length}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Anwesend
                    </div>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Event Details */}
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
                <div className="app-info-row" style={{ alignItems: 'flex-start' }}>
                  <IonIcon icon={time} className="app-info-row__icon" style={{ color: '#dc2626', marginTop: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '6px' }}>Zeitfenster:</div>
                    {eventData.timeslots.map((slot, idx) => (
                      <div key={slot.id || idx} style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)} ({slot.registered_count || 0}/{slot.max_participants} TN)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TN gesamt */}
              <div className="app-info-row">
                <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#34c759' }} />
                <div className="app-info-row__content">
                  {eventData?.registered_count || 0} / {(eventData?.max_participants || 0) > 0 ? eventData?.max_participants : '∞'} Teilnehmer:innen
                </div>
              </div>

              {/* Warteliste */}
              {(eventData as any)?.waitlist_enabled && (
                <div className="app-info-row">
                  <IonIcon icon={listOutline} className="app-info-row__icon" style={{ color: '#fd7e14' }} />
                  <div className="app-info-row__content">
                    {participants.filter(p => p.status === 'pending').length} / {(eventData as any)?.max_waitlist_size || 10} auf Warteliste
                  </div>
                </div>
              )}

              {/* Punkte */}
              <div className="app-info-row">
                <IonIcon icon={trophy} className="app-info-row__icon" style={{ color: '#ff9500' }} />
                <div className="app-info-row__content">
                  {eventData?.points || 0} Punkte
                </div>
              </div>

              {/* Typ */}
              <div className="app-info-row">
                <IonIcon
                  icon={home}
                  className="app-info-row__icon"
                  style={{ color: eventData?.point_type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
                />
                <div className="app-info-row__content">
                  {eventData?.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                </div>
              </div>

              {/* Kategorien als Tags */}
              {eventData?.categories && eventData.categories.length > 0 && (
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

              {/* Ort */}
              {eventData?.location && (
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
                  <IonIcon icon={people} className="app-info-row__icon" style={{ color: '#007aff' }} />
                  <div className="app-info-row__content">
                    {eventData.jahrgaenge.map(j => j.name).join(', ')}
                  </div>
                </div>
              )}

              {/* Beschreibung */}
              {eventData?.description && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '600', color: '#333' }}>
                    Beschreibung
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.95rem', color: '#666', lineHeight: '1.5' }}>
                    {eventData.description}
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Timeslots mit Teilnehmern */}
        {eventData?.has_timeslots && eventData?.timeslots && eventData.timeslots.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={time} />
              </div>
              <IonLabel>Zeitslots ({eventData.timeslots.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
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
                      <div className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'}`} style={{ position: 'relative', overflow: 'hidden' }}>
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
                              <div className="app-list-item__title" style={{ paddingRight: '50px' }}>
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
                                  button
                                  detail={false}
                                  lines="none"
                                  onClick={() => showAttendanceActionSheet(participant)}
                                  style={{
                                    '--background': 'transparent',
                                    '--padding-start': '0',
                                    '--padding-end': '0',
                                    '--inner-padding-end': '0',
                                    '--inner-border-width': '0',
                                    '--border-width': '0'
                                  }}
                                >
                                  <div className="app-list-item app-list-item--booked" style={{ width: '100%', marginBottom: '0', position: 'relative', overflow: 'hidden' }}>
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
                                          <div className="app-list-item__title" style={{ paddingRight: '80px' }}>{participant.participant_name}</div>
                                          <div className="app-list-item__subtitle">
                                            {participant.jahrgang_name || ''}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </IonItem>
                                <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                                  <IonItemOption
                                    onClick={() => handleDemoteParticipant(participant)}
                                    style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                                  >
                                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                                      <IonIcon icon={returnUpBack} />
                                    </div>
                                  </IonItemOption>
                                  <IonItemOption
                                    onClick={() => handleRemoveParticipant(participant)}
                                    style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
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
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--info">
                <IonIcon icon={calendar} />
              </div>
              <IonLabel>Weitere Termine dieser Serie</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {eventData.series_events.map((seriesEvent) => {
                  const isFull = (seriesEvent.registered_count || 0) >= seriesEvent.max_participants;
                  return (
                    <div
                      key={seriesEvent.id}
                      className={`app-list-item ${isFull ? 'app-list-item--danger' : 'app-list-item--success'}`}
                      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
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
                            <div className="app-list-item__title" style={{ paddingRight: '60px' }}>
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
              <IonList inset={true} style={{ margin: '16px' }}>
                <IonCard className="app-card">
                  <IonCardContent style={{ padding: '16px' }}>
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
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--events">
                  <IonIcon icon={people} />
                </div>
                <IonLabel>{headerText}</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
              {(
              <IonCardContent style={{ padding: '16px' }}>
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
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          '--inner-padding-end': '0',
                          '--inner-border-width': '0',
                          '--border-width': '0'
                        }}
                      >
                        <div className={`app-list-item ${listItemClass}`} style={{ width: '100%', marginBottom: '0', position: 'relative', overflow: 'hidden' }}>
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
                                <div className="app-list-item__title" style={{ paddingRight: '80px' }}>
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
                      <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                        {participant.status === 'confirmed' && (
                          <IonItemOption
                            onClick={() => handleDemoteParticipant(participant)}
                            style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--warning">
                              <IonIcon icon={returnUpBack} />
                            </div>
                          </IonItemOption>
                        )}
                        <IonItemOption
                          onClick={() => handleRemoveParticipant(participant)}
                          style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
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
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--danger">
                <IonIcon icon={closeCircle} />
              </div>
              <IonLabel>Abmeldungen ({unregistrations.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {unregistrations.map((unreg) => (
                  <div key={unreg.id} className="app-list-item app-list-item--danger">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <IonIcon icon={closeCircle} style={{ fontSize: '1.2rem', color: '#dc3545' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>
                          {unreg.konfi_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
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