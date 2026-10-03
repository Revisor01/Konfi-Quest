# Ein Support-Konto anlegen

Für den Betrieb von Konfi Quest: was ein Support-Konto ist, wer es anlegt,
wie es sich anmeldet, wie es als Gast in eine Gemeinde kommt und wie es
gesperrt oder gelöscht wird. Grundlage sind Simons Entscheidungen vom
02. und 03.10.2026 ([planung/web-version.md](../planung/web-version.md),
Punkt 10 bis 15). Belegt am Code (`backend/routes/supportKonten.js`,
`backend/routes/auth.js`, Migration `190_konto_ohne_gemeinde.sql`) und an den
Tests `supportKonten`, `kontoOhneGemeinde` und `kontoOhneGemeindeAnmeldung`
(`backend/tests/routes/`).

## Was ein Support-Konto ist

Ein Konto **ohne Gemeinde** für die Support-Person (und für Simon, wenn er
ohne Gemeinde arbeiten will). Es hat dieselben Rechte wie jeder Super-Admin:
Gemeinden anlegen, ändern, sperren und löschen, Mitglieder über
Gemeindegrenzen eintragen, Betriebs-Überblick. In einer Gemeinde selbst — Konfis,
Termine, Chats — sieht es nichts, solange es dort nicht Gast ist.

Technisch: `users.organization_id` ist leer, die Rolle ist die gemeindefreie
Systemrolle `super_admin`, das Merkmal `is_super_admin` ist gesetzt. Die
Datenbank lässt ein Konto ohne Gemeinde nur mit diesem Merkmal zu.

Simons eigenes Konto bleibt, wie es ist: Gemeindeleitung in seiner Gemeinde
mit Super-Admin-Merkmal. Das Support-Konto ist ein zweites, eigenes Konto.

## Voraussetzung: Migration 190

Die Systemrolle und die Spalte ohne Pflichtwert bringt Migration 190. Vor dem
ersten Deploy mit dieser Migration in Produktion lesend prüfen:

```sql
-- Gibt es schon Rollen ohne Gemeinde oder Rollen super_admin?
SELECT id, organization_id, name, display_name FROM roles
 WHERE organization_id IS NULL OR name = 'super_admin';

-- Doppelte Benutzernamen (ohne Groß/klein)?
SELECT LOWER(username) AS name, COUNT(*) FROM users
 GROUP BY 1 HAVING COUNT(*) > 1;
```

Zwei Rollen `super_admin` ohne Gemeinde ließen die Migration scheitern (sie
rollt dann ganz zurück, `GET /api/status` meldet es); eine einzelne wird
übernommen. Doppelte Benutzernamen stören die Migration nicht, aber die
Anmeldung findet dann nur eines der Konten.

## Anlegen

Nur ein **Super-Admin**. Eine Oberfläche dafür gibt es noch nicht (sie kommt
mit der Support-Ansicht); bis dahin über die API, mit dem Zugangs-Token eines
Super-Admin-Kontos:

```
POST /api/organizations/support-konten
{ "username": "…", "display_name": "…", "password": "…", "email": "…" }
```

