import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import EventsView from '../views/EventsView';
import EventDetailView from '../views/EventDetailView';
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
  
  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  useEffect(() => {
    loadEvents();
    
    // Event-Listener für Updates aus EventDetailView
    const handleEventsUpdated = () => {
      loadEvents();
    };
    
    window.addEventListener('events-updated', handleEventsUpdated);
    
    return () => {
      window.removeEventListener('events-updated', handleEventsUpdated);
    };
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Use the same API as Admin - Events are accessible to all authenticated users
      const response = await api.get('/events');
      
      // For Konfis, we need to check their registration status
      const eventsWithRegistration = await Promise.all(
        response.data.map(async (event: Event) => {
          try {
            // Check if konfi is registered for this event
            const registrationResponse = await api.get(`/konfi/events/${event.id}/status`);
            return {
              ...event,
              is_registered: registrationResponse.data.is_registered,
              can_register: registrationResponse.data.can_register
            };
          } catch (err) {
            // If status check fails, assume not registered but can register if open
            return {
              ...event,
              is_registered: false,
              can_register: event.registration_status === 'open'
            };
          }
        })
      );
      
      setEvents(eventsWithRegistration);
    } catch (err) {
      setError('Fehler beim Laden der Events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
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
    setSelectedEventId(event.id);
  };

  const handleBackToList = () => {
    setSelectedEventId(null);
  };

  // Show EventDetailView if event is selected
  if (selectedEventId) {
    return (
      <EventDetailView
        eventId={selectedEventId}
        onBack={handleBackToList}
      />
    );
  }

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
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;