import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
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
  const history = useHistory();
  
  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'registered' | 'upcoming' | 'past' | 'cancelled'>('upcoming');

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
              can_register: registrationResponse.data.can_register,
              waitlist_count: registrationResponse.data.waitlist_count,
              waitlist_position: registrationResponse.data.waitlist_position,
              registration_status_detail: registrationResponse.data.registration_status
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
    
    let filteredEvents;
    switch (activeTab) {
      case 'registered':
        filteredEvents = events.filter(event => event.is_registered);
        break;
      case 'upcoming':
        filteredEvents = events.filter(event => 
          new Date(event.event_date) >= now && 
          event.registration_status !== 'cancelled'
        );
        break;
      case 'past':
        filteredEvents = events.filter(event => 
          new Date(event.event_date) < now &&
          event.registration_status !== 'cancelled'
        );
        break;
      case 'cancelled':
        filteredEvents = events.filter(event => event.registration_status === 'cancelled');
        break;
      default:
        filteredEvents = events;
    }
    
    // Sort events: current events first, then by date
    return filteredEvents.sort((a, b) => {
      const dateA = new Date(a.event_date);
      const dateB = new Date(b.event_date);
      const isPastA = dateA < now;
      const isPastB = dateB < now;
      
      // If one is past and other is future, future comes first
      if (isPastA && !isPastB) return 1;
      if (!isPastA && isPastB) return -1;
      
      // If both are future or both are past, sort by date
      return dateA.getTime() - dateB.getTime();
    });
  };

  const handleSelectEvent = (event: Event) => {
    // Navigate to event detail page using React Router
    history.push(`/konfi/events/${event.id}`);
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
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;