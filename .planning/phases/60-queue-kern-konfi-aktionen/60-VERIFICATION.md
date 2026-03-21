---
phase: 60-queue-kern-konfi-aktionen
verified: 2026-03-21T12:00:00Z
status: gaps_found
score: 18/19 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 18/19
  gaps_closed: []
  gaps_remaining:
    - "QUE-K02: writeQueue.ts flush() kann _localFilePath (Chat-Bild-Items) nicht zu FormData konvertieren"
  regressions: []
gaps:
  - truth: "Konfi kann offline eine Bild-Nachricht senden — Bild wird lokal gespeichert, Upload bei Reconnect im Vordergrund"
    status: partial
    reason: "ChatRoom.tsx speichert Bild-Dateien korrekt lokal mit _localFilePath, aber writeQueue.ts flush() hat keine Logik um _localFilePath-Items beim Flush in FormData zu konvertieren. Es gibt nur resolveLocalPhoto() fuer _localPhotoPath (Aktivitaets-Antraege). Chat-Bild-Items werden beim Flush als JSON mit _localFilePath-String gesendet, was am Backend scheitern wird."
    artifacts:
      - path: "frontend/src/services/writeQueue.ts"
        issue: "flush() prueft nur body._localPhotoPath (resolveLocalPhoto), nicht body._localFilePath. Chat-Bild-Uploads haben _localFilePath/_fileName/_fileType im body — diese werden nicht zu FormData konvertiert."
      - path: "frontend/src/components/chat/ChatRoom.tsx"
        issue: "Korrekt implementiert — speichert Datei als Base64 in Capacitor Filesystem unter queue-uploads/, setzt _localFilePath/_fileName/_fileType. Aber die Flush-Seite (writeQueue.ts) fehlt."
    missing:
      - "In writeQueue.ts flush(): Analog zu resolveLocalPhoto, eine resolveLocalFile-Funktion implementieren die _localFilePath liest, zu Blob konvertiert, FormData baut und direkt als multipart/form-data sendet (statt JSON). Der Upload-Endpoint fuer Chat-Bilder muss dabei verwendet werden."
      - "In flush(): Nach dem resolveLocalPhoto-Block einen analogen Block fuer body._localFilePath einfuegen der resolveLocalFile() aufruft."
human_verification:
  - test: "Chat-Nachricht offline senden (Text) und bei Reconnect pruefen ob sie zugestellt wird"
    expected: "Nachricht erscheint sofort mit Uhr-Icon, wird nach Reconnect durch echte Server-Nachricht ersetzt"
    why_human: "Erfordert Netzwerk-Simulation und WebSocket-Verhalten — kann nicht statisch verifiziert werden"
  - test: "Aktivitaets-Antrag offline stellen und nach Reconnect in der Antrags-Liste pruefen"
    expected: "Antrag erscheint sofort in der Liste mit Uhr-Icon, verschwindet nach Flush und taucht als echter Antrag wieder auf"
    why_human: "End-to-end Verhalten ueber Queue-Flush erfordert echte App-Ausfuehrung"
---

# Phase 60: Queue Kern + Konfi-Aktionen — Verifikationsbericht

**Phase-Ziel:** Konfis koennen Chat-Nachrichten senden und Aktivitaets-Antraege stellen auch wenn sie offline sind — alles wird bei Reconnect automatisch zugestellt
**Verifiziert:** 2026-03-21T12:00:00Z
**Status:** gaps_found
**Re-Verifikation:** Ja — nach initialem Verifikationsdurchlauf (2026-03-21T10:30:00Z)

---

## Re-Verifikation Zusammenfassung

| Kategorie | Anzahl | Details |
|-----------|--------|---------|
| Luecken geschlossen | 0 | Gap aus initialer Verifikation besteht weiterhin |
| Luecken offen | 1 | QUE-K02: _localFilePath in flush() nicht behandelt |
| Regressionen | 0 | Alle zuvor verifizierten Punkte bleiben stabil |

---

## Ziel-Erreichung

### Beobachtbare Wahrheiten

| # | Wahrheit | Status | Nachweis |
|---|----------|--------|----------|
| 1 | Queue-Items ueberleben App-Neustart (persistent in Capacitor Preferences) | VERIFIZIERT | `writeQueue.ts` Zeilen 44-62: `queue:items` Key, `_load()`/`_save()` mit Preferences.get/set |
| 2 | Queue wird bei App-Resume und networkMonitor Online-Wechsel automatisch geflusht | VERIFIZIERT | `AppContext.tsx` Zeile 306: `writeQueue.flush()` bei Resume. `writeQueue.ts` Zeile 326-330: networkMonitor.subscribe mit flush() |
| 3 | Bei App-Background werden nur Text-Items geflusht | VERIFIZIERT | `AppContext.tsx` Zeile 314-318: BackgroundTask.beforeExit + flushTextOnly(). Items mit hasFileUpload===true werden uebersprungen. |
| 4 | 4xx-Fehler entfernen Item und informieren User via Toast | VERIFIZIERT | `writeQueue.ts` Zeilen 204-209: 4xx (ausser 408/429) entfernt Item + showFailedToast() |
| 5 | 5xx/408/429 erhoehen retryCount, nach 5 Retries Item entfernen | VERIFIZIERT | `writeQueue.ts` Zeilen 211-223: retryCount++, bei retryCount >= maxRetries Item entfernen |
| 6 | Konfi kann offline Text-Nachricht senden mit sofortigem Uhr-Icon | VERIFIZIERT | `ChatRoom.tsx`: optimisticMsg mit queueStatus: 'pending' und negativer temporaerer ID |
| 7 | Konfi kann offline Bild-Nachricht senden — lokal gespeichert, Upload bei Reconnect | PARTIELL | ChatRoom.tsx Zeilen 557-575: korrekte lokale Speicherung. writeQueue.ts flush(): kein resolveLocalFile() fuer _localFilePath vorhanden |
| 8 | Retry/Delete bei fehlgeschlagenen Nachrichten via ActionSheet | VERIFIZIERT | `ChatRoom.tsx` Zeilen 210-243: handleRetryMessage und handleDeleteQueuedMessage vollstaendig |
| 9 | Konfi kann offline Aktivitaets-Antrag ohne Foto stellen | VERIFIZIERT | `ActivityRequestModal.tsx` Zeile 181: networkMonitor.isOnline, Zeile 241: writeQueue.enqueue |
| 10 | Konfi kann offline Aktivitaets-Antrag mit Foto stellen | VERIFIZIERT | `ActivityRequestModal.tsx` + `writeQueue.ts` resolveLocalPhoto() vollstaendig implementiert |
| 11 | Konfi kann offline Opt-out bei Pflicht-Event machen | VERIFIZIERT | `EventDetailView.tsx`: networkMonitor.isOnline Check + writeQueue.enqueue |
| 12 | Optimistic Items verschwinden nach Queue-Flush und echtem Reload | VERIFIZIERT (Logik) | KonfiRequestsPage laedt Queue-Items bei jedem loadData-Aufruf neu |
| 13 | Chat mark-as-read wird offline gequeued ohne UI-Feedback | VERIFIZIERT | `BadgeContext.tsx`: fire-and-forget writeQueue.enqueue |
| 14 | Emoji-Reaktionen sofort optimistisch angezeigt, offline gequeued | VERIFIZIERT | `ChatRoom.tsx`: Optimistic Toggle + fire-and-forget Queue-Eintrag |
| 15 | Badges mark-seen offline gequeued ohne UI-Feedback | VERIFIZIERT | `KonfiBadgesPage.tsx` + `TeamerBadgesView.tsx`: fire-and-forget Queue-Fallback |
| 16 | Poll-Abstimmung sofort optimistisch, offline gequeued | VERIFIZIERT | `ChatRoom.tsx`: Optimistic Vote in Messages-State + Queue-Eintrag |
| 17 | Bibeluebersetzung aendern offline gequeued mit optimistischem Update | VERIFIZIERT | `ProfileView.tsx`: optimistisches setSelectedTranslation + Queue-Eintrag |
| 18 | Dashboard-Settings Toggles offline gequeued mit optimistischem Update | VERIFIZIERT | `AdminDashboardSettingsPage.tsx`: fire-and-forget fuer beide Toggle-Handler |
| 19 | Chat-Permissions Toggles und Funktionsbeschreibung offline gequeued | VERIFIZIERT | `ChatPermissionsSettings.tsx` + `ChangeRoleTitleModal.tsx`: fire-and-forget |

**Ergebnis:** 18/19 Wahrheiten verifiziert (1 partiell — unveraendert seit initialer Verifikation)

---

## Erforderliche Artefakte

