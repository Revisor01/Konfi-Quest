# Anfragen bearbeiten und die Struktur pflegen

Für den Betrieb von Konfi Quest: wie eine Gemeinde über das Formular auf
konfi-quest.de anfragt, wie der Support die Anfrage bearbeitet, wie lange sie
bleibt. Grundlage sind Simons Entscheidungen vom 02.10.2026
([planung/web-version.md](../planung/web-version.md), Punkte 3 bis 7). Belegt
am Code (`backend/routes/anfragen.js`, `backend/services/backgroundService.js`,
Migration `191_landeskirchen_kirchenkreise_anfragen.sql`) und an den Tests
`anfragen` (`backend/tests/routes/`) und `anfragenAufraeumen`
(`backend/tests/services/`).

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
