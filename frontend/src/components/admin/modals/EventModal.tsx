import React, { useState, useEffect, useRef } from 'react';
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
  IonListHeader,
  IonToggle,
  IonCard,
  IonCardContent,
  IonModal,
  IonDatetimeButton,
  useIonAlert
} from '@ionic/react';
import { checkmarkOutline, closeOutline, add, trash, create, calendar, people, time, location, copy, removeOutline, addOutline, shieldCheckmark, bagHandle, scanOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
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
  mandatory?: boolean;
  bring_items?: string;
  checkin_window?: number;
  teamer_needed?: boolean;
  teamer_only?: boolean;
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
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [presentAlert] = useIonAlert();

  const doClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    if (isDirty) {
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Verwerfen', role: 'destructive', handler: () => doClose() }
        ]
      });
    } else {
      doClose();
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
    series_interval: 'week',
    mandatory: false,
    bring_items: '',
    checkin_window: 30
  });

  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [teamerAccess, setTeamerAccess] = useState<'normal' | 'teamer_needed' | 'teamer_only'>('normal');
  const initializedRef = useRef(false);

  // isDirty nach Initialisierung bei jeder formData-Aenderung setzen
  useEffect(() => {
    if (initializedRef.current) {
      setIsDirty(true);
    }
  }, [formData]);

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
        series_interval: 'week',
        mandatory: (event as any).mandatory || false,
        bring_items: (event as any).bring_items || '',
        checkin_window: (event as any).checkin_window || 30
      });
      // Teamer-Zugang aus Event-Daten ableiten
      if ((event as any).teamer_only) {
        setTeamerAccess('teamer_only');
      } else if ((event as any).teamer_needed) {
        setTeamerAccess('teamer_needed');
      } else {
        setTeamerAccess('normal');
      }
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
        series_interval: 'week',
        mandatory: false,
        bring_items: '',
        checkin_window: 30
      });
      setTimeslots([]);
      setTeamerAccess('normal');
    }
    // Nach Initialisierung isDirty-Tracking aktivieren
    setTimeout(() => { initializedRef.current = true; }, 100);
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

    await guard(async () => {
    setLoading(true);
    try {
      // Helper function to convert local time string to ISO with timezone
      const toBackendTimestamp = (localTimeString: string) => {
        if (!localTimeString) return null;
        // Parse the local time string and convert to ISO with timezone
        const date = new Date(localTimeString);
        return date.toISOString();
      };

      const isTeamerOnly = teamerAccess === 'teamer_only';

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        event_date: toBackendTimestamp(formData.event_date),
        event_end_time: toBackendTimestamp(formData.event_end_time),
        location: formData.location.trim() || null,
        points: formData.mandatory ? 0 : formData.points,
        point_type: isTeamerOnly ? 'gemeinde' : formData.point_type,
        category_ids: formData.category_ids,
        jahrgang_ids: isTeamerOnly ? [] : formData.jahrgang_ids,
        type: formData.type,
        max_participants: (formData.mandatory || isTeamerOnly) ? 0 : formData.max_participants,
        registration_opens_at: formData.mandatory ? null : toBackendTimestamp(formData.registration_opens_at),
        registration_closes_at: formData.mandatory ? null : toBackendTimestamp(formData.registration_closes_at),
        has_timeslots: formData.mandatory ? false : formData.has_timeslots,
        waitlist_enabled: (formData.mandatory || isTeamerOnly) ? false : formData.waitlist_enabled,
        max_waitlist_size: (formData.mandatory || isTeamerOnly) ? 0 : formData.max_waitlist_size,
        timeslots: !formData.mandatory && formData.has_timeslots ? timeslots.map(ts => ({
          ...ts,
          start_time: toBackendTimestamp(ts.start_time),
          end_time: toBackendTimestamp(ts.end_time)
        })) : [],
        is_series: formData.is_series,
        series_count: formData.is_series ? formData.series_count : undefined,
        series_interval: formData.is_series ? formData.series_interval : undefined,
        mandatory: formData.mandatory,
        bring_items: formData.bring_items.trim() || null,
        checkin_window: formData.checkin_window,
        teamer_needed: teamerAccess === 'teamer_needed',
        teamer_only: teamerAccess === 'teamer_only'
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
      
      setIsDirty(false);
      onSuccess();
      doClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern des Events');
      }
    } finally {
      setLoading(false);
    }
    });
  };

  const isFormValid = formData.name.trim().length > 0 && formData.event_date && (teamerAccess === 'teamer_only' || !formData.mandatory || formData.jahrgang_ids.length > 0);

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
              className="app-modal-close-btn"
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSubmit}
              disabled={!isFormValid || loading || isSubmitting}
              className="app-modal-submit-btn app-modal-submit-btn--events"
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

      <IonContent className="app-gradient-background">
        {/* EVENT GRUNDDATEN */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={create} />
            </div>
            <IonLabel>Event Grunddaten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="inset">
                <IonLabel position="stacked">Event Name *</IonLabel>
                <IonInput
                  value={formData.name}
                  onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                  placeholder="z.B. Konfirmandenausflug"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>

              <IonItem lines="inset">
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
        </IonList>

        {/* PFLICHT-EVENT & WAS MITBRINGEN */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={shieldCheckmark} />
            </div>
            <IonLabel>Pflicht-Event</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="inset">
                <IonLabel>Pflicht-Event</IonLabel>
                <IonToggle
                  slot="end"
                  checked={formData.mandatory}
                  onIonChange={(e) => setFormData({ ...formData, mandatory: e.detail.checked })}
                  disabled={loading}
                />
              </IonItem>
              <IonItem lines="inset">
                <IonLabel position="stacked">Was mitbringen (optional)</IonLabel>
                <IonTextarea
                  value={formData.bring_items}
                  onIonInput={(e) => setFormData({ ...formData, bring_items: e.detail.value || '' })}
                  placeholder="z.B. Bibel, Stift, Block"
                  rows={2}
                  disabled={loading}
                />
              </IonItem>
              <IonItem lines="none">
                <IonSelect
                  label="Teamer-Zugang"
                  value={teamerAccess}
                  onIonChange={(e) => setTeamerAccess(e.detail.value)}
                  disabled={loading}
                >
                  <IonSelectOption value="normal">Nur Konfis</IonSelectOption>
                  <IonSelectOption value="teamer_needed">Teamer:innen gesucht</IonSelectOption>
                  <IonSelectOption value="teamer_only">Nur Teamer:innen</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* QR CHECK-IN FENSTER */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={scanOutline} />
            </div>
            <IonLabel>QR Check-in</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="none">
                <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Check-in-Fenster (Minuten)</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={loading || formData.checkin_window <= 5}
                    onClick={() => setFormData({ ...formData, checkin_window: Math.max(5, formData.checkin_window - 5) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={removeOutline} />
                  </IonButton>
                  <IonInput
                    type="text"
                    inputMode="numeric"
                    value={formData.checkin_window.toString()}
                    onIonInput={(e) => {
                      const value = e.detail.value!;
                      if (value === '') {
                        setFormData({ ...formData, checkin_window: 30 });
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 5 && num <= 120) {
                          setFormData({ ...formData, checkin_window: num });
                        }
                      }
                    }}
                    placeholder="30"
                    disabled={loading}
                    style={{ textAlign: 'center', flex: 1 }}
                  />
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={loading || formData.checkin_window >= 120}
                    onClick={() => setFormData({ ...formData, checkin_window: Math.min(120, formData.checkin_window + 5) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={addOutline} />
                  </IonButton>
                </div>
              </IonItem>
              <p style={{
                fontSize: '0.8rem',
                color: '#888',
                margin: '4px 16px 8px 16px',
                lineHeight: '1.4'
              }}>
                QR-Code Check-in ist {formData.checkin_window} Min. vor bis {formData.checkin_window} Min. nach Event-Start möglich
              </p>
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* DATUM & ZEIT */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={calendar} />
            </div>
            <IonLabel>Datum & Zeit</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="none" >
                <IonLabel position="stacked">Event Datum & Uhrzeit *</IonLabel>
                <IonDatetimeButton datetime="event-date-picker" />
              </IonItem>

              <IonItem lines="none" >
                <IonLabel position="stacked">Endzeit (optional)</IonLabel>
                <IonDatetimeButton datetime="end-time-picker" />
              </IonItem>

              {!formData.mandatory && (
                <>
                  <IonItem lines="none" >
                    <IonLabel position="stacked">Anmeldung ab</IonLabel>
                    <IonDatetimeButton datetime="registration-opens-picker" />
                  </IonItem>

                  <IonItem lines="none" >
                    <IonLabel position="stacked">Anmeldeschluss</IonLabel>
                    <IonDatetimeButton datetime="registration-closes-picker" />
                  </IonItem>
                </>
              )}
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* ZEITFENSTER - VOR Punkte & Teilnehmer */}
        {!formData.mandatory && teamerAccess !== 'teamer_only' && (<>
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={time} />
            </div>
            <IonLabel>Zeitfenster (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="none" >
                <IonLabel>Zeitfenster aktivieren</IonLabel>
                <IonToggle
                  slot="end"
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
                <IonItem lines="none" style={{ '--background': 'transparent', padding: '8px 16px' }}>
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

            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* ZEITFENSTER DETAILS - direkt nach Toggle */}
        {formData.has_timeslots && timeslots.map((timeslot, index) => (
          <IonList key={index} inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'white' }}>
                  {index + 1}
                </span>
              </div>
              <IonLabel style={{ flex: 1 }}>Zeitfenster {index + 1}</IonLabel>
              <IonButton
                fill="clear"
                color="danger"
                onClick={() => removeTimeslot(index)}
                disabled={loading}
                size="small"
              >
                <IonIcon icon={trash} />
              </IonButton>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList>
                  <IonItem lines="none" >
                    <IonLabel position="stacked">Startzeit</IonLabel>
                    <IonDatetimeButton datetime={`timeslot-start-${index}`} />
                  </IonItem>
                  <IonItem lines="none" >
                    <IonLabel position="stacked">Endzeit</IonLabel>
                    <IonDatetimeButton datetime={`timeslot-end-${index}`} />
                  </IonItem>
                  <IonModal keepContentsMounted={true}>
                    <IonDatetime
                      id={`timeslot-start-${index}`}
                      presentation="time"
                      value={timeslot.start_time}
                      onIonChange={(e) => {
                        const timeValue = e.detail.value as string;
                        if (timeValue) {
                          updateTimeslot(index, 'start_time', timeValue);
                        }
                      }}
                      minuteValues="0,15,30,45"
                      disabled={loading}
                    />
                  </IonModal>
                  <IonModal keepContentsMounted={true}>
                    <IonDatetime
                      id={`timeslot-end-${index}`}
                      presentation="time"
                      value={timeslot.end_time}
                      onIonChange={(e) => {
                        const timeValue = e.detail.value as string;
                        if (timeValue) {
                          updateTimeslot(index, 'end_time', timeValue);
                        }
                      }}
                      minuteValues="0,15,30,45"
                      disabled={loading}
                    />
                  </IonModal>
                  <IonItem lines="none" >
                    <IonLabel>Unbegrenzte Teilnehmer</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={timeslot.max_participants === 0}
                      onIonChange={(e) => updateTimeslot(index, 'max_participants', e.detail.checked ? 0 : 5)}
                      disabled={loading}
                      style={{ '--track-background-checked': '#dc2626' }}
                    />
                  </IonItem>
                  {timeslot.max_participants !== 0 && (
                    <IonItem lines="none" >
                      <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Max. Teilnehmer pro Slot</IonLabel>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                        <IonButton
                          fill="outline"
                          size="small"
                          disabled={loading || timeslot.max_participants <= 1}
                          onClick={() => updateTimeslot(index, 'max_participants', Math.max(1, timeslot.max_participants - 1))}
                          style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                        >
                          <IonIcon icon={removeOutline} />
                        </IonButton>
                        <IonInput
                          type="text"
                          inputMode="numeric"
                          value={timeslot.max_participants.toString()}
                          onIonInput={(e) => {
                            const value = e.detail.value!;
                            if (value === '') {
                              updateTimeslot(index, 'max_participants', 1);
                            } else {
                              const num = parseInt(value);
                              if (!isNaN(num) && num >= 1 && num <= 999) {
                                updateTimeslot(index, 'max_participants', num);
                              }
                            }
                          }}
                          placeholder="10"
                          disabled={loading}
                          style={{ textAlign: 'center', flex: 1 }}
                        />
                        <IonButton
                          fill="outline"
                          size="small"
                          disabled={loading || timeslot.max_participants >= 999}
                          onClick={() => updateTimeslot(index, 'max_participants', Math.min(999, timeslot.max_participants + 1))}
                          style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                        >
                          <IonIcon icon={addOutline} />
                        </IonButton>
                      </div>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        ))}
        </>)}

        {/* PUNKTE & TEILNEHMER */}
        {!formData.mandatory && teamerAccess !== 'teamer_only' && (
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={people} />
            </div>
            <IonLabel>Punkte{!formData.has_timeslots ? ' & Teilnehmer' : ''}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              {/* Max. Teilnehmer - nur anzeigen wenn KEINE Zeitfenster aktiv */}
              {!formData.has_timeslots && (
                <>
                  <IonItem lines="none" >
                    <IonLabel>Unbegrenzte Teilnehmer</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={formData.max_participants === 0}
                      onIonChange={(e) => setFormData({ ...formData, max_participants: e.detail.checked ? 0 : 5 })}
                      disabled={loading}
                      style={{ '--track-background-checked': '#dc2626' }}
                    />
                  </IonItem>
                  {formData.max_participants !== 0 && (
                    <IonItem lines="none" >
                      <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Max. Teilnehmer</IonLabel>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <IonButton
                          fill="outline"
                          size="small"
                          disabled={loading || formData.max_participants <= 1}
                          onClick={() => setFormData({ ...formData, max_participants: Math.max(1, formData.max_participants - 1) })}
                          style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                        >
                          <IonIcon icon={removeOutline} />
                        </IonButton>
                        <IonInput
                          type="text"
                          inputMode="numeric"
                          value={formData.max_participants.toString()}
                          onIonInput={(e) => {
                            const value = e.detail.value!;
                            if (value === '') {
                              setFormData({ ...formData, max_participants: 1 });
                            } else {
                              const num = parseInt(value);
                              if (!isNaN(num) && num >= 1 && num <= 999) {
                                setFormData({ ...formData, max_participants: num });
                              }
                            }
                          }}
                          placeholder="5"
                          disabled={loading}
                          style={{ textAlign: 'center', flex: 1 }}
                        />
                        <IonButton
                          fill="outline"
                          size="small"
                          disabled={loading || formData.max_participants >= 999}
                          onClick={() => setFormData({ ...formData, max_participants: Math.min(999, formData.max_participants + 1) })}
                          style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                        >
                          <IonIcon icon={addOutline} />
                        </IonButton>
                      </div>
                    </IonItem>
                  )}
                </>
              )}

              {/* Punkte mit Stepper */}
              <IonItem lines="none" >
                <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Punkte</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={loading || formData.points <= 0}
                    onClick={() => setFormData({ ...formData, points: Math.max(0, formData.points - 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={removeOutline} />
                  </IonButton>
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
                        if (!isNaN(num) && num >= 0 && num <= 999) {
                          setFormData({ ...formData, points: num });
                        }
                      }
                    }}
                    placeholder="0"
                    disabled={loading}
                    style={{ textAlign: 'center', flex: 1 }}
                  />
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={loading || formData.points >= 999}
                    onClick={() => setFormData({ ...formData, points: Math.min(999, formData.points + 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={addOutline} />
                  </IonButton>
                </div>
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px', paddingTop: '16px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Typ *</IonLabel>
              </IonItem>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  className="app-list-item"
                  onClick={() => !loading && setFormData({ ...formData, point_type: 'gemeinde' })}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: '#059669',
                    backgroundColor: formData.point_type === 'gemeinde' ? 'rgba(5, 150, 105, 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gemeinde</span>
                </div>
                <div
                  className="app-list-item"
                  onClick={() => !loading && setFormData({ ...formData, point_type: 'gottesdienst' })}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: '#3b82f6',
                    backgroundColor: formData.point_type === 'gottesdienst' ? 'rgba(59, 130, 246, 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gottesdienst</span>
                </div>
              </div>
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* KATEGORIEN & ZIELGRUPPE */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={people} />
            </div>
            <IonLabel>Kategorien & Zielgruppe</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              {categories.length > 0 ? (
                <>
                  <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px' }}>
                    <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>
                      Kategorien (mehrere möglich)
                      {formData.category_ids.length > 0 && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.8rem',
                          color: '#0ea5e9',
                          fontWeight: 'normal'
                        }}>
                          ({formData.category_ids.length} ausgewählt)
                        </span>
                      )}
                    </IonLabel>
                  </IonItem>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {categories.map((category) => {
                      const isSelected = formData.category_ids.includes(category.id);
                      return (
                        <div
                          key={category.id}
                          className="app-list-item app-list-item--categories"
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
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0',
                            background: isSelected ? 'rgba(14, 165, 233, 0.08)' : undefined
                          }}
                        >
                          <span style={{ fontWeight: '500', color: '#333' }}>{category.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <IonItem lines="none" >
                  <IonLabel color="medium">
                    <p>Keine Kategorien verfügbar</p>
                  </IonLabel>
                </IonItem>
              )}

              {teamerAccess !== 'teamer_only' && (<>
              <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px', paddingTop: '16px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: formData.mandatory && formData.jahrgang_ids.length === 0 ? '#dc3545' : '#666' }}>
                  Jahrgänge (mehrere möglich) *{formData.mandatory && formData.jahrgang_ids.length === 0 ? ' (Pflicht bei Pflicht-Events)' : ''}
                  {formData.jahrgang_ids.length > 0 && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '0.8rem',
                      color: '#8b5cf6',
                      fontWeight: 'normal'
                    }}>
                      ({formData.jahrgang_ids.length} ausgewählt)
                    </span>
                  )}
                </IonLabel>
              </IonItem>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {jahrgaenge.map((jahrgang) => {
                  const isSelected = formData.jahrgang_ids.includes(jahrgang.id);
                  return (
                    <div
                      key={jahrgang.id}
                      className="app-list-item app-list-item--jahrgang"
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
                      style={{
                        cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0',
                        background: isSelected ? 'rgba(139, 92, 246, 0.08)' : undefined
                      }}
                    >
                      <span style={{ fontWeight: '500', color: '#333' }}>{jahrgang.name}</span>
                    </div>
                  );
                })}
              </div>
              </>)}
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>

        {/* WARTELISTE */}
        {!formData.mandatory && teamerAccess !== 'teamer_only' && (
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={people} />
            </div>
            <IonLabel>Warteliste</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
          <IonCardContent>
            <IonList>
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: formData.waitlist_enabled ? '12px' : '0' }}>
                <IonLabel>Warteliste aktivieren</IonLabel>
                <IonToggle
                  slot="end"
                  checked={formData.waitlist_enabled}
                  onIonChange={(e) => {
                    setFormData({ ...formData, waitlist_enabled: e.detail.checked });
                  }}
                  disabled={loading}
                />
              </IonItem>

              {formData.waitlist_enabled && (
                <IonItem lines="none" >
                  <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Max. Wartelisten-Plätze</IonLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={loading || formData.max_waitlist_size <= 0}
                      onClick={() => setFormData({ ...formData, max_waitlist_size: Math.max(0, formData.max_waitlist_size - 1) })}
                      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                    >
                      <IonIcon icon={removeOutline} />
                    </IonButton>
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
                          if (!isNaN(num) && num >= 0 && num <= 999) {
                            setFormData({ ...formData, max_waitlist_size: num });
                          }
                        }
                      }}
                      placeholder="10"
                      disabled={loading}
                      style={{ textAlign: 'center', flex: 1 }}
                    />
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={loading || formData.max_waitlist_size >= 999}
                      onClick={() => setFormData({ ...formData, max_waitlist_size: Math.min(999, formData.max_waitlist_size + 1) })}
                      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                    >
                      <IonIcon icon={addOutline} />
                    </IonButton>
                  </div>
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* SERIEN-EVENT - Nur beim Erstellen anzeigen, nicht beim Bearbeiten */}
        {!event && (
          <IonList inset={true} className="app-modal-section">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={copy} />
              </div>
              <IonLabel>Event-Serie (optional)</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList>
                  <IonItem lines="none" >
                    <IonLabel>Als Serie erstellen</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={formData.is_series}
                      onIonChange={(e) => setFormData({ ...formData, is_series: e.detail.checked })}
                      disabled={loading}
                    />
                  </IonItem>

                  {formData.is_series && (
                    <>
                      <IonItem lines="none" >
                        <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Anzahl Events</IonLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                          <IonButton
                            fill="outline"
                            size="small"
                            disabled={loading || formData.series_count <= 2}
                            onClick={() => setFormData({ ...formData, series_count: Math.max(2, formData.series_count - 1) })}
                            style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                          >
                            <IonIcon icon={removeOutline} />
                          </IonButton>
                          <IonInput
                            type="text"
                            inputMode="numeric"
                            value={formData.series_count.toString()}
                            onIonInput={(e) => {
                              const value = e.detail.value!;
                              if (value === '') {
                                setFormData({ ...formData, series_count: 2 });
                              } else {
                                const num = parseInt(value);
                                if (!isNaN(num) && num >= 2 && num <= 52) {
                                  setFormData({ ...formData, series_count: num });
                                }
                              }
                            }}
                            placeholder="4"
                            disabled={loading}
                            style={{ textAlign: 'center', flex: 1 }}
                          />
                          <IonButton
                            fill="outline"
                            size="small"
                            disabled={loading || formData.series_count >= 52}
                            onClick={() => setFormData({ ...formData, series_count: Math.min(52, formData.series_count + 1) })}
                            style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                          >
                            <IonIcon icon={addOutline} />
                          </IonButton>
                        </div>
                      </IonItem>

                      <IonItem lines="none" >
                        <IonLabel position="stacked">Intervall</IonLabel>
                        <IonSelect
                          value={formData.series_interval}
                          onIonChange={(e) => setFormData({ ...formData, series_interval: e.detail.value })}
                          placeholder="Intervall wählen"
                          disabled={loading}
                          interface="action-sheet"
                          interfaceOptions={{
                            header: 'Intervall auswählen'
                          }}
                        >
                          <IonSelectOption value="day">Täglich</IonSelectOption>
                          <IonSelectOption value="week">Wöchentlich</IonSelectOption>
                          <IonSelectOption value="2weeks">Alle 2 Wochen</IonSelectOption>
                          <IonSelectOption value="month">Monatlich</IonSelectOption>
                        </IonSelect>
                      </IonItem>
                    </>
                  )}

                  {!formData.is_series && (
                    <IonItem lines="none" style={{ '--background': 'transparent', opacity: 0.6 }}>
                      <IonLabel color="medium">
                        <p>Einzelnes Event</p>
                      </IonLabel>
                    </IonItem>
                  )}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
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