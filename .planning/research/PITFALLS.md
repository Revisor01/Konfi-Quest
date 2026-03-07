# Domain Pitfalls: v1.6 Dashboard-Konfig + Punkte-Logik

**Domain:** Konfigurierbare Punkte-Typen und Dashboard-Widgets in bestehendem Gamification-System
**Researched:** 2026-03-07
**Confidence:** HIGH (basierend auf vollstaendiger Codebase-Analyse aller betroffenen Dateien)

## Kritische Pitfalls

Fehler die zu inkonsistentem Verhalten, falschen Punktestaenden oder Datenintegritaetsproblemen fuehren.

### Pitfall 1: ActivityRings zeigt Phantom-Ringe fuer deaktivierte Punkte-Typen

**Was schiefgeht:** Wenn `targetGottesdienst` oder `targetGemeinde` auf 0 gesetzt wird, berechnet `ActivityRings.tsx` (Zeile 36-38) Fallback-Werte: `effectiveGottesdienstGoal = gottesdienstGoal > 0 ? gottesdienstGoal : 10`. Das zeigt einen Ring mit falschem Ziel 10 an, obwohl der Punkte-Typ deaktiviert ist. Der Gesamt-Ring (`effectiveTotalGoal = effectiveGottesdienstGoal + effectiveGemeindeGoal`) summiert den Fallback und zeigt falsches Ziel 20 statt z.B. 10.

**Warum es passiert:** ActivityRings wurde ausschliesslich fuer den Fall "beide Typen aktiv" gebaut. Der Fallback auf 10 war ein Safety-Net gegen Division-by-Zero, nicht ein Design fuer deaktivierte Typen.

**Konsequenzen:**
- Konfis sehen einen Ring fuer einen Punkte-Typ den sie nicht sammeln koennen
- Gesamt-Ring zeigt falschen Fortschritt
- Legende (Zeile 285-308) zeigt drei Eintraege obwohl nur einer/zwei relevant sind
- Zentrale Anzeige (Zeile 260-276) zeigt Total-Punkte die beide Typen summieren

**Praevention:**
- ActivityRings muss Ring-Anzahl dynamisch anpassen: 3 Ringe (beide aktiv), 2 Ringe (einer aktiv + Gesamt), 1 Ring (nur Gesamt wenn beide gleich)
- Deaktivierter Typ: Ring komplett ausblenden, Legende ausblenden, Gesamt nur aktive Typen summieren
- Ring-Radien (`ringRadii` Array, Zeile 94-98) muessen sich an Anzahl sichtbarer Ringe anpassen -- sonst entsteht eine Luecke
- Props um `enabledTypes` erweitern statt implizit ueber goal=0 zu erkennen

**Erkennungszeichen:** Ring zeigt "0/10" fuer deaktivierten Typ. Gesamt-Ring zeigt doppeltes Ziel.

**Betroffene Phase:** Punkte-Logik-Anpassung (ActivityRings)

---

### Pitfall 2: Badge-Kriterien werden unerreichbar aber bleiben sichtbar

**Was schiefgeht:** `checkAndAwardBadges` in `badges.js` (Zeile 124-136) prueft direkt `konfi.gottesdienst_points` und `konfi.gemeinde_points`. Vier Badge-Kriterientypen sind betroffen:
- `gottesdienst_points`: Unerreichbar wenn Gottesdienst deaktiviert
- `gemeinde_points`: Unerreichbar wenn Gemeinde deaktiviert
- `both_categories`: IMMER unerreichbar wenn ein Typ fehlt (erfordert beide >= Wert)
- `total_points`: Summe aus beiden, also unfair wenn ein Typ fehlt

Alle diese Badges bleiben sichtbar im Badge-Tab und auf dem Dashboard.

**Warum es passiert:** Badge-Kriterien wurden unabhaengig von Punkte-Konfiguration designed. Es gibt keine Verbindung zwischen Jahrgang-Konfiguration und Badge-Erreichbarkeit.

