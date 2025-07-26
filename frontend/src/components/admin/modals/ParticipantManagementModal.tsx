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
            <IonButton 
              onClick={handleClose}
              style={{
                '--background': '#f8f9fa',
                '--background-hover': '#e9ecef',
                '--color': '#6c757d',
                '--border-radius': '8px'
              }}
            >
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent>
        {/* Add New Participants */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <IonIcon icon={add} style={{ marginRight: '8px', color: '#eb445a' }} />
                Teilnehmer hinzufügen
              </span>
              {selectedKonfis.length > 0 && (
                <IonButton 
                  size="small"
                  color="success"
                  onClick={handleAddParticipants}
                  disabled={loading}
                  style={{
                    '--background': '#28a745',
                    '--background-hover': '#218838',
                    '--color': 'white'
                  }}
                >
                  <IonIcon icon={checkmark} style={{ marginRight: '4px' }} />
                  {selectedKonfis.length} hinzufügen
                </IonButton>
              )}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '16px' }}>
            <IonSearchbar
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Konfi suchen..."
              style={{ '--background': '#f8f9fa', marginBottom: '16px' }}
            />

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