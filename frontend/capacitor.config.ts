/// <reference types="@capawesome/capacitor-badge" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.godsapp.konfiquest',
  appName: 'Konfi Quest',
  webDir: 'dist',
  // androidScheme https: WebView laeuft auf https://localhost statt http://localhost,
  // sonst blockt Android HTTPS-Calls zur API als Mixed-Content ("Keine Verbindung").
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Keyboard: {
      // 'native': WebView-Frame wird SYNCHRON zur Tastatur-Animation verkleinert.
      // Mit 'ionic' wurde der Footer erst nach keyboardDidShow hochgeschoben —
      // die Eingabeleiste verschwand kurz hinter der Tastatur und ploppte dann
      // wieder auf (wirkte hakelig).
      resize: 'native'
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