**Konsequenzen:**
- Unerreichbare Badges frustrieren Konfis
- Badge-Fortschrittsanzeige in `konfi.js` (Zeile 832-863) zeigt 0% fuer deaktivierte Typen -- sieht nach Bug aus
- Admin erstellt Badge mit `both_categories` Kriterium obwohl nur ein Typ aktiv ist -- kein Fehler, aber Badge wird nie vergeben
- `CRITERIA_TYPES` Objekt (Zeile 9-84) bietet alle 13 Typen beim Erstellen an, auch irrelevante

**Praevention:**
- Badge-Sichtbarkeit im Frontend filtern: Badges mit unerreichbarem Kriterientyp ausblenden oder als "nicht verfuegbar fuer deinen Jahrgang" markieren
- Admin-Warnung: Beim Deaktivieren eines Punkte-Typs anzeigen welche Badges betroffen sind (Count + Liste)
- Badge-Erstellungs-UI: `CRITERIA_TYPES` kontextabhaengig filtern -- nur erreichbare Typen anbieten
- NICHT automatisch Badges loeschen oder deaktivieren -- Admin soll entscheiden, Typ koennte spaeter wieder aktiviert werden

**Betroffene Phase:** Punkte-Logik-Anpassung (Badge-Integration)

---

### Pitfall 3: Ranking wird unfair bei Punkte-Typ-Aenderung mitten im Jahr

**Was schiefgeht:** Das Ranking in `konfi.js` (Zeile 97-107) berechnet: `(kp.gottesdienst_points + kp.gemeinde_points) as points`. Wenn mitten im Jahr Gottesdienst-Punkte deaktiviert werden:
- Konfi A hatte vorher 5 Gottesdienst + 5 Gemeinde = 10 Punkte
- Konfi B ist neu dazugekommen und hat 8 Gemeinde = 8 Punkte
- Ranking: A vor B, obwohl A seine 5 Gottesdienst-Punkte unter alten Regeln gesammelt hat

**Warum es passiert:** Das SQL ist hardcoded auf beide Spalten. Es gibt keine Logik die prueft welche Punktearten fuer das Ranking zaehlen. Die Level-Berechnung in `levels.js` (Zeile 226: `total_points`) hat dasselbe Problem.

**Konsequenzen:**
- Unfaires Ranking nach Konfigurationsaenderung
- Level-Berechnung (`levels.js` Zeile 243: `total_points`) basiert ebenfalls auf der Summe beider Typen
- Level-Progress (Zeile 274-278) stimmt nicht mit der neuen Realitaet ueberein
- Konfis unter neuen Regeln sind systematisch benachteiligt

**Praevention:**
- ENTSCHEIDUNG TREFFEN VOR IMPLEMENTIERUNG: Was passiert mit bestehenden Punkten?
  - **Option A (empfohlen):** Alte Punkte BEHALTEN, aber nur aktive Typen fuer neues Ranking nutzen (SQL mit JOIN auf Jahrgang-Konfiguration)
  - **Option B:** Alle Punkte immer zaehlen (einfacher, aber potenziell unfair)
  - **Option C:** Punkte des deaktivierten Typs nullen (destruktiv, nicht empfohlen)
- Ranking-Query dynamisch bauen basierend auf Jahrgang-Konfiguration
- Level-Berechnung analog anpassen
- Diese Entscheidung hat massive UX-Implikationen -- mit dem Nutzer klaeren

**Betroffene Phase:** Punkte-Logik-Anpassung (Ranking + Levels) -- frueh klaeren, da Entscheidung alle anderen Anpassungen beeinflusst

---

### Pitfall 4: getPointField wirft Error bei Vergabe-Versuch an deaktivierten Typ

