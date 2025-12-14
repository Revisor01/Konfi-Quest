import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonIcon,
  IonSearchbar,
  IonCheckbox,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption
} from '@ionic/react';
import { close, person, people, trash, add, checkmark, closeOutline, checkmarkOutline, personAdd } from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';

interface Konfi {
  id: number;
  name: string;
  jahrgang_name?: string;
}

interface Participant {
  id: number;
  user_id?: number;
  participant_name: string;
  jahrgang_name?: string;
  created_at: string;
  status?: 'confirmed' | 'pending';
}

interface Timeslot {
  id: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count: number;
}

interface Event {
  has_timeslots?: boolean;
  timeslots?: Timeslot[];
}

interface ParticipantManagementModalProps {
  eventId: number;
  participants: Participant[];
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const ParticipantManagementModal: React.FC<ParticipantManagementModalProps> = ({ 
  eventId, 
  participants, 
  onClose, 
  onSuccess, 
  dismiss 
}) => {
  const { setSuccess, setError } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [availableKonfis, setAvailableKonfis] = useState<Konfi[]>([]);
  const [selectedKonfis, setSelectedKonfis] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [selectedTimeslot, setSelectedTimeslot] = useState<number | null>(null);

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    loadAvailableKonfis();
    loadEventData();
  }, []);

  const loadEventData = async () => {
    try {
      const response = await api.get(`/events/${eventId}`);
      setEventData(response.data);
      
      // If event has timeslots, pre-select the first available one
      if (response.data.has_timeslots && response.data.timeslots && response.data.timeslots.length > 0) {
        const availableTimeslot = response.data.timeslots.find((t: Timeslot) => 
          (t.registered_count || 0) < t.max_participants
        );
        if (availableTimeslot) {
          setSelectedTimeslot(availableTimeslot.id);
        }
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    }
  };

  const loadAvailableKonfis = async () => {
    try {
      const response = await api.get('/admin/konfis');
      const allKonfis = response.data;
      
      // Filter out already registered participants based on user_id (not booking id)
      const participantUserIds = participants.map(p => p.user_id || p.id);
      const available = allKonfis.filter((konfi: Konfi) => !participantUserIds.includes(konfi.id));
      
      setAvailableKonfis(available);
    } catch (error) {
      setError('Fehler beim Laden der Konfis');
    }
  };

  const filteredKonfis = availableKonfis.filter(konfi =>
    konfi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (konfi.jahrgang_name && konfi.jahrgang_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleKonfiSelection = (konfiId: number) => {
    setSelectedKonfis(prev => 
      prev.includes(konfiId) 
        ? prev.filter(id => id !== konfiId)
        : [...prev, konfiId]
    );
  };

  const handleAddParticipants = async () => {
    if (selectedKonfis.length === 0) return;
    
    // For events with timeslots, require timeslot selection
    if (eventData?.has_timeslots && !selectedTimeslot) {
      setError('Bitte wähle einen Zeitslot aus');
      return;
    }
    
    setLoading(true);
    try {
      // Add each selected konfi as participant
      for (const konfiId of selectedKonfis) {
        const requestData: any = {
          user_id: konfiId,
          status: 'auto' // Let backend determine status based on capacity
        };
        
        // Add timeslot_id if event has timeslots
        if (eventData?.has_timeslots && selectedTimeslot) {
          requestData.timeslot_id = selectedTimeslot;
        }
        
        await api.post(`/events/${eventId}/participants`, requestData);
      }
      
      setSuccess(`${selectedKonfis.length} Teilnehmer hinzugefügt`);
      setSelectedKonfis([]);
      await loadAvailableKonfis();
      onSuccess();
    } catch (error) {
      setError('Fehler beim Hinzufügen der Teilnehmer');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId: number) => {
    try {
      await api.delete(`/events/${eventId}/bookings/${participantId}`);
      setSuccess('Teilnehmer entfernt');
      await loadAvailableKonfis();
      onSuccess();
    } catch (error) {
      setError('Fehler beim Entfernen des Teilnehmers');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Teilnehmer verwalten</IonTitle>
          <IonButtons slot="start">
            <IonButton
              onClick={handleClose}
              disabled={loading}
              style={{
                '--background': '#f8f9fa',
                '--background-hover': '#e9ecef',
                '--color': '#6c757d',
                '--border-radius': '8px'
              }}
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {selectedKonfis.length > 0 && (
              <IonButton
                onClick={handleAddParticipants}
                disabled={loading}
                color="primary"
                style={{
                  '--background': '#eb445a',
                  '--background-hover': '#d73847',
                  '--color': 'white',
                  '--border-radius': '8px'
                }}
              >
                <IonIcon icon={checkmarkOutline} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Teilnehmer hinzufügen */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={personAdd} />
            </div>
            <IonLabel>Teilnehmer hinzufügen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonSearchbar
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Konfi suchen..."
              style={{
                '--background': '#f8f9fa',
                '--border-radius': '12px',
                '--placeholder-color': '#999',
                marginBottom: '16px',
                padding: '0'
              }}
            />

            {/* Timeslot Selection for events with timeslots */}
            {eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 && (
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Zeitslot auswählen *</IonLabel>
                <IonSelect
                  value={selectedTimeslot}
                  onIonChange={(e) => setSelectedTimeslot(e.detail.value)}
                  placeholder="Zeitslot wählen"
                  interface="action-sheet"
                  interfaceOptions={{
                    header: 'Zeitslot auswählen'
                  }}
                >
                  {eventData.timeslots.map((timeslot) => {
                    const available = (timeslot.registered_count || 0) < timeslot.max_participants;
                    return (
                      <IonSelectOption
                        key={timeslot.id}
                        value={timeslot.id}
                        disabled={!available}
                      >
                        {formatTime(timeslot.start_time)} - {formatTime(timeslot.end_time)}
                        ({timeslot.registered_count || 0}/{timeslot.max_participants})
                        {!available && ' - Voll'}
                      </IonSelectOption>
                    );
                  })}
                </IonSelect>
              </IonItem>
            )}

            {filteredKonfis.length === 0 ? (
              <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                Keine verfügbaren Konfis gefunden
              </p>
            ) : (
              filteredKonfis.map((konfi, index) => (
                <IonItem
                  key={konfi.id}
                  button
                  onClick={() => handleKonfiSelection(konfi.id)}
                  detail={false}
                  lines="none"
                  style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--padding-end': '0',
                    '--inner-padding-end': '0',
                    '--inner-border-width': '0',
                    marginBottom: index < filteredKonfis.length - 1 ? '8px' : '0'
                  }}
                >
                  <div
                    className={`app-list-item app-list-item--events ${selectedKonfis.includes(konfi.id) ? 'app-list-item--selected' : ''}`}
                    style={{ width: '100%', marginBottom: '0' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--events">
                          <IonIcon icon={person} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">{konfi.name}</div>
                          {konfi.jahrgang_name && (
                            <div className="app-list-item__subtitle">{konfi.jahrgang_name}</div>
                          )}
                        </div>
                      </div>
                      <IonCheckbox
                        checked={selectedKonfis.includes(konfi.id)}
                        style={{
                          '--checkbox-background-checked': '#dc2626',
                          '--border-color-checked': '#dc2626',
                          '--checkmark-color': 'white'
                        }}
                      />
                    </div>
                  </div>
                </IonItem>
              ))
            )}
          </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ParticipantManagementModal;