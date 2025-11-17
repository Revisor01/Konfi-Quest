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
  IonDatetimeButton,
  IonCheckbox
} from '@ionic/react';
import { checkmarkOutline, closeOutline, add, trash, create, calendar, people, time, location } from 'ionicons/icons';
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
  point_type?: 'gottesdienst' | 'gemeinde';
  category?: string;
  categories?: Category[];
  jahrgaenge?: Jahrgang[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  has_timeslots?: boolean;
}

interface Jahrgang {
  id: number;
  name: string;
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
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);

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
    point_type: 'gemeinde' as 'gottesdienst' | 'gemeinde',
    category_ids: [] as number[],
    jahrgang_ids: [] as number[],
    type: 'event',
    max_participants: 5,
    registration_opens_at: '',
    registration_closes_at: '',
    has_timeslots: false,
    waitlist_enabled: true,
    max_waitlist_size: 3,
    is_series: false,
    series_count: 1,
    series_interval: 'week'
  });

  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    loadCategories();
    loadJahrgaenge();
    if (event) {
      // Helper function to convert UTC timestamps to local ISO strings for IonDatetime
      const utcToLocalISO = (utcString: string) => {
        if (!utcString) return '';
        const date = new Date(utcString);
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };
      
      setFormData({
        name: event.name,
        description: event.description || '',
        event_date: utcToLocalISO(event.event_date),
        event_end_time: utcToLocalISO(event.event_end_time || ''),
        location: event.location || '',
        points: event.points,
        point_type: event.point_type || 'gemeinde',
        category_ids: event.categories?.map(c => c.id) || [],
        jahrgang_ids: event.jahrgaenge?.map(j => j.id) || [],
        type: event.type,
        max_participants: event.max_participants,
        registration_opens_at: utcToLocalISO(event.registration_opens_at || ''),
        registration_closes_at: utcToLocalISO(event.registration_closes_at || ''),
        has_timeslots: event.has_timeslots || false,
        waitlist_enabled: (event as any).waitlist_enabled !== undefined ? (event as any).waitlist_enabled : true,
        max_waitlist_size: (event as any).max_waitlist_size || 3,
        is_series: (event as any).is_series || false,
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
      
      // Helper function to round time to nearest 30 minutes
      const roundToHalfHour = (date: Date) => {
        const rounded = new Date(date);
        const minutes = rounded.getMinutes();
        if (minutes < 30) {
          rounded.setMinutes(0, 0, 0); // Round down to full hour
        } else {
          rounded.setMinutes(30, 0, 0); // Round up to half hour
        }
        return rounded;
      };
      
      // Create event starting now (current time + 30 minutes buffer), rounded
      const eventStart = new Date();
      eventStart.setMinutes(eventStart.getMinutes() + 30); // 30 minutes from now
      const roundedEventStart = roundToHalfHour(eventStart);
      
      // Event ends 2 hours after start
      const eventEnd = new Date(roundedEventStart);
      eventEnd.setHours(eventEnd.getHours() + 2);
      
      // Registration opens now (current time), rounded
      const regOpens = roundToHalfHour(new Date());
      
      // Registration closes 1 hour before event
      const regCloses = new Date(roundedEventStart);
      regCloses.setHours(regCloses.getHours() - 1);
      
      // Helper function to create local ISO string for IonDatetime
      // Lokale Zeit ohne Zeitzonen-Suffix - IonDatetime interpretiert das als lokale Zeit
      const toIonDatetimeISO = (date: Date) => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };
      
      setFormData({
        name: '',
        description: '',
        event_date: toIonDatetimeISO(roundedEventStart),
        event_end_time: toIonDatetimeISO(eventEnd),
        location: '',
        points: 0,
        point_type: 'gemeinde',
        category_ids: [],
        jahrgang_ids: [],
        type: 'event',
        max_participants: 5,
        registration_opens_at: toIonDatetimeISO(regOpens),
        registration_closes_at: toIonDatetimeISO(regCloses),
        has_timeslots: false,
        waitlist_enabled: true,
        max_waitlist_size: 3,
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
      // Use all categories for events - no filtering needed
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadJahrgaenge = async () => {
    try {
      const response = await api.get('/admin/jahrgaenge');
      console.log('Jahrgaenge response:', response.data);
      setJahrgaenge(response.data);
    } catch (error) {
      console.error('Error loading jahrgaenge:', error);
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
    let startTime: Date;
    let participants: number;
    
    if (timeslots.length === 0) {
      // Erstes Zeitfenster: beginnt zur Event-Startzeit
      startTime = new Date(eventDate);
      // Standard-Teilnehmerzahl für erstes Zeitfenster
      participants = Math.max(1, Math.floor(formData.max_participants / 2));
    } else {
      // Weitere Zeitfenster: beginnen am Ende des vorherigen
      const lastTimeslot = timeslots[timeslots.length - 1];
      startTime = new Date(lastTimeslot.end_time);
      // Übernehme Teilnehmerzahl vom ersten Zeitfenster
      participants = timeslots[0].max_participants;
    }
    
    // Endzeit: 1 Stunde nach Start
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // Helper function für konsistente ISO-Strings
    const toIonDatetimeISO = (date: Date) => {
      const pad = (num: number) => num.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
    };
    
    setTimeslots([...timeslots, {
      start_time: toIonDatetimeISO(startTime),
      end_time: toIonDatetimeISO(endTime),
      max_participants: participants
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
      // Helper function to convert local time string to ISO with timezone
      const toBackendTimestamp = (localTimeString: string) => {
        if (!localTimeString) return null;
        // Parse the local time string and convert to ISO with timezone
        const date = new Date(localTimeString);
        return date.toISOString();
      };

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        event_date: toBackendTimestamp(formData.event_date),
        event_end_time: toBackendTimestamp(formData.event_end_time),
        location: formData.location.trim() || null,
        points: formData.points,
        point_type: formData.point_type,
        category_ids: formData.category_ids,
        jahrgang_ids: formData.jahrgang_ids,
        type: formData.type,
        max_participants: formData.max_participants,
        registration_opens_at: toBackendTimestamp(formData.registration_opens_at),
        registration_closes_at: toBackendTimestamp(formData.registration_closes_at),
        has_timeslots: formData.has_timeslots,
        waitlist_enabled: formData.waitlist_enabled,
        max_waitlist_size: formData.max_waitlist_size,
        timeslots: formData.has_timeslots ? timeslots.map(ts => ({
          ...ts,
          start_time: toBackendTimestamp(ts.start_time),
          end_time: toBackendTimestamp(ts.end_time)
        })) : [],
        is_series: formData.is_series,
        series_count: formData.is_series ? formData.series_count : undefined,
        series_interval: formData.is_series ? formData.series_interval : undefined
      };

      if (event && event.id && event.id > 0) {
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

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* EVENT GRUNDDATEN */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '16px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#007aff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={create} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Event Grunddaten
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
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

              <IonItem lines="none">
                <IonLabel position="stacked">Ort</IonLabel>
                <IonInput
                  value={formData.location}
                  onIonInput={(e) => setFormData({ ...formData, location: e.detail.value! })}
                  placeholder="z.B. Gemeindehaus"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* DATUM & ZEIT */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '24px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#28a745',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(40, 167, 69, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={calendar} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Datum & Zeit
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none" style={{ paddingBottom: '12px' }}>
                <IonLabel position="stacked">Event Datum & Uhrzeit *</IonLabel>
                <IonDatetimeButton datetime="event-date-picker" />
              </IonItem>

              <IonItem lines="none" style={{ paddingBottom: '12px' }}>
                <IonLabel position="stacked">Endzeit (optional)</IonLabel>
                <IonDatetimeButton datetime="end-time-picker" />
              </IonItem>

              <IonItem lines="none" style={{ paddingBottom: '12px' }}>
                <IonLabel position="stacked">Anmeldung ab</IonLabel>
                <IonDatetimeButton datetime="registration-opens-picker" />
              </IonItem>

              <IonItem lines="none">
                <IonLabel position="stacked">Anmeldeschluss</IonLabel>
                <IonDatetimeButton datetime="registration-closes-picker" />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* PUNKTE & TEILNEHMER */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '24px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#f39c12',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(243, 156, 18, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={people} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Punkte & Teilnehmer
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
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
                <IonLabel position="stacked">Punkte-Art</IonLabel>
                <IonSelect
                  value={formData.point_type}
                  onIonChange={(e) => setFormData({ ...formData, point_type: e.detail.value })}
                  placeholder="Art der Punkte wählen"
                  disabled={loading}
                  interface="action-sheet"
                  interfaceOptions={{
                    header: 'Punkte-Art auswählen'
                  }}
                >
                  <IonSelectOption value="gemeinde">Gemeindepunkte</IonSelectOption>
                  <IonSelectOption value="gottesdienst">Gottesdienstpunkte</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none">
                <IonLabel position="stacked">Max. Teilnehmer *</IonLabel>
                <IonInput
                  type="text"
                  inputMode="numeric"
                  value={formData.max_participants.toString()}
                  onIonInput={(e) => {
                    const value = e.detail.value!;
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
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* KATEGORIEN & ZIELGRUPPE */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '24px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#9b59b6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(155, 89, 182, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={people} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Kategorien & Zielgruppe
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
              {categories.length > 0 ? (
                <>
                  <IonItem lines="none" style={{ paddingBottom: '8px' }}>
                    <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>
                      Kategorien (mehrere möglich)
                      {formData.category_ids.length > 0 && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '0.8rem', 
                          color: '#007aff',
                          fontWeight: 'normal' 
                        }}>
                          ({formData.category_ids.length} ausgewählt)
                        </span>
                      )}
                    </IonLabel>
                  </IonItem>
                  {categories.map((category) => (
                    <IonItem 
                      key={category.id} 
                      lines="none"
                      button
                      onClick={() => {
                        if (!loading) {
                          setFormData(prev => ({
                            ...prev,
                            category_ids: prev.category_ids.includes(category.id)
                              ? prev.category_ids.filter(id => id !== category.id)
                              : [...prev.category_ids, category.id]
                          }));
                        }
                      }}
                      disabled={loading}
                    >
                      <IonCheckbox
                        slot="start"
                        checked={formData.category_ids.includes(category.id)}
                        disabled={loading}
                      />
                      <IonLabel style={{ marginLeft: '12px' }}>
                        {category.name}
                      </IonLabel>
                    </IonItem>
                  ))}
                </>
              ) : (
                <IonItem>
                  <IonLabel color="medium">
                    <p>Keine Kategorien verfügbar</p>
                  </IonLabel>
                </IonItem>
              )}

              <IonItem lines="none" style={{ paddingBottom: '8px', paddingTop: '16px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>
                  Jahrgänge (mehrere möglich) *
                  {formData.jahrgang_ids.length > 0 && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '0.8rem', 
                      color: '#007aff',
                      fontWeight: 'normal' 
                    }}>
                      ({formData.jahrgang_ids.length} ausgewählt)
                    </span>
                  )}
                </IonLabel>
              </IonItem>
              {jahrgaenge.map((jahrgang) => (
                <IonItem 
                  key={jahrgang.id} 
                  lines="none"
                  button
                  onClick={() => {
                    if (!loading) {
                      setFormData(prev => ({
                        ...prev,
                        jahrgang_ids: prev.jahrgang_ids.includes(jahrgang.id)
                          ? prev.jahrgang_ids.filter(id => id !== jahrgang.id)
                          : [...prev.jahrgang_ids, jahrgang.id]
                      }));
                    }
                  }}
                  disabled={loading}
                >
                  <IonCheckbox
                    slot="start"
                    checked={formData.jahrgang_ids.includes(jahrgang.id)}
                    disabled={loading}
                  />
                  <IonLabel style={{ marginLeft: '12px' }}>
                    {jahrgang.name}
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* ANMELDUNGEN & WARTELISTE */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '24px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#e74c3c',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={people} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Anmeldungen & Warteliste
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem>
                <IonLabel>Warteliste aktivieren</IonLabel>
                <IonToggle
                  checked={formData.waitlist_enabled}
                  onIonChange={(e) => {
                    setFormData({ ...formData, waitlist_enabled: e.detail.checked });
                  }}
                  disabled={loading}
                />
              </IonItem>

              {formData.waitlist_enabled && (
                <IonItem lines="none">
                  <IonLabel position="stacked">Max. Wartelisten-Plätze</IonLabel>
                  <IonInput
                    type="text"
                    inputMode="numeric"
                    value={formData.max_waitlist_size.toString()}
                    onIonInput={(e) => {
                      const value = e.detail.value!;
                      if (value === '') {
                        setFormData({ ...formData, max_waitlist_size: 0 });
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 0) {
                          setFormData({ ...formData, max_waitlist_size: num });
                        }
                      }
                    }}
                    placeholder="z.B. 10"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>
              )}

              {!formData.waitlist_enabled && (
                <IonItem lines="none" style={{ opacity: 0.6 }}>
                  <IonLabel color="medium">
                    <p>Warteliste deaktiviert</p>
                  </IonLabel>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* ZEITFENSTER */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          margin: '24px 16px 8px 16px'
        }}>
          <div style={{ 
            width: '32px', 
            height: '32px',
            backgroundColor: '#6c757d',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(108, 117, 125, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={time} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{ 
            fontWeight: '600', 
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Zeitfenster (optional)
          </h2>
        </div>
        
        <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
          <IonCardContent style={{ padding: '12px 0' }}>
            <IonList style={{ background: 'transparent' }}>
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
              )}

              {!formData.has_timeslots && (
                <IonItem lines="none" style={{ opacity: 0.6 }}>
                  <IonLabel color="medium">
                    <p>Zeitfenster deaktiviert</p>
                  </IonLabel>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* ZEITFENSTER DETAILS */}
        {formData.has_timeslots && timeslots.map((timeslot, index) => (
          <div key={index}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              margin: '24px 16px 8px 16px'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px',
                backgroundColor: '#6c757d',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}>
                  {index + 1}
                </span>
              </div>
              <h3 style={{ 
                fontWeight: '500', 
                fontSize: '1rem',
                margin: '0',
                color: '#333',
                flex: 1
              }}>
                Zeitfenster {index + 1}
              </h3>
              <IonButton
                fill="clear"
                color="danger"
                onClick={() => removeTimeslot(index)}
                disabled={loading}
                size="small"
              >
                <IonIcon icon={trash} />
              </IonButton>
            </div>
            
            <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
            <IonCardContent style={{ padding: '12px 0' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem>
                  <IonLabel position="stacked">Startzeit (HH:MM)</IonLabel>
                  <IonInput
                    type="time"
                    value={timeslot.start_time ? new Date(timeslot.start_time).toTimeString().slice(0, 5) : ''}
                    onIonInput={(e) => {
                      const timeValue = e.detail.value!;
                      if (timeValue) {
                        // Convert HH:MM to full datetime based on event date
                        const [hours, minutes] = timeValue.split(':');
                        const eventDate = new Date(formData.event_date);
                        eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                        
                        // Helper function für konsistente ISO-Strings
                        const toIonDatetimeISO = (date: Date) => {
                          const pad = (num: number) => num.toString().padStart(2, '0');
                          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
                        };
                        
                        updateTimeslot(index, 'start_time', toIonDatetimeISO(eventDate));
                      }
                    }}
                    placeholder="z.B. 10:00"
                    disabled={loading}
                    step="900"
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Endzeit (HH:MM)</IonLabel>
                  <IonInput
                    type="time"
                    value={timeslot.end_time ? new Date(timeslot.end_time).toTimeString().slice(0, 5) : ''}
                    onIonInput={(e) => {
                      const timeValue = e.detail.value!;
                      if (timeValue) {
                        // Convert HH:MM to full datetime based on event date
                        const [hours, minutes] = timeValue.split(':');
                        const eventDate = new Date(formData.event_date);
                        eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                        
                        // Helper function für konsistente ISO-Strings
                        const toIonDatetimeISO = (date: Date) => {
                          const pad = (num: number) => num.toString().padStart(2, '0');
                          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
                        };
                        
                        updateTimeslot(index, 'end_time', toIonDatetimeISO(eventDate));
                      }
                    }}
                    placeholder="z.B. 11:00"
                    disabled={loading}
                    step="900"
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
              </IonList>
            </IonCardContent>
          </IonCard>
          </div>
        ))}

        {/* EVENT-SERIE (nur für neue Events) */}
        {(!event?.id || event?.id === 0) && (
          <>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              margin: '24px 16px 8px 16px'
            }}>
              <div style={{ 
                width: '32px', 
                height: '32px',
                backgroundColor: '#17a2b8',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(23, 162, 184, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={time} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{ 
                fontWeight: '600', 
                fontSize: '1.1rem',
                margin: '0',
                color: '#333'
              }}>
                Event-Serie (optional)
              </h2>
            </div>
            
            <IonCard style={{ margin: '0 16px 48px 16px', borderRadius: '12px' }}>
              <IonCardContent style={{ padding: '12px 0' }}>
                <IonList style={{ background: 'transparent' }}>
                  {/* Serienoptionen nur bei neuen Events anzeigen (Serienkaskaden verhindern) */}
                  {!event && (
                    <>
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

                          <IonItem lines="none">
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

                      {!formData.is_series && (
                        <IonItem lines="none" style={{ opacity: 0.6 }}>
                          <IonLabel color="medium">
                            <p>Event-Serie deaktiviert</p>
                          </IonLabel>
                        </IonItem>
                      )}
                    </>
                  )}

                  {/* Hinweis bei bestehenden Events */}
                  {event && (
                    <IonItem lines="none" style={{ opacity: 0.7 }}>
                      <IonLabel color="medium">
                        <p>ℹ️ Serienoptionen sind bei bestehenden Events nicht verfügbar</p>
                      </IonLabel>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>

      {/* DateTime Modals */}
      <IonModal keepContentsMounted={true}>
        <IonDatetime
          id="event-date-picker"
          value={formData.event_date}
          onIonChange={(e) => {
            const selectedDate = e.detail.value as string;
            const eventDate = new Date(selectedDate);
            
            // Helper function to create local ISO string for IonDatetime
            // Lokale Zeit ohne Zeitzonen-Suffix - IonDatetime interpretiert das als lokale Zeit
            const toIonDatetimeISO = (date: Date) => {
              const pad = (num: number) => num.toString().padStart(2, '0');
              return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
            };
            
            // Automatically set end time to 1 hour later (keep same date)
            const endDate = new Date(eventDate);
            endDate.setHours(endDate.getHours() + 1);
            
            // Registration opens now at 9:00
            const regOpens = new Date();
            regOpens.setHours(9, 0, 0, 0);
            
            // Registration closes exactly 24 hours before event
            const regCloses = new Date(eventDate);
            regCloses.setHours(regCloses.getHours() - 24);
            
            setFormData({ 
              ...formData, 
              event_date: selectedDate,
              event_end_time: toIonDatetimeISO(endDate),
              registration_opens_at: toIonDatetimeISO(regOpens),
              registration_closes_at: toIonDatetimeISO(regCloses)
            });
          }}
          presentation="date-time"
          preferWheel={true}
          minuteValues="0,15,30,45"
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
          value={formData.event_end_time || formData.event_date}
          onIonChange={(e) => {
            const selectedDate = e.detail.value as string;
            setFormData({ ...formData, event_end_time: selectedDate });
          }}
          presentation="date-time"
          preferWheel={true}
          minuteValues="0,15,30,45"
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
          onIonChange={(e) => {
            const selectedDate = e.detail.value as string;
            setFormData({ ...formData, registration_opens_at: selectedDate });
          }}
          presentation="date-time"
          preferWheel={true}
          minuteValues="0,15,30,45"
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
          onIonChange={(e) => {
            const selectedDate = e.detail.value as string;
            setFormData({ ...formData, registration_closes_at: selectedDate });
          }}
          presentation="date-time"
          preferWheel={true}
          minuteValues="0,15,30,45"
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