**Was schiefgeht:** `getPointField()` in `validation.js` (Zeile 29-34) ist eine Sicherheits-Whitelist die nur `gottesdienst` und `gemeinde` akzeptiert und bei allem anderen einen Error wirft. Wenn ein Admin eine Aktivitaet vom Typ "Gottesdienst" an einen Konfi vergeben will, dessen Jahrgang Gottesdienst-Punkte deaktiviert hat, gibt es einen 500er-Fehler statt einer klaren Meldung.

**Warum es passiert:** `getPointField` validiert den Typ-NAMEN, nicht ob der Typ fuer den Konfi AKTIV ist. Die Deaktivierung eines Typs muss VOR dem `getPointField`-Call geprueft werden. Betroffene Stellen:
- `activities.js`: Zeile 246, 320, 455
- `konfi-managment.js`: Zeile 476, 555, 609, 666

**Konsequenzen:**
- 500er-Fehler bei Punkte-Vergabe
- Bonus-Punkte-Vergabe bricht ab
- Aktivitaets-Requests werden mit generischem Fehler abgelehnt
- Admin versteht nicht warum die Vergabe fehlschlaegt

**Praevention:**
- Validierung VOR `getPointField`: "Ist dieser Punkte-Typ fuer den Jahrgang dieses Konfis aktiv?"
- Klare Fehlermeldung: "Gottesdienst-Punkte sind fuer diesen Jahrgang deaktiviert"
- `getPointField` selbst NICHT aendern -- die Whitelist ist Sicherheitsinfrastruktur aus v1.0
- Aktivitaeten-Erstellung/-Bearbeitung: Dropdown fuer Punkte-Typ nur aktive Typen anbieten
- Bestehende Aktivitaeten mit deaktiviertem Typ: Weiterhin anzeigen aber Vergabe blockieren

**Betroffene Phase:** Punkte-Logik-Anpassung (Backend-Validierung) -- frueher als UI-Arbeit

---

### Pitfall 5: Dashboard-Widget-Konfiguration ohne Default-Migration

**Was schiefgeht:** Wenn Dashboard-Widgets per Konfiguration gesteuert werden, braucht jede bestehende Organisation einen Default-Eintrag. Ohne Migration sehen bestehende Organisationen entweder ein leeres Dashboard (wenn Default = nichts anzeigen) oder die Konfiguration wirkt nicht (wenn Code auf Existenz der Config prueft und ohne Config den alten Pfad nimmt).

**Warum es passiert:** Neues Feature wird implementiert ohne bestehende Daten zu migrieren. Das `settings`-System (Key-Value in `settings` Tabelle mit `organization_id`) hat keine Default-Garantie.

**Konsequenzen:**
- Bestandskunden sehen nach Docker-Rebuild ploetzlich ein anderes Dashboard
- Oder: Config-Seite zeigt alles an, Admin speichert ohne Aenderung, aber die Defaults waren nicht was der Admin erwartet
- Race Condition: Admin oeffnet Config, sieht Default-State, aendert nichts, speichert -- jetzt sind explizite Defaults in der DB die ggf. nicht mit den Code-Defaults uebereinstimmen

**Praevention:**
- SQL-Migrationsskript (`init-scripts/XXX_dashboard_config.sql`) das fuer JEDE existierende Organisation Default-Widget-Konfiguration einfuegt
- Backend-Fallback: Wenn keine Konfiguration existiert = ALLE Widgets sichtbar (nicht keine)
- Frontend Default-State = alles sichtbar -- defensiver Default
- Settings-Endpoint muss fehlende Keys mit Defaults auffuellen bevor er antwortet

**Betroffene Phase:** Dashboard-Konfiguration (Datenmigration)

## Moderate Pitfalls

### Pitfall 6: Fortschrittsbalken-Logik bei Einzel-Punkte-Typ

