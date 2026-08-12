# Changelog

Alle nennenswerten Änderungen an Konfi Quest werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).
Store-Builds (iOS-Build / Android versionCode) stehen jeweils unter der
Versionsüberschrift.

## [Unreleased] - 2.0.0

### Hinzugefügt

- Challenges: Aufgaben, auf die Konfis über einen frei gewählten Zeitraum mit
  eigenen Beiträgen antworten — Foto, Text, Aufnahme oder Link. Bewusst ohne
  Punkte, ohne Zähler und ohne Rangliste; fürs Mitmachen gibt es ein Abzeichen.
- Challenges: Beim Anlegen werden Jahrgänge, Zeitraum, erlaubte Medienarten,
  Sichtbarkeit und Freigabe festgelegt. Nach dem Start bleiben Sichtbarkeit und
  Freigabe unveränderlich — die Zusage an die Konfis gilt.
- Challenges: Konfis entscheiden je Beitrag, ob er mit Namen, anonym oder nur
  für die Leitung sichtbar ist.
- Challenges: Teamer:innen und Leitung nehmen selbst teil; es gibt auch Runden
  nur fürs Team.
- Challenges: Die Leitung kann Beiträge freigeben, nachträglich anonymisieren
  oder ausblenden. Anonymisieren lässt sich nicht zurücknehmen.
- Veranstaltungen: eigenes Kontingent für Teamer:innen mit eigener Warteliste,
  getrennt von den Plätzen der Konfis.
- Veranstaltungen: Termine nur für Teamer:innen sowie Termine, zu denen
  Teamer:innen gesucht werden.
- Veranstaltungen: Anmeldung kann ab sofort geöffnet werden, ohne Startdatum.
- Teamer-Profil: Die Leitung sieht dort jetzt auch die Abzeichen der
  Teamer:in — bisher gab es die Übersicht nur für Konfis.
- Anonyme Nutzungsstatistik in der App: erfasst wird, welche Bereiche und
  Funktionen genutzt werden und wo Fehlermeldungen erscheinen — ohne Namen,
  Kennung, Gemeinde oder Inhalte. Näheres in der Datenschutzerklärung.

### Geändert

- Die Tab-Leiste hat einen eigenen Challenges-Tab; die Anträge sind kein
  eigener Tab mehr, sondern ein Bereich oben im Veranstaltungs-Tab. Gilt für
  Konfis, Teamer:innen und Leitung.
- Jahresrückblick: erzählt den eigenen Weg statt Platzierungen — mit den
  Challenge-Momenten und ohne Vergleich mit anderen.
- Einführung und "Was ist neu?": Aktivitäten werden direkt nach den
  Veranstaltungen erklärt, mit Beispielen passend zur jeweiligen Rolle.
  "Was ist neu?" lässt sich jederzeit erneut aufrufen.
- Veranstaltungs-Formular neu geordnet; Anmeldung ist ein eigener Abschnitt.
- Challenge-Beiträge werden per Tippen und Wischen bearbeitet, wie in den
  übrigen Listen.
- Challenges bei Leitung und Teamer:innen: "Verwalten" und "Mitmachen" sind
  zusammengefasst. Eine Liste zeigt alle Challenges samt eigener Abzeichen, und
  in der geöffneten Challenge stehen der eigene Beitrag und die Beiträge der
  Gruppe beieinander. Ein Plus oben schreibt den eigenen Beitrag.
- Challenges sind für alle gleich aufgebaut: aktuelle Challenges, eigene
  Abzeichen, Archiv. Leitung und Teamer:innen sehen im ersten Abschnitt
  zusätzlich geplante Challenges und Entwürfe.
- Verwaltungslisten folgen jetzt durchgängig einer Regel: Tippen öffnet zum
  Bearbeiten, Wischen löscht.
- Konfi-Ansichten sprechen verständlicher: aus "Antragsdetails" wird "Deine
  Meldung", aus "verbucht" wird "angerechnet", aus "Nachweis-Foto" "Dein Foto".
- Bildschirmlesegeräte benennen jetzt alle Symbol-Schaltflächen und
  Wischaktionen mit ihrer Funktion statt nur "Schaltfläche".

### Behoben

- Teamer:innen: Im Profil standen an mehreren Stellen Punkte und die
  Einteilung in Gottesdienst und Gemeinde, die es dort gar nicht gibt — im
  Antragsdetail, bei Terminen nur fürs Team und in der Aktivitätenauswahl.
- Teamer:innen: Beim Anlegen eines Abzeichens mit einer bestimmten Aktivität
  wurden die Konfi-Aktivitäten zur Auswahl gestellt. Jetzt erscheinen nur die
  Aktivitäten der jeweiligen Zielgruppe.
