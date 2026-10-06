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

- [x] **1. Deploy prüfen.** `GET /api/status`: Version und Commit wie der
      Merge, Migrationen ohne Fehler, `194_…` unter den neuen. Ins Ergebnis:
      Commit, Zahl der neuen Migrationen.

- [x] **2. Die drei Gemeinden nur lesend ermitteln.**

          SELECT id, name, display_name, is_active, intern
            FROM organizations
           WHERE display_name IN ('Test Teamer Sicht', 'Test Konfi Sicht', 'Admin Review Sicht')
              OR name IN ('Test Teamer Sicht', 'Test Konfi Sicht', 'Admin Review Sicht');

      Erwartet: genau drei Zeilen. Weichen die Namen ab oder sind es mehr oder
      weniger als drei: **anhalten und Simon fragen**. Ins Ergebnis: die drei
      Kennungen.

- [x] **3. Als intern markieren.** Vorher die Tabelle sichern
      (`pg_dump --table=organizations --data-only`), dann in einer
      Transaktion:

          BEGIN;
          UPDATE organizations SET intern = true WHERE id IN (<die drei Kennungen>);
          -- erwartet: UPDATE 3
          COMMIT;

      Nichts sonst an diesen Gemeinden ändern (aktiv, Laufzeit, Konten
      bleiben, wie sie sind — die Store-Prüfungen brauchen sie). Ins
      Ergebnis: `UPDATE 3` ja/nein.

- [x] **4. Ausblenden prüfen.** In der Support-Ansicht (eigenes
      Super-Admin-Konto) unter „Gemeinden" und auf der Übersicht: Die drei
      stehen nicht mehr da, die Zahl „Gemeinden gesamt" ist um drei kleiner
      als vor Schritt 3. Ins Ergebnis: Zahl vorher/nachher.

- [x] **5. Posteingang eingerichtet** (Auftrag 14, Schritt 6): Unter
      „Posteingang" zeigen beide Postfächer „eingerichtet", „zuletzt
      abgeholt" innerhalb der letzten fünf Minuten, kein Fehler. Ins
      Ergebnis: je Postfach Ja/Nein, ein Fehlertext ohne Adressen.

- [x] **6. Probe-Anfrage an moin@.** Auf der Homepage das Formular
      „Konfi Quest für eure Gemeinde anfragen" ausfüllen: Gemeinde „Probe – bitte nicht
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

03.10.2026 (lokaler Agent):

1. Commit `2a28296` (Merge #220), Version 2.4.0, 1 neue Migration
   (`194_organisation_intern.sql`), keine fehlgeschlagen.
2. Die Namen weichen ab: 0 Treffer auf die Abfrage. In Produktion heißen sie
   „Test: Konfi-Sicht" (14), „Test: Teamer-Sicht" (15) und „Test & Demo
   (App-Review)" (4); eine „Admin Review Sicht" gibt es nicht. Simon hat 4,
   14 und 15 bestätigt.
3. Tabelle vorher gesichert (8 Zeilen), `UPDATE 3` ja. Sonst nichts geändert,
   alle drei bleiben aktiv.
4. Gemeinden gesamt vorher 8 (in der Datenbank mit derselben Bedingung
   gezählt), nachher 5 (`GET /support/uebersicht`); `GET /support/gemeinden`
   liefert 1, 2, 3, 5, 6.
5. moin@ ja, support@ ja — beide eingerichtet, zuletzt vor unter zwei Minuten
   abgeholt, kein Fehler.
6. Anfrage **1**. Kontaktadresse ist ein eigens angelegtes Postfach des
   Betriebs (wird nach Schritt 8 gelöscht). Formular ja (Dank-Meldung,
   Bestätigung kam an); steht unter „Anfragen" ja (offen: 1); Antwort mit
   Baustein 1 ja, kam an ja, `[Anfrage 1]` im Betreff ja, Fußzeile ja, bei
   moin@ unter „Sent" ja; Antwort aus dem Mailprogramm an der Anfrage ja
   (Zähler `je_anfrage` 1: 1), unter „Alle" mit Zuordnung ja — **1,6 Minuten**
   bis zur Zuordnung. Simon hat zur Anfrage selbst schon eine Antwort
   geschickt (Mail 2).
7. Probe-Mails an support@:
   - **7a offen.** Kein Gemeindeleitungs-Konto, das genau einer Gemeinde
     angehört, hat eine Adresse, die der Betrieb bedienen kann: Simons Konto
     (41) gehört mehreren Gemeinden an, die übrigen Adressen gehören echten
     Personen. Braucht Simons Entscheidung (etwa ein Testkonto in einer
     internen Gemeinde mit der Adresse des Probe-Postfachs).
   - 7b: Mail ohne Konto stand unter „Nicht zugeordnet" (Zähler `eingang` 1),
     von dort der Gemeinde 4 zugeordnet; jetzt dort im Schriftwechsel
     (Zähler `je_gemeinde` 4: 1) und unter „Alle".
8. Liegt bis zu Simons Blick.
