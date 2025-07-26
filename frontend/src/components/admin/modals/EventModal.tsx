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
  IonList,
  IonToggle,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItemDivider,
  IonModal,
  IonDatetimeButton
} from '@ionic/react';
import { checkmarkOutline, closeOutline, add, trash } from 'ionicons/icons';
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
  category?: string;
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  has_timeslots?: boolean;
}

interface Timeslot {
  id?: number;
  start_time: string;
  end_time: string;
  max_participants: number;
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
    event_end_time: '',
    location: '',
    points: 0,
    category: '',
    type: 'event',
    max_participants: 20,
    registration_opens_at: '',
    registration_closes_at: '',
    has_timeslots: false,
    is_series: false,
    series_count: 1,
    series_interval: 'week'
  });

  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);


  useEffect(() => {
    loadCategories();
    if (event) {
      setFormData({
        name: event.name,
        description: event.description || '',
        event_date: event.event_date,
        event_end_time: event.event_end_time || '',
        location: event.location || '',
        points: event.points,
        category: event.category || '',
        type: event.type,
        max_participants: event.max_participants,
        registration_opens_at: event.registration_opens_at || '',
        registration_closes_at: event.registration_closes_at || '',
        has_timeslots: event.has_timeslots || false,
        is_series: false,
        series_count: 1,
        series_interval: 'week'
      });
      // Load timeslots if editing existing event
      if (event.has_timeslots) {
        loadTimeslots(event.id);
      }
    } else {
      // Reset form for new event
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      setFormData({
        name: '',
        description: '',
        event_date: tomorrow.toISOString(),
        event_end_time: '',
        location: '',
        points: 0,
        category: '',
        type: 'event',
        max_participants: 20,
        registration_opens_at: now.toISOString(),
        registration_closes_at: nextWeek.toISOString(),
        has_timeslots: false,
        is_series: false,
        series_count: 1,
        series_interval: 'week'
      });
      setTimeslots([]);
    }
  }, [event]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/admin/categories');
      console.log('Categories response:', response.data);
      // Events können alle Kategorien verwenden, da es keine separaten Event-Kategorien gibt
      const filteredCategories = response.data;
      console.log('Filtered categories:', filteredCategories);
      setCategories(filteredCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadTimeslots = async (eventId: number) => {
    try {
      const response = await api.get(`/events/${eventId}/timeslots`);
      setTimeslots(response.data);
    } catch (error) {
      console.error('Error loading timeslots:', error);
    }
  };

  const addTimeslot = () => {
    const eventDate = new Date(formData.event_date);
    const startTime = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour after event
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    setTimeslots([...timeslots, {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      max_participants: Math.floor(formData.max_participants / 2)
    }]);
  };

  const removeTimeslot = (index: number) => {
    setTimeslots(timeslots.filter((_, i) => i !== index));
  };

  const updateTimeslot = (index: number, field: keyof Timeslot, value: any) => {
    const updated = [...timeslots];
    updated[index] = { ...updated[index], [field]: value };
    setTimeslots(updated);
  };


  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.event_date) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        event_date: formData.event_date,
        event_end_time: formData.event_end_time || null,
        location: formData.location.trim() || null,
        points: formData.points,
        category: formData.category.trim() || null,
        type: formData.type,
        max_participants: formData.max_participants,
        registration_opens_at: formData.registration_opens_at || null,
        registration_closes_at: formData.registration_closes_at || null,
        has_timeslots: formData.has_timeslots,
        timeslots: formData.has_timeslots ? timeslots : [],
        is_series: formData.is_series,
        series_count: formData.is_series ? formData.series_count : undefined,
        series_interval: formData.is_series ? formData.series_interval : undefined
      };

      if (event) {
        // Remove series fields for existing event updates
        const { is_series, series_count, series_interval, ...updatePayload } = payload;
        await api.put(`/events/${event.id}`, updatePayload);
        setSuccess('Event aktualisiert');
      } else {
        if (formData.is_series) {
          await api.post('/events/series', payload);
          setSuccess(`Event-Serie mit ${formData.series_count} Events erstellt`);
        } else {
          await api.post('/events', payload);
          setSuccess('Event erstellt');
        }
      }
      
      onSuccess();
      handleClose();
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
            <IonButton 
              onClick={handleSubmit} 
              disabled={!isFormValid || loading}
              color="primary"
              style={{
                '--background': '#eb445a',
                '--background-hover': '#d73847',
                '--color': 'white',
                '--border-radius': '8px'
              }}
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

          <IonItem style={{ marginBottom: '16px' }}>
            <IonLabel position="stacked">Event Datum & Uhrzeit *</IonLabel>
            <IonDatetimeButton datetime="event-date-picker" />
          </IonItem>

          <IonItem style={{ marginBottom: '16px' }}>
            <IonLabel position="stacked">Endzeit (optional)</IonLabel>
            <IonDatetimeButton datetime="end-time-picker" />
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
            <IonInput
              type="text"
              inputMode="numeric"
              value={formData.points.toString()}
              onIonInput={(e) => {
                const value = e.detail.value!;
                if (value === '') {
                  setFormData({ ...formData, points: 0 });
                } else {
                  const num = parseInt(value);
                  if (!isNaN(num) && num >= 0) {
                    setFormData({ ...formData, points: num });
                  }
                }
              }}
              placeholder="z.B. 5"
              disabled={loading}
              clearInput={true}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Max. Teilnehmer *</IonLabel>
            <IonInput
              type="text"
              inputMode="numeric"
              value={formData.max_participants.toString()}
              onIonInput={(e) => {
                const value = e.detail.value!;
                // Allow empty string for editing, otherwise parse number
                if (value === '') {
                  setFormData({ ...formData, max_participants: 0 });
                } else {
                  const num = parseInt(value);
                  if (!isNaN(num) && num >= 0) {
                    setFormData({ ...formData, max_participants: num });
                  }
                }
              }}
              placeholder="z.B. 20"
              disabled={loading}
              clearInput={true}
            />
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

          <IonItem style={{ marginBottom: '16px' }}>
            <IonLabel position="stacked">Anmeldung ab</IonLabel>
            <IonDatetimeButton datetime="registration-opens-picker" />
          </IonItem>

          <IonItem style={{ marginBottom: '16px' }}>
            <IonLabel position="stacked">Anmeldeschluss</IonLabel>
            <IonDatetimeButton datetime="registration-closes-picker" />
          </IonItem>

          <IonItemDivider>
            <IonLabel>Zeitfenster (optional)</IonLabel>
          </IonItemDivider>

          <IonItem>
            <IonLabel>Zeitfenster aktivieren</IonLabel>
            <IonToggle
              checked={formData.has_timeslots}
              onIonChange={(e) => {
                const hasTimeslots = e.detail.checked;
                setFormData({ ...formData, has_timeslots: hasTimeslots });
                if (!hasTimeslots) {
                  setTimeslots([]);
                }
              }}
              disabled={loading}
            />
          </IonItem>

          {formData.has_timeslots && (
            <>
              <IonItem lines="none" style={{ padding: '8px 16px' }}>
                <IonButton 
                  fill="outline" 
                  onClick={addTimeslot} 
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  <IonIcon icon={add} slot="start" />
                  Zeitfenster hinzufügen
                </IonButton>
              </IonItem>

              {timeslots.map((timeslot, index) => (
                <IonCard key={index} style={{ margin: '8px 16px' }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Zeitfenster {index + 1}
                      <IonButton
                        fill="clear"
                        color="danger"
                        onClick={() => removeTimeslot(index)}
                        disabled={loading}
                      >
                        <IonIcon icon={trash} />
                      </IonButton>
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem lines="none">
                      <IonLabel position="stacked">Startzeit (HH:MM)</IonLabel>
                      <IonInput
                        type="time"
                        value={timeslot.start_time ? new Date(timeslot.start_time).toTimeString().slice(0, 5) : ''}
                        onIonInput={(e) => {
                          const timeValue = e.detail.value!;
                          if (timeValue) {
                            // Convert HH:MM to full datetime for current date
                            const [hours, minutes] = timeValue.split(':');
                            const currentDate = new Date();
                            currentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            updateTimeslot(index, 'start_time', currentDate.toISOString());
                          }
                        }}
                        placeholder="z.B. 10:00"
                        disabled={loading}
                      />
                    </IonItem>
                    <IonItem lines="none">
                      <IonLabel position="stacked">Endzeit (HH:MM)</IonLabel>
                      <IonInput
                        type="time"
                        value={timeslot.end_time ? new Date(timeslot.end_time).toTimeString().slice(0, 5) : ''}
                        onIonInput={(e) => {
                          const timeValue = e.detail.value!;
                          if (timeValue) {
                            // Convert HH:MM to full datetime for current date
                            const [hours, minutes] = timeValue.split(':');
                            const currentDate = new Date();
                            currentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            updateTimeslot(index, 'end_time', currentDate.toISOString());
                          }
                        }}
                        placeholder="z.B. 11:00"
                        disabled={loading}
                      />
                    </IonItem>
                    <IonItem lines="none">
                      <IonLabel position="stacked">Max. Teilnehmer</IonLabel>
                      <IonInput
                        type="text"
                        inputMode="numeric"
                        value={timeslot.max_participants.toString()}
                        onIonInput={(e) => {
                          const value = e.detail.value!;
                          if (value === '') {
                            updateTimeslot(index, 'max_participants', 0);
                          } else {
                            const num = parseInt(value);
                            if (!isNaN(num) && num >= 0) {
                              updateTimeslot(index, 'max_participants', num);
                            }
                          }
                        }}
                        placeholder="z.B. 10"
                        disabled={loading}
                        clearInput={true}
                      />
                    </IonItem>
                  </IonCardContent>
                </IonCard>
              ))}
            </>
          )}

          {!event && (
            <>
              <IonItemDivider>
                <IonLabel>Wiederkehrende Events (optional)</IonLabel>
              </IonItemDivider>

              <IonItem>
                <IonLabel>Event-Serie erstellen</IonLabel>
                <IonToggle
                  checked={formData.is_series}
                  onIonChange={(e) => {
                    const isSeries = e.detail.checked;
                    setFormData({ ...formData, is_series: isSeries });
                  }}
                  disabled={loading}
                />
              </IonItem>

              {formData.is_series && (
                <>
                  <IonItem>
                    <IonLabel position="stacked">Anzahl Wiederholungen</IonLabel>
                    <IonInput
                      type="text"
                      inputMode="numeric"
                      value={formData.series_count.toString()}
                      onIonInput={(e) => {
                        const value = e.detail.value!;
                        if (value === '') {
                          setFormData({ ...formData, series_count: 1 });
                        } else {
                          const num = parseInt(value);
                          if (!isNaN(num) && num >= 1 && num <= 52) {
                            setFormData({ ...formData, series_count: num });
                          }
                        }
                      }}
                      placeholder="z.B. 4"
                      disabled={loading}
                      clearInput={true}
                    />
                  </IonItem>

                  <IonItem>
                    <IonLabel position="stacked">Wiederholung</IonLabel>
                    <IonSelect
                      value={formData.series_interval}
                      onIonChange={(e) => setFormData({ ...formData, series_interval: e.detail.value })}
                      interface="action-sheet"
                      disabled={loading}
                    >
                      <IonSelectOption value="week">Wöchentlich</IonSelectOption>
                      <IonSelectOption value="month">Monatlich</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                </>
              )}
            </>
          )}
        </IonList>
      </IonContent>

      {/* DateTime Modals */}
      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="event-date-picker"
          value={formData.event_date}
          onIonChange={(e) => setFormData({ ...formData, event_date: e.detail.value as string })}
          presentation="date-time"
          preferWheel={true}
          style={{
            '--background': '#f8f9fa',
            '--border-radius': '12px',
            '--box-shadow': '0 4px 16px rgba(0,0,0,0.1)'
          }}
        />
      </IonModal>


      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="end-time-picker"
          value={formData.event_end_time}
          onIonChange={(e) => setFormData({ ...formData, event_end_time: e.detail.value as string })}
          presentation="time"
          preferWheel={true}
          style={{
            '--background': '#f8f9fa',
            '--border-radius': '12px',
            '--box-shadow': '0 4px 16px rgba(0,0,0,0.1)'
          }}
        />
      </IonModal>

      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="registration-opens-picker"
          value={formData.registration_opens_at}
          onIonChange={(e) => setFormData({ ...formData, registration_opens_at: e.detail.value as string })}
          presentation="date-time"
          preferWheel={true}
          style={{
            '--background': '#f8f9fa',
            '--border-radius': '12px',
            '--box-shadow': '0 4px 16px rgba(0,0,0,0.1)'
          }}
        />
      </IonModal>

      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="registration-closes-picker"
          value={formData.registration_closes_at}
          onIonChange={(e) => setFormData({ ...formData, registration_closes_at: e.detail.value as string })}
          presentation="date-time"
          preferWheel={true}
          style={{
            '--background': '#f8f9fa',
            '--border-radius': '12px',
            '--box-shadow': '0 4px 16px rgba(0,0,0,0.1)'
          }}
        />
      </IonModal>
    </IonPage>
  );
};

export default EventModal;