- **Benutzername:** 3 bis 50 Zeichen, Buchstaben, Ziffern, Punkt, Bindestrich;
  im ganzen System frei, ohne Unterschied zwischen Groß- und Kleinschreibung
  (sonst 409 „Benutzername existiert bereits (muss systemweit eindeutig
  sein)").
- **Passwort:** nach der Richtlinie (8 Zeichen, Groß- und Kleinbuchstabe,
  Ziffer, Sonderzeichen, keine Leerzeichen).
- **E-Mail:** freiwillig; dorthin geht „Passwort vergessen".

`GET /api/organizations/support-konten` listet alle Support-Konten mit den
Gemeinden, in denen sie Gast sind.

Benutzername und Passwort auf einem sicheren Weg weitergeben — nicht beides in
derselben Mail. Nach der ersten Anmeldung das Passwort ändern.

**Auf einer neuen Instanz** gibt es noch kein Super-Admin-Konto, das ein
anderes anlegen könnte. Dafür legt `scripts/ersteinrichtung.js` im
Backend-Container das erste Support-Konto an — ohne Gemeinde, mit denselben
Regeln für Benutzername und Passwort, nur auf einer leeren Datenbank. Aufruf
und Ablauf: [init-scripts/README.md](../../init-scripts/README.md),
„Ablauf bei einer Neuinstallation", Schritt 4. Danach im Browser anmelden und
die Gemeinden anlegen.

## Anmelden — nur im Browser

Ein Support-Konto meldet sich in der **Web-Version** an (konfi-quest.de).
Die Apps auf iPhone und Android weisen es ab, alte wie neue: Die Store-App
2.3.0 und neuer zeigt „Dieses Konto gehört zu keiner Gemeinde und ist für die
Support-Ansicht im Browser bestimmt. Bitte melde dich auf konfi-quest.de an.",
die Versionen bis 2.2 zeigen bei jeder Ablehnung „Keine Verbindung zum
Server". Abgewiesen sind beide.

## Als Gast in eine Gemeinde

Nur auf ausdrücklichen Schritt und für die Gemeinde sichtbar: Ein Super-Admin
trägt das Support-Konto als **Gemeindeleitung** in die Gemeinde ein — in der
App unter „Gemeinden verwalten" › Gemeinde › „Mitglieder & Zuweisungen"
(Suche nach dem Benutzernamen), über die API mit
`POST /api/organizations/<id>/members` und `{ "user_id": …, "role_name":
"org_admin" }`.

Danach steht das Konto in der Benutzerliste der Gemeinde (Mehr ›
Benutzer:innen) als Gemeindeleitung aus einer weiteren Gemeinde. Wechseln
kann es dorthin über `POST /api/auth/switch-org`; einen Umschalter hat die
Oberfläche eines Kontos ohne Gemeinde noch nicht (sie zeigt nur „Gemeinden
verwalten" und den Betriebs-Überblick), er kommt mit der Support-Ansicht.
Bearbeiten kann
es dort nur ein Super-Admin. Herausnehmen geht über denselben Abschnitt
„Mitglieder & Zuweisungen" (`DELETE /api/organizations/<id>/members/<userId>`)
— oder die Gemeindeleitung tut es selbst unter Mehr › Benutzer:innen
(„Mitgliedschaft beenden", `DELETE /api/users/<id>`; Simon, 03.10.2026). In
beiden Fällen endet nur die Mitgliedschaft in dieser Gemeinde, das
Support-Konto bleibt.
Wird die Gemeinde gelöscht, endet die Mitgliedschaft; das Support-Konto
bleibt.

## Sperren, Passwort setzen, löschen

| Was | Route (nur Super-Admin) | Wirkung |
|---|---|---|
| Sperren | `PATCH /api/organizations/support-konten/<id>` mit `{ "is_active": false }` | Anmeldung und Refresh 403; alle Sitzungen enden sofort (Zugangs- und Refresh-Tokens, Push-Tokens) |
| Entsperren | dieselbe Route mit `{ "is_active": true }` | Anmeldung wieder möglich |
| Passwort setzen | `PUT /api/organizations/support-konten/<id>/passwort` mit `{ "password": "…" }` | alle Sitzungen enden; eine Sperre nach Fehlversuchen endet; keine Mail |
| Löschen | `DELETE /api/organizations/support-konten/<id>` | dieselbe Kontolöschung wie überall: Gast-Mitgliedschaften, Chats, Mitteilungen |

Die Routen greifen nur auf Konten ohne Gemeinde zu; ein Konto mit Gemeinde
ist dort „nicht gefunden" (404) und wird in seiner Gemeinde verwaltet.

**Das letzte aktive Super-Admin-Konto bleibt.** Es lässt sich weder sperren
noch löschen, auch nicht über „Konto löschen" im eigenen Profil (409). Gezählt
werden alle aktiven Konten mit Super-Admin-Recht, mit und ohne Gemeinde —
solange Simons Konto aktiv ist, ist ein Support-Konto also nie das letzte.
