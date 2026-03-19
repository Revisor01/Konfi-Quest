# Requirements: Konfi Quest

**Defined:** 2026-03-19
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.1 Requirements

Requirements fuer Milestone v2.1 App-Resilienz. Offline-Faehigkeit und Zuverlaessigkeit.

### Storage-Migration (STR)

- [ ] **STR-01**: JWT-Token und User-Daten werden in Capacitor Preferences statt localStorage gespeichert (iOS-sicher)
- [ ] **STR-02**: Device-ID und Push-Token werden in Capacitor Preferences gespeichert
- [ ] **STR-03**: Bestehende localStorage-Daten werden beim App-Start automatisch migriert (einmalig)

### Offline-Erkennung (NET)

- [ ] **NET-01**: App erkennt Online/Offline-Status ueber @capacitor/network + Axios-Error-Fallback
- [ ] **NET-02**: NetworkContext stellt isOnline Status fuer alle Komponenten bereit
- [ ] **NET-03**: Socket.io Reconnect nach Offline-Phase laedt verpasste Daten nach

### Lese-Cache (CAC)

- [ ] **CAC-01**: useOfflineQuery Hook cached API-Responses in Capacitor Preferences mit Stale-While-Revalidate
- [ ] **CAC-02**: Dashboard-Daten (Punkte, Badges, Level, Ranking) sind offline lesbar
- [ ] **CAC-03**: Chat-Raeume und letzte Nachrichten sind offline lesbar
- [ ] **CAC-04**: Events (angemeldete + anstehende) sind offline lesbar
- [ ] **CAC-05**: Eigene Antraege mit Status sind offline lesbar
- [ ] **CAC-06**: Profil-Daten sind offline lesbar
- [ ] **CAC-07**: Alle ~25 Pages nutzen useOfflineQuery statt direktem api.get
- [ ] **CAC-08**: Gecachte Daten werden sofort angezeigt, im Hintergrund aktualisiert (SWR-Pattern)

### Retry + Schutz (RET)

- [ ] **RET-01**: Transiente Netzwerk-Fehler werden automatisch 3x mit Exponential Backoff wiederholt (axios-retry)
- [ ] **RET-02**: Alle Submit-Buttons haben Loading-State und sind waehrend Request disabled (Double-Submit-Schutz)
- [ ] **RET-03**: Backend unterstuetzt Idempotency-Keys fuer Chat-Nachrichten und Aktivitaets-Antraege

### Offline-UI (OUI)

- [ ] **OUI-01**: Buttons die online brauchen zeigen "Du bist offline" als Text und sind disabled wenn offline
- [ ] **OUI-02**: Queue-faehige Aktionen zeigen Uhr-Icon am Element bis zugestellt (Chat-Nachrichten wie WhatsApp)
- [ ] **OUI-03**: Nach Zustellung wechselt das Icon zu Haekchen (gesendet)
- [ ] **OUI-04**: Kein globales Offline-Banner — nur kontextbezogene Anzeigen an betroffenen Elementen

### Schreib-Queue (QUE)

- [ ] **QUE-01**: Chat-Nachrichten koennen offline verfasst werden und werden bei Reconnect automatisch gesendet
- [ ] **QUE-02**: Aktivitaets-Antraege koennen offline gestellt werden (Uhr-Icon bis uebermittelt)
- [ ] **QUE-03**: Admin kann offline Jahrgang, Kategorie, Event, Material, Badge, Zertifikat anlegen (Uhr-Icon bis synchronisiert)
- [ ] **QUE-04**: Queue wird beim App-Resume und bei Reconnect automatisch abgearbeitet
- [ ] **QUE-05**: Queue ueberlebt App-Neustart (persistent in Capacitor Preferences)
- [ ] **QUE-06**: Nicht-queue-faehige Aktionen (Punkte vergeben, Konfi befoerdern, Event buchen/absagen) zeigen "Du bist offline" Button

### Sync (SYN)

- [ ] **SYN-01**: Bei App-Start wird ein inkrementeller Sync durchgefuehrt (nur geaenderte Daten seit letztem Sync)
- [ ] **SYN-02**: Im Hintergrund wird alle X Minuten aktualisiert (zusaetzlich zu WebSocket-Updates)
- [ ] **SYN-03**: Backend bietet /sync/changes Endpoint mit Timestamp-basierter Delta-Abfrage
- [ ] **SYN-04**: Nach laengerer Offline-Phase (>10 Min) wird bei Reconnect ein vollstaendiger Sync getriggert

## v3.0 Requirements

Deferred. Onboarding, Landing Website, Readme, Wiki.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Volle Offline-App mit lokaler DB | SQLite/PouchDB Overkill fuer Datenmenge (<200KB/User), Capacitor Preferences reicht |
| Offline Event-Buchung | Braucht Server-Validierung (Plaetze, Warteliste), nicht sinnvoll offline |
| Offline Admin-Operationen | Punkte vergeben, Konfis verwalten braucht Server-Autoritaet |
| Service Worker / PWA | iOS WKWebView hat unreliable Service Worker Support, Capacitor-native ist besser |
| Konflikt-Aufloesung UI | Last-Write-Wins + Idempotency-Keys reichen, kein manuelles Merge noetig |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STR-01 | TBD | Pending |
| STR-02 | TBD | Pending |
| STR-03 | TBD | Pending |
| NET-01 | TBD | Pending |
| NET-02 | TBD | Pending |
| NET-03 | TBD | Pending |
| CAC-01 | TBD | Pending |
| CAC-02 | TBD | Pending |
| CAC-03 | TBD | Pending |
| CAC-04 | TBD | Pending |
| CAC-05 | TBD | Pending |
| CAC-06 | TBD | Pending |
| CAC-07 | TBD | Pending |
| CAC-08 | TBD | Pending |
| RET-01 | TBD | Pending |
| RET-02 | TBD | Pending |
| RET-03 | TBD | Pending |
| OUI-01 | TBD | Pending |
| OUI-02 | TBD | Pending |
| OUI-03 | TBD | Pending |
| OUI-04 | TBD | Pending |
| QUE-01 | TBD | Pending |
| QUE-02 | TBD | Pending |
| QUE-03 | TBD | Pending |
| QUE-04 | TBD | Pending |
| QUE-05 | TBD | Pending |
| QUE-06 | TBD | Pending |
| SYN-01 | TBD | Pending |
| SYN-02 | TBD | Pending |
| SYN-03 | TBD | Pending |
| SYN-04 | TBD | Pending |

**Coverage v2.1:**
- v2.1 requirements: 31 total
- Mapped to phases: 0
- Unmapped: 27

---
*Requirements defined: 2026-03-19*
