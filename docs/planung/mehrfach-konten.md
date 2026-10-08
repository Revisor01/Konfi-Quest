# Mehrfach-Konten — Gesprächsvorlage

Stand 28.09.2026. Anlass: Simon, 28.09.2026: „Das mit den Multi Accounts
müssen wir besprechen." Grundlage ist die Tabelle „Nachtrag 27.09.2026: Rolle
je Gemeinde" im Bericht `backend-fachlogik-punkte-termine.md` des
Release-Audits (in der Git-Historie, siehe
[docs/README.md](../README.md#befundkennungen)). Hier wird nichts umgebaut;
die Vorlage sammelt, was offen ist, und die Fragen dazu.

**Stand 02.10.2026:** Simon: „mehrfach konten müssen wir nochmals überprüfen
(hier gehts aber im wesentlichen um einzelfälle von teamern in mehrere
gemeinden eventuell mal admins, es muss nur sauber sein und auch admin -
teamer können)". Ziel ist also kein Ausbau, sondern ein sauberer Stand für
diese Einzelfälle — einschließlich Admin in der einen, Teamer:in in der
anderen Gemeinde. Die Prüfung der sieben Punkte unten steht noch aus.

## Was schon gilt

- **Konfi oder Team, nie beides** (28.09.2026, `backend/utils/konfiOderTeam.js`):
  Jeder Weg, der eine Rolle vergibt, lehnt einen Mischzustand ab. Damit sind
  die neun Zeilen der Tabelle erledigt, die nur Konfis einer weiteren Gemeinde
  betreffen oder nur Konfi und Nicht-Konfi trennen.
- **Teamer-Badges und Zertifikate je Gemeinde** (28.09.2026): Anzeige,
  Zählung, Vergabe und Hintergrund-Lauf je aktiver Gemeinde.
- **Auto-Löschung** überspringt Konfi-Konten mit weiterer Gemeinde
  (Altbestand) und protokolliert sie nur mit Kennung.
- **Altbestand gemessen** (01.10.2026, nur lesend, lokaler Agent):
  Konfi-Konten mit weiterer Gemeinde 0; Team-Konten mit einer Konfi-Zeile in
  einer anderen Gemeinde 1 (Leitung zuhause, Konfi in einer Testgemeinde —
  bleibt so, Simon 01.10.2026); Stamm-Zeilen in `user_organizations` mit
  abweichender Rolle 0; offene Einladungen an Konfis 0. Verschiedene
  Team-Rollen je Gemeinde: admin → org_admin 1, org_admin → org_admin 1,
  org_admin → teamer 1; Konten mit mindestens einer weiteren Gemeinde 2.

## Was übrig ist

Übrig sind Konten, die in **verschiedenen Gemeinden verschiedene Team-Rollen**
haben (etwa zuhause Org-Leitung, woanders Teamer:in), und der Altbestand.
Aufwand: **klein** = eine Stelle, Test, Doku; **mittel** = mehrere Stellen
oder eine Migration; **groß** = Datenmodell.

### 1. Event-Chat: Teilnehmer-Typ nach der Rolle zuhause

`backend/utils/eventChat.js` (`addToEventChat`, `syncEventChat`)

- **Heute:** Der Teilnehmer-Typ (`konfi`/`teamer`/`admin`) kommt aus der Rolle
  am Konto. Wer zuhause Org-Leitung und in B Teamer:in ist, sitzt in B's
  Event-Chats als `admin`. In B arbeitet die Person als `teamer` — Chatliste
  und Zähler suchen `user_type = 'teamer'` und finden den Raum nicht. Der
  Kommentar in der Datei beschreibt genau diese Folge.
- **Vorschlag:** Rolle in der Gemeinde des Termins (`ladeRolleInGemeinde`,
  `backend/utils/orgMitglieder.js`); bestehende Zeilen per Migration angleichen.
- **Aufwand:** mittel (zwei Abfragen, Migration für den Bestand, Test).

### 2. Push ohne Gemeinde landet in der Stamm-Gemeinde

`backend/services/pushService.js` (`resolveRecipientOrgId`, Rückfall in `sendToUser`)

- **Heute:** Trägt ein Push keine `organization_id`, setzt der Versand die
  Stamm-Gemeinde des Empfängers ein. Für Inhalte aus einer weiteren Gemeinde
  führt das Antippen dann in die falsche Gemeinde, und die Zahl wird dort
  gebucht. Wie viele der 46 `send…`-Funktionen die Gemeinde mitgeben, ist
  nicht gezählt.
- **Vorschlag:** Jede Push-Art gibt die Gemeinde des Inhalts mit; ein Test
  prüft das für alle Push-Arten. Der Rückfall bleibt nur für Konten mit einer
  Gemeinde.
- **Aufwand:** mittel.

### 3. Challenge-Urheber:innen nur aus der Stamm-Gemeinde

`backend/routes/challenges.js` (`GET /admin/authors`, Urheber-Prüfung in
`POST`/`PUT /admin`)

- **Heute:** Liste und Prüfung lesen `users.organization_id`. Eine Teamer:in
  aus A, die in B mitarbeitet, steht in B nicht zur Auswahl; wird sie über die
  Kennung gesetzt, antwortet B mit 400 „Urheber nicht gefunden".
- **Vorschlag:** beide Quellen, Rolle in B (wie `ladeMitgliederDerOrganisation`).
- **Aufwand:** klein.

### 4. Detailansicht der Leitung für Teamer:innen aus einer anderen Gemeinde

`backend/routes/konfi-management.js` (`GET /admin/konfis/:id`)

- **Heute:** Rolle am Konto und Stamm-Gemeinde — die Leitung von B bekommt
  für ihre Teamer:in aus A 404. Badges und Zertifikate darin liefern seit
  28.09.2026 schon die Gemeinde B, nur die Ansicht selbst lädt nicht. Die
  Team-Liste dazu überarbeitet die Koordination.
- **Vorschlag:** zusammen mit der Team-Liste auf die Rolle in B umstellen.
- **Aufwand:** klein bis mittel (die Antwort enthält Termine, Zertifikate und
  Konfi-Zeit).

### 5. Veraltete Stamm-Zeilen in `user_organizations`

Migration 101 hat jedes damalige Konto mit seiner Stamm-Gemeinde auch in
`user_organizations` eingetragen.

- **Heute:** Beförderung und Rollenwechsel zuhause ziehen die Zeile seit dem
  28.09.2026 mit; ältere Wechsel ließen die alte Rolle stehen.
  `ladeMitgliederDerOrganisation` liest beide Quellen: Eine zur Leitung
  herabgestufte Org-Leitung bekommt dort weiter Org-Leitungs-Mitteilungen,
  und eine beförderte Teamer:in steht bei „Badge neu prüfen" für
  Konfi-Badges weiter in der Liste der Geprüften.
- **Vorschlag:** additive Migration: Stamm-Zeilen auf `users.role_id` setzen,
  und `ladeMitgliederDerOrganisation` überspringt Zeilen der Stamm-Gemeinde.
  Gemessen 01.10.2026: Bei keinem aktiven Konto weicht die Stamm-Zeile ab —
  die Migration hätte heute nichts zu tun; es bleibt die Absicherung für
  künftige Wege.
- **Aufwand:** klein.

### 6. Kontofelder mit Gemeinde-Bezug

`users.role_title` (Funktionsbezeichnung), `users.teamer_since`,
`users.is_active`

- **Heute:** am Konto, gepflegt von der Stamm-Gemeinde. `teamer_since` ist
  für das Badge „Teamer-Jahr" in jeder Gemeinde das früheste Jahr; gezählt
  werden nur Jahre mit Aktivität in der jeweiligen Gemeinde. Eine Sperre gilt
  für alle Gemeinden.
- **Vorschlag:** so lassen und im Handbuch sagen — oder je Gemeinde in
  `user_organizations` (additive Spalten).
- **Aufwand:** klein (lassen) bzw. mittel (je Gemeinde).

### 7. Altbestand: Mischkonten löschen

`DELETE /admin/konfis/:id` und `POST /auth/delete-account`
(`deleteKonfiCascade`)

- **Heute:** Die Auto-Löschung überspringt Mischkonten; die Leitung und die
  Person selbst löschen dagegen das ganze Konto, samt Mitgliedschaft in der
  anderen Gemeinde.
- **Vorschlag:** hängt an Frage 1.
- **Aufwand:** klein.

### Bewusst so gelassen

- `backend/utils/liveUpdate.js` (`sendToUserByRole`): Das eigene
  Nachlade-Signal geht an den Raum der Rolle zuhause („Wer bekommt was"
  BF-15, kein Fremdempfang).

## Fragen an Simon

1. **Altbestand:** Was geschieht mit Konten, die Konfi und Team zugleich sind?
   Konfi-Rolle entfernen und Team bleiben, Team-Mitgliedschaft beenden oder
   Einzelfall? **Entschieden 01.10.2026:** Gemessen gibt es genau ein solches
   Konto (Leitung zuhause, Konfi in einer Testgemeinde); Simon: Es bleibt.
2. **Event-Chat (1):** Teilnehmer-Typ nach der Rolle in der Gemeinde des
   Termins, mit Migration für den Bestand?
3. **Push (2):** Soll jede Mitteilung die Gemeinde zwingend mitgeben, mit
   einem Test, der das für alle Push-Arten prüft?
4. **Urheber:innen (3):** Team aus anderen Gemeinden in B's Auswahl — ja?
5. **Detailansicht (4):** zusammen mit der Team-Liste der Koordination?
6. **Stamm-Zeilen (5):** angleichen per Migration, nachdem gemessen ist?
7. **Kontofelder (6):** Funktionsbezeichnung, „Teamer seit" und Sperre am
   Konto lassen oder je Gemeinde führen?
8. **Löschen (7):** Sollen Leitung und Selbstlöschung ein Mischkonto aus dem
   Altbestand nur in der eigenen Gemeinde beenden statt ganz löschen?

## Umsetzung (Stand 08.10.2026)

Simons Entscheidungen vom 08.10.2026 zu den Fragen 2 bis 8 sind umgesetzt
(Branch `feat/mehrfach-konten-abschluss`):

- **Event-Chat (1):** Teilnehmer-Typ nach der Rolle in der Gemeinde des
  Termins (`backend/utils/eventChat.js`); Migration 197 gleicht den Bestand an.
- **Push (2):** Jede Push-Art gibt die Gemeinde des Inhalts mit; ein Test
  prüft alle `send…`-Funktionen. Der Rückfall auf die Stamm-Gemeinde gilt nur
  noch für Konten mit genau einer Gemeinde.
- **Urheber:innen (3)** und **Detailansicht (4):** beide Quellen, Rolle und
  Daten der aktiven Gemeinde.
- **Stamm-Zeilen (5):** Migration 196 setzt sie auf den Stand am Konto;
  Rollenwechsel schreiben Konto und Stamm-Zeile über
  `schreibeGemeindeFelder` (`backend/utils/orgMitglieder.js`);
  `ladeMitgliederDerOrganisation` liest Stamm-Zeilen nicht mehr.
- **Kontofelder (6):** `role_title`, `teamer_since` und `is_active` je
  Gemeinde in `user_organizations` (Migration 196, additiv); in der
  Stamm-Gemeinde bleiben die Werte am Konto maßgeblich und werden mitgeführt.
  Lesen über `gemeindeFelderSql`.
- **Sperre (7):** nur in der sperrenden Gemeinde; in allen gesperrt = Konto
  gesperrt; Super-Admins sperren das ganze Konto. `verifyTokenRBAC` prüft
  Sperre, Rolle und Mitgliedschaft je Anfrage (wirkt auf allen Replicas
  sofort).
- **Löschen (8):** `DELETE /admin/konfis/:id` beendet bei einem Konto mit
  weiterer Gemeinde nur die eigene Mitgliedschaft (Team-Konten über
  `DELETE /users/:id` schon seit 27.09.2026); die Selbstlöschung entfernt
  alles.

Bewusst so gelassen bleibt `sendToUserByRole` (siehe oben).
