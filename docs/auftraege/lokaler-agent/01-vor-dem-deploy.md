# 01 — Vor dem Deploy von 2.3.0

Alles hier geschieht, **bevor** der Release-Stand nach `main` geht und der
Deploy-Job läuft. Der Deploy spielt die Migrationen 160–168 ein; einige davon
ändern Daten (165 leert `konfi_profiles.password_plain`, 163 füllt
`user_activities` nach). Die Zählungen unten sind die Vorher-Werte dafür.

## 1. Sicherung

- [ ] Datenbank und Uploads nach [docs/betrieb/sicherung.md](../../betrieb/sicherung.md)
      sichern (`deploy/sicherung.sh`), die Stack-Definition aus Portainer
      exportieren. Größe und Zeitpunkt der Sicherung notieren (außerhalb des
      Repos), hier nur „erledigt, Dump N MB".

## 2. Mail-Versand (SMTP)

Die Compose-Referenz verlangt Mail-Host, Mail-Login und die Host-IP als
Stack-Variablen; ohne sie bricht `docker compose` mit „SMTP_HOST fehlt" ab
(`${SMTP_HOST:?…}`). Das Backend prüft das Zertifikat des Mail-Servers
standardmäßig streng.

- [ ] In Portainer als Stack-Variablen setzen: `SMTP_HOST`, `SMTP_USER`,
      `SMTP_HOST_IP` (für `extra_hosts`), `SMTP_PASS` prüfen. Werte nur in
      Portainer, nirgends im Repo.
- [ ] Zertifikat gegen den Hostnamen prüfen:
      ```
      openssl s_client -connect "<SMTP_HOST>:465" -servername "<SMTP_HOST>" </dev/null 2>/dev/null \
        | openssl x509 -noout -subject -ext subjectAltName -dates
      ```
      Der Hostname muss im `subjectAltName` stehen, das Zertifikat gültig sein.
      Wenn nicht: erst das Zertifikat richten. `SMTP_TLS_REJECT_UNAUTHORIZED=false`
      nur als befristeter Notnagel, mit Datum im Ergebnis vermerken und Simon
      Bescheid geben.
- [ ] Absender klären (Doku BF-20): Der Code nimmt `SMTP_FROM`, sonst
      `Konfi Quest <SMTP_USER>` (`backend/services/emailService.js`). Das
      Handbuch (`docs/handbuch/35-passwoerter.md`) nennt eine `moin@`-Adresse
      als Absender. Welche Adresse steht heute in Produktion? Simon fragen,
      welche gelten soll; dann entweder `SMTP_FROM` setzen oder das Handbuch
      angleichen — mit Generatorlauf nach CLAUDE.md.
- [ ] Nach dem Deploy (siehe [03](03-nach-dem-deploy.md)): eine echte Mail
      auslösen (Passwort vergessen mit einem Testkonto) und Absender, Zustellung
      und Zeit notieren.

## 3. Zählungen vor den datenändernden Migrationen

- [ ] `SELECT count(*) FILTER (WHERE password_plain IS NOT NULL) FROM konfi_profiles;`
      — Anzahl der noch im Klartext gespeicherten Konfi-Passwörter
      (Sicherheit S-01). Migration 165 leert sie; nach dem Deploy muss 0
      stehen.
- [ ] `SELECT count(*) FROM user_activities;` — Migration 163 füllt nach;
      gemessen 13 s bei 1 Mio. Zeilen, der Migrationslauf hat kein 30-s-Limit
      mehr, sollte aber im Rahmen bleiben. Bei deutlich mehr als 1 Mio. Zeilen
      Simon vor dem Deploy fragen.

## 4. Vorher-Messungen

Die Gesamtabnahme (`docs/audit/2026-09-26/00-gesamtabnahme.md`, Abschnitt
„Auf Produktion nachzumessen") listet 17 Messungen. Vor dem Deploy zählen, was
der Deploy ändert, damit es einen Vergleich gibt:

- [ ] Nr. 3: Super-Admin-Konten mit gesetzter Gemeinde (Liste der IDs, keine Namen ins Repo).
- [ ] Nr. 4: Direktchats mit mehr als zwei Personen.
- [ ] Nr. 5: Vortags-Erinnerungen je Stunde (dominiert 00:00?).
- [ ] Nr. 6: letzte fünf Einträge in `schema_migrations`, Anzahl `Migration FAILED` im Log.
- [ ] Nr. 7: Image-Tag von `backend-test` im Live-Stack (`test-latest` oder ein SHA?).
- [ ] Nr. 12: soft-gelöschte Konten mit Anmeldung nach dem Löschen.
- [ ] Nr. 13: offene Refresh-Tokens je Konto (Top 20, nur Zahlen).
- [ ] Nr. 15: `GET /api/status` → `version` (erwartet vor dem Deploy `1.0.1`) und `node -v` im Backend-Container.

## 5. Platz für Postgres

- [ ] Prüfen, dass der Host für Postgres 2 CPU und 3 GB **zusätzlich** zum
      heutigen Stand frei hat (`docker stats`, `free -m`, `nproc`). Die
      Anpassung selbst steht in [02](02-portainer-stack.md).
