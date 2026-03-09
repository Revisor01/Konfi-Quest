# Project Research Summary

**Project:** Konfi Quest v1.7 -- Unterricht + Pflicht-Events
**Domain:** Pflicht-Event-Management mit Anwesenheits-Tracking fuer Konfirmanden-App
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Konfi Quest v1.7 erweitert das bestehende Event-System um Pflicht-Events mit Auto-Enrollment, QR-Code-basiertem Check-in und Anwesenheitsstatistik. Die Codebase ist ausgereift (15 vollstaendig migrierte Routes, funktionierendes Event-Booking-System mit Attendance-Tracking, Push-Infrastruktur mit 18 Types) und bietet solide Grundlagen: `event_bookings` mit `attendance_status`, `event_jahrgang_assignments` fuer Jahrgangs-Zuweisung, QR-Generierung via `qrcode`-Library und Socket.io-basierte Live-Updates. Die einzige neue externe Dependency ist `@capacitor/barcode-scanner` fuer den nativen QR-Scan auf Konfi-Geraeten.

Der empfohlene Ansatz: Events-Tabelle um ein `mandatory`-Boolean und ein `bring_items`-Textfeld erweitern, Auto-Enrollment via Batch-INSERT mit `ON CONFLICT DO NOTHING`, Opt-out als separate `event_optouts`-Tabelle (analog zum bestehenden `event_unregistrations`-Pattern), QR-Check-in via signierte JWTs (stateless, kein Token-Management), und Anwesenheitsstatistik als reine SQL-Aggregation. Pflicht-Events vergeben keine Punkte (Guard im bestehenden Attendance-Endpunkt) und ueberspringen die Kapazitaets-/Waitlist-Logik.

Die Hauptrisiken liegen in der Integration mit bestehendem Code: Der CHECK-Constraint auf `event_bookings.status` muss vor jeder anderen Arbeit synchronisiert werden (blockiert sonst alle Inserts bei frischen Setups). Der bestehende Abmelde-Flow LOESCHT Bookings statt den Status zu aendern -- bei Pflicht-Events fatal, weil die Anwesenheits-Tracking-Grundlage verloren geht. Multi-Tenant-Isolation muss bei jeder Auto-Enrollment-Query explizit geprueft werden (Jahrgangs-IDs sind global, nicht org-spezifisch). Alle diese Risiken sind durch saubere Architektur-Entscheidungen vor der Implementierung vermeidbar.

## Key Findings

### Recommended Stack

Keine signifikanten Stack-Aenderungen. Eine neue Frontend-Dependency, null Backend-Dependencies. Details in [STACK.md](STACK.md).

**Neue Technologie:**
- `@capacitor/barcode-scanner@latest-7`: Nativer QR-Scanner fuer Konfi-Geraete -- offizielles Capacitor-Plugin, Capacitor 7 Support, Web-Fallback

**Bestehender Stack (erweitert genutzt):**
- `qrcode` (v1.5.4): QR-Generierung fuer Check-in-Tokens -- Pattern aus AdminInvitePage wiederverwendbar
- PostgreSQL + `pg` (v8.16.3): Neue Spalten auf events/event_bookings, neue event_optouts-Tabelle
- Socket.io (v4.7/4.8): Live-Updates bei Check-in -- bestehendes `liveUpdate.sendToOrgAdmins()` Pattern
- firebase-admin (v12.7): 2 neue Push-Types (pflicht_event_reminder, checkin_confirmed)
- JWT (jsonwebtoken): QR-Check-in-Tokens als signierte JWTs -- stateless Validierung

**Explizit NICHT hinzufuegen:** ML Kit (Overkill), Redis (nicht noetig), date-fns/dayjs (natives Date reicht), html5-qrcode (Capacitor-Plugin besser).

### Expected Features

Details in [FEATURES.md](FEATURES.md).

**Must have (Table Stakes):**
- Pflicht-Flag (`mandatory`) auf Events mit Auto-Enrollment aller Jahrgangs-Konfis
- Opt-out mit Pflicht-Begruendung (Status-Aenderung, nicht Booking-Loeschung)
- Keine Punkte fuer Pflicht-Events (nur Anwesenheits-Tracking)
- QR-Code Check-in (Admin zeigt QR, Konfi scannt)
- Manuelle Admin-Korrektur der Anwesenheit (bestehende Route reicht)
- "Was mitbringen" Textfeld auf Events
- Dashboard-Widget "Naechstes Event"
- Pro-Konfi Anwesenheitsstatistik (Admin-Sicht)

