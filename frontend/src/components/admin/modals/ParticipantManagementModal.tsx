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
  IonIcon,
  IonSearchbar,
  IonCheckbox,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonAvatar,
  IonChip,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSelect,
  IonSelectOption
} from '@ionic/react';
import { close, person, people, trash, add, checkmark } from 'ionicons/icons';
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
            <IonButton onClick={handleClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            {selectedKonfis.length > 0 && (
              <IonButton 
                onClick={handleAddParticipants}
                disabled={loading}
                color="primary"
              >
                <IonIcon icon={checkmark} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        {/* Add New Participants */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={add} style={{ marginRight: '8px', color: '#eb445a' }} />
              Teilnehmer hinzufügen
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '16px' }}>
            <IonSearchbar
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Konfi suchen..."
              style={{ '--background': '#f8f9fa', marginBottom: '16px' }}
            />

            {/* Timeslot Selection for events with timeslots */}
            {eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0 && (
              <IonItem style={{ marginBottom: '16px' }}>
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

            <IonList lines="none" style={{ background: 'transparent', padding: '8px 0' }}>
              {filteredKonfis.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                    Keine verfügbaren Konfis gefunden
                  </p>
                </div>
              ) : (
                filteredKonfis.map((konfi) => (
                  <IonItem
                    key={konfi.id}
                    button
                    onClick={() => handleKonfiSelection(konfi.id)}
                    detail={false}
                    style={{
                      '--min-height': '70px',
                      '--padding-start': '16px',
                      '--padding-top': '0px',
                      '--padding-bottom': '0px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px'
                    }}
                  >
                    <IonCheckbox
                      slot="start"
                      checked={selectedKonfis.includes(konfi.id)}
                      onIonChange={() => handleKonfiSelection(konfi.id)}
                      style={{ marginRight: '12px' }}
                    />
                    <IonLabel>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '4px'
                      }}>
                        {/* Person Icon */}
                        <div style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: '#007aff',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <IonIcon
                            icon={person}
                            style={{
                              fontSize: '0.9rem',
                              color: 'white'
                            }}
                          />
                        </div>

                        {/* Konfi Name */}
                        <h3 style={{
                          fontWeight: '600',
                          fontSize: '1rem',
                          margin: '0',
                          color: '#333',
                          lineHeight: '1.3'
                        }}>
                          {konfi.name}
                        </h3>
                      </div>

                      {/* Jahrgang */}
                      {konfi.jahrgang_name && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#666',
                          marginLeft: '40px'
                        }}>
                          {konfi.jahrgang_name}
                        </div>
                      )}
                    </IonLabel>
                  </IonItem>
                ))
              )}
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ParticipantManagementModal;