# Die Support-Ansicht benutzen

Für den Betrieb von Konfi Quest: wer die Support-Ansicht sieht, wie man
hinkommt und wie man darin Anfragen bearbeitet und beantwortet, Mails
zuordnet, Gemeinden anlegt, die Struktur aus Landeskirchen und Kirchenkreisen
pflegt und Support-Konten verwaltet.
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

## Eine Anfrage kommt an

Die verantwortliche Person einer Gemeinde füllt das Formular auf
konfi-quest.de aus. Pflicht sind **Gemeinde, Name und E-Mail-Adresse** und
das Häkchen zur Einwilligung; dazu können Kirchenkreis, Landeskirche,
Funktion, Mobilnummer, die ungefähre Zahl der Konfis und der Teamer:innen, die
**gewünschte Lizenz** und eine Nachricht kommen. Der Server (`POST /api/anfragen`, ohne Anmeldung)
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
**Abgelehnt**, **Alle**; neueste zuerst; die Wunschlizenz steht am Eintrag.
Ein Eintrag öffnet die Anfrage.

**Die Wunschlizenz** (Simon, 03.10.2026: „die Leute wählen ihre
Wunschlizenz"): Im Formular wählt die Gemeinde Klein (bis 15 Konfis),
Standard (50), Plus (75), Groß (100), Verbund (bis 4 Gemeinden) oder „Noch
offen". Die Testphase läuft trotzdem mit 5 Konfis; danach steht das Limit auf
der Konfi-Zahl der gewählten Lizenz — beim Verbund und ohne Wahl auf
unbegrenzt ([gemeinde-anlegen.md](gemeinde-anlegen.md#konfi-limit-testphase-5-danach-die-wunschlizenz)).
Die Werte stehen einmal in `backend/utils/lizenzen.js`; Migration 192 hält sie
mit einem CHECK fest.

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
| Tarif | Auswahl mit Preis wie unter Gemeinden: Testphase 5 (kostenlos), Klein bis Groß, **Unbegrenzt** oder ein eigenes Limit. Vorbelegt mit 5, wie auf der Startseite für die Testphase zugesagt. Schaltet man die Testphase aus, wird daraus die Konfi-Zahl der Wunschlizenz (ohne Wunsch und beim Verbund: unbegrenzt) und beim Wiedereinschalten wieder 5 — ein selbst eingetragener Wert bleibt stehen. Regel wie unter Gemeinden: [gemeinde-anlegen.md](gemeinde-anlegen.md#konfi-limit-testphase-5-danach-die-wunschlizenz) |
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

## Mails beantworten und zuordnen

Grundlage: Simons Entscheidungen vom 03.10.2026
([planung/support-mail.md](../planung/support-mail.md)); eingerichtet mit
[Auftrag 14](../auftraege/lokaler-agent/14-support-postfaecher.md).

**Zwei Postfächer, zwei Rollen.** `moin@konfi-quest.de` ist für Anfragen und
Erstkontakt — über dieses Postfach gehen auch schon die Systemmails (dieselbe
Anmeldung wie `SMTP_USER`). `support@konfi-quest.de` ist für Hilfe an
bestehende Gemeinden. Antworten auf eine Anfrage gehen von moin@, Antworten an
eine Gemeinde von support@.

**Abholen.** Der Cron-Leader liest beide Postfächer alle zwei Minuten — nur
lesend: Er löscht nichts, verschiebt nichts und markiert nichts als gelesen.
Im Mailprogramm bleibt alles, wie es war. Übernommen wird ab Einrichtung,
nicht der Altbestand. Auf backend-test (`RUN_BACKGROUND_JOBS=false`) wird
weder abgeholt noch versendet. Den Zustand zeigt der Bereich **Posteingang**
oben: eingerichtet, zuletzt abgeholt, letzter Fehler.

**Zuordnen.** Eine neue Mail kommt, in dieser Reihenfolge,

1. in den Verlauf der Mail, auf die sie antwortet (Kopfzeilen
   `In-Reply-To`/`References`),
2. zu `[Anfrage 12]` bzw. `[Gemeinde 7]`, wenn das im Betreff steht,
3. bei moin@ zur jüngsten nicht abgelehnten Anfrage mit derselben
   Absenderadresse — so landen auch Antworten auf die Bestätigungsmail
   einer Anfrage richtig,
4. bei support@ zur Gemeinde, wenn genau ein aktives Konto (nicht Konfi) mit
   Gemeinde diese Adresse hat,
5. sonst in den **Posteingang** („nicht zugeordnet"). Dort ordnet man sie mit
   einem Schritt einer Anfrage oder Gemeinde zu — der ganze Faden geht mit —
   oder antwortet direkt.

Neue, noch nicht angesehene Mails stehen als rote Zahl am Bereich
**Anfragen** (je Anfrage) und am **Posteingang**. Eine Mail zu einer Anfrage
zählt als Bewegung: Die 365-Tage-Frist beginnt neu.

**Antworten.** In der Anfrage (Abschnitt „Antworten"), im Schriftwechsel
einer Gemeinde oder im Posteingang: Baustein wählen (füllt die Platzhalter),
Betreff und Text prüfen, senden. Der Server setzt die Fußzeile darunter,
`[Anfrage 12]` bzw. `[Gemeinde 7]` in den Betreff, die Antwort-Kopfzeilen auf
die letzte Mail des Verlaufs und legt die Antwort in den Ordner „Gesendet"
des Postfachs (fehlt er, legt er „Sent" an). Eine Antwort auf eine neue
Anfrage setzt sie auf „In Arbeit". Scheitert der Versand, wird nichts
gespeichert; der Entwurf bleibt stehen.

**Textbausteine und Fußzeile** (Bereich **Textbausteine**): Bausteine für
moin@, support@ oder beide, mit den Platzhaltern `{{name}}`, `{{gemeinde}}`,
`{{lizenz}}`, `{{testphase_bis}}`, `{{benutzername}}`, `{{absender}}`. Was
ein Platzhalter nicht kennt, bleibt sichtbar stehen. Darunter Fußzeile und
Absendername — dort und nicht im Code stehen Namen, weil das Repo öffentlich
ist. Passwörter gehören nie in eine Mail: „Zugangsdaten unterwegs" nennt den
Benutzernamen, das Passwort geht auf anderem Weg.

## Aufbewahrung

Festgehalten in der Datenschutzerklärung, Abschnitte 9c und 9d
(`frontend/public/datenschutz.html`); `datenschutzGegenCode.test.ts` hält
Text und Code zusammen.

| Stand der Anfrage | Wie lange |
|---|---|
| neu, in Arbeit | bis zur Entscheidung; bleibt eine Anfrage **365 Tage ohne Änderung** (Status oder Notiz), löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupUnbewegteAnfragen`, gezählt ab `updated_at`) |
| abgelehnt | **180 Tage nach der Ablehnung**, dann löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupAbgelehnteAnfragen`, gezählt ab `status_seit`, nicht ab dem Eingang) |
| angelegt | solange die Gemeinde besteht; mit der Gemeinde wird die Anfrage gelöscht |
| Mails zu einer Anfrage oder Gemeinde | wie die Anfrage bzw. Gemeinde; sie gehen mit ihr |
| Mails im Posteingang (nicht zugeordnet) | **180 Tage nach Eingang**, dann löscht sie der nächtliche Lauf aus Konfi Quest; im Postfach selbst bleiben sie |

Möchte jemand die Löschung vorher, wird die Anfrage abgelehnt und — bis es
dafür einen Knopf gibt — in der Datenbank gelöscht
(`DELETE FROM gemeinde_anfragen WHERE id = …`). Den Zähler gegen Missbrauch
hält der Server je IP-Adresse eine Stunde, je E-Mail-Adresse einen Tag (als
Prüfwert, nicht die Adresse) und löscht ihn danach binnen gut einer Stunde.
