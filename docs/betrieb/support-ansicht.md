# Die Support-Ansicht benutzen

Für den Betrieb von Konfi Quest: wer die Support-Ansicht sieht, wie man
hinkommt und wie man darin Vorgänge bearbeitet und beantwortet, Mails
einsortiert, archiviert und löscht, Gemeinden anlegt, die Struktur aus
Landeskirchen und Kirchenkreisen pflegt und Support-Konten verwaltet.
Grundlage sind Simons Entscheidungen vom 02. und 03.10.2026
([planung/web-version.md](../planung/web-version.md), Punkt 2 bis 7 und 10
bis 15; [planung/support-vorgaenge.md](../planung/support-vorgaenge.md)).
Belegt am Code (`frontend/src/components/support/`,
`frontend/src/navigation/rollenBaeume.ts` und `supportMenue.ts`, die Formulare in
`frontend/public/landing.html`, `backend/routes/supportVorgaenge.js`,
`backend/utils/mailZuordnung.js`) und an den Tests unter
`frontend/src/__tests__/components/support/`,
`frontend/src/__tests__/navigation/supportBaum.test.tsx`,
`frontend/src/__tests__/betrieb/anfrageFormular.test.ts` und
`anliegenFormular.test.ts`. Die Routen dahinter stehen in der API-Doku.

## Wer sie sieht und wie man hinkommt

Nur Konten mit **Super-Admin-Recht**. Für alle anderen gibt es keinen Weg
dorthin; wer eine Adresse unter `/admin/support` eintippt, sieht „Nur für den
Support", und der Server antwortet ohnehin mit 403.

| Konto | Weg |
|---|---|
| Support-Konto ohne Gemeinde ([support-konto.md](support-konto.md)) | Anmelden auf konfi-quest.de im Browser; die Startseite ist die **Übersicht** (`/admin/support`). Auf breiten Bildschirmen stehen die Bereiche in der Leiste links, auf schmalen führt die Übersicht zu allen Bereichen und trägt unten **Abmelden**. |
| Gemeindeleitung mit Super-Admin-Merkmal (Simons Konto) | Im Browser ab breitem Fenster stehen die Bereiche der Support-Ansicht in der Leiste links unter den eigenen (Gruppen Support, Verwaltung, Betrieb). In den Apps und im schmalen Fenster: Reiter **„Mehr"** › oben rechts das **Headset-Symbol** („Support-Ansicht öffnen"). Daneben bleibt das Puls-Symbol zum Betrieb. |

Die Bereiche: **Übersicht**, **Vorgänge**, **Posteingang**, **Gemeinden**,
**Struktur**, **Support-Konten**, **Textbausteine**, **Betrieb**. Gemeinden und
Betrieb sind die bekannten Seiten; eine einzelne Gemeinde öffnet die Adresse
`/admin/organizations?gemeinde=<id>` direkt. Alte Adressen der Anfragen
(`/admin/support/anfragen/<id>`) führen zum Vorgang der Anfrage.

## Zwei Gesichter: Browser und App

Im Browser ab 992 px Breite (dieselbe Grenze wie die Leiste) zeigt jede Seite
der Support-Ansicht eine eigene **Web-Fassung** mit Tabellen, Karten,
Kennzahlen und Diagrammen; die Bereiche stehen links in der Leiste, eine
eigene Liste der Bereiche gibt es dort nicht. In den Apps und im schmalen
Fenster bleibt die Darstellung der App. Gestaltung und Bausteine:
[planung/support-web.md](../planung/support-web.md).

## Die Übersicht im Browser lesen

Die Übersicht im Browser liest `GET /api/support/uebersicht`:

- **Kennzahlen:** Gemeinden (Lizenz, Testphase, unbegrenzt, gesperrt — die
  vier ergeben zusammen die Gesamtzahl), Konfis, Team, aktive Konten in 30
  Tagen (je Konto einmal), offene Vorgänge und der Posteingang (dieselbe
  Zahl wie an der Leiste).
- **Entwicklung über zwölf Monate:** neue Gemeinden, neue Konten (Konfi und
  Team), Konten gesamt am Monatsende und neue Anfragen.
- **Aktivität über zwölf Wochen:** eingereichte Anträge, Anmeldungen zu
  Terminen (auch die automatischen bei Pflichtterminen) und Chat-Nachrichten.
