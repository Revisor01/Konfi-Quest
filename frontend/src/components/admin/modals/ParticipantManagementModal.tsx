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
  IonItemOption
} from '@ionic/react';
import { close, person, people, trash, add } from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';

interface Konfi {
  id: number;
  name: string;
  jahrgang_name?: string;
}

interface Participant {
  id: number;
  participant_name: string;
  jahrgang_name?: string;
  created_at: string;
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

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    loadAvailableKonfis();
  }, []);

  const loadAvailableKonfis = async () => {
    try {
      const response = await api.get('/admin/konfis');
      const allKonfis = response.data;
      
      // Filter out already registered participants
      const participantIds = participants.map(p => p.id);
      const available = allKonfis.filter((konfi: Konfi) => !participantIds.includes(konfi.id));
      
      setAvailableKonfis(available);
    } catch (error) {
      setError('Fehler beim Laden der Konfis');
    }
  };

  const filteredKonfis = availableKonfis.filter(konfi =>
    konfi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (konfi.jahrgang_name && konfi.jahrgang_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleKonfiSelection = (konfiId: number) => {
    setSelectedKonfis(prev => 
      prev.includes(konfiId) 
        ? prev.filter(id => id !== konfiId)
        : [...prev, konfiId]
    );
  };

  const handleAddParticipants = async () => {
    if (selectedKonfis.length === 0) return;
    
    setLoading(true);
    try {
      // Add each selected konfi as participant
      for (const konfiId of selectedKonfis) {
        await api.post(`/admin/events/${eventId}/participants`, {
          user_id: konfiId,
          status: 'confirmed'
        });
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
      await api.delete(`/admin/events/${eventId}/participants/${participantId}`);
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
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        {/* Current Participants */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={people} style={{ marginRight: '8px', color: '#eb445a' }} />
              Aktuelle Teilnehmer ({participants.length})
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
                        backgroundColor: '#eb445a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IonIcon 
                          icon={person} 
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
                          Angemeldet am {new Date(participant.created_at).toLocaleDateString('de-DE')}
                        </p>
                      </IonLabel>
                    </IonItem>
                    <IonItemOptions side="end">
                      <IonItemOption 
                        color="danger" 
                        onClick={() => handleRemoveParticipant(participant.id)}
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

            {selectedKonfis.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <IonButton 
                  expand="block" 
                  color="primary"
                  onClick={handleAddParticipants}
                  disabled={loading}
                >
                  {selectedKonfis.length} Teilnehmer hinzufügen
                </IonButton>
              </div>
            )}

            <IonList>
              {filteredKonfis.length === 0 ? (
                <IonItem lines="none">
                  <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                    <p>Keine verfügbaren Konfis gefunden</p>
                  </IonLabel>
                </IonItem>
              ) : (
                filteredKonfis.map((konfi) => (
                  <IonItem 
                    key={konfi.id} 
                    button 
                    onClick={() => handleKonfiSelection(konfi.id)}
                  >
                    <IonCheckbox
                      slot="start"
                      checked={selectedKonfis.includes(konfi.id)}
                      onIonChange={() => handleKonfiSelection(konfi.id)}
                    />
                    <IonAvatar slot="start" style={{ 
                      width: '32px', 
                      height: '32px',
                      backgroundColor: '#007aff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '12px'
                    }}>
                      <IonIcon 
                        icon={person} 
                        style={{ 
                          fontSize: '1rem', 
                          color: 'white'
                        }} 
                      />
                    </IonAvatar>
                    <IonLabel>
                      <h3>{konfi.name}</h3>
                      {konfi.jahrgang_name && (
                        <p>
                          <IonChip color="medium" style={{ fontSize: '0.8rem' }}>
                            {konfi.jahrgang_name}
                          </IonChip>
                        </p>
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