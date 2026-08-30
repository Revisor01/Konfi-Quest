// MainTabs.tsx
import React, { Suspense, useState, useEffect, useCallback } from 'react';
// react-router nur noch fuer die Routen-Bausteine — der Standort kommt
// ueber useAppLocation aus navigation/.
import { Navigate, Route, useParams } from 'react-router-dom';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonBadge,
  IonSpinner
} from '@ionic/react';
import {
  people, chatbubbles, star, ellipsisHorizontal,
  person, home, flash, calendar, business, flag
} from 'ionicons/icons';
import { useIonRouter, isPlatform } from '@ionic/react';
// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren
import { useApp } from '../../contexts/AppContext';
import { BAEUME, ladeRolleVor } from '../../navigation/rollenBaeume';
import { istTabLeisteVersteckt } from '../../navigation/routes';
import type { Rolle, BadgeKey } from '../../navigation/routes';
import { useAppLocation } from '../../navigation/useAppLocation';
import { useBadge } from '../../contexts/BadgeContext';
import { useLiveRefresh } from '../../contexts/LiveUpdateContext';
import api from '../../services/api';
import { trackBereich } from '../../services/analytics';
import { ModalProvider } from '../../contexts/ModalContext'; // Behalten
// AdminRolesPage entfernt - Rollen sind jetzt hardcoded


// Eine Seite, die einen Routen-Parameter braucht. Sie bekommt ihn als Zahl
// unter ihrem eigenen Prop-Namen (konfiId, eventId, roomId) plus onBack —
// vorher stand dafuer fuer JEDE dieser Routen eine eigene Wrapper-Komponente
// in dieser Datei, fuenf fast identische Bloecke.
const ParamSeite: React.FC<{
  Seite: React.ComponentType<any>;
  prop: string;
  param: string;
}> = ({ Seite, prop, param }) => {
  // react-router 6 reicht Parameter nicht mehr als Props durch (kein
  // RouteComponentProps mehr) — sie kommen ueber useParams.
  const params = useParams();
  const router = useIonRouter();
  return <Seite {...{ [prop]: parseInt(params[param] ?? '0', 10) }} onBack={() => router.goBack()} />;
};

// Ladezustand, waehrend ein Seiten-Chunk erstmals geladen wird. Bewusst eine
// leere IonPage mit Spinner: Der IonRouterOutlet behaelt gemountete Seiten im
// Speicher, und die lazy-Instanzen leben auf Modulebene — beim Tab-WECHSEL
// zurueck oder nach dem Org-Wechsel-Remount (key=orgVersion) rendert eine
// bereits geladene Seite synchron, dieser Fallback erscheint dann NICHT mehr.
const SeiteLaedt: React.FC = () => (
  <IonPage>
    <IonContent>
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <IonSpinner name="crescent" />
      </div>
    </IonContent>
  </IonPage>
);

const MainTabs: React.FC = () => {
  const { user } = useApp();
  // Alle fuenf Zahlen an den Reitern kommen aus EINER Quelle: dem BadgeContext,
  // gespeist aus GET /notifications/badge-counts. Aktualisiert werden sie
  // gemeinsam mit refreshAllCounts().
  //
  // Bis 27.08.2026 war newBadgesCount die Ausnahme: eigener State, eigener
  // Abruf, nur ueber useLiveRefresh('badges') aktualisierbar. Wer nach einer
  // Aktion refreshAllCounts() rief -- das Naheliegende --, bewirkte nichts.
  // Genau daran krankte der Konfi-Zaehler seit dem 03.07.2026 unbemerkt
  // (Befund B1): mark-seen setzte 'seen', aber niemand stiess eine
  // Aktualisierung an, und die rote Zahl blieb die ganze Sitzung stehen.
  const { chatUnreadTotal, pendingRequestsCount, pendingEventsCount, pendingChallengesCount, newBadgesCount } = useBadge();
  // super_admin bekommt eine eigene, reduzierte Navigation
  const isSuperAdmin = user?.role_name === 'super_admin';
  const location = useAppLocation();

  // Anonyme Nutzungsmessung: WELCHER Bereich wird geoeffnet. Zentral am
  // Routenwechsel statt an 15 einzelnen Tab-Buttons — so zählt auch
  // Navigation, die nicht über die Tab-Leiste läuft. Uebertragen wird nur
  // der Bereichsname (z.B. "challenges") plus die Rolle, NIE die volle Route:
  // die kann IDs enthalten (/admin/konfis/42).
  useEffect(() => {
    if (!user) return;
    const teile = location.pathname.split('/').filter(Boolean);
    const bereich = teile[1] || teile[0];
    if (bereich) trackBereich(bereich);
  }, [location.pathname, user?.id]);

  // iOS26 Tab-Bar Liquid-Glass-Animation (rdlabo registerTabBarEffect)
  useEffect(() => {
    if (!isPlatform('ios')) return;
    if (!user) return;

    let cleanupFns: Array<() => void> = [];
    let cancelled = false;

    const setup = async () => {
      try {
        const mod = await import('@rdlabo/ionic-theme-ios26');
        if (cancelled) return;
        const register = mod.registerTabBarEffect;
        if (typeof register !== 'function') return;

        let attempts = 0;
        const tryRegister = () => {
          if (cancelled) return;
          const bars = document.querySelectorAll<HTMLElement>('ion-tab-bar');
          if (bars.length > 0) {
            bars.forEach((bar) => {
              try {
                const reg = register(bar);
                if (reg && typeof reg.destroy === 'function') {
                  cleanupFns.push(() => {
                    try { reg.destroy(); } catch {}
                  });
                }
              } catch (e) {
                console.warn('registerTabBarEffect skip:', e);
              }
            });
          } else if (++attempts < 20) {
            setTimeout(tryRegister, 150);
          }
        };
        tryRegister();
      } catch (e) {
        console.warn('TabBar effect import failed:', e);
      }
    };

    setup();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
    };
  }, [user?.role_name, user?.type]);

  // Zähler ungesehener Badges (Konfi). KEIN 60s-Polling mehr: Der Server sendet
  // beim Vergeben eines Badges ein LiveUpdate ('badges'), das checkAndAwardBadges
  // an genau den Punktevergabe-Stellen (Aktivität/Bonus/Event) ausloest. Bei
  // Verbindungsabriss/Push feuert zusaetzlich der initiale Load beim Reconnect.
  // Der Abzeichen-Zaehler kommt jetzt aus dem BadgeContext (siehe oben) --
  // hier stand frueher ein eigener Loader plus useEffect plus
  // useLiveRefresh('badges'). Der Kanal 'badges' bleibt fuer die Listen-Seiten
  // bestehen, der Zaehler haengt aber nicht mehr daran.

  const rolle: Rolle = isSuperAdmin
    ? 'super_admin'
    : user?.type === 'admin'
      ? 'admin'
      : user?.type === 'teamer'
        ? 'teamer'
        : 'konfi';

  // Offline-Versicherung fuers Code-Splitting: Kurz nach dem Start alle
  // Seiten der eigenen Rolle im Hintergrund nachladen. Einmal importiert,
  // haelt die Modul-Registry sie im Speicher — ein Tab-Wechsel braucht dann
  // kein Netz mehr, auch im Browser ohne Service Worker. Die Verzoegerung
  // laesst den Start-Datenverkehr (Login, Badge-Zaehler) zuerst durch.
  // Schlaegt das Laden fehl (offline), schluckt ladeRolleVor den Fehler;
  // die Seite laedt dann eben beim ersten Besuch.
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => { void ladeRolleVor(rolle); }, 2500);
    return () => clearTimeout(timer);
  }, [rolle, user?.id]);

  if (!user) {
    return null;
  }

  // Funktion, um zu prüfen, ob die Tab-Bar angezeigt werden soll
  const isTabBarHidden = (path: string) => {
    // Verstecke die Tab-Bar, wenn der Pfad ein Chat-Raum ist
    return path.startsWith('/admin/chat/room/') || path.startsWith('/konfi/chat/room/') || path.startsWith('/teamer/chat/room/');
  };

  // EIN Renderer fuer alle Rollen — die Routen, Tabs und Umleitungen stehen
  // als Daten in navigation/rollenBaeume.ts.
  //
  // Vorher standen hier drei fast wortgleiche JSX-Bloecke (je ~80 Zeilen).
  // Genau das Muster, bei dem eine Aenderung zwei Rollen vergisst — Simons
  // stehende Warnung, im August 2026 mehrfach eingetreten. Jetzt gilt jede
  // Aenderung zwangslaeufig fuer alle drei, und der Test in
  // __tests__/navigation/ iteriert ueber dieselbe Tabelle.
  const baum = BAEUME[rolle];
  const tabLeisteZeigen = baum.tabs.length > 0 && !istTabLeisteVersteckt(location.pathname);

  const zaehler: Record<BadgeKey, number> = {
    chat: chatUnreadTotal,
    events: pendingEventsCount + pendingRequestsCount,
    challenges: pendingChallengesCount,
    badges: newBadgesCount,
  };

  // Die Routen des Baums plus die Einstiege von "/" und "/login".
  const outlet = (
    <IonRouterOutlet>
      {baum.routes.map(({ path, page: Seite, param, propName }) => (
        <Route
          key={path}
          path={path}
          element={
            <Suspense fallback={<SeiteLaedt />}>
              {param ? <ParamSeite Seite={Seite} prop={propName} param={param} /> : <Seite />}
            </Suspense>
          }
        />
      ))}
      {baum.redirects.map(({ from, to }) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="/login" element={<Navigate to={baum.home} replace />} />
      <Route path="/" element={<Navigate to={baum.home} replace />} />
    </IonRouterOutlet>
  );

  // Super-Admin: nur das Outlet, keine Tab-Leiste.
  if (baum.tabs.length === 0) {
    return <ModalProvider>{outlet}</ModalProvider>;
  }

  return (
    <ModalProvider>
      <IonTabs>
        {outlet}
        {tabLeisteZeigen && (
          <IonTabBar slot="bottom">
            {baum.tabs.map(({ tab, href, icon, label, badge }) => {
              const n = badge ? zaehler[badge] : 0;
              return (
                <IonTabButton key={tab} tab={tab} href={href}>
                  <IonIcon icon={icon} />
                  <IonLabel>{label}</IonLabel>
                  {n > 0 && <IonBadge color="danger">{n > 9 ? '9+' : n}</IonBadge>}
                </IonTabButton>
              );
            })}
          </IonTabBar>
        )}
      </IonTabs>
    </ModalProvider>
  );
};

export default MainTabs;
