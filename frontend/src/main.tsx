import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { migrateToPreferences } from './services/migrateStorage';
import { initTokenStore } from './services/tokenStore';
import { globaleFehlerkanaeleAnhaengen } from './services/absturzdiagnose';
import { tempDateienAufraeumen } from './utils/nativeFileViewer';

// KEINE Messung an dieser Stelle — und das ist Absicht.
//
// Hier wurde bis 14.09.2026 das Umami-Script mit der Kennung der WERBESEITE
// geladen. Das ist aber der Einstieg der ANWENDUNG: im Browser zaehlten
// dadurch beide Kennungen gleichzeitig, und die Zahlen der Werbeseite
// enthielten App-Nutzung — die 4.197 gemeldeten "Werbeseiten"-Aufrufe waren
// zu einem unbekannten Teil Konfis, die sich einloggen.
//
// Jetzt sauber getrennt:
//   Anwendung   -> services/analytics.ts, eigene Kennung, ohne Personenbezug
//   Werbeseiten -> eigene <script>-Zeile in public/landing.html und den drei
//                  weiteren statischen Seiten, unveraendert
//
// Die Werbeseiten brauchen von hier nichts: sie sind statisches HTML und
// laden ihr Script selbst. Die native App misst weiterhin ueber
// analytics.ts, das zur Laufzeit ohnehin nur in Produktion sendet.

// Globale Fehlerkanaele ALS ERSTES anhaengen — vor dem Vorbereiten und vor dem
// ersten render().
//
// DIE LUECKE: Das Projekt hatte weder einen `unhandledrejection`- noch einen
// `window.onerror`-Handler. Eine abgelehnte Promise ohne catch verschwand
// damit vollstaendig — kein Eintrag, keine Meldung. Genau die weisse Seite
// beim Start (04.09.2026) war so ein Fall: Das Log endete, und niemand
// erfuhr, woran.
//
// Hier oben, weil die beiden Schritte darunter (Migration, Token-Store) selbst
// Kandidaten fuer eine unbehandelte Ablehnung sind. Der Aufruf ist im Browser
// harmlos: die Handler werden gesetzt, melden dort aber nichts (no-op).
globaleFehlerkanaeleAnhaengen();

const container = document.getElementById('root');
const root = createRoot(container!);

// Der Start darf NIE am Vorbereiten haengenbleiben (Simons Befund
// 04.09.2026, im Simulator nachgestellt: weisse Seite, das Log endet nach
// "WebView loaded"). Beide Schritte laufen vor dem ersten render() -- wirft
// oder haengt einer, wird NICHTS gerendert: keine Oberflaeche, keine
// Fehlerseite, kein Login. Genau weiss.
//
// Jetzt: Fehler abfangen (die App startet dann ohne wiederhergestellte
// Sitzung, also auf dem Login) und ein hartes Zeitlimit, damit ein
// haengendes Preferences-Plugin den Start nicht blockiert. Gerendert wird
// in JEDEM Fall.
const mitZeitlimit = <T,>(p: Promise<T>, ms: number): Promise<T | void> =>
  Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

(async () => {
  try {
    await mitZeitlimit(migrateToPreferences(), 4000);
  } catch (err) {
    console.error('Storage-Migration beim Start fehlgeschlagen:', err);
  }
  try {
    await mitZeitlimit(initTokenStore(), 4000);
  } catch (err) {
    console.error('Token-Store beim Start fehlgeschlagen:', err);
  }
  root.render(
    // <React.StrictMode>  // Temporarily disabled to avoid double routing in development
      <App />
    // </React.StrictMode>
  );

  // NACH dem Rendern und bewusst ohne await (siehe oben: der Start darf an
  // nichts haengenbleiben). Raeumt die temporaeren Kopien weg, die das native
  // Oeffnen von Dateien in Documents/temp hinterlaesst — bis 13.09.2026 blieben
  // die dort fuer immer liegen und wanderten ins Backup.
  void tempDateienAufraeumen();
})();