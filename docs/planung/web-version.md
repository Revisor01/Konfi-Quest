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
12. **Konto ohne Gemeinde: die Gemeinde am Konto wird optional** (Simon,
    03.10.2026, nach der Prüfung unten): `users.organization_id` nullable,
    nur für Super-Admins, mit einer gemeindefreien Systemrolle — keine
    versteckte Betriebs-Gemeinde.
13. **Support arbeitet nur im Browser.** Meldet sich ein Konto ohne Gemeinde
    in einer App an, alt oder neu, kommt ein klarer Hinweis auf die
    Support-Ansicht im Browser.
14. **Support darf als Gast in eine Gemeinde**, nur auf ausdrücklichen
    Schritt und für die Gemeinde sichtbar: Das Konto steht dann als
    Gemeindeleitung in ihrer Benutzerliste, solange es eingetragen ist.
15. **Simons eigenes Konto bleibt, wie es ist** (Gemeindeleitung in seiner
    Gemeinde mit Super-Admin-Merkmal). Das Support-Konto ist ein zweites,
    eigenes Konto.

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

**Super-Admin** ist ein Merkmal am Konto (`users.is_super_admin`).
`requireSuperAdmin` (`backend/middleware/rbac.js`) antwortet ohne das
Merkmal mit 403. Die heutigen Super-Admin-Konten sind Gemeindeleitungen mit
Merkmal in ihrer Stamm-Gemeinde; Support-Konten ohne Gemeinde tragen dazu die
Systemrolle `super_admin` (unten, Konto ohne Gemeinde).

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
| `GET /support-konten`, `POST /support-konten`, `PATCH /support-konten/:id`, `PUT /support-konten/:id/passwort`, `DELETE /support-konten/:id` | Super-Admin | Support-Konten ohne Gemeinde (seit 03.10.2026) |

Dazu seit dem 03.10.2026 `POST /api/anfragen` (öffentlich, das
Anfrageformular) und unter `/api/support` (nur Super-Admin) Anfragen,
Landeskirchen, Kirchenkreise und Statistik — unten, „Support-Ansicht,
Backend".

Dazu `GET /api/metrics`, `/api/metrics/history` und `/api/metrics/local`
(nur Super-Admin, `backend/createApp.js`): Serverzeiten, Fehler,
Lastverteilung je Replica.

**Konto ohne Gemeinde** (gebaut am 03.10.2026, Entscheidungen 12 bis 15;
Betrieb: [betrieb/support-konto.md](../betrieb/support-konto.md)):

- **Schema** (Migration 190): `users.organization_id` ist nullable, aber nur
  für Super-Admins (`CHECK (organization_id IS NOT NULL OR is_super_admin
  IS TRUE)`); dazu die gemeindefreie Systemrolle `super_admin` (eine Zeile in
  `roles`, eindeutig über einen partiellen Index). Sie steht in keiner
  Rollenliste einer Gemeinde und lässt sich dort nicht vergeben.
- **Routen** `/api/organizations/support-konten` (nur Super-Admin): auflisten
  mit Gast-Gemeinden, anlegen (Benutzername systemweit eindeutig, Passwortregeln
  wie überall), sperren und entsperren (beendet alle Sitzungen), Passwort
  setzen, löschen (gemeinsame Kontolöschung). Das letzte aktive
  Super-Admin-Konto lässt sich weder sperren noch löschen, auch nicht über
  die Selbstlöschung.
- **Anmeldung nur im Browser:** Ein Konto ohne Gemeinde meldet sich nur an,
  wenn der Client `kann_ohne_gemeinde: true` schickt — das tut allein die
  Web-Version, bei Anmeldung und Refresh. Sonst 403 `user_inactive` mit
  `grund: konto_ohne_gemeinde` und dem Hinweis auf konfi-quest.de. Die
  Store-App 2.3.0 zeigt diesen Text; 1.5.3 bis 2.2.x zeigen bei jeder
  Ablehnung „Keine Verbindung zum Server" (Fehler ihrer Anmeldeseite) und
  sind trotzdem abgewiesen. Bedienkomfort, keine Sicherheitsgrenze — die
  Rechte hält `rbac.js`.
- **Als Gast in einer Gemeinde** über `POST /organizations/:id/members`
  (Super-Admin, Rolle Gemeindeleitung): Die Gemeinde sieht das Konto in ihrer
  Benutzerliste als Gemeindeleitung aus einer weiteren Gemeinde; bearbeiten
  oder entfernen kann es dort nur ein Super-Admin. Gemeindewechsel und
  Rückweg über `switch-org` und den Refresh wie bei jedem Konto.
- **Behoben auf dem Weg:** die acht Stellen, die bei `organization_id` NULL
  falsch rechneten (Benutzerliste, Detail, Hierarchieprüfung, Rückblick,
  Passwort setzen, `POST /chat/rooms`, `is_primary`), und die Anmeldung
  eines gesperrten Super-Admin-Kontos (Login 200, danach jede Anfrage 401).
  Für bestehende Konten ändert sich keine Antwortform (Vertragstest).

