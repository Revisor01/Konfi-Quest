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
  IonInput,
  IonCheckbox,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonItemGroup
} from '@ionic/react';
import { close, person, people, trash, add, checkmark, closeOutline, checkmarkOutline, personAdd, search, filterOutline, time, calendarOutline } from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';

interface Konfi {
  id: number;
  name: string;
  jahrgang_id?: number;
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
  jahrgang_id?: number;
  jahrgang_name?: string;
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
  const [availableJahrgaenge, setAvailableJahrgaenge] = useState<string[]>([]);
  const [selectedJahrgang, setSelectedJahrgang] = useState<string>('event');

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

      // Extract available Jahrgaenge
      const jahrgaenge = [...new Set(
        available
          .filter((k: Konfi) => k.jahrgang_name)
          .map((k: Konfi) => k.jahrgang_name!)
      )].sort() as string[];
      setAvailableJahrgaenge(jahrgaenge);

      setAvailableKonfis(available);
    } catch (error) {
      setError('Fehler beim Laden der Konfis');
    }
  };

  const filteredKonfis = availableKonfis.filter(konfi => {
    // Search filter
    const matchesSearch = konfi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (konfi.jahrgang_name && konfi.jahrgang_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Jahrgang filter
    if (selectedJahrgang === 'event') {
      // Only show Konfis from event's Jahrgang
      if (eventData?.jahrgang_name) {
        return konfi.jahrgang_name === eventData.jahrgang_name;
      }
    } else if (selectedJahrgang !== 'alle') {
      return konfi.jahrgang_name === selectedJahrgang;
    }

    return true;
  });

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
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Suche & Filter - iOS26 Pattern */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={filterOutline} />
              </div>
              <IonLabel>Suche & Filter</IonLabel>
            </IonListHeader>
            <IonItemGroup>
              {/* Suchfeld */}
              <IonItem>
                <IonIcon
                  icon={search}
                  slot="start"
                  style={{ color: '#8e8e93', fontSize: '1rem' }}
                />
                <IonInput
                  value={searchTerm}
                  onIonInput={(e) => setSearchTerm(e.detail.value!)}
                  placeholder="Person suchen..."
                />
              </IonItem>
              {/* Jahrgang Filter */}
              <IonItem>
                <IonIcon
                  icon={calendarOutline}
                  slot="start"
                  style={{ color: '#8e8e93', fontSize: '1rem' }}
                />
                <IonSelect
                  value={selectedJahrgang}
                  onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                  placeholder="Jahrgang"
                  interface="popover"
                  style={{ width: '100%' }}
                >
                  {eventData?.jahrgang_name && (
                    <IonSelectOption value="event">
                      Nur {eventData.jahrgang_name}
                    </IonSelectOption>
                  )}
                  <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                  {availableJahrgaenge.map(jg => (
                    <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              {/* Zeitslot Auswahl */}
              {eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 && (
                <IonItem>
                  <IonIcon
                    icon={time}
                    slot="start"
                    style={{ color: '#8e8e93', fontSize: '1rem' }}
                  />
                  <IonSelect
                    value={selectedTimeslot}
                    onIonChange={(e) => setSelectedTimeslot(e.detail.value)}
                    placeholder="Zeitslot wählen *"
                    interface="popover"
                    style={{ width: '100%' }}
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
            </IonItemGroup>
          </IonList>

          {/* Personen Liste - iOS26 Pattern */}
          <IonList inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={personAdd} />
              </div>
              <IonLabel>Personen ({filteredKonfis.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {filteredKonfis.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    <IonIcon icon={search} style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ margin: '0', fontSize: '1rem' }}>Keine Konfis gefunden</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredKonfis.map((konfi) => {
                      const isSelected = selectedKonfis.includes(konfi.id);

                      return (
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
                            '--inner-border-width': '0'
                          }}
                        >
                          <div
                            className={`app-list-item app-list-item--events ${isSelected ? 'app-list-item--selected' : ''}`}
                            style={{ width: '100%', marginBottom: '0', position: 'relative' }}
                          >
                            {/* Corner Badge "Konfi" */}
                            <div
                              className="app-corner-badge app-corner-badge--events"
                            >
                              Konfi
                            </div>
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
                                checked={isSelected}
                                style={{
                                  '--checkbox-background-checked': '#dc2626',
                                  '--border-color-checked': '#dc2626',
                                  '--checkmark-color': 'white',
                                  flexShrink: 0,
                                  marginLeft: 'auto'
                                }}
                              />
                            </div>
                          </div>
                        </IonItem>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ParticipantManagementModal;