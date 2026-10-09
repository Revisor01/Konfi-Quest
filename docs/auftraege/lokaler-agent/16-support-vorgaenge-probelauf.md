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

- [ ] **2. Die Probe-Anfrage als Vorgang.** In der Support-Ansicht unter
      „Vorgänge": Anfrage 1 steht als Vorgang der Art „Neue Gemeinde" mit
      ihren Mails im Verlauf; der Schriftwechsel mit Gemeinde 4 (die
      zugeordnete Probe-Mail von oben) steht als eigener Vorgang. Aus dem Vorgang der Anfrage
      antworten: Der Betreff trägt jetzt `[Vorgang N]`, die Mail geht von
      moin@. Im Mailprogramm darauf antworten; nach höchstens fünf Minuten
      steht die Antwort im Verlauf, mit roter Zahl an „Vorgänge".

      Ins Ergebnis: die Nummern der beiden Vorgänge, je Teilschritt Ja/Nein,
      Minuten bis zur Zuordnung.

- [ ] **3. Probe-Anliegen über das Support-Formular.** Auf der Homepage unter
      „Hilfe und Support" (`#support`) ausfüllen: Gemeinde „Probe – bitte
      nicht bearbeiten", das Probe-Postfach des Betriebs, Art
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

- [ ] **5. Mail von der Adresse eines Leitungskontos.** Im Probelauf vom
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

10.10.2026 (lokaler Agent) — **angehalten nach Schritt 1**, Schritte 2 bis 5
nicht begonnen, in Produktion nichts geschrieben:

1. Commit `c070435d` (2.4.0; `90eb5b17` danach ändert nur Doku), 0 neue
   Migrationen bei diesem Start, keine fehlgeschlagen; `195_support_vorgaenge`
   angewendet am 06.10.2026 11:19. Zählungen: `support_vorgaenge` **0 Zeilen**,
   Anfragen ohne Vorgang 0, zugeordnete Mails ohne Vorgang 0 — die beiden
   Nullen stimmen nur, weil nichts mehr da ist. Seit dem Start der Datenbank
   (vor 9 Tagen) zeigt die Statistik je Tabelle so viele Löschungen wie
   Einfügungen: Anfragen 1/1, Vorgänge 1/1, Mails 6/6. Die Probe-Anfrage 1
   wurde also nach der Übernahme am 06.10.2026 gelöscht, ihr Vorgang 1 und
   die Mails 1–6 gingen mit; wer, ist nicht feststellbar (die
   Server-Protokolle enden mit dem Neustart der Container). In den
   Postfächern liegen die Mails noch.
2. **Nicht möglich:** Anfrage 1 und der Schriftwechsel mit Gemeinde 4 sind
   nicht mehr da (oben).
3. bis 5. **Zurückgestellt:** Die Support-Mail ist in Produktion seit
   08.10.2026 12:10 ganz aus. Im Stack gibt es keine Variablen mehr (die
   Portainer-API meldet für den Stack eine leere Liste), in beiden Backends
   sind `MAIL_IMAP_HOST`, `MAIL_MOIN_USER/_PASS` und
   `MAIL_SUPPORT_USER/_PASS` leer. Letzte Abholung beider Postfächer
   08.10.2026 12:09, seitdem keine (rund 46 Stunden); es war der erste
   Deploy nach dem Neustart von Portainer am selben Morgen. Damit
   holt der Server keine Mails, Antworten aus der Support-Ansicht scheitern,
   und die Bestätigung eines Anliegens fällt still weg (503 wird nicht
   wiederholt). Seit dem Ausfall ist in keinem der beiden Postfächer eine
   Mail eingegangen, verpasst wurde also nichts. Schritte 3–5 jetzt
   auszuführen, hinterließe Vorgänge ohne Bestätigung, auf die sich nicht
   antworten lässt. Das Probe-Postfach des Betriebs besteht noch; das Konto
   aus Schritt 5 ist nicht angelegt.

Weiter, sobald Simon die Variablen im Stack wiederhergestellt hat (Prüfung:
„zuletzt abgeholt" unter Posteingang jünger als fünf Minuten) und
entschieden hat, ob für Schritt 2 eine neue Probe-Anfrage entsteht.
