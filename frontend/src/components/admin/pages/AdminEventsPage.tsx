import React, { useState, useCallback } from 'react';
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
  IonSearchbar,
  IonList,
  IonListHeader,
  IonLabel,
  useIonModal,
  useIonActionSheet,
  useIonAlert,
  useIonRouter
} from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren
import { add, ban, list, archive, calendar, time, checkmarkCircle, close, searchOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import EventsView from '../EventsView';
import LoadingSpinner from '../../common/LoadingSpinner';
import EventModal from '../modals/EventModal';
import { Event } from '../../../types/event';
import { triggerPullHaptic } from '../../../utils/haptics';

const AdminEventsPage: React.FC = () => {
  const { user, setSuccess, setError, isOnline } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-events');
  const router = useIonRouter();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  
  // Offline-Query: Events
  const { data: allEventsRaw, loading: eventsLoading, refresh: refreshEvents } = useOfflineQuery<Event[]>(
    'admin:events:' + user?.organization_id,
    async () => { const res = await api.get('/events'); return res.data; },
    { ttl: CACHE_TTL.EVENTS }
  );
  const events = allEventsRaw?.filter((e: Event) => e.registration_status !== 'cancelled') || [];

  // Offline-Query: Abgesagte Events
  const { data: cancelledEvents, refresh: refreshCancelled } = useOfflineQuery<Event[]>(
    'admin:events-cancelled:' + user?.organization_id,
    async () => { const res = await api.get('/events/cancelled'); return res.data; },
    { ttl: CACHE_TTL.SETTINGS }
  );

  // Offline-Query: Jahrgaenge
  const { data: jahrgaenge, refresh: refreshJahrgaenge } = useOfflineQuery<Array<{id: number; name: string}>>(
    'admin:jahrgaenge:' + user?.organization_id,
    async () => { const res = await api.get('/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  // State
  const loading = eventsLoading;
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'konfirmation'>('upcoming');
  const [selectedJahrgang, setSelectedJahrgang] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

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
      refreshEvents();
      refreshCancelled();
    }
  });

  // Memoized refresh function for live updates
  const refreshAllEvents = useCallback(() => {
    refreshEvents();
    refreshCancelled();
  }, [refreshEvents, refreshCancelled]);

  // Subscribe to live updates for events
  useLiveRefresh('events', refreshAllEvents);

  const filterByJahrgang = (eventList: Event[]) => {
    if (!selectedJahrgang) return eventList;
    return eventList.filter(event => {
      if (!event.jahrgang_ids) return false;
      const ids = event.jahrgang_ids.split(',').map(id => parseInt(id.trim(), 10));
      return ids.includes(selectedJahrgang);
    });
  };

  // Get combined events for "Alle" tab (active + cancelled) - ohne Duplikate
  const getAllEvents = () => {
    const combinedEvents = [...events, ...(cancelledEvents || [])];
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
    if (!isOnline) return;
    // Check if this is part of a series
    if (event.is_series && event.series_id) {
      // Get other events in the series
      const allEvents = [...events, ...(cancelledEvents || [])];
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
    presentAlert({
      header: 'Event löschen',
      message: `Event "${event.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/events/${event.id}`);
              setSuccess(`Event "${event.name}" gelöscht`);
              await refreshEvents();
              await refreshCancelled();
            } catch (error: any) {
              if (error.response?.data?.error) {
                setError(error.response.data.error);
              } else {
                setError('Fehler beim Löschen des Events');
              }
            }
          }
        }
      ]
    });
  };
  
  const deleteWholeSeries = async (seriesId: number, seriesEvents: Event[]) => {
    presentAlert({
      header: 'Serie löschen',
      message: `Wirklich die ganze Serie mit ${seriesEvents.length} Terminen löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              const deletePromises = seriesEvents.map(event => api.delete(`/events/${event.id}`));
              await Promise.all(deletePromises);
              setSuccess(`Serie mit ${seriesEvents.length} Terminen gelöscht`);
              await refreshEvents();
              await refreshCancelled();
            } catch (error: any) {
              if (error.response?.data?.error) {
                setError(error.response.data.error);
              } else {
                setError('Fehler beim Löschen der Serie');
              }
            }
          }
        }
      ]
    });
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
    if (!isOnline) return;
    const eventDate = new Date(event.event_date).toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const konfiCount = (event.registered_count || 0) - (event.teamer_count || 0);
    presentActionSheet({
      header: `"${event.name}" absagen?`,
      subHeader: `${eventDate} | ${konfiCount} Konfis angemeldet`,
      buttons: [
        {
          text: 'Event absagen',
          role: 'destructive',
          icon: ban,
          handler: async () => {
            try {
              await api.put(`/events/${event.id}/cancel`, {
                notification_message: 'Das Event wurde leider abgesagt.'
              });
              setSuccess(`Event "${event.name}" wurde abgesagt`);
              await refreshEvents();
              await refreshCancelled();
            } catch (error: any) {
              setError(error.response?.data?.error || 'Fehler beim Absagen');
            }
          }
        },
        { text: 'Abbrechen', role: 'cancel' }
      ]
    });
  };

  const handleSelectEvent = (event: Event) => {
    // Anstatt den State zu ändern, navigieren wir zur neuen Route
    router.push(`/admin/events/${event.id}`);
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
    presentEventModal('single');
  };

  // Suchfilter
  const applySearch = (eventList: Event[]) => {
    if (!searchText) return eventList;
    const lower = searchText.toLowerCase();
    return eventList.filter(e =>
      e.name?.toLowerCase().includes(lower) ||
      e.title?.toLowerCase().includes(lower) ||
      e.location?.toLowerCase().includes(lower)
    );
  };

  // Rollen-basierte Berechtigungen (org_admin, admin UND teamer dürfen Events verwalten)
  const canManageEvents = ['org_admin', 'admin', 'teamer'].includes(user?.role_name || '');
  const canCreate = canManageEvents;
  const canEdit = canManageEvents;
  const canDelete = canManageEvents;
  const canCopy = canCreate;
  const canCancel = canEdit;


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
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">
              Events
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshAllEvents();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {!loading && (
          <IonList className="app-section-inset" inset={true}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={searchOutline} />
              </div>
              <IonLabel>Suche & Filter</IonLabel>
            </IonListHeader>
            <IonSearchbar
              className="ios26-searchbar-classic"
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value || '')}
              placeholder="Events durchsuchen"
              debounce={300}
            />
          </IonList>
        )}

        {loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <EventsView
            events={
              activeTab === 'all' ? applySearch(filterByJahrgang(getAllEvents())) :
              activeTab === 'konfirmation' ? applySearch(filterByJahrgang(getKonfirmationEvents())) :
              applySearch(filterByJahrgang(getFutureEvents()))
            }
            onUpdate={refreshEvents}
            onAddEventClick={handleAddEventClick}
            onSelectEvent={handleSelectEvent}
            onDeleteEvent={canDelete ? handleDeleteEvent : undefined}
            onCopyEvent={canCopy ? handleCopyEvent : undefined}
            onCancelEvent={canCancel ? handleCancelEvent : undefined}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            eventCounts={{
              all: applySearch(filterByJahrgang(getAllEvents())).length,
              upcoming: applySearch(filterByJahrgang(getFutureEvents())).length,
              konfirmation: applySearch(filterByJahrgang(getKonfirmationEvents())).length
            }}
            jahrgaenge={jahrgaenge || []}
            selectedJahrgang={selectedJahrgang}
            onJahrgangChange={setSelectedJahrgang}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminEventsPage;