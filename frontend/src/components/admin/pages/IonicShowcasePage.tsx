import React, { useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonListHeader, IonLabel, IonItem, IonCard, IonCardContent,
  IonRange, IonSegment, IonSegmentButton, IonSegmentView, IonSegmentContent,
  IonRefresher, IonRefresherContent, IonIcon, IonButton, IonSearchbar,
  IonBadge, IonNote, useIonModal
} from '@ionic/react';
import {
  sparkles, colorPalette, resizeOutline, searchOutline,
  refreshOutline, handLeftOutline, layersOutline, swapHorizontalOutline,
  arrowBack
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Demo Modal mit Drag Events
const DemoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Card Modal mit Drag Events</IonTitle>
        <IonButtons slot="end">
          <IonButton onClick={onClose}>Fertig</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>Zieh dieses Modal nach unten — die neuen Drag Events aus Ionic 8.8 melden Start/Ende.</p>
      <p>Oeffne die Konsole um die Events zu sehen.</p>
    </IonContent>
  </IonPage>
);

const IonicShowcasePage: React.FC = () => {
  const [rangeValue, setRangeValue] = useState<{ lower: number; upper: number }>({ lower: 20, upper: 80 });
  const [singleRange, setSingleRange] = useState(50);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [segment, setSegment] = useState('features');
  const [pullStatus, setPullStatus] = useState('');
  const contentRef = useRef<HTMLIonContentElement>(null);

  const [presentModal, dismissModal] = useIonModal(DemoModal, {
    onClose: () => dismissModal()
  });

  const handleRefresh = async (e: CustomEvent) => {
    setPullStatus('Refreshing...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    setPullStatus('Fertig!');
    (e.detail as any).complete();
    setTimeout(() => setPullStatus(''), 2000);
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin/settings" icon={arrowBack} text="" />
          </IonButtons>
          <IonTitle>Ionic 8.8.1 Showcase</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen ref={contentRef}>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Ionic 8.8.1</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher
          slot="fixed"
          onIonRefresh={handleRefresh}
          onIonPull={() => {
            setPullStatus('Pulling...');
            try { Haptics.impact({ style: ImpactStyle.Light }); } catch {}
          }}
          onIonPullStart={() => setPullStatus('Pull gestartet')}
          // @ts-ignore — ionPullEnd ist neu in 8.8
          onIonPullEnd={() => setPullStatus('Pull beendet')}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* 1. Refresher Pull Events */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={refreshOutline} style={{ marginRight: 8 }} />
            <IonLabel>Pull-to-Refresh Events (NEU)</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <p>Zieh nach unten um Pull-to-Refresh zu testen.</p>
              <p>Neue Events: <code>ionPullStart</code> + <code>ionPullEnd</code></p>
              <p>Status: <strong>{pullStatus || 'Warte auf Pull...'}</strong></p>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>
                Haptisches Feedback bei Pull-Start (Capacitor Haptics)
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 2. Segment-View mit swipeGesture Toggle */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={swapHorizontalOutline} style={{ marginRight: 8 }} />
            <IonLabel>Segment-View swipeGesture (NEU)</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel>Swiping aktiviert</IonLabel>
                <IonButton
                  size="small"
                  fill={swipeEnabled ? 'solid' : 'outline'}
                  onClick={() => setSwipeEnabled(!swipeEnabled)}
                >
                  {swipeEnabled ? 'AN' : 'AUS'}
                </IonButton>
              </IonItem>

              <IonSegment
                value={segment}
                onIonChange={e => setSegment(e.detail.value as string)}
              >
                <IonSegmentButton value="features">
                  <IonLabel>Features</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="fixes">
                  <IonLabel>Bug-Fixes</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="themes">
                  <IonLabel>Themes</IonLabel>
                </IonSegmentButton>
              </IonSegment>

              <IonSegmentView swipeGesture={swipeEnabled}>
                <IonSegmentContent id="features">
                  <div style={{ padding: 16 }}>
                    <p><strong>Neue Features in 8.8.1:</strong></p>
                    <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
                      <li>Modal Drag Events</li>
                      <li>Segment swipeGesture Property</li>
                      <li>Content fullscreen CSS-Klasse</li>
                      <li>Refresher ionPullStart/ionPullEnd</li>
                      <li>Range Dual-Knob Klassen</li>
                      <li>Select/Item/Toast CSS Parts</li>
                    </ul>
                  </div>
                </IonSegmentContent>
                <IonSegmentContent id="fixes">
                  <div style={{ padding: 16 }}>
                    <p><strong>Wichtige Bug-Fixes:</strong></p>
                    <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
                      <li>Safe Area Insets auf Modals/Popovers</li>
                      <li>Tab-Bar Memory Leak behoben</li>
                      <li>Card Modal Animation bei Resize</li>
                      <li>Tabs mit aehnlichen Route-Prefixes</li>
                      <li>Datetime IntersectionObserver</li>
                      <li>Input Placeholder Overlap (Android)</li>
                    </ul>
                  </div>
                </IonSegmentContent>
                <IonSegmentContent id="themes">
                  <div style={{ padding: 16 }}>
                    <p><strong>Theme-Updates:</strong></p>
                    <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
                      <li>iOS26 2.3.0: Searchbar Classic, Range Pressed-States</li>
                      <li>iOS26: Content Fullscreen Support</li>
                      <li>MD3 1.1.0: Range Bar Radius</li>
                      <li>Ionicons 8: currentColor auf allen Icons</li>
                    </ul>
                  </div>
                </IonSegmentContent>
              </IonSegmentView>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 3. Range Dual-Knob */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={resizeOutline} style={{ marginRight: 8 }} />
            <IonLabel>Range Dual-Knob Klassen (NEU)</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <p>Dual-Knob mit neuen CSS-Klassen fuer Min/Max Styling:</p>
              <IonRange
                dualKnobs
                min={0}
                max={100}
                value={rangeValue}
                onIonChange={e => setRangeValue(e.detail.value as any)}
                pin
                pinFormatter={(v: number) => `${v}%`}
              >
                <IonLabel slot="start">0</IonLabel>
                <IonLabel slot="end">100</IonLabel>
              </IonRange>
              <p style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                Bereich: <IonBadge color="primary">{rangeValue.lower}%</IonBadge> bis <IonBadge color="primary">{rangeValue.upper}%</IonBadge>
              </p>

              <p style={{ marginTop: 16 }}>Single Range mit Min/Max Klassen:</p>
              <IonRange
                min={0}
                max={100}
                value={singleRange}
                onIonChange={e => setSingleRange(e.detail.value as number)}
                pin
              >
                <IonLabel slot="start">0</IonLabel>
                <IonLabel slot="end">100</IonLabel>
              </IonRange>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 4. Searchbar Classic (iOS26 Theme) */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={searchOutline} style={{ marginRight: 8 }} />
            <IonLabel>Searchbar Classic Style (iOS26 2.2.0)</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <p>Standard Searchbar:</p>
              <IonSearchbar placeholder="Standard Suche..." />
              <p style={{ marginTop: 12 }}>Classic Searchbar (class="ios26-searchbar-classic"):</p>
              <IonSearchbar placeholder="Classic Suche..." className="ios26-searchbar-classic" />
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 5. Modal Drag Events */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={handLeftOutline} style={{ marginRight: 8 }} />
            <IonLabel>Modal Drag Events (NEU)</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <p>Card Modals melden jetzt Drag-Events:</p>
              <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
                <li><code>ionDragStart</code> — Nutzer beginnt zu ziehen</li>
                <li><code>ionDragEnd</code> — Nutzer laesst los</li>
              </ul>
              <IonButton
                expand="block"
                onClick={() => presentModal({
                  presentingElement: document.querySelector('.ion-page') as HTMLElement,
                  canDismiss: true,
                  onWillPresent: () => console.log('[Showcase] Modal will present'),
                  // @ts-ignore — drag events neu in 8.8
                  onIonDragStart: () => console.log('[Showcase] Modal drag START'),
                  onIonDragEnd: () => console.log('[Showcase] Modal drag END')
                })}
              >
                Card Modal oeffnen
              </IonButton>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 6. Content Fullscreen Class */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={layersOutline} style={{ marginRight: 8 }} />
            <IonLabel>Content Fullscreen (NEU)</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <p>Diese Seite nutzt <code>&lt;IonContent fullscreen&gt;</code>.</p>
              <p>Ionic 8.8 setzt automatisch die CSS-Klasse <code>content-fullscreen</code> — das iOS26 Theme nutzt das fuer korrektes Gradient-Rendering.</p>
              <IonNote>Sichtbar am grossen Header oben (collapse="condense")</IonNote>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 7. currentColor Icons */}
        <IonList inset>
          <IonListHeader>
            <IonIcon icon={colorPalette} style={{ marginRight: 8 }} />
            <IonLabel>Ionicons 8: currentColor</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <p>Alle Icons nutzen jetzt <code>currentColor</code> — sie erben automatisch die Textfarbe:</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '16px 0' }}>
                <div style={{ color: '#3b82f6', textAlign: 'center' }}>
                  <IonIcon icon={sparkles} style={{ fontSize: 32 }} />
                  <p style={{ fontSize: '0.7rem' }}>Blau</p>
                </div>
                <div style={{ color: '#059669', textAlign: 'center' }}>
                  <IonIcon icon={sparkles} style={{ fontSize: 32 }} />
                  <p style={{ fontSize: '0.7rem' }}>Gruen</p>
                </div>
                <div style={{ color: '#dc2626', textAlign: 'center' }}>
                  <IonIcon icon={sparkles} style={{ fontSize: 32 }} />
                  <p style={{ fontSize: '0.7rem' }}>Rot</p>
                </div>
                <div style={{ color: '#8b5cf6', textAlign: 'center' }}>
                  <IonIcon icon={sparkles} style={{ fontSize: 32 }} />
                  <p style={{ fontSize: '0.7rem' }}>Lila</p>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        <div style={{ height: 40 }} />
      </IonContent>
    </IonPage>
  );
};

export default IonicShowcasePage;
