import React, { useEffect, useState } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { chatbubblesOutline } from 'ionicons/icons';
import { useIsTablet } from '../../../hooks/useIsTablet';
import ChatOverviewPage from './ChatOverviewPage';
import ChatRoomView from '../views/ChatRoomView';

/**
 * Chat-Einstieg mit Split-View auf breiten Bildschirmen.
 *
 * Schmaler Viewport (Telefon, iPad-Slide-Over): unveraendertes Verhalten —
 * ChatOverviewPage navigiert per Route auf /<rolle>/chat/room/:roomId.
 *
 * Breiter Viewport (Tablet quer/hoch): Raumliste links, geoeffneter Raum
 * rechts. Statt zu navigieren haelt diese Seite die Auswahl als State und
 * reicht sie ueber den bereits vorhandenen onSelectRoom/selectedRoomId-Vertrag
 * an die Uebersicht durch.
 */
const ChatSplitPage: React.FC = () => {
  const isTablet = useIsTablet();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Beim Wechsel auf schmal die Auswahl verwerfen: dort uebernimmt wieder die
  // Route die Raum-Anzeige, ein zurueckbleibender State wuerde beim naechsten
  // Verbreitern einen alten Raum aufblenden lassen.
  useEffect(() => {
    if (!isTablet) setSelectedRoomId(null);
  }, [isTablet]);

  if (!isTablet) {
    return <ChatOverviewPage />;
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* Master: feste Spaltenbreite, damit die Liste beim Drehen nicht springt. */}
      <div
        style={{
          width: '360px',
          flex: '0 0 360px',
          height: '100%',
          position: 'relative',
          borderRight: '1px solid rgba(0,0,0,0.12)'
        }}
      >
        <ChatOverviewPage
          onSelectRoom={setSelectedRoomId}
          selectedRoomId={selectedRoomId}
        />
      </div>

      {/* Detail: der geoeffnete Raum, oder ein Platzhalter solange keiner gewaehlt ist. */}
      <div style={{ flex: 1, height: '100%', position: 'relative', minWidth: 0 }}>
        {selectedRoomId ? (
          <ChatRoomView
            // key: erzwingt ein sauberes Neu-Mounten beim Raumwechsel. Ohne das
            // wuerden Nachrichten-State, Scroll-Position und Socket-Raum des
            // vorherigen Raums weiterleben.
            key={selectedRoomId}
            roomId={selectedRoomId}
            onBack={() => setSelectedRoomId(null)}
            hideBackButton
          />
        ) : (
          <IonPage>
            <IonContent className="app-gradient-background">
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: '#8e8e93',
                padding: '24px',
                textAlign: 'center'
              }}>
                <IonIcon icon={chatbubblesOutline} style={{ fontSize: '3rem', color: '#06b6d4', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Wähle links einen Chat aus.
                </p>
              </div>
            </IonContent>
          </IonPage>
        )}
      </div>
    </div>
  );
};

export default ChatSplitPage;
