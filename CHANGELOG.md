# Changelog

Alle nennenswerten Änderungen an Konfi Quest. Format lose angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/). Neueste Version oben.
Dieser Changelog wächst fortlaufend mit — jede Änderung wird hier eingetragen.

---

## [Unreleased]

### ⚡ Performance
- **60-Sekunden-Polling des Konfi-Badge-Zaehlers entfernt.** Die Tab-Leiste
  fragte fuer jeden Konfi 1×/Minute `/konfi/badges` ab, nur um den „neue Badges"-
  Punkt zu aktualisieren. Der Server sendet jetzt beim tatsaechlichen Vergeben
  eines Badges ein LiveUpdate an den Konfi (`checkAndAwardBadges` →
  `insertBadgesAndNotify` → `sendToKonfi('badges','earned')`), das an allen
  Punktevergabe-Stellen (Aktivitaet, Bonuspunkte, Event-Anwesenheit) ausgeloest
  wird. Die App laedt den Zaehler nur noch initial + auf dieses Event
  (`frontend/src/components/layout/MainTabs.tsx`, `backend/routes/badges.js`).
- **30-Sekunden-Polling der Admin-Badges entfernt.** Der `BadgeContext` fragte
  fuer Admins alle 30s `/chat/rooms` (+ `/admin/activities/requests` + `/events`)
  ab — eine offene Admin-App erzeugte so ~120 unnoetige Requests/Stunde und war
  mit Abstand der groesste Traffic-Verursacher (`/api/chat/rooms` = ~38% aller
  Requests). Das Polling war redundant: Chat-Unread laeuft ueber den WebSocket
  (`newMessage`), Antraege/Events ueber LiveUpdate (`requests`/`events`), und nach
  Verbindungsabriss/Push feuern `sync:reconnect`/`push:received` einen Refresh.
  Nur noch der initiale Load bleibt (`frontend/src/contexts/BadgeContext.tsx`).

### 🐛 Fehlerbehebungen
- **Benutzer mit Konfi-History liessen sich nicht loeschen ("Datenbankfehler").**
  Wurde ein User geloescht, der noch Antraege, Badges, Aktivitaeten oder
  Bonuspunkte hatte (typisch: ein zum Teamer befoerderter Ex-Konfi), brach der
  Delete mit HTTP 500 ab. Ursache: Die vier History-Tabellen (`activity_requests`,
  `bonus_points`, `user_activities`, `user_badges`) tragen aus der SQLite-Altlast
  je einen zweiten Foreign-Key mit `NO ACTION` neben dem `CASCADE`-FK — beim
  User-Delete gewann `NO ACTION` und blockierte. Der Delete-Handler raeumt diese
  History jetzt explizit vor dem User-Delete ab (`backend/routes/users.js`).
  Nachweisfoto-Cleanup vorgezogen, damit keine Dateileichen zurueckbleiben.
  Das gewuenschte Verhalten bleibt erhalten: Beim **Jahrgang**-Loeschen behalten
  befoerderte Ex-Konfis ihre History (nur die Jahrgang-Bindung faellt weg); erst
  beim Loeschen des **Users selbst** geht dessen History mit weg. Regressionstest
  ergaenzt (`backend/tests/routes/users.test.js`).

## [1.4.1] – 2026-07-02 (iOS Build 75, TestFlight)

