# Web-Version mit Support-Ansicht

Ausgangspunkt für den nächsten großen Schritt. Grundlage sind Simons Antworten
vom 02.10.2026 auf die Produktfragen 3 und 9 und sein „Zweiter Nachtrag"
(wörtlich in [feature-empfehlungen.md](feature-empfehlungen.md), Abschnitt
„Offene Produktfragen an Simon"). Jeder Abschnitt sagt, ob etwas
**entschieden** ist, ein **Vorschlag** oder **offen**.

## Ausgangslage

Die Web-Version unter konfi-quest.de ist heute dieselbe Ionic-App wie auf
iPhone und Android: Reiterleiste unten, für ein Telefon gebaut, im Browser
ausgeliefert vom nginx des Frontend-Containers. Die Funktionen für den
Betrieb stecken in dieser App unter „Mehr" und sind nur für Konten mit
Super-Admin-Merkmal sichtbar: Gemeinden verwalten
(`AdminOrganizationsPage.tsx`, `OrganizationManagementModal.tsx`) und der
Betriebs-Überblick (`AdminMetricsPage.tsx`). Eine Gemeinde legt allein der
Super-Admin an, über das Formular in der App
([betrieb/gemeinde-anlegen.md](../betrieb/gemeinde-anlegen.md)); Anfragen
kommen per Mail.

## Entschieden (Simon, 02.10.2026)

1. **Moderne Web-Version.** Eine web-typische Oberfläche, die sich im Browser
   nativ anfühlt: Navigation als ein- und ausklappbare Leiste links statt der
   Reiterleiste unten. Sie ergänzt E-09 (Sprache und Barrierefreiheit der
   Web-Variante).
2. **Eine Support-Ansicht in dieser Web-Version.** Verwaltung (Frage 3) und
   Support-Dashboard (Frage 9) sind eine Ansicht, kein getrenntes Werkzeug.
   Sie ist für Simon und eine Support-Person. Ausgangspunkt ist ein
   Super-Admin-Konto ohne Gemeinde.
3. **Gemeinde zuerst.** Angelegt wird eine Gemeinde; Kirchenkreis und
   Landeskirche sind Zuordnungen an ihr, vor allem für Statistiken je
   Landeskirche, je Kirchenkreis und je Gemeinde. Alles andere geschieht
   weiter in der Gemeinde. Verwaltungsrechte für die oberen Ebenen gibt es
   nicht (E-26 entfällt).
4. **Anfrageformular auf der Homepage.** Die verantwortliche Person trägt auf
   konfi-quest.de alles ein, was zum Anlegen nötig ist. Jede Anfrage landet
   in der Support-Ansicht und lässt sich dort mit wenigen Schritten in eine
   Gemeinde samt Zuordnung und erster Gemeindeleitung umwandeln. Das ersetzt
   den Antragsweg aus E-03.
5. **Support verwaltet nur Gemeindeleitungen.** Die Support-Ansicht legt
   Gemeindeleitungen (Org-Admins) an und betreut sie; alle übrigen Konten
   verwaltet die Gemeinde selbst, wie heute.
6. **Kennzahlen.** „Saubere Auswertung zu Anzahl der User etc." gehört in
   dieselbe Ansicht (E-20).
7. **Professioneller Support.** Simon: „support gerne möglichst
   professionell" — Anfragen, Mails und Verwaltung an einer Stelle (E-04,
   E-18).
8. **Einwilligung der Eltern bleibt in den Gemeinden.** Keine Bestätigung per
   Eltern-Mail in der App; die Gemeinde holt sie ein (analog oder mit ihrem
   Anmeldeformular). konfi-quest.de stellt eine Vorlage bereit.
9. **Bauweise: dieselbe App mit breitem Layout** (Simon, 02.10.2026). Die
   bestehende App bekommt für breite Bildschirme eine ein- und ausklappbare
   Leiste links statt der Reiterleiste unten. Eine Codebasis; die Apps auf
   iPhone und Android bleiben, wie sie sind. Ionic bringt dafür
   `IonSplitPane` und `IonMenu` mit, heute ungenutzt. Die API bleibt eine;
   neue Routen und Felder nur additiv.
10. **Die Support-Person hat dieselben Rechte wie ein Super-Admin** (Simon,
    02.10.2026) — kein eigenes, engeres Merkmal.
