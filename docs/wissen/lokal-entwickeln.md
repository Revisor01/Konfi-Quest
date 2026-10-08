# Lokal entwickeln: Fallen

Wie man Backend und Oberfläche auf dem eigenen Rechner startet, steht im
[README](../../README.md#selbst-betreiben) und — für die Web-Fassung mit
Testdaten — in [Auftrag 17](../auftraege/lokaler-agent/17-web-live-weiterbauen.md),
Teil 1. Hier steht, woran es dabei schon gehakt hat.

## Ports

| Port | belegt von |
|---|---|
| 5173 | Vite-Entwicklungsserver (`npm run dev` in `frontend/`) |
| 5433 | Test-Datenbank der Backend-Tests (`backend/docker-compose.test.yml`) |
| 5444 | Datenbank des E2E-Stacks (`docker-compose.e2e.yml`, Dienst `e2e-db`) |
| 5555 | Backend des E2E-Stacks — **und** `adb` eines laufenden Android-Emulators |
| 5556 | Oberfläche des E2E-Stacks (nginx) |

- **Ein lokales Backend nicht auf 5555 starten**, solange ein
  Android-Emulator läuft: `adb` hält den Port und fängt die Anfragen ab; der
  Browser bekommt eine leere Antwort (curl: Fehler 52), nicht etwa einen
  Absturz des Backends. Für das Backend `PORT=5556` und in der Oberfläche
  `VITE_API_URL=http://localhost:5556/api` nehmen.
- 5556 ist frei, solange vom E2E-Stack nur `e2e-db` läuft. Wer den ganzen
  E2E-Stack startet (`docker compose -f docker-compose.e2e.yml up`), belegt
  5555 und 5556 selbst und braucht kein eigenes Backend.
- **Backend-Tests nie gegen 5444 laufen lassen.** Die Suites leeren und
  befüllen ihre Datenbank mit festen Kennungen aus `seed.js` — gegen die
  Datenbank der Vorschau gefahren, löschen sie alles, was man dort von Hand
  angelegt hat. Die Tests gehören an `backend/docker-compose.test.yml` (5433).

## Node

Die Fassung steht in `.nvmrc` (26). Ist auf dem Rechner zusätzlich ein
älteres Node der Standard (etwa über Homebrew `node` neben `node@26`), vor
`npm ci` und `npm run dev` das richtige in den `PATH` nehmen und mit
`node --version` prüfen; mit dem falschen Node scheitern Installation oder
Start an Stellen, die nicht nach der Version aussehen.

## Backend startet ohne Migrationen

Meldet das Backend unter `NODE_ENV=test` beim Start `Database startup
failed` (etwa weil die Datenbank noch hochfährt), läuft es **ohne
Migrationen** weiter. Dann eine Backend-Datei speichern (`npm run dev` ist
`node --watch`) oder neu starten und im Log die Zeilen `Migration applied`
abwarten, bevor der Seed läuft.

## Die Oberfläche spricht sonst Produktion an

Ohne `VITE_API_URL` geht der Entwicklungsserver gegen die Produktions-API
(`frontend/src/services/apiBasis.ts`). Nie ohne die Variable starten und
lokal nie mit echten Konten anmelden.