| Artefakt | Beschreibung | Status | Details |
|----------|-------------|--------|---------|
| `frontend/src/services/writeQueue.ts` | WriteQueue Service | VERIFIZIERT (mit Luecke) | Vollstaendige API vorhanden. LUECKE: flush() behandelt _localFilePath nicht. |
| `frontend/src/contexts/AppContext.tsx` | App-Resume + Background-Task | VERIFIZIERT | writeQueue.flush() bei Resume, BackgroundTask.beforeExit |
| `frontend/src/components/chat/ChatRoom.tsx` | Chat Queue-Integration | VERIFIZIERT (Speicher-Seite) | sendMessage, Optimistic UI, Retry/Delete korrekt. Bild-Speicherung korrekt — Flush-Seite in writeQueue fehlt. |
| `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` | Antraege Queue-Fallback | VERIFIZIERT | Online/Offline-Branching + _localPhotoPath |
| `frontend/src/components/konfi/views/EventDetailView.tsx` | Opt-out Queue-Fallback | VERIFIZIERT | handleOptOut mit Queue-Enqueue |
| `frontend/src/components/konfi/pages/KonfiRequestsPage.tsx` | Pending Queue-Anzeige | VERIFIZIERT | writeQueue.getByMetadata + timeOutline-Icon |
| `frontend/src/contexts/BadgeContext.tsx` | mark-read fire-and-forget | VERIFIZIERT | fire-and-forget Queue-Pattern |
| `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx` | Badges mark-seen | VERIFIZIERT | writeQueue.enqueue wenn offline |
| `frontend/src/components/teamer/views/TeamerBadgesView.tsx` | Teamer Badges mark-seen | VERIFIZIERT | writeQueue.enqueue wenn offline |
| `frontend/src/components/konfi/views/ProfileView.tsx` | Bibeluebersetzung | VERIFIZIERT | Optimistic Update + Queue-Eintrag |
| `frontend/src/components/admin/pages/AdminDashboardSettingsPage.tsx` | Dashboard-Toggles | VERIFIZIERT | fire-and-forget fuer beide Toggle-Handler |
| `frontend/src/components/admin/settings/ChatPermissionsSettings.tsx` | Chat-Permissions | VERIFIZIERT | fire-and-forget Queue-Pattern |
| `frontend/src/components/admin/modals/ChangeRoleTitleModal.tsx` | Funktionsbeschreibung | VERIFIZIERT | fire-and-forget Queue-Pattern |

---

## Key Link Verifikation

| Von | Nach | Via | Status | Details |
|-----|------|-----|--------|---------|
| `writeQueue.ts` | Capacitor Preferences | `Preferences.get/set` mit `queue:items` | VERIFIZIERT | Zeilen 45, 62 |
| `writeQueue.ts` | `networkMonitor.ts` | `networkMonitor.subscribe` | VERIFIZIERT | Zeile 326 |
| `writeQueue.ts` | `api.ts` | `api.post/put/delete` | VERIFIZIERT | Zeilen 189-193 |
| `AppContext.tsx` | `writeQueue.ts` | `writeQueue.flush` bei Resume, `flushTextOnly` bei Background | VERIFIZIERT | Zeilen 306, 316 |
| `ChatRoom.tsx` | `writeQueue.ts` | `writeQueue.enqueue` bei offline sendMessage | VERIFIZIERT | vorhanden |
| `ChatRoom.tsx` | `networkMonitor.ts` | `networkMonitor.isOnline` | VERIFIZIERT | vorhanden |
| `ActivityRequestModal.tsx` | `writeQueue.ts` | `writeQueue.enqueue` bei offline | VERIFIZIERT | Zeile 241 |
| `EventDetailView.tsx` | `writeQueue.ts` | `writeQueue.enqueue` bei offline opt-out | VERIFIZIERT | vorhanden |
| `BadgeContext.tsx` | `writeQueue.ts` | `writeQueue.enqueue` fire-and-forget | VERIFIZIERT | vorhanden |
| `ChatRoom.tsx (reaction/poll)` | `writeQueue.ts` | `writeQueue.enqueue` fire-and-forget | VERIFIZIERT | vorhanden |
| `writeQueue.ts flush()` | `_localFilePath` (Chat-Bilder) | FormData-Konvertierung | FEHLT | Kein resolveLocalFile() fuer Chat-Bild-Queue-Items |

---

## Requirements-Abdeckung

