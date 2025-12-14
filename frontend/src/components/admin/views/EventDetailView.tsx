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

  const getRegistrationStatusText = (status: string) => {
    switch (status) {
      case 'upcoming': return 'Bald verfügbar';
      case 'open': return 'Anmeldung offen';
      case 'closed': return 'Anmeldung geschlossen';
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
                      <span style={{ fontSize: '1.5rem' }}>{participants.filter(p => p.status === 'confirmed').length}/{eventData?.max_participants || 0}</span>
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
                        {formatDate(eventData?.event_date || '')}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatTime(eventData?.event_date || '')}
                        {eventData?.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
                      </div>
                    </div>
                  </div>

                  {/* Timeslots direkt unter Datum */}
                  {eventData?.has_timeslots && eventData?.timeslots && eventData.timeslots.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <IonIcon icon={time} style={{ marginRight: '12px', color: '#ff9500', fontSize: '1.2rem', marginTop: '2px' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {eventData.timeslots.map((slot, index) => (
                          <div key={slot.id} style={{ marginBottom: index < eventData.timeslots!.length - 1 ? '4px' : '0' }}>
                            <span style={{ fontWeight: '500' }}>Slot {index + 1}:</span>{' '}
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            <span style={{ color: '#666', marginLeft: '8px' }}>
                              ({slot.registered_count || 0}/{slot.max_participants})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TN gesamt */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={people} style={{ marginRight: '12px', color: '#34c759', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData?.registered_count || 0} / {eventData?.max_participants || 0} Teilnehmer:innen
                    </div>
                  </div>

                  {/* Warteliste */}
                  {(eventData as any)?.waitlist_enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={listOutline} style={{ marginRight: '12px', color: '#fd7e14', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {participants.filter(p => p.status === 'pending').length} / {(eventData as any)?.max_waitlist_size || 10} auf Warteliste
                      </div>
                    </div>
                  )}

                  {/* Punkte */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={trophy} style={{ marginRight: '12px', color: '#ff9500', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData?.points || 0} Punkte
                    </div>
                  </div>

                  {/* Typ */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon
                      icon={home}
                      style={{
                        marginRight: '12px',
                        color: eventData?.point_type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                        fontSize: '1.2rem'
                      }}
                    />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData?.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                    </div>
                  </div>

                  {/* Kategorien */}
                  {eventData?.categories && eventData.categories.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={pricetag} style={{ marginRight: '12px', color: '#8b5cf6', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {eventData.categories.map(c => c.name).join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Ort */}
                  {eventData?.location && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={location} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                      <div
                        style={{
                          fontSize: '1rem',
                          color: '#007aff',
                          textDecoration: 'underline',
                          cursor: 'pointer'
                        }}
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

                  {/* Anmeldezeitraum mit Umbruch */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <IonIcon icon={time} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem', marginTop: '2px' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {eventData?.registration_opens_at ? (
                        <>
                          <div>von {new Date(eventData.registration_opens_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_opens_at)}</div>
                          {eventData?.registration_closes_at && (
                            <div>bis {new Date(eventData.registration_closes_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {formatTime(eventData.registration_closes_at)}</div>
                          )}
                        </>
                      ) : (
                        'Sofort möglich'
                      )}
                    </div>
                  </div>

                  {/* Jahrgang */}
                  {eventData?.jahrgaenge && eventData.jahrgaenge.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={people} style={{ marginRight: '12px', color: '#007aff', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {eventData.jahrgaenge.map(j => j.name).join(', ')}
                      </div>
                    </div>
                  )}

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
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Timeslots */}
        {eventData?.has_timeslots && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#dc2626',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <IonIcon icon={time} style={{ color: 'white', fontSize: '0.8rem' }} />
              </div>
              <IonLabel>Zeitslots ({eventData?.timeslots?.length || 0})</IonLabel>
            </IonListHeader>
            <IonCard style={{ margin: '0' }}>
            {!eventData.timeslots || eventData.timeslots.length === 0 ? (
              <IonCardContent style={{ padding: '16px' }}>
                <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                  Keine Zeitslots konfiguriert
                </p>
              </IonCardContent>
            ) : (
              <IonCardContent style={{ padding: '8px 0' }}>
                <IonList lines="none" style={{ background: 'transparent' }}>
                  {eventData.timeslots.map((timeslot) => (
                    <IonItem
                      key={timeslot.id}
                      detail={false}
                      style={{
                        '--min-height': '80px',
                        '--padding-start': '16px',
                        '--padding-top': '0px',
                        '--padding-bottom': '0px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '6px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}
                    >
                      <IonLabel>
                        {/* Header mit Icon und Badge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '4px',
                          position: 'relative'
                        }}>
                          {/* Time Icon */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#dc2626',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 2px 8px rgba(235, 68, 90, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                          }}>
                            <IonIcon
                              icon={time}
                              style={{
                                fontSize: '0.9rem',
                                color: 'white'
                              }}
                            />
                          </div>

                          {/* Time Range */}
                          <h3 style={{
                            fontWeight: '600',
                            fontSize: '1rem',
                            margin: '0',
                            color: '#333',
                            lineHeight: '1.3',
                            flex: 1,
                            minWidth: 0,
                            maxWidth: 'calc(100% - 100px)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {timeslot.start_time && timeslot.end_time
                              ? `${formatTime(timeslot.start_time)} - ${formatTime(timeslot.end_time)}`
                              : 'Zeit nicht definiert'
                            }
                          </h3>

                          {/* Status Badge */}
                          <span style={{
                            fontSize: '0.7rem',
                            color: (timeslot.registered_count || 0) >= timeslot.max_participants ? '#dc2626' : '#2dd36f',
                            fontWeight: '600',
                            backgroundColor: (timeslot.registered_count || 0) >= timeslot.max_participants ? 'rgba(235, 68, 90, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            border: (timeslot.registered_count || 0) >= timeslot.max_participants ? '1px solid rgba(235, 68, 90, 0.3)' : '1px solid rgba(45, 211, 111, 0.3)',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            position: 'absolute',
                            right: '0px',
                            top: '50%',
                            transform: 'translateY(-50%)'
                          }}>
                            {(timeslot.registered_count || 0) >= timeslot.max_participants ? 'Voll' : 'Verfügbar'}
                          </span>
                        </div>

                        {/* Participants Count */}
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: '40px'
                        }}>
                          <span>
                            {timeslot.registered_count || 0}/{timeslot.max_participants} Teilnehmer
                            {(timeslot.registered_count || 0) >= timeslot.max_participants && ' • Ausgebucht'}
                          </span>
                        </div>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            )}
            </IonCard>
          </IonList>
        )}

        {/* Series Events */}
        {eventData?.is_series && eventData?.series_events && eventData.series_events.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#dc2626',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <IonIcon icon={calendar} style={{ color: 'white', fontSize: '0.8rem' }} />
              </div>
              <IonLabel>Weitere Termine dieser Serie</IonLabel>
            </IonListHeader>
            <IonCard style={{ margin: '0' }}>
            <IonCardContent style={{ padding: '0' }}>
              <IonList>
                {eventData.series_events.map((seriesEvent) => (
                  <IonItem 
                    key={seriesEvent.id}
                    button
                    onClick={() => window.location.href = `/admin/events/${seriesEvent.id}`}
                  >
                    <IonIcon icon={calendar} slot="start" color="primary" />
                    <IonLabel>
                      <h3>{seriesEvent.name}</h3>
                      <p>
                        {formatDate(seriesEvent.event_date)} {formatTime(seriesEvent.event_date)}
                        • {seriesEvent.registered_count || 0}/{seriesEvent.max_participants} Teilnehmer
                      </p>
                    </IonLabel>
                    <IonChip 
                      color={
                        (seriesEvent.registered_count || 0) >= seriesEvent.max_participants 
                          ? 'danger' 
                          : 'success'
                      }
                      slot="end"
                    >
                      {(seriesEvent.registered_count || 0) >= seriesEvent.max_participants ? 'Voll' : 'Verfügbar'}
                    </IonChip>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Participants List */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#dc2626',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px'
            }}>
              <IonIcon icon={people} style={{ color: 'white', fontSize: '0.8rem' }} />
            </div>
            <IonLabel>
              Teilnehmer:innen ({participants.filter(p => p.status === 'confirmed').length}
              {participants.filter(p => p.status === 'pending').length > 0 &&
                ` + ${participants.filter(p => p.status === 'pending').length}`
              })
            </IonLabel>
          </IonListHeader>
          <IonCard style={{ margin: '0' }}>
          {participants.length === 0 ? (
            <IonCardContent style={{ padding: '16px' }}>
              <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                Noch keine Anmeldungen
              </p>
            </IonCardContent>
          ) : (
            <IonCardContent style={{ padding: '8px 0' }}>
              <IonList lines="none" style={{ background: 'transparent' }}>
                {participants.map((participant) => (
                  <IonItemSliding
                    key={participant.id}
                    ref={(el) => {
                      if (el) {
                        slidingRefs.current.set(participant.id, el);
                      } else {
                        slidingRefs.current.delete(participant.id);
                      }
                    }}
                  >
                    <IonItem
                      button
                      detail={false}
                      onClick={() => {
                        if (participant.status === 'confirmed') {
                          showAttendanceActionSheet(participant);
                        } else if (participant.status === 'pending') {
                          showWaitlistActionSheet(participant);
                        }
                      }}
                      style={{
                        '--min-height': '80px',
                        '--padding-start': '16px',
                        '--padding-top': '0px',
                        '--padding-bottom': '0px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '6px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}
                    >
                      <IonLabel>
                        {/* Header mit Icon */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '4px',
                          position: 'relative'
                        }}>
                          {/* Status Icon */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: participant.attendance_status === 'present' ? '#2dd36f' :
                                            participant.attendance_status === 'absent' ? '#dc2626' :
                                            participant.status === 'pending' ? '#ff9500' : '#007aff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: participant.attendance_status === 'present' ? '0 2px 8px rgba(45, 211, 111, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)' :
                                       participant.attendance_status === 'absent' ? '0 2px 8px rgba(235, 68, 90, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)' :
                                       participant.status === 'pending' ? '0 2px 8px rgba(255, 149, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)' :
                                       '0 2px 8px rgba(0, 122, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                          }}>
                            <IonIcon
                              icon={participant.attendance_status === 'present' ? checkmarkCircle :
                                    participant.attendance_status === 'absent' ? closeCircle : people}
                              style={{
                                fontSize: '0.9rem',
                                color: 'white'
                              }}
                            />
                          </div>

                          {/* Participant Name */}
                          <h3 style={{
                            fontWeight: '600',
                            fontSize: '1rem',
                            margin: '0',
                            color: participant.status === 'pending' ? '#ff9500' : '#333',
                            lineHeight: '1.3',
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {participant.participant_name}
                            {participant.status === 'pending' && (
                              <span style={{
                                marginLeft: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '500'
                              }}>
                                • Warteliste
                              </span>
                            )}
                          </h3>
                        </div>

                        {/* Details */}
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: '40px'
                        }}>
                          <span>
                            {participant.jahrgang_name && `${participant.jahrgang_name} • `}
                            {participant.timeslot_start_time && participant.timeslot_end_time && (
                              <>Zeitslot: {formatTime(participant.timeslot_start_time)} - {formatTime(participant.timeslot_end_time)} • </>
                            )}
                            Angemeldet am {new Date(participant.created_at).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </IonLabel>
                    </IonItem>
                    <IonItemOptions side="end" style={{
                      gap: '4px',
                      '--ion-item-background': 'transparent'
                    }}>
                      {/* Auf Warteliste setzen - nur für bestätigte Teilnehmer */}
                      {participant.status === 'confirmed' && (
                        <IonItemOption
                          onClick={() => handleDemoteParticipant(participant)}
                          style={{
                            '--background': 'transparent',
                            '--background-activated': 'transparent',
                            '--background-focused': 'transparent',
                            '--background-hover': 'transparent',
                            '--color': 'transparent',
                            '--ripple-color': 'transparent',
                            padding: '0 2px',
                            minWidth: '48px',
                            maxWidth: '68px'
                          }}
                        >
                          <div style={{
                            width: '44px',
                            height: '44px',
                            backgroundColor: '#fd7e14',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(253, 126, 20, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                          }}>
                            <IonIcon icon={returnUpBack} style={{ fontSize: '1.2rem', color: 'white' }} />
                          </div>
                        </IonItemOption>
                      )}
                      <IonItemOption
                        onClick={() => handleRemoveParticipant(participant)}
                        style={{
                          '--background': 'transparent',
                          '--background-activated': 'transparent',
                          '--background-focused': 'transparent',
                          '--background-hover': 'transparent',
                          '--color': 'transparent',
                          '--ripple-color': 'transparent',
                          padding: '0 2px',
                          paddingRight: '20px',
                          minWidth: '48px',
                          maxWidth: '68px'
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          backgroundColor: '#dc3545',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                        }}>
                          <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                        </div>
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </IonList>
            </IonCardContent>
          )}
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

        {/* Abmeldungen (Unregistrations) */}
        {unregistrations.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#dc3545',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <IonIcon icon={closeCircle} style={{ color: 'white', fontSize: '0.8rem' }} />
              </div>
              <IonLabel>Abmeldungen ({unregistrations.length})</IonLabel>
            </IonListHeader>
            <IonCard style={{ margin: '0' }}>
            <IonCardContent style={{ padding: '8px 0' }}>
              <IonList lines="none" style={{ background: 'transparent' }}>
                {unregistrations.map((unreg) => (
                  <IonItem
                    key={unreg.id}
                    detail={false}
                    style={{
                      '--min-height': '70px',
                      '--padding-start': '16px',
                      '--padding-top': '0px',
                      '--padding-bottom': '0px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px'
                    }}
                  >
                    <IonLabel>
                      {/* Header mit Icon */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '4px'
                      }}>
                        {/* Status Icon */}
                        <div style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: '#dc3545',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                        }}>
                          <IonIcon
                            icon={closeCircle}
                            style={{
                              fontSize: '0.9rem',
                              color: 'white'
                            }}
                          />
                        </div>

                        {/* Name */}
                        <h3 style={{
                          fontWeight: '600',
                          fontSize: '1rem',
                          margin: '0',
                          color: '#333',
                          lineHeight: '1.3',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {unreg.konfi_name}
                        </h3>
                      </div>

                      {/* Details */}
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#666',
                        marginLeft: '40px'
                      }}>
                        <div>
                          Abgemeldet am {new Date(unreg.unregistered_at).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {unreg.reason && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px 12px',
                            backgroundColor: 'rgba(220, 53, 69, 0.08)',
                            borderRadius: '8px',
                            borderLeft: '3px solid #dc3545',
                            color: '#666',
                            fontSize: '0.85rem',
                            lineHeight: '1.4'
                          }}>
                            <span style={{ fontWeight: '600', color: '#dc3545' }}>Grund:</span> {unreg.reason}
                          </div>
                        )}
                      </div>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
            </IonCard>
          </IonList>
        )}

      </IonContent>
    </IonPage>
  );
};

export default EventDetailView;