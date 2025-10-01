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
  useIonModal,
  useIonActionSheet
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
  waitlist_count?: number;
  pending_bookings_count?: number;
}

const AdminEventsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-events');
  const history = useHistory();
  const [presentActionSheet] = useIonActionSheet();
  
  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [cancelledEvents, setCancelledEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'konfirmation'>('upcoming');
  
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
      // Filter out cancelled events (they're loaded separately)
      const activeEvents = response.data.filter((event: Event) =>
        event.registration_status !== 'cancelled'
      );
      setEvents(activeEvents);
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

  // Get combined events for "Alle" tab (active + cancelled) - ohne Duplikate
  const getAllEvents = () => {
    const combinedEvents = [...events, ...cancelledEvents];
    // Duplikate entfernen basierend auf ID
    const uniqueEvents = Array.from(new Map(combinedEvents.map(e => [e.id, e])).values());
    return uniqueEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  };

  // Get current events: future events OR events with pending bookings (exclude cancelled and konfirmation)
  const getFutureEvents = () => {
    const now = new Date();
    const futureEvents = events.filter(event => {
      const eventDate = new Date(event.event_date);
      const hasPendingBookings = event.pending_bookings_count && event.pending_bookings_count > 0;

      return (
        (eventDate >= now || hasPendingBookings) &&
        event.registration_status !== 'cancelled' &&
        !event.category_names?.toLowerCase().includes('konfirmation')
      );
    });
    return futureEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  };

  // Get konfirmation events
  const getKonfirmationEvents = () => {
    const konfirmationEvents = events.filter(event =>
      event.category_names?.toLowerCase().includes('konfirmation')
    );
    return konfirmationEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  };

  const handleDeleteEvent = async (event: Event) => {
    // Check if this is part of a series
    if (event.is_series && event.series_id) {
      // Get other events in the series
      const allEvents = [...events, ...cancelledEvents, ...pastEvents];
      const seriesEvents = allEvents.filter(e => 
        e.series_id === event.series_id && e.id !== event.id
      );
      
      if (seriesEvents.length > 0) {
        // Show action sheet for series deletion
        presentActionSheet({
          header: `Serie-Event löschen`,
          subHeader: `"${event.name}" ist Teil einer Serie mit ${seriesEvents.length + 1} Terminen.`,
          buttons: [
            {
              text: 'Nur diesen Termin löschen',
              icon: 'trash-outline',
              handler: () => deleteSingleEvent(event)
            },
            {
              text: `Ganze Serie löschen (${seriesEvents.length + 1} Termine)`,
              icon: 'warning-outline', 
              role: 'destructive',
              handler: () => deleteWholeSeries(event.series_id!, [...seriesEvents, event])
            },
            {
              text: 'Abbrechen',
              role: 'cancel'
            }
          ]
        });
        return;
      }
    }
    
    // Normal single event deletion
    deleteSingleEvent(event);
  };
  
  const deleteSingleEvent = async (event: Event) => {
    if (!window.confirm(`Event "${event.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/events/${event.id}`);
      setSuccess(`Event "${event.name}" gelöscht`);
      await loadEvents();
      await loadCancelledEvents(); 
      await loadPastEvents();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Löschen des Events');
      }
    }
  };
  
  const deleteWholeSeries = async (seriesId: number, seriesEvents: Event[]) => {
    if (!window.confirm(`Wirklich die ganze Serie mit ${seriesEvents.length} Terminen löschen?`)) return;

    try {
      // Delete all events in the series
      const deletePromises = seriesEvents.map(event => api.delete(`/events/${event.id}`));
      await Promise.all(deletePromises);
      
      setSuccess(`Serie mit ${seriesEvents.length} Terminen gelöscht`);
      await loadEvents();
      await loadCancelledEvents();
      await loadPastEvents();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Löschen der Serie');
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

  const presentEventModal = (eventType: 'single' | 'series' = 'single') => {
    if (eventType === 'series') {
      // For series, we need to create a proper "new event" object with is_series flag
      setEditEvent({
        id: 0, // Set to 0 to indicate new event
        name: '',
        description: '',
        event_date: '',
        location: '',
        points: 0,
        type: 'gottesdienst',
        max_participants: 10,
        is_series: true
      } as Event);
    } else {
      setEditEvent(null);
    }
    presentEventModalHook({
      presentingElement: presentingElement
    });
  };

  const handleAddEventClick = () => {
    presentActionSheet({
      header: 'Event erstellen',
      buttons: [
        {
          text: 'Einzelnes Event erstellen',
          icon: 'calendar-outline',
          handler: () => presentEventModal('single')
        },
        {
          text: 'Event-Serie erstellen',
          icon: 'copy-outline', 
          handler: () => presentEventModal('series')
        },
        {
          text: 'Abbrechen',
          role: 'cancel'
        }
      ]
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
            {canCreate && (
              <IonButton onClick={handleAddEventClick}>
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
              activeTab === 'konfirmation' ? getKonfirmationEvents() :
              getFutureEvents()
            }
            onUpdate={loadEvents}
            onAddEventClick={handleAddEventClick}
            onSelectEvent={handleSelectEvent}
            onDeleteEvent={canDelete ? handleDeleteEvent : undefined}
            onCopyEvent={canCopy ? handleCopyEvent : undefined}
            onCancelEvent={canCancel ? handleCancelEvent : undefined}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            eventCounts={{
              all: getAllEvents().length,
              upcoming: getFutureEvents().length,
              konfirmation: getKonfirmationEvents().length
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminEventsPage;