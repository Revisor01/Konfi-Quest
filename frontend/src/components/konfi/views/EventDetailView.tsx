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
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonChip,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
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
  close,
  informationCircle,
  warning,
  hourglass,
  ribbon,
  listOutline
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'success';
      case 'closed': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Anmeldung offen';
      case 'closed': return 'Anmeldung geschlossen';
      case 'cancelled': return 'Abgesagt';
      default: return 'Bald verfügbar';
    }
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
        header: 'Zeitslot auswaehlen',
        buttons: timeslotButtons
      });
      return;
    }

    // No timeslots - register directly
    doRegister();
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

        {/* Event Header - Dashboard-Style Gradient */}
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
          {/* Event-Titel - groß und überlappend über Rand hinaus */}
          <div style={{
            position: 'absolute',
            top: '-5px',
            left: '8px',
            right: '8px',
            zIndex: 1,
            overflow: 'visible'
          }}>
            <h2 style={{
              fontSize: '2.8rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.1)',
              margin: '0',
              lineHeight: '0.85',
              letterSpacing: '-2px',
              wordBreak: 'break-word',
              textTransform: 'uppercase',
              transform: 'scale(1.05)'
            }}>
              {eventData.name}
            </h2>
          </div>
          
          {/* Status Badge - rechtsbündig mit Grid, immer anzeigen */}
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '32px', // Rechtsbündig mit Grid padding
            zIndex: 3
          }}>
            <div style={{
              backgroundColor: (() => {
                const isPastEvent = new Date(eventData.event_date) < new Date();
                const isParticipated = isPastEvent && eventData.is_registered;
                const attendanceStatus = eventData.attendance_status;
                
                if (eventData.cancelled) return 'rgba(255, 255, 255, 0.9)'; // Weiß für abgesagt
                if (isParticipated && attendanceStatus === 'present') return 'rgba(255, 255, 255, 0.9)'; // Weiß für verbucht
                if (isParticipated && attendanceStatus === 'absent') return 'rgba(255, 255, 255, 0.9)'; // Weiß für verpasst
                if ((eventData as any).booking_status === 'waitlist') return 'rgba(255, 255, 255, 0.9)'; // Weiß für Warteliste
                if (eventData.is_registered) return 'rgba(255, 255, 255, 0.9)'; // Weiß für angemeldet
                if (eventData.registration_status === 'open') return 'rgba(255, 255, 255, 0.9)';
                return 'rgba(255, 255, 255, 0.2)';
              })(),
              borderRadius: '12px',
              padding: '8px 12px',
              border: `2px solid ${(() => {
                const isPastEvent = new Date(eventData.event_date) < new Date();
                const isParticipated = isPastEvent && eventData.is_registered;
                const attendanceStatus = eventData.attendance_status;
                
                if (eventData.cancelled) return 'rgba(220, 38, 38, 1)'; // Rot für abgesagt
                if (isParticipated && attendanceStatus === 'present') return 'rgba(40, 167, 69, 1)'; // Grün für verbucht
                if (isParticipated && attendanceStatus === 'absent') return 'rgba(220, 38, 38, 1)'; // Rot für verpasst
                if ((eventData as any).booking_status === 'waitlist') return 'rgba(253, 126, 20, 1)'; // Orange für Warteliste
                if (eventData.is_registered) return 'rgba(0, 122, 255, 1)'; // Blau für angemeldet
                if (eventData.registration_status === 'open') return 'rgba(255, 255, 255, 1)';
                return 'rgba(255, 255, 255, 0.3)';
              })()}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: eventData.cancelled ? '0 4px 16px rgba(220, 38, 38, 0.4)' : 'none' // Schatten für abgesagt
            }}>
              {(() => {
                const isPastEvent = new Date(eventData.event_date) < new Date();
                const isParticipated = isPastEvent && eventData.is_registered;
                const attendanceStatus = eventData.attendance_status;
                const shouldShowIcon = eventData.is_registered || eventData.cancelled || isParticipated;
                
                if (!shouldShowIcon) return null;
                
                let icon = checkmarkCircle;
                if (eventData.cancelled) icon = close;
                else if (isParticipated && attendanceStatus === 'absent') icon = close;
                else if (isParticipated && !attendanceStatus) icon = checkmarkCircle;
                
                return (
                  <IonIcon 
                    icon={icon}
                    style={{ 
                      fontSize: eventData.cancelled ? '1.2rem' : '1rem', 
                      color: (() => {
                        const isPastEvent = new Date(eventData.event_date) < new Date();
                        const isParticipated = isPastEvent && eventData.is_registered;
                        const attendanceStatus = eventData.attendance_status;
                        
                        if (eventData.cancelled) return '#dc3545'; // Rot für abgesagt
                        if (isParticipated && attendanceStatus === 'present') return '#28a745'; // Grün für verbucht
                        if (isParticipated && attendanceStatus === 'absent') return '#dc3545'; // Rot für verpasst
                        if ((eventData as any).booking_status === 'waitlist') return '#fd7e14'; // Orange für Warteliste
                        if (eventData.is_registered) return '#007aff'; // Blau für angemeldet
                        return 'white';
                      })()
                    }} 
                  />
                );
              })()}
              <span style={{ 
                color: (() => {
                  const isPastEvent = new Date(eventData.event_date) < new Date();
                  const isParticipated = isPastEvent && eventData.is_registered;
                  const attendanceStatus = eventData.attendance_status;
                  
                  if (eventData.cancelled) return '#dc3545'; // Rot für abgesagt
                  if (isParticipated && attendanceStatus === 'present') return '#28a745'; // Grün für verbucht
                  if (isParticipated && attendanceStatus === 'absent') return '#dc3545'; // Rot für verpasst
                  if ((eventData as any).booking_status === 'waitlist') return '#fd7e14'; // Orange für Warteliste
                  if (eventData.is_registered) return '#007aff'; // Blau für angemeldet
                  if (eventData.registration_status === 'open' && eventData.registered_count >= eventData.max_participants && eventData.waitlist_enabled) return '#fd7e14';
                  if (eventData.registration_status === 'open') return '#fd7e14';
                  if (eventData.registration_status === 'upcoming') return '#ffc409';
                  return 'white';
                })(), 
                fontSize: '0.8rem', 
                fontWeight: '600'
              }}>
                {(() => {
                  const isPastEvent = new Date(eventData.event_date) < new Date();
                  const isParticipated = isPastEvent && eventData.is_registered;
                  const attendanceStatus = eventData.attendance_status;
                  
                  // Korrigierte Status-Logik - zeige nur logische Status für vergangene/zukünftige Events
                  if (eventData.cancelled) return 'ABGESAGT';
                  if (isParticipated && attendanceStatus === 'present') return 'VERBUCHT';
                  if (isParticipated && attendanceStatus === 'absent') return 'VERPASST';
                  if ((eventData as any).booking_status === 'waitlist') return `WARTELISTE (${(eventData as any).waitlist_position || 1})`;
                  if (eventData.is_registered) return 'ANGEMELDET';
                  
                  // Für zukünftige Events zeige Anmeldestatus
                  if (!isPastEvent) {
                    if (eventData.registration_status === 'open' && eventData.registered_count >= eventData.max_participants && eventData.waitlist_enabled) return 'WARTELISTE';
                    if (eventData.registration_status === 'open') return 'OFFEN';
                    if (eventData.registration_status === 'upcoming') return 'BALD';
                    return 'GESCHLOSSEN';
                  }
                  
                  // Für vergangene Events ohne Anmeldung zeige nichts
                  return 'VERGANGEN';
                })()}
              </span>
            </div>
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
                    <IonIcon 
                      icon={people} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '8px', 
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{eventData.max_participants - eventData.registered_count}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      frei
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
                    <IonIcon 
                      icon={trophy} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '8px', 
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.3em', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{eventData.points}</span>
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
                    <IonIcon 
                      icon={checkmarkCircle} 
                      style={{ 
                        fontSize: '1.5rem', 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        marginBottom: '8px', 
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }} 
                    />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{eventData.registered_count}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      dabei
                    </div>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Event Details Card */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <IonGrid style={{ padding: '0' }}>
              <IonRow>
                <IonCol size="12">
                  {/* Datum */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={calendar} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#333' }}>
                        {formatDate(eventData.event_date)}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatTime(eventData.event_date)}
                        {eventData.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
                      </div>
                    </div>
                  </div>

                  {/* Gebuchter Timeslot anzeigen wenn angemeldet */}
                  {eventData.has_timeslots && eventData.is_registered && eventData.booked_timeslot_start && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={time} style={{ marginRight: '12px', color: '#28a745', fontSize: '1.2rem' }} />
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>Dein Zeitslot:</div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#28a745' }}>
                          {formatTime(eventData.booked_timeslot_start)}
                          {eventData.booked_timeslot_end && ` - ${formatTime(eventData.booked_timeslot_end)}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TN gesamt */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={people} style={{ marginRight: '12px', color: '#34c759', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData.registered_count} / {eventData.max_participants} Teilnehmer:innen
                    </div>
                  </div>

                  {/* Ort */}
                  {eventData.location && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '12px',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '8px',
                        transition: 'background-color 0.2s'
                      }}
                      onClick={() => {
                        if (eventData.location_maps_url) {
                          window.open(eventData.location_maps_url, '_blank');
                        } else {
                          // Fallback to Apple Maps on iOS, Google Maps otherwise
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          const encodedLocation = encodeURIComponent(eventData.location || '');
                          const mapsUrl = isIOS
                            ? `maps://maps.apple.com/?q=${encodedLocation}`
                            : `https://maps.google.com/maps?q=${encodedLocation}`;
                          window.open(mapsUrl, '_blank');
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <IonIcon icon={location} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#007aff', textDecoration: 'underline' }}>
                        {eventData.location}
                      </div>
                    </div>
                  )}

                  {/* Anmeldezeitraum mit Umbruch */}
                  {(eventData.registration_opens_at || eventData.registration_closes_at) && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <IonIcon icon={time} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem', marginTop: '2px' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {eventData.registration_opens_at ? (
                          <>
                            <div>von {new Date(eventData.registration_opens_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_opens_at)}</div>
                            {eventData.registration_closes_at && (
                              <div>bis {new Date(eventData.registration_closes_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_closes_at)}</div>
                            )}
                          </>
                        ) : (
                          'Sofort möglich'
                        )}
                      </div>
                    </div>
                  )}

                  {eventData.waitlist_enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={listOutline} style={{ marginRight: '12px', color: '#fd7e14', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        Warteliste: {(eventData as any).waitlist_count || 0} / {eventData.max_waitlist_size || 10}
                        {(eventData as any).waitlist_position && ` (Du: Platz ${(eventData as any).waitlist_position})`}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={trophy} style={{ marginRight: '12px', color: '#ff9500', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData.points} Punkte • {eventData.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                    </div>
                  </div>


                  {eventData.categories && eventData.categories.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={ribbon} style={{ marginRight: '12px', color: '#007aff', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {eventData.categories.map(cat => cat.name).join(', ')}
                      </div>
                    </div>
                  )}
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Description */}
        {eventData.description && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: '#333' }}>
                Beschreibung
              </h3>
              <p style={{ margin: '0', fontSize: '1rem', color: '#666', lineHeight: '1.5' }}>
                {eventData.description}
              </p>
            </IonCardContent>
          </IonCard>
        )}

        {/* Teilnehmer-Liste */}
        {participants.length > 0 && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <IonIcon icon={people} style={{ fontSize: '1.2rem', color: '#34c759', marginRight: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600', color: '#333' }}>
                  Angemeldete Teilnehmer:innen ({participants.length})
                </h3>
              </div>
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
        )}

        {/* Action Buttons - same width as admin cards */}
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