**Was schiefgeht:** `DashboardView.tsx` berechnet `totalTarget = targetGottesdienst + targetGemeinde` (Zeile 544). Bei deaktiviertem Gottesdienst (target = 0) zeigt ein Konfi mit 10/10 Gemeinde-Punkten 100% Fortschritt -- das ist technisch korrekt. Aber: `totalCurrentPoints = gottesdienstPoints + gemeindePoints` (Zeile 545) zaehlt weiterhin alte Gottesdienst-Punkte mit, was den Fortschritt ueber 100% treiben kann obwohl der Konfi nur Gemeinde-Punkte hat.

**Praevention:**
- `totalTarget` und `totalCurrentPoints` nur aktive Punkte-Typen beruecksichtigen
- Wenn Gottesdienst deaktiviert: `totalCurrentPoints = gemeindePoints` (nicht `gottesdienstPoints + gemeindePoints`)
- Konsistenz mit Ranking-Entscheidung (Pitfall 3) sicherstellen

**Betroffene Phase:** Punkte-Logik-Anpassung (Dashboard-Fortschritt)

---

### Pitfall 7: Punkte-Typ-Konfiguration an falscher Stelle gespeichert

**Was schiefgeht:** Punkte-Typ-Konfiguration wird in der `settings` Tabelle gespeichert (wie `target_gottesdienst`/`target_gemeinde`). Aber die Anforderung ist "pro Jahrgang konfigurierbar" -- die `settings` Tabelle hat nur `organization_id`, nicht `jahrgang_id`.

**Warum es passiert:** Naheliegende Wiederverwendung der bestehenden Settings-Infrastruktur. Aber Punkte-Typ-Konfiguration ist jahrgangs-spezifisch, nicht organisations-weit.

**Konsequenzen:**
- Alle Jahrgaenge einer Organisation haben dieselbe Konfiguration
- Aeltere Jahrgaenge (z.B. 2024/2025) koennen nicht anders konfiguriert werden als der aktuelle
- Wenn ein Jahrgang archiviert wird (v1.9), geht seine Konfiguration verloren

**Praevention:**
- Punkte-Typ-Konfiguration in `jahrgaenge` Tabelle als Spalten speichern: `gottesdienst_enabled BOOLEAN DEFAULT true`, `gemeinde_enabled BOOLEAN DEFAULT true`
- ODER: Separate Tabelle `jahrgang_config (jahrgang_id, key, value)` -- flexibler aber komplexer
- Die `settings`-Tabelle fuer organisations-weite Dashboard-Widget-Konfiguration nutzen (das ist org-weit, nicht pro Jahrgang)

**Betroffene Phase:** Punkte-Typ-Konfiguration (Datenmodell) -- muss zuerst entschieden werden

---

### Pitfall 8: Dashboard-Widget-Konfiguration wird ueber-engineered

**Was schiefgeht:** Drag-and-Drop Sortierung, Widget-Groessen, benutzerdefinierte Farben, Widget-Positionen -- alles Features die niemand braucht aber Wochen kosten.

**Praevention:**
- Maximal 5-7 Widgets als Toggle-Schalter: Punkte-Bereich (Rings + Level), Losung, Ranking, Badges, Events/Termine, Countdown
- KEINE Drag-and-Drop-Sortierung -- feste Reihenfolge reicht
- KEINE Widget-Groessen oder -Positionen
- KEINE benutzerdefinierte Farben fuer Widgets
- Einfache Toggles in der Settings-Seite, kein eigenes Dashboard-Builder-UI

**Betroffene Phase:** Dashboard-Konfiguration (UI-Design)

---

### Pitfall 9: Settings-Tabelle wird zum Chaos aus Key-Value-Paaren

**Was schiefgeht:** Fuer jedes Widget ein eigener Key: `dashboard_widget_ranking_visible`, `dashboard_widget_losung_visible`, `dashboard_widget_badges_visible` etc. Bei 6 Widgets sind das 6 DB-Rows pro Organisation. Die Settings-API muss alle einzeln laden und zurueckgeben.