- Abzeichen-Liste: Ein Abzeichen für eine bestimmte Aktivität zeigt nun deren
  Namen statt einer Nummer — mehrere solche Abzeichen waren nicht
  unterscheidbar.
- Teamer-Profil: Zertifikate zeigen wieder ihr eigenes Symbol, und die Liste
  der Termine erscheint auch, wenn noch keiner dabei war.
- Teamer-Bereich: Kopfbereiche, Listen und Farben folgen jetzt überall
  demselben Muster — im Profil standen bisher drei verschiedene Listenformen
  untereinander.
- Auswahllisten beim Anlegen von Abzeichen zeigen die Auswahl jetzt wie überall
  sonst durch farbige Hinterlegung statt durch Ankreuzkästchen. Kategorien,
  Zielgruppen und Bedingungen tragen dabei ihre eigene Farbe statt durchgehend
  Orange, und die Einträge sind gleich aufgebaut wie in den übrigen Listen.
- Teamer-Profil: Die Abzeichen stehen jetzt unter den Terminen und
  Aktivitäten statt ganz oben.
- Fenster ließen sich nach einem doppelten Tippen auf Speichern nicht mehr
  über das X schließen, sondern nur noch durch Wischen. Betraf Abzeichen,
  Challenges, Veranstaltungen und die Teilnehmerverwaltung.
- Die anonyme Nutzungsstatistik zählte keine Besuche. Die Zahlen im
  Auswertungswerkzeug blieben dadurch leer.
- Veranstaltungen: Bei Zeitfenster-Terminen konnte eine Anmeldung ohne Auswahl
  eines Zeitfensters zustande kommen, wenn die Zeitfenster nicht geladen werden
  konnten.
- Veranstaltungen: Teilnehmende entfernen und auf die Warteliste setzen fragen
  jetzt nach — beides wird per Wischgeste ausgelöst.
- Veranstaltungen: In zwei Listen ließen sich Einträge anwischen, ohne dass es
  eine Aktion dazu gab.
- Startseite: Neben dem eigenen Platz standen erfundene Punktzahlen der
  Nachbarplätze. Dort steht jetzt nur noch der Platz.
- Bibelübersetzung wechseln meldet jetzt, wenn das Speichern fehlschlägt.
- Challenges: "Nur für euch in der Leitung" erschien auch bei Konfis.
- Einzelne Beschriftungen liefen aus ihrer Kachel heraus.
- Teamer-Bereich: Schreibfehler "Gueltig" bei Zertifikaten.
- Konnte ein Foto zu einer Meldung nicht geladen werden, stand dort
  fälschlich "Kein Foto hochgeladen".
- Beim Hinzufügen einer Aktivität im Profil einer Teamer:in kam es zum
  Rauswurf aus der App — Ursache waren Aktivitäten ohne Punkte-Art
  ("Konfi-Wochenende", "Konfi-Freizeit begleitet").
- Wischaktionen in Listen klappen nach dem Antippen wieder zu.
- Nach dem Öffnen einer Veranstaltung, eines Profils oder eines Chats zeigten
  andere Tabs teils die falsche Seite an.
- Challenges: Ein freigegebener Beitrag, den nur die Leitung sieht, trug
  fälschlich einen grünen Haken.
- Challenges: Die eigenen Abzeichen werden bei Leitung und Teamer:innen auch
  dann angezeigt, wenn noch keins vergeben ist.
- Challenges: "Anonym stellen" und "Ausblenden" hatten dasselbe Symbol.
- Challenges: Der eigene Beitrag öffnet sich jetzt wie die übrigen Fenster.
- Challenges: Die Aufgabe steht in einer Karte statt im farbigen Hinweiskasten.
- Challenges: Überflüssiger Zurück-Pfeil auf der Hauptseite entfernt.
- Beim Abmelden von einem Termin steht jetzt der Grund dabei, wenn es nicht
  mehr geht (bis 2 Tage vorher).
- Veranstaltungen: Speichern brach in manchen Fällen ohne Meldung ab. Fehlende
  Pflichtangaben werden jetzt benannt.
- Anträge werden schneller abgeschickt; Benachrichtigungen an die Leitung
  laufen jetzt im Hintergrund.
- Tageslosung: Bei gleichzeitigem Abruf durch viele Geräte wird nur noch einmal
  nachgeladen.
- Veranstaltungen: Termine nur für Teamer:innen vergaben fälschlich Punkte,
  zeigten ein wirkungsloses Anmeldefenster und eine Konfi-Warteliste.
- Veranstaltungen: Terminserien übernehmen alle Angaben des ersten Termins.
- Veranstaltungen: Termine mit Anmeldungen lassen sich wieder löschen.
- Challenges: Aufruf einer Challenge konnte zur Abmeldung führen.

### Sonstiges

