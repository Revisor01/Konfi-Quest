# Requirements: Konfi Quest

**Defined:** 2026-03-19
**Updated:** 2026-03-20
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.1 Requirements

Requirements fuer Milestone v2.1 App-Resilienz. Offline-Faehigkeit und Zuverlaessigkeit.

### Storage-Migration (STR)

- [ ] **STR-01**: JWT-Token und User-Daten werden in Capacitor Preferences statt localStorage gespeichert (iOS-sicher)
- [ ] **STR-02**: Device-ID und Push-Token-Timestamp werden in Capacitor Preferences gespeichert
- [ ] **STR-03**: Bestehende localStorage-Daten werden beim App-Start automatisch migriert (einmalig)
- [ ] **STR-04**: Globaler TokenStore (In-Memory-Cache + async Preferences) ersetzt alle 28 localStorage-Zugriffe in 14 Dateien

### Offline-Erkennung (NET)

- [ ] **NET-01**: App erkennt Online/Offline-Status ueber @capacitor/network + Axios-Error-Fallback
- [ ] **NET-02**: isOnline Status im AppContext fuer alle Komponenten verfuegbar
- [ ] **NET-03**: Socket.io Reconnect nach Offline-Phase laedt verpasste Daten nach (Chat-Nachrichten via ?after=lastMessageId)
- [ ] **NET-04**: Axios 401-Handler prueft Netzwerkstatus bevor Token geloescht wird (kein Offline-Logout)

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
| STR-01 | TBD | Pending |
| STR-02 | TBD | Pending |
| STR-03 | TBD | Pending |
| STR-04 | TBD | Pending |
| NET-01 | TBD | Pending |
| NET-02 | TBD | Pending |
| NET-03 | TBD | Pending |
| NET-04 | TBD | Pending |
| CAC-01 | TBD | Pending |
| CAC-02 | TBD | Pending |
| CAC-03 | TBD | Pending |
| CAC-04 | TBD | Pending |
| CAC-05 | TBD | Pending |
| CAC-06 | TBD | Pending |
| CAC-07 | TBD | Pending |
| CAC-08 | TBD | Pending |
| CAC-09 | TBD | Pending |
| CAC-10 | TBD | Pending |
| CAC-11 | TBD | Pending |
| RET-01 | TBD | Pending |
| RET-02 | TBD | Pending |
| RET-03 | TBD | Pending |
| OUI-01 | TBD | Pending |
| OUI-02 | TBD | Pending |
| OUI-03 | TBD | Pending |
| OUI-04 | TBD | Pending |
| OUI-05 | TBD | Pending |
| OUI-06 | TBD | Pending |
| OUI-07 | TBD | Pending |
| OUI-08 | TBD | Pending |
| OUI-09 | TBD | Pending |
| OUI-10 | TBD | Pending |
| OUI-11 | TBD | Pending |
| OUI-12 | TBD | Pending |
| OUI-13 | TBD | Pending |
| QUE-K01 | TBD | Pending |
| QUE-K02 | TBD | Pending |
| QUE-K03 | TBD | Pending |
| QUE-K04 | TBD | Pending |
| QUE-K05 | TBD | Pending |
| QUE-FF01 | TBD | Pending |
| QUE-FF02 | TBD | Pending |
| QUE-FF03 | TBD | Pending |
| QUE-FF04 | TBD | Pending |
| QUE-FF05 | TBD | Pending |
| QUE-FF06 | TBD | Pending |
| QUE-FF07 | TBD | Pending |
| QUE-FF08 | TBD | Pending |
| QUE-A01 | TBD | Pending |
| QUE-A02 | TBD | Pending |
| QUE-A03 | TBD | Pending |
| QUE-A04 | TBD | Pending |
| QUE-A05 | TBD | Pending |
| QUE-A06 | TBD | Pending |
| QUE-A07 | TBD | Pending |
| QUE-A08 | TBD | Pending |
| QUE-A09 | TBD | Pending |
| QUE-A10 | TBD | Pending |
| QUE-A11 | TBD | Pending |
| QUE-A12 | TBD | Pending |
| QUE-A13 | TBD | Pending |
| QUE-A14 | TBD | Pending |
| QUE-A15 | TBD | Pending |
| QUE-A16 | TBD | Pending |
| QUE-A17 | TBD | Pending |
| QUE-A18 | TBD | Pending |
| QUE-A19 | TBD | Pending |
| QUE-A20 | TBD | Pending |
| QUE-A21 | TBD | Pending |
| QUE-T01 | TBD | Pending |
| QUE-T02 | TBD | Pending |
| QUE-I01 | TBD | Pending |
| QUE-I02 | TBD | Pending |
| QUE-I03 | TBD | Pending |
| QUE-I04 | TBD | Pending |
| QUE-I05 | TBD | Pending |
| OOA-01 | TBD | Pending |
| OOA-02 | TBD | Pending |
| OOA-03 | TBD | Pending |
| OOA-04 | TBD | Pending |
| OOA-05 | TBD | Pending |
| OOA-06 | TBD | Pending |
| OOA-07 | TBD | Pending |
| OOA-08 | TBD | Pending |
| OOA-09 | TBD | Pending |
| OOA-10 | TBD | Pending |
| OOA-11 | TBD | Pending |
| OOA-12 | TBD | Pending |
| OOA-13 | TBD | Pending |
| OOA-14 | TBD | Pending |
| OOA-15 | TBD | Pending |
| OOA-16 | TBD | Pending |
| OOA-17 | TBD | Pending |
| OOA-18 | TBD | Pending |
| OOA-19 | TBD | Pending |
| OOA-20 | TBD | Pending |
| OOA-21 | TBD | Pending |
| OOA-22 | TBD | Pending |
| OOA-23 | TBD | Pending |
| OOA-24 | TBD | Pending |
| OOA-25 | TBD | Pending |
| OOA-26 | TBD | Pending |
| OOA-27 | TBD | Pending |
| OOA-28 | TBD | Pending |
| OOA-29 | TBD | Pending |
| OOA-30 | TBD | Pending |
| OOA-31 | TBD | Pending |
| OOA-32 | TBD | Pending |
| OOA-33 | TBD | Pending |
| OOA-34 | TBD | Pending |
| OOA-35 | TBD | Pending |
| OOA-36 | TBD | Pending |
| OOA-37 | TBD | Pending |
| OOA-38 | TBD | Pending |
| OOA-39 | TBD | Pending |
| OOA-40 | TBD | Pending |
| OOA-41 | TBD | Pending |
| OOA-42 | TBD | Pending |
| SYN-01 | TBD | Pending |
| SYN-02 | TBD | Pending |
| SYN-03 | TBD | Pending |
| SYN-04 | TBD | Pending |

**Coverage v2.1:**
- v2.1 requirements: 99 total
- Mapped to phases: 0
- Unmapped: 99

---
*Requirements defined: 2026-03-19*
*Updated: 2026-03-20 — Queue-Scope erweitert, vollstaendige Aktions-Klassifizierung (Queue vs Online-Only)*
