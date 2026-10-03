# Anfragen bearbeiten und die Struktur pflegen

Für den Betrieb von Konfi Quest: wie eine Gemeinde über das Formular auf
konfi-quest.de anfragt, wie der Support die Anfrage bearbeitet und in eine
Gemeinde umwandelt, wie lange sie bleibt, wie Landeskirchen und Kirchenkreise
gepflegt werden und was die Statistik zählt. Grundlage sind Simons
Entscheidungen vom 02.10.2026
([planung/web-version.md](../planung/web-version.md), Punkte 3 bis 7). Belegt
am Code (`backend/routes/anfragen.js`, `backend/routes/support.js`,
`backend/utils/gemeindeAnlegen.js`, `backend/utils/kirchenkreisZuordnung.js`,
`backend/services/backgroundService.js`, Migration
`191_landeskirchen_kirchenkreise_anfragen.sql`) und an den Tests `anfragen`,
`support`, `gemeindeAnlegenGemeinsam` (`backend/tests/routes/`) und
`anfragenAufraeumen` (`backend/tests/services/`).

Alles unter `/api/support` dürfen nur **Super-Admins** — Simons Konto in
seiner Gemeinde wie ein [Support-Konto ohne Gemeinde](support-konto.md). Die
Gemeindeleitung und alle anderen bekommen 403. Die Routen im Einzelnen stehen
in der API-Doku (`docs/api/verwaltung-auth.yaml`, Abschnitt „Support").

## Eine Anfrage kommt an

Die verantwortliche Person einer Gemeinde füllt das Formular auf
konfi-quest.de aus. Pflicht sind **Gemeinde, Name und E-Mail-Adresse** und
das Häkchen zur Einwilligung; dazu können Kirchenkreis, Landeskirche,
Funktion, Mobilnummer, die ungefähre Zahl der Konfis und der Teamer:innen und
eine Nachricht kommen. Der Server (`POST /api/anfragen`, ohne Anmeldung)
speichert die Anfrage mit dem Status **neu** und dem Zeitpunkt der
Einwilligung.

Danach gehen zwei Mails hinaus:

- **an die anfragende Adresse** eine Bestätigung mit festem Text — ohne
  irgendeine Eingabe aus dem Formular. Das Formular ist öffentlich; mit
  eingesetzten Feldern ließe sich über unseren Server beliebiger Text an
  fremde Adressen schicken.
- **an jedes aktive Super-Admin-Konto mit E-Mail-Adresse** ein Hinweis mit
  Kennung, Gemeinde, Kirchenkreis und Landeskirche — ohne Kontaktdaten und
  ohne Nachricht. Die stehen in der Support-Ansicht.

Scheitert eine Mail, bleibt die Anfrage gespeichert. Im Server-Protokoll
steht nur „Gemeinde-Anfrage 12 eingegangen" und bei Fehlern die Kennung mit
dem Fehlercode — keine Daten der Anfrage.

**Gegen Missbrauch:** Höchstens 5 angenommene Anfragen je Stunde von einer
Verbindung (Client-IP) und 3 je Tag für dieselbe E-Mail-Adresse, danach
antwortet der Server mit 429 und dem Hinweis auf moin@konfi-quest.de. Ein
unsichtbares Feld (`website`) fängt Programme ab: Ist es gefüllt, bekommt der
Absender dieselbe Antwort wie ein Mensch, gespeichert und verschickt wird
nichts.

## Eine Anfrage bearbeiten

In der Support-Ansicht (`GET /api/support/anfragen`, neueste zuerst, nach
Status filterbar) steht jede Anfrage mit allen Angaben. Der Status zeigt, wo
sie steht:

| Status | Bedeutung |
|---|---|
| neu | eingegangen, noch niemand dran |
| in Arbeit | jemand hat sich gemeldet, Rückfragen laufen |
| angelegt | die Gemeinde ist eingerichtet |
| abgelehnt | wird nichts; nach 180 Tagen gelöscht |

Status und eine interne **Notiz** setzt `PATCH /api/support/anfragen/<id>`;
die Notiz sieht nur der Support. Gespeichert wird dazu, welches Konto zuletzt
etwas geändert hat. Ändert sich der Status, beginnt die Frist für abgelehnte
Anfragen neu; derselbe Status noch einmal lässt sie stehen. Eine Anfrage, aus
der eine Gemeinde entstanden ist, bleibt „angelegt" (409), ihre Notiz lässt
sich weiter ändern.

## Eine Anfrage in eine Gemeinde umwandeln

Ein Schritt legt Gemeinde und erste Gemeindeleitung an:
`POST /api/support/anfragen/<id>/anlegen` mit Name der Gemeinde, Kontakt,
Laufzeit, Konfi-Limit, Kirchenkreis (`kirchenkreis_id`) und den Zugangsdaten
der ersten Gemeindeleitung (Benutzername, Name, E-Mail, Passwort). Die
Oberfläche füllt das aus der Anfrage vor.

- **Dieselbe Anlage wie „Gemeinde anlegen"** in der App
  ([gemeinde-anlegen.md](gemeinde-anlegen.md)): dieselben Rollen und
  Vorlagen, derselbe Systemname (Umlaute als ae/oe/ue/ss), dieselben Regeln
  für Benutzername, Passwort, Laufzeit (ohne Angabe 30 Tage Testphase) und
  Konfi-Limit, dieselben Fehlermeldungen. Beide Wege rufen dieselbe Funktion.
- **Ganz oder gar nicht:** Gemeinde, Gemeindeleitung und der Status der
  Anfrage („angelegt", mit Verweis auf die Gemeinde) entstehen in einer
  Transaktion. Scheitert etwas, bleibt die Anfrage, wie sie war, und von der
  Gemeinde steht nichts.
- **Kirchenkreis** nur als Zuordnung (`kirchenkreis_id`); was die Gemeinde im
  Formular als Kirchenkreis und Landeskirche getippt hat, steht in der Anfrage
  und wird nicht übernommen. Gibt es den Kirchenkreis noch nicht, erst
  [anlegen](#landeskirchen-und-kirchenkreise-pflegen).
- Ein zweites Mal geht nicht (409): Aus einer Anfrage entsteht eine Gemeinde.

Benutzername und Passwort der Gemeindeleitung danach wie gewohnt auf sicherem
Weg weitergeben ([gemeinde-anlegen.md](gemeinde-anlegen.md), „Was danach
passiert").

## Landeskirchen und Kirchenkreise pflegen

Gemeinde zuerst (Entscheidung 3): Kirchenkreis und Landeskirche sind
Zuordnungen an der Gemeinde, vor allem für die Statistik. Verwaltungsrechte
für die oberen Ebenen gibt es nicht.

- **Landeskirchen** (`/api/support/landeskirchen`): anlegen, umbenennen,
  löschen. Der Name ist eindeutig, ohne Unterschied zwischen Groß- und
  Kleinschreibung. Löschen geht nur, wenn kein Kirchenkreis mehr daran hängt.
- **Kirchenkreise** (`/api/support/kirchenkreise`): anlegen, umbenennen,
  einer Landeskirche zuordnen oder lösen, löschen. Eindeutig je Landeskirche
  und Name (ohne Groß/klein), auch unter denen ohne Landeskirche. Die Liste
  nennt, wie viele Gemeinden zugeordnet sind.
- **Zuordnung an der Gemeinde** über `PUT /api/organizations/<id>` mit
  `kirchenkreis_id` (nur Super-Admin; `null` hebt sie auf). Die Landeskirche
  folgt aus dem Kirchenkreis.

**Die alte Textspalte.** Die Apps bis 2.3.0 kennen nur den Freitext
`organizations.kirchenkreis`. Damit sie weiter das Richtige zeigen, steht
dort immer der Name des zugeordneten Kirchenkreises: beim Zuordnen, beim
Umbenennen des Kirchenkreises für alle seine Gemeinden, beim Lösen und Löschen
wird er leer. Schickt eine alte App beim Speichern einer Gemeinde einen
anderen Text, gilt der Text, und die Zuordnung endet — derselbe Text (ohne
Groß/klein) lässt sie stehen.

**Übernahme der vorhandenen Angaben** (Migration 191, einmal beim Deploy):
Jeder Freitext wird ein Kirchenkreis ohne Landeskirche, gleiche
Schreibweisen ohne Groß/klein und Randleerzeichen werden einer, und die
Gemeinden werden verknüpft. Danach die Kirchenkreise in der Support-Ansicht
ihrer Landeskirche zuordnen, Tippvarianten zusammenführen (Gemeinden dem
richtigen Kirchenkreis zuordnen, den doppelten löschen) und Gemeinden ohne
Angabe einordnen — auch den Dom Schwerin.

Vor dem Deploy in Produktion lesend prüfen, welche Kirchenkreise entstehen:

```sql
SELECT id, display_name, kirchenkreis FROM organizations ORDER BY id;
SELECT lower(btrim(kirchenkreis)) AS k, COUNT(*) FROM organizations
 WHERE NULLIF(btrim(kirchenkreis), '') IS NOT NULL GROUP BY 1 ORDER BY 1;
```

## Die Statistik lesen

`GET /api/support/statistik` liefert je Gemeinde — auch gesperrte und solche
ohne Konten — die Zuordnung zu Kirchenkreis und Landeskirche, die Konten je
Rolle (Konfis, Teamer:innen, Leitung, Gemeindeleitung), wie viele davon in den
letzten 30 Tagen aktiv waren, und die Zahl der Jahrgänge. Zusammengefasst je
Kirchenkreis und Landeskirche wird in der Oberfläche. **Namen von Personen
stehen nicht darin.**

Was gezählt wird:

- **beide Quellen der Zugehörigkeit**, mit der Rolle in dieser Gemeinde: wer
  in einer weiteren Gemeinde mitarbeitet, zählt dort mit seiner Rolle dort;
  steht jemand in seiner Stamm-Gemeinde doppelt, zählt er einmal;
- **nicht** gelöschte und gesperrte Konten, **nicht** Support-Konten ohne
  Gemeinde — auch nicht dort, wo sie Gast sind;
- **aktiv** heißt: angemeldet oder die Anmeldung verlängert (die App tut das
  bei jedem Start) in den letzten 30 Tagen; wer in zwei Gemeinden mitarbeitet,
  zählt in beiden;
- Kirchenkreis und Landeskirche aus der Zuordnung, nicht aus dem Freitext.

## Aufbewahrung

Festgehalten in der Datenschutzerklärung, Abschnitt 9c
(`frontend/public/datenschutz.html`); `datenschutzGegenCode.test.ts` hält
Text und Code zusammen.

| Stand der Anfrage | Wie lange |
|---|---|
| neu, in Arbeit | bis zur Entscheidung |
| abgelehnt | **180 Tage nach der Ablehnung**, dann löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupAbgelehnteAnfragen`, gezählt ab `status_seit`, nicht ab dem Eingang) |
| angelegt | solange die Gemeinde besteht; mit der Gemeinde wird die Anfrage gelöscht |

Möchte jemand die Löschung vorher, wird die Anfrage abgelehnt und — bis es
dafür einen Knopf gibt — in der Datenbank gelöscht
(`DELETE FROM gemeinde_anfragen WHERE id = …`). Den Zähler gegen Missbrauch
hält der Server je IP-Adresse eine Stunde, je E-Mail-Adresse einen Tag (als
Prüfwert, nicht die Adresse) und löscht ihn danach binnen gut einer Stunde.
