/// <reference types="@capawesome/capacitor-badge" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.godsapp.konfiquest',
  appName: 'Konfi Quest',
  webDir: 'dist',
  // androidScheme https: WebView laeuft auf https://localhost statt http://localhost,
  // sonst blockt Android HTTPS-Calls zur API als Mixed-Content ("Keine Verbindung").
  //
  // CAP_LIVE_URL laedt die Oberflaeche zur Laufzeit vom Vite-Server statt aus dem
  // mitgelieferten Buendel -- Aenderungen am CSS sind dann sofort auf dem Geraet
  // zu sehen, ohne neu zu bauen. NUR fuer die Entwicklung:
  //
  //   CAP_LIVE_URL=http://$(scutil --get LocalHostName).local:5173 npx cap sync ios
  //
  // BESSER DER NAME ALS DIE IP: Am 24.09.2026 hat die Adresse dreimal
  // gewechselt (WLAN -> Hotspot -> USB-Hotspot), und jedes Mal musste die App
  // neu gebaut werden, weil sie eine tote IP suchte. Der Bonjour-Name des Macs
  // (`scutil --get LocalHostName` + ".local") bleibt dabei gleich. In
  // vite.config.ts ist ".local" deshalb als erlaubter Host eingetragen --
  // ohne das antwortet Vite mit 403, und am Geraet sieht das aus wie ein
  // weisser Bildschirm.
  //
  // Ohne die Variable bleibt der Block unveraendert. Das ist Absicht: Eine fest
  // eingetragene Adresse wuerde in einem Store-Build auf eine tote IP im
  // Heimnetz zeigen -- die App zeigte dann bei jeder Nutzerin eine weisse Seite.
  // cleartext erlaubt dabei http:// (der Vite-Server spricht kein TLS).
  server: {
    androidScheme: 'https',
    ...(process.env.CAP_LIVE_URL
      ? { url: process.env.CAP_LIVE_URL, cleartext: true }
      : {}),
  },
  plugins: {
    Keyboard: {
      // 'ionic' (Ionic passt Padding an). 'native' wurde am 04.07. probiert
      // (Build 76) und sah SCHLECHTER aus (WebView-Frame springt unanimiert).
      // Das eigentliche Problem "Tastatur klappt nach Senden zu" war ein
      // Fokus-Verlust im Send-Flow, nicht der Resize-Modus.
      resize: 'ionic'
    },
    Badge: {
      persist: true,
      autoClear: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    FCM: {
      // Native FCM Plugin für APNS/FCM Token Management
    }
  }
};

export default config;
