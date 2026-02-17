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
  IonSelectOption
} from '@ionic/react';
import { person, closeOutline, checkmarkOutline, personAdd, search, filterOutline, time, calendarOutline } from 'ionicons/icons';
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

interface EventJahrgang {
  id: number;
  name: string;
}

interface Event {
  has_timeslots?: boolean;
  timeslots?: Timeslot[];
  jahrgang_id?: number;
  jahrgang_name?: string;
  jahrgaenge?: EventJahrgang[];
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
  const [selectedJahrgang, setSelectedJahrgang] = useState<string>('alle');

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
      // Keine automatische Vorauswahl - User soll Zeitslot selbst wählen
    } catch (error) {
 console.error('Error loading event data:', error);
    }
  };

  // Event-Jahrgänge ermitteln (für Filter)
  const eventJahrgaenge = eventData?.jahrgaenge?.map(j => j.name) ||
    (eventData?.jahrgang_name ? [eventData.jahrgang_name] : []);
  const hasEventJahrgaenge = eventJahrgaenge.length > 0;

  const loadAvailableKonfis = async () => {
    try {
      const response = await api.get('/admin/konfis');
      const allKonfis = response.data;

      // Filter out already registered participants based on user_id (not booking id)
      const participantUserIds = participants.map(p => p.user_id || p.id);
      const available = allKonfis.filter((konfi: Konfi) => !participantUserIds.includes(konfi.id));

      // Extract available Jahrgaenge (wird nur für Dropdown gebraucht wenn Event keine Jahrgänge hat)
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

    // Wenn Event Jahrgänge hat, nur diese Konfis zeigen (außer "alle" gewählt)
    if (hasEventJahrgaenge && selectedJahrgang === 'alle') {
      // Bei "alle" trotzdem nur Event-Jahrgänge zeigen
      return eventJahrgaenge.includes(konfi.jahrgang_name || '');
    } else if (selectedJahrgang !== 'alle') {
      // Spezifischer Jahrgang gewählt
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
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {selectedKonfis.length > 0 && (
              <IonButton onClick={handleAddParticipants} disabled={loading}>
                <IonIcon icon={checkmarkOutline} slot="icon-only" />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">

          {/* Suche & Filter - iOS26 Pattern */}
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={filterOutline} />
              </div>
              <IonLabel>Suche & Filter</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList style={{ background: 'transparent' }}>
                  {/* Suchfeld */}
                  <IonItem lines={eventJahrgaenge.length !== 1 || (eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0) ? 'full' : 'none'} style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Person suchen</IonLabel>
                    <IonInput
                      value={searchTerm}
                      onIonInput={(e) => setSearchTerm(e.detail.value!)}
                      placeholder="Name eingeben..."
                      clearInput={true}
                    />
                  </IonItem>
                  {/* Jahrgang Filter - nur wenn Event mehrere Jahrgänge hat oder gar keine */}
                  {(eventJahrgaenge.length !== 1) && (
                    <IonItem lines={eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 ? 'full' : 'none'} style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Jahrgang</IonLabel>
                      <IonSelect
                        value={selectedJahrgang}
                        onIonChange={(e) => setSelectedJahrgang(e.detail.value!)}
                        placeholder="Jahrgang wählen"
                        interface="popover"
                      >
                        {hasEventJahrgaenge ? (
                          <>
                            <IonSelectOption value="alle">Alle Event-Jahrgänge</IonSelectOption>
                            {eventJahrgaenge.map(jg => (
                              <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                            ))}
                          </>
                        ) : (
                          <>
                            <IonSelectOption value="alle">Alle Jahrgänge</IonSelectOption>
                            {availableJahrgaenge.map(jg => (
                              <IonSelectOption key={jg} value={jg}>{jg}</IonSelectOption>
                            ))}
                          </>
                        )}
                      </IonSelect>
                    </IonItem>
                  )}
                  {/* Zeitslot Auswahl */}
                  {eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 && (
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel position="stacked">Zeitslot</IonLabel>
                      <IonSelect
                        value={selectedTimeslot}
                        onIonChange={(e) => setSelectedTimeslot(e.detail.value)}
                        placeholder="Zeitslot wählen"
                        interface="popover"
                      >
                        <IonSelectOption value={null}>Zeitslot wählen...</IonSelectOption>
                        {eventData.timeslots.map((timeslot) => {
                          const isFull = timeslot.max_participants > 0 && (timeslot.registered_count || 0) >= timeslot.max_participants;
                          const capacityText = timeslot.max_participants === 0
                            ? `(${timeslot.registered_count || 0})`
                            : `(${timeslot.registered_count || 0}/${timeslot.max_participants})`;
                          return (
                            <IonSelectOption
                              key={timeslot.id}
                              value={timeslot.id}
                            >
                              {formatTime(timeslot.start_time)} - {formatTime(timeslot.end_time)} {capacityText}
                              {isFull && ' - Voll'}
                            </IonSelectOption>
                          );
                        })}
                      </IonSelect>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>

          {/* Personen Liste - iOS26 Pattern */}
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={personAdd} />
              </div>
              <IonLabel>Personen ({filteredKonfis.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
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
                        <div
                          key={konfi.id}
                          className={`app-list-item app-list-item--events ${isSelected ? 'app-list-item--selected' : ''}`}
                          onClick={() => handleKonfiSelection(konfi.id)}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div className="app-icon-circle app-icon-circle--events">
                              <IonIcon icon={person} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
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
                              '--checkmark-color': 'white'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ParticipantManagementModal;