- **Neueste offene Vorgänge und Mails** (je fünf), **Testphasen, die in den
  nächsten 14 Tagen enden**, und Gemeinden je Landeskirche.

Monate und Wochen rechnen in deutscher Zeit. Konten zählen wie in der
Statistik: nicht gelöscht, nicht gesperrt, Support-Konten ohne Gemeinde
nicht.

## Die Kennzahlen in der App lesen

Die Übersicht in der App und im schmalen Fenster zeigt aus
`GET /api/support/statistik`:

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

## Mit Vorgängen arbeiten

Jedes Anliegen ist ein **Vorgang** mit Nummer: eine Anfrage einer neuen
Gemeinde, ein Anliegen aus dem Support-Formular, eine Mail, die einen neuen
Vorgang eröffnet, oder ein Vorgang, den der Support selbst anlegt (Spalte
`quelle`: `anfrage`, `formular`, `mail`, `support`). Jeder Vorgang trägt:

| Feld | Werte |
|---|---|
| Art | Neue Gemeinde, Frage zur Bedienung, Fehler, Wunsch oder Idee, Zugang und Konten, Lizenz und Abrechnung, Datenschutz, Sonstiges |
| Bereich | Konfis, Events, Punkte und Anträge, Challenges, Chat, Badges, Material, Konten und Einladungen, Einstellungen, Sonstiges — oder keiner |
| Dringlichkeit | Normal, Dringend |
| Status | Neu, In Arbeit, Wartet, Erledigt |
| Gemeinde | sobald bekannt; sonst „Nicht zugeordnet“ mit der Angabe aus dem Formular |

Die Listen stehen einmal im Server (`backend/utils/supportVorgaenge.js`) und
einmal in der Oberfläche (`frontend/src/utils/supportVorgaenge.ts`); ein
CHECK in Migration 195 hält die Datenbank dazu.

**Liste** (Bereich **Vorgänge**): im Browser eine Tabelle mit Nummer, Betreff,
Art, Gemeinde, Status, Dringlichkeit, letzter Aktivität und ungelesenen
Mails; in der App eine Liste. Filter **Offen** (Neu, In Arbeit, Wartet),
**Neu**, **In Arbeit**, **Wartet** und **Archiv** (darin die erledigten),
dazu Art, Gemeinde und eine Suche über Betreff, Beschreibung, Kontakt,
Gemeinde und die Mails des Vorgangs; „#12“ findet Vorgang 12. Im Browser
lassen sich mehrere Zeilen wählen und gemeinsam archivieren,
wiederherstellen, löschen oder auf einen Status setzen. **Neuer Vorgang**
legt einen an — mit Text geht zugleich eine Mail von support@ hinaus, an eine
der Adressen der Gemeinde (Gemeindeleitung und Leitung, wie im Schriftwechsel
der Gemeinde; ohne Wahl die erste); scheitert der Versand, entsteht kein
Vorgang. Antworten gehen nur an Adressen, die zum Vorgang gehören:
Absender seiner Mails, Kontakt aus dem Formular, Adresse der Anfrage und die
Adressen der Gemeinde.

**Ein Vorgang** zeigt links den Verlauf (Text aus dem Formular, die Mails,
die Antwort mit Textbausteinen), rechts **Einordnen** (Art, Bereich,
Dringlichkeit, Status, Gemeinde — sofort gespeichert), den Kontakt, die
Gemeinde mit ihrer Gemeindeleitung, bei einer Anfrage deren Angaben und
**Gemeinde anlegen** und die interne Notiz. Wechselt die Gemeinde, gehen die
Mails des Vorgangs mit.

**Archivieren und löschen.** Der Status **Erledigt** archiviert den Vorgang;
er verschwindet aus „Offen“ und steht unter „Archiv“. **Archivieren** legt
einen Vorgang auch ohne Erledigt ins Archiv; er behält seinen Status.
**Wiederherstellen** holt ihn zurück, einen erledigten mit dem Status In
Arbeit. Kommt zu einem archivierten Vorgang eine neue Mail, holt der Server
ihn ebenso mit In Arbeit zurück. **Löschen** (mit Rückfrage)
entfernt den Vorgang samt seinen Mails aus Konfi Quest; im Postfach bleiben
sie. Ein Vorgang einer Anfrage geht mit der Anfrage.

