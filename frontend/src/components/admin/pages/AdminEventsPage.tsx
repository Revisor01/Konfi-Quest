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
import { add, ban, list, archive } from 'ionicons/icons';
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
  registration_status: 'upcoming' | 'open' | 'closed';
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
  const [loading, setLoading] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);
  
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
    console.log('Page ref:', pageRef.current);
    // Event-Listener für Updates aus EventDetailView
    const handleEventsUpdated = () => {
      loadEvents();
      loadCancelledEvents();
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

  const handleDeleteEvent = async (event: Event) => {
    if (!window.confirm(`Event "${event.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/events/${event.id}`);
      setSuccess(`Event "${event.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadEvents();
      await loadCancelledEvents();
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
      name: `${event.name} (Kopie)`,
      event_date: '', // Reset date to be set in modal
      event_end_time: '',
      registration_opens_at: '',
      registration_closes_at: ''
    };
    
    // Remove properties that shouldn't be copied
    delete (eventCopy as any).id;
    delete (eventCopy as any).registered_count;
    delete (eventCopy as any).registration_status;
    delete (eventCopy as any).created_at;
    
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
          <IonTitle>{showCancelled ? 'Abgesagte Events' : 'Events'}</IonTitle>
          <IonButtons slot="end">
            <IonButton 
              fill={showCancelled ? 'clear' : 'solid'}
              color={showCancelled ? 'medium' : 'primary'}
              onClick={() => setShowCancelled(false)}
            >
              <IonIcon icon={list} />
            </IonButton>
            <IonButton 
              fill={showCancelled ? 'solid' : 'clear'}
              color={showCancelled ? 'warning' : 'medium'}
              onClick={() => setShowCancelled(true)}
            >
              <IonIcon icon={archive} />
            </IonButton>
            {canCreate && !showCancelled && (
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
              {showCancelled ? 'Abgesagte Events' : 'Events'}
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadEvents();
          loadCancelledEvents();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <EventsView 
            events={showCancelled ? cancelledEvents : events}
            onUpdate={showCancelled ? loadCancelledEvents : loadEvents}
            onAddEventClick={presentEventModal}
            onSelectEvent={handleSelectEvent}
            onDeleteEvent={canDelete && !showCancelled ? handleDeleteEvent : undefined}
            onCopyEvent={canCopy ? handleCopyEvent : undefined}
            onCancelEvent={canCancel && !showCancelled ? handleCancelEvent : undefined}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminEventsPage;