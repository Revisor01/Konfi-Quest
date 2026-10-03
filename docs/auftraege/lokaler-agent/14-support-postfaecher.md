# 14. Postfächer moin@ und support@ für die Support-Ansicht einrichten

Stand 03.10.2026. Simon hat entschieden („Du darfst alle lesen auch schicken
etc."); der Plan steht in
[docs/planung/support-mail.md](../../planung/support-mail.md).

Konfi Quest liest die Postfächer `moin@konfi-quest.de` (Anfragen) und
`support@konfi-quest.de` (Gemeinden) **nur lesend** mit, sortiert die Mails in
der Support-Ansicht und schickt Antworten von dort. Ohne die Variablen unten
bleibt das aus; die Support-Ansicht sagt dann „noch nicht eingerichtet".

> **Keine Werte in dieses Repo, in Commit-Messages oder ins Ergebnis.**
> Passwörter, Hosts und IP-Adressen stehen nur in Portainer. Im Ergebnis
> stehen Variablennamen und Ja/Nein.

## Was zu tun ist

- [ ] **1. Postfächer prüfen.** Sind `moin@` und `support@` echte Postfächer
      mit eigener IMAP-Anmeldung (nicht nur Weiterleitungen oder Aliase)?
      Ins Ergebnis: je Ja/Nein. Ist eines nur eine Weiterleitung: Simon
      fragen, bevor etwas umgestellt wird.

- [ ] **2. IMAP-Server ermitteln.** Liegt IMAP auf demselben Server wie der
      bisherige Versand (`SMTP_HOST`)? Dann ist `MAIL_IMAP_HOST` derselbe
      Name, und der `extra_hosts`-Eintrag der Backends deckt ihn schon ab.
      Sonst braucht jeder Backend-Dienst eine weitere `extra_hosts`-Zeile
      für den IMAP-Host (wie die für `SMTP_HOST`). Zertifikat prüfen:

          openssl s_client -connect <MAIL_IMAP_HOST>:993 -servername <MAIL_IMAP_HOST> </dev/null

      Ins Ergebnis: gleicher Server ja/nein, Zertifikat passt ja/nein.

- [ ] **3. Stack-Variablen in Portainer setzen** (Stack 249):
      `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT` (nur wenn nicht 993),
      `MAIL_MOIN_USER`, `MAIL_MOIN_PASS`, `MAIL_SUPPORT_USER`,
      `MAIL_SUPPORT_PASS`. Verschickt der Mailserver für diese Postfächer
      über einen anderen SMTP-Host als `SMTP_HOST`, zusätzlich
      `MAIL_SMTP_HOST` (und `MAIL_SMTP_PORT`).

- [ ] **4. Stack-Datei ergänzen.** In der Stack-Datei in Portainer im Block
      `environment: &backend_env` dieselben Zeilen eintragen wie in der
      Referenzkopie [deploy/compose.konfi_quest.yml](../../../deploy/compose.konfi_quest.yml)
      (Abschnitt „Support-Mail"). Erst nach dem Merge des PRs „Support-Mail"
      aktiv; vorher schaden die Zeilen nicht.

- [ ] **5. Anmeldung prüfen, ohne Mails zu lesen.** Mit `EXAMINE` statt
      `SELECT` (nur lesen, keine Flags):

          openssl s_client -quiet -connect <MAIL_IMAP_HOST>:993 -servername <MAIL_IMAP_HOST>
          a LOGIN <MAIL_MOIN_USER> <MAIL_MOIN_PASS>
          b EXAMINE INBOX
          c LIST "" "*"
          d LOGOUT

      Dasselbe für `support@`. Ins Ergebnis: Anmeldung ok ja/nein, ob die
      `LIST`-Antwort einen Ordner mit `\Sent` nennt (dort legt Konfi Quest
      gesendete Antworten ab) und dessen Name.

- [ ] **6. Nach dem Deploy des PRs „Support-Mail"** in der Support-Ansicht
      unter „Posteingang" ablesen: beide Postfächer „eingerichtet", „zuletzt
      abgeholt" innerhalb der letzten fünf Minuten, kein Fehler. Ins
      Ergebnis: je Postfach Ja/Nein und, falls ein Fehler dasteht, sein Text
      ohne Adressen.

## Ergebnis

(vom lokalen Agenten auszufüllen)