Betrifft nicht die App, gehört nicht in die Store-Release-Notes.

- Eigene Staging-Umgebung mit getrennter Datenbank für interne Tests.
- Startseite um einen Abschnitt zu den Challenges erweitert.
- Startseite: Klick-Auswertung erkennt die Ziel-Adresse jetzt zuverlässig —
  fremde Adressen konnten sich zuvor als App-Store-Link ausgeben.
- Sicherheitsaktualisierung veralteter Entwicklungs-Pakete.

## [1.5.3] - 2026-08-04

### Hinzugefügt

- Chat: Button zum Springen ans Ende der Nachrichtenliste.

### Geändert

- Tageslosung lädt schneller.
- Neue Organisationen starten mit "Küsterdienst" als Beispielaktivität.

### Behoben

- Admin: Organisationswechsel funktioniert wieder — bisher blieben die Daten der
  alten Organisation stehen.
- Veranstaltungen: Bei Teilnehmenden eines Zeitfensters wird die Anwesenheit
  jetzt richtig angezeigt.

### Sonstiges

Betrifft nicht die App, gehört nicht in die Store-Release-Notes.

- Startseite: anonyme, cookiefreie Reichweitenmessung um Klicks, Scrolltiefe und
  gelesene Abschnitte erweitert.
- Startseite: Sitemap war für Google nicht abrufbar, die Adresse mit "www" wird
  jetzt weitergeleitet.
- Quelltext unter Lizenz gestellt: nicht-kommerzielle Nutzung erlaubt,
  Änderungen müssen öffentlich gemacht werden.

## [1.5.2] - 2026-07-31

iOS Build 86 + Android versionCode 74. Bugfix-Release rund um Benutzernamen
plus Sicherheits-Härtung (CodeQL-Durchsicht).

### Hinzugefügt

- Registrierung: Benutzername-Regeln live im Formular sichtbar (unzulässige
  Zeichen werden sofort angezeigt, analog zur Passwort-Checkliste); die
  Fehlermeldung beim Absenden zeigt die konkrete Backend-Validierung, der
  Registrieren-Button ist bei ungültigem Benutzernamen deaktiviert.

### Geändert

- Changelog auf strikt Keep a Changelog umgestellt (feste Kategorien, knappe
  Bullets, ISO-Daten); Commit-Verlauf und Store-Texte entfernt.
- Admin-Anlage von Konfis: Benutzername-Generierung an die Registrierungs-Regeln
  angeglichen — Umlaute werden transliteriert (`Jürgen Müller` →
  `juergen.mueller`), Zahlen und Bindestriche bleiben erhalten, bei Kollisionen
  wird automatisch hochgezählt (`anna.musterfrau2`) statt mit Datenbankfehler
  abzubrechen. Beim Benutzer-Update durch Org-Admins gelten jetzt ebenfalls die
  vollen Zeichenregeln.

### Behoben

- Konfi-Bearbeitung überschrieb selbstgewählte Benutzernamen: Das Backend
  generierte den Usernamen bei jedem Speichern neu aus dem Anzeigenamen —
  selbstgewählte Namen aus der Registrierung (z.B. `anna.musterfrau`) wurden
  still überschrieben und der Login schlug scheinbar grundlos fehl. Der Username
  bleibt beim Bearbeiten jetzt unangetastet.

### Sicherheit

- CodeQL-Findings abgeräumt (19 → 0): Der Passwort-Generator im
  Admin-Reset-Modal nutzt jetzt `crypto.getRandomValues` statt `Math.random`
  (mit Rejection-Sampling gegen Modulo-Bias); 35 Log-Aufrufe mit User-Input im
  Format-String auf statische Strings mit separaten Argumenten umgestellt
  (Log-Injection); ReDoS-anfällige Trim-Regex im usernameGenerator durch
  lineares Trimmen ersetzt; strikte Content-Security-Policy für das Backend
  aktiviert (liefert kein HTML aus — verhindert Script-Ausführung, falls eine
  hochgeladene SVG-/HTML-Datei direkt als Dokument geöffnet wird); explizite
  `permissions: contents: read` für die CI-Workflow-Jobs. 9 False Positives
  (Rate-Limiting per Dependency Injection für CodeQL unsichtbar, DOM-XSS mit
  vorhandenem Allowlist-Sanitizer) mit Begründung dismissed. Zusätzlich 9
  überholte Dependabot-PRs geschlossen (Zielversionen auf main längst
  erreicht).
- Transitive Dependency-Updates (nur Lockfiles): Backend npm audit auf 0
  (u.a. body-parser, brace-expansion, postcss), Frontend js-yaml/tar/postcss
  gefixt. Verbleibende 6 High-Findings stecken komplett in der
  ESLint-Dev-Toolchain und sind erst mit dem ESLint-10-Major-Sprung lösbar
  (weder Build-Artefakt noch Laufzeit betroffen; eingeplant für den
  Challenges-Milestone).

