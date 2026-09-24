// App Links (Android): Ein Link auf konfi-quest.de oeffnet die App statt des
// Browsers. Android liefert die Adresse ueber das Capacitor-Ereignis
// 'appUrlOpen' -- beim Kaltstart genauso wie bei laufender App
// (BridgeActivity ruft in onCreate onNewIntent(getIntent()) auf, das
// App-Plugin haelt das Ereignis bis zum ersten Lauscher zurueck). Ein
// einziger Lauscher reicht deshalb, getLaunchUrl ist nicht noetig.
//
// Der Weg zum Router ist derselbe wie beim angetippten Push: Das Ziel wird
// ueber pushZielMelden abgelegt und PushZielNavigation navigiert -- KEIN
// window.location.href, das im nativen WebView die App neu aufbaut und beim
// Hochfahren der Activity abstuerzt (Maltes Befund 23.09.2026).
//
// Welche Links die App annimmt, steht hier UND im AndroidManifest
// (intent-filter mit autoVerify). Beide Listen muessen deckungsgleich sein,
// der Test in __tests__/navigation/appLinksAndroid.test.ts prueft das.
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { pushZielMelden } from './pushNavigation';

/** Hosts, fuer die Android der App die Links zuweist (android:host). */
export const APP_LINK_HOSTS: readonly string[] = ['konfi-quest.de'];

/**
 * Pfad-Anfaenge, die die App oeffnen (android:pathPrefix). Nur Seiten, die
 * die App wirklich hat: die Einladung aus QR-Code und Elternbrief
 * (/register?code=...), der Link aus der Passwort-vergessen-Mail
 * (/reset-password?token=...) und /login von der Werbeseite. Werbeseite,
 * Datenschutz, Impressum und Handbuch bleiben im Browser.
 */
export const APP_LINK_PFADE: readonly string[] = ['/login', '/register', '/reset-password'];

/**
 * In-App-Ziel fuer eine von Android gelieferte Adresse. Leerer String =
 * nichts tun (fremder Host, kein https, Pfad ohne Seite in der App, Unsinn).
 *
 * Abfrage und Anker bleiben erhalten: Der Einladungscode steckt in ?code=,
 * der Reset-Token in ?token= -- die Seiten lesen beides aus location.search.
 */
export const deepLinkZiel = (url: string): string => {
  let adresse: URL;
  try {
    adresse = new URL(url);
  } catch {
    return '';
  }
  if (adresse.protocol !== 'https:') return '';
  if (!APP_LINK_HOSTS.includes(adresse.hostname.toLowerCase())) return '';

  // Wie Androids pathPrefix: reiner Anfangsvergleich.
  const pfad = adresse.pathname;
  if (!APP_LINK_PFADE.some((prefix) => pfad.startsWith(prefix))) return '';

  return `${pfad}${adresse.search}${adresse.hash}`;
};

/**
 * Lauscher fuer geoeffnete Links anschliessen. Liefert die Funktion zum
 * Abbauen. Ein Link, der zu keinem Ziel fuehrt, wird still verworfen.
 */
export const deepLinksAnschliessen = async (): Promise<() => void> => {
  const lauscher = await App.addListener('appUrlOpen', (ereignis: URLOpenListenerEvent) => {
    pushZielMelden(deepLinkZiel(ereignis.url));
  });
  return () => {
    void lauscher.remove();
  };
};
