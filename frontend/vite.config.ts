/// <reference types="vitest" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
    react()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
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
      /*
       * Endungsloser ESM-Import im Theme-Hilfspaket (24.09.2026).
       *
       * @rdlabo/ionic-theme-ios26 zieht ab 9.3.0 seine Hilfsfunktionen aus
       * @rdlabo/ionic-theme-utils. Dessen dist/index.js macht:
       *
       *   export { ... } from './transition/ios.transition';
       *
       * OHNE Dateiendung — bei `"type": "module"` ist das ungueltig, Node
       * verlangt dort die vollstaendige Endung. Die Datei ios.transition.js
       * liegt da, wird aber nicht gefunden:
       *   Cannot find module '.../dist/transition/ios.transition'
       * Im Testlauf brach damit App.test.tsx ab (0 Tests, Datei laedt nicht).
       *
       * Das ist ein Fehler des Pakets, nicht unserer Einrichtung. Der Alias
       * ergaenzt die Endung, bis es dort behoben ist. Er trifft genau diesen
       * einen Pfad — nichts anderes im Projekt importiert ios.transition.
       */
      '@rdlabo/ionic-theme-utils': fileURLToPath(
        new URL(
          './src/stubs/ionic-theme-utils-neu.ts',
          import.meta.url,
        ),
      ),
      // Zweite Haelfte desselben Behelfs: Der Ersatz oben braucht einen Weg
      // zur echten Datei, und ein Zugriff per Paketname scheitert am
      // `exports`-Feld von ionic-theme-ios26. Deshalb dieser eigene Name auf
      // den absoluten Pfad.
      'ionic-theme-utils-ios-transition': fileURLToPath(
        new URL(
          './node_modules/@rdlabo/ionic-theme-ios26/node_modules/@rdlabo/ionic-theme-utils/dist/transition/ios.transition.js',
          import.meta.url,
        ),
      ),
    },
  }
})