## [1.5.1] - 2026-07-18

Android versionCode 73 (Google Play Production). Reiner Bugfix-Release für den
Android-Push-/Chat-Ausfall seit 1.5.0; Backend-Fix via CI deployt.

### Behoben

- Android: Push- und Chat-Totalausfall seit dem 1.5.0-Rollout (09.07.) — auf
  allen Android-Geräten kamen keine Push-Nachrichten mehr an, Chats luden nur
  veralteten Cache (iOS lief noch auf 1.4.x). Tatsächliche Ursache (nachträglich
  korrigiert): ein falscher/fehlender Header in der Proxy-Konfiguration, der die
  Requests von Capacitor auf Android nicht durchließ — Capacitor nutzt für iOS
  und Android unterschiedliche URL-Endpoints/Origins. Die zunächst vermutete
  Ursache (Session-Race beim Token-Refresh) war es nicht; die dabei gebauten
  Härtungen bleiben aber drin: Der Refresh-Token wird jetzt vor dem Access-Token
  persistiert, das serverseitige Grace-Window für rotierte Tokens wurde von 30 s
  auf 5 Minuten erhöht.

### Hinzugefügt

- Build-Absicherung gegen fehlende Firebase-Config: versionierte Master-Kopie
  von `google-services.json` unter `frontend/config/` plus Pflicht-Skript
  `frontend/scripts/prepare-android.sh`, das die Config vor dem Build
  wiederherstellt, Firebase-Projekt/Package verifiziert und sonst hart abbricht.
  Vorher wurde das google-services-Gradle-Plugin bei fehlender Datei still nicht
  angewendet — der Build lief durch, die App bekam aber keinen FCM-Token.

## [1.5.0] - 2026-07-08

iOS Build 85 + Android versionCode 72. Der Play-Production-Track stand noch auf
1.4.2, daher enthalten die Play-Release-Notes auch die 1.4.3-Highlights.

### Hinzugefügt

- Konfi-Detailansicht (Admin/Teamer): erreichte Badges des Konfis als klickbare
  Kreis-Symbole mit Detail-Popover (Name, Beschreibung, Datum). Konfi- und
  Admin-Endpoint nutzen dieselbe Wertungsquelle (`utils/konfiBadgeProgress.js`)
  und zeigen garantiert denselben Stand.

### Geändert

- Einheitliche Empty-States in der Konfi-Detailansicht (Bonus, Events,
  Aktivitäten, Zertifikate, Historie, Badges) über die gemeinsame
  `EmptyState`-Komponente.

### Behoben

- Badge-Vergabe: Punkte-Badges wurden falsch bewertet — PostgreSQL liefert
  Punkte-Spalten als String, wodurch die Addition zur String-Verkettung wurde
  ("0"+"3"+"5" = "035") und der Vergleich gegen `criteria_value` lexikografisch
  lief. Fix per parseInt bzw. `::int`-Cast in Wertung und Fortschritt;
  Regressionstest ergänzt.
- Datenkorrektur: 68 infolge des String-Bugs fälschlich vergebene Punkte-Badges
  in Kirchspiel West per verifizierter SQL-Bereinigung entfernt (nur Einträge
  unterhalb des criteria_value; legitime Badges blieben unangetastet).
- Weitere pg-String-Bugs bei Punkte-Summen in der Konfi-Punkte-Historie
  (`GET /points-history`) und der Teamer-Ansicht behoben (parseInt auf beide
  Summanden).
- Live-Update bei Teamer-Aktivitäten ging ins Leere — `assign-activity` sendete
  hart an den Konfi-Socket-Raum; jetzt `sendToUserByRole`.
- Rollen-Zuweisung: `GET /roles/list/assignable` prüft jetzt zusätzlich das
  `is_super_admin`-Flag (org_admins mit Flag bekamen org_admin nicht als
  zuweisbare Rolle).
- Blob-URL-Leaks im Datei-Viewer behoben (FileViewerModal gab gecachte URLs nie
  frei, KonfiDetailView revokte die Foto-URL nicht vor dem Überschreiben).

### Sicherheit

- Abhängigkeiten aktualisiert (Code-Durchsicht 07.07.): Frontend 0
  Vulnerabilities (vorher 3 high, u.a. ws-DoS), Backend von 7 auf 1 reduziert
  (form-data CRLF, multer DoS, ws-DoS, protobufjs). Ionic 8.8.13, Capacitor
  8.4.1. Offen blieb nodemailer (Breaking-Major, Backlog — inzwischen erledigt).

## [1.4.3] - 2026-07-06

