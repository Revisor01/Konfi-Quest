# Handoff — Stand 22.08.2026

Übergabe an die nächste Sitzung. Alles unten Beschriebene ist auf `main`,
gepusht, CI grün und auf Produktion deployt.

## Wo wir stehen

- Branch `main`, letzter Stand `ae86d79` (auf Produktion deployt, CI gruen).
- **Produktion läuft auf 2.0.0** (Server `kkd-fahrtenbuch.de`, siehe unten).
- TestFlight: Build 137 gebaut, gegen die **echte Produktion** (nicht Staging).
- iOS-Minimum ist seit Build 130 **16.4** (swiper 14 verlangt Safari 16.4+).

## Server — wichtig, hat sich geändert

Der alte Server `server.godsapp.de` ist wegen einer **Netcup-Abuse-Sperre**
nicht erreichbar (Folge des abgegriffenen SMTP-Passworts). Konfi Quest läuft
übergangsweise auf dem Fahrtenbuch-Server:

- SSH: `ssh root@kkd-fahrtenbuch.de` (185.248.143.234)
- Stack: `/opt/konfi-quest/docker-compose.yml`
- Container: `kq-backend`, `kq-frontend`, `kq-postgres`
- Backups: `/opt/konfi-quest/dump/`

**Deploy läuft NICHT über die CI.** Der `deploy`-Job in `.github/workflows/ci.yml`
ist pausiert (`if: false && ...`), weil er auf den toten Portainer-Stack 249 zeigt.
Deploy von Hand:

```
cd /opt/konfi-quest
sed -i 's|konfi-quest-backend:[a-f0-9]\{7\}|konfi-quest-backend:<SHA>|; s|konfi-quest-frontend:[a-f0-9]\{7\}|konfi-quest-frontend:<SHA>|' docker-compose.yml
docker compose pull backend frontend && docker compose up -d
curl -sS http://127.0.0.1:5055/api/status
```

Wenn der alte Server zurückkommt: Deploy-Job wieder scharf schalten
(`false &&` entfernen) und Stack-ID prüfen.

## Tageslosung — behoben, aber im Notbetrieb

`ketiv.de` lag auf dem gesperrten Server und ist weiterhin tot. Deshalb laeuft
die Losungen-API jetzt zusaetzlich hier:

- Stack: `/opt/ketiv/docker-compose.notbetrieb.yml`
- Container: `ketiv-api`, `ketiv-postgres` (beide `unless-stopped`)
- Nur API, kein Frontend, kein Redis. Die Losungsdaten 2025/2026 kommen aus
  den SQL-Dumps im Repo (`sql/losungen_*.sql`), es wird nichts gescraped.
- Haengt zusaetzlich im Netz `konfi-quest_internal`, damit `kq-backend` den
  Namen `ketiv-api` aufloesen kann. **Wird dieses Netz neu angelegt, muss der
  ketiv-Stack neu verbunden werden.**
- `public/` fehlt im Repo (wird sonst per CI gebaut) und wurde von Hand als
  Platzhalter angelegt — sonst bricht der Build.

Zusaetzlich abgesichert, damit ein erneuter Ausfall nicht wieder die App bremst:

- **Negativ-Cache** im `losungService`: nach einem Fehlschlag wird der externe
  Abruf 30 Min uebersprungen. Vorher lief jede Anfrage erneut in beide Timeouts
  (2s intern + 5s oeffentlich); das Dashboard ruft die Losung bei jedem Oeffnen
  ab. Gemessen: 7s -> 4,5ms.
- Die Teamer-Route hat jetzt denselben DB-Fallback wie die Konfi-Route.

Noch offen: **Der Losungs-API-Key steht im Klartext im Backend-Log**, weil er
als Query-Parameter in der URL steht und die Fehlermeldung die ganze URL ausgibt.
Key ist rotiert, aber Logs werden aufbewahrt.

## Offene Punkte aus den Audits

### Live-Updates (Socket) — Hauptbefunde behoben
Behoben: tote Sitzung nach Login, Socket überlebt Logout, Challenges
(Anlegen/Löschen meldeten nichts), Punkte-Signale kreuzten sich, Material
ohne Updates, drei fehlende Socket-Trennungen.