**Should have (Differentiators):**
- Zeitfenster fuer QR-Check-in (30 Min vor/nach Event-Start)
- Push bei Opt-out an Admin
- Opt-out-Frist (bestehende 2-Tage-Logik wiederverwendbar)
- QR-Code als druckbares PDF

**Defer (v1.8+):**
- Bulk-Attendance (mehrere Konfis gleichzeitig markieren)
- Anwesenheits-Badges (`mandatory_attendance_rate` Kriterium)
- Jahrgangs-Anwesenheits-Uebersicht (Tabelle aller Konfis)

**Anti-Features (NICHT bauen):**
- GPS/Geofencing Check-in, NFC Check-in, Self-Button-Check-in (ohne QR)
- Automatische Absent-Markierung, Eltern-Benachrichtigung
- Punkte-Option fuer Pflicht-Events, Recurring Events
- Konfi sieht eigene Anwesenheitsstatistik (erzeugt Druck statt Motivation)

### Architecture Approach

Die Architektur erweitert das bestehende Event-System um vier Saeulen: mandatory-Flag mit Auto-Enrollment, Opt-out via separate Tabelle, JWT-basierte QR-Codes (stateless), und Aggregations-basierte Statistik. Keine neuen Infrastruktur-Komponenten noetig. Details in [ARCHITECTURE.md](ARCHITECTURE.md).

**Hauptkomponenten:**
1. `events.js` (Backend) -- Pflicht-Event CRUD, Auto-Enrollment-Logik, QR-Token-Generierung, Check-in-Endpunkt
2. `konfi.js` (Backend) -- Konfi-Event-Ansicht mit Pflicht-Status, Opt-out-Route, Dashboard-Erweiterung
3. `konfi-managment.js` (Backend) -- Anwesenheitsstatistik-Route pro Konfi
4. `EventModal.tsx` (Admin) -- Mandatory-Toggle, Feld-Ausblendung bei mandatory
5. `EventDetailView.tsx` (Admin/Konfi) -- QR-Anzeige/Scanner, Opt-out-UI, Bring-Items
6. `DashboardView.tsx` (Konfi) -- "Naechstes Event"-Widget

**Schluessel-Patterns:**
- Batch-INSERT mit ON CONFLICT fuer Auto-Enrollment (1 Query statt N)
- JWT-signierte QR-Tokens (kein DB-State, selbst-verifizierend)
- Bestehende Attendance-Route fuer Admin-Korrektur (points=0 Guard greift automatisch)
- `event_optouts`-Tabelle nach Vorbild von `event_unregistrations`
- Dashboard-Widget ueber bestehende Settings-KV-Steuerung

### Critical Pitfalls

Top 6 aus [PITFALLS.md](PITFALLS.md), nach Schwere geordnet:

1. **CHECK-Constraint blockiert neue Booking-Stati** -- Schema-Datei ist nicht synchron mit Live-DB. ZUERST `01-create-schema.sql` aktualisieren, dann Migration mit aktualisierten Constraints ausfuehren. Betrifft die allererste Aktion.
2. **Opt-out loescht Booking statt Status zu aendern** -- Bestehender Abmelde-Flow (`DELETE FROM event_bookings`) zerstoert das Anwesenheits-Tracking. Neuen Opt-out-Endpunkt als Status-Aenderung implementieren, bestehenden DELETE-Flow NICHT wiederverwenden.
3. **Multi-Tenant-Isolation bei Auto-Enrollment** -- `organization_id` in jeder Enrollment-Query pflichtmaessig filtern. Jahrgangs-IDs sind global (SERIAL), nicht org-spezifisch. DSGVO-relevant bei Verletzung.
4. **Punkte-Vergabe bei Pflicht-Events** -- Bestehender Attendance-Endpunkt vergibt automatisch Punkte. Guard noetig: `if (event.mandatory) skip points/badges/level-check`. Alternativ: points=0 erzwingen bei mandatory=true.
5. **Neue Konfis nach Event-Erstellung nicht nachgetragen** -- Auto-Enrollment ist einmalig bei Event-Erstellung. Trigger bei Jahrgang-Zuweisung (auth.js, konfi-managment.js) noetig um Nachzuegler zu enrollen.
6. **QR-Code-Kollision mit bestehendem Invite-QR** -- Typ-Prefix im QR-Inhalt verwenden (`konfiquest://checkin/...` vs. `konfiquest://invite/...`), um Verwechslung zu verhindern.

## Implications for Roadmap