| Requirement | Quell-Plan | Beschreibung | Status | Nachweis |
|-------------|-----------|-------------|--------|----------|
| QUE-I01 | Plan 01 | Queue-Flush bei App-Resume und Reconnect | ERFUELLT | AppContext Resume-Flush + networkMonitor.subscribe |
| QUE-I02 | Plan 01 | Queue persistent in Capacitor Preferences | ERFUELLT | `queue:items` Key, _load/_save |
| QUE-I03 | Plan 01 | Background-Task fuer Text-only Flush | ERFUELLT | BackgroundTask.beforeExit + flushTextOnly() |
| QUE-I04 | Plan 01 | 4xx Fehler: Item entfernen + Toast | ERFUELLT | flush() Fehlerbehandlung + showFailedToast |
| QUE-I05 | Plan 01 | 5xx/408/429: retryCount++, max 5 Retries | ERFUELLT | flush() retry-Logik |
| QUE-K01 | Plan 02 | Chat Text-Nachricht offline mit Uhr-Icon | ERFUELLT | Optimistic UI + writeQueue.enqueue |
| QUE-K02 | Plan 02 | Chat Bild-Nachricht offline, lokale Speicherung + Upload bei Reconnect | PARTIELL | Speicherung korrekt, Flush fehlt resolveLocalFile() |
| QUE-K03 | Plan 03 | Aktivitaets-Antrag ohne Foto offline | ERFUELLT | ActivityRequestModal + KonfiRequestsPage pending-Anzeige |
| QUE-K04 | Plan 03 | Aktivitaets-Antrag mit Foto offline | ERFUELLT | Lokale Speicherung + resolveLocalPhoto in flush() |
| QUE-K05 | Plan 03 | Opt-out bei Pflicht-Event offline | ERFUELLT | EventDetailView mit Queue-Fallback |
| QUE-FF01 | Plan 04 | Chat mark-read offline, kein UI-Feedback | ERFUELLT | BadgeContext fire-and-forget |
| QUE-FF02 | Plan 04 | Emoji-Reaktion toggle optimistisch + Queue | ERFUELLT | ChatRoom toggleReaction offline-Pfad |
| QUE-FF03 | Plan 04 | Badges mark-seen offline | ERFUELLT | KonfiBadgesPage + TeamerBadgesView |
| QUE-FF04 | Plan 04 | Poll-Abstimmung optimistisch + Queue | ERFUELLT | ChatRoom voteInPoll offline-Pfad |
| QUE-FF05 | Plan 04 | Bibeluebersetzung optimistisch + Queue | ERFUELLT | ProfileView offline-Pfad |
| QUE-FF06 | Plan 04 | Dashboard-Settings Toggle optimistisch | ERFUELLT | AdminDashboardSettingsPage offline-Pfad |
| QUE-FF07 | Plan 04 | Chat-Permissions Toggle optimistisch | ERFUELLT | ChatPermissionsSettings offline-Pfad |
| QUE-FF08 | Plan 04 | Funktionsbeschreibung aendern offline | ERFUELLT | ChangeRoleTitleModal offline-Pfad |
| OUI-13 | Plan 04 | Kein Queue-Feedback bei Fire-and-Forget | ERFUELLT | Alle fire-and-forget-Items ohne Uhr-Icon/Badge |

---

## Gefundene Anti-Patterns

Keine blockierenden Anti-Patterns. Keine TODO/FIXME/PLACEHOLDER-Kommentare in den verifizierten Dateien.

---

## Menschliche Verifikation erforderlich

### 1. Chat Text-Nachricht Offline-Flow

**Test:** App offline schalten (Flugzeugmodus), Text-Nachricht im Chat senden, wieder online gehen.
**Erwartet:** Nachricht erscheint sofort mit Uhr-Icon, wird nach Reconnect durch echte Server-Nachricht ersetzt.
**Warum menschlich:** Erfordert echte App-Ausfuehrung, WebSocket-Verhalten und Netzwerk-Simulation.

### 2. Aktivitaets-Antrag Offline-Flow (Ende-zu-Ende)

**Test:** App offline schalten, Antrag stellen, wieder online gehen, Antrags-Liste oeffnen.
**Erwartet:** Antrag erscheint mit Uhr-Icon in der Liste (pending), wird nach Flush als echter Antrag angezeigt.
**Warum menschlich:** Ende-zu-Ende ueber Queue-Flush, Backend-Antwort und UI-Reload.

---

## Luecken-Zusammenfassung

**1 Luecke blockiert die vollstaendige Erreichung des Phasen-Ziels (unveraendert seit initialer Verifikation):**

**QUE-K02 partiell — writeQueue.ts flush() fehlt resolveLocalFile():**

- `ChatRoom.tsx` Zeilen 557-575: Bild korrekt als Base64 in Capacitor Filesystem gespeichert (`queue-uploads/${fileName}`), Felder `_localFilePath`, `_fileName`, `_fileType` im Queue-Item-Body gesetzt.
- `writeQueue.ts` Zeile 180: flush() prueft nur `body._localPhotoPath` und ruft `resolveLocalPhoto()` auf. Kein analoger Block fuer `_localFilePath`.
- Aktuelles Verhalten beim Flush: Item wird als JSON POST gesendet mit dem Pfad-String als Wert — das Backend erwartet multipart/form-data und wird mit 4xx antworten. Das Item wird danach permanent aus der Queue entfernt, das Bild geht verloren.
- `resolveLocalPhoto()` (Zeilen 104-148) zeigt das vollstaendige Pattern: Datei aus Filesystem lesen, Base64 zu Blob konvertieren, FormData bauen, Upload-Endpoint aufrufen, lokale Datei loeschen. Eine analoge `resolveLocalFile()` Funktion fuer den Chat-Bild-Upload-Endpoint ist erforderlich.

**Umfang:** Klein — das Pattern existiert bereits, es muss nur auf _localFilePath adaptiert werden.

---

_Verifiziert: 2026-03-21T12:00:00Z_
_Verifikator: Claude (gsd-verifier)_