Ebenfalls behoben (22.08.): **Organisationswechsel**. Die Empfaengerauflösung
in `liveUpdate.js` geht jetzt per UNION auch über `user_organizations` (mit der
dort hinterlegten Rolle, die je Gemeinde abweichen kann), und `switchOrg` baut
den Socket mit dem neuen Token neu auf. Betraf praktisch nur `simonluthe`,
den einzigen Mehrfach-Nutzer (Orgs 1, 2, 4).

Offen:
- **Detailansichten ohne Abo**: Konfi-Event-Detail, Teamer-Abzeichen,
  Teamer-Dashboard, Zertifikate-Seite.

### Berechtigungen — vier Lücken geschlossen
Behoben: Punktevergabe und Punkteabzug über Organisationsgrenzen,
Teilnehmerlisten fremder Gemeinden, `qr_token` + Entschuldigungsgründe an Konfis.

Offen:
- Entzogener Multi-Org-Zugang wirkt bis zu 15 Min nach (Claim wird in
  `verifyTokenRBAC` nicht gegen `user_organizations` gegengeprüft).
- Passwort-Reset: Fehlercode verrät teilweise, ob eine E-Mail existiert.
  Reset-Token wird im Klartext gespeichert (Refresh-Tokens sind gehasht).
- Org-Admin kann `is_active` der eigenen Organisation setzen (Selbst-Aussperrung).
- Org-Anlage erlaubt 6-Zeichen-Passwörter statt der sonstigen Policy.
- **Abwägung für Simon:** Die Leitung kann private Zweier-Chats lesen und
  exportieren. Falls nicht gewollt, Direktchats vom Admin-Bypass ausnehmen.
- **Noch nicht geprüft:** Wer darf wen im Chat anschreiben, wer sieht wen in
  Kontaktlisten. Läuft als eigener Audit (OpenAPI-Doku, siehe unten).

## Was zuletzt gebaut wurde

- Chat-Export für die Leitung (`GET /chat/rooms/:roomId/export`, Text oder JSON)
- Chat-Nachrichten verschwanden nicht mehr (zwei Ursachen: Reload ersetzte die
  Liste, "Erneut senden" lief ins Leere)
- Teamer:innen über den Plus-Button in der Konfi-Übersicht anlegen
- "Was ist neu?" als eigener Block über den Einstellungen (alle drei Rollen)
- Challenges: Reiter Aktuell/Archiv
- Abgesagte Termine werden auch der Leitung durchgestrichen angezeigt
- Doppelte Aktivität "Gottesdienst" in Hennstedt zusammengeführt

## Nächster Schritt

Vollständige API-Dokumentation nach **OpenAPI 3.1** über alle 223 Routen,
mit Berechtigungsmatrix je Route. Läuft in drei Blöcken, damit die Agenten
nicht am Umfang scheitern. Ergebnis soll unter `docs/api/` liegen.

## Fallen, die schon Zeit gekostet haben

- **Backend-Tests laufen lokal nicht** — kein Docker auf dem Mac. Nur über CI.
- **CI läuft auf Feature-Branches nicht automatisch**, nur auf `main` oder im PR.
  Manuell: `gh workflow run ci.yml --ref <branch>`.
- **Ionic `normalize.css`** setzt global `button { padding: 0; line-height: 1 }`
  und wird nach dem Theme geladen. Wer einen Button wie ein Div stylt, braucht
  `!important` — sonst ist er niedriger als die Nachbarn.
- **Ohne `IonItemSliding`** fehlt auch dessen `marginBottom`. Listen kleben dann
  aneinander.
- **firebase-admin v14**: `admin.credential` und `admin.messaging` gibt es nicht
  mehr. Import über `firebase-admin/app` und `firebase-admin/messaging`.
- **Das Test-DB-Schema hinkt der Produktion hinterher.** In der CI laufen
  Fehler wie `column a.category does not exist` (Wrapped) und
  `relation "daily_verses" does not exist` durch, ohne dass ein Test rot wird —
  beides existiert in Produktion sehr wohl. Heisst: diese Pfade werden faktisch
  nicht geprüft. Wer dort etwas ändert, hat kein Netz.
- **Ein Test kann grün aussehen und trotzdem am Ziel vorbeilaufen.** Die beiden
  Konfi-zu-Konfi-Tests schickten kein `name`; die Route antwortete mit 400
  ("Typ und Name sind erforderlich"), also lange vor der Sicherheitsprüfung.
  Bei Berechtigungstests immer den Statuscode prüfen, nicht nur "nicht 200".
