# 16. Support-Vorgänge: Übernahme prüfen, Probe-Anliegen und Probe-Mails

Stand 06.10.2026. Plan und Entscheidungen:
[docs/planung/support-vorgaenge.md](../../planung/support-vorgaenge.md); wie
die Ansicht arbeitet:
[docs/betrieb/support-ansicht.md](../../betrieb/support-ansicht.md). Erst
**nach dem Deploy** des PRs „Web-Ansicht aller Bereiche und
Support-Vorgänge" — vorher gibt es die Vorgänge nicht (Migration 195).
Baut auf [Auftrag 15](15-support-probelauf.md) auf: Probe-Anfrage 1 und die
Probe-Mails von dort liegen noch und werden jetzt zu Vorgängen.

> **Die Konten `review-*` und `google-test-*` nicht benutzen** — weder zum
> Anmelden noch als Absender. Keine Adressen, Namen oder Passwörter ins Repo
> oder ins Ergebnis; dort stehen Kennungen, Zahlen und Ja/Nein.

## Was zu tun ist

- [ ] **1. Deploy und Übernahme prüfen.** `GET /api/status`: Version und
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

- [ ] **2. Die Probe-Anfrage als Vorgang.** In der Support-Ansicht unter
      „Vorgänge": Anfrage 1 steht als Vorgang der Art „Neue Gemeinde" mit
      ihren Mails im Verlauf; der Schriftwechsel mit Gemeinde 4 aus Auftrag
      15 (7b) steht als eigener Vorgang. Aus dem Vorgang der Anfrage
      antworten: Der Betreff trägt jetzt `[Vorgang N]`, die Mail geht von
      moin@. Im Mailprogramm darauf antworten; nach höchstens fünf Minuten
      steht die Antwort im Verlauf, mit roter Zahl an „Vorgänge".

      Ins Ergebnis: die Nummern der beiden Vorgänge, je Teilschritt Ja/Nein,
      Minuten bis zur Zuordnung.

- [ ] **3. Probe-Anliegen über das Support-Formular.** Auf der Homepage unter
      „Hilfe und Support" (`#support`) ausfüllen: Gemeinde „Probe – bitte
      nicht bearbeiten", das Probe-Postfach des Betriebs aus Auftrag 15, Art
      „Frage zur Bedienung", Bereich „Chat", Betreff „Probe". Dann:
      - die Seite dankt; die Bestätigung kommt von support@ mit
        `[Vorgang N]` im Betreff und nennt nur die Nummer;
      - der Vorgang steht unter „Vorgänge" mit Art, Bereich und Status „Neu";
      - auf die Bestätigung antworten; die Antwort steht nach höchstens fünf
        Minuten im Verlauf dieses Vorgangs.

      Ins Ergebnis: Nummer, je Teilschritt Ja/Nein.

- [ ] **4. Posteingang.** Zwei Mails von einer Adresse, die zu keinem Konto
      gehört, an support@ (neue Mails, keine Antworten):
      - beide stehen im **Posteingang** mit roter Zahl;
      - die erste **einsortieren** in den Vorgang aus Schritt 3; danach ist
        sie aus dem Posteingang weg und steht im Verlauf des Vorgangs;
      - die zweite **archivieren**: Sie steht unter dem Filter „Archiv" und
        nicht mehr im Eingang.

      Ins Ergebnis: je Mail, wo sie gelandet ist.

- [ ] **5. (Nur mit Simons Konto-Entscheidung aus Auftrag 15, 7a.)** Eine
      Mail von der Adresse eines Leitungskontos, das genau einer Gemeinde
      angehört: Sie eröffnet einen **neuen Vorgang** dieser Gemeinde (Quelle
      Mail). Ohne ein solches Konto: auslassen und im Ergebnis sagen.

- [ ] **6. Liegen lassen.** Die Probe-Vorgänge und Probe-Mails bleiben stehen,
      bis Simon sie angesehen hat. Danach auf „Erledigt" setzen: Sie kommen
      ins Archiv; der Vorgang der Probe-Anfrage gilt dann als abgelehnt und
      geht nach 180 Tagen, die anderen nach 730 Tagen. Löschen nur auf Simons
      Wort.

## Ergebnis

(offen)
