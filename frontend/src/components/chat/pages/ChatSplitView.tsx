import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { chatbubblesOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import ChatOverviewPage from './ChatOverviewPage';
import ChatRoomView from '../views/ChatRoomView';

// iPad-Split-View fuer den Chat-Bereich (alle Rollen).
//
// Gleiches Muster wie AdminKonfisSplitView: eigenes Flex-Layout statt
// IonSplitPane (das in Ionic React 8 die Side-Pane nicht zuverlaessig erkennt).
//
// - Breit (>=lg, iPad Landscape): Raumliste links + Raum-Ansicht rechts.
// - Schmal (iPhone, iPad Portrait): nur die Raumliste; Auswahl navigiert wie
//   bisher per Route auf /{rolle}/chat/room/:roomId.

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

const ChatSplitView: React.FC = () => {
  const { user } = useApp();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const isWide = useIsWide();
  const masterRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Verschachtelte IonPages von 'ion-page-invisible' befreien (sie werden nicht
  // vom RouterOutlet verwaltet -> blieben sonst unsichtbar). Siehe
  // AdminKonfisSplitView fuer die ausfuehrliche Begruendung.
  useEffect(() => {
    [masterRef.current, detailRef.current].forEach((host) => {
      host?.querySelectorAll('.ion-page-invisible').forEach((el) => {
        el.classList.remove('ion-page-invisible');
      });
    });
  });

  const basePath = user?.type === 'admin' ? '/admin' : user?.type === 'teamer' ? '/teamer' : '/konfi';

  const handleSelect = (roomId: number) => {
    if (isWide) {
      setSelectedRoomId(roomId);
    } else {
      window.location.assign(`${basePath}/chat/room/${roomId}`);
    }
  };

  // Schmaler Screen: kein Split — Raumliste navigiert per Route
  // (onSelectRoom NICHT setzen -> Default-Routing greift).
  if (!isWide) {
    return <ChatOverviewPage />;
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* MASTER: Raumliste, feste Breite */}
      <div
        ref={masterRef}
        style={{
          width: SIDE_WIDTH,
          flexShrink: 0,
          position: 'relative',
          borderRight: '1px solid var(--app-hairline, #e5e5ea)',
        }}
      >
        <ChatOverviewPage onSelectRoom={handleSelect} selectedRoomId={selectedRoomId} />
      </div>

      {/* DETAIL: Raum-Ansicht rechts */}
      <div ref={detailRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {selectedRoomId ? (
          <ChatRoomView
            key={selectedRoomId}
            roomId={selectedRoomId}
            onBack={() => setSelectedRoomId(null)}
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
                <IonIcon icon={chatbubblesOutline} style={{ fontSize: '3rem', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Wähle links einen Chat aus, um die Nachrichten zu sehen.
                </p>
              </div>
            </IonContent>
          </IonPage>
        )}
      </div>
    </div>
  );
};

export default ChatSplitView;
