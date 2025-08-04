import React from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonBadge,
  IonItem,
  IonLabel,
  useIonAlert
} from '@ionic/react';
import {
  close,
  calendar,
  time,
  location,
  people,
  trophy,
  checkmarkCircle,
  hourglass
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  event_end_time?: string;
  location?: string;
  points: number;
  type: string;
  max_participants: number;
  registered_count: number;
  is_registered?: boolean;
  can_register?: boolean;
  registration_status: 'upcoming' | 'open' | 'closed' | 'cancelled';
}

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  onUpdate: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onUpdate
}) => {
  const { setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();

  if (!event) return null;

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

  const handleRegister = async () => {
    try {
      await api.post(`/konfi/events/${event.id}/register`);
      setSuccess(`Erfolgreich für "${event.name}" angemeldet!`);
      await onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  const handleUnregister = async () => {
    presentAlert({
      header: 'Abmeldung bestätigen',
      message: `Möchtest du dich wirklich von "${event.name}" abmelden?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/konfi/events/${event.id}/register`);
              setSuccess(`Von "${event.name}" abgemeldet`);
              await onUpdate();
              onClose();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
            }
          }
        }
      ]
    });
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{event.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{event.name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Event Header Card */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h2 style={{ margin: '0', fontSize: '1.4rem', fontWeight: '700', color: '#333' }}>
                {event.name}
              </h2>
              <IonBadge 
                color={event.is_registered ? 'success' : getStatusColor(event.registration_status)} 
                style={{ fontSize: '0.8rem' }}
              >
                {event.is_registered ? 'Angemeldet' : getStatusText(event.registration_status)}
              </IonBadge>
            </div>

            <IonGrid style={{ padding: '0' }}>
              <IonRow>
                <IonCol size="12">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={calendar} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#333' }}>
                        {formatDate(event.event_date)}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {formatTime(event.event_date)}
                        {event.event_end_time && ` - ${formatTime(event.event_end_time)}`}
                      </div>
                    </div>
                  </div>

                  {event.location && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <IonIcon icon={location} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                      <div style={{ fontSize: '1rem', color: '#333' }}>
                        {event.location}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={people} style={{ marginRight: '12px', color: '#dc2626', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '1rem', color: '#333' }}>
                      {event.registered_count} / {event.max_participants} Teilnehmer
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                    <IonChip color="primary" style={{ fontSize: '0.9rem' }}>
                      <IonIcon icon={trophy} style={{ marginRight: '4px' }} />
                      {event.points} Punkte
                    </IonChip>
                    <IonChip color="secondary" style={{ fontSize: '0.9rem' }}>
                      {event.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                    </IonChip>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        {/* Description */}
        {event.description && (
          <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
            <IonCardContent>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: '#333' }}>
                Beschreibung
              </h3>
              <p style={{ margin: '0', fontSize: '1rem', color: '#666', lineHeight: '1.5' }}>
                {event.description}
              </p>
            </IonCardContent>
          </IonCard>
        )}

        {/* Action Buttons */}
        <div style={{ padding: '16px', paddingBottom: '32px' }}>
          {event.is_registered ? (
            <IonButton 
              expand="block" 
              fill="outline" 
              color="danger"
              onClick={handleUnregister}
              style={{ 
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600'
              }}
            >
              <IonIcon icon={close} slot="start" />
              Abmelden
            </IonButton>
          ) : event.can_register && event.registration_status === 'open' ? (
            <IonButton 
              expand="block" 
              color="success"
              onClick={handleRegister}
              style={{ 
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600'
              }}
            >
              <IonIcon icon={checkmarkCircle} slot="start" />
              Anmelden
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
              <IonIcon icon={hourglass} slot="start" />
              {event.registration_status === 'closed' ? 'Anmeldung geschlossen' : 'Nicht verfügbar'}
            </IonButton>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default EventDetailModal;