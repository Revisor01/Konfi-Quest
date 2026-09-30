# 09 — Backend-Container: Healthcheck und Nutzer ohne root (CI BF-06)

Nach dem Deploy des Stands vom 29.09.2026. Befund: CI BF-06 in
`docs/audit/2026-09-26/ci-deployment-store.md`.

## Stand im Repo (29.09.2026)

Das Backend-Image enthält nur noch, was zur Laufzeit gebraucht wird
(`backend/Dockerfile`, `backend/.dockerignore`): `npm ci --omit=dev` aus dem
Lockfile, schlankes Basis-Image, keine Tests, kein Schema-Dump, kein Compiler.
Lokal gemessen am selben Commit: 1,92 GB → 486 MB.

Zwei Dinge sind bewusst **nicht** im Image umgestellt, weil sie am Stack
hängen, der nicht im Repo liegt:

1. **Healthcheck.** Der Stack prüft `backend`, `backend2` und `backend-test`
   mit `curl -f http://localhost:5000/api/health`. Das schlanke Image hat kein
   curl; es wird deshalb eigens nachinstalliert. Das Image selbst prüft mit
   `node healthcheck.js`.
2. **Nutzer.** Der Prozess läuft weiter als root. Lokal nachgewiesen
   (Volume mit root-Dateien wie in Produktion, dasselbe Image):

   | Lauf | `/api/health` | Upload schreiben | Bestand lesen | Zwischenlager aufräumen | Firebase-Schlüssel (0600 root) |
   |---|---|---|---|---|---|
   | als root (heute) | 200 | ok | ok | ok | lesbar |
   | als `node`, Bestand gehört root | **200** | **EACCES** | ok | **bleibt liegen** | **EACCES** |
   | als `node` nach `chown -R 1000:1000`, Schlüssel `0640 root:1000` | 200 | ok | ok | ok | lesbar |

   Wichtig: Der Healthcheck bleibt beim falschen Besitzer **grün**. Ein
   Deploy, der nur `/api/health` und `/api/status` prüft, merkt nicht, dass
   Uploads und Push scheitern.

## 1. Healthcheck im Stack auf `node healthcheck.js`

- [x] Im Portainer-Stack bei `backend`, `backend2` und `backend-test`
      `healthcheck.test` auf `["CMD", "node", "healthcheck.js"]` stellen
      (Intervall, Timeout, Wiederholungen unverändert). Dieselbe Änderung in
      `deploy/compose.konfi_quest.yml` als Pull Request.
      **Ergebnis 01.10.2026:** zusammen mit `user:` (Abschnitt 2) in zwei
      Stack-Updates ohne Pull, erst `backend` + `backend-test`, dann
      `backend2` — die jeweils andere Replica trug den Verkehr. Gemessen von
      außen im 0,3-s-Takt: 0 Antworten ≠ 200 auf `/api/status` und `/`
      (87 bzw. 96 Proben); Postgres und Frontend nicht neu erstellt. Vorher im
      laufenden Image geprüft: `node healthcheck.js` → Exit 0.
- [x] Nach dem Stack-Update: alle drei Container `healthy`
      (`docker inspect --format '{{.State.Health.Status}}'`).
      **Ergebnis 01.10.2026:** alle drei `healthy`, 5–10 s nach dem Start;
      ebenso nach dem Neuaufbau aller Container beim Test mit
      `pullImage: true` (Auftrag 10).
- [x] Erst danach im Repo die curl-Zeile aus `backend/Dockerfile` nehmen. Der
      Test `frontend/src/__tests__/betrieb/backendImage.test.ts` verlangt curl,
      solange die Referenz-Compose curl benutzt — beides im selben PR ändern.
      **Ergebnis 01.10.2026:** Branch `betrieb/deploy-luecke-container`:
      curl-Installation raus, Referenz auf `node healthcheck.js`; der Test
      verlangt jetzt `node healthcheck.js` in allen drei Backend-Blöcken und
      kein curl im Image, dazu `user: "1000:1000"` dreimal. Wirkt mit dem
      ersten Deploy nach dem Merge (das neue Image hat kein curl mehr — der
      Stack prüft schon ohne).

## 2. Backend als `node` (uid 1000) statt root

Vorher sichern (Uploads nach [docs/betrieb/sicherung.md](../../betrieb/sicherung.md))
und den Stand der Stack-Definition exportieren.

