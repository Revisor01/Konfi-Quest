# Requirements: Konfi Quest

**Defined:** 2026-03-19
**Updated:** 2026-03-20
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.1 Requirements

Requirements fuer Milestone v2.1 App-Resilienz. Offline-Faehigkeit und Zuverlaessigkeit.

### Storage-Migration (STR)

- [x] **STR-01**: JWT-Token und User-Daten werden in Capacitor Preferences statt localStorage gespeichert (iOS-sicher)
- [x] **STR-02**: Device-ID und Push-Token-Timestamp werden in Capacitor Preferences gespeichert
- [x] **STR-03**: Bestehende localStorage-Daten werden beim App-Start automatisch migriert (einmalig)
- [x] **STR-04**: Globaler TokenStore (In-Memory-Cache + async Preferences) ersetzt alle 28 localStorage-Zugriffe in 14 Dateien

### Offline-Erkennung (NET)

- [x] **NET-01**: App erkennt Online/Offline-Status ueber @capacitor/network + Axios-Error-Fallback
- [x] **NET-02**: isOnline Status im AppContext fuer alle Komponenten verfuegbar
- [x] **NET-03**: Socket.io Reconnect nach Offline-Phase laedt verpasste Daten nach (Chat-Nachrichten via ?after=lastMessageId)
- [x] **NET-04**: Axios 401-Handler prueft Netzwerkstatus bevor Token geloescht wird (kein Offline-Logout)

### Lese-Cache (CAC)

- [ ] **CAC-01**: useOfflineQuery Hook cached API-Responses in Capacitor Preferences mit Stale-While-Revalidate
- [ ] **CAC-02**: Dashboard-Daten (Punkte, Badges, Level, Ranking) sind offline lesbar — Konfi, Admin, Teamer
- [ ] **CAC-03**: Chat-Raeume und letzte Nachrichten sind offline lesbar (bis 100 Msgs/Raum, 1h TTL)
- [ ] **CAC-04**: Events (angemeldete + anstehende) sind offline lesbar — alle Rollen
- [ ] **CAC-05**: Eigene Antraege mit Status sind offline lesbar (Konfi + Admin-Antrags-Liste)
- [ ] **CAC-06**: Profil-Daten sind offline lesbar — alle Rollen
- [ ] **CAC-07**: Admin-Stammdaten offline lesbar: Konfis-Liste, Aktivitaeten, Badges, Kategorien, Jahrgaenge, Level, Zertifikat-Typen, Settings, Invite-Codes
- [ ] **CAC-08**: Teamer-spezifische Daten offline lesbar: Material-Liste (Metadaten, keine Dateien), Badges, Konfi-Stats
- [ ] **CAC-09**: Alle 30 Pages nutzen useOfflineQuery statt direktem api.get()
- [ ] **CAC-10**: Gecachte Daten werden sofort angezeigt, im Hintergrund aktualisiert (SWR-Pattern)
- [ ] **CAC-11**: Bei Logout werden alle user-spezifischen Cache-Keys geloescht

### Retry + Schutz (RET)

- [ ] **RET-01**: Transiente Netzwerk-Fehler werden automatisch 3x mit Exponential Backoff wiederholt (axios-retry)
- [ ] **RET-02**: Alle Submit-Buttons haben Loading-State und sind waehrend Request disabled (Double-Submit-Schutz)
- [ ] **RET-03**: Backend unterstuetzt Idempotency-Keys (client_id UUID) fuer alle queue-faehigen Aktionen

### Offline-UI (OUI)

#### Corner-Badge System fuer Queue-Status

Listen-Elemente zeigen Queue-Status als zusaetzliches Corner-Badge neben bestehenden Status-Badges. Referenz-Implementierung: PointsHistoryModal (Flex-Container mit mehreren Badges).