**Rote Zahlen:** am Bereich **Vorgänge** die nicht archivierten Vorgänge, die
neu sind oder eine ungelesene Mail haben; am **Posteingang** die ungelesenen
Mails, die keinem Vorgang zugeordnet sind (`GET /api/support/mail/zaehler`,
Felder `vorgaenge` und `posteingang`). Die Leiste holt sie alle zwei Minuten.

**Aktualisieren.** Jede Aktion — Status, Einordnen, Lesen, Einsortieren,
Archivieren, Löschen — meldet sich bei allen offenen Listen, Zahlen und der
Übersicht, die dann neu laden; ebenso beim Zurückkehren auf eine Seite und in
den Tab (`frontend/src/utils/supportAktualisieren.ts`).

## Ein Anliegen über das Support-Formular

Auf konfi-quest.de steht unter **„Hilfe und Support“** (`#support`) das
Formular für Gemeinden, die Konfi Quest schon nutzen; unter „Mehr“ führt
„Hilfe und Support“ für Gemeindeleitung und Leitung dorthin. Pflicht sind
**Gemeinde, Name, E-Mail-Adresse, Art, Betreff, Beschreibung** und die
Einwilligung; bei Frage, Fehler und Wunsch auch der **Bereich**. Funktion ist
freiwillig, die Dringlichkeit steht auf Normal. Die Art „Neue Gemeinde“ gibt
es hier nicht — dafür ist das Anfrageformular daneben.

Der Server (`POST /api/anliegen`, ohne Anmeldung) legt einen Vorgang mit
Quelle `formular` und Status **Neu** an und antwortet `201 { ok: true }` —
ohne Nummer. Gehört die Adresse zu genau einem aktiven Konto (nicht Konfi)
mit Gemeinde, ist der Vorgang gleich dieser Gemeinde zugeordnet, sonst ordnet
der Support von Hand zu. Danach geht von support@ eine Bestätigung mit festem
Text hinaus, die nur die Nummer nennt, mit `[Vorgang N]` im Betreff; eine
Antwort darauf landet im Vorgang. Grenzen gegen Missbrauch und das
unsichtbare Feld `website` wie beim Anfrageformular (unten). Was gespeichert
wird und wie lange, steht in der Datenschutzerklärung, Abschnitt 9e.

## Eine Anfrage kommt an

Die verantwortliche Person einer neuen Gemeinde füllt das Anfrageformular auf
konfi-quest.de aus. Pflicht sind **Gemeinde, Name und E-Mail-Adresse** und
das Häkchen zur Einwilligung; dazu können Kirchenkreis, Landeskirche,
Funktion, Mobilnummer, die ungefähre Zahl der Konfis und der Teamer:innen, die
**gewünschte Lizenz** und eine Nachricht kommen. Der Server (`POST /api/anfragen`, ohne Anmeldung)
speichert die Anfrage mit dem Status **neu** und dem Zeitpunkt der
Einwilligung und legt dazu einen Vorgang der Art **Neue Gemeinde** an.
Anfrage und Vorgang teilen Notiz und Status: Neu und In Arbeit gelten für
beide, Wartet ist für die Anfrage In Arbeit; Erledigt ist für eine noch nicht
angelegte Anfrage **Abgelehnt** (dann gilt deren Frist von 180 Tagen,
unten). Angelegt und Abgelehnt der Anfrage sind für den Vorgang Erledigt.

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

**Liste:** Anfragen stehen unter **Vorgänge** mit der Art „Neue Gemeinde“
(Filter Art). Ein Eintrag öffnet den Vorgang mit den Angaben der Anfrage.

