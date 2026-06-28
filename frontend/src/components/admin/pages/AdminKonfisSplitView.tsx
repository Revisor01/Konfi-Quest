import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { peopleOutline } from 'ionicons/icons';
import AdminKonfisPage from './AdminKonfisPage';
import KonfiDetailView from '../views/KonfiDetailView';

// iPad-Split-View fuer den Admin-Konfis-Bereich.
//
// Statt IonSplitPane (das in Ionic React 8 die Side-Pane bei einem nicht-
// IonMenu-Kind nicht zuverlaessig erkennt und das Detail ueber die Liste legt)
// nutzen wir ein eigenes Flex-Layout. Das ist fuer den Fall "immer zwei festen
// Spalten ab Breakpoint" deterministisch und ausreichend — das Menue-Toggle-
// Verhalten von IonSplitPane brauchen wir hier nicht.
//
// - Breit (>=lg, iPad Landscape): Liste links (feste Breite) + Detail rechts.
// - Schmal (iPhone, iPad Portrait): nur die Liste; Auswahl navigiert wie
//   bisher per Route auf /admin/konfis/:id (Detail-Seite mit Zurueck-Button).

const LG_BREAKPOINT = 992;
const SIDE_WIDTH = 380;

const useIsWide = () => {
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= LG_BREAKPOINT : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    // Initial sync (falls sich zwischen useState und Effekt was geaendert hat)
    setIsWide(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isWide;
};

const AdminKonfisSplitView: React.FC = () => {
  const [selectedKonfiId, setSelectedKonfiId] = useState<number | null>(null);
  const isWide = useIsWide();
  const masterRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Verschachtelte IonPages starten mit der Klasse 'ion-page-invisible'
  // (opacity:0) und werden normalerweise vom RouterOutlet sichtbar gemacht.
  // Da unsere Master/Detail-IonPages NICHT direkt vom Outlet verwaltet werden,
  // entfernt diese Klasse niemand -> wir tun es selbst nach jedem Render.
  useEffect(() => {
    [masterRef.current, detailRef.current].forEach((host) => {
      host?.querySelectorAll('.ion-page-invisible').forEach((el) => {
        el.classList.remove('ion-page-invisible');
      });
    });
  });

  const handleSelect = (konfiId: number) => {
    if (isWide) {
      setSelectedKonfiId(konfiId);
    } else {
      // Schmaler Screen: Detail-Spalte ausgeblendet -> wie bisher navigieren.
      window.location.assign(`/admin/konfis/${konfiId}`);
    }
  };

  // Schmaler Screen: kein Split — die Liste uebernimmt die volle Flaeche und
  // navigiert per Route (onSelectKonfi NICHT setzen -> Default-Routing greift).
  if (!isWide) {
    return <AdminKonfisPage />;
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* MASTER: Konfis-Liste, feste Breite. position:relative, damit die
          innere IonPage (position:absolute) hier eingefangen wird. */}
      <div
        ref={masterRef}
        style={{
          width: SIDE_WIDTH,
          flexShrink: 0,
          position: 'relative',
          borderRight: '1px solid var(--app-hairline, #e5e5ea)',
        }}
      >
        <AdminKonfisPage onSelectKonfi={handleSelect} selectedKonfiId={selectedKonfiId} />
      </div>

      {/* DETAIL: rechte Spalte, fuellt den Rest. */}
      <div ref={detailRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {selectedKonfiId ? (
          <KonfiDetailView
            key={selectedKonfiId}
            konfiId={selectedKonfiId}
            onBack={() => setSelectedKonfiId(null)}
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
                <IonIcon icon={peopleOutline} style={{ fontSize: '3rem', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Wähle links einen Konfi aus, um die Details zu sehen.
                </p>
              </div>
            </IonContent>
          </IonPage>
        )}
      </div>
    </div>
  );
};

export default AdminKonfisSplitView;