iOS Build 82 (TestFlight). Schwerpunkt Zeitslot-Events und Warteliste.

### Geändert

- Timeslot-Events: Warteliste gilt jetzt pro Zeitslot statt event-weit — voller
  Slot mit aktiver Warteliste setzt auf die Warteliste dieses Slots, Nachrücken
  beim Stornieren rechnet slot-bezogen, der Slot wird beim Buchen gegen
  Doppelbuchung des letzten Platzes gesperrt (FOR UPDATE), alle
  Timeslot-Endpoints liefern `waitlist_count` je Slot.
- Badge-Endpoint `GET /konfi/badges`: ~60 sequenzielle Queries durch 11 parallel
  vorab geladene Aggregate ersetzt (vorher ~1 s Antwortzeit, langsamster
  Endpoint des App-Starts); Zählsemantik unverändert und gegen die Vergabe
  verifiziert.
- Admin: Wartelisten-Teilnehmer unter Zeitslots orange statt blau (konsistent
  zur globalen Liste); „Voll"/„Frei"-Eckbadges mit Icon.

### Behoben

- Konfis kamen bei vollem Zeitslot nie auf die Slot-Warteliste (clientseitige
  Blockade „Dieser Zeitslot ist leider voll") — jetzt Button „voll — auf
  Warteliste" mit Bestätigung; Admin- und Teamer-Ansichten zeigen die Warteliste
  pro Slot, Bestätigen aus der Warteliste rückt slot-korrekt nach.
- Zwei Org-Filter-Drifts im Badge-Fortschritt: `unique_activities` und
  `bonus_points` zählten org-übergreifend, die Vergabe aber org-gefiltert —
  Multi-Org-Konfis konnten 10/10 sehen, ohne dass der Badge kam.

### Sicherheit

- Org-Isolation: fremde IDs in Request-Bodies werden abgewiesen — neuer
  zentraler Guard `allIdsBelongToOrg` in allen Schreibpfaden mit ID-Arrays
  (Events, Aktivitäten, Material); fremde IDs geben 400 mit klarer Meldung.

## [1.4.2] - 2026-07-05

iOS Build 80 + Android versionCode 69. Stabilitäts-Release (Auth/Token +
Foto-Upload).

### Behoben

- Aktivitätsfotos: Handykamera-Fotos (8–16 MB) wurden unkomprimiert hochgeladen
  und über 5 MB clientseitig abgewiesen; der globale 20-s-Timeout killte
  langsame Uploads auf Mobilfunk. Jetzt komprimiert `compressForUpload`
  (1920 px / JPEG q0.8) vor der Größenprüfung in beiden Antrags-Modals,
  Upload-Timeouts liegen bei 60 s, das Backend antwortet beim Multer-Limit mit
  413 und klarer deutscher Meldung.
- Auth: App-Öffnen-Hänger und Socket-Reconnect-Fehler durch abgelaufene Tokens —
  proaktiver Token-Refresh (`ensureFreshToken` prüft das `exp`-Claim vor dem
  Senden) statt 401-Umweg pro Request; der Socket holt sich den Token pro
  Handshake frisch; auf einen scheiternden Refresh wartende Requests werden
  sauber rejected statt ewig zu hängen.

### Geändert

- Infra: Traefik-Ausbau (Retry-/Ratelimit-/Compress-Middlewares, gefiltertes
  JSON-Access-Log, Prometheus-Metrics), ntfy-Healthcheck-Monitoring ersetzt
  Uptime Kuma, Nextcloud-AiO-CPU-Limits per Cron persistent.

## [1.4.1] - 2026-07-04

iOS Build 78 + Android versionCode 67. Großes Stabilitäts- und Echtzeit-Release
(Audit-Phasen F–H); enthält die Vorab-Änderungen aus iOS Build 75 (02.07.).

### Hinzugefügt

- Push bei Termin-/Ortsänderung gebuchter Events an alle gebuchten Teilnehmer
  (confirmed + Warteliste, inkl. Teamer:innen) mit dem konkret geänderten Wert;
  feuert nur bei echten Änderungen zukünftiger, nicht abgesagter Events.
- Leichtgewichtiger Endpoint `GET /notifications/badge-counts` für die
  Tab-Zähler — ersetzt drei Volllisten-Endpoints pro Badge-Refresh.
- Landing-Page: USP „Von einem Pastor für die Konfi-Arbeit entwickelt" als
  Hero-Eyebrow plus Story-Sektion mit Gründungsgeschichte.

### Geändert

- „Alle bestätigen" verbucht jetzt alle angemeldeten Konfis ohne
  Anwesenheits-Status als anwesend (inkl. Punktevergabe und Badge-Prüfung)
  statt die Warteliste kapazitätsübersteuernd zu befördern; die beiden
  Warteliste-Bulk-Endpoints wurden entfernt, Nachrücken läuft weiter
  automatisch (FIFO) bzw. einzeln.
- Events-Listen-Queries restrukturiert: LATERAL-Aggregate statt Join-Explosion
  mit korrelierten Subqueries, JSON-Response feldgenau identisch. Beide Listen
  liefern standardmäßig nur noch das letzte Jahr plus Zukunft (`?all=true` als
  Escape-Hatch).
- Performance: Mark-Read auf 1,5 s gebündelt (lokaler Badge weiterhin sofort),
  Chat-Fallback-Poll inkrementell und nur bei sichtbarem Tab,
  Chat-Mitgliedschafts-Sync mit 10-Minuten-TTL vom Lesepfad entkoppelt,
  Konfi-Dashboard-Queries parallelisiert (p95 ~1 s → langsamste Einzel-Query),
  device-token-Sendefenster von 10 s auf 12 h, 30-s-Admin-Polling und
  60-s-Konfi-Badge-Polling durch Socket-/LiveUpdate-Events ersetzt,
  redundanter ChatOverview-Doppelhandler entfernt, Push-Listener-Cleanup
  ergänzt.
- Datenbank-Härtung (Migrationen 110–116): verwaiste Daten bereinigt, fehlende
  Foreign Keys, NOT-NULL-Constraints und ein Unique-Guard gegen doppelte
  Badge-Vergabe nachgezogen, funktionslose FK-Duplikate und redundante Indizes
  entfernt. Migrationslauf per `pg_advisory_lock` serialisiert (Race der beiden
  Backend-Replikas beim Deploy behoben).
- Chat-Rendering: eigene Nachrichten werden beim Server-Bestätigen in-place
  ersetzt (kein Doppel-Blitzen, kein Voll-Reload pro Senden), Auto-Scroll
  springt sofort statt animiert, die Tastatur bleibt beim Senden offen.
- Konfi-Event-Detail: Anmelde- und Wartelisten-Buttons wieder als gefüllte
  Vollfarb-Buttons (Outline-Variante aus 1.4.0 zurückgenommen).

### Behoben

- Direktchat mit Teamer:innen war unsichtbar: Teilnehmer wurden mit falschem
  `user_type` eingetragen — der Server leitet den Typ jetzt immer selbst aus
  der echten Rolle ab, Migration 117 repariert die Bestandsdaten.
- Chat-Sync kannte keine Multi-Org-Mitgliedschaften (Org-Switcher):
  eingewechselte Mitglieder wurden aus Jahrgangs-/Team-Chats der Zweit-Org
  entfernt; neue Teamer:innen/Admins erscheinen jetzt sofort im Team-Chat
  (Inline-Sync bei User-Anlage/-Änderung und in den Switcher-Endpoints).
- Kein Push mehr vom alten Account nach Logout+Login: Der Token-DELETE lief
  nach `clearAuth` in einen stillen 401 — jetzt davor, das Sendefenster wird
  zurückgesetzt, bei Account-Wechsel wird der Token sofort umregistriert.
- Chat-Push öffnet jetzt direkt den richtigen Raum (vorher Query-Parameter,
  den keine Seite konsumierte).
- „Neue Nachrichten"-Trenner: per Message-ID an der ersten ungelesenen
  Nachricht verankert (sprang vorher über eigene Nachrichten) und als
  einmaliger Einstiegs-Indikator ausgelegt.
- Live-Updates und Chat-Events gingen zwischen den beiden Server-Replikas
  verloren (kein Socket.IO-Adapter) — jetzt `@socket.io/postgres-adapter`
  über NOTIFY/LISTEN (Migration 109).
- Teamer:innen waren vom gesamten LiveUpdate-System abgeschnitten:
  `sendToOrgAdmins` adressiert jetzt auch den Teamer-Raum, neuer Helper
  `sendToUserByRole` trifft den rollenkorrekten Socket-Raum.
- WebSocket-Reconnect robuster: unbegrenzte Versuche mit 30-s-Backoff-Deckel
  (Deploy-Fenster verbrannte vorher die 10 Versuche endgültig), aktiver
  Reconnect beim App-Resume, sichtbare View revalidiert nach Reconnect,
  Chat-Badge bindet nach Token-Reconnect neu (socketEpoch).
- Fehlende Live-Updates in der Verwaltung nachgerüstet (Konfis,
  Selbstregistrierung, Benutzer, Einstellungen, Badges, Organisationen,
  Levels) sowie fehlende Push-/Live-Updates bei Teamer-Anträgen,
  Zertifikat-Zuweisung, Wartelisten-Statuswechsel, Antrag-Reset und
  Serien-Events.
- Umfragen erscheinen jetzt live und Votes aktualisieren sich live
  (`newMessage`-/`pollUpdated`-Events); Raum-Änderungen erscheinen live
  (`roomsChanged`).
- Benutzer mit Konfi-History ließen sich nicht löschen (NO-ACTION-FK-Altlast
  aus SQLite-Zeiten blockierte den CASCADE) — die History wird jetzt explizit
  vorab abgeräumt; beim Jahrgang-Löschen bleibt die History Beförderter
  weiterhin erhalten.
- Aktivität mit abgeschlossenen Anträgen löschen: sauberer 409 mit Hinweis auf
  die Antragshistorie statt „Datenbankfehler".
- User-Löschung räumt leere Direktchat-Räume mit auf.
- Genehmigen/Ablehnen-Buttons liefen auf schmalen Android-Geräten aus dem Bild
  (Flex-Layout-Konflikt).
- networkMonitor-Tests an den Android-Online-Fix angepasst — das rote
  CI-Deploy-Gate blockierte seit dem 30.06. alle Deploys.

### Entfernt

- 13 tote `*Update`-Kompatibilitäts-Socket-Listener im `LiveUpdateContext`
  (kein Server-Code emittierte diese Events mehr).

### Sicherheit

- Aktive Socket-Verbindungen werden bei Konto-Löschung, Passwort-Reset und
  Deaktivierung sofort getrennt (`disconnectUserSockets`, replika-übergreifend
  über den Postgres-Adapter) — vorher konnte eine tote Session weiter mitlesen.
- Organisationsübergreifender Legacy-Broadcast bei Antrags-Genehmigung entfernt
  (Isolation-Verletzung; org-gezielte LiveUpdates übernehmen).

## [1.4.0] - 2026-06

App-Store-Release. iOS-Builds 64–74, Android versionCode 66. Schwerpunkte:
Medien-Verschlüsselung, Foto-Sichtbarkeit, Chat-Darstellung, Android-Login.

### Sicherheit

- Hochgeladene Medien werden verschlüsselt gespeichert (AES-256-GCM) —
  Antrags-Nachweisfotos, Chat-Medien und Team-Material; Bestandsdateien per
  Migration nachverschlüsselt, abwärtskompatibel ohne Ausfallzeit.
- Nachweisfotos sind nach der Bearbeitung des Antrags nur noch für Admins
  abrufbar (serverseitig erzwungen, nicht nur in der Oberfläche).

### Hinzugefügt

- Admins können das Nachweisfoto eines Antrags manuell löschen (Antrag bleibt
  erhalten).
- Antrags-Fotos werden beim Zurückziehen offener Anträge und bei Konto-Löschung
  zuverlässig mitgelöscht; Wartungsskripte für Nachverschlüsselung und
  Verwaisten-Aufräumung ergänzt.

### Geändert

- Symbole in den Antrags- und Event-Detailansichten vereinheitlicht;
  Antrags-Status heißt admin-seitig einheitlich „Verbucht".
- Backend-Tests laufen jetzt auch lokal gegen ein Homebrew-PostgreSQL (vorher
  nur CI); neue Tests für Medien-Verschlüsselung, Foto-Status-Gate und
  Lösch-Logik.

### Behoben

- Chat-Detailseiten: schwarzer Header im Geräte-Dark-Mode und falsche
  Safe-Area — opaker Header mit korrektem Abstand, Toolbar-Grundfarbe app-weit
  auf helles Standard-Grau festgelegt.
- Nachweisfoto „kam zurück", nachdem ein Antrag zurückgesetzt/neu gestellt
  wurde (Status-Gate + saubere Lösch-Logik).
- Android: Login schlug bei Netzwerkstatus „none/unknown" fälschlich mit
  „Keine Verbindung" fehl — die App bleibt jetzt optimistisch online.
- Material-Datei-Download lehnte gültige Dateinamen ab (Längen-Prüfung).

## [1.3.x] - 2026-06 (Nachträge nach iOS-Build 60)

Committet und deployt (Backend live), auf 1.3.0 folgend.

### Hinzugefügt

- „Anmeldung möglich"-Push an die tatsächliche Anmeldbarkeit gekoppelt: sofort
  beim Erstellen (falls offen), beim Öffnen durch Änderung oder pünktlich zum
  Anmeldestart (Hintergrund-Dienst); erneutes Öffnen feuert erneut, Tippen
  öffnet direkt das Event.
- Dashboard-Tageslosung (Konfi): gewählte Bibelübersetzung sichtbar, Tippen
  öffnet die Auswahl, Losung lädt sofort neu.
- Zeit-/Serien-Badges erklären beim Antippen ihren Zählzeitraum.
- Events: Info-Button mit kompletter Farb- und Symbol-Legende (rollenabhängig).

### Geändert

- Badge-Regel präzisiert: Bei Konfis zählen Pflicht-Events und Konfirmationen
  nicht mehr für Badges (nur freiwillige, bestätigte Events plus Aktivitäten);
  bei Teamer:innen zählen weiterhin alle bestätigten Events. Badge
  „Turbo-Woche" entfernt.
- Einheitliches Event-Status-System: Kreis-Icon vorne = Eck-Badge hinten;
  „Anmeldung möglich" = Plus-Kreis, „Ausgebucht" = Schloss, „Verbuchen" =
  offener Kreis.

### Behoben

- „Anmeldung möglich"-Push wurde teils doppelt gesendet — jetzt sendet
  ausschließlich der Hintergrund-Dienst, genau ein Push pro Öffnung.
- Selbst gebuchte Event-Anmeldungen wurden ohne `organization_id` gespeichert
  und zählten dadurch nicht für Badges — Insert korrigiert, 23 Alt-Buchungen
  zugeordnet, 22 rückwirkend verdiente Badges vergeben.
- Badge-Fortschritt vollständig auditiert, Abweichungen zwischen Wertung und
  Anzeige behoben: Teamer-Fortschritt für Kategorie/Kombination/Serie/Zeitraum
  zeigte 0, Konfi-Kategorie-Fortschritt zählte Events nicht mit, Bonuspunkte
  werden nach Summe statt Anzahl gewertet.
- Teamer-Anwesenheit bestätigen warf 400 („Konfi-Profil nicht gefunden") —
  Punkte gibt es jetzt nur noch für Konfis.
- Einladungscode verlängern warf einen Fehler (Abfrage einer nicht
  existierenden Spalte).
- Tab-Zähler für Anträge und Events aktualisieren sofort statt nach ~30 s.
- Event-Liste: lange Titel brechen auf zwei Zeilen um statt zu früh
  abgeschnitten zu werden; Legende um „Anmeldung bald" ergänzt.
- Teamer:innen sehen reine Konfi-Events korrekt als „Nur zur Info"; Konfis
  sehen keine reinen Team-Events und keinen „Teamer gesucht"-Hinweis mehr.
- Event-Erklärung öffnete als Vollbild statt als Card-Modal (Konfi & Admin).

## [1.3.0] - 2026-06-25

iOS Build 60, Android versionCode 64. 42 Commits (22.–25.06.), iOS-Builds
B49–B60. Feature-Release: Onboarding, Chat-Medien & Umfragen, Info-Hilfen,
einheitliches Event-Status-System.

### Hinzugefügt

- Onboarding-Tour beim ersten Login für alle Rollen als Vollbild-Overlay mit
  direkter Ansprache; eigene Slides für Material & Zertifikate (Admin/Teamer).
- Chat: Bild-Versand mit automatischer Kompression, persistenter Bild-Cache
  mit Vorausladen, „Cache leeren" in allen Profilen, Umfragen (anonym oder
  offen, optional exklusive Optionen), sticky Tages-Trenner im WhatsApp-Stil,
  Sprung zur ersten ungelesenen Nachricht, neuer Chat öffnet sich nach dem
  Erstellen direkt.
- Info-(i)-Buttons mit Erklär-Modals in allen Bereichen der „Mehr"-Seite;
  Events-Legende mit Farben und Symbolen (rollenabhängig).
- Teamer:innen: eigene Bibelübersetzung für die Tageslosung, Aktivitäten
  zeigen „Team" statt Gemeinde/Punkte, eigene Onboarding-Tour.

### Geändert

- Einheitliches Event-Status-System: Status-Icon vorne und Eck-Badge hinten
  zeigen immer dasselbe Symbol, klare Farbcodierung pro Status und Rolle,
  Status-Icons aus einer zentralen Map (StatusBadge) als Single Source of
  Truth.
- Vollbild-Onboarding statt Modal, deckend, Vollfarb-Optik; klare
  Rollen-Benennung (Org-Admin / Admin / Teamer:in).
- Migrationen: 106 (Umfragen anonym/exklusiv), 107 (Teamer-Bibelübersetzung).

### Behoben

- Events-Tab-Zähler verschwindet sofort nach vollständigem Verbuchen (vorher
  bis zu 30 s; Provider-Reihenfolge LiveUpdate/Badge korrigiert).
- Deaktivierte Punkt-Kategorien werden bei Punkten, Badges und Level
  konsistent berücksichtigt.
- Super-Admins können organisationsübergreifend Passwörter zurücksetzen.
- Chat: kein Bild-Ruckeln/Reload-Loop mehr, korrekter Abstand unter der
  letzten Nachricht auf iOS, kein Fehler mehr bei Antwort auf gelöschte
  Nachrichten.
- Deutlicher Warnhinweis beim Löschen von Konfis.
