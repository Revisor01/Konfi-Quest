import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonModal
} from '@ionic/react';
import { add, ban, list, archive, calendar, time, checkmarkCircle, close } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import EventsView from '../EventsView';
import LoadingSpinner from '../../common/LoadingSpinner';
import EventModal from '../modals/EventModal';

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
}

const AdminEventsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-events');
  const history = useHistory();
  
  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [cancelledEvents, setCancelledEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('upcoming');
  
  const [editEvent, setEditEvent] = useState<Event | null>(null);

  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  const [presentEventModalHook, dismissEventModalHook] = useIonModal(EventModal, {
    event: editEvent,
    onClose: () => {
      dismissEventModalHook();
      setEditEvent(null);
    },
    onSuccess: () => {
      dismissEventModalHook();
      setEditEvent(null);
      loadEvents();
    }
  });

  useEffect(() => {
    loadEvents();
    loadCancelledEvents();
    loadPastEvents();
    console.log('Page ref:', pageRef.current);
    // Event-Listener für Updates aus EventDetailView
    const handleEventsUpdated = () => {
      loadEvents();
      loadCancelledEvents();
      loadPastEvents();
    };
    
    window.addEventListener('events-updated', handleEventsUpdated);
    
    return () => {
      window.removeEventListener('events-updated', handleEventsUpdated);
    };
  }, []);

  
  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/events');
      // Show all active events (non-cancelled)
      setEvents(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCancelledEvents = async () => {
    try {
      const response = await api.get('/events/cancelled');
      setCancelledEvents(response.data);
    } catch (err) {
      console.error('Error loading cancelled events:', err);
      // Don't show error for cancelled events as it's not critical
    }
  };

  const loadPastEvents = async () => {
    try {
      const response = await api.get('/events');
      const now = new Date();
      const pastEventsFiltered = response.data.filter((event: Event) => 
        new Date(event.event_date) < now
      );
      setPastEvents(pastEventsFiltered);
    } catch (err) {
      console.error('Error loading past events:', err);
    }
  };

  // Get combined events for "Alle" tab (active + cancelled)
  const getAllEvents = () => {
    const combinedEvents = [...events, ...cancelledEvents];
    return combinedEvents.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  };

  // Get future events only
  const getFutureEvents = () => {
    const now = new Date();
    return events.filter(event => new Date(event.event_date) >= now);
  };

  const handleDeleteEvent = async (event: Event) => {
    if (!window.confirm(`Event "${event.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/events/${event.id}`);
      setSuccess(`Event "${event.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadEvents();
      await loadCancelledEvents();
      await loadPastEvents();
    } catch (error: any) {
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Fehler beim Löschen des Events');
      }
    }
  };

  const handleCopyEvent = (event: Event) => {
    // Create a copy of the event with modified name and reset dates
    const eventCopy = {
      ...event,
      name: `${event.name} (Kopie)`
    };
    
    // Remove properties that shouldn't be copied
    delete (eventCopy as any).id;
    delete (eventCopy as any).registered_count;
    delete (eventCopy as any).registration_status;
    delete (eventCopy as any).created_at;
    delete (eventCopy as any).event_date;
    delete (eventCopy as any).event_end_time;
    delete (eventCopy as any).registration_opens_at;
    delete (eventCopy as any).registration_closes_at;
    
    setEditEvent(eventCopy as Event);
    presentEventModalHook({
      presentingElement: presentingElement
    });
  };

  const handleCancelEvent = async (event: Event) => {
    const message = prompt(
      `Event "${event.name}" absagen?\n\nNachricht an die Teilnehmer (optional):`,
      'Das Event wurde leider abgesagt. Wir entschuldigen uns für die Unannehmlichkeiten.'
    );
    
    if (message === null) return; // User cancelled
    
    try {
      await api.put(`/events/${event.id}/cancel`, {
        notification_message: message
      });
      setSuccess(`Event "${event.name}" wurde abgesagt`);
      await loadEvents();
      await loadCancelledEvents();
      await loadPastEvents();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Absagen des Events');
      }
    }
  };

  const handleSelectEvent = (event: Event) => {
    // Anstatt den State zu ändern, navigieren wir zur neuen Route
    history.push(`/admin/events/${event.id}`);
  };

  const presentEventModal = () => {
    setEditEvent(null);
    presentEventModalHook({
      presentingElement: presentingElement
    });
  };

  // Permission checks
  const canCreate = user?.permissions?.includes('admin.events.create') || false;
  const canEdit = user?.permissions?.includes('admin.events.edit') || false;
  const canDelete = user?.permissions?.includes('admin.events.delete') || false;
  const canCopy = canCreate; // Copy requires create permission
  const canCancel = canEdit; // Cancel requires edit permission


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
          <IonButtons slot="end">
            {canCreate && activeTab !== 'cancelled' && activeTab !== 'past' && (
              <IonButton onClick={presentEventModal}>
                <IonIcon icon={add} />
              </IonButton>
            )}
          </IonButtons>
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
          loadCancelledEvents();
          loadPastEvents();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        
        {loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <EventsView 
            events={
              activeTab === 'all' ? getAllEvents() :
              activeTab === 'upcoming' ? getFutureEvents().filter(e => e.registration_status === 'upcoming' || e.registration_status === 'open') :
              activeTab === 'past' ? pastEvents :
              cancelledEvents
            }
            onUpdate={
              activeTab === 'past' ? loadPastEvents :
              activeTab === 'cancelled' ? loadCancelledEvents :
              loadEvents
            }
            onAddEventClick={presentEventModal}
            onSelectEvent={handleSelectEvent}
            onDeleteEvent={canDelete && activeTab !== 'cancelled' && activeTab !== 'past' ? handleDeleteEvent : undefined}
            onCopyEvent={canCopy ? handleCopyEvent : undefined}
            onCancelEvent={canCancel && activeTab !== 'cancelled' && activeTab !== 'past' ? handleCancelEvent : undefined}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            eventCounts={{
              all: getAllEvents().length,
              upcoming: getFutureEvents().filter(e => e.registration_status === 'upcoming' || e.registration_status === 'open').length,
              past: pastEvents.length,
              cancelled: cancelledEvents.length
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminEventsPage;