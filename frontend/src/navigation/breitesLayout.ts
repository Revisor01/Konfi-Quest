import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

// Breites Layout der Web-Version (Simon, 02.10.2026, planung/web-version.md,
// Entscheidungen 1 und 9): „eine moderne Web-Version mit einer Navi an der
// linken Seite, ein- und ausklappbar, die sich im Browser nativ anfühlt" --
// gebaut als dieselbe App mit breitem Layout; die Apps auf iPhone und
// Android bleiben, wie sie sind.
//
// Diese Datei beantwortet EINE Frage fuer alle Stellen: Steht gerade die
// Leiste links statt der Reiterleiste unten? Gefragt wird an zwei Stellen,
// die zusammenpassen muessen: Der Rahmen (components/layout/
// SeitenleistenRahmen.tsx) zeigt die Leiste, MainTabs blendet die
// Reiterleiste aus. Lesen beide dieselbe Quelle, kann es nie beide oder
// keine geben.

/** Ab dieser Fensterbreite steht die Leiste links (Ionics Stufe „lg"). */
export const BREITE_SEITENLEISTE = 992;

const ABFRAGE = `(min-width: ${BREITE_SEITENLEISTE}px)`;

/**
 * Die Web-Version: dieselbe App im Browser, nicht in der iPhone- oder
 * Android-App. Bei jedem Aufruf neu gefragt statt beim Laden der Datei
 * festgehalten -- der Wert aendert sich zwar nie, aber Tests schalten die
 * Plattform um.
 */
export const istWebVersion = (): boolean => !Capacitor.isNativePlatform();

const medienAbfrage = (): MediaQueryList | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(ABFRAGE);
  } catch {
    return null;
  }
};

// Aeltere WebViews und der Test-Ersatz in setupTests.ts kennen nur
// addListener/removeListener, kein addEventListener.
const abonnieren = (melden: () => void): (() => void) => {
  const abfrage = medienAbfrage();
  if (!abfrage) return () => undefined;
  if (typeof abfrage.addEventListener === 'function') {
    abfrage.addEventListener('change', melden);
    return () => abfrage.removeEventListener('change', melden);
  }
  if (typeof abfrage.addListener === 'function') {
    abfrage.addListener(melden);
    return () => abfrage.removeListener(melden);
  }
  return () => undefined;
};

// In den Apps wird gar nicht erst gelauscht: Dort gibt es kein breites
// Layout, auch nicht auf dem iPad im Querformat.
const keinAbo = (): (() => void) => () => undefined;

const istBreit = (): boolean => medienAbfrage()?.matches === true;
const nieBreit = (): boolean => false;

/**
 * Steht die Leiste links? Nur in der Web-Version und ab 992 px Breite; in
 * den Apps und im schmalen Fenster immer false -- dort bleibt die
 * Reiterleiste unten, wie sie ist.
 *
 * useSyncExternalStore statt eigenem Zustand: Rahmen und MainTabs lesen im
 * selben Durchgang denselben Wert, auch waehrend das Fenster gezogen wird.
 */
export const useBreitesLayout = (): boolean => {
  const web = istWebVersion();
  return useSyncExternalStore(web ? abonnieren : keinAbo, web ? istBreit : nieBreit, nieBreit);
};