**Die Wunschlizenz** (Simon, 03.10.2026: „die Leute wählen ihre
Wunschlizenz"): Im Formular wählt die Gemeinde Klein (bis 15 Konfis),
Standard (50), Plus (75), Groß (100), Verbund (bis 4 Gemeinden) oder „Noch
offen". Die Testphase läuft trotzdem mit 5 Konfis; danach steht das Limit auf
der Konfi-Zahl der gewählten Lizenz — beim Verbund und ohne Wahl auf
unbegrenzt ([gemeinde-anlegen.md](gemeinde-anlegen.md#konfi-limit-testphase-5-danach-die-wunschlizenz)).
Die Werte stehen einmal in `backend/utils/lizenzen.js`; Migration 192 hält sie
mit einem CHECK fest.

**Der Vorgang einer Anfrage** zeigt alle Angaben (E-Mail und Telefon als
Verweis), darunter:

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

## Mails beantworten und einsortieren

Grundlage: Simons Entscheidungen vom 03.10.2026
([planung/support-mail.md](../planung/support-mail.md)); eingerichtet am 03.10.2026 mit
Auftrag 14 (Ergebnis in der Git-Historie).

**Zwei Postfächer, zwei Rollen.** `moin@konfi-quest.de` ist für Anfragen und
Erstkontakt — über dieses Postfach gehen auch schon die Systemmails (dieselbe
Anmeldung wie `SMTP_USER`). `support@konfi-quest.de` ist für Hilfe an
bestehende Gemeinden. Antworten auf eine Anfrage gehen von moin@, Antworten an
eine Gemeinde von support@.

**Abholen.** Der Cron-Leader liest beide Postfächer alle zwei Minuten — nur
lesend: Er löscht nichts, verschiebt nichts und markiert nichts als gelesen.
Im Mailprogramm bleibt alles, wie es war. Übernommen wird ab Einrichtung,
nicht der Altbestand. Auf einer Instanz mit `RUN_BACKGROUND_JOBS=false` wird
weder abgeholt noch versendet. Den Zustand zeigt der Bereich **Posteingang**
oben: eingerichtet, zuletzt abgeholt, letzter Fehler.

Übernommen werden der Text und von Anhängen nur Name, Typ und Größe. Eine
Mail über 10 MB (`MAX_MAIL_GROESSE` in `services/mailAbholung.js`) lädt der
Server gar nicht herunter — die Backends haben 512 MB Speicher. In Konfi Quest
stehen dann Absender, Betreff, die Anhänge mit geschätzter Größe und der
Hinweis „Diese Mail ist zu groß für die Übernahme … Bitte im Mailprogramm
ansehen."

**Zuordnen.** Eine neue Mail kommt, in dieser Reihenfolge,

1. in den Vorgang der Mail, auf die sie antwortet (Kopfzeilen
   `In-Reply-To`/`References`),
2. zu `[Vorgang 12]`, wenn das im Betreff steht; die alten Kennungen
   `[Anfrage 12]` und `[Gemeinde 7]` führen zum Vorgang der Anfrage bzw. zum
   jüngsten offenen Vorgang der Gemeinde,
3. bei moin@ zum Vorgang der jüngsten nicht abgelehnten Anfrage mit derselben
   Absenderadresse — so landen auch Antworten auf die Bestätigungsmail
   einer Anfrage richtig,
4. bei support@ in einen **neuen Vorgang** der Gemeinde, wenn genau ein
   aktives Konto (nicht Konfi) mit genau einer Gemeinde diese Adresse hat,
5. sonst in den **Posteingang**.

Ein archivierter Vorgang, zu dem eine Mail kommt, kehrt mit dem Status In
Arbeit zurück.

Der **Posteingang** zeigt nur die eingehenden Mails beider Postfächer, die
keinem Vorgang zugeordnet und nicht archiviert sind; Filter „Alle“,
„Ungelesen“, „moin@“, „support@“ und „Archiv“. Je Mail:

- **Einsortieren** in einen bestehenden Vorgang (mit Suche) oder in einen
  neuen mit Art, Bereich, Dringlichkeit, Betreff und Gemeinde — der ganze
  Faden geht mit, soweit er noch im Posteingang liegt,
- **Archivieren** (aus dem Eingang ins Archiv, wiederherstellbar) und
  **Löschen** (mit Rückfrage; nur aus Konfi Quest, im Postfach bleibt sie),
- **Antworten** direkt.

Im Browser lassen sich mehrere Mails wählen und gemeinsam archivieren,
wiederherstellen oder löschen (`POST /api/support/mail/sammel`). Eine Mail
zu einer Anfrage zählt als Bewegung: Die 365-Tage-Frist beginnt neu.

**Antworten.** Im Vorgang (Verlauf, unten) oder im Posteingang: Baustein
wählen (füllt die Platzhalter), Betreff und Text prüfen, senden. Der Server
setzt die Fußzeile darunter, `[Vorgang 12]` in den Betreff, die
Antwort-Kopfzeilen auf die letzte Mail des Verlaufs und legt die Antwort in
den Ordner „Gesendet" des Postfachs (fehlt er, legt er „Sent" an). Eine
Anfrage antwortet von moin@, alles andere von support@. Eine Antwort auf
einen neuen Vorgang setzt ihn auf „In Arbeit". Scheitert der Versand, wird
nichts gespeichert; der Entwurf bleibt stehen.

**Textbausteine und Fußzeile** (Bereich **Textbausteine**): Bausteine für
moin@, support@ oder beide, mit den Platzhaltern `{{name}}`, `{{gemeinde}}`,
`{{lizenz}}`, `{{testphase_bis}}`, `{{benutzername}}`, `{{absender}}`. Was
ein Platzhalter nicht kennt, bleibt sichtbar stehen. Darunter Fußzeile und
Absendername — dort und nicht im Code stehen Namen, weil das Repo öffentlich
ist. Passwörter gehören nie in eine Mail: „Zugangsdaten unterwegs" nennt den
Benutzernamen, das Passwort geht auf anderem Weg.

## Interne Gemeinden

Gemeinden, die nur dem Betrieb dienen — die Test- und Review-Gemeinden für
die Stores —, tragen `organizations.intern = true` (Migration 194). Sie
erscheinen in keiner Liste der Gemeinden und keiner Zahl der Support-Ansicht
und nicht in `GET /api/organizations`; ihre Vorgänge stehen wie alle anderen
unter Vorgänge, weil der Support sie bearbeitet; über ihre Kennung (`/admin/organizations?gemeinde=<id>`,
`GET`/`PUT /api/organizations/:id`) bleiben sie erreichbar, ihre Konten
melden sich an wie bisher. Einen Schalter dafür gibt es bewusst nicht:
Gesetzt wird die Spalte nur direkt in der Datenbank, mit Sicherung vorher —
das erste Mal am 03.10.2026 für die Gemeinden 4, 14 und 15 (Auftrag 15,
heute in [Auftrag 16](../auftraege/lokaler-agent/16-support-vorgaenge-probelauf.md)
aufgegangen).

## Aufbewahrung

Festgehalten in der Datenschutzerklärung, Abschnitte 9c, 9d und 9e
(`frontend/public/datenschutz.html`); `datenschutzGegenCode.test.ts` hält
Text und Code zusammen.

| Stand | Wie lange |
|---|---|
| neu, in Arbeit | bis zur Entscheidung; bleibt eine Anfrage **365 Tage ohne Änderung** (Status oder Notiz), löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupUnbewegteAnfragen`, gezählt ab `updated_at`) |
| abgelehnt | **180 Tage nach der Ablehnung**, dann löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupAbgelehnteAnfragen`, gezählt ab `status_seit`, nicht ab dem Eingang) |
| angelegt | solange die Gemeinde besteht; mit der Gemeinde wird die Anfrage gelöscht |
| Vorgang ohne Anfrage, offen | bis er erledigt ist |
| Vorgang ohne Anfrage, archiviert (auch erledigt) | **730 Tage nach dem Archivieren**, wenn er sich seitdem nicht geändert hat (`cleanupArchivierteVorgaenge`, gezählt ab `archiviert_am` und `updated_at`); eine neue Mail holt ihn vorher zurück |
| Vorgang einer Anfrage | wie die Anfrage; er geht mit ihr |
| Mails zu einem Vorgang, einer Anfrage oder Gemeinde | wie diese; sie gehen mit ihr |
| Mails im Posteingang (keinem Vorgang zugeordnet, auch archivierte) | **180 Tage nach Eingang**, dann löscht sie der nächtliche Lauf aus Konfi Quest; im Postfach selbst bleiben sie |

Vorgänge und Mails lassen sich außerdem jederzeit in der Support-Ansicht
löschen.

Möchte jemand die Löschung vorher, löscht man den Vorgang in der
Support-Ansicht; eine Anfrage wird abgelehnt und — bis es dafür einen Knopf
gibt — in der Datenbank gelöscht (`DELETE FROM gemeinde_anfragen WHERE id = …`). Den Zähler gegen Missbrauch
hält der Server je IP-Adresse eine Stunde, je E-Mail-Adresse einen Tag (als
Prüfwert, nicht die Adresse) und löscht ihn danach binnen gut einer Stunde.
