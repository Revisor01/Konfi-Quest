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
  IonAvatar,
  useIonModal,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
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
  trash
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
  const { setSuccess, setError } = useApp();
  
  const [participants, setParticipants] = useState<Participant[]>([]);
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
      day: '2-digit',
      month: '2-digit',
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
      
      loadEventData(); // Reload to update status
    } catch (error) {
      setError('Fehler beim Aktualisieren der Anwesenheit');
    }
  };

  const handlePromoteParticipant = async (participant: Participant) => {
    try {
      await api.put(`/events/${eventId}/participants/${participant.id}/status`, {
        status: 'confirmed'
      });
      setSuccess(`${participant.participant_name} von Warteliste bestätigt`);
      loadEventData(); // Reload to update list
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
      loadEventData(); // Reload to update list
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
      loadEventData(); // Reload to update list
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

        {/* Event Info Card */}
        {/* Gradient Header Card */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #eb445a 0%, #e91e63 50%, #d81b60 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(235, 68, 90, 0.4)'
        }}>
          <IonCardContent>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ margin: '0', opacity: 0.9, fontSize: '0.9rem' }}>
                {eventData?.categories && eventData.categories.length > 0 
                  ? eventData.categories.map(cat => cat.name).join(', ')
                  : 'Event'
                } • {eventData?.event_date && `${formatDate(eventData.event_date)} • ${formatTime(eventData.event_date)}`}
                {eventData?.event_end_time && ` - ${formatTime(eventData.event_end_time)}`}
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
              <div>
                <IonIcon icon={people} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>
                  {participants.filter(p => p.status === 'confirmed').length}/{eventData?.max_participants || 0}
                </h3>
                <p style={{ margin: '0', fontSize: '0.8rem', opacity: 0.8 }}>
                  Anmeldungen
                </p>
                {participants.filter(p => p.status === 'pending').length > 0 && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', opacity: 0.7 }}>
                    +{participants.filter(p => p.status === 'pending').length} Warteliste
                  </p>
                )}
                {participants.filter(p => p.status === 'confirmed').length > 0 && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', opacity: 0.7 }}>
                    {participants.filter(p => p.attendance_status === 'present').length} anwesend
                  </p>
                )}
              </div>
              <div>
                <IonIcon icon={flash} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>
                  {eventData?.points || 0}
                </h3>
                <p style={{ margin: '0', fontSize: '0.8rem', opacity: 0.8 }}>
                  {eventData?.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', opacity: 0.7 }}>
                  Punkte
                </p>
              </div>
              <div>
                <div style={{
                  color: getRegistrationStatusColor(eventData ? calculateRegistrationStatus(eventData) : 'closed') === 'success' ? '#2dd36f' : 
                         getRegistrationStatusColor(eventData ? calculateRegistrationStatus(eventData) : 'closed') === 'danger' ? '#eb445a' : 'white',
                  fontSize: '1.2rem',
                  marginBottom: '4px'
                }}>
                  ●
                </div>
                <h3 style={{ margin: '0', fontSize: '0.9rem' }}>
                  {getRegistrationStatusText(eventData ? calculateRegistrationStatus(eventData) : 'closed')}
                </h3>
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Event Details */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={createOutline} style={{ marginRight: '8px', color: '#eb445a' }} />
              Details
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '16px' }}>
            {eventData?.description && (
              <IonItem lines="none">
                <IonLabel>
                  <h3>Beschreibung</h3>
                  <p>{eventData.description}</p>
                </IonLabel>
              </IonItem>
            )}
            
            {eventData?.location && (
              <IonItem lines="none">
                <IonIcon icon={location} slot="start" color="primary" />
                <IonLabel>
                  <h3>Ort</h3>
                  <p>{eventData.location}</p>
                </IonLabel>
              </IonItem>
            )}

            <IonItem lines="none">
              <IonIcon icon={time} slot="start" color="primary" />
              <IonLabel>
                <h3>Anmeldung</h3>
                <p>
                  {eventData?.registration_opens_at ? 
                    `Ab ${formatDate(eventData.registration_opens_at)} ${formatTime(eventData.registration_opens_at)}` : 
                    'Sofort möglich'
                  }
                  {eventData?.registration_closes_at && 
                    ` bis ${formatDate(eventData.registration_closes_at)} ${formatTime(eventData.registration_closes_at)}`
                  }
                </p>
              </IonLabel>
            </IonItem>

            {eventData?.jahrgaenge && eventData.jahrgaenge.length > 0 && (
              <IonItem lines="none">
                <IonIcon icon={people} slot="start" color="primary" />
                <IonLabel>
                  <h3>Jahrgänge</h3>
                  <p>{eventData.jahrgaenge.map(j => j.name).join(', ')}</p>
                </IonLabel>
              </IonItem>
            )}
          </IonCardContent>
        </IonCard>

        {/* Timeslots */}
        {eventData?.has_timeslots && (
          <IonCard style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={time} style={{ marginRight: '8px', color: '#eb445a' }} />
                Zeitslots ({eventData?.timeslots?.length || 0})
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0' }}>
              {!eventData.timeslots || eventData.timeslots.length === 0 ? (
                <IonItem lines="none">
                  <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                    <p>Keine Zeitslots konfiguriert</p>
                  </IonLabel>
                </IonItem>
              ) : (
                <IonList>
                  {eventData.timeslots.map((timeslot) => (
                    <IonItem key={timeslot.id}>
                      <IonIcon icon={time} slot="start" color="primary" />
                      <IonLabel>
                        <h3>
                          {timeslot.start_time && timeslot.end_time 
                            ? `${formatTime(timeslot.start_time)} - ${formatTime(timeslot.end_time)}`
                            : 'Zeit nicht definiert'
                          }
                        </h3>
                        <p>
                          {timeslot.registered_count || 0}/{timeslot.max_participants} Teilnehmer
                          {(timeslot.registered_count || 0) >= timeslot.max_participants && ' • Ausgebucht'}
                        </p>
                      </IonLabel>
                      <IonChip 
                        color={(timeslot.registered_count || 0) >= timeslot.max_participants ? 'danger' : 'success'}
                        slot="end"
                      >
                        {(timeslot.registered_count || 0) >= timeslot.max_participants ? 'Voll' : 'Verfügbar'}
                      </IonChip>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {/* Series Events */}
        {eventData?.is_series && eventData?.series_events && eventData.series_events.length > 0 && (
          <IonCard style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={calendar} style={{ marginRight: '8px', color: '#eb445a' }} />
                Weitere Termine dieser Serie
              </IonCardTitle>
            </IonCardHeader>
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
        )}

        {/* Participants List */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <IonIcon icon={people} style={{ marginRight: '8px', color: '#eb445a' }} />
                Teilnehmer ({participants.filter(p => p.status === 'confirmed').length})
                {participants.filter(p => p.status === 'pending').length > 0 && 
                  ` • Warteliste (${participants.filter(p => p.status === 'pending').length})`
                }
              </span>
              <IonButton 
                fill="clear" 
                size="small"
                onClick={() => presentParticipantModalHook({ presentingElement: presentingElement || undefined })}
              >
                <IonIcon icon={personAdd} style={{ color: '#eb445a' }} />
              </IonButton>
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '0' }}>
            {participants.length === 0 ? (
              <IonItem lines="none">
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Noch keine Anmeldungen</p>
                </IonLabel>
              </IonItem>
            ) : (
              <IonList>
                {participants.map((participant) => (
                  <IonItemSliding key={participant.id}>
                    <IonItem>
                      <IonAvatar slot="start" style={{ 
                        width: '40px', 
                        height: '40px',
                        backgroundColor: participant.attendance_status === 'present' ? '#28a745' : 
                                        participant.attendance_status === 'absent' ? '#dc3545' : '#007aff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IonIcon 
                          icon={participant.attendance_status === 'present' ? checkmarkCircle : 
                                participant.attendance_status === 'absent' ? closeCircle : people} 
                          style={{ 
                            fontSize: '1.2rem', 
                            color: 'white'
                          }} 
                        />
                      </IonAvatar>
                      <IonLabel>
                        <h3>
                          {participant.participant_name}
                          {participant.status === 'pending' && (
                            <span style={{ 
                              marginLeft: '8px',
                              fontSize: '0.8rem',
                              color: '#ff9500',
                              fontWeight: '500'
                            }}>
                              • Warteliste
                            </span>
                          )}
                          {participant.attendance_status && (
                            <span style={{ 
                              marginLeft: '8px',
                              fontSize: '0.8rem',
                              color: participant.attendance_status === 'present' ? '#28a745' : '#dc3545'
                            }}>
                              {participant.attendance_status === 'present' ? '✓ Anwesend' : '✗ Abwesend'}
                            </span>
                          )}
                        </h3>
                        <p>
                          {participant.jahrgang_name && `${participant.jahrgang_name} • `}
                          Angemeldet am {formatDate(participant.created_at)}
                        </p>
                      </IonLabel>
                      <div slot="end" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {participant.status === 'confirmed' && (
                          <>
                            <IonButton 
                              fill={participant.attendance_status === 'present' ? 'solid' : 'clear'} 
                              size="small"
                              color="success"
                              onClick={() => handleAttendanceUpdate(participant, 'present')}
                              style={{
                                '--border-radius': '50%',
                                '--padding-start': '8px',
                                '--padding-end': '8px',
                                width: '32px',
                                height: '32px'
                              }}
                            >
                              <IonIcon icon={checkmarkCircle} style={{ fontSize: '16px' }} />
                            </IonButton>
                            <IonButton 
                              fill={participant.attendance_status === 'absent' ? 'solid' : 'clear'}
                              size="small"
                              color="danger"
                              onClick={() => handleAttendanceUpdate(participant, 'absent')}
                              style={{
                                '--border-radius': '50%',
                                '--padding-start': '8px',
                                '--padding-end': '8px',
                                width: '32px',
                                height: '32px'
                              }}
                            >
                              <IonIcon icon={closeCircle} style={{ fontSize: '16px' }} />
                            </IonButton>
                          </>
                        )}
                        {participant.status === 'pending' && (
                          <IonButton 
                            fill="solid"
                            size="small"
                            color="warning"
                            onClick={() => handlePromoteParticipant(participant)}
                            style={{
                              '--border-radius': '16px',
                              fontSize: '0.7rem',
                              height: '28px'
                            }}
                          >
                            ✓
                          </IonButton>
                        )}
                      </div>
                    </IonItem>
                    <IonItemOptions side="end">
                      {participant.status === 'confirmed' && (
                        <IonItemOption 
                          color="warning" 
                          onClick={() => handleDemoteParticipant(participant)}
                        >
                          Warteliste
                        </IonItemOption>
                      )}
                      <IonItemOption 
                        color="danger" 
                        onClick={() => handleRemoveParticipant(participant)}
                      >
                        <IonIcon icon={trash} />
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
};

export default EventDetailView;