- [ ] **OUI-01**: Neuer `.app-corner-badges` Flex-Container ersetzt einzelne absolute Corner-Badges — alle bestehenden Badges migrieren
- [ ] **OUI-02**: Badge-Rundung: Alle ausser letztes Kind `border-radius: 0 0 10px 10px` (unten beide), letztes Kind `border-radius: 0 10px 0 10px` (oben-rechts Card-Ecke + unten-links Eselsohr)
- [ ] **OUI-03**: 2px weisser Trenner zwischen Badges (wie PointsHistory)
- [ ] **OUI-04**: Queue-Badge ist immer das linkste Badge im Container — nur Uhr-Icon (timeOutline), kein Text, orange #ff9500
- [ ] **OUI-05**: Nach erfolgreicher Zustellung verschwindet das Queue-Badge einfach (kein Haekchen, kein Feedback)
- [ ] **OUI-06**: Bei permanentem Fehler (4xx) wechselt Uhr-Icon zu Ausrufezeichen (alertCircleOutline), Farbe wird rot #dc3545
- [ ] **OUI-07**: Fehlgeschlagene Queue-Items zeigen bei Tap "Erneut senden" oder "Loeschen" als Optionen

#### Chat-Nachrichten Queue-Status

- [ ] **OUI-08**: Pending Chat-Nachricht zeigt Uhr-Icon (timeOutline) neben dem Zeitstempel rechts unten in der Bubble
- [ ] **OUI-09**: Nach Zustellung verschwindet die Uhr (kein Haekchen)
- [ ] **OUI-10**: Bei Fehler wechselt Uhr zu Ausrufezeichen rot, Tap auf Nachricht zeigt "Erneut senden" oder "Loeschen"

#### Online-Only Buttons

- [ ] **OUI-11**: Online-only Buttons zeigen "Du bist offline" als Text und sind disabled wenn offline
- [ ] **OUI-12**: Kein globales Offline-Banner — nur kontextbezogene Anzeigen an betroffenen Elementen

#### Fire-and-Forget

- [ ] **OUI-13**: Fire-and-Forget Aktionen (Mark-Read, Reaktionen, Poll, Settings-Toggles) zeigen kein Queue-Feedback — rein optimistisch

### Schreib-Queue (QUE)

Queue-faehige Aktionen werden bei Offline in eine persistente Queue geschrieben und bei Reconnect automatisch gesendet. Optimistic UI zeigt das Element sofort an.

#### Konfi-Aktionen (5 Aktionen)

- [ ] **QUE-K01**: Chat-Nachricht senden (Text) — Uhr-Icon an Nachricht
- [ ] **QUE-K02**: Chat-Nachricht senden (mit Bild) — Bild lokal in Capacitor Filesystem, Upload nur im Vordergrund
- [ ] **QUE-K03**: Aktivitaets-Antrag stellen (ohne Foto) — Uhr-Icon am Antrag in der Liste
- [ ] **QUE-K04**: Aktivitaets-Antrag stellen (mit Foto) — Foto lokal, Upload nur im Vordergrund
- [ ] **QUE-K05**: Opt-out bei Pflicht-Event mit Begruendung — Uhr-Icon am Event

#### Alle Rollen: Fire-and-Forget (5 Aktionen)

- [ ] **QUE-FF01**: Chat mark-as-read — kein UI-Feedback noetig
- [ ] **QUE-FF02**: Emoji-Reaktion toggle — sofort optimistisch, Queue im Hintergrund
- [ ] **QUE-FF03**: Badges als gesehen markieren (Konfi + Teamer) — kein UI-Feedback noetig
- [ ] **QUE-FF04**: Poll-Abstimmung — sofort optimistisch
- [ ] **QUE-FF05**: Bibeluebersetzung waehlen (Konfi) — sofort optimistisch
- [ ] **QUE-FF06**: Dashboard-Settings Toggle (Admin) — sofort optimistisch
- [ ] **QUE-FF07**: Chat-Permissions Toggle (Admin) — sofort optimistisch
- [ ] **QUE-FF08**: Funktionsbeschreibung aendern — sofort optimistisch

#### Admin-Aktionen (17 Aktionen)

- [ ] **QUE-A01**: Event erstellen (einzeln) — Uhr-Icon am Event in der Liste
- [ ] **QUE-A02**: Event bearbeiten — Uhr-Icon am Event
- [ ] **QUE-A03**: Event-Serie erstellen — Uhr-Icon an allen Serien-Events
- [ ] **QUE-A04**: Aktivitaet erstellen — Uhr-Icon an Aktivitaet
- [ ] **QUE-A05**: Aktivitaet bearbeiten — Uhr-Icon an Aktivitaet
- [ ] **QUE-A06**: Badge erstellen — Uhr-Icon am Badge
- [ ] **QUE-A07**: Badge bearbeiten — Uhr-Icon am Badge
- [ ] **QUE-A08**: Kategorie erstellen — Uhr-Icon an Kategorie
- [ ] **QUE-A09**: Kategorie bearbeiten — Uhr-Icon an Kategorie
- [ ] **QUE-A10**: Jahrgang erstellen — Uhr-Icon am Jahrgang
- [ ] **QUE-A11**: Jahrgang bearbeiten — Uhr-Icon am Jahrgang
- [ ] **QUE-A12**: Level erstellen — Uhr-Icon am Level
- [ ] **QUE-A13**: Level bearbeiten — Uhr-Icon am Level
- [ ] **QUE-A14**: Zertifikat-Typ erstellen — Uhr-Icon am Typ
- [ ] **QUE-A15**: Zertifikat-Typ bearbeiten — Uhr-Icon am Typ
- [ ] **QUE-A16**: Material erstellen (Metadaten + Dateien) — Uhr-Icon am Material, Dateien lokal in Filesystem, Upload im Vordergrund
- [ ] **QUE-A17**: Material bearbeiten (Metadaten) — Uhr-Icon am Material
- [ ] **QUE-A18**: Antrag genehmigen/ablehnen — Uhr-Icon am Antrag
- [ ] **QUE-A19**: Antrag zuruecksetzen — Uhr-Icon am Antrag
- [ ] **QUE-A20**: Bonus-Punkte vergeben — Uhr-Icon am Bonus-Eintrag
- [ ] **QUE-A21**: Aktivitaet einem Konfi zuweisen — Uhr-Icon an Aktivitaet

#### Teamer-Aktionen (2 Aktionen)

- [ ] **QUE-T01**: Event buchen (Teamer) — Uhr-Icon am Event
- [ ] **QUE-T02**: Event abmelden (Teamer) — Uhr-Icon am Event

#### Queue-Infrastruktur

- [ ] **QUE-I01**: Queue wird beim App-Resume und bei Reconnect automatisch abgearbeitet
- [ ] **QUE-I02**: Queue ueberlebt App-Neustart (persistent in Capacitor Preferences)
- [ ] **QUE-I03**: Queue-Flush bei App-Background via @capawesome/capacitor-background-task (nur Text, keine Datei-Uploads)
- [ ] **QUE-I04**: Fehlgeschlagene Items (4xx) werden aus Queue entfernt und User informiert
- [ ] **QUE-I05**: Retribare Fehler (5xx, 408, 429) bleiben in Queue fuer naechsten Flush (max 5 Retries)

### Online-Only Aktionen (OOA)

Diese Aktionen zeigen "Du bist offline" am Button wenn offline. Keine Queue.

