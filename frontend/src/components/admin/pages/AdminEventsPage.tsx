import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonCard,
  IonCardContent,
  useIonModal,
  useIonActionSheet,
  useIonAlert,
  useIonRouter
} from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren
import { useLocation } from 'react-router-dom';
// useLocation für die Auswertung von ?segment=... (React Router v5 API)
import { add, ban, closeOutline, informationCircleOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh, useLiveUpdate } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import EventsView from '../EventsView';
import ActivityRequestsView from '../ActivityRequestsView';
import LoadingSpinner from '../../common/LoadingSpinner';
import EventModal from '../modals/EventModal';
import ActivityRequestModal from '../modals/ActivityRequestModal';
import { Event } from '../../../types/event';
import { triggerPullHaptic } from '../../../utils/haptics';

interface ActivityRequest {
  id: number;
  konfi_id: number;
  konfi_name: string;
  jahrgang_name?: string;
  activity_id: number;
  activity_name: string;
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by?: number;
  created_at: string;
  updated_at: string;
}

interface AdminEventsPageProps {
  // Im iPad-Split-View setzt der Master die Auswahl als State statt zu
  // navigieren. Fehlt der Callback (iPhone/Portrait), wird wie bisher per
  // Route auf die Event-Detail-Seite navigiert.
  onSelectEvent?: (eventId: number) => void;
  selectedEventId?: number | null;
}

