import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  useIonAlert
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import EventsView from '../views/EventsView';
import EventDetailModal from '../modals/EventDetailModal';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Category {
  id: number;
  name: string;
}

interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  event_end_time?: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  categories?: Category[];
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed' | 'cancelled';
  created_at: string;
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
  is_series?: boolean;
  series_id?: number;
  is_registered?: boolean;
  can_register?: boolean;
}

const KonfiEventsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('konfi-events');
  const [presentAlert] = useIonAlert();
  
  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/events');
      // Map the konfi API response to match our Event interface
      const mappedEvents = response.data.map((event: any) => ({
        id: event.id,
        name: event.title, // API returns 'title' instead of 'name'
        description: event.description,
        event_date: event.date, // API returns 'date' instead of 'event_date'
        location: event.location,
        points: event.points,
        type: event.type || 'gemeinde',
        max_participants: event.max_participants,
        registration_closes_at: event.registration_deadline,
        registered_count: event.current_participants || 0,
        is_registered: event.is_registered,
        can_register: event.can_register,
        registration_status: calculateRegistrationStatus(event)
      }));
      setEvents(mappedEvents);
    } catch (err) {
      setError('Fehler beim Laden der Events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const calculateRegistrationStatus = (event: any): 'upcoming' | 'open' | 'closed' | 'cancelled' => {
    const now = new Date();
    const eventDate = new Date(event.date || event.event_date);
    const registrationDeadline = event.registration_deadline || event.registration_closes_at;
    
    if (event.cancelled) return 'cancelled';
    if (eventDate < now) return 'closed';
    if (registrationDeadline && new Date(registrationDeadline) < now) return 'closed';
    if (event.current_participants >= event.max_participants) return 'closed';
    if (!event.can_register) return 'closed';
    
    return 'open';
  };

  // Get filtered events by tab
  const getFilteredEvents = () => {
    const now = new Date();
    
    switch (activeTab) {
      case 'upcoming':
        return events.filter(event => 
          new Date(event.event_date) >= now && 
          event.registration_status !== 'cancelled'
        );
      case 'past':
        return events.filter(event => 
          new Date(event.event_date) < now &&
          event.registration_status !== 'cancelled'
        );
      case 'cancelled':
        return events.filter(event => event.registration_status === 'cancelled');
      default:
        return events;
    }
  };

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  const handleRegisterEvent = async (event: Event) => {
    try {
      await api.post(`/konfi/events/${event.id}/register`);
      setSuccess(`Erfolgreich für "${event.name}" angemeldet!`);
      await loadEvents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  const handleUnregisterEvent = async (event: Event) => {
    try {
      await api.delete(`/konfi/events/${event.id}/register`);
      setSuccess(`Von "${event.name}" abgemeldet`);
      await loadEvents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>
              Events
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEvents();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <EventsView 
            events={getFilteredEvents()}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSelectEvent={handleSelectEvent}
            onUpdate={loadEvents}
          />
        )}
        
        <EventDetailModal
          isOpen={showEventDetail}
          onClose={() => {
            setShowEventDetail(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          onUpdate={loadEvents}
        />
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;