**Praevention:**
- Dashboard-Widget-Konfiguration als EIN JSON-Objekt unter einem Key speichern: `dashboard_config = {"ranking": true, "losung": true, "badges": true, ...}`
- Oder: Bitmask in einer Integer-Spalte (noch kompakter, aber weniger lesbar)
- Backend gibt fehlende Keys mit Default `true` zurueck
- Frontend sendet immer das komplette Objekt, nicht einzelne Keys

**Betroffene Phase:** Dashboard-Konfiguration (Datenmodell)

---

### Pitfall 10: KonfiDetailView (Admin) vergisst Punkte-Typ-Konfiguration

**Was schiefgeht:** `KonfiDetailView.tsx` laedt Settings separat (Zeile 180-181) und gibt sie an ActivityRings weiter (Zeile 499-500). Wenn die Punkte-Typ-Konfiguration im Jahrgang statt in Settings gespeichert wird, muss KonfiDetailView die Daten von einer anderen Quelle laden. Ausserdem zeigt es `gottesdienstPoints` und `gemeindePoints` getrennt an -- bei deaktiviertem Typ irrelevant.

**Praevention:**
- Liste aller Admin-Views die Settings/Goals nutzen: `KonfiDetailView.tsx`, `KonfisView.tsx`, `AdminGoalsPage.tsx`
- Alle muessen auf die neue Datenquelle umgestellt werden
- Bedingte Anzeige der Punkte-Spalten basierend auf Jahrgang-Konfiguration

**Betroffene Phase:** Punkte-Logik-Anpassung (Admin-Views)

## Geringfuegige Pitfalls

### Pitfall 11: AdminGoalsPage erlaubt 0 als Ziel ohne klare Semantik

**Was schiefgeht:** `AdminGoalsPage.tsx` erlaubt bereits `target_gottesdienst: 0` und `target_gemeinde: 0` ueber den Stepper. Aber der Wert 0 bedeutet aktuell "kein Ziel gesetzt", nicht "Punkte-Typ deaktiviert". Wenn 0 jetzt "deaktiviert" bedeuten soll, muss die UI das klar kommunizieren.

**Praevention:**
- Expliziter Toggle "Punkte-Typ aktiv/inaktiv" statt implizit ueber Zielwert 0
- Oder: Wert 0 = deaktiviert, aber mit klarer visueller Indikation (ausgegraut, Label "Deaktiviert")
- Backend: Wenn Typ deaktiviert, Stepper fuer Zielwert ausgrauen

**Betroffene Phase:** Punkte-Typ-Konfiguration (UI-Semantik)

---

### Pitfall 12: Push-Notifications referenzieren deaktivierte Punkte-Typen

**Was schiefgeht:** Level-Up-Notifications (v1.5) basieren auf `total_points`. Wenn Notification-Text "Du hast jetzt 15 Gesamtpunkte!" sagt aber nur Gemeinde-Punkte aktiv sind, ist das verwirrend. Badge-Earned-Notifications fuer unerreichbare Badges koennten theoretisch nicht auftreten, aber die Texte referenzieren trotzdem Punkte-Typen.

**Praevention:** Notification-Texte dynamisch basierend auf aktiver Konfiguration generieren. Level-Up Berechnung konsistent mit Ranking/Dashboard halten.

**Betroffene Phase:** Punkte-Logik-Anpassung (Notifications)

---

### Pitfall 13: Profil-Seite zeigt beide Punkte-Typen immer an

**Was schiefgeht:** `ProfileView.tsx` und `KonfiProfilePage.tsx` zeigen `gottesdienst_points` und `gemeinde_points` getrennt an. Bei deaktiviertem Typ sieht der Konfi eine Zeile mit "Gottesdienst: 0" die nicht relevant ist.

**Praevention:** Profil-Anzeige dynamisch filtern basierend auf Jahrgang-Konfiguration.

**Betroffene Phase:** Punkte-Logik-Anpassung (UI-Bereinigung)

