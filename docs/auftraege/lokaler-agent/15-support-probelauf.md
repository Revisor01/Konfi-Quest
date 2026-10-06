# 15. Support-Ansicht: Test-Gemeinden ausblenden, Probe-Anfrage, Probe-Anliegen und Probe-Mails

Stand 06.10.2026. Plan und Entscheidungen:
[docs/planung/support-web.md](../../planung/support-web.md) (Entscheidungen 5
und 7) und [docs/planung/support-vorgaenge.md](../../planung/support-vorgaenge.md).
Erst **nach dem Deploy** des PRs „Web-Ansicht aller Bereiche und
Support-Vorgänge" — vorher gibt es die Vorgänge nicht (Migration 195). Wie
die Ansicht arbeitet: [docs/betrieb/support-ansicht.md](../../betrieb/support-ansicht.md).
Sind die Schritte 2 bis 4 schon erledigt (Spalte `intern` steht bei den drei
Gemeinden auf `true`), sie überspringen und das im Ergebnis sagen.

Simon (03.10.2026): „Gut wäre, wenn wir die Gemeinden Test Teamer Sicht, Test
Konfi Sicht und Admin Review Sicht nicht auf der offiziellen Liste anzeigen.
Das verwalten nur wir gemeinsam via Backend direkt." und „Ich brauche auch
eine Beispielanfrage an Support und an moin, damit ich das mal sehe."

> **Die Konten `review-*` und `google-test-*` nicht benutzen** — weder zum
> Anmelden noch als Absender. Keine Adressen, Namen oder Passwörter ins Repo
> oder ins Ergebnis; dort stehen Kennungen, Zahlen und Ja/Nein.

## Was zu tun ist

- [ ] **1. Deploy prüfen.** `GET /api/status`: Version und Commit wie der
      Merge, Migrationen ohne Fehler, `195_support_vorgaenge` unter den
      angewendeten. Dann nur lesend:

          SELECT quelle, status, COUNT(*) FROM support_vorgaenge GROUP BY 1, 2 ORDER BY 1, 2;
          SELECT COUNT(*) FROM gemeinde_anfragen a
           WHERE NOT EXISTS (SELECT 1 FROM support_vorgaenge v WHERE v.anfrage_id = a.id);
          -- erwartet: 0 (jede Anfrage hat ihren Vorgang)

      Ins Ergebnis: Commit, Zahl der neuen Migrationen, die Zählung.

- [ ] **2. Die drei Gemeinden nur lesend ermitteln.**

          SELECT id, name, display_name, is_active, intern
            FROM organizations
           WHERE display_name IN ('Test Teamer Sicht', 'Test Konfi Sicht', 'Admin Review Sicht')
              OR name IN ('Test Teamer Sicht', 'Test Konfi Sicht', 'Admin Review Sicht');

      Erwartet: genau drei Zeilen. Weichen die Namen ab oder sind es mehr oder
      weniger als drei: **anhalten und Simon fragen**. Ins Ergebnis: die drei
      Kennungen.

- [ ] **3. Als intern markieren.** Vorher die Tabelle sichern
      (`pg_dump --table=organizations --data-only`), dann in einer
      Transaktion:

          BEGIN;
          UPDATE organizations SET intern = true WHERE id IN (<die drei Kennungen>);
          -- erwartet: UPDATE 3
          COMMIT;

      Nichts sonst an diesen Gemeinden ändern (aktiv, Laufzeit, Konten
      bleiben, wie sie sind — die Store-Prüfungen brauchen sie). Ins
      Ergebnis: `UPDATE 3` ja/nein.

- [ ] **4. Ausblenden prüfen.** In der Support-Ansicht (eigenes
      Super-Admin-Konto) unter „Gemeinden" und auf der Übersicht: Die drei
      stehen nicht mehr da, die Zahl „Gemeinden gesamt" ist um drei kleiner
      als vor Schritt 3. Ins Ergebnis: Zahl vorher/nachher.

- [ ] **5. Posteingang eingerichtet** (Auftrag 14, Schritt 6): Unter
      „Posteingang" zeigen beide Postfächer „eingerichtet", „zuletzt
      abgeholt" innerhalb der letzten fünf Minuten, kein Fehler. Ins
      Ergebnis: je Postfach Ja/Nein, ein Fehlertext ohne Adressen.

- [ ] **6. Probe-Anfrage an moin@.** Auf der Homepage das Formular
      „Konfi Quest für eure Gemeinde anfragen" ausfüllen: Gemeinde „Probe – bitte nicht
      bearbeiten", Kontakt mit einer eigenen Adresse des Betriebs,
      Wunschlizenz „Standard". Dann in der Support-Ansicht:
      - die Anfrage steht unter „Vorgänge" mit der Art „Neue Gemeinde" und
        auf der Übersicht unter „Neueste Vorgänge";
      - aus dem Vorgang mit dem Baustein „Eingang bestätigt / Rückfrage"
        antworten; die Mail kommt an, trägt `[Vorgang N]` im Betreff und die
        Fußzeile; sie liegt bei moin@ unter „Sent";
      - im Mailprogramm auf diese Mail antworten; nach höchstens fünf Minuten
        steht die Antwort im Verlauf des Vorgangs, mit roter Zahl an
        „Vorgänge".

      Ins Ergebnis: Nummer des Vorgangs, je Teilschritt Ja/Nein, Minuten bis
      zur Zuordnung.

- [ ] **6a. Probe-Anliegen über das Support-Formular.** Auf der Homepage unter
      „Hilfe und Support" (`#support`) ausfüllen: Gemeinde „Probe – bitte
      nicht bearbeiten", eine eigene Adresse des Betriebs, Art „Frage zur
      Bedienung", Bereich „Chat", Betreff „Probe". Dann:
      - die Seite dankt; die Bestätigung kommt von support@ mit
        `[Vorgang N]` im Betreff und nennt nur die Nummer;
      - der Vorgang steht unter „Vorgänge" mit Art, Bereich und Status „Neu";
      - auf die Bestätigung antworten; die Antwort steht nach höchstens fünf
        Minuten im Verlauf dieses Vorgangs.

      Ins Ergebnis: Nummer, je Teilschritt Ja/Nein.

- [ ] **7. Probe-Mails an support@.**
      - Eine Mail von der Adresse eines Gemeindeleitungs-Kontos, das genau
        einer Gemeinde angehört (nicht `review-*`/`google-test-*`): Sie
        eröffnet einen **neuen Vorgang** dieser Gemeinde (Quelle Mail).
      - Eine Mail von einer Adresse, die zu keinem Konto gehört: Sie steht
        im **Posteingang** mit roter Zahl. Von dort **Einsortieren** in den
        Vorgang aus Schritt 6a; danach ist sie aus dem Posteingang weg und
        steht im Verlauf des Vorgangs.
      - Eine zweite Mail von einer unbekannten Adresse **archivieren**: Sie
        steht unter dem Filter „Archiv" und nicht mehr im Eingang.

      Ins Ergebnis: je Mail, wo sie gelandet ist.

- [ ] **8. Liegen lassen.** Probe-Vorgänge und Probe-Mails bleiben stehen,
      bis Simon sie angesehen hat. Danach auf „Erledigt" setzen (sie kommen
      ins Archiv; der Vorgang der Probe-Anfrage gilt dann als abgelehnt und
      geht nach 180 Tagen, die anderen nach 730) — löschen nur auf Simons
      Wort.

## Ergebnis

(offen)
