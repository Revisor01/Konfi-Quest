# Project Research Summary

**Project:** Konfi Quest v1.6 Dashboard-Konfig + Punkte-Logik
**Domain:** Konfigurierbare Punkte-Typen pro Jahrgang + Dashboard-Widget-Steuerung
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

Konfi Quest v1.6 erweitert das bestehende Gamification-System um zwei orthogonale Features: (1) Punkte-Typen (Gottesdienst/Gemeinde) pro Jahrgang aktivierbar/deaktivierbar machen und (2) Dashboard-Widgets fuer Konfis per Org-Admin konfigurierbar machen. Beide Features bauen vollstaendig auf dem bestehenden Stack auf -- keine neuen Dependencies, keine Architektur-Umstellung. Das System bleibt bei 2 festen Punkte-Typen (kein generisches N-Typen-System), erlaubt aber 0, 1 oder 2 aktive Typen pro Jahrgang. Dashboard-Widgets werden ueber einfache Toggle-Schalter gesteuert, nicht ueber Drag-and-Drop oder Custom-Builder.

Der empfohlene Ansatz nutzt zwei verschiedene Speicherstrategien: Punkte-Typ-Konfiguration als Boolean-Spalten direkt auf der `jahrgaenge`-Tabelle (weil jahrgangs-spezifisch), Dashboard-Widget-Konfiguration als Key-Value-Paare in der bestehenden `settings`-Tabelle (weil org-weit). Beide Strategien verwenden existierende Patterns -- UPSERT fuer Settings, ALTER TABLE mit DEFAULT TRUE fuer Jahrgaenge. Die Aenderungen betreffen 8 Backend-Routes und 6 Frontend-Komponenten, aber keine davon strukturell -- es sind Guards, Conditionals und Props-Erweiterungen.

Die Hauptrisiken sind: (1) ActivityRings zeigt Phantom-Ringe fuer deaktivierte Typen wegen Fallback-Logik `goal > 0 ? goal : 10`. (2) Badge-Kriterien (`gottesdienst_points`, `both_categories`) werden unerreichbar aber bleiben sichtbar -- frustriert Konfis. (3) Ranking wird bei Typ-Aenderung mitten im Jahr unfair, weil alte Punkte mitzaehlen. Alle drei sind loesbar, aber die Ranking-Entscheidung (alte Punkte behalten vs. nur aktive Typen zaehlen) muss VOR der Implementierung getroffen werden.

## Key Findings

### Recommended Stack

Keine neuen Dependencies. Alle Features lassen sich mit PostgreSQL (Boolean-Spalten + KV-Store), Express + express-validator (Route-Erweiterungen), React 19 + Ionic 8 (Conditional Rendering) und dem bestehenden AppContext umsetzen. Alle Versionen sind aktuell.

**Core technologies (unveraendert):**
- **PostgreSQL (pg ^8.16.3):** `jahrgaenge`-Tabelle um 2 Boolean-Spalten erweitern, `settings`-Tabelle fuer 5 neue Dashboard-Keys
- **Express + express-validator:** Bestehende UPSERT- und Validierungs-Patterns erweitern, kein neues Pattern
- **React 19 + Ionic 8:** Conditional Rendering fuer Dashboard-Sektionen, IonToggle fuer Admin-UI

**Explizit abgelehnt:** react-grid-layout (Over-Engineering), zustand/redux (AppContext reicht), Feature-Flag-Services (5 Toggles rechtfertigen kein LaunchDarkly), JSONB-Spalten (2 Booleans sind klarer als JSON), react-hook-form (IonToggle + useState reicht).

### Expected Features

**Must have (Table Stakes) -- 11 Features:**
- Punkte-Typ Toggle pro Jahrgang (gottesdienst_enabled, gemeinde_enabled)
- ActivityRings dynamisch: 1-3 Ringe basierend auf aktiven Typen
- Gesamt-Ring nur bei 2 aktiven Typen anzeigen (sonst redundant)
- Legende und Progress-Bars dynamisch filtern
- Badge-Check skip bei deaktiviertem Typ-Kriterium
- Badge-Warnung beim Deaktivieren ("X Badges verwenden diesen Typ")
- Dashboard-Endpoint liefert Jahrgang-Config mit
- Dashboard-Widget-Toggles in Admin-Settings (5 Sektionen: Konfirmation, Losung, Badges, Ranking, Events)
- DashboardView Conditional Rendering basierend auf Widget-Config
- KonfiDetailView + KonfisView Ringe/Bars anpassen
- Backend Punkte-Vergabe blockieren wenn Typ deaktiviert

**Should have (Differentiators):**
- Migration-Hinweis: "X Konfis haben bereits Y Punkte in diesem Typ"
- Info-Text im Konfi-Dashboard: "Deine Gemeinde trackt nur Gottesdienst-Punkte"

**Defer (v2+):**
- Admin-Goals pro Jahrgang (statt org-weit) -- erst bei konkretem Bedarf
- Dashboard-Widget-Reihenfolge (Drag-and-Drop)
- Widget-Preview fuer Admins
- Punkte-Typ umbenennen (massives Refactoring, >1000 Zeilen)
- Dynamische N Punkte-Typen

### Architecture Approach

Zwei unabhaengige Feature-Streams die sich ein Frontend (DashboardView) teilen aber verschiedene Datenquellen nutzen. Punkte-Typ-Konfiguration fliesst von `jahrgaenge`-Tabelle ueber den Dashboard-Endpoint ins Frontend und beeinflusst ActivityRings, Ranking, Badge-Checks und Punkte-Vergabe. Dashboard-Widget-Konfiguration fliesst von der `settings`-Tabelle ueber den Settings-Endpoint ins Frontend und steuert Conditional Rendering der 5 abschaltbaren Dashboard-Sektionen. Header + ActivityRings bleiben immer sichtbar.

**Betroffene Komponenten:**
1. **jahrgaenge-Tabelle + jahrgaenge.js** -- Neue Boolean-Spalten, CRUD erweitern
2. **settings-Tabelle + settings.js** -- 5 neue dashboard_show_* Keys, UPSERT-Pattern
3. **konfi.js /dashboard** -- point_config im Response, dynamisches Ranking
4. **activities.js + konfi-managment.js + events.js** -- Punkte-Vergabe-Guard vor getPointField
5. **badges.js** -- Badge-Checks respektieren deaktivierte Typen (hoechstes Risiko)
6. **levels.js** -- Level-Berechnung nur mit aktiven Typen
7. **ActivityRings.tsx** -- Dynamische Ring-Anzahl, neue Props enableGottesdienst/enableGemeinde
8. **DashboardView.tsx** -- Conditional Rendering aller Sektionen + point_config
9. **DashboardConfigModal.tsx (NEU)** -- Toggle-UI fuer Dashboard-Widgets

### Critical Pitfalls

1. **Phantom-Ringe in ActivityRings** -- Fallback `goal > 0 ? goal : 10` zeigt Ring mit falschem Ziel fuer deaktivierte Typen. Loesung: Explizite Props `enableGottesdienst`/`enableGemeinde`, Ring komplett ausblenden statt Goal auf 0.

2. **Unerreichbare Badges bleiben sichtbar** -- `gottesdienst_points`/`both_categories` Badge-Kriterien werden unmoeglich wenn Typ deaktiviert. Konfis sehen 0%-Fortschritt. Loesung: Badge-Sichtbarkeit filtern, Admin bei Deaktivierung warnen, Badges NICHT loeschen (Reaktivierung moeglich).

3. **Unfaires Ranking bei Typ-Aenderung mitten im Jahr** -- Alte Punkte des deaktivierten Typs zaehlen weiter in der Summe. Loesung: Ranking-Query dynamisch bauen, nur aktive Typen summieren. ENTSCHEIDUNG VOR IMPLEMENTIERUNG treffen.

4. **getPointField Error statt klarer Meldung** -- Punkte-Vergabe an deaktivierten Typ gibt 500er statt erklaerenden 400er. Loesung: Typ-Aktivierungspruefung VOR getPointField-Aufruf an allen 8 betroffenen Stellen.

5. **Dashboard-Config ohne Defaults** -- Bestehende Orgs haben keine Widget-Config in DB. Loesung: Frontend-Default = alles sichtbar (fehlender Key = true), kein Migrations-Script noetig wenn Code defensiv ist.

## Implications for Roadmap

### Phase 1: DB-Schema + Backend-Foundation
**Rationale:** Alle weiteren Phasen haengen vom Datenmodell ab. Schema-Aenderungen muessen zuerst stehen. Die Ranking-Entscheidung muss hier fallen.
**Delivers:** jahrgaenge-Tabelle mit enable_gottesdienst/enable_gemeinde, jahrgaenge.js CRUD erweitert, settings.js um dashboard_show_* Keys erweitert, konfi.js /dashboard liefert point_config
**Addresses:** Jahrgang-Config Backend, Dashboard-Config Backend, Settings-Endpoints
**Avoids:** Pitfall 7 (falsche Speicherstelle), Pitfall 5 (fehlende Defaults)

### Phase 2: Punkte-Logik Backend
**Rationale:** Backend-Guards muessen vor Frontend-Anpassungen stehen, sonst koennten Admins Punkte an deaktivierte Typen vergeben.
**Delivers:** Punkte-Vergabe-Guards in activities.js, konfi-managment.js, events.js. Badge-Checks respektieren deaktivierte Typen. Ranking dynamisch. Level-Berechnung angepasst.
**Addresses:** Punkte-Vergabe-Blockierung, Badge-Skip, Ranking-Fairness, Level-Konsistenz
**Avoids:** Pitfall 4 (getPointField Error), Pitfall 3 (unfaires Ranking), Pitfall 2 (unerreichbare Badges)

### Phase 3: Frontend Punkte-Anzeige
**Rationale:** Backend liefert jetzt korrekte Daten und Config -- Frontend muss sie darstellen. ActivityRings ist die komplexeste Aenderung.
**Delivers:** ActivityRings dynamisch (1-3 Ringe), DashboardView nutzt point_config, KonfisView Progress-Bars angepasst, KonfiDetailView Ringe angepasst, AdminGoalsPage Hinweise, Jahrgang-Edit-Modal mit Toggles + Badge-Warnung
**Addresses:** Alle UI-seitigen Table-Stakes-Features
**Avoids:** Pitfall 1 (Phantom-Ringe), Pitfall 6 (Fortschrittsbalken-Logik)

### Phase 4: Dashboard-Widget-Konfiguration
**Rationale:** Unabhaengig von Punkte-Logik, kann parallel zu Phase 2+3 entwickelt werden. Eigenstaendiges Feature.
**Delivers:** DashboardConfigModal.tsx (neues Modal mit IonToggle-Liste), AdminSettingsPage Link zum Modal, DashboardView Conditional Rendering aller 5 Sektionen, KonfiDashboardPage reicht dashboardConfig durch
**Addresses:** Dashboard-Widget-Toggles, Conditional Rendering
**Avoids:** Pitfall 8 (Over-Engineering), Pitfall 9 (zu viele KV-Paare)

### Phase 5: End-to-End-Test + Edge Cases
**Rationale:** Integration aller Aenderungen, Edge-Case-Handling, Verifikation auf echtem Geraet.
**Delivers:** End-to-End-Verifikation aller Szenarien (1 Typ aktiv, 0 Typen theoretisch, Typ mitten im Jahr deaktivieren, Widgets an/aus), Profil-Seite bereinigt, Push-Notification-Texte konsistent
**Addresses:** Profil-Anzeige, Push-Texte, Edge Cases
**Avoids:** Pitfall 10 (vergessene Admin-Views), Pitfall 12 (Push-Texte), Pitfall 13 (Profil)

### Phase Ordering Rationale

- **DB-Schema zuerst:** Beide Features brauchen Schema-Aenderungen als Grundlage. ALTER TABLE jahrgaenge und neue Settings-Keys muessen vor Code-Aenderungen stehen.
- **Backend vor Frontend:** Punkte-Guards muessen existieren bevor die UI sie beruecksichtigt. Sonst inkonsistenter Zustand moeglich.
- **Punkte-Logik vor Dashboard-Widgets:** Punkte-Logik ist komplexer (8 Backend-Routes, Badge-Integration, Ranking) und hat mehr Abhaengigkeiten. Dashboard-Widgets sind isolierter.
- **Phase 4 kann parallel zu Phase 2+3 laufen:** Dashboard-Widget-Config hat keine Abhaengigkeit zur Punkte-Typ-Logik. Nur DashboardView.tsx wird von beiden Phasen beruehrt.
- **End-to-End ganz am Ende:** Alle Features muessen implementiert sein bevor Integrationstests sinnvoll sind.

### Research Flags

