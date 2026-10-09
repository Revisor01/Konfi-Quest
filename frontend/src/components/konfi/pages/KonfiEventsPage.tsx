import { fehlerText } from '../../../utils/fehler';
import React, { useState, useEffect } from 'react';
import { useAppLocation } from '../../../navigation/useAppLocation';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  useIonModal,
  useIonRouter,
  useIonAlert,
  useIonViewWillEnter
} from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren

// useLocation für die Auswertung von ?segment=... (React Router v5 API)
import { ICON_HINZUFUEGEN_GEFUELLT, ICON_SCANNEN } from '../../shared/icons';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import { useWartendeVorgaenge } from '../../../hooks/useWartendeVorgaenge';
import WartendeVorgaengeKarte from '../../shared/WartendeVorgaengeKarte';
import { removeDeliveredForEvents } from '../../../services/notifications';
import api from '../../../services/api';
import EventsView from '../views/EventsView';
import RequestsView from '../views/RequestsView';
import QRScannerModal from '../modals/QRScannerModal';
import ActivityRequestModal from '../modals/ActivityRequestModal';
import RequestDetailModal from '../modals/RequestDetailModal';
import LoadingSpinner from '../../common/LoadingSpinner';
import { Event } from '../../../types/event';
import { triggerPullHaptic } from '../../../utils/haptics';
// Kein eigener ActivityRequest mehr: Die Seite reicht die Antraege an
// RequestDetailModal weiter, und zwei gleichnamige Typen mit
// unterschiedlicher Nullbarkeit haben genau dort gebissen. Der Modal-Typ ist
// der genauere — er kennt Teamer-Antraege ohne Punkte und ohne Typ.
import type { ActivityRequest } from '../modals/RequestDetailModal';
import { datumKurz } from '../../../utils/dateUtils';
import { trackMitmachenAnsicht } from '../../../services/analytics';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebMitmachenMitglied from '../../shared/web/termine/WebMitmachenMitglied';
import { mitgliedSegmentAusAdresse, type EigenerAntragFilter, type KonfiEventFilter } from '../../shared/web/termine/terminFilter';
import { wahlVon } from '../../../seiten/beschreibung';
import { EIGENE_ANTRAEGE_START, KONFI_EVENTS, MITGLIED_BEREICHE } from '../../../seiten/mitmachenMitglied';
import WebKonfiEvents from '../web/termine/WebKonfiEvents';

// Einmaliger Hinweis nach dem Tab-Umbau: die Aktivitäten sind aus ihrem eigenen
// Tab in dieses Segment gewandert.


interface KonfiEventsPageProps {
  // Im iPad-Split-View setzt der Master die Auswahl als State statt zu
  // navigieren. Fehlt der Callback (iPhone/Portrait), wird wie bisher per
  // Route auf die Event-Detail-Seite navigiert.
  onSelectEvent?: (eventId: number) => void;
  selectedEventId?: number | null;
}

