# 15. Support-Ansicht: Test-Gemeinden ausblenden, Probe-Anfrage und Probe-Mails

Stand 03.10.2026. Plan und Entscheidungen:
[docs/planung/support-web.md](../../planung/support-web.md) (Entscheidungen 5
und 7). Erst **nach dem Deploy** des PRs „Support-Mail und Web-Ansicht" —
vorher gibt es die Spalte `organizations.intern` nicht (Migration 194).

Simon (03.10.2026): „Gut wäre, wenn wir die Gemeinden Test Teamer Sicht, Test
Konfi Sicht und Admin Review Sicht nicht auf der offiziellen Liste anzeigen.
Das verwalten nur wir gemeinsam via Backend direkt." und „Ich brauche auch
eine Beispielanfrage an Support und an moin, damit ich das mal sehe."

> **Die Konten `review-*` und `google-test-*` nicht benutzen** — weder zum
> Anmelden noch als Absender. Keine Adressen, Namen oder Passwörter ins Repo
> oder ins Ergebnis; dort stehen Kennungen, Zahlen und Ja/Nein.

## Was zu tun ist

- [ ] **1. Deploy prüfen.** `GET /api/status`: Version und Commit wie der
      Merge, Migrationen ohne Fehler, `194_…` unter den neuen. Ins Ergebnis:
      Commit, Zahl der neuen Migrationen.

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
      „Gemeinde anfragen" ausfüllen: Gemeinde „Probe – bitte nicht
      bearbeiten", Kontakt mit einer eigenen Adresse des Betriebs,
      Wunschlizenz „Standard". Dann in der Support-Ansicht:
      - die Anfrage steht unter „Anfragen" und auf der Übersicht unter
        „Neueste Anfragen";
      - aus der Anfrage mit dem Baustein „Eingang bestätigt / Rückfrage"
        antworten; die Mail kommt an, trägt `[Anfrage N]` im Betreff und die
        Fußzeile; sie liegt bei moin@ unter „Sent";
      - im Mailprogramm auf diese Mail antworten; nach höchstens fünf Minuten
        steht die Antwort an der Anfrage (rote Zahl) und im Posteingang unter
        „Alle" mit Zuordnung zur Anfrage.

      Ins Ergebnis: Kennung der Anfrage, je Teilschritt Ja/Nein, Minuten bis
      zur Zuordnung.

- [ ] **7. Probe-Mails an support@.**
      - Eine Mail von der Adresse eines Gemeindeleitungs-Kontos, das genau
        einer Gemeinde angehört (nicht `review-*`/`google-test-*`): Sie steht
        im Schriftwechsel dieser Gemeinde und im Posteingang unter „Alle".
      - Eine Mail von einer Adresse, die zu keinem Konto gehört: Sie steht
        unter „Nicht zugeordnet" mit roter Zahl; von dort der Gemeinde der
        Probe-Anfrage oder einer anderen Gemeinde zuordnen.

      Ins Ergebnis: je Mail, wo sie gelandet ist.

- [ ] **8. Liegen lassen.** Probe-Anfrage und Probe-Mails bleiben stehen,
      bis Simon sie angesehen hat. Danach die Anfrage ablehnen (sie wird
      nach 180 Tagen gelöscht) — löschen nur auf Simons Wort.

## Ergebnis

(offen)