### Phase 1: Datenmodell + Pflicht-Event-Erstellung + Auto-Enrollment
**Rationale:** Alles andere baut auf dem mandatory-Flag und der Auto-Enrollment-Logik auf. Ohne diese Basis kein Opt-out, kein Check-in, keine Statistik. Schema-Synchronisation (Pitfall 1) muss der allererste Schritt sein.
**Delivers:** Admin kann Pflicht-Events erstellen, Konfis werden automatisch enrolled, bring_items-Feld verfuegbar
**Addresses:** Pflicht-Flag, Auto-Enrollment, "Was mitbringen", keine Punkte bei Pflicht-Events
**Avoids:** Pitfall 1 (CHECK-Constraint), Pitfall 2 (UNIQUE-Violations), Pitfall 5 (Punkte-Vergabe), Pitfall 6 (Multi-Tenant), Pitfall 12 (Kapazitaetspruefung)
**Umfang:** DB-Migration, POST/PUT/GET events erweitern, EventModal.tsx anpassen, Auto-Enrollment-Logik, Punkte-Guard

### Phase 2: Opt-out-Flow + Konfi-UI fuer Pflicht-Events
**Rationale:** Haengt von Phase 1 ab (Events + Bookings muessen existieren). Konfis muessen sich vor dem Event-Tag abmelden koennen. Frontend muss Pflicht- und freiwillige Events klar unterscheiden.
**Delivers:** Konfis koennen sich mit Begruendung abmelden, Admin sieht Opt-out-Gruende, Pflicht-Badge in Event-Liste
**Addresses:** Opt-out mit Begruendung, Konfi-Event-UI, Admin-Opt-out-Uebersicht
**Avoids:** Pitfall 3 (Booking-Loeschung), Pitfall 7 (UI-Verwirrung), Pitfall 8 (falsche Statistik-Zaehlung)
**Umfang:** event_optouts-Tabelle, POST /konfi/events/:id/optout, OptOutModal.tsx, EventsView.tsx Pflicht-Badge, EventDetailView.tsx Opt-out-Button

### Phase 3: QR-Code Check-in
**Rationale:** Unabhaengig von Opt-out (Phase 2), aber abhaengig von Phase 1 (Bookings muessen existieren). Kann theoretisch parallel zu Phase 2 gebaut werden. Einzige neue externe Dependency (`@capacitor/barcode-scanner`).
**Delivers:** Admin zeigt QR-Code, Konfi scannt und wird als anwesend markiert, Live-Update an Admin
**Addresses:** QR-Generierung, QR-Scan, Check-in-Validierung, Zeitfenster
**Avoids:** Pitfall 4 (Offline-Fallback -- manueller Fallback bleibt), Pitfall 9 (QR-Kollision -- Typ-Prefix)
**Umfang:** Capacitor Plugin installieren, GET /events/:id/qr-token, POST /events/:id/checkin, QrDisplayModal.tsx, QrScannerModal.tsx

### Phase 4: Dashboard-Widget + Anwesenheitsstatistik
**Rationale:** Braucht Attendance-Daten aus Phase 1-3. Darstellungslogik als letztes, weil sie von den Daten abhaengt die die vorherigen Phasen produzieren.
**Delivers:** "Naechstes Event"-Widget im Dashboard, pro-Konfi Anwesenheitsstatistik fuer Admin
**Addresses:** Dashboard-Widget, Anwesenheitsstatistik, DashboardConfig-Erweiterung, Push-Erinnerungen
**Avoids:** Pitfall 14 (fehlender Zeitraum-Filter -- Default auf Konfirmationsjahr)
**Umfang:** Dashboard-Endpoint erweitern, DashboardView.tsx Widget, settings.js Toggle, GET /konfi-management/:id/attendance, AttendanceStatsView.tsx

### Phase Ordering Rationale

- **Abhaengigkeitskette:** Datenmodell -> Enrollment -> Opt-out -> Check-in -> Statistik. Jede Phase baut auf der vorherigen auf.
- **Risiko-First:** Die kritischsten Pitfalls (CHECK-Constraint, Booking-Loeschung, Multi-Tenant) werden in Phase 1-2 adressiert, bevor das System komplexer wird.
- **Einzelne externe Dependency:** `@capacitor/barcode-scanner` wird erst in Phase 3 benoetigt -- fruehe Phasen brauchen keine Installation/Konfiguration.
- **Inkrementelle Lieferbarkeit:** Nach Phase 1 ist das System bereits nutzbar (Admin erstellt Pflicht-Events, Konfis sind enrolled). Nach Phase 2 koennen Konfis sich abmelden. Phase 3 beschleunigt den Check-in. Phase 4 liefert Reporting.

