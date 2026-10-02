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
  soll (Punkt 11). `users.organization_id` ist `NOT NULL`. Möglich sind eine
  nullable Spalte — dann jede Stelle, die die Gemeinde des Kontos liest
  (Token, `rbac.js`, Umschalter, Zähler, Cron-Jobs), absichern — oder eine
  versteckte technische Gemeinde. Die Prüfung am Code läuft (02.10.2026);
  ihr Ergebnis kommt hierher. Ausgelieferte Apps dürfen daran nicht brechen
  (CLAUDE.md).
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
