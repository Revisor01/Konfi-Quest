# Eine neue Gemeinde anlegen

Für den Betrieb von Konfi Quest: wer eine Gemeinde anlegt, wo in der App, was
dabei entsteht und was die Gemeinde danach tut. Was die Gemeinde selbst lesen
soll, steht im Handbuch unter
[Eine neue Gemeinde einrichten](../handbuch/30-leitung.md#eine-neue-gemeinde-einrichten).
Belegt am Code (`backend/routes/organizations.js`, `POST /organizations`;
`frontend/src/components/admin/modals/OrganizationManagementModal.tsx`) und
am 29.09.2026 gegen eine lokale Instanz nachgespielt.

## Wer es darf

Nur ein **Super-Admin** (Konto mit `is_super_admin`). Der Server prüft das mit
`requireSuperAdmin`; jede andere Rolle bekommt 403, auch die Gemeindeleitung.
Eine Gemeinde kann sich nicht selbst anlegen.

## Wo in der App

Als Super-Admin: Reiter **„Mehr"** › oben rechts das **Gebäude-Symbol**
(„Gemeinden verwalten") › oben rechts **Plus**. Das Formular öffnet sich
direkt zum Ausfüllen.

| Abschnitt | Feld | Pflicht | Wirkung |
|---|---|---|---|
| Gemeinde | Name der Gemeinde | ja | Anzeigename überall in der App. Daraus entsteht der **Systemname** (Kleinbuchstaben, Umlaute als ae/oe/ue/ss, Leerzeichen zu Bindestrichen, alles andere fällt weg: aus „Büsum" wird `buesum`). Er muss eindeutig sein, sonst meldet der Server „Gemeinde-Slug existiert bereits". Gemeinden, die vor dem 29.09.2026 angelegt wurden, behalten ihren Systemnamen ohne Umlaut. |
| Gemeinde | Beschreibung, Kirchenkreis | nein | nur Anzeige |
| Kontakt | Ansprechpartner:in, E-Mail, Telefon, Adresse, Website | nein | Die **E-Mail** wird zugleich die E-Mail-Adresse des ersten Gemeindeleitungs-Kontos — dorthin gehen „Passwort vergessen" und der Hinweis 14 Tage vor Ablauf der Laufzeit. |
| Gemeindeleitung | Name, Login-Benutzername, Passwort | ja | das erste Konto mit der Rolle Gemeindeleitung (`org_admin`). Der Benutzername muss im ganzen System frei sein, ohne Unterschied zwischen Groß- und Kleinschreibung; sonst meldet der Server „Benutzername existiert bereits (muss systemweit eindeutig sein)" und legt nichts an. Passwort nach der Richtlinie (8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen, keine Leerzeichen); „Sicheres Passwort vorschlagen" erzeugt eines. |
| Laufzeit | 30 Tage (Testphase), 1 Jahr, Unbegrenzt, eigenes Datum | vorbelegt: 30 Tage | Nach dem Datum ist die Anmeldung für alle außer Super-Admins gesperrt. „Testphase" zeigt den Hinweis „Testphase: noch … Tage" auf den Startseiten; eine Lizenz mit Datum läuft still ab. |
| Konfi-Limit | Tarif (15, 50, 75, 100, Unbegrenzt) oder eigenes Limit | vorbelegt: leer = unbegrenzt | Ab dem Limit fragt die App die Leitung beim Anlegen, ob trotzdem; bis 5 über dem Limit geht es nach Bestätigung, danach nicht mehr. Selbstregistrierung per Einladungscode läuft bis zu dieser festen Grenze ohne Rückfrage. |

Laufzeit und Limit lassen sich später in derselben Ansicht ändern
(`PUT /organizations/:id`, `PATCH /organizations/:id/limit`, beides nur
Super-Admin).

## Was beim Anlegen entsteht

Gemessen am 29.09.2026 (Antwort von `POST /organizations` an einer lokalen
Instanz mit dem Stand dieses Commits):

| Bestand | Anzahl |
|---|---|
| Rollen | 4 — Gemeindeleitung, Leitung, Teamer:in, Konfirmand:in |
| Konto der Gemeindeleitung | 1 |
| Badges | 36 — 27 für Konfis, 9 fürs Team |
| Zertifikatsarten | 4 — Teamer-Card, JuLeiCa, Rettungsschwimmer, Erste Hilfe |
| Level | 6 — Noviz:in (2 Punkte) bis Legende (30 Punkte) |
| Kategorien | 14 |
| Aktivitäten | 9 — 5 für Konfis, 4 fürs Team (ohne Punkte) |
| Challenges | 3 Beispiele als **Entwurf**, ohne Jahrgang |
| Jahrgänge, Konfis, Team, Termine, Chats | keine |

Das Anlegen geschieht ganz oder gar nicht: Scheitert ein Schritt (etwa beim
Anlegen der Badges), bleibt nichts von der Gemeinde stehen, und derselbe Name
lässt sich gleich noch einmal verwenden.

## Was danach passiert

1. Benutzername und Passwort der Gemeindeleitung auf einem sicheren Weg an die
   Gemeinde geben — nicht beides in derselben Mail.
2. Die Gemeindeleitung meldet sich an, ändert das Passwort und hinterlegt eine
   E-Mail-Adresse, falls sie beim Anlegen fehlte.
3. Sie legt den ersten Jahrgang an, holt das Team dazu und nimmt Konfis auf —
   die Schritte stehen im Handbuch unter
   [Eine neue Gemeinde einrichten](../handbuch/30-leitung.md#eine-neue-gemeinde-einrichten).
4. Vor Ablauf der Laufzeit entscheiden: verlängern oder auslaufen lassen. Die
   Gemeindeleitung bekommt 14 Tage vorher eine Mail.

Eine Person, die schon ein Konto in einer anderen Gemeinde hat, wird **nicht**
über dieses Formular zur Gemeindeleitung, sondern über den Abschnitt
„Mitglieder & Zuweisungen" der neuen Gemeinde (Super-Admin, mit Rolle) oder
eine Einladung der Gemeindeleitung (Handbuch, Kapitel Rollen, „In mehreren
Gemeinden mitarbeiten").
