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
  //   CAP_LIVE_URL="http://$(scutil --get LocalHostName | tr 'A-Z' 'a-z').local:5173" \
  //     npx cap sync ios
  //
  // KLEINSCHREIBUNG IST PFLICHT (24.09.2026): Bonjour loest den Namen
  // kleingeschrieben auf, Capacitor vergleicht den geladenen Host aber strikt
  // mit dieser Adresse. Steht hier "MacBook-Air-...", haelt die App die eigene
  // Seite fuer fremd und oeffnet sie in Safari, statt sie selbst zu laden.
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
  // NUR diese Plugins nativ einbinden (24.09.2026).
  //
  // WARUM DIE LISTE NOETIG IST: @rdlabo/ionic-theme-ios27 deklariert sich in
  // seiner package.json als Capacitor-Plugin ("capacitor": {"ios": {"src":
  // "ios"}}) — das ist der experimentelle "Native UI Shell". Es liefert dafuer
  // aber nur ein Package.swift, KEINE podspec. In einem CocoaPods-Projekt wie
  // diesem bricht `npx cap sync ios` deshalb ab:
  //
  //   [!] No podspec found for `RdlaboIonicThemeIos27`
  //
  // Genau daran ist iOS-Build 220 gescheitert. Laut Theme-Doku braeuchte der
  // native Teil eine Umstellung auf SPM (`npx cap spm-migration-assistant`) —
  // ein grosser Eingriff fuer eine Funktion, die dort ausdruecklich als
  // experimentell steht und die wir nicht nutzen. Wir wollen vom Theme nur
  // CSS und die Web-Effekte, und die kommen ueber den normalen Import.
  //
  // `includePlugins` ist eine POSITIVLISTE: Was hier nicht steht, wird nicht
  // nativ eingebunden. Das hat einen zweiten Nutzen — ein neues Plugin faellt
  // beim ersten Bau auf, statt still zu fehlen. Wer eines hinzufuegt, traegt
  // es hier ein.
  includePlugins: [
    '@capacitor-community/file-opener',
    '@capacitor-firebase/crashlytics',
    '@capacitor-firebase/messaging',
    '@capacitor/app',
    '@capacitor/device',
    '@capacitor/file-viewer',
    '@capacitor/filesystem',
    '@capacitor/haptics',
    '@capacitor/keyboard',
    '@capacitor/network',
    '@capacitor/preferences',
    '@capacitor/push-notifications',
    '@capacitor/share',
    '@capacitor/status-bar',
    '@capawesome/capacitor-background-task',
    '@capawesome/capacitor-badge',
    '@capgo/capacitor-native-biometric',
  ],
  server: {
    androidScheme: 'https',
    ...(process.env.CAP_LIVE_URL
      ? { url: process.env.CAP_LIVE_URL, cleartext: true }
      : {}),
  },
  plugins: {
    // Systemleisten auf Android (Status- und Navigationsleiste, 25.09.2026).
    //
    // MALTES BEFUND (Android, Telefon im Dunkelmodus): "unten das Android
    // Menue ist im Handy Darkmode unsichtbar. In einem Chat lustigerweise
    // leicht sichtbar."
    //
    // URSACHE, aus der Capacitor-8-Quelle (SystemBars.java, getStyleForTheme):
    // Das eingebaute SystemBars-Plugin richtet die Farbe der Leisten-Symbole
    // mit der Voreinstellung DEFAULT nach dem THEMA DES TELEFONS. Telefon
    // dunkel -> weisse Symbole. Solange die App immer hell war, stand hier
    // deshalb fest LIGHT (dunkle Symbole).
    //
    // Seit die App dem Systemmodus folgt (Dunkelmodus, 25.09.2026), ist
    // DEFAULT wieder richtig: Telefon dunkel -> App dunkel -> weisse Symbole;
    // Telefon hell -> App hell -> dunkle Symbole. Kein Laufzeitaufruf noetig,
    // beide Seiten lesen dieselbe Einstellung. Der Test systemBars.test.ts
    // koppelt beides: Wer den Dunkelmodus wieder abschaltet, muss hier
    // zurueck auf LIGHT.
    SystemBars: {
      style: 'DEFAULT',
    },
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