- [ ] **OOA-01**: Punkte vergeben (Server-Autoritaet, Duplikat-Risiko bei zwei Admins)
- [ ] **OOA-02**: Konfi befoerdern zu Teamer (Sicherheitskritisch, Rollen-Aenderung)
- [ ] **OOA-03**: Konfi bearbeiten (Jahrgang-Zuweisung, Teamer-Since)
- [ ] **OOA-04**: Event buchen/abmelden (Konfi) — Kapazitaetspruefung, Wartelisten-Logik
- [ ] **OOA-05**: Event absagen — loest Push-Notifications aus, muss sofort passieren
- [ ] **OOA-06**: Event loeschen / Serie loeschen — destruktiv, nicht umkehrbar
- [ ] **OOA-07**: Chat-Raum erstellen (braucht Server-generierte Room-ID + Teilnehmer-Validierung)
- [ ] **OOA-08**: Chat-Raum loeschen — destruktiv
- [ ] **OOA-09**: Chat-Mitglieder verwalten (hinzufuegen/entfernen) — Verwirrend wenn verzoegert
- [ ] **OOA-10**: Chat verlassen — Server muss Teilnehmer sofort entfernen
- [ ] **OOA-11**: Chat-Nachricht loeschen — Server muss sofort loeschen + WebSocket-Event
- [ ] **OOA-12**: Passwort aendern — Sicherheitskritisch
- [ ] **OOA-13**: E-Mail aendern — Server-Validierung (Format, Duplikat)
- [ ] **OOA-14**: QR-Check-in — Server-Validierung (Zeitfenster, Token)
- [ ] **OOA-15**: QR-Code generieren — Server generiert JWT
- [ ] **OOA-16**: Event-Chat erstellen — Server erstellt Raum + Teilnehmer
- [ ] **OOA-17**: Konfi registrieren — Server-Validierung (Username, Invite-Code)
- [ ] **OOA-18**: Invite-Code erstellen/verlaengern/loeschen — Server generiert Code
- [ ] **OOA-19**: Organisation CRUD (Super-Admin) — sehr selten, Sicherheitskritisch
- [ ] **OOA-20**: User CRUD (Rollen-Zuweisung, Jahrgangs-Zuweisung)
- [ ] **OOA-21**: Passwort zuruecksetzen / Passwort-Reset anfordern
- [ ] **OOA-22**: Passwort regenerieren (Admin fuer Konfi)
- [ ] **OOA-23**: Konfi loeschen — destruktiv
- [ ] **OOA-24**: Aktivitaet loeschen — destruktiv
- [ ] **OOA-25**: Badge loeschen — destruktiv
- [ ] **OOA-26**: Kategorie loeschen — destruktiv
- [ ] **OOA-27**: Jahrgang loeschen — destruktiv (Konfi-Zuordnung betroffen)
- [ ] **OOA-28**: Level loeschen — destruktiv
- [ ] **OOA-29**: Zertifikat-Typ loeschen — destruktiv
- [ ] **OOA-30**: Material loeschen — destruktiv
- [ ] **OOA-31**: Material-Datei loeschen — destruktiv
- [ ] **OOA-32**: Aktivitaet bei Konfi entfernen — destruktiv
- [ ] **OOA-33**: Bonus-Punkte bei Konfi entfernen — destruktiv
- [ ] **OOA-34**: Zertifikat bei Konfi entfernen — destruktiv
- [ ] **OOA-35**: Konfi Antrag loeschen — destruktiv
- [ ] **OOA-36**: Antrag loeschen (Admin) — destruktiv
- [ ] **OOA-37**: Teilnehmer zu Event hinzufuegen — Server-Validierung (Kapazitaet)
- [ ] **OOA-38**: Teilnehmer von Event entfernen — Nachrueck-Logik
- [ ] **OOA-39**: Teilnehmer-Status aendern (Anwesenheit) — Server-Validierung
- [ ] **OOA-40**: Teilnehmer-Wartelisten-Status aendern — Nachrueck-Logik
- [ ] **OOA-41**: Zertifikat einem Konfi ausstellen — Server-Autoritaet
- [ ] **OOA-42**: Jahrgangs-Chat erstellen (Admin bei Konfi-Erstellung)

### Sync (SYN)

