# Die Support-Ansicht benutzen

Für den Betrieb von Konfi Quest: wer die Support-Ansicht sieht, wie man
hinkommt und wie man darin Anfragen bearbeitet, Gemeinden anlegt, die Struktur
aus Landeskirchen und Kirchenkreisen pflegt und Support-Konten verwaltet.
Grundlage sind Simons Entscheidungen vom 02. und 03.10.2026
([planung/web-version.md](../planung/web-version.md), Punkt 2 bis 7 und 10
bis 15). Belegt am Code (`frontend/src/components/support/`,
`frontend/src/navigation/rollenBaeume.ts` und `supportMenue.ts`, das Formular in
`frontend/public/landing.html`) und an den Tests unter
`frontend/src/__tests__/components/support/`,
`frontend/src/__tests__/navigation/supportBaum.test.tsx` und
`frontend/src/__tests__/betrieb/anfrageFormular.test.ts`. Die Routen dahinter
stehen in der API-Doku.

## Wer sie sieht und wie man hinkommt

Nur Konten mit **Super-Admin-Recht**. Für alle anderen gibt es keinen Weg
dorthin; wer eine Adresse unter `/admin/support` eintippt, sieht „Nur für den
Support", und der Server antwortet ohnehin mit 403.

| Konto | Weg |
|---|---|
| Support-Konto ohne Gemeinde ([support-konto.md](support-konto.md)) | Anmelden auf konfi-quest.de im Browser; die Startseite ist die **Übersicht** (`/admin/support`). Auf breiten Bildschirmen stehen die Bereiche in der Leiste links, auf schmalen führt die Übersicht zu allen Bereichen und trägt unten **Abmelden**. |
| Gemeindeleitung mit Super-Admin-Merkmal (Simons Konto) | Reiter **„Mehr"** › oben rechts das **Headset-Symbol** („Support-Ansicht öffnen"). Daneben bleibt das Puls-Symbol zum Betrieb. |

Die Bereiche: **Übersicht**, **Anfragen**, **Gemeinden**, **Struktur**,
**Support-Konten**, **Betrieb**. Gemeinden und Betrieb sind die bekannten
Seiten; eine einzelne Gemeinde öffnet die Adresse
`/admin/organizations?gemeinde=<id>` direkt.

## Die Kennzahlen lesen

Die Übersicht zeigt aus `GET /api/support/statistik`:

- **Gesamt:** Gemeinden (davon aktiv und ohne Zuordnung), Konfis,
  Teamer:innen, Leitung (davon Gemeindeleitung), Konten mit Anmeldung in den
  letzten 30 Tagen und Jahrgänge.
- **Je Landeskirche und Kirchenkreis:** aufklappbar bis zur einzelnen Gemeinde.
  Kirchenkreise ohne Landeskirche und Gemeinden ohne Kirchenkreis stehen
  zuletzt unter „Ohne Landeskirche" bzw. „Ohne Kirchenkreis". Eine Gemeinde
  antippen öffnet sie unter Gemeinden.

Gezählt werden Konten je Gemeinde und Rolle, ohne Namen. Wer in zwei Gemeinden
mitarbeitet, zählt in beiden — die Summe ist die Zahl der Mitgliedschaften,
nicht der Personen. Der Stand steht unter dem Baum.

## Anfragen bearbeiten

**Woher sie kommen:** Auf konfi-quest.de steht im Schlussabschnitt das
Formular „Konfi Quest für eure Gemeinde anfragen"; die Knöpfe „Kostenlos
testen" weiter oben führen dorthin. Es prüft Pflichtfelder, E-Mail-Adresse,
Mobilnummer und Zahlen vorab, sendet an `POST /api/anfragen` und sagt, was
herauskam: Dank, die Felder, die der Server bemängelt (400), „zu viele
Anfragen" (429) oder „später noch einmal" — die letzten beiden mit
moin@konfi-quest.de als Ausweg. Was der Server dabei tut (Mails, Grenzen
gegen Missbrauch, unsichtbares Feld gegen Programme) und wie lange eine
Anfrage bleibt, steht in der API-Doku und in der Datenschutzerklärung,
Abschnitt 9c.

**Liste** (Bereich Anfragen): Filter **Neu**, **In Arbeit**, **Angelegt**,
**Abgelehnt**, **Alle**; neueste zuerst. Ein Eintrag öffnet die Anfrage.

**Eine Anfrage** zeigt alle Angaben (E-Mail und Telefon als Verweis), darunter:

- **Bearbeitung:** Status von Hand auf Neu, In Arbeit oder Abgelehnt setzen und
  eine Notiz nur für den Support hinterlegen, dann **Speichern**. „Angelegt"
  setzt allein das Anlegen der Gemeinde.
- **Gemeinde anlegen** — vorbelegt aus der Anfrage:

| Feld | Vorbelegung |
|---|---|
| Name der Gemeinde | die Gemeinde aus der Anfrage; daraus entsteht der Systemname wie beim Anlegen unter Gemeinden ([gemeinde-anlegen.md](gemeinde-anlegen.md)) |
| Kirchenkreis | gesucht in der Struktur, ohne Groß/klein und ohne vorangestelltes „Kirchenkreis" („Dithmarschen" findet „Kirchenkreis Dithmarschen"); gibt es den Namen in zwei Landeskirchen, entscheidet die Landeskirche der Anfrage. Steht er noch nicht in der Struktur, legt **„Als Kirchenkreis anlegen"** ihn an (mit der Landeskirche, wenn es sie gibt) und wählt ihn aus. |
| Ansprechperson, E-Mail, Telefon | Name, E-Mail und Mobilnummer aus der Anfrage |
| Konfi-Limit | 5, wie auf der Startseite für die Testphase zugesagt; leer = unbegrenzt |
| Testphase (30 Tage) | an: Zugang 30 Tage ab heute mit Hinweis auf den Startseiten; aus: ohne Ablaufdatum |
| Erste Gemeindeleitung | Benutzername als Vorschlag aus dem Namen („Anna Müller" → `anna.mueller`), Anzeigename und E-Mail aus der Anfrage; das Passwort trägt man ein oder lässt es vorschlagen |

Vor dem Absenden prüft die Seite Pflichtfelder, Benutzername und
Passwortregel; dann kommt eine Rückfrage. **Anlegen** ruft
`POST /api/support/anfragen/<id>/anlegen`: Gemeinde und erste Gemeindeleitung
entstehen in einer Transaktion mit derselben Logik wie beim Anlegen unter
Gemeinden, die Anfrage steht danach auf **Angelegt**. Die Seite zeigt den
Benutzernamen und **„Gemeinde öffnen"**. Ist der Benutzername schon vergeben,
kommt die Meldung des Servers, und nichts wird angelegt.

Danach wie bei jeder neuen Gemeinde: Benutzername und Passwort auf getrennten
Wegen weitergeben ([gemeinde-anlegen.md](gemeinde-anlegen.md#was-danach-passiert)).
Die Vorlage zur Einwilligung der Eltern steht für die Gemeinde unter
konfi-quest.de/einwilligung.

## Die Struktur pflegen

Kirchenkreis und Landeskirche sind Zuordnungen an der Gemeinde, vor allem für
die Kennzahlen; Rechte hängen daran nicht. Im Bereich **Struktur**:

- Landeskirche oder Kirchenkreis **anlegen** (oben, ein Kirchenkreis gleich
  mit seiner Landeskirche oder ohne).
- **Bearbeiten** (Stift): umbenennen; bei einem Kirchenkreis auch die
  Landeskirche wechseln oder entfernen. Kirchenkreise ohne Landeskirche stehen
  unten gesammelt.
- **Löschen** (Papierkorb): Eine Landeskirche, an der noch Kirchenkreise
  hängen, lässt sich nicht löschen — die Seite sagt das, bevor etwas
  passiert. Ein gelöschter Kirchenkreis nimmt seinen Gemeinden nur die
  Zuordnung.

Die Zuordnung einer Gemeinde ändert man unter **Gemeinden** › Gemeinde ›
Bearbeiten › **Kirchenkreis** (Auswahl aus der Struktur); die Landeskirche
ergibt sich daraus. Der Name wird zugleich in die alte Textspalte geschrieben,
die ältere Apps lesen.

## Support-Konten verwalten

Im Bereich **Support-Konten** stehen alle Konten ohne Gemeinde mit Status,
letzter Anmeldung und den Gemeinden, in denen sie Gast sind.

| Was | Wie | Wirkung |
|---|---|---|
| Anlegen | oben rechts **Plus**: Benutzername, Anzeigename, E-Mail (freiwillig), Passwort | Benutzername systemweit frei, sonst Hinweis mit der Meldung des Servers |
| Passwort setzen | Knopf am Konto | alle Sitzungen des Kontos enden; beim eigenen Konto erst eine Rückfrage, danach neu anmelden |
| Sperren / Entsperren | Knopf am Konto, Sperren mit Rückfrage | gesperrt: Anmeldung unmöglich, alle Sitzungen enden sofort |
| Löschen | Knopf am Konto, mit Rückfrage | dieselbe Kontolöschung wie überall |

Das **eigene Konto** bietet die Ansicht weder zum Sperren noch zum Löschen an.
Das **letzte aktive Super-Admin-Konto** lässt sich weder sperren noch löschen;
dann bleibt ein Hinweis „Nicht möglich" mit dem Satz des Servers stehen, bis
man ihn wegdrückt. Regeln und API stehen in [support-konto.md](support-konto.md).
