/// <reference types="vitest" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { appBuendelPlugin } from './scripts/app-buendel.mjs'

// Version aus version.json zur Bauzeit einsetzen (__APP_VERSION__).
// Gebraucht von utils/appVersion.ts als Browser-Rueckfallebene: Dort gibt es
// kein App.getInfo(), und der ausgelieferte Web-Build IST die laufende
// Version. version.json ist die eine Stelle, die scripts/apply-version.sh
// pflegt -- die Zahl wird hier NICHT zusaetzlich gepflegt.
const versionsDatei = fileURLToPath(new URL('./version.json', import.meta.url))
const appVersion = JSON.parse(readFileSync(versionsDatei, 'utf8')).version as string

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Legt nach dem Build dist-app/ an: das Bündel fuer die nativen Apps,
    // ohne Handbuch, API-Referenz, Werbeseite und Rechtstexte (29.09.2026,
    // Toolchain-Audit BF-02). Capacitor nimmt nur dieses Verzeichnis
    // (capacitor.config.ts, webDir). dist/ bleibt die Web-Auslieferung.
    // Was hinein darf und warum: scripts/app-buendel.mjs.
    appBuendelPlugin(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // Worker als ES-Modul bündeln (29.09.2026). Einziger Worker über Vite ist
  // der von pdf.js (utils/pdfDokument.ts, ?worker&url). pdf.js startet ihn mit
  // `new Worker(url, { type: 'module' })`, und der Worker selbst ist ein
  // ES-Modul mit export und import.meta.url — das Vite-Standardformat iife
  // passt dazu nicht.
  worker: {
    format: 'es',
  },
  // host: true bindet den Entwicklungsserver an alle Netzwerkschnittstellen
  // statt nur an localhost -- sonst erreicht ihn das iPhone nicht.
  // Gebraucht fuer den Live-Betrieb auf dem Geraet (`npm run live:ios`,
  // 05.09.2026): Die App auf dem iPhone laedt dann von diesem Server, und
  // jede Aenderung im Code ist sofort dort zu sehen -- ohne neuen Build.
  // Fuer den Produktionsbau ist das ohne Bedeutung.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Der Bonjour-Name des Entwicklungsrechners muss hier stehen, sonst
    // antwortet Vite mit 403 (Host-Pruefung) -- am Geraet sieht das aus wie
    // ein weisser Bildschirm. Der Name ist der stabile Weg fuer CAP_LIVE_URL:
    // Die IP wechselt bei jedem Netzwechsel (WLAN/Hotspot/USB) und macht dann
    // jedes Mal einen Neubau noetig, der Name bleibt gleich.
    // Eigenen Namen ermitteln: `scutil --get LocalHostName`.
    allowedHosts: ['.local'],
  },
  resolve: {
    alias: {
      /*
       * `firebase/messaging` gibt es bei uns absichtlich NICHT (23.09.2026).
       *
       * @capacitor-firebase/messaging brauchen wir nur fuer den aktiven
       * Token-Abruf auf den GERAETEN — dort laeuft das native SDK. Sein
       * Web-Fallback (dist/esm/web.js) importiert `firebase/messaging` aber
       * statisch, und der Build zieht diesen Zweig mit hinein: fuenf
       * MISSING_EXPORT-Fehler, obwohl der Code nie ausgefuehrt wird.
       *
       * Statt das 37 MB schwere `firebase`-Paket aufzunehmen, zeigt der Alias
       * auf einen leeren Ersatz. Im Browser gibt es damit keine Push-Nachrichten
       * — die gab es dort ohnehin nie (Capacitor.isNativePlatform() sperrt
       * jeden Push-Weg in AppContext).
       */
      'firebase/messaging': fileURLToPath(
        new URL('./src/stubs/firebase-messaging-leer.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    alias: {
      /*
       * Im Testlauf zusaetzlich auf die ESM-Fassung des Plugins zeigen.
       *
       * Vitest greift sonst zu dist/plugin.cjs.js, und die hat
       * `require('firebase/messaging')` UNBEDINGT am Dateianfang — der Alias
       * oben auf den leeren Ersatz greift bei einem CJS-require nicht. Alle
       * Tests, die AppContext importieren, brachen damit an "Cannot find
       * module 'firebase/messaging'" (23.09.2026).
       *
       * Die ESM-Fassung laedt den Web-Zweig nur dynamisch, sodass der Alias
       * oben greift, wenn er ueberhaupt gebraucht wird.
       */
      '@capacitor-firebase/messaging': fileURLToPath(
        new URL(
          './node_modules/@capacitor-firebase/messaging/dist/esm/index.js',
          import.meta.url,
        ),
      ),
    },
  }
})