Phasen die tiefere Research waehrend der Planung brauchen:
- **Phase 2 (Punkte-Logik Backend):** Ranking-Entscheidung (alte Punkte behalten vs. nur aktive zaehlen) hat massive UX-Implikationen und muss mit dem Nutzer geklaert werden. Badge-Logic mit `both_categories` bei einem aktiven Typ braucht klare Semantik-Definition.
- **Phase 3 (ActivityRings):** Ring-Radien-Berechnung bei dynamischer Anzahl ist visuelles Feintuning. Muss auf dem Geraet getestet werden.

Phasen mit Standard-Patterns (keine Research noetig):
- **Phase 1 (DB-Schema):** ALTER TABLE, UPSERT-Pattern -- triviale SQL-Operationen
- **Phase 4 (Dashboard-Widgets):** Conditional Rendering, IonToggle, Settings KV-Store -- alles etablierte Patterns in der Codebase
- **Phase 5 (End-to-End):** Test-Checkliste abarbeiten, keine neue Architektur

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Null neue Dependencies. Alle Empfehlungen basieren auf direkter Codebase-Analyse mit konkreten Zeilennummern |
| Features | HIGH | Vollstaendige Bestandsaufnahme aller betroffenen Code-Stellen. Abhaengigkeitsgraph dokumentiert. Anti-Features klar begruendet |
| Architecture | HIGH | Alle 15 Backend-Routes analysiert, alle relevanten Frontend-Komponenten mit Zeilennummern referenziert. Datenfluss-Diagramme vorhanden |
| Pitfalls | HIGH | 13 Pitfalls identifiziert (5 kritisch, 5 moderat, 3 geringfuegig). Abhaengigkeits-Reihenfolge der Mitigationen dokumentiert |

**Overall confidence:** HIGH

### Gaps to Address

- **Ranking-Entscheidung:** Wie werden alte Punkte eines deaktivierten Typs im Ranking behandelt? Option A (nur aktive Typen zaehlen) ist empfohlen, muss aber mit dem Nutzer abgestimmt werden. Diese Entscheidung beeinflusst Level-Berechnung, Fortschrittsbalken und Total-Points-Anzeige.
- **both_categories Badge-Semantik:** Wenn nur ein Typ aktiv ist -- reicht der eine aktive Typ fuer `both_categories`? Oder wird das Badge uebersprungen? Architecture empfiehlt: nur aktive Typen muessen das Kriterium erfuellen.
- **AdminGoalsPage bei gemischten Jahrgaengen:** Goals sind org-weit, Punkte-Typen sind jahrgangs-spezifisch. Was passiert wenn Jahrgang A beide Typen hat und Jahrgang B nur einen? Goals-Seite muss das kommunizieren.
- **Dashboard-Widget-Config als einzelne Keys vs. JSON:** PITFALLS.md empfiehlt ein JSON-Objekt, STACK.md und ARCHITECTURE.md empfehlen einzelne Keys. Empfehlung: Einzelne Keys sind konsistenter mit dem bestehenden Settings-Pattern (target_gottesdienst etc. sind auch einzelne Keys).

## Sources

### Primary (HIGH confidence -- direkte Codebase-Analyse)
- ActivityRings.tsx (350 Zeilen, 3 hardcoded Ringe, Fallback-Logik Z.36-38)
- DashboardView.tsx (~1450 Zeilen, 6 Sektionen, Conditional-Rendering-Pattern vorhanden)
- badges.js (504 Zeilen, 13 CRITERIA_TYPES, 4 punkte-basiert)
- settings.js (159 Zeilen, UPSERT-Pattern Z.99-148)
- jahrgaenge.js (193 Zeilen, CRUD, aktuell nur name + confirmation_date)
- konfi.js (~900 Zeilen, Dashboard-Route Z.32-272, Ranking Z.97-107)
- activities.js (~500 Zeilen, getPointField Usage Z.246, 320, 455)
- konfi-managment.js (~700 Zeilen, getPointField Usage Z.476, 555, 609, 666)
- levels.js (299 Zeilen, total_points Berechnung Z.226, 243)
- validation.js (65 Zeilen, getPointField Whitelist Z.24-35)
- AdminGoalsPage.tsx (80 Zeilen, 2 Stepper)
- KonfisView.tsx (3 Progress-Bars Z.292-334)
- KonfiDetailView.tsx (ActivityRings Z.499-500)
- KonfiDashboardPage.tsx (305 Zeilen, Settings-Loading)

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
