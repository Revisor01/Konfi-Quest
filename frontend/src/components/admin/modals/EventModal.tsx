import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonDatetime,
  IonIcon,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonList
} from '@ionic/react';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

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
}

interface Category {
  id: number;
  name: string;
  description?: string;
  type: 'activity' | 'event' | 'both';
}

interface EventModalProps {
  event?: Event | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const EventModal: React.FC<EventModalProps> = ({
  event,
  onClose,
  onSuccess,
  dismiss
}) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event_date: new Date().toISOString(),
    location: '',
    location_maps_url: '',
    points: 0,
    category: '',
    type: 'event',
    max_participants: 20,
    registration_opens_at: '',
    registration_closes_at: ''
  });


  useEffect(() => {
    loadCategories();
    if (event) {
      setFormData({
        name: event.name,
        description: event.description || '',
        event_date: event.event_date,
        location: event.location || '',
        location_maps_url: event.location_maps_url || '',
        points: event.points,
        category: event.category || '',
        type: event.type,
        max_participants: event.max_participants,
        registration_opens_at: event.registration_opens_at || '',
        registration_closes_at: event.registration_closes_at || ''
      });
    } else {
      // Reset form for new event
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      setFormData({
        name: '',
        description: '',
        event_date: tomorrow.toISOString(),
        location: '',
        location_maps_url: '',
        points: 0,
        category: '',
        type: 'event',
        max_participants: 20,
        registration_opens_at: now.toISOString(),
        registration_closes_at: nextWeek.toISOString()
      });
    }
  }, [event]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      const filteredCategories = response.data.filter(
        (cat: Category) => cat.type === 'event' || cat.type === 'both'
      );
      setCategories(filteredCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };


  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.event_date) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        event_date: formData.event_date,
        location: formData.location.trim() || null,
        location_maps_url: formData.location_maps_url.trim() || null,
        points: formData.points,
        category: formData.category.trim() || null,
        type: formData.type,
        max_participants: formData.max_participants,
        registration_opens_at: formData.registration_opens_at || null,
        registration_closes_at: formData.registration_closes_at || null
      };

      if (event) {
        await api.put(`/events/${event.id}`, payload);
        setSuccess('Event aktualisiert');
      } else {
        await api.post('/events', payload);
        setSuccess('Event erstellt');
      }
      
      onSuccess();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern des Events');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.name.trim().length > 0 && formData.event_date;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {event ? 'Event bearbeiten' : 'Neues Event'}
          </IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton 
              onClick={handleSubmit} 
              disabled={!isFormValid || loading}
              color="primary"
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonList style={{ padding: '0' }}>
          <IonItem>
            <IonLabel position="stacked">Event Name *</IonLabel>
            <IonInput
              value={formData.name}
              onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
              placeholder="z.B. Konfirmandenausflug"
              disabled={loading}
              clearInput={true}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Beschreibung</IonLabel>
            <IonTextarea
              value={formData.description}
              onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
              placeholder="Beschreibung des Events..."
              rows={3}
              disabled={loading}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Event Datum & Uhrzeit *</IonLabel>
            <IonDatetime
              value={formData.event_date}
              onIonChange={(e) => setFormData({ ...formData, event_date: e.detail.value as string })}
              presentation="date-time"
              preferWheel={true}
              showDefaultButtons={true}
              showClearButton={false}
              disabled={loading}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Ort</IonLabel>
            <IonInput
              value={formData.location}
              onIonInput={(e) => setFormData({ ...formData, location: e.detail.value! })}
              placeholder="z.B. Gemeindehaus"
              disabled={loading}
              clearInput={true}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Punkte</IonLabel>
            <IonSelect
              value={formData.points}
              onIonChange={(e) => setFormData({ ...formData, points: e.detail.value })}
              placeholder="Punkte wählen"
              disabled={loading}
              interface="action-sheet"
              interfaceOptions={{
                header: 'Punkte auswählen'
              }}
            >
              <IonSelectOption value={0}>Keine Punkte</IonSelectOption>
              <IonSelectOption value={1}>1 Punkt</IonSelectOption>
              <IonSelectOption value={2}>2 Punkte</IonSelectOption>
              <IonSelectOption value={3}>3 Punkte</IonSelectOption>
              <IonSelectOption value={5}>5 Punkte</IonSelectOption>
              <IonSelectOption value={10}>10 Punkte</IonSelectOption>
              <IonSelectOption value={15}>15 Punkte</IonSelectOption>
              <IonSelectOption value={20}>20 Punkte</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Max. Teilnehmer *</IonLabel>
            <IonSelect
              value={formData.max_participants}
              onIonChange={(e) => setFormData({ ...formData, max_participants: e.detail.value })}
              placeholder="Max. Teilnehmer"
              disabled={loading}
              interface="action-sheet"
              interfaceOptions={{
                header: 'Max. Teilnehmer auswählen'
              }}
            >
              <IonSelectOption value={5}>5 Teilnehmer</IonSelectOption>
              <IonSelectOption value={10}>10 Teilnehmer</IonSelectOption>
              <IonSelectOption value={15}>15 Teilnehmer</IonSelectOption>
              <IonSelectOption value={20}>20 Teilnehmer</IonSelectOption>
              <IonSelectOption value={25}>25 Teilnehmer</IonSelectOption>
              <IonSelectOption value={30}>30 Teilnehmer</IonSelectOption>
              <IonSelectOption value={40}>40 Teilnehmer</IonSelectOption>
              <IonSelectOption value={50}>50 Teilnehmer</IonSelectOption>
              <IonSelectOption value={100}>100 Teilnehmer</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Kategorie</IonLabel>
            <IonSelect
              value={formData.category}
              onIonChange={(e) => setFormData({ ...formData, category: e.detail.value })}
              placeholder="Kategorie wählen"
              disabled={loading}
              interface="action-sheet"
              interfaceOptions={{
                header: 'Kategorie auswählen'
              }}
            >
              <IonSelectOption value="">Keine Kategorie</IonSelectOption>
              {categories.map((category) => (
                <IonSelectOption key={category.id} value={category.name}>
                  {category.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Anmeldung ab</IonLabel>
            <IonDatetime
              value={formData.registration_opens_at}
              onIonChange={(e) => setFormData({ ...formData, registration_opens_at: e.detail.value as string })}
              presentation="date-time"
              preferWheel={true}
              showDefaultButtons={true}
              showClearButton={true}
              disabled={loading}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Anmeldeschluss</IonLabel>
            <IonDatetime
              value={formData.registration_closes_at}
              onIonChange={(e) => setFormData({ ...formData, registration_closes_at: e.detail.value as string })}
              presentation="date-time"
              preferWheel={true}
              showDefaultButtons={true}
              showClearButton={true}
              disabled={loading}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default EventModal;