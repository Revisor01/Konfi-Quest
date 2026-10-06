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

- [ ] **5. Mail von der Adresse eines Leitungskontos.** Simon, 06.10.2026,
      zu Auftrag 15, 7a: „leg es an oder besser nutze Review org". In der
      Gemeinde 4 („Test & Demo (App-Review)", intern) ein Konto anlegen:
      - Rolle **Leitung**, ohne Jahrgang, Name „Support-Probe";
      - E-Mail-Adresse: das Probe-Postfach des Betriebs aus Auftrag 15
        (Schritt 6);
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

- [ ] **6. Liegen lassen.** Die Probe-Vorgänge, Probe-Mails und das Konto
      aus Schritt 5 bleiben stehen, bis Simon sie angesehen hat. Danach die
      Vorgänge auf „Erledigt" setzen: Sie kommen ins Archiv; der Vorgang der
      Probe-Anfrage gilt dann als abgelehnt und geht nach 180 Tagen, die
      anderen nach 730 Tagen. Löschen nur auf Simons Wort; das Konto aus
      Schritt 5 geht mit dem Probe-Postfach.

## Ergebnis

(offen)
