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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
