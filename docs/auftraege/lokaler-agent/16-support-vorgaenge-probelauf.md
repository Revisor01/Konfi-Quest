# 16. Support-Vorgänge: Übernahme prüfen, Probe-Anliegen und Probe-Mails

Stand 06.10.2026. Plan und Entscheidungen:
[docs/planung/support-vorgaenge.md](../../planung/support-vorgaenge.md); wie
die Ansicht arbeitet:
[docs/betrieb/support-ansicht.md](../../betrieb/support-ansicht.md). Erst
**nach dem Deploy** des PRs „Web-Ansicht aller Bereiche und
Support-Vorgänge" — vorher gibt es die Vorgänge nicht (Migration 195).
Baut auf dem Probelauf vom 03.10.2026 auf (Auftrag 15, in diesem Auftrag
aufgegangen; Messwerte in der Git-Historie, `git show
8ef310f3:docs/auftraege/lokaler-agent/15-support-probelauf.md`). Von dort
liegen noch und werden jetzt zu Vorgängen:

- **Probe-Anfrage 1** an moin@ (Gemeinde „Probe – bitte nicht bearbeiten"),
  mit Antwort aus der Support-Ansicht und Antwort aus dem Mailprogramm.
- **Eine Probe-Mail an support@** von einer Adresse ohne Konto, der Gemeinde
  4 zugeordnet.
- **Das Probe-Postfach des Betriebs**, eigens für den Probelauf angelegt; es
  dient als Kontaktadresse und wird nach Schritt 6 gelöscht.
- **Interne Gemeinden** 4 („Test & Demo (App-Review)"), 14 und 15
  (`organizations.intern = true`), siehe
  [betrieb/support-ansicht.md](../../betrieb/support-ansicht.md#interne-gemeinden).

> **Die Konten `review-*` und `google-test-*` nicht benutzen** — weder zum
> Anmelden noch als Absender. Keine Adressen, Namen oder Passwörter ins Repo
> oder ins Ergebnis; dort stehen Kennungen, Zahlen und Ja/Nein.

## Was zu tun ist

- [x] **1. Deploy und Übernahme prüfen.** `GET /api/status`: Version und
      Commit wie der Merge, Migrationen ohne Fehler, `195_support_vorgaenge`
      unter den angewendeten. Dann nur lesend:

          SELECT quelle, art, status, (archiviert_am IS NOT NULL) AS archiv, COUNT(*)
            FROM support_vorgaenge GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4;
          SELECT COUNT(*) FROM gemeinde_anfragen a
           WHERE NOT EXISTS (SELECT 1 FROM support_vorgaenge v WHERE v.anfrage_id = a.id);
          -- erwartet: 0 (jede Anfrage hat ihren Vorgang)
          SELECT COUNT(*) FROM mail_nachrichten
           WHERE vorgang_id IS NULL AND (anfrage_id IS NOT NULL OR organization_id IS NOT NULL);
          -- erwartet: 0 (jede zugeordnete Mail liegt in einem Vorgang)

      Ins Ergebnis: Commit, Zahl der neuen Migrationen, die Zählungen.

- [x] **2. Die Probe-Anfrage als Vorgang.** In der Support-Ansicht unter
      „Vorgänge": Anfrage 1 steht als Vorgang der Art „Neue Gemeinde" mit
      ihren Mails im Verlauf; der Schriftwechsel mit Gemeinde 4 (die
      zugeordnete Probe-Mail von oben) steht als eigener Vorgang. Aus dem Vorgang der Anfrage
      antworten: Der Betreff trägt jetzt `[Vorgang N]`, die Mail geht von
      moin@. Im Mailprogramm darauf antworten; nach höchstens fünf Minuten
      steht die Antwort im Verlauf, mit roter Zahl an „Vorgänge".

      Ins Ergebnis: die Nummern der beiden Vorgänge, je Teilschritt Ja/Nein,
      Minuten bis zur Zuordnung.

- [x] **3. Probe-Anliegen über das Support-Formular.** Auf der Homepage unter
      „Hilfe und Support" (`#support`) ausfüllen: Gemeinde „Probe – bitte
      nicht bearbeiten", das Probe-Postfach des Betriebs, Art
      „Frage zur Bedienung", Bereich „Chat", Betreff „Probe". Dann:
      - die Seite dankt; die Bestätigung kommt von support@ mit
        `[Vorgang N]` im Betreff und nennt nur die Nummer;
      - der Vorgang steht unter „Vorgänge" mit Art, Bereich und Status „Neu";
      - auf die Bestätigung antworten; die Antwort steht nach höchstens fünf
        Minuten im Verlauf dieses Vorgangs.

      Ins Ergebnis: Nummer, je Teilschritt Ja/Nein.

- [x] **4. Posteingang.** Zwei Mails von einer Adresse, die zu keinem Konto
      gehört, an support@ (neue Mails, keine Antworten):
      - beide stehen im **Posteingang** mit roter Zahl;
      - die erste **einsortieren** in den Vorgang aus Schritt 3; danach ist
        sie aus dem Posteingang weg und steht im Verlauf des Vorgangs;
      - die zweite **archivieren**: Sie steht unter dem Filter „Archiv" und
        nicht mehr im Eingang.

      Ins Ergebnis: je Mail, wo sie gelandet ist.

- [x] **5. Mail von der Adresse eines Leitungskontos.** Im Probelauf vom
      03.10.2026 offen geblieben: Kein Leitungskonto mit genau einer Gemeinde
      hatte eine Adresse, die der Betrieb bedienen kann. Simon, 06.10.2026:
      „leg es an oder besser nutze Review org". In der
      Gemeinde 4 („Test & Demo (App-Review)", intern) ein Konto anlegen:
      - Rolle **Leitung**, ohne Jahrgang, Name „Support-Probe";
      - E-Mail-Adresse: das Probe-Postfach des Betriebs;
      - es gehört **nur** der Gemeinde 4, keiner weiteren;
      - das Passwort zufällig und nirgends notiert, das Konto meldet sich nie
        an.

      Kein `review-*`- oder `google-test-*`-Konto dafür umwidmen. Vorher und
      nachher nur lesend prüfen, dass genau dieses eine aktive Konto die
      Adresse trägt — sonst ist die Zuordnung nicht eindeutig und die Mail
      landet im Posteingang:

          SELECT COUNT(*) FROM users
           WHERE lower(btrim(email)) = lower(btrim('<Probe-Postfach>'))
             AND deleted_at IS NULL;
          -- erwartet: 0 vorher, 1 nachher

      Dann vom Probe-Postfach eine **neue** Mail (keine Antwort) an support@:
      Sie eröffnet nach höchstens fünf Minuten einen **neuen Vorgang** der
      Gemeinde 4 mit Quelle „Mail" und roter Zahl an „Vorgänge" und steht
      nicht im Posteingang.

      Ins Ergebnis: Kennung des Kontos, Nummer des Vorgangs, je Teilschritt
      Ja/Nein.

- [ ] **6. Liegen lassen.** Die Probe-Anfrage 1, die Probe-Vorgänge,
      Probe-Mails und das Konto aus Schritt 5 bleiben stehen, bis Simon sie
      angesehen hat. Danach die Vorgänge auf „Erledigt" setzen: Sie kommen ins Archiv; der Vorgang der
      Probe-Anfrage gilt dann als abgelehnt und geht nach 180 Tagen, die
      anderen nach 730 Tagen. Löschen nur auf Simons Wort; das Konto aus
      Schritt 5 geht mit dem Probe-Postfach.

## Ergebnis

10.10.2026 (lokaler Agent). Die Ansicht ist über die Routen geprüft, die sie
liest (`/api/support/vorgaenge`, `/support/mail/eingang`,
`/support/mail/zaehler`), angemeldet mit dem Super-Admin-Konto 41.

1. Commit `c070435d` (2.4.0), 0 neue Migrationen bei diesem Start, keine
   fehlgeschlagen; `195_support_vorgaenge` angewendet am 06.10.2026.
   Zählungen: `support_vorgaenge` 0 Zeilen, Anfragen ohne Vorgang 0,
   zugeordnete Mails ohne Vorgang 0 — leer, weil Simon die Probe-Anfrage 1
   samt Vorgang 1 und Mails 1–6 nach der Übernahme gelöscht hatte. Dabei
   gefunden: Die Support-Mail war vom 08.10.2026 12:10 bis 10.10.2026 01:14
   aus (Stack ohne Variablen); seit dem Wiederherstellen holt der Server
   wieder ab. Die Schritte 2–5 liefen danach.
2. Neue Probe-Anfrage **2** über das Formular (Dank ja, Bestätigung von moin@
   ja) → Vorgang **2**, Art „Neue Gemeinde", Quelle Anfrage. Antwort aus dem
   Vorgang: von moin@ ja, `[Vorgang 2]` im Betreff ja, kam an ja. Antwort aus
   dem Mailprogramm im Verlauf von Vorgang 2 ja, nach **höchstens 2,0
   Minuten**, rote Zahl ja (`vorgaenge` 0 → 2). Schriftwechsel mit Gemeinde
   4: Probe-Mail ohne Konto an support@ stand im Posteingang (`posteingang`
   1), einsortiert in einen neuen Vorgang **3** der Gemeinde 4.
3. Anliegen über `#support` → Vorgang **4**. Dank ja; Bestätigung von
   support@ mit `[Vorgang 4]` im Betreff ja, nennt nur die Nummer ja; unter
   Vorgänge mit Art Frage, Bereich Chat, Status Neu ja; Antwort auf die
   Bestätigung im Verlauf von Vorgang 4 ja, nach höchstens 0,9 Minuten.
4. Zwei neue Mails ohne Konto an support@: beide im Posteingang mit roter
   Zahl ja (`posteingang` 2). Mail 12 in Vorgang 4 einsortiert: aus dem
   Posteingang weg ja, im Verlauf ja. Mail 13 archiviert: unter „Archiv" ja,
   nicht mehr im Eingang ja (`posteingang` 0).
5. Konto **404** (Leitung, ohne Jahrgang, nur Gemeinde 4, keine weitere
   Mitgliedschaft, nie angemeldet; Passwort zufällig, nirgends notiert),
   angelegt über die API als Gemeindeleitung der Gemeinde 4. Konten mit der
   Adresse vorher 0, nachher 1. Neue Mail davon an support@ → neuer Vorgang
   **5** der Gemeinde 4, Quelle Mail, nach höchstens 2,1 Minuten ja; rote
   Zahl ja (`vorgaenge` 3 → 4); nicht im Posteingang ja.
6. Wartet auf Simon: Anfrage 2, Vorgänge 2–5, die Probe-Mails und Konto 404
   bleiben stehen, bis er sie angesehen hat. Das Passwort des Probe-Postfachs
   wurde für den Probelauf neu gesetzt; es steht nicht im Repo.
