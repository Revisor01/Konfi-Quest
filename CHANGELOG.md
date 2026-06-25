# Changelog

Alle nennenswerten Änderungen an Konfi Quest. Format lose angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/). Neueste Version oben.
Dieser Changelog wächst fortlaufend mit — jede Änderung wird hier eingetragen.

---

## [Unreleased] — nach iOS-Build 60 (noch in keinem Build)

Diese Änderungen sind committet/deployt (Backend live), aber noch **nicht** in
einem iOS-Build enthalten. Für eine vollständige 1.3.0-App ist ein neuer Build
(B61) nötig.

### 🐛 Fehlerbehebungen
- Einladungscode verlängern warf „Fehler beim Verlängern" — die Route fragte eine
  nicht existierende Spalte `role_id` ab. Abfrage korrigiert.
- Badge-Regel präzisiert: Bei **Konfis** zählen Pflicht-Events und Konfirmationen
  NICHT mehr für Badges — nur freiwillig besuchte, bestätigte Events plus
  eingereichte Aktivitäten. Bei **Teamer:innen** zählen weiterhin alle bestätigten
  Events (sie arbeiten bei Pflicht/Konfirmation mit). Gilt einheitlich für
  Event-Anzahl, Aktivitäts-Anzahl, Kategorie-, Serien- und Zeitraum-Badges
  (Wertung und Fortschritt). Badge „Turbo-Woche" entfernt.
- Selbst gebuchte Event-Anmeldungen von Konfis wurden ohne Organisation
  gespeichert (`organization_id` fehlte beim Insert) — dadurch zählten sie NICHT
  in Badge-Kriterien (Event-Anzahl, Aktivitäts-Anzahl, Kategorie, Pflicht-Events).
  Insert korrigiert; 23 betroffene Alt-Buchungen nachträglich der richtigen
  Organisation zugeordnet; Badge-Check für alle Konfis/Teamer neu ausgeführt
  (22 rückwirkend verdiente Badges vergeben).
- Event-Erklärung (Info-Button) öffnete als Vollbild statt als Karten-Dialog —
  jetzt korrektes Card-Modal (Konfi & Admin; Teamer war bereits korrekt).
- Badge-Fortschritt vollständig auditiert (Wertung vs. Anzeige für alle
  Kriterien-Typen, Konfi + Teamer). Behobene Abweichungen:
  - Teamer-Badges vom Typ „Kategorie-Aktivitäten" (z. B. Freizeithopper) zeigten
    immer 0 % Fortschritt, obwohl Aktivitäten/Events real zählten — jetzt
    korrekter Fortschritt.
  - Teamer-Fortschritt für „Spezifische Aktivität", „Kombination", „Serie" und
    „Zeitraum" war fest auf 0 — jetzt echte Werte.
  - Konfi-Badge „Kategorie-Aktivitäten": Fortschritt zählte nur Aktivitäten,
    nicht die anwesenden Events (die Wertung tat es) — jetzt deckungsgleich.
  - Konfi-Badge „Bonuspunkte" wurde bei der Wertung nach Anzahl der Einträge statt
    nach Punktesumme bewertet — jetzt nach Summe (wie Anzeige/Beschriftung).
- Teamer-Anwesenheit bestätigen warf einen 400-Fehler („Konfi-Profil nicht
  gefunden"), weil die Konfi-Punkte-Logik mitlief. Punkte gibt es jetzt nur noch
  für Konfis; Teamer-Anwesenheit wird ohne Punkte gesetzt. (`9140a23`, deployt)
- Anträge-Tab-Zähler verschwindet sofort nach Genehmigen/Ablehnen (und zählt
  beim Zurücksetzen sofort hoch) statt erst nach ~30 s — die Antrags-Aktionen
  feuern jetzt `triggerRefresh('requests')` für den BadgeContext.
- Events-Tab-Zähler verschwindet sofort nach vollständigem Verbuchen statt erst
  nach ~30 s (Provider-Reihenfolge LiveUpdate/Badge). (`6f9712e`)
- Teamer:innen sehen reine Konfi-Events korrekt als „Nur zur Info" (kein
  Anmelde-Button, keine grüne Anmelde-Farbe). (`8be6466`)
- Konfis sehen keine reinen Team-Events und keinen „Teamer gesucht"-Hinweis mehr.
  (`c33d27c`)

### ✨ Neue Funktionen
- „Anmeldung möglich"-Push für Events ist jetzt an die tatsächliche Anmeldbarkeit
  gekoppelt: Konfis bekommen den Push genau dann, wenn die Anmeldung offen ist —
  sofort beim Erstellen (falls schon offen), beim Ändern (sobald es anmeldbar
  wird) oder pünktlich zum Anmeldestart (über einen Hintergrund-Dienst, alle
  5 Min). Wird ein Event wieder „zu" gestellt und später erneut geöffnet, feuert
  der Push erneut. Push enthält Titel + Datum; Tippen öffnet direkt das Event.
- Dashboard-Tageslosung (Konfi): zeigt jetzt die gewählte Bibelübersetzung klein
  unter dem Vers an; Tippen auf die Losung öffnet die Übersetzungs-Auswahl. Die
  Auswahl wird gespeichert und die Losung sofort neu geladen.
- Zeit-/Serien-Badges erklären sich beim Antippen: Hinweis, ab wann bzw. in
  welchem Zeitraum der Fortschritt zählt (z. B. „Zählt die letzten 7 Tage (seit
  18. Juni)") und dass ältere Aktivitäten wieder herausfallen. So ist der
  schwankende Fortschritt verständlich. (Konfi + Teamer)
- Events: Info-(i)-Button mit kompletter Farb- und Symbol-Legende (rollenabhängig
  Konfi/Teamer/Admin). (`fdf4bc8`, `8be6466`, `c33d27c`)
- Chat: Neuer Chat öffnet sich nach dem Erstellen direkt (statt zurück zur
  Liste). (`1927a29`)

### 🎨 Verbesserungen
- Einheitliches Event-Status-System: Kreis-Icon vorne = Eck-Badge hinten,
  durchgängige Kreis-Symbole. „Anmeldung möglich" = Plus-Kreis,
  „Ausgebucht" = Schloss, „Verbuchen" = offener Kreis. (`8be6466`, `c33d27c`)

### 🔍 Analyse (kein Code-Change)
- Teamer-Badges geprüft (Logik + Prod-Daten): `checkAndAwardTeamerBadges`, Typ
  `category_activities` ist **korrekt** und zählt Aktivitäten UND anwesende
  Event-Teilnahmen der passenden Kategorie. „Freizeithopper" (Kategorie
  „Freizeit", Ziel 10) hat real bereits Progress 1/10 über das Freizeit-Event
  „Kirchenübernachtung". Die zum Test eingereichte Aktivität „Konfi-Freizeit
  begleitet" zählte NICHT, weil ihr die Kategorien „Kinder"/„Kreativ"
  zugeordnet sind — nicht „Freizeit". Lösung: der Aktivität die Kategorie
  „Freizeit" zuordnen (Datenpflege, kein Code-Fix).

---

## 1.3.0 (Juni 2026)

Großes Feature-Release: Onboarding für alle Rollen, Chat-Medien & Umfragen,
durchgängige Info-Hilfen und ein einheitliches Status-System für Events.

Umfang: 42 Commits über den 22.–25.06.2026, iOS-Builds B49–B60 (+ Folge-Fixes
nach B60). Version 1.3.0, iOS-Build 60, Android versionCode 64.

### ✨ Neue Funktionen

#### Onboarding für alle Rollen
- Geführte Tab-Tour beim ersten Login als Vollbild-Overlay (Konfi, Admin, Teamer:in)
- Direkte Ansprache, eigene Slides für Material & Zertifikate (Admin/Teamer)

#### Chat
- Bild-Versand mit automatischer Kompression vor dem Upload
- Persistenter Bild-Cache + Vorausladen (schnelleres Öffnen, weniger Datenverbrauch)
- „Cache leeren" in allen Profilen
- Umfragen: anonym oder mit Namen, optional exklusive Optionen (jede nur einmal wählbar)
- Tages-Trenner (Heute/Gestern/Datum) als sticky Chip im WhatsApp-Stil
- Sprung zur ersten ungelesenen Nachricht beim Öffnen
- Neuer Chat öffnet sich nach dem Erstellen direkt (statt zurück zur Liste)

#### Info & Hilfe
- Info-(i)-Buttons mit Erklär-Modals in allen Bereichen der „Mehr"-Seite
- Events: Info-Button mit kompletter Farb- und Symbol-Legende (rollenabhängig)

#### Teamer:innen
- Eigene Bibelübersetzung für die Tageslosung wählbar
- Aktivitäten zeigen „Team" statt Gemeinde/Punkte
- Eigene Onboarding-Tour & Bereichs-Infos

### 🎨 Verbesserungen

#### Einheitliches Event-Status-System
- Status-Icon vorne (Kreis) und Eck-Badge hinten zeigen immer dasselbe Symbol
- Durchgängige Kreis-Symbole; eindeutigere Icons:
  „Anmeldung möglich" = Plus-Kreis, „Ausgebucht" = Schloss, „Verbuchen" = offener Kreis
- Klare Farbcodierung pro Status, je Rolle passend

#### Onboarding & Design
- Vollbild-Onboarding statt Modal, deckend, Vollfarb-Optik
- Klare Rollen-Benennung (Org-Admin / Admin / Teamer:in)

### 🐛 Fehlerbehebungen
- Events-Tab-Zähler verschwindet jetzt sofort nach vollständigem Verbuchen
  (vorher bis zu 30 s Verzögerung)
- Teamer:innen sehen reine Konfi-Events korrekt als „Nur zur Info" — ohne
  irreführenden Anmelde-Button und ohne grüne Anmelde-Farbe
- Konfis sehen keine reinen Team-Events und keinen „Teamer gesucht"-Hinweis mehr
- Deaktivierte Punkt-Kategorien werden bei Punkten, Badges und Level konsistent
  berücksichtigt
- Super-Admins können organisationsübergreifend Passwörter zurücksetzen
- Chat: kein Bild-Ruckeln/Reload-Loop mehr, korrekter Abstand unter der letzten
  Nachricht auf iOS, kein Fehler mehr bei Antwort auf gelöschte Nachrichten
- Deutlicher Warnhinweis beim Löschen von Konfis

### 🔧 Technisches
- Teamer-Bibelübersetzung: Migration 107
- Umfragen-Erweiterung (Anonym/Exklusiv): Migration 106
- Provider-Reihenfolge LiveUpdate/Badge korrigiert (Tab-Badge-Live-Update)
- Status-Icons aus einer zentralen Map (StatusBadge) als Single Source of Truth

---

### Store-Text (Kurzfassung „Was ist neu")

```
Konfi Quest 1.3.0

• Onboarding-Tour beim ersten Login – für Konfis, Admins und Teamer:innen
• Chat: Bilder senden, Umfragen (anonym oder offen), schnelleres Laden
• Neuer Chat öffnet sich direkt nach dem Erstellen
• Info-Buttons mit Erklärungen in allen Bereichen
• Events: klare Farben & Symbole für jeden Status, mit Legende zum Nachschlagen
• Teamer:innen: eigene Bibelübersetzung für die Tageslosung
• Viele Detail-Verbesserungen im Chat und an der Anzeige
• Fehlerbehebungen rund um Events, Punkte und Anzeige
```

---

### Commit-Verlauf 1.3.0 (chronologisch)

**22.06. — Konfi-Onboarding & Chat-Grundlagen (B49–B51)**
- `2ddb39c` release: 1.3.0 (iOS B49, Android vc59)
- `031b88f` Chat-Eingabe scrollbar, Datums-Chip sticky, Onboarding Full-Color, Aktivität-Header
- `f055d6e` iOS Build 50
- `ea1d76b` Onboarding-Farbe im Modal + Chat-Abstand nach letzter Nachricht
- `bdd16cc` iOS Build 51
- `4142963` Datums-Chip sticky, gelöschte Nachricht, Geist-Toast, Onboarding-Farbe
- `48cd1bc` saubere Header-Zeile für gewählte Aktivität im Akkordeon

**23.06. — Onboarding-Politur & Punkte-Konsistenz (B52–B54)**
- `ed8f1e1` Login-Optik für Onboarding-Rose + klare Rollen-Benennung
- `a87007b` deaktivierte Punkt-Kategorien konsistent respektieren
- `74e105b` deutlicher Warn-Dialog beim Konfi-Löschen
- `c07983d` iOS Build 52
- `ed84d2c` Vollbild-Overlay statt Modal, deckend, direkte Ansprache
- `6b2a6c1` Rose bis an den Rand (Portal an body) + Bubbles drumherum
- `6378d17` iOS Build 53 — Onboarding-Overlay + alle UI-Fixes
- `2ba5f0c` bei Tastatur-Öffnung ans Listenende scrollen
- `ce14c81` iOS Build 54 — Chat-Tastatur-Scroll-Fix

**24.06. — Chat-Medien, Umfragen, Admin/Teamer-Onboarding, Info-Modals (B57–B60)**
- `cc6c181` Medien-Cache + Bild-Kompression vor Upload, Events-Stats-Fix
- `4748a5b` Medien-Reload-Loop, Tastatur-Scroll, Admin-Cache-Abstand
- `3f0e220` Umfragen — Anonym-Toggle + Exklusiv-Optionen
- `4768446` persistenter Bild-Cache + Vorausladen, kleinerer Abstand unten
- `c13fc1e` iOS Build 57 — Umfragen + Chat-Medien/Perf
- `71e368f` großer Abstand unter letzter Nachricht auf iOS — fullscreen entfernt
- `9878bb3` iOS Build 58 — Chat-Abstand-Fix (fullscreen)
- `1101d28` kein Ruckeln mehr beim Bild-Laden — Höhensprung + Sofort-Cache
- `dfb315a` iOS Build 59 — Chat-Bild-Ruckeln-Fix
- `cbc424a` Super-Admin per is_super_admin-Flag darf org-übergreifend Passwörter zurücksetzen
- `7902580` Admin- und Teamer-Onboarding-Tour (Stil wie Konfis)
- `eea190b` Chat-Texte — Direkt-/Gruppenchats betonen, Tour-/Aufgaben-Beispiele raus
- `5cf32f7` Material-Slide + Zertifikate in Admin-/Teamer-Tour
- `e4f15ff` Info-Modal pro Bereich (Jahrgänge) + Teamer-Events-Empty-Hinweis
- `3a797a2` Teamer: Bibelübersetzung wählbar (Tageslosung)
- `86d2bfe` Info-Buttons für alle Bereiche der „Mehr"-Seite
- `8af32b0` Info-Button auch für „Konfis einladen"
- `1034a9d` Info „Konfis einladen" — Jahrgang legt Admin fest, nicht der Konfi
- `353fd27` iOS Build 60 — Onboarding-Touren + Info-Modals + Teamer-Bibel

**25.06. — Teamer-Events, Status-Icons, Bugfixes (nach B60)**
- `bf2808a` Teamer: Bibel-Modal-Farben (rosa) + Aktivitäten zeigen „Team"
- `4d0e74e` Teamer-Events ohne Teamer-Anmeldung nicht mehr grün
- `fdf4bc8` Events: Info-Button mit Farbcode-Legende (alle 3 Rollen)
- `8be6466` Status-Icons vereinheitlicht + Teamer-Fixes + Legende mit Icons
- `c33d27c` durchgehend Kreis-Icons, Ausgebucht=Schloss, Verbuchen abgesetzt
- `6f9712e` Tab-Badge aktualisiert sofort nach Verbuchen (Provider-Reihenfolge)
- `1927a29` nach Chat-Erstellung direkt in den Chat springen

> Hinweis: Die Commits vom 25.06. (`bf2808a`…`1927a29`) sind noch in **keinem**
> iOS-Build enthalten — B60 liegt davor. Für eine vollständige 1.3.0-Einreichung
> ist ein neuer Build (B61) nötig.