### 🎨 Landing-Page (konfi-quest.de)
- **USP „Von einem Pastor für die Konfi-Arbeit entwickelt" prominent gemacht.**
  Hero-Eyebrow von „Moderne Konfi-Arbeit, die ankommt" auf diesen USP geändert
  und eine neue Story-Sektion („Aus der eigenen Konfi-Arbeit entstanden") mit
  persönlicher Gründungsgeschichte und Signatur ergänzt (`frontend/public/landing.html`).

### 🧪 Tests
- **networkMonitor-Tests an das neue Verhalten angepasst.** Der Android-Fix
  (connectionType `none`/`unknown` = optimistisch online, damit der Login nicht
  faelschlich blockt) hatte die zugehoerigen Tests nicht mitgezogen — dadurch
  war das CI-Deploy-Gate seit dem 30.06. rot und blockierte alle Deploys.
  Test „none → offline" auf das gewollte „none → online" korrigiert und die
  Web-Fallback-Isolation eines Subscribe-Tests robust gemacht (explizites
  `isNativePlatform=false` statt Verlass auf die Test-Reihenfolge).

### 🐛 Fehlerbehebungen
- **Genehmigen/Ablehnen-Buttons (Admin → Antrag) liefen auf schmalen Android-
  Geräten rechts aus dem Bild.** Die beiden nebeneinanderstehenden Buttons hatten
  gleichzeitig `expand="block"` und `flex: 1` gesetzt, was sich mit dem
  Flex-Layout biss; ohne `min-width: 0` konnten sie nicht unter ihre Inhaltsbreite
  schrumpfen. Jetzt teilen sie sich die Breite sauber 50/50 und passen auch auf
  kleinen Displays ins Bild.

### 🎨 Darstellung
- **Konfi-Event-Detail: Anmelde- und Wartelisten-Buttons wieder als gefüllte
  Vollfarb-Buttons.** Die in 1.4.0 testweise auf `fill="outline"` umgestellten
  Buttons („Anmelden", „Wieder anmelden", „Warteliste offen") sind wieder
  vollflächig eingefärbt (grün bzw. gelb), da die dezente Outline-Variante optisch
  nicht überzeugte.

---

## 1.4.0 (Juni 2026) — Production

App-Store-Release. iOS-Builds 64–74, Android versionCode 66. Schwerpunkte:
Medien-Verschlüsselung, Foto-Sichtbarkeit/-Aufräumung, Chat-Darstellungsfixes
und Android-Login-Härtung.

### 🔒 Sicherheit
- **Hochgeladene Medien werden jetzt verschlüsselt gespeichert (AES-256-GCM).**
  Betrifft alle drei Upload-Arten: Antrags-Nachweisfotos, Chat-Medien (Bilder,
  PDFs, Videos, Audio, Office-Dateien) und Team-Material. Die Dateien liegen
  nicht mehr im Klartext auf dem Server, sondern werden erst beim Abruf
  entschlüsselt ausgeliefert. Bestehende Alt-Dateien bleiben lesbar und werden
  per Migration nachverschlüsselt (abwärtskompatibel, keine Ausfallzeit).
- **Nachweisfotos sind nach der Bearbeitung nur noch für Admins sichtbar.**
  Sobald ein Antrag verbucht oder abgelehnt ist, kann der Konfi das Foto nicht
  mehr abrufen (serverseitig erzwungen, nicht nur in der Oberfläche). Admins
  sehen das Foto weiterhin in jedem Status — auch bei verbuchten und abgelehnten
  Anträgen.
  Hinweis: Bei bereits zuvor genehmigten Anträgen wurde das Foto durch die alte
  Logik beim Verbuchen entfernt; für diese Alt-Anträge ist kein Foto mehr
  vorhanden. Ab jetzt bleibt es erhalten.

### 🐛 Fehlerbehebungen
- **Chat-Detailseiten: schwarzer Header im Geräte-Dark-Mode + falsche Safe-Area
  oben.** Ursachen: (1) Der Chat-Header war als „durchscheinend" (translucent)
  konfiguriert, obwohl der Chat-Inhalt nicht darunter scrollt — dadurch saß die
  Kopfzeile im Bereich der Statusleiste/Notch falsch. Jetzt opaker Header mit
  korrektem Safe-Area-Abstand. (2) Die App hat kein eigenes Dark-Theme; Ionic
  färbte die Kopfzeile im System-Dark-Mode dennoch dunkel. Jetzt ist die
  Toolbar-Grundfarbe app-weit auf das helle Standard-Grau festgelegt.
- **Nachweisfoto „kam zurück", nachdem ein Antrag zurückgesetzt/neu gestellt
  wurde.** Ursache: Fotos wurden serverseitig nie wirklich entfernt und der
  Abruf prüfte den Status nicht. Behoben durch das neue Status-Gate und eine
  saubere Lösch-Logik.
- **Android: Login schlug in seltenen Fällen mit „Keine Verbindung" fehl,
  obwohl Netz vorhanden war.** Manche Umgebungen (Emulatoren, Review-Systeme)
  melden den Netzwerkstatus als „none/unknown", obwohl Anfragen funktionieren.
  Die App bleibt in diesen Fällen jetzt optimistisch online und versucht den
  Login, statt ihn vorab zu blockieren.

### ✨ Neu / Verbessert
- **Admins können das Nachweisfoto eines Antrags jetzt manuell löschen**
  (Button im Antrags-Detail). Datei wird vom Server entfernt, Antrag bleibt
  erhalten.
- **Antrags-Fotos werden zuverlässig aufgeräumt:** Beim Zurückziehen eines
  offenen Antrags durch den Konfi und beim Löschen eines Kontos werden die
  zugehörigen Fotodateien mitgelöscht (vorher blieben sie als Dateileichen
  liegen). Wartungsskripte für Nach-Verschlüsselung und Verwaisten-Aufräumung
  ergänzt.
- **Symbole in den Antrags- und Event-Detailansichten vereinheitlicht:** In den
  Antrags-Detail-Dialogen wurden die uneinheitlichen grauen/farbigen Zeilen-
  Symbole entfernt (Konfi & Admin). Das Schloss-Symbol bei „Anmeldung" ist jetzt
  wie alle anderen ein gefülltes Symbol. Antrags-Status heißt admin-seitig
  einheitlich „Verbucht".

### 🛠️ Intern
- Behoben: Material-Datei-Download lehnte gültige Dateinamen ab (Längen-Prüfung
  korrigiert).
- Backend-Tests können jetzt lokal gegen ein Homebrew-PostgreSQL laufen (vorher
  nur in der CI). Neue Tests für Medien-Verschlüsselung, Foto-Status-Gate und
  Lösch-Logik (Roundtrip- und Integrationstests).

---

## [Älter] — nach iOS-Build 60

Diese Änderungen sind committet/deployt (Backend live).

### 🐛 Fehlerbehebungen
- „Anmeldung möglich"-Push wurde teils doppelt gesendet. Jetzt sendet
  ausschließlich der Hintergrund-Dienst (atomar, alle 1 Min) — Erstellen/Ändern
  setzen nur noch das Flag. Genau ein Push pro Öffnung.
- Event-Liste (Konfi & Teamer): lange Titel werden nicht mehr zu früh mit „…"
  abgeschnitten, sondern laufen bis ans Zeilenende und brechen bei Bedarf auf
  zwei Zeilen um (v. a. auf iOS).
- Info-Legende (Events): Eintrag „Anmeldung bald" (orange, Uhr) ergänzt — erklärt
  Events, deren Anmeldung noch nicht geöffnet ist. (Konfi & Teamer & Admin)
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
