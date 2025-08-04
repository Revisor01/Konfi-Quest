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

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/events');
      // Show all events for konfi users
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
    // For konfi users, we could show event details or handle registration
    // For now, just show event info
    presentAlert({
      header: event.name,
      message: `${event.description || 'Keine Beschreibung verfügbar'}\n\nDatum: ${new Date(event.event_date).toLocaleDateString('de-DE')}\n${event.location ? `Ort: ${event.location}` : ''}`,
      buttons: [
        {
          text: 'Schließen',
          role: 'cancel'
        },
        ...(event.can_register ? [{
          text: 'Anmelden',
          handler: () => handleRegisterEvent(event)
        }] : []),
        ...(event.is_registered ? [{
          text: 'Abmelden',
          role: 'destructive',
          handler: () => handleUnregisterEvent(event)
        }] : [])
      ]
    });
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
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;