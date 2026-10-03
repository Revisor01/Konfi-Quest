# Support-Mail: Anfragen beantworten, Postfächer lesen und sortieren

Stand: 03.10.2026. Gehört zur Web-Version ([web-version.md](web-version.md)).

## Entschieden (Simon, 03.10.2026)

Simon: „Ich muss auch auf eine Anfrage reagieren können etc. Deren Antwort
richtig sortiert werden." — „Gut wären ja auch automatische Versatzstücke für
Mails. Und ein guter Footer wäre auch gut." — „Du darfst alle lesen auch
schicken etc."

1. **Zwei Postfächer, zwei Rollen.** `moin@konfi-quest.de` ist für Anfragen und
   Erstkontakt (steht auf der Startseite); Antworten auf Anfragen gehen von
   dort. `support@konfi-quest.de` ist für Hilfe an bestehende Gemeinden;
   Antworten an Gemeindeleitungen gehen von dort.
2. **Beide Postfächer werden gelesen und sortiert** — nur lesen: nichts wird
   gelöscht, verschoben oder als gelesen markiert. Das Mailprogramm bleibt,
   wie es ist.
3. **Ab Einrichtung.** Beim ersten Lauf wird kein Altbestand übernommen; ab da
   kommt jede neue Mail dazu.
4. **Nicht zugeordnete Mails bleiben 180 Tage** in Konfi Quest (im Postfach
   selbst bleibt alles). Zugeordnete gehen mit ihrer Anfrage bzw. Gemeinde.
5. **Meldung:** rote Zahl in der Support-Ansicht, kein Push.
6. **Textbausteine mit Platzhaltern** und **eine Fußzeile** für Antworten,
   beides in der Support-Ansicht pflegbar (Namen gehören nicht ins
   öffentliche Repo, deshalb steht im Code nur ein neutraler Vorschlag).

## Zugangsdaten

Nur als Umgebungsvariablen (Portainer-Stack), nie im Repo. Ein Postfach gilt
als **eingerichtet**, wenn Benutzer, Passwort und IMAP-Host gesetzt sind;
sonst bleibt es aus, und die Support-Ansicht sagt das.

| Variable | Bedeutung | Vorgabe |
|---|---|---|
| `MAIL_IMAP_HOST` | IMAP-Server beider Postfächer | — (ohne: Abholen aus) |
| `MAIL_IMAP_PORT` | IMAP-Port (TLS) | 993 |
| `MAIL_SMTP_HOST` / `MAIL_SMTP_PORT` | SMTP für Antworten | `SMTP_HOST` / `SMTP_PORT` |
| `MAIL_MOIN_ADRESSE` | Absender und Postfach „moin" | `moin@konfi-quest.de` |
| `MAIL_MOIN_USER` / `MAIL_MOIN_PASS` | Anmeldung „moin" | — |
| `MAIL_SUPPORT_ADRESSE` | Absender und Postfach „support" | `support@konfi-quest.de` |
| `MAIL_SUPPORT_USER` / `MAIL_SUPPORT_PASS` | Anmeldung „support" | — |

Das Zertifikat wird geprüft wie beim bisherigen Versand
(`utils/smtpKonfiguration.js`).

## Datenmodell (Migration 193, additiv)

- `mail_nachrichten` — eine Zeile je Mail, ein- oder ausgehend:
  `id`, `postfach` ('moin' | 'support'), `richtung` ('ein' | 'aus'),
  `anfrage_id` (→ gemeinde_anfragen, ON DELETE CASCADE) **oder**
  `organization_id` (→ organizations, ON DELETE CASCADE) oder keins
  (= Posteingang, nicht zugeordnet; nie beide), `message_id` (UNIQUE),
  `in_reply_to`, `referenzen` (TEXT[]), `von_adresse`, `von_name`,
  `an_adressen` (TEXT[]), `betreff`, `text` (nur Klartext, höchstens
  50.000 Zeichen), `anhaenge` (JSONB: nur Name, Größe, Typ — keine Inhalte),
  `gesendet_am`, `gelesen_am` (eingehend: wann im Support gesehen; ausgehend:
  = gesendet_am), `verfasst_von` (→ users, ON DELETE SET NULL), `imap_uid`,
  `created_at`.
- `mail_abholstand` — je Postfach `uidvalidity`, `letzte_uid`,
  `abgeholt_am`, `fehler`, `fehler_am`.
- `mail_bausteine` — `id`, `titel`, `betreff` (optional), `text`,
  `postfach` (NULL = beide), `sortierung`, `updated_at`, `bearbeitet_von`
  (→ users, ON DELETE SET NULL). Startliste: Eingang bestätigt / Rückfrage,
  Zugangsdaten unterwegs (ohne Passwort), Testphase endet bald,
  Lizenzangebot, Absage.
- `mail_einstellungen` — `schluessel` (PK), `wert`, `updated_at`,
  `bearbeitet_von`. Schlüssel: `fusszeile`, `absendername`.

## Zuordnen eingehender Mails (eine Stelle: `backend/utils/mailZuordnung.js`)

In dieser Reihenfolge, die erste Regel, die greift, gilt:

1. `In-Reply-To` oder `References` nennt die Message-ID einer gespeicherten
   Mail → dieselbe Anfrage bzw. Gemeinde wie diese Mail.
2. Betreff enthält `[Anfrage 12]` und die Anfrage gibt es → Anfrage 12.
   Betreff enthält `[Gemeinde 7]` und die Gemeinde gibt es → Gemeinde 7.
3. Postfach „moin": Absender ist die E-Mail-Adresse einer Anfrage, die nicht
   abgelehnt ist → die jüngste solche Anfrage.
4. Postfach „support": Absender ist die E-Mail-Adresse genau eines aktiven
   Kontos (nicht Konfi) mit Gemeinde → diese Gemeinde.
5. Sonst: Posteingang (nicht zugeordnet).

Eine eingehende Mail zu einer Anfrage zählt als Bewegung
(`gemeinde_anfragen.updated_at`), damit die 365-Tage-Frist neu beginnt.
Eigene Mails (Absender = Adresse des Postfachs) werden übersprungen;
dieselbe Message-ID zweimal wird nicht doppelt gespeichert.

## Abholen

Hintergrund-Job auf dem Cron-Leader, alle zwei Minuten, je eingerichtetem
Postfach: INBOX lesen ab `letzte_uid + 1` (ohne Flags zu ändern), mit
`mailparser` zerlegen, zuordnen, speichern, `letzte_uid` fortschreiben. Erster
Lauf: nur `letzte_uid` auf den aktuellen Stand setzen, nichts übernehmen.
Ändert sich `uidvalidity`, wird ebenso neu aufgesetzt. Fehler (Anmeldung,
Netz) stehen in `mail_abholstand.fehler` und im Protokoll — ohne Inhalte der
Mails, ohne Adressen.

Aufräumen im nächtlichen Lauf: nicht zugeordnete Mails, die älter als 180
Tage sind.

## Antworten

Der Server setzt die Fußzeile unter den Text, schickt die Mail vom Postfach
der Rolle (Anfrage → moin, Gemeinde → support), mit eigener Message-ID
(`<kq-…@konfi-quest.de>`), `In-Reply-To`/`References` auf die letzte Mail
des Verlaufs und der Kennung im Betreff (`[Anfrage 12]` / `[Gemeinde 7]`,
wenn sie fehlt). Danach wird die Mail gespeichert und, wenn möglich, per
IMAP in den Ordner „Gesendet" des Postfachs gelegt (scheitert das, bleibt
die Mail gesendet). Scheitert der Versand, wird nichts gespeichert.
Eine Antwort auf eine Anfrage im Status „neu" setzt sie auf „in Arbeit".

## Routen (alle nur Super-Admin, unter `/api/support`)

| Route | Zweck |
|---|---|
| `GET /mail/status` | `{ postfaecher: [{ postfach, adresse, eingerichtet, abgeholt_am, fehler, fehler_am }] }` |
| `GET /mail/zaehler` | `{ anfragen, gemeinden, eingang, je_anfrage: {id: n}, je_gemeinde: {id: n} }` — ungelesene eingehende Mails |
| `GET /mail/eingang?postfach=` | nicht zugeordnete Mails, neueste zuerst: `[{ id, postfach, von_adresse, von_name, betreff, auszug, gesendet_am, gelesen_am, anhaenge }]` |
| `GET /mail/nachrichten/:id` | eine Mail mit `verlauf` (alle Mails desselben Fadens) |
| `POST /mail/gelesen` | `{ ids: [..] }` → `gelesen_am` setzen (nur eingehende ohne Datum) |
| `POST /mail/nachrichten/:id/zuordnen` | `{ anfrage_id }` oder `{ organization_id }` oder `{}` (zurück in den Posteingang); nimmt den ganzen Faden mit |
| `POST /mail/nachrichten/:id/antworten` | `{ text, betreff? }` — Antwort aus dem Posteingang an den Absender, vom selben Postfach |
| `GET /anfragen/:id/verlauf` | Mails der Anfrage, älteste zuerst |
| `POST /anfragen/:id/antworten` | `{ text, betreff? }` → 201 `{ nachricht }`; 503 Postfach nicht eingerichtet; 502 Versand gescheitert |
| `GET /gemeinden/:id/verlauf` | Mails der Gemeinde, älteste zuerst |
| `GET /gemeinden/:id/empfaenger` | mögliche Empfänger: Gemeindeleitungen und Leitung mit Adresse, dazu Absender aus dem Verlauf |
| `POST /gemeinden/:id/antworten` | `{ an, text, betreff? }` — `an` muss aus `empfaenger` sein |
| `GET /mail/platzhalter?anfrage_id=` bzw. `?organization_id=` | `{ name, gemeinde, lizenz, testphase_bis, benutzername, absender }` |
| `GET/POST /mail/bausteine`, `PUT/DELETE /mail/bausteine/:id` | Textbausteine |
| `GET/PUT /mail/einstellungen` | `{ fusszeile, absendername }` |

`GET /support/anfragen` bekommt das zusätzliche Feld `ungelesen` (Zahl).

Platzhalter in Bausteinen: `{{name}}`, `{{gemeinde}}`, `{{lizenz}}`,
`{{testphase_bis}}`, `{{benutzername}}`, `{{absender}}`. Die Oberfläche füllt
sie beim Einfügen; was sie nicht kennt, bleibt sichtbar stehen.

## Oberfläche

- Neuer Bereich **Posteingang** in der Support-Ansicht (rote Zahl: ungelesene
  nicht zugeordnete Mails), mit Zustand der Postfächer, Liste und Detail
  (Faden, Zuordnen zu Anfrage oder Gemeinde, Antworten).
- **Anfragen**: rote Zahl am Bereich und an jedem Eintrag; in der Anfrage der
  **Verlauf** (chronologisch, Zitate eingeklappt) und **Antworten** mit
  Baustein-Auswahl, Betreff, Text und Vorschau der Fußzeile.
- **Schriftwechsel einer Gemeinde** (`/admin/support/post/gemeinde/:id`),
  erreichbar aus dem Posteingang, mit Empfänger-Auswahl.
- **Textbausteine** (eigener Bereich): Liste, Bearbeiten, Platzhalter-Hilfe,
  dazu Fußzeile und Absendername.

## Offen

- Eine neue Anfrage direkt aus einer Mail anlegen (heute: zuordnen oder
  antworten).
- Die Fußzeile auch unter die automatischen Mails (Bestätigung, Passwort
  vergessen …) setzen.
