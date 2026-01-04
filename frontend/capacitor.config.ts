/// <reference types="@capawesome/capacitor-badge" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.godsapp.konfiquest',
  appName: 'konfipoints-clean',
  webDir: 'dist',
  server: {
    // Deep Links: App öffnet sich bei konfi-quest.de Links
    url: 'https://konfi-quest.de',
    cleartext: false
  },
  plugins: {
    Keyboard: {
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
  },
  // iOS Universal Links / Android App Links
  ios: {
    // Associated Domains werden in Xcode konfiguriert:
    // applinks:konfi-quest.de
  },
  android: {
    // Intent Filters für Deep Links
    // Werden in AndroidManifest.xml konfiguriert
  }
};

export default config;
