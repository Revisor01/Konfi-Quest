import React, { useState, useEffect, ReactNode } from 'react';
import { IonPage, IonContent, IonIcon, useIonViewWillEnter, useIonViewDidLeave } from '@ionic/react';

// Generische Split-View-Shell fuer iPad-Landscape Master-Detail-Layouts.
//
// Ersetzt die zuvor pro Bereich duplizierten Wrapper (Konfis, Chat, Events ...).
// Auf breiten Screens (>=lg) Master links + Detail rechts; auf schmalen Screens
// rendert die Shell NUR den Master (die aufrufende Page faellt dort auf ihr
// bisheriges Routing zurueck).
//
// Wichtig: verschachtelte IonPages starten mit der Klasse 'ion-page-invisible'
// (opacity:0) und werden normalerweise vom RouterOutlet sichtbar gemacht. Da
// Master/Detail hier NICHT direkt vom Outlet verwaltet werden, entfernt die
// Shell diese Klasse nach jedem Render selbst.

const LG_BREAKPOINT = 992;
const SIDE_WIDTH = 380;

export const useIsWideScreen = (breakpoint: number = LG_BREAKPOINT): boolean => {
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    setIsWide(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isWide;
};

interface SplitViewShellProps {
  // Linke Spalte (Liste). Sollte eine IonPage rendern.
  master: ReactNode;
  // Rechte Spalte (Detail) — null/undefined zeigt den Empty-State.
  detail?: ReactNode;
  // Icon + Text fuer den Empty-State (wenn kein detail gesetzt ist).
  emptyIcon: string;
  emptyText: string;
  sideWidth?: number;
}

const SplitViewShell: React.FC<SplitViewShellProps> = ({
  master,
  detail,
  emptyIcon,
  emptyText,
  sideWidth = SIDE_WIDTH,
}) => {
  // WICHTIG: Die aeussere Huelle ist eine IonPage. Trotzdem versteckt der
  // IonRouterOutlet die inaktive Split-Shell beim Tab-Wechsel NICHT zuverlaessig
  // (verschachtelte IonPages im Inneren stoeren Ionics ion-page-invisible-
  // Mechanik) -> mehrere Split-Seiten bleiben sichtbar gestapelt und die zuletzt
  // besuchte ueberlagert die aktive (Bug: nach Chat bleibt rechts der Chat-
  // Empty-State, obwohl Konfis aktiv ist).
  // Loesung: Wir steuern die Sichtbarkeit selbst ueber die Ionic-Lifecycle-
  // Hooks — nur die AKTIVE View wird gerendert/angezeigt, inaktive ausgeblendet.
  const [isActive, setIsActive] = useState(true);
  useIonViewWillEnter(() => setIsActive(true));
  useIonViewDidLeave(() => setIsActive(false));

  return (
    <IonPage className="split-view-shell">
      <div
        className="split-view-shell__row"
        style={{ display: isActive ? 'flex' : 'none', width: '100%', height: '100%' }}
      >
        <div
          className="split-view-shell__master"
          style={{
            width: sideWidth,
            flexShrink: 0,
            position: 'relative',
            borderRight: '1px solid var(--app-hairline, #e5e5ea)',
          }}
        >
          {master}
        </div>

        <div className="split-view-shell__detail" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {detail ?? (
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
                <IonIcon icon={emptyIcon} style={{ fontSize: '3rem', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.95rem' }}>{emptyText}</p>
              </div>
            </IonContent>
          )}
        </div>
      </div>
    </IonPage>
  );
};

export default SplitViewShell;
