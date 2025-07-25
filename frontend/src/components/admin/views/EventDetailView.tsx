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
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonChip,
  IonAvatar,
  useIonModal
} from '@ionic/react';
import {
  arrowBack,
  createOutline,
  calendar,
  location,
  people,
  time,
  flash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import EventModal from '../modals/EventModal';

interface Category {
  id: number;
  name: string;
}

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  categories?: Category[];
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

interface Participant {
  id: number;
  participant_name: string;
  jahrgang_name?: string;
  created_at: string;
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

  // Modal mit useIonModal Hook
  const [presentEventModalHook, dismissEventModalHook] = useIonModal(EventModal, {
    event: eventData,
    onClose: () => dismissEventModalHook(),
    onSuccess: () => {
      dismissEventModalHook();
      handleEditSuccess();
    },
    dismiss: () => dismissEventModalHook()
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
    return new Date(dateString).toLocaleTimeString('de-DE', {
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

  const handleEditSuccess = () => {
    // Reload event data
    onBack();
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}>
          <IonCardContent>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ margin: '0', opacity: 0.9, fontSize: '0.9rem' }}>
                {eventData?.categories && eventData.categories.length > 0 
                  ? eventData.categories.map(cat => cat.name).join(', ')
                  : 'Event'
                } • {eventData?.event_date && `${formatDate(eventData.event_date)} • ${formatTime(eventData.event_date)}`}
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
              <div>
                <IonIcon icon={people} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>
                  {eventData?.registered_count || 0}
                </h3>
                <p style={{ margin: '0', fontSize: '0.8rem', opacity: 0.8 }}>
                  Angemeldet
                </p>
              </div>
              <div>
                <IonIcon icon={calendar} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>
                  {eventData?.max_participants || 0}
                </h3>
                <p style={{ margin: '0', fontSize: '0.8rem', opacity: 0.8 }}>
                  Max. Plätze
                </p>
              </div>
              <div>
                <IonIcon icon={flash} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>
                  {eventData?.points || 0}
                </h3>
                <p style={{ margin: '0', fontSize: '0.8rem', opacity: 0.8 }}>
                  Punkte
                </p>
              </div>
              <div>
                <div style={{
                  color: getRegistrationStatusColor(eventData?.registration_status || 'closed') === 'success' ? '#2dd36f' : 
                         getRegistrationStatusColor(eventData?.registration_status || 'closed') === 'danger' ? '#eb445a' : 'white',
                  fontSize: '1.2rem',
                  marginBottom: '4px'
                }}>
                  ●
                </div>
                <h3 style={{ margin: '0', fontSize: '0.9rem' }}>
                  {getRegistrationStatusText(eventData?.registration_status || 'closed')}
                </h3>
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Event Details */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonTitle size="large">Details</IonTitle>
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
          </IonCardContent>
        </IonCard>

        {/* Timeslots */}
        {eventData?.has_timeslots && eventData?.timeslots && eventData.timeslots.length > 0 && (
          <IonCard style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonTitle size="large">Zeitslots</IonTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '0' }}>
              <IonList>
                {eventData.timeslots.map((timeslot) => (
                  <IonItem key={timeslot.id}>
                    <IonIcon icon={time} slot="start" color="primary" />
                    <IonLabel>
                      <h3>{formatTime(timeslot.start_time)} - {formatTime(timeslot.end_time)}</h3>
                      <p>
                        {timeslot.registered_count}/{timeslot.max_participants} Teilnehmer
                        {timeslot.registered_count >= timeslot.max_participants && ' • Ausgebucht'}
                      </p>
                    </IonLabel>
                    <IonChip 
                      color={timeslot.registered_count >= timeslot.max_participants ? 'danger' : 'success'}
                      slot="end"
                    >
                      {timeslot.registered_count >= timeslot.max_participants ? 'Voll' : 'Verfügbar'}
                    </IonChip>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {/* Series Events */}
        {eventData?.is_series && eventData?.series_events && eventData.series_events.length > 0 && (
          <IonCard style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonTitle size="large">Weitere Termine dieser Serie</IonTitle>
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
            <IonTitle size="large">Teilnehmer ({participants.length})</IonTitle>
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
                  <IonItem key={participant.id}>
                    <IonAvatar slot="start" style={{ 
                      width: '40px', 
                      height: '40px',
                      backgroundColor: '#007aff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <IonIcon 
                        icon={people} 
                        style={{ 
                          fontSize: '1.2rem', 
                          color: 'white'
                        }} 
                      />
                    </IonAvatar>
                    <IonLabel>
                      <h3>{participant.participant_name}</h3>
                      <p>
                        {participant.jahrgang_name && `${participant.jahrgang_name} • `}
                        Angemeldet am {formatDate(participant.created_at)}
                      </p>
                    </IonLabel>
                  </IonItem>
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