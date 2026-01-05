import React, { useState, useEffect, useCallback } from 'react';
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
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
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
  category_names?: string;
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
  attendance_status?: 'present' | 'absent' | null;
  cancelled?: boolean;
  waitlist_count?: number;
  waitlist_position?: number;
  registration_status_detail?: string;
  booking_status?: 'confirmed' | 'waitlist' | 'pending' | null;
}

const KonfiEventsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('konfi-events');
  const history = useHistory();
  
  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'registered' | 'konfirmation'>('upcoming');

  // Memoized refresh function for live updates
  const refreshEvents = useCallback(() => {
    console.log('Live Update: Refreshing konfi events...');
    loadEvents();
  }, []);

  // Subscribe to live updates for events
  useLiveRefresh('events', refreshEvents);

  useEffect(() => {
    loadEvents();

    // Event-Listener für Updates aus EventDetailView (legacy support)
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
      // Use konfi-specific events route with attendance status
      const response = await api.get('/konfi/events');
      setEvents(response.data);
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
        // Zeige alle Events wo ich angemeldet bin
        filteredEvents = events.filter(event => event.is_registered);
        break;
      case 'upcoming':
        filteredEvents = events.filter(event => 
          new Date(event.event_date) >= now && !event.category_names?.toLowerCase().includes('konfirmation')
        );
        break;
      case 'konfirmation':
        filteredEvents = events.filter(event => 
          event.category_names?.toLowerCase().includes('konfirmation')
        );
        break;
      default:
        filteredEvents = events;
    }
    
    // Sort events: nächstes Event immer oben
    return filteredEvents.sort((a, b) => {
      const dateA = new Date(a.event_date);
      const dateB = new Date(b.event_date);
      const isPastA = dateA < now;
      const isPastB = dateB < now;
      
      // Wenn beide in Zukunft oder beide in Vergangenheit: chronologisch sortieren
      if ((isPastA && isPastB) || (!isPastA && !isPastB)) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Zukunft kommt vor Vergangenheit
      if (!isPastA && isPastB) return -1;
      if (isPastA && !isPastB) return 1;
      
      return 0;
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