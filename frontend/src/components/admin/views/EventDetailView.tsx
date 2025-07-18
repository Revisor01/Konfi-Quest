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
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonChip,
  IonAvatar
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

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  category?: string;
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed';
  created_at: string;
}

interface Participant {
  id: number;
  name: string;
  jahrgang?: string;
  registered_at: string;
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [eventData, setEventData] = useState<Event | null>(null);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const [eventRes, participantsRes] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get(`/events/${eventId}/participants`)
      ]);
      setEventData(eventRes.data);
      setParticipants(participantsRes.data);
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
    setIsEditModalOpen(false);
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
          <IonTitle>Event Details</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setIsEditModalOpen(true)}>
              <IonIcon icon={createOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Event Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {/* Event Info Card */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #eb445a 0%, #e91e63 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(235, 68, 90, 0.3)'
        }}>
          <IonCardContent>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px'
              }}>
                <IonIcon icon={flash} style={{ fontSize: '1.5rem', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.3rem' }}>{eventData?.name || 'Event Details'}</h2>
                <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                  {eventData?.category && `${eventData.category} • `}
                  {eventData?.event_date && `${formatDate(eventData.event_date)} • ${formatTime(eventData.event_date)}`}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
              <div>
                <IonIcon icon={people} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>
                  {eventData?.registered_count || 0}/{eventData?.max_participants || 0}
                </h3>
                <p style={{ margin: '0', fontSize: '0.8rem', opacity: 0.8 }}>
                  Teilnehmer
                </p>
              </div>
              <div>
                <IonIcon icon={calendar} style={{ fontSize: '1.2rem', marginBottom: '4px' }} />
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
                <h3 style={{ margin: '0', fontSize: '1rem' }}>
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
                      <h3>{participant.name}</h3>
                      <p>
                        {participant.jahrgang && `Jahrgang ${participant.jahrgang} • `}
                        Angemeldet am {formatDate(participant.registered_at)}
                      </p>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        {/* Edit Modal */}
        <IonModal 
          isOpen={isEditModalOpen} 
          onDidDismiss={() => setIsEditModalOpen(false)}
          backdropDismiss={true}
        >
          <EventModal 
            event={eventData}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={handleEditSuccess}
          />
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default EventDetailView;