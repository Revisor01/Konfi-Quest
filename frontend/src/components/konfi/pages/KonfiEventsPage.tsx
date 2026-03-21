import React, { useState, useEffect, useCallback } from 'react';
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
import { qrCodeOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import api from '../../../services/api';
import EventsView from '../views/EventsView';
import QRScannerModal from '../modals/QRScannerModal';
import LoadingSpinner from '../../common/LoadingSpinner';
import { Event } from '../../../types/event';

const KonfiEventsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('konfi-events');
  const history = useHistory();

  // --- useOfflineQuery: Events ---
  const { data: events, loading, refresh } = useOfflineQuery<Event[]>(
    'konfi:events:' + user?.id,
    () => api.get('/konfi/events').then(r => r.data),
    { ttl: CACHE_TTL.EVENTS }
  );

  const [presentScannerModal, dismissScannerModal] = useIonModal(QRScannerModal, {
    onClose: () => dismissScannerModal(),
    onSuccess: (_eventId: number, eventName: string) => {
      dismissScannerModal();
      setSuccess(`Eingecheckt bei: ${eventName}`);
      refresh();
    }
  });

  // State
  const [activeTab, setActiveTab] = useState<'meine' | 'alle' | 'konfirmation'>('meine');

  // Subscribe to live updates for events
  useLiveRefresh('events', refresh);

  // Event-Listener für Updates aus EventDetailView (legacy support)
  useEffect(() => {
    const handleEventsUpdated = () => {
      refresh();
    };

    window.addEventListener('events-updated', handleEventsUpdated);

    return () => {
      window.removeEventListener('events-updated', handleEventsUpdated);
    };
  }, [refresh]);

  // Get filtered events by tab
  const getFilteredEvents = () => {
    const now = new Date();
    const allEvents = events || [];

    let filteredEvents;
    switch (activeTab) {
      case 'meine':
        // Persönliche Event-Historie: alle Events wo angemeldet (inkl. vergangene, abgesagte, opted_out)
        filteredEvents = allEvents.filter(event =>
          event.is_registered || event.booking_status === 'opted_out'
        );
        break;
      case 'alle':
        // NUR zukünftige Events (keine vergangenen), keine Konfirmation
        filteredEvents = allEvents.filter(event =>
          new Date(event.event_date) >= now &&
          !event.category_names?.toLowerCase().includes('konfirmation')
        );
        break;
      case 'konfirmation':
        filteredEvents = allEvents.filter(event =>
          event.category_names?.toLowerCase().includes('konfirmation')
        );
        break;
      default:
        filteredEvents = allEvents;
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
          <IonButtons slot="end">
            <IonButton onClick={() => presentScannerModal()}>
              <IonIcon icon={qrCodeOutline} />
            </IonButton>
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

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await refresh();
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
            onUpdate={refresh}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;