- [x] Besitz ablesen, nichts ändern:
      `stat -c '%U:%G %a' <UPLOADS_VERZ> <UPLOADS_VERZ>/*` und
      `find <UPLOADS_VERZ> ! -user root | head`,
      dazu die Schlüsseldatei `<FIREBASE_SCHLUESSEL>`: Besitz und Rechte.
      Anzahl Dateien und Größe notieren (`find … | wc -l`, `du -sh`).
      **Ergebnis 01.10.2026:** Verzeichnis und alles darin `root:root`
      (Verzeichnisse 755, Dateien 644), 0 Einträge nicht root, 411 Dateien,
      237 MB. Schlüsseldatei `root:root 644` — also schon vorher für alle
      lesbar, nicht 0600 wie lokal nachgestellt.
- [x] Ein Wartungsfenster mit Simon abstimmen (kurz: `chown` über alle Dateien
      dauert je nach Anzahl Sekunden bis Minuten; Uploads in dieser Zeit
      können scheitern).
      **Ergebnis 01.10.2026:** nachts (00:28–00:32 MESZ) im Auftrag der
      Koordination; das `chown` dauerte 0,03 s.
- [x] `chown -R 1000:1000 <UPLOADS_VERZ>` und für den Schlüssel
      `chgrp 1000 <FIREBASE_SCHLUESSEL> && chmod 640 <FIREBASE_SCHLUESSEL>`
      (Besitzer bleibt root, lesen darf die Gruppe 1000). Laufende Container
      als root können danach weiter schreiben — der Schritt ist für den
      heutigen Stand unschädlich.
      **Ergebnis 01.10.2026:** erledigt; der Schlüssel steht jetzt auf
      `root:1000 640` (vorher 644 für alle). Hinweis für den Betrieb: uid/gid
      1000 gehört am Host einem bestehenden Systemnutzer — er kann Uploads und
      Schlüssel jetzt lesen (vorher konnte es jeder Nutzer am Host).
- [x] Im Stack bei `backend`, `backend2`, `backend-test`: `user: "1000:1000"`.
      Stack aktualisieren. Direkt danach `chown -R 1000:1000 <UPLOADS_VERZ>`
      ein zweites Mal: Was die alten root-Container zwischen dem ersten
      `chown` und dem Tausch noch geschrieben haben, gehört sonst root.
      **Ergebnis 01.10.2026:** vor dem zweiten `chown` 0 Einträge, die nicht
      1000 gehörten; `.Config.User` bei allen drei `1000:1000`.
- [x] Prüfen, je Backend (nicht nur über die öffentliche Adresse, Traefik
      verteilt):
      - `docker exec <backend> id -un` → `node`
      - Schreibprobe: `docker exec <backend> node -e "require('fs').writeFileSync('/app/uploads/tmp/probe','x');require('fs').unlinkSync('/app/uploads/tmp/probe')"` → kein Fehler
      - Push-Schlüssel lesbar: `docker exec <backend> node -e "require('/app/push/firebase-service-account.json');console.log('ok')"`
      - in der App ein Bild im Chat senden und öffnen (Testkonto der
        Demo-Gemeinde, nicht `review-*`/`google-test-*`)
      - Log der ersten fünf Minuten: kein `EACCES`, keine Meldung zu Firebase.

      **Ergebnis 01.10.2026:** je Backend `id -un` → `node`, Schreibprobe ok,
      Schlüssel lesbar; Log: `Firebase: Verbunden`, 0 `EACCES`/`EPERM`,
      0 `Migration FAILED`, genau ein Cron-Leader. **Offen:** der Bildversand
      im Chat mit einem Demo-Konto (braucht die App bzw. einen Browser mit
      Anmeldung) — beim nächsten Gerätetest mitnehmen.
- [ ] Rückweg, falls etwas scheitert: `user:` aus dem Stack nehmen und
      aktualisieren — root darf die Dateien weiter schreiben, am Besitz muss
      nichts zurückgedreht werden.
- [ ] Wenn alles eine Woche ohne `EACCES` lief (frühestens 08.10.2026): Pull Request mit `USER node`
      im `backend/Dockerfile` (Upload-Verzeichnis gehört `node` schon),
      Test dazu, und `user:` im Stack wieder entfernen.

**Ergebnis** je Punkt mit Datum und Messwert eintragen, im Befund CI BF-06 die
Status-Zeile fortschreiben.
