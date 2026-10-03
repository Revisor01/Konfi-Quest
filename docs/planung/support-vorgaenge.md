# Support mit Vorgängen, Formular, Archiv und Löschen

Stand: 03.10.2026. Baut auf [support-mail.md](support-mail.md) und
[support-web.md](support-web.md) auf.

## Was Simon will (03.10.2026)

> „Die Postfächer im Support und die Listen aktualisieren sich nicht gut, wenn
> ich den Status ändere oder sonst was. Das müssen wir anpassen."

> „Für eine richtige Support-Verwaltung: Müsste da nicht jede Anfrage zwar der
> Gemeinde zugeordnet werden, aber immer in einem Vorgang landen? Und Löschen
> von Anfragen und Mails wäre auch sehr praktisch, oder Archivieren immerhin,
> dass sie nicht mehr im Eingang liegen." — „Archiv und Löschen bitte."

> „Die Ansichten für Anfragen und Support sind mir noch viel zu
> unstrukturiert. Auch Support braucht ein klares Formular mit Auswahlfeldern,
> damit wir es gleich sortiert haben und gleich richtig einstrukturieren
> können. Das ist extrem wichtig. Und dann kommt es an den richtigen Ort. Und
> dann gibt es immer noch die Mail, und die kann zusortiert werden. Es muss
> professionell sein, gut strukturiert, einfach zu bedienen."

## Entschieden

1. **Alles ist ein Vorgang.** Ein Vorgang ist ein Anliegen mit Nummer, Art,
   Bereich, Dringlichkeit, Status, Betreff, Gemeinde (sobald bekannt) und
   Verlauf (Formulartext, Mails ein/aus, interne Notiz). Er entsteht
   - aus einer **Anfrage** über das Formular auf konfi-quest.de (Art „Neue
     Gemeinde"; die Anfrage bleibt mit ihren Feldern daran hängen),
   - aus dem **Support-Formular** in der App und im Browser (Art und Bereich
     wählt die Gemeinde selbst),
   - aus einer **Mail** von einer Adresse, die zu genau einem Konto einer
     Gemeinde gehört (neuer Vorgang dieser Gemeinde, Art „Sonstiges"),
   - durch den **Support** selbst („Neuer Vorgang", z. B. um eine Gemeinde
     anzuschreiben),
   - aus dem **Posteingang**: Mails, die sich keinem Vorgang zuordnen lassen,
     liegen dort und werden mit einem Schritt in einen bestehenden oder neuen
     Vorgang einsortiert.
2. **Zuordnung eingehender Mails**, in dieser Reihenfolge: Antwort-Kopfzeilen
   (Faden) → `[Vorgang N]` im Betreff → alte Kennungen `[Anfrage N]` (Vorgang
   der Anfrage) und `[Gemeinde N]` (jüngster offener Vorgang der Gemeinde,
   sonst Posteingang) → Absender ist die Adresse einer Anfrage (deren Vorgang)
   → Absender gehört zu genau einem Konto einer Gemeinde (neuer Vorgang) →
   sonst Posteingang. Ausgehende Mails tragen `[Vorgang N]`.
3. **Arten** (Auswahl, Pflicht): Neue Gemeinde · Frage zur Bedienung · Fehler
   melden · Wunsch oder Idee · Zugang und Konten · Lizenz und Abrechnung ·
   Datenschutz · Sonstiges. **Bereiche** (Auswahl; Pflicht bei Frage, Fehler,
   Wunsch): Konfis · Termine · Punkte und Anträge · Challenges · Chat · Badges
   · Material · Konten und Einladungen · Einstellungen · Sonstiges.
   **Dringlichkeit:** normal · dringend („wir können gerade nicht
   weiterarbeiten"). **Status:** Neu · In Arbeit · Wartet auf Rückmeldung ·
   Erledigt.
4. **Support-Formular** („Hilfe und Support", unter „Mehr" in App und Browser)
   für **Gemeindeleitung und Leitung** (org_admin, admin) der aktiven
   Gemeinde. Felder: Art, Bereich, Dringlichkeit, Betreff, Beschreibung;
   Rückmeldung an die Mail-Adresse des Kontos (ohne Adresse am Konto: Pflicht­
   feld); Häkchen „App-Version und Gerätetyp mitsenden" (nur Version und
   ios/android/web). Nach dem Absenden: Bestätigung mit Vorgangsnummer auf dem
   Bildschirm und als Mail von support@ mit `[Vorgang N]` im Betreff.
   Darunter „Unsere Anliegen": die Vorgänge der Gemeinde mit Betreff, Art,
   Status und Datum — die Gemeindeleitung sieht alle ihrer Gemeinde, die
   Leitung ihre eigenen. Interne Notizen sieht nur der Support. Höchstens 10
   Anliegen je Konto und Stunde.
5. **Archivieren und Löschen.**
   - Ein Vorgang lässt sich **archivieren** (verschwindet aus den offenen
     Listen, bleibt unter „Archiv" mit Suche, lässt sich wiederherstellen)
     und **löschen** (mit Rückfrage; Vorgang, seine Mails in Konfi Quest und
     eine daran hängende Anfrage). Im Postfach selbst wird nie etwas gelöscht
     — Konfi Quest liest die Postfächer weiter nur lesend.
   - Eine Mail im Posteingang lässt sich **archivieren** und **löschen**.
   - Beides auch für mehrere auf einmal (Auswahl in der Tabelle).
6. **Aufbewahrung.** Erledigte Vorgänge werden **730 Tage nach dem
   Abschluss** gelöscht, wenn sie sich seitdem nicht geändert haben
   (archivierte ebenso). Anfrage-Vorgänge folgen weiter den Fristen der
   Anfrage (abgelehnt 180 Tage, unbewegt 365 Tage). Archivierte Mails im
   Posteingang: 180 Tage wie bisher. Mit der Gemeinde gehen ihre Vorgänge.
   Wird ein Konto gelöscht, bleibt sein Vorgang ohne Personenbezug am Konto
   (`erstellt_von` wird leer). Die Datenschutzerklärung beschreibt das
   Formular (Abschnitt 9e).
7. **Ansicht im Browser.**
   - **Vorgänge** ist der Eingang des Supports: Tabelle mit Nr., Betreff,
     Art, Gemeinde, Status, Dringlichkeit, letzte Aktivität, ungelesen;
     Filter Offen (neu, in Arbeit, wartet) · Neu · In Arbeit · Wartet ·
     Erledigt · Archiv; Auswahl nach Art und Gemeinde; Suche; Sammelaktionen.
   - **Ein Vorgang:** Kopf mit Nummer, Betreff, Status; links der Verlauf und
     die Antwort mit Textbausteinen; rechts „Einordnen" (Art, Bereich,
     Dringlichkeit, Status, Gemeinde — Auswahlfelder, sofort gespeichert),
     Gemeinde und Gemeindeleitung, bei einer Anfrage deren Angaben und
     „Gemeinde anlegen", interne Notiz, Archivieren, Löschen.
   - **Posteingang:** nur die nicht einsortierten Mails, je Mail
     „Einsortieren" (bestehender Vorgang mit Suche oder neuer Vorgang mit
     Art, Bereich, Gemeinde), Archivieren, Löschen.
   - **Anfragen** ist ein Filter der Vorgänge (Art „Neue Gemeinde"); die alten
     Adressen `/admin/support/anfragen` und `/admin/support/anfragen/:id`
     führen dorthin bzw. zum Vorgang der Anfrage. Der Schriftwechsel einer
     Gemeinde ist die Liste ihrer Vorgänge; „Schreiben" legt einen Vorgang an.
   - **Rote Zahlen:** Vorgänge = nicht archivierte Vorgänge mit Status „Neu"
     oder mit ungelesener Mail; Posteingang = ungelesene, nicht einsortierte,
     nicht archivierte Mails.
8. **Aktuell bleiben.** Nach jeder Änderung (Status, Einordnen, Antworten,
   Gelesen, Einsortieren, Archivieren, Löschen, Bausteine, Struktur, Konten)
   zeigen Liste, Detail, Übersicht und die roten Zahlen der Leiste sofort den
   neuen Stand — eine Stelle meldet „Support-Daten geändert", alle Ansichten
   hören darauf; dazu neu laden beim Zurückkehren auf eine Seite und beim
   Wiederaufnehmen des Fensters.
9. **Ausgelieferte Apps:** Alle bisherigen Routen und Antwortformen bleiben
   (Felder nur hinzu). Das Formular gibt es in den Apps ab der nächsten
   Version; der Browser hat es sofort.

## Datenmodell (Migration 195, additiv)

```
support_vorgaenge (
  id SERIAL PRIMARY KEY,
  art TEXT NOT NULL,            -- neue_gemeinde | frage | fehler | wunsch | zugang | lizenz | datenschutz | sonstiges
  bereich TEXT NULL,            -- konfis | termine | punkte | challenges | chat | badges | material | konten | einstellungen | sonstiges
  dringlichkeit TEXT NOT NULL DEFAULT 'normal',   -- normal | dringend
  status TEXT NOT NULL DEFAULT 'neu',             -- neu | in_arbeit | wartet | erledigt
  status_seit TIMESTAMPTZ NOT NULL DEFAULT now(),
  betreff TEXT NOT NULL,
  beschreibung TEXT NULL,       -- Text aus dem Formular
  quelle TEXT NOT NULL,         -- anfrage | formular | mail | support
  organization_id INT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  anfrage_id INT NULL UNIQUE REFERENCES gemeinde_anfragen(id) ON DELETE CASCADE,
  erstellt_von INT NULL REFERENCES users(id) ON DELETE SET NULL,
  rueckmeldung_an TEXT NULL,    -- nur wenn das Konto keine Adresse hat
  app_version TEXT NULL, plattform TEXT NULL,
  notiz TEXT NULL,              -- intern, nur Support
  archiviert_am TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
mail_nachrichten: + vorgang_id INT NULL REFERENCES support_vorgaenge(id) ON DELETE CASCADE,
                  + archiviert_am TIMESTAMPTZ NULL
```

CHECKs für Art, Bereich, Dringlichkeit, Status, Quelle. Übernahme: Jede
vorhandene Anfrage bekommt ihren Vorgang (Status: neu→neu, in_arbeit→
in_arbeit, angelegt/abgelehnt→erledigt), ihre Mails die `vorgang_id`; Mails
einer Gemeinde ohne Anfrage werden je Gemeinde in einen Vorgang „Schriftwechsel"
(Art sonstiges, Quelle mail) gelegt. `anfrage_id`/`organization_id` an den
Mails bleiben gefüllt (alte Routen lesen sie).

## Routen

Support (Super-Admin, `/api/support`):

```
GET    /vorgaenge?filter=offen|neu|in_arbeit|wartet|erledigt|archiv&art=&gemeinde=&suche=
       -> [ { id, art, bereich, dringlichkeit, status, betreff, quelle, organization_id,
              gemeinde_name, anfrage_id, ungelesen, letzte_aktivitaet, created_at, archiviert_am } ]
POST   /vorgaenge            { art, bereich?, dringlichkeit?, betreff, organization_id?, text?, an? }
GET    /vorgaenge/:id        -> { ...vorgang, notiz, beschreibung, erstellt_von_name, app_version, plattform,
                                   verlauf: [mails], anfrage: {…}|null, gemeinde: {…}|null, leitung: [...] }
PATCH  /vorgaenge/:id        { art?, bereich?, dringlichkeit?, status?, betreff?, organization_id?, notiz? }
POST   /vorgaenge/:id/antworten     { betreff, text, an? }   -> Mail mit [Vorgang N]
POST   /vorgaenge/:id/archivieren · /wiederherstellen
DELETE /vorgaenge/:id
POST   /vorgaenge/sammel     { ids:[], aktion: archivieren|wiederherstellen|loeschen|status, status? }
POST   /mail/nachrichten/:id/einsortieren  { vorgang_id } | { neu: { art, bereich?, dringlichkeit?, betreff?, organization_id? } }
POST   /mail/nachrichten/:id/archivieren · /wiederherstellen
DELETE /mail/nachrichten/:id
POST   /mail/sammel          { ids:[], aktion: archivieren|wiederherstellen|loeschen }
GET    /mail/zaehler         + vorgaenge, + posteingang (zusätzliche Felder)
GET    /mail/eingang         + archiv=1 (nur archivierte), ohne: nicht archivierte
```

Gemeinde (angemeldet, org_admin oder admin der aktiven Gemeinde):

```
POST /api/hilfe/anliegen   { art, bereich?, dringlichkeit, betreff, beschreibung, rueckmeldung_an?, technik: bool }
                           -> 201 { id, nummer }
GET  /api/hilfe/anliegen   -> [ { id, art, bereich, status, betreff, created_at, updated_at } ]
```

`POST /api/anfragen` legt den Vorgang der Anfrage in derselben Transaktion an.

## Offen

- Zuweisung an einzelne Support-Konten, sobald es mehr als eine Person im
  Support gibt.
- Dateianhänge im Formular (Bildschirmfoto).