11. **Super-Admin mit und ohne Gemeinde** (Simon, 02.10.2026: „Ohne Gemeinde
    eigentlich gut einmal prüfen, was das heißt. Es soll ja beides gehen."):
    Ein Super-Admin kann Mitglied in Gemeinden sein (wie heute) oder ein
    Support-Konto ganz ohne Gemeinde haben. Wie das technisch geht, wird am
    Code geprüft (unten, „Offen").

## Vorschlag

Noch nicht mit Simon abgestimmt, abgeleitet aus den Punkten oben.

- **Felder des Anfrageformulars:** Gemeinde, Kirchenkreis, Landeskirche,
  verantwortliche Person, Funktion, E-Mail, Mobilnummer, ungefähre Zahl der
  Nutzer:innen, ungefähre Zahl der Teamer:innen, gewünschter Start, Zahl der
  Jahrgänge, Freitext, Zustimmung zu Nutzungsbedingungen und
  Datenschutzerklärung.
- **Fälle statt Postfach:** Jede Anfrage und jede Support-Mail ist ein Fall
  mit Status *neu*, *in Arbeit*, *wartet*, *erledigt*; Antwort per Mail aus
  der Ansicht heraus, mit Textbausteinen; je Gemeinde ein Verlauf aller Fälle.
- **Umwandeln einer Anfrage:** ein Schritt, der das heutige Formular
  vorbefüllt (Name, Kirchenkreis, Kontakt, Laufzeit, Konfi-Limit) und die
  erste Gemeindeleitung mit anlegt — wie `POST /organizations` heute, in einer
  Transaktion.
- **Statistik:** Gemeinden, Konten je Rolle, aktive Konten, Jahrgänge,
  Speicher — je Gemeinde und zusammengefasst je Kirchenkreis und
  Landeskirche, ohne Namen.

## Was es heute gibt

Am Code geprüft am 02.10.2026.

**Super-Admin** ist ein Merkmal am Konto (`users.is_super_admin`), keine
eigene Rolle. `requireSuperAdmin` (`backend/middleware/rbac.js`) antwortet
ohne das Merkmal mit 403. Die heutigen Super-Admin-Konten sind
Gemeindeleitungen mit Merkmal in ihrer Stamm-Gemeinde.

Routen in `backend/routes/organizations.js` (eingehängt unter
`/api/organizations`):

| Route | Wer | Was |
|---|---|---|
| `GET /` | Super-Admin | alle Gemeinden |
| `GET /search-users` | Super-Admin | Konten systemweit suchen |
| `POST /` | Super-Admin | Gemeinde samt erster Gemeindeleitung anlegen, in einer Transaktion (Rollen, Badges, Level, Kategorien, Aktivitäten, Beispiel-Challenges) |
| `PUT /:id` | Super-Admin oder Gemeindeleitung der eigenen Gemeinde | Stammdaten und Kirchenkreis; Laufzeit und Testphase nur Super-Admin |
| `PATCH /:id/limit` | Super-Admin | Konfi-Limit |
| `DELETE /:id` | Super-Admin | Gemeinde löschen |
| `GET /:id/members`, `POST /:id/members`, `DELETE /:id/members/:userId` | Super-Admin | Mitglieder und Zuweisungen über Gemeindegrenzen, mit Rolle |
| `GET /:id/users`, `GET /:id/admins`, `POST /:id/admins` | Super-Admin oder Gemeindeleitung der eigenen Gemeinde | Konten der Gemeinde, Gemeindeleitungen anlegen |
| `GET /current`, `GET /:id`, `GET /:id/stats` | Super-Admin oder Team der Gemeinde | Gemeinde lesen, Kennzahlen |

Dazu `GET /api/metrics`, `/api/metrics/history` und `/api/metrics/local`
(nur Super-Admin, `backend/createApp.js`): Serverzeiten, Fehler,
Lastverteilung je Replica.

**Daten:** `organizations` kennt `kirchenkreis` als Freitext (Migration 086),
dazu Ansprechperson, E-Mail, Telefon, Adresse, Website, Laufzeit
(`trial_ends_at`, `is_trial`) und `max_konfis`. Eine Landeskirche, Anfragen
oder Support-Fälle gibt es im Schema nicht. Mails verschickt
`backend/services/emailService.js`; eingehende Mails verarbeitet nichts.

## Offen

- **Konto ohne Gemeinde — wie genau.** Entschieden ist, dass beides gehen
  soll (Punkt 11). Am Code geprüft am 03.10.2026 (`main` 4cc24f0e):
  - **Der Code ist halb darauf vorbereitet.** `rbac.js` und die Anmeldung
    rechnen schon mit `organization_id` NULL (`LEFT JOIN`), und es gibt
    einen gemeindefremden Navigationsbaum `super_admin` (`rollenBaeume.ts`),
    seit 1.5.3 in allen ausgelieferten Apps.
  - **NULL fällt fast überall sicher aus.** `req.user.organization_id` steht
    519-mal in 30 Dateien, praktisch immer mit `=` verglichen: NULL trifft
    nichts, das Ergebnis ist eine leere Liste oder 404. Die Rolle
    `super_admin` steht in keiner Rollenliste von `requireAdmin`,
    `requireTeamer`, `requireOrgAdmin` und bekommt dort 403. Keine Stelle
    liefert bei NULL Daten fremder Gemeinden.
  - **Rund acht Stellen rechnen falsch**, wo mit `<>` oder `= Spalte`
    verglichen wird. Die wichtigsten: `PUT /users/:id/reset-password` meldet
    Erfolg und ändert nichts (`WHERE … organization_id = $3`); ein Gast ohne
    Gemeinde fehlt in der Benutzerliste der Gemeinde (`users.js`,
    `u.organization_id <> $1`); `POST /chat/rooms` endet mit 500 (NOT NULL
    in `chat_rooms`). Zu beheben mit `IS DISTINCT FROM`, `COALESCE` und einer
    Prüfung von `rowCount`.
  - **Das Frontend bekommt `organization_id` vom Server nie** (weder Login
    noch `/auth/me`); seine 33 Lesestellen kommen schon heute mit
    `undefined` aus.
  - **Alte Apps (1.5.3 bis 2.3.0)** landeten mit einem solchen Konto in der
    verkleinerten Ansicht „Gemeinden" — ohne Abmelden-Knopf. Sie zeigen aber
    bei `error_code` `user_inactive` den Text des Servers wörtlich. Die
    Anmeldung lässt sich dort also sauber abweisen: Konten ohne Gemeinde
    melden sich nur an, wenn der Client ein neues Feld (`kann_ohne_gemeinde`)
    schickt; sonst 403 mit Hinweis auf die Web-Version und einem neuen Feld
    `grund`. Das ist Bedienkomfort, keine Sicherheitsgrenze — die Rechte
    hält weiter `rbac.js`.
  - **Variante „versteckte Betriebs-Gemeinde"** käme heute ohne Code aus,
    müsste aber an mindestens neun Stellen ausgeblendet oder geschützt
    werden (Gemeindeliste, Löschen — sonst würden Support-Konten gelöscht
    oder in eine echte Gemeinde umgezogen —, Sperre und Testphase,
    Umschalter, Einladungen, Seeds beim Start, Hintergrundläufe, Suche) und
    in jeder künftigen Auswertung über alle Gemeinden. Die geplanten
    Statistiken je Kirchenkreis und Landeskirche machen das zum
    Dauerrisiko.

  **Empfehlung:** `users.organization_id` nullable mit
  `CHECK (organization_id IS NOT NULL OR is_super_admin)`, eine
  gemeindefreie Systemrolle `super_admin` (eine Zeile in `roles`), die acht
  Stellen beheben, alte Apps bei der Anmeldung abweisen. Für bestehende
  Konten ändert sich keine Antwortform. Reihenfolge additiv: erst die
  Stellen im Backend beheben (ohne Schemawechsel, einzeln auslieferbar),
  dann die Migration, dann Routen zum Anlegen, Sperren und Löschen von
  Support-Konten (heute gibt es dafür keinen Weg außer
  `scripts/ersteinrichtung.js`), dann die Oberfläche (Abmelden im Baum
  `super_admin`, Rückweg „ohne Gemeinde"). Vorher in Produktion lesend
  messen, ob es schon globale Rollen oder Rollen `super_admin` gibt.

  Nebenbei gefunden: Bei der Anmeldung überspringt ein Super-Admin die
  Prüfung auf ein gesperrtes Konto, `rbac.js` aber nicht — ein gesperrtes
  Super-Admin-Konto bekommt beim Login 200 und danach bei jeder Anfrage 401.
- **Datenmodell Kirchenkreis und Landeskirche.** Eigene Tabellen mit
  Zuordnung an der Gemeinde; der Freitext `kirchenkreis` bleibt, bis die
  Bestände übertragen sind (Migration additiv). Die bestehenden Gemeinden,
  auch der Dom Schwerin, werden eingeordnet.
- **Anfragen.** Öffentlicher Endpunkt mit eigener Grenze gegen Missbrauch,
  Bestätigungsmail, Datenschutzhinweis am Formular, Aufbewahrungsfrist
  abgelehnter Anfragen.
- **Mails im Support.** Ob eingehende Mails (etwa an die Kontaktadresse) in
  der Ansicht landen sollen und auf welchem Weg.
- **Statistik.** Welche Kennzahlen, und ab welcher Größe eine Zahl
  ausgewiesen wird (kleine Gemeinden sind sonst personenbezogen, wie bei der
  Nutzungsmessung, [messung/umami.md](../messung/umami.md)).
- **Einwilligung am Profil.** Ein Vermerk „Einwilligung liegt vor" am
  Konfi-Profil, den nur die Leitung sieht. Simons Gedanke: „kann ja mit in
  das konfiprofil bzw. die anwesenheitsmatrix" (E-01). Dazu die Vorlage auf
  der Homepage.
- **Doku.** Das Handbuch richtet sich an Gemeinden; ein Betriebs-Kapitel gibt
  es nicht (Simon, 27.09.2026). Die Support-Ansicht beschreibt deshalb
  `docs/betrieb/`, neben [gemeinde-anlegen.md](../betrieb/gemeinde-anlegen.md).

## Was beim Bauen gilt

Die Regeln aus [CLAUDE.md](../../CLAUDE.md): ausgelieferte Apps nie brechen,
Migrationen additiv, „Mitteilung = Sichtbarkeit" mit einer Regel-Stelle je
Vorgang, Tests für den verbotenen und den erlaubten Fall, CHANGELOG, Handbuch
und API-Doku im selben Commit.
