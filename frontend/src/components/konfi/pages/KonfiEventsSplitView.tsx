import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';
import KonfiEventsPage from './KonfiEventsPage';
import EventDetailView from '../views/EventDetailView';

// iPad-Split-View fuer den Konfi-Events-Bereich.
// Gleiches Muster wie AdminKonfisSplitView (eigenes Flex-Layout statt
// IonSplitPane, ion-page-invisible per Ref entfernen, useIsWide schaltet
// Split/Route). Siehe AdminKonfisSplitView fuer die ausfuehrliche Begruendung.

const LG_BREAKPOINT = 992;
const SIDE_WIDTH = 380;

const useIsWide = () => {
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= LG_BREAKPOINT : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    setIsWide(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isWide;
};

const KonfiEventsSplitView: React.FC = () => {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const isWide = useIsWide();
  const masterRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    [masterRef.current, detailRef.current].forEach((host) => {
      host?.querySelectorAll('.ion-page-invisible').forEach((el) => {
        el.classList.remove('ion-page-invisible');
      });
    });
  });

  const handleSelect = (eventId: number) => {
    if (isWide) {
      setSelectedEventId(eventId);
    } else {
      window.location.assign(`/konfi/events/${eventId}`);
    }
  };

  if (!isWide) {
    return <KonfiEventsPage />;
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div
        ref={masterRef}
        style={{
          width: SIDE_WIDTH,
          flexShrink: 0,
          position: 'relative',
          borderRight: '1px solid var(--app-hairline, #e5e5ea)',
        }}
      >
        <KonfiEventsPage onSelectEvent={handleSelect} selectedEventId={selectedEventId} />
      </div>

      <div ref={detailRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {selectedEventId ? (
          <EventDetailView
            key={selectedEventId}
            eventId={selectedEventId}
            onBack={() => setSelectedEventId(null)}
            hideBackButton
          />
        ) : (
          <IonPage>
            <IonContent className="app-gradient-background">
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: 'var(--ion-color-medium, #8e8e93)',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <IonIcon icon={calendarOutline} style={{ fontSize: '3rem', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Wähle links ein Event aus, um die Details zu sehen.
                </p>
              </div>
            </IonContent>
          </IonPage>
        )}
      </div>
    </div>
  );
};

export default KonfiEventsSplitView;