**Support-Ansicht, Backend** (gebaut am 03.10.2026, Entscheidungen 3 bis 7;
Betrieb: [betrieb/support-ansicht.md](../betrieb/support-ansicht.md); die
Oberfläche baut das Paket C gegen dieselben Routen):

- **Daten** (Migration 191): `landeskirchen`, `kirchenkreise` (Landeskirche
  darf fehlen), `organizations.kirchenkreis_id`; die vorhandenen Freitexte
  sind als Kirchenkreise ohne Landeskirche übernommen und verknüpft, die
  Textspalte bleibt für die Apps bis 2.3.0 und trägt den Namen des
  zugeordneten Kirchenkreises (`utils/kirchenkreisZuordnung.js`).
  `gemeinde_anfragen` mit den Feldern des Formulars, Status
  neu/in_arbeit/angelegt/abgelehnt, Zeitpunkt der Einwilligung.
- **Anfrageformular** `POST /api/anfragen`: Honigtopf, Pflichtfelder,
  Einwilligung, 5 Anfragen je Stunde und Client-IP, 3 je Tag und
  E-Mail-Adresse; Bestätigung mit festem Text an die Adresse, Hinweis ohne
  Kontaktdaten an die aktiven Super-Admin-Konten; im Protokoll nur die
  Kennung. Abgelehnte Anfragen gehen 180 Tage nach der Ablehnung, angelegte
  mit ihrer Gemeinde (Datenschutzerklärung 9c).
- **Support-Routen** `/api/support`: Anfragen auflisten, Status und Notiz,
  „Anlegen" mit derselben Funktion wie `POST /organizations`
  (`utils/gemeindeAnlegen.js`, in einer Transaktion mit der Anfrage);
  Landeskirchen und Kirchenkreise; Statistik je Gemeinde (Konten je Rolle aus
  beiden Quellen der Zugehörigkeit, aktive Konten in 30 Tagen, Jahrgänge,
  ohne Personennamen, ohne Support-Konten ohne Gemeinde).
- `PUT /organizations/:id` nimmt `kirchenkreis_id` (nur Super-Admin),
  `GET /organizations` liefert `kirchenkreis_id`, `landeskirche_id`,
  `landeskirche` zusätzlich, `POST /organizations` nimmt `kirchenkreis_id`.

**Weitere Daten:** `organizations` trägt Ansprechperson, E-Mail, Telefon,
Adresse, Website, Laufzeit (`trial_ends_at`, `is_trial`) und `max_konfis`.
Support-Fälle über Anfragen hinaus gibt es im Schema nicht. Mails verschickt
`backend/services/emailService.js`; eingehende Mails verarbeitet nichts.

## Offen

- **Oberfläche für Konten ohne Gemeinde.** Das Backend steht (siehe „Was
  es heute gibt", Konto ohne Gemeinde). Es fehlen: Support-Konten in der
  Support-Ansicht anlegen, sperren, mit Passwort versehen und löschen
  (bis dahin über die API, [betrieb/support-konto.md](../betrieb/support-konto.md));
  Abmelden im Navigationsbaum `super_admin`; der Rückweg „ohne Gemeinde"
  nach einem Gemeindewechsel (Refresh ohne Kopfzeile, der Server kann das
  schon). In der Benutzerliste der Gemeinde steht der Support-Gast heute mit
  „zuhause in einer anderen Gemeinde" und Bearbeiten-Knopf, obwohl der
  Server das Bearbeiten mit 403 ablehnt (siehe
  [offene-befunde.md](../offene-befunde.md), „Bearbeiten-Knopf bei
  Super-Admin-Konten"); für eine eigene Kennzeichnung bräuchte `GET /users`
  ein zusätzliches Feld.
- **Bestände einordnen.** Die Tabellen stehen (oben, „Support-Ansicht,
  Backend"); nach dem Deploy die übernommenen Kirchenkreise ihren
  Landeskirchen zuordnen, Tippvarianten zusammenführen und die Gemeinden
  ohne Angabe einordnen, auch den Dom Schwerin
  ([betrieb/support-ansicht.md](../betrieb/support-ansicht.md)).
- **Mails im Support.** Ob eingehende Mails (etwa an die Kontaktadresse) in
  der Ansicht landen sollen und auf welchem Weg.
- **Statistik.** Gebaut sind Konten je Rolle, aktive Konten in 30 Tagen und
  Jahrgänge je Gemeinde, nur für Super-Admins. Offen: weitere Kennzahlen
  (Speicher, Termine) und ob eine Zahl erst ab einer Mindestgröße
  ausgewiesen wird (kleine Gemeinden sind sonst personenbezogen, wie bei der
  Nutzungsmessung, [messung/umami.md](../messung/umami.md)) — heute steht
  jede Zahl da.
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
