# Backlog

Ideen und aufgeschobene Features fuer zukuenftige Milestones.

## BUG-BEOBACHTUNG: Android Tab-Bar Safe-Area unten (3-Button-Nav)

Status: diagnostiziert, NICHT gefixt, NICHT in 1.4.0. Wir warten ab, ob es auf
echten Android-Geraeten auftritt (nur im Emulator reproduziert).

Symptom: Auf Android (15/16, S25-aehnlich) liegen die drei System-Navigations-
Buttons ueber der Tab-Bar — die Tab-Bar reserviert keinen Platz fuer die
Navigationsleiste.

Ursache: `env(safe-area-inset-bottom)` liefert in der WebView 0px statt des
echten Nav-Bar-Insets (~48px). targetSdk 36 erzwingt Edge-to-Edge, aber
Capacitor reicht den unteren Window-Inset nicht an die WebView durch. Die
CSS-Regel (`ion-tab-bar.md` in variables.css) ist korrekt, bekommt nur den
falschen 0-Wert.

Loesungsweg (falls bestaetigt): Window-Inset nativ an die WebView durchreichen —
Edge-to-Edge-Plugin oder in MainActivity die Bottom-Inset als CSS-Var
(--ion-safe-area-bottom) injizieren. NICHT erneut breit am CSS aendern.

(Abgrenzung: oberes Chat-Header-Safe-Area-Thema ist separat und in 1.4.0 gefixt.)

## Bibeltexte für Spruchauswahl

Die Konfispruch-Auswahl hat noch keine Bibeltexte hinterlegt. Volltexte der
Sprüche (Lutherbibel o.ä., Lizenzfrage klären) einpflegen bzw. per API/Datenquelle
anbinden, damit Konfis beim Auswählen den Wortlaut lesen können.

## Wrapped optimieren

Konfi-Wrapped (Jahresrückblick) inhaltlich und technisch überarbeiten:
Slides/Statistiken schärfen, Performance der Generierung prüfen, Design-Feinschliff.

## Events: Transaktions-/Lock-Härtung (aus Code-Audit 07.07.)

Mehrere Admin-Schreibpfade in events.js laufen ohne Transaktion/Lock, im Gegensatz
zum sauberen Konfi-Storno (DELETE /:id/book). Randfall-Races bei gleichzeitigen
Aktionen an vollen Timeslots. Kein akuter Datenverlust im Normalbetrieb, aber
härten:
- DELETE /:id/bookings/:bookingId (Admin entfernt Teilnehmer): Punkte-Rücknahme +
  Nachrücken ohne BEGIN/FOR UPDATE. promoteFromWaitlist(client) statt Pool-Queries.
- PUT /:id/participants/:participantId/status: Statuswechsel confirmed<->waitlist
  in drei separaten Pool-Writes ohne Transaktion.
- POST / (Event-Erstellung): INSERT + Timeslots + Auto-Enrollment nicht atomar
  (PUT und POST /series machen es korrekt mit Client+BEGIN — POST / angleichen).
- DELETE /:id/book sperrt nur die eigene Buchung, nicht die Event-Zeile (POST/:id/book
  sperrt Event FOR UPDATE) — Race mit paralleler Buchung möglich.
- Kapazitäts-Inkonsistenz: Buchungspfad zählt ohne Teamer:innen (r.name != 'teamer'),
  alle Nachrück-Pfade zählen inkl. Teamer:innen -> Warteliste kann bei teamer_needed-
  Slots hängenbleiben. getEventWithCounts hat dafür excludeTeamers, wird nicht genutzt.
- konfi.js DELETE /events/:id/register: Storno+Nachrücken ohne Transaktion/Lock.
- Serien-Anmeldefenster (POST /series, Z.2007/2014): Offset per Tag-des-Monats-
  Differenz bricht über Monatsgrenzen (Event 1.9., Anmeldung 25.8. -> Fenster
  verschiebt sich um +24 Tage). Millisekunden-Differenz nutzen.

## pg-numeric-Strings in API-Responses härten (aus Code-Audit 07.07.)

events.js GET / und GET /:id/timeslots liefern registered_count / max_participants
(SUM -> bigint) / waitlist_count teils als Strings ans Frontend. FE-Vergleiche wie
registered_count >= max_participants sind dann lexikografisch ("9" >= "40" = true).
Konsequent im SQL ::int casten oder in der Response parseInt. (Die arithmetischen
Backend-Bugs total=String wurden 07.07. direkt gefixt in konfi.js/teamer.js.)

## nodemailer 8 -> 9 (Security, Breaking Change)

Backend nodemailer hat eine High-Vulnerability (raw-Option umgeht disableFileAccess).
Fix nur via Major-Update 8->9 (Breaking). Restliche npm-audit-Lücken (form-data,
multer, ws, protobufjs) wurden 07.07. bereits geschlossen.

## 999.1 Design-Angleich

Finaler Design-Durchgang ueber alle Views fuer konsistentes Erscheinungsbild.

## 999.2 Test-Suite

Backend: Unit-Tests fuer alle 18 Route-Dateien, Auth-Logik, Punkte-Berechnung, Badge-Vergabe, Wrapped-Generierung.
Frontend: Komponenten-Tests fuer kritische Business-Logik.

## 999.3 Grosse Dateien aufteilen

events.js (2067 Zeilen), chat.js (1847 Zeilen), konfi-managment.js (1008 Zeilen), KonfiDetailSections.tsx (1181 Zeilen), BadgeManagementModal.tsx (1124 Zeilen), ChatRoom.tsx (1058 Zeilen) in kleinere Module splitten.