const AdminEventsPage: React.FC<AdminEventsPageProps> = ({ onSelectEvent, selectedEventId }) => {
  const { user, setSuccess, setError, isOnline } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-events');
  const router = useIonRouter();
  const routerLocation = useLocation();
  const { triggerRefresh } = useLiveUpdate();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();

  // Oberste Segment-Ebene: Events oder Aktivitäten.
  const [mainSegment, setMainSegment] = useState<'events' | 'antraege'>('events');

  // Query-Parameter ?segment=antraege auswerten — kommt vom Redirect der alten
  // Route /admin/requests und damit aus bestehenden Deep-Links.
  useEffect(() => {
    const segment = new URLSearchParams(routerLocation.search).get('segment');
    if (segment === 'antraege') {
      setMainSegment('antraege');
    } else if (segment === 'events') {
      setMainSegment('events');
    }
  }, [routerLocation.search]);


  // Offline-Query: Events
  const { data: allEventsRaw, loading: eventsLoading, refresh: refreshEvents, refreshLive: refreshEventsLive } = useOfflineQuery<Event[]>(
    'admin:events:' + user?.organization_id,
    async () => { const res = await api.get('/events'); return res.data; },
    { ttl: CACHE_TTL.EVENTS }
  );
  const events = allEventsRaw?.filter((e: Event) => e.registration_status !== 'cancelled') || [];

  // Offline-Query: Abgesagte Events
  const { data: cancelledEvents, refresh: refreshCancelled, refreshLive: refreshCancelledLive } = useOfflineQuery<Event[]>(
    'admin:events-cancelled:' + user?.organization_id,
    async () => { const res = await api.get('/events/cancelled'); return res.data; },
    { ttl: CACHE_TTL.SETTINGS }
  );

  // Offline-Query: Jahrgänge
  const { data: jahrgaenge, refresh: refreshJahrgaenge } = useOfflineQuery<Array<{id: number; name: string}>>(
    'admin:jahrgaenge:' + user?.organization_id,
    async () => { const res = await api.get('/admin/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  // Offline-Query: Aktivitäten (aus AdminActivityRequestsPage uebernommen)
  const { data: requests, loading: requestsLoading, refresh: refreshRequests, refreshLive: refreshRequestsLive } = useOfflineQuery<ActivityRequest[]>(
    'admin:requests:' + user?.organization_id,
    async () => { const res = await api.get('/admin/activities/requests'); return res.data; },
    { ttl: CACHE_TTL.REQUESTS }
  );

  // State
  const loading = eventsLoading;
  const [activeTab, setActiveTab] = useState<'aktuell' | 'verbuchen' | 'vergangen'>('aktuell');
  const [selectedJahrgang, setSelectedJahrgang] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

  const [editEvent, setEditEvent] = useState<Event | null>(null);

  // --- Aktivitäten-State ---
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);
  const [modalRequestId, setModalRequestId] = useState<number | null>(null);

  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  // Haelt den "ungespeicherte Änderungen"-Stand des EventModals, damit canDismiss
  // auch Swipe-/Backdrop-Schliessen abfangen und nachfragen kann (nicht nur der X-Button).
  const eventModalDirtyRef = useRef(false);

  const [presentEventModalHook, dismissEventModalHook] = useIonModal(EventModal, {
    event: editEvent,
    onDirtyChange: (dirty: boolean) => { eventModalDirtyRef.current = dirty; },
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

  const [presentRequestModalHook, dismissRequestModalHook] = useIonModal(ActivityRequestModal, {
    requestId: modalRequestId,
    onClose: () => {
      dismissRequestModalHook();
      setSelectedRequest(null);
      setModalRequestId(null);
    },
    onSuccess: () => {
      dismissRequestModalHook();
      setSelectedRequest(null);
      setModalRequestId(null);
      refreshRequests();
      // Genehmigen/Ablehnen ändert die Anzahl offener Anträge -> 'requests'
      // triggern, damit das Events-Tab-Badge (BadgeContext) sofort aktualisiert
      // statt erst beim 30s-Poll.
      triggerRefresh('requests');
      // Genehmigen/Ablehnen ändert Konfi-Punkte -> Admin-Konfi-Liste live
      // aktualisieren, damit man nicht manuell refreshen muss.
      triggerRefresh('konfis');
    }
  });

  // Faengt JEDEN Schliess-Weg ab (Swipe, Backdrop, programmatisch): bei
  // ungespeicherten Änderungen erst nachfragen, sonst direkt schliessen lassen.
  const eventModalCanDismiss = async (): Promise<boolean> => {
    if (!eventModalDirtyRef.current) return true;
    return new Promise<boolean>((resolve) => {
      let decided = false;
      const decide = (v: boolean) => { decided = true; resolve(v); };
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        backdropDismiss: false,
        buttons: [
          { text: 'Abbrechen', role: 'cancel', handler: () => decide(false) },
          { text: 'Verwerfen', role: 'destructive', handler: () => decide(true) }
        ],
        // Fallback: schließt der Alert ohne Button (z.B. Hardware-Back),
        // niemals das canDismiss-Promise hängen lassen -> als "nicht verwerfen".
        onDidDismiss: () => { if (!decided) resolve(false); }
      });
    });
  };

  // Memoized refresh function for live updates
  const refreshAllEvents = useCallback(() => {
    refreshEventsLive();
    refreshCancelledLive();
  }, [refreshEventsLive, refreshCancelledLive]);

  // Subscribe to live updates for events + requests
  useLiveRefresh('events', refreshAllEvents);
  useLiveRefresh('requests', refreshRequestsLive);

  const filterByJahrgang = (eventList: Event[]) => {
    if (!selectedJahrgang) return eventList;
    return eventList.filter(event => {
      if (!event.jahrgang_ids) return false;
      const ids = event.jahrgang_ids.split(',').map(id => parseInt(id.trim(), 10));
      return ids.includes(selectedJahrgang);
    });
  };

  // Massgeblicher Zeitpunkt für "vergangen?": bei mehrtaegigen Events das ENDE
  // (event_end_time), sonst der Start. So rutscht ein Event erst NACH dem letzten
  // Tag aus "Aktuell" und ins "Verbuchen"/"Vergangen" — nicht schon nach dem Start.
  const eventEndDate = (event: Event) =>
    new Date(event.event_end_time || event.event_date);

  // Tab "Aktuell": zukuenftige/laufende Events, ABGESAGTE EINGESCHLOSSEN.
  // Sie stehen dort durchgestrichen — verschwinden sie ganz, sieht die Leitung
  // nicht mehr, dass der Termin existierte und abgesagt wurde (Fund 22.08.2026).
  // `events` enthält sie nicht mehr (Zeile mit dem cancelled-Filter), deshalb
  // kommen sie aus der separaten Abfrage dazu.
  const getAktuellEvents = () => {
    const now = new Date();
    const abgesagteZukuenftig = (cancelledEvents || []).filter(e => eventEndDate(e) >= now);
    const list = [...events, ...abgesagteZukuenftig].filter(event => eventEndDate(event) >= now);
    return list.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  };

  // Tab "Verbuchen": beendete Events mit offenen (unverbuchten) Buchungen.
  const getVerbuchenEvents = () => {
    const now = new Date();
    const list = events.filter(event => {
      const hasPendingBookings = !!event.pending_bookings_count && event.pending_bookings_count > 0;
      return eventEndDate(event) < now && hasPendingBookings && event.registration_status !== 'cancelled';
    });
    return list.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  };

  // Tab "Vergangen": beendete Events ohne offene Buchungen (fertig verbucht),
  // plus die bereits vergangenen abgesagten Termine.
  const getVergangenEvents = () => {
    const now = new Date();
    const abgesagteVergangen = (cancelledEvents || []).filter(e => eventEndDate(e) < now);
    const list = [...events, ...abgesagteVergangen].filter(event => {
      const hasPendingBookings = !!event.pending_bookings_count && event.pending_bookings_count > 0;
      return eventEndDate(event) < now && !hasPendingBookings;
    });
    return list.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
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
        // Dieser Termin + alle späteren der Serie (für "ab hier löschen", z.B. falsch
        // angelegte Serie oder Reihe, die früher endet)
        const followingEvents = [...seriesEvents, event].filter(e =>
          new Date(e.event_date).getTime() >= new Date(event.event_date).getTime()
        );

        // Show action sheet for series deletion
        const buttons: any[] = [
          {
            text: 'Nur diesen Termin löschen',
            icon: 'trash-outline',
            handler: () => deleteSingleEvent(event)
          }
        ];
        // Nur anbieten, wenn es nach diesem Termin noch weitere gibt und nicht
        // ohnehin die ganze Serie gemeint ist
        if (followingEvents.length > 1 && followingEvents.length < seriesEvents.length + 1) {
          buttons.push({
            text: `Diesen + alle folgenden löschen (${followingEvents.length} Termine)`,
            icon: 'trash-outline',
            role: 'destructive',
            handler: () => deleteSeriesEvents(followingEvents, 'Diesen und alle folgenden Termine')
          });
        }
        buttons.push(
          {
            text: `Ganze Serie löschen (${seriesEvents.length + 1} Termine)`,
            icon: 'warning-outline',
            role: 'destructive',
            handler: () => deleteSeriesEvents([...seriesEvents, event], 'die ganze Serie')
          },
          {
            text: 'Abbrechen',
            role: 'cancel'
          }
        );
        presentActionSheet({
          header: `Serie-Event löschen`,
          subHeader: `"${event.name}" ist Teil einer Serie mit ${seriesEvents.length + 1} Terminen.`,
          buttons
        });
        return;
      }
    }

    // Normal single event deletion
    deleteSingleEvent(event);
  };

  // Events mit Anmeldungen sind loeschbar — mit ausdruecklicher Rueckfrage und
  // Push an alle Angemeldeten (User-Entscheid 10.08.). Fachlich wäre "absagen"
  // sauberer, praktisch ist Löschen das, was gemeint ist.
  const deleteSingleEvent = async (event: Event) => {
    const anmeldungen = (event.registered_count || 0) + (event.waitlist_count || 0);
    presentAlert({
      header: 'Event löschen',
      message: anmeldungen > 0
        ? `"${event.name}" hat ${anmeldungen} Anmeldung${anmeldungen === 1 ? '' : 'en'}. Beim Löschen werden alle Angemeldeten benachrichtigt. Das lässt sich nicht rückgängig machen.`
        : `Event "${event.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              // force=true: der Nutzer hat die Anzahl gesehen und bestaetigt.
              await api.delete(`/events/${event.id}?force=true`);
              await refreshEvents();
              await refreshCancelled();
            } catch (error: any) {
              setError(error.response?.data?.error || 'Fehler beim Löschen des Events');
            }
          }
        }
      ]
    });
  };

  // Löscht mehrere Serien-Termine (ganze Serie oder "diesen + alle folgenden").
  // Einzelne Termine mit Anmeldungen/Verbuchung blockieren mit 409 — der Rest
  // wird trotzdem gelöscht (Promise.allSettled), Fehler werden gesammelt gemeldet.
  const deleteSeriesEvents = async (seriesEvents: Event[], label: string) => {
    presentAlert({
      header: 'Serie löschen',
      message: `Wirklich ${label} mit ${seriesEvents.length} Terminen löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            const results = await Promise.allSettled(
              seriesEvents.map(event => api.delete(`/events/${event.id}?force=true`))
            );
            await refreshEvents();
            await refreshCancelled();
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
              const firstError = (failed[0] as PromiseRejectedResult).reason?.response?.data?.error;
              setError(
                `${failed.length} von ${seriesEvents.length} Terminen konnten nicht gelöscht werden` +
                (firstError ? `: ${firstError}` : '')
              );
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
      presentingElement: presentingElement,
      canDismiss: eventModalCanDismiss,
      backdropDismiss: false
    });
  };

  const handleCancelEvent = async (event: Event) => {
    if (!isOnline) return;
    const eventDate = new Date(event.event_date).toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    // registered_count IST bereits die Konfi-Zahl: Das Backend filtert
    // Teamer heraus (events.js:145, seit Migration 120) und zaehlt sie in
    // teamer_count getrennt. Ein Abzug zog sie ein zweites Mal ab und
    // machte aus 19 Konfis 15 (Bugreport 25.08.2026).
    const konfiCount = (event.registered_count || 0);
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
    // Split-View (iPad): Auswahl an den Wrapper melden, KEINE Navigation.
    // Sonst (iPhone/Portrait): wie bisher zur Detail-Route navigieren.
    if (onSelectEvent) {
      onSelectEvent(event.id);
    } else {
      router.push(`/admin/events/${event.id}`);
    }
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
      presentingElement: presentingElement,
      canDismiss: eventModalCanDismiss,
      backdropDismiss: false
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

  // --- Aktivitäten-Handler ---
  const handleResetRequest = async (request: ActivityRequest) => {
    // Feminine Endung, seit aus "Antrag" "Aktivität" wurde.
    const statusText = request.status === 'approved' ? 'Genehmigte' : 'Abgelehnte';
    presentAlert({
      header: 'Aktivität zurücksetzen',
      message: `${statusText} Aktivität von "${request.konfi_name}" zurücksetzen und wieder als offen markieren?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Zurücksetzen',
          handler: async () => {
            try {
              await api.put(`/admin/activities/requests/${request.id}/reset`);
              await refreshRequests();
              // Zuruecksetzen macht die Aktivität wieder offen -> Badge muss
              // hochzaehlen; Punkte werden zurückgenommen -> Konfi-Liste.
              triggerRefresh('requests');
              triggerRefresh('konfis');
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Zurücksetzen der Aktivität');
            }
          }
        }
      ]
    });
  };

  const handleSelectRequest = (request: ActivityRequest) => {
    setSelectedRequest(request);
    setModalRequestId(request.id);
    presentRequestModalHook({
      presentingElement: presentingElement
    });
  };

  // Rollen-basierte Berechtigungen (org_admin, admin UND teamer dürfen Events verwalten)
  const canManageEvents = ['org_admin', 'admin', 'teamer'].includes(user?.role_name || '');
  const canCreate = canManageEvents;
  const canEdit = canManageEvents;
  const canDelete = canManageEvents;
  const canCopy = canCreate;
  const canCancel = canEdit;

  const isAntraege = mainSegment === 'antraege';
  // Der Titel folgt dem Segment — siehe KonfiEventsPage: im iOS-Modus
  // nachgemessen, der Large-Title springt beim Umschalten nicht mehr.
  const pageTitle = isAntraege ? 'Aktivitäten' : 'Events';

  // Oberste Segment-Ebene (Events | Aktivitäten) + einmaliger Umzugs-Hinweis. Wird
  // als headerSlot an die jeweils aktive View gereicht und dort DIREKT UNTER
  // dem Grafik-/Stats-Header gerendert (gleiches Muster wie KonfiEventsPage).
  const mainSegmentSlot = (
    <>
      <div className="app-segment-wrapper">
        <IonSegment
          value={mainSegment}
          onIonChange={(e) => setMainSegment(e.detail.value as 'events' | 'antraege')}
        >
          <IonSegmentButton value="events">
            <IonLabel>Events</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="antraege">
            <IonLabel>Aktivitäten</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

    </>
  );

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>{pageTitle}</IonTitle>
          <IonButtons slot="end">
            {!isAntraege && canCreate && (
              <IonButton aria-label="Neues Event anlegen" onClick={handleAddEventClick}>
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
              {pageTitle}
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          if (isAntraege) {
            await refreshRequests();
          } else {
            await refreshAllEvents();
          }
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Oberste Segment-Ebene (Events | Aktivitäten) + Umzugs-Hinweis werden als
            headerSlot an die jeweilige View gereicht und dort DIREKT UNTER dem
            Grafik-/Stats-Header gerendert - passend zur Konfi-Seitenstruktur. */}
        {isAntraege ? (
          requestsLoading ? (
            <LoadingSpinner message="Aktivitäten werden geladen..." />
          ) : (
            <ActivityRequestsView
              requests={requests || []}
              onUpdate={refreshRequests}
              onSelectRequest={handleSelectRequest}
              onResetRequest={handleResetRequest}
              headerSlot={mainSegmentSlot}
            />
          )
        ) : loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <EventsView
            events={
              activeTab === 'verbuchen' ? applySearch(filterByJahrgang(getVerbuchenEvents())) :
              activeTab === 'vergangen' ? applySearch(filterByJahrgang(getVergangenEvents())) :
              applySearch(filterByJahrgang(getAktuellEvents()))
            }
            onUpdate={refreshEvents}
            onAddEventClick={handleAddEventClick}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEventId}
            onDeleteEvent={canDelete ? handleDeleteEvent : undefined}
            onCopyEvent={canCopy ? handleCopyEvent : undefined}
            onCancelEvent={canCancel ? handleCancelEvent : undefined}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            eventCounts={{
              aktuell: applySearch(filterByJahrgang(getAktuellEvents())).length,
              verbuchen: applySearch(filterByJahrgang(getVerbuchenEvents())).length,
              vergangen: applySearch(filterByJahrgang(getVergangenEvents())).length
            }}
            jahrgaenge={jahrgaenge || []}
            selectedJahrgang={selectedJahrgang}
            onJahrgangChange={setSelectedJahrgang}
            searchText={searchText}
            onSearchChange={setSearchText}
            presentingElement={presentingElement}
            headerSlot={mainSegmentSlot}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminEventsPage;