### Research Flags

Phasen die tiefere Recherche waehrend der Planung benoetigen:
- **Phase 3 (QR-Check-in):** Architektur-Entscheidung "Wer scannt wen?" (Admin scannt Konfi-QR vs. Konfi scannt Event-QR) hat signifikante UX- und Sicherheits-Implikationen. Die Research-Dateien empfehlen unterschiedliche Ansaetze (STACK.md: Konfi scannt Event-QR; PITFALLS.md: Admin scannt Konfi-QR als sicherere Option). Diese Entscheidung muss vor der Implementierung fallen.

Phasen mit etablierten Patterns (keine Phase-Research noetig):
- **Phase 1:** Batch-INSERT mit ON CONFLICT, Boolean-Spalten auf bestehender Tabelle -- Standard-PostgreSQL-Patterns.
- **Phase 2:** Opt-out-Tabelle folgt exakt dem bestehenden `event_unregistrations`-Pattern. useIonModal fuer OptOutModal.
- **Phase 4:** Dashboard-Widget folgt dem bestehenden 5-Widget-Pattern aus v1.6. Settings-KV identisch.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Einzige neue Dependency ist offizielles Capacitor-Plugin. Alle anderen Empfehlungen basieren auf direkter Codebase-Analyse bestehender Patterns. |
| Features | HIGH | Feature-Landscape vollstaendig aus bestehendem Event-System abgeleitet. UX-Patterns aus Church/School-Management-Tools verifiziert. |
| Architecture | HIGH | Alle Komponenten, Routen und Queries mit Zeilennummern referenziert. Datenfluss-Aenderungen an bestehenden Code-Stellen verifiziert. |
| Pitfalls | HIGH | Pitfalls aus direkter Code-Analyse identifiziert (CHECK-Constraints, DELETE-Flow, Kapazitaetspruefung). Keine spekulativen Risiken. |

**Overall confidence:** HIGH

### Gaps to Address

- **QR-Scan-Richtung:** STACK.md empfiehlt "Konfi scannt Event-QR", PITFALLS.md warnt vor Weitergabe-Risiko und empfiehlt "Admin scannt Konfi-QR". Entscheidung muss in Phase-3-Planung fallen. Empfehlung: Konfi scannt Event-QR (einfacher, skaliert besser fuer 30 Konfis gleichzeitig) mit Zeitfenster-Validierung als Missbrauchsschutz.
- **Nachtrags-Enrollment bei Jahrgangs-Wechsel:** PITFALLS.md identifiziert das Problem (Pitfall 10), aber die konkrete Implementierung (Trigger in auth.js + konfi-managment.js) braucht Code-Analyse waehrend Phase-1-Planung.
- **event_unregistrations-Tabelle:** Existiert im Code aber nicht in `01-create-schema.sql`. Schema-Synchronisation muss das klaeren (Pitfall 1 erweitert).
- **Capacitor Barcode Scanner Version:** `@latest-7` Tag muss bei Installation geprueft werden -- konkrete Versionsnummer zum Build-Zeitpunkt festhalten.

## Sources

### Primary (HIGH confidence -- direkte Codebase-Analyse)
- events.js (1500+ Zeilen, 15 Routen, Attendance Zeile 1289-1432)
- konfi.js (1800+ Zeilen, Events-Query Zeile 1117-1215, Unregistration Zeile 1718-1830)
- 01-create-schema.sql (event_bookings CHECK-Constraint Zeile 387, UNIQUE Zeile 395)
- AdminInvitePage.tsx (QR-Generierung mit qrcode v1.5.4)
- pushService.js (18 bestehende Push-Types)
- DashboardView.tsx (6 konfigurierbare Sektionen, Settings-KV)
- [Capacitor Barcode Scanner Plugin Docs](https://capacitorjs.com/docs/apis/barcode-scanner)

### Secondary (MEDIUM confidence -- UX-Patterns aus Church/School-Tools)
- [Church Check-in Systems (Breeze ChMS)](https://www.breezechms.com/blog/check-in-systems-for-churches)
- [QR Code Attendance Best Practices (Verifyed)](https://www.verifyed.io/blog/qr-code-attendance)
- [Orah Attendance Dashboard](https://success.orah.com/en/articles/9924908-attendance-insights-dashboard-all-widgets)
- [MinHub Youth App](https://apps.apple.com/us/app/minhub-youth/id910303883)

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