## Phasen-spezifische Warnungen

| Phase-Thema | Wahrscheinlicher Pitfall | Mitigation |
|-------------|--------------------------|------------|
| Datenmodell-Entscheidung | Punkte-Typ in `settings` statt `jahrgaenge` speichern (Pitfall 7) | Pro Jahrgang = Spalte/Config in `jahrgaenge` Tabelle |
| Ranking-Entscheidung | Keine klare Regel fuer alte Punkte (Pitfall 3) | VOR Implementierung mit User klaeren: behalten vs. nur aktive zaehlen |
| Backend-Validierung | `getPointField` Error statt klarer Meldung (Pitfall 4) | Typ-Check VOR getPointField in allen 8 betroffenen Stellen |
| ActivityRings Anpassung | Nur Ring ausblenden, Legende und Zentral-Anzeige vergessen (Pitfall 1) | Alle drei Bereiche muessen konsistent reagieren |
| Badge-Integration | Unerreichbare Badges sichtbar lassen (Pitfall 2) | Sichtbarkeit filtern, Admin warnen, NICHT loeschen |
| Dashboard-Widget-System | Over-Engineering mit Drag-and-Drop (Pitfall 8) | Nur Toggle-Schalter, feste Reihenfolge |
| Dashboard-Widget-Datenmodell | Viele einzelne Settings-Keys (Pitfall 9) | Ein JSON-Objekt unter einem Key |
| Datenmigration | Bestehende Orgs ohne Defaults (Pitfall 5) | SQL-Migration mit Defaults fuer alle existierenden Organisationen |
| Admin-Views | KonfiDetailView, KonfisView vergessen (Pitfall 10) | Checkliste aller Views die Settings/Goals nutzen abarbeiten |
| Goals-UI Semantik | 0 = "kein Ziel" vs. 0 = "deaktiviert" (Pitfall 11) | Expliziter Toggle oder klare visuelle Unterscheidung |

## Abhaengigkeits-Reihenfolge der Pitfall-Mitigationen

```
1. Datenmodell-Entscheidung (Pitfall 7) -- wo speichern?
   |
   v
2. Ranking-Entscheidung (Pitfall 3) -- wie zaehlen?
   |
   v
3. Backend-Validierung (Pitfall 4) -- Typ-Check vor getPointField
   |
   v
4. Datenmigration (Pitfall 5) -- Defaults fuer bestehende Orgs
   |
   v
5. Frontend-Anpassungen parallel:
   - ActivityRings (Pitfall 1)
   - Badge-Sichtbarkeit (Pitfall 2)
   - Fortschrittsbalken (Pitfall 6)
   - Admin-Views (Pitfall 10)
   - Profil (Pitfall 13)
   |
   v
6. Dashboard-Widget-System (Pitfall 8, 9) -- separates Feature, kann parallel
```

## Quellen

- Direkte Code-Analyse: `ActivityRings.tsx` (350 Zeilen), `DashboardView.tsx` (~1400 Zeilen), `badges.js` (504 Zeilen), `levels.js` (299 Zeilen), `konfi.js` (~900 Zeilen), `konfi-managment.js` (~700 Zeilen), `activities.js` (~500 Zeilen), `validation.js` (65 Zeilen), `settings.js`, `AdminGoalsPage.tsx`, `KonfisView.tsx`, `KonfiDetailView.tsx`, `KonfiDashboardPage.tsx`
- Projekt-Historie: v1.0 Security Hardening (getPointField-Whitelist), v1.2 ActivityRings 3-Runden-Design, v1.4 Badge-Logik-Debug (13 Kriterientypen), v1.5 Push-Notifications (Level-Up)
- Architektur-Kontext: `PROJECT.md`, `CLAUDE.md`

---
*Pitfalls research for: Konfi Quest v1.6 Dashboard-Konfig + Punkte-Logik*
*Researched: 2026-03-07*