const KonfiEventsPage: React.FC<KonfiEventsPageProps> = ({ onSelectEvent, selectedEventId }) => {
  const { user, setSuccess, setError, isOnline } = useApp();
  const { pageRef, presentingElement } = useModalPage('konfi-events');
  const router = useIonRouter();
  const routerLocation = useAppLocation();
  const [presentAlert] = useIonAlert();
  // Im Browser ab 992 px zeigt die Seite ihre Web-Fassung (siehe unten).
  const breit = useBreitesLayout();

  // Oberste Segment-Ebene: Events oder Aktivitäten.
  const [mainSegment, setMainSegment] = useState<'events' | 'antraege'>('events');
  // Umschalten an der Leiste „Events | Aktivitäten" zählt als eigener
  // Bereich -- die Seite hat für beide Ansichten denselben Pfad
  // (services/analytics.ts, trackMitmachenAnsicht).
  const mitmachenAnsichtWechseln = (ansicht: 'events' | 'antraege') => {
    if (ansicht !== mainSegment) trackMitmachenAnsicht(ansicht);
    setMainSegment(ansicht);
  };

  // --- useOfflineQuery: Events ---
  const { data: events, loading, refresh, refreshLive } = useOfflineQuery<Event[]>(
    'konfi:events:' + user?.id,
    () => api.get('/konfi/events').then(r => r.data),
    { ttl: CACHE_TTL.EVENTS }
  );

  // --- useOfflineQuery: Aktivitäten (aus KonfiRequestsPage uebernommen) ---
  const { data: requests, loading: requestsLoading, refresh: refreshRequests, refreshLive: refreshRequestsLive } = useOfflineQuery<ActivityRequest[]>(
    'konfi:requests:' + user?.id,
    () => api.get('/konfi/requests').then(r => r.data),
    { ttl: CACHE_TTL.REQUESTS }
  );

  // Query-Parameter ?segment=antraege auswerten — kommt vom Redirect der alten
  // Route /konfi/requests und damit aus bestehenden Push-Deep-Links.
  useEffect(() => {
    const segment = new URLSearchParams(routerLocation.search).get('segment');
    if (segment === 'antraege') {
      setMainSegment('antraege');
      // Einstieg per Link (Push, alte Route /konfi/requests) direkt in die
      // Aktivitäten -- die Pfad-Messung zählt ihn sonst als „events".
      trackMitmachenAnsicht('antraege');
    } else if (segment === 'events') {
      setMainSegment('events');
    }
  }, [routerLocation.search]);

  // Beim Oeffnen der Events-Seite die zugestellten Event-Notifications aus dem
  // Mitteilungszentrum entfernen (Bereich wurde geoeffnet/gesehen).
  useIonViewWillEnter(() => {
    removeDeliveredForEvents();
  });

  const [presentScannerModal, dismissScannerModal] = useIonModal(QRScannerModal, {
    onClose: () => dismissScannerModal(),
    onSuccess: (_eventId: number, eventName: string) => {
      dismissScannerModal();
      setSuccess(`Eingecheckt bei: ${eventName}`);
      refresh();
    }
  });

  // State
  const [activeTab, setActiveTab] = useState<KonfiEventFilter>('meine');

  // --- Aktivitäten-State ---
  const [requestsTab, setRequestsTab] = useState<EigenerAntragFilter>(EIGENE_ANTRAEGE_START.konfi.app);
  const [selectedRequest, setSelectedRequest] = useState<ActivityRequest | null>(null);
  // Die Warteschlange meldet ihre Aenderungen jetzt selbst — vorher aktuali-
  // sierte sich die Anzeige nur, wenn die Antragsliste neu lud. Leerte sich
  // die Queue im Hintergrund, blieb "Wird gesendet..." stehen.
  const { wartend, gescheitert, vergessen } = useWartendeVorgaenge();

  const [presentRequestModal, dismissRequestModal] = useIonModal(
    ActivityRequestModal,
    {
      onClose: () => dismissRequestModal(),
      onSuccess: () => {
        dismissRequestModal();
        refreshRequests();
      }
    }
  );

  const [presentDetailModal, dismissDetailModal] = useIonModal(
    RequestDetailModal,
    {
      request: selectedRequest,
      onClose: () => {
        dismissDetailModal();
        setSelectedRequest(null);
      },
      onDelete: (request: ActivityRequest) => {
        dismissDetailModal();
        setSelectedRequest(null);
        handleDeleteRequest(request);
      }
    }
  );

  // Subscribe to live updates
  useLiveRefresh('events', refreshLive);
  useLiveRefresh('requests', refreshRequestsLive);

  const handleAddRequest = () => {
    presentRequestModal({
      presentingElement: pageRef.current || presentingElement || undefined
    });
  };

  const handleSelectRequest = (request: ActivityRequest) => {
    setSelectedRequest(request);
    presentDetailModal({
      presentingElement: pageRef.current || presentingElement || undefined
    });
  };

  const formatDate = (dateString: string) => {
    return datumKurz(dateString);
  };

  const handleDeleteRequest = (request: ActivityRequest) => {
    if (!isOnline) {
      setError('Löschen nicht möglich — du bist offline');
      return;
    }
    if (request.status !== 'pending') {
      setError('Nur wartende Aktivitäten können gelöscht werden');
      return;
    }

    presentAlert({
      header: 'Aktivität löschen',
      message: `Möchtest du deine Meldung für "${request.activity_name}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/konfi/requests/${request.id}`);
              refreshRequests();
            } catch (error) {
              setError(fehlerText(error, 'Fehler beim Löschen der Aktivität'), { ort: 'antrag-loeschen-konfi', fehler: error });
            }
          }
        }
      ]
    });
  };

  // Get filtered events by tab
  const getFilteredEvents = () => {
    const now = new Date();
    const allEvents = events || [];

    // Die Reiter rechnen aus der gemeinsamen Beschreibung (seiten/mitmachenMitglied.ts).
    // „Meine": jede eigene Buchung, egal in welchem Zustand (zaehltAlsMeiner --
    // vorher stand die Regel hier, in EventsView und in TeamerEventsPage in drei
    // Varianten, und an jeder Stelle fehlte etwas anderes). „Alle": was noch
    // kommt, ohne Konfirmation; bis 09.10.2026 fiel hier ein laufendes
    // mehrtaegiges Event schon nach seinem ersten Tag heraus (event_date statt
    // istVergangen), im Browser nicht.
    const filteredEvents = allEvents.filter((e) => wahlVon(KONFI_EVENTS, activeTab).passt?.(e) ?? true);

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
    // Split-View (iPad): Auswahl an den Wrapper melden, KEINE Navigation.
    // Sonst (iPhone/Portrait): wie bisher zur Detail-Route navigieren.
    if (onSelectEvent) {
      onSelectEvent(event.id);
    } else {
      router.push(`/konfi/events/${event.id}`);
    }
  };

  const isAntraege = mainSegment === 'antraege';
  // Der Titel folgt dem Segment. Ein frueherer Anlauf wurde zurueckgenommen,
  // weil der Large-Title dabei sprang — damals hing der Grafik-Header noch auf
  // Page-Ebene. Seit er in der View sitzt, ist das nicht mehr so: im
  // iOS-Modus nachgemessen, Titel (y=12), Large-Title (y=75) und
  // Condense-Header (52 px) bleiben beim Umschalten unveraendert.
  const pageTitle = isAntraege ? 'Aktivitäten' : 'Events';

  // Oberste Segment-Ebene (Events | Aktivitäten). Wird
  // als headerSlot an die jeweils aktive View gereicht und dort DIREKT UNTER
  // dem Grafik-/Stats-Header gerendert (Reihenfolge wie bei Badges/Challenges:
  // Header, dann Segment, dann Inhalt) - kein eigener Header auf Page-Ebene,
  // damit der Grafik-Header beim Umschalten nicht springt.
  const mainSegmentSlot = (
    <>
      <div className="app-segment-wrapper">
        <IonSegment
          value={mainSegment}
          onIonChange={(e) => mitmachenAnsichtWechseln(e.detail.value as 'events' | 'antraege')}
        >
          {MITGLIED_BEREICHE.map((b) => (
            <IonSegmentButton key={b.schluessel} value={b.schluessel}>
              <IonLabel>{b.label}</IonLabel>
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>

    </>
  );

  // Zwei Gesichter, eine Seite (docs/planung/web-alle-bereiche.md,
  // Entscheidung 1): im Browser ab 992 px die Web-Fassung -- Events als Karten
  // im Raster, die eigenen Aktivitäten als Tabelle --, sonst die Darstellung
  // der App, unverändert. Daten, Rechte und Funktionen (QR-Code scannen,
  // Aktivität melden, ansehen, löschen) sind dieselben.
  if (breit) {
    return (
      <WebMitmachenMitglied
        rolle="konfi"
        basisPfad="/konfi/events"
        segment={mitgliedSegmentAusAdresse(routerLocation.search)}
        pageRef={pageRef}
        presentingElement={presentingElement}
        eventsInhalt={<WebKonfiEvents events={events || []} />}
        eventsLaden={loading}
        antraege={requests || []}
        antraegeLaden={requestsLoading}
        standardFilterAntraege={EIGENE_ANTRAEGE_START.konfi.web}
        wartend={wartend}
        gescheitert={gescheitert}
        onVergessen={(id) => { void vergessen(id); }}
        onScannen={() => presentScannerModal()}
        onNeueAktivitaet={handleAddRequest}
        onAntragOeffnen={handleSelectRequest}
        onAntragLoeschen={handleDeleteRequest}
        neuLaden={refresh}
        antraegeNeuLaden={refreshRequests}
      />
    );
  }

  return (
    <IonPage ref={pageRef}>
      <AppKopfzeile
        titel={pageTitle}
        rechts={isAntraege ? (
          <IonButton onClick={handleAddRequest} aria-label="Neue Aktivität melden">
            <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
          </IonButton>
        ) : (
          <IonButton onClick={() => presentScannerModal()} aria-label="QR-Code scannen">
            {/* DASSELBE SYMBOL WIE BEIM TEAM (26.09.2026, Simons Befund:
                "Symbol zum QR Code bei Teamer und Konfi unter Events oben ist
                nicht gleich. Es geht um die Event Liste!").
                Beide Knoepfe oeffnen den Scanner und tragen dieselbe
                Beschriftung -- der Konfi zeigte dafuer ICON_QRCODE (das
                Code-Bild), das Team ICON_SCANNEN (der Scan-Rahmen). Gemeint
                ist das Scannen, also gilt ICON_SCANNEN. ICON_QRCODE bleibt,
                wo ein Code ANGEZEIGT wird (Termin-Detailansicht des Teams). */}
            <IonIcon icon={ICON_SCANNEN} />
          </IonButton>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={pageTitle} />

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          if (isAntraege) {
            await refreshRequests();
          } else {
            await refresh();
          }
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Oberste Segment-Ebene (Events | Aktivitäten) wird als
            headerSlot an die jeweilige View gereicht und dort DIREKT UNTER dem
            Grafik-/Stats-Header gerendert - passend zur Seitenstruktur der
            anderen Tabs (Badges, Challenges: Header, dann Segment, dann Inhalt). */}
        {isAntraege ? (
          requestsLoading ? (
            <LoadingSpinner message="Aktivitäten werden geladen..." />
          ) : (
            <RequestsView
              requests={requests || []}
              onDeleteRequest={handleDeleteRequest}
              onSelectRequest={handleSelectRequest}
              activeTab={requestsTab}
              onTabChange={setRequestsTab}
              formatDate={formatDate}
              headerSlot={
                <>
                  {mainSegmentSlot}

                  {/* Offline-Warteschlange: was noch aussteht und was scheiterte */}
                  <WartendeVorgaengeKarte
                    wartend={wartend}
                    gescheitert={gescheitert}
                    onVergessen={vergessen}
                  />
                </>
              }
            />
          )
        ) : loading ? (
          <LoadingSpinner message="Events werden geladen..." />
        ) : (
          <EventsView
            events={getFilteredEvents()}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEventId}
            presentingElement={presentingElement}
            headerSlot={mainSegmentSlot}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiEventsPage;
