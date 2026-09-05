/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
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