- [ ] **SYN-01**: Bei App-Start wird Cache revalidiert (SWR-Pattern, keine separate Sync-Logik)
- [ ] **SYN-02**: Bei Socket.io Reconnect: Erst Queue flushen, dann Cache invalidieren, dann Badge-Counts aktualisieren
- [ ] **SYN-03**: Backend Chat-Route unterstuetzt ?after=lastMessageId Parameter fuer verpasste Nachrichten
- [ ] **SYN-04**: Bei App-Resume (appStateChange) wird aktive Page revalidiert

## v3.0 Requirements

Deferred. Onboarding, Landing Website, Readme, Wiki.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Volle Offline-App mit lokaler DB | SQLite/PouchDB Overkill fuer Datenmenge (<230KB/User), Capacitor Preferences reicht |
| Service Worker / PWA | iOS WKWebView hat unreliable Service Worker Support, Capacitor-native ist besser |
| Konflikt-Aufloesung UI | Last-Write-Wins + Idempotency-Keys reichen, kein manuelles Merge noetig |
| Periodischer Background-Sync | iOS BGTaskScheduler unzuverlaessig, App-Resume + Reconnect reichen |
| Offline Event-Buchung (Konfi) | Kapazitaetspruefung + Warteliste braucht Server |
| Offline Punkte-Vergabe | Server-Autoritaet, Duplikat-Risiko bei mehreren Admins |
| Material-Dateien vorab cachen | Zu gross, nur Metadaten cachen |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STR-01 | Phase 55 | Complete |
| STR-02 | Phase 55 | Complete |
| STR-03 | Phase 55 | Complete |
| STR-04 | Phase 55 | Complete |
| NET-01 | Phase 55 | Complete |
| NET-02 | Phase 55 | Complete |
| NET-03 | Phase 55 | Complete |
| NET-04 | Phase 55 | Complete |
| CAC-01 | Phase 56 | Pending |
| CAC-02 | Phase 56 | Pending |
| CAC-03 | Phase 56 | Pending |
| CAC-04 | Phase 56 | Pending |
| CAC-05 | Phase 56 | Pending |
| CAC-06 | Phase 56 | Pending |
| CAC-07 | Phase 56 | Pending |
| CAC-08 | Phase 56 | Pending |
| CAC-09 | Phase 56 | Pending |
| CAC-10 | Phase 56 | Pending |
| CAC-11 | Phase 56 | Pending |
| RET-01 | Phase 57 | Pending |
| RET-02 | Phase 57 | Pending |
| RET-03 | Phase 57 | Pending |
| OUI-01 | Phase 58 | Pending |
| OUI-02 | Phase 58 | Pending |
| OUI-03 | Phase 58 | Pending |
| OUI-04 | Phase 58 | Pending |
| OUI-05 | Phase 58 | Pending |
| OUI-06 | Phase 58 | Pending |
| OUI-07 | Phase 58 | Pending |
| OUI-08 | Phase 59 | Pending |
| OUI-09 | Phase 59 | Pending |
| OUI-10 | Phase 59 | Pending |
| OUI-11 | Phase 59 | Pending |
| OUI-12 | Phase 59 | Pending |
| OUI-13 | Phase 60 | Pending |
| QUE-K01 | Phase 60 | Pending |
| QUE-K02 | Phase 60 | Pending |
| QUE-K03 | Phase 60 | Pending |
| QUE-K04 | Phase 60 | Pending |
| QUE-K05 | Phase 60 | Pending |
| QUE-FF01 | Phase 60 | Pending |
| QUE-FF02 | Phase 60 | Pending |
| QUE-FF03 | Phase 60 | Pending |
| QUE-FF04 | Phase 60 | Pending |
| QUE-FF05 | Phase 60 | Pending |
| QUE-FF06 | Phase 60 | Pending |
| QUE-FF07 | Phase 60 | Pending |
| QUE-FF08 | Phase 60 | Pending |
| QUE-A01 | Phase 61 | Pending |
| QUE-A02 | Phase 61 | Pending |
| QUE-A03 | Phase 61 | Pending |
| QUE-A04 | Phase 61 | Pending |
| QUE-A05 | Phase 61 | Pending |
| QUE-A06 | Phase 61 | Pending |
| QUE-A07 | Phase 61 | Pending |
| QUE-A08 | Phase 61 | Pending |
| QUE-A09 | Phase 61 | Pending |
| QUE-A10 | Phase 61 | Pending |
| QUE-A11 | Phase 61 | Pending |
| QUE-A12 | Phase 61 | Pending |
| QUE-A13 | Phase 61 | Pending |
| QUE-A14 | Phase 61 | Pending |
| QUE-A15 | Phase 61 | Pending |
| QUE-A16 | Phase 61 | Pending |
| QUE-A17 | Phase 61 | Pending |
| QUE-A18 | Phase 61 | Pending |
| QUE-A19 | Phase 61 | Pending |
| QUE-A20 | Phase 61 | Pending |
| QUE-A21 | Phase 61 | Pending |
| QUE-T01 | Phase 61 | Pending |
| QUE-T02 | Phase 61 | Pending |
| QUE-I01 | Phase 60 | Pending |
| QUE-I02 | Phase 60 | Pending |
| QUE-I03 | Phase 60 | Pending |
| QUE-I04 | Phase 60 | Pending |
| QUE-I05 | Phase 60 | Pending |
| OOA-01 | Phase 59 | Pending |
| OOA-02 | Phase 59 | Pending |
| OOA-03 | Phase 59 | Pending |
| OOA-04 | Phase 59 | Pending |
| OOA-05 | Phase 59 | Pending |
| OOA-06 | Phase 59 | Pending |
| OOA-07 | Phase 59 | Pending |
| OOA-08 | Phase 59 | Pending |
| OOA-09 | Phase 59 | Pending |
| OOA-10 | Phase 59 | Pending |
| OOA-11 | Phase 59 | Pending |
| OOA-12 | Phase 59 | Pending |
| OOA-13 | Phase 59 | Pending |
| OOA-14 | Phase 59 | Pending |
| OOA-15 | Phase 59 | Pending |
| OOA-16 | Phase 59 | Pending |
| OOA-17 | Phase 59 | Pending |
| OOA-18 | Phase 59 | Pending |
| OOA-19 | Phase 59 | Pending |
| OOA-20 | Phase 59 | Pending |
| OOA-21 | Phase 59 | Pending |
| OOA-22 | Phase 59 | Pending |
| OOA-23 | Phase 59 | Pending |
| OOA-24 | Phase 59 | Pending |
| OOA-25 | Phase 59 | Pending |
| OOA-26 | Phase 59 | Pending |
| OOA-27 | Phase 59 | Pending |
| OOA-28 | Phase 59 | Pending |
| OOA-29 | Phase 59 | Pending |
| OOA-30 | Phase 59 | Pending |
| OOA-31 | Phase 59 | Pending |
| OOA-32 | Phase 59 | Pending |
| OOA-33 | Phase 59 | Pending |
| OOA-34 | Phase 59 | Pending |
| OOA-35 | Phase 59 | Pending |
| OOA-36 | Phase 59 | Pending |
| OOA-37 | Phase 59 | Pending |
| OOA-38 | Phase 59 | Pending |
| OOA-39 | Phase 59 | Pending |
| OOA-40 | Phase 59 | Pending |
| OOA-41 | Phase 59 | Pending |
| OOA-42 | Phase 59 | Pending |
| SYN-01 | Phase 62 | Pending |
| SYN-02 | Phase 62 | Pending |
| SYN-03 | Phase 62 | Pending |
| SYN-04 | Phase 62 | Pending |

**Coverage v2.1:**
- v2.1 requirements: 122 total
- Mapped to phases: 122
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Updated: 2026-03-20 — Roadmap erstellt, alle 122 Requirements auf Phasen 55-62 gemappt*
