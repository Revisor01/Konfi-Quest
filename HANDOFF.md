# Handoff — Stand 22.08.2026

Übergabe an die nächste Sitzung. Alles unten Beschriebene ist auf `main`,
gepusht, CI grün und auf Produktion deployt.

## Wo wir stehen

- Branch `main`, letzter Stand `19ca31d` (auf Produktion deployt, CI gruen).
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

Am 22.08. abgearbeitet (alle gegen Produktion verifiziert, nicht nur im Test):
- **qr_token in der Terminliste** — ging an ALLE Rollen, auch Konfis. Damit
  konnte sich ein Konfi per QR-Checkin aus der Ferne als anwesend eintragen
  und Punkte gutschreiben. Der Filter existierte nur in der Detail-Route, über
  die Liste war er umgehbar. Live nachgewiesen (2 Token), jetzt 0.
- **Org-Stammdaten für Konfis** — Kontaktname, Telefon, Privatadresse, Lizenz-
  und Trial-Daten. Betraf `/organizations/:id`, `/:id/stats` UND `/current`;
  ohne den Guard auf `/current` wäre der Rest wirkungslos gewesen. Jetzt 403.
- **Passwortwechsel beendete keine Sitzungen** — Access-Tokens blieben gültig,
  Refresh-Tokens bis zu 90 Tage. Der Mechanismus (`token_invalidated_at`) war
  vorhanden, wurde nur nie gesetzt.
- **Reset-Token im Klartext** — jetzt als Hash, Migration 123 zog den einen
  offenen Eintrag nach. Achtung: Ein Klartext-Zweig als Übergang ist eine
  FALLE — der gespeicherte Hash ist selbst ein gültiger Klartext-Wert und
  funktioniert dann als Token.
- **E-Mail-Enumeration** — die Antwort war neutral, ein fehlgeschlagener
  Mail-Versand lieferte aber 500 und verriet damit die Existenz des Kontos.
- **Selbst-Aussperrung** — `is_active` setzt nur noch der super_admin.
- **Passwort-Policy** — Org-Anlage prüfte 6 Zeichen, das Bearbeiten eines
  Users gar nichts. Jetzt überall `validatePassword`.
- **Teamer-Filter ohne Jahrgang** — griff nur bei vorhandenen Zuweisungen.

Offen:
- Entzogener Multi-Org-Zugang wirkt bis zu 15 Min nach (Claim wird in
  `verifyTokenRBAC` nicht gegen `user_organizations` gegengeprüft).
- **Abwägung für Simon:** Die Leitung kann private Zweier-Chats lesen und
  exportieren. Falls nicht gewollt, Direktchats vom Admin-Bypass ausnehmen.
- **Bewusst nicht geändert:** der 409 bei `update-email`. Dort ist der Nutzer
  angemeldet und die Meldung für die Bedienung nötig.

## Was zuletzt gebaut wurde

- Chat-Export für die Leitung (`GET /chat/rooms/:roomId/export`, Text oder JSON)
- Chat-Nachrichten verschwanden nicht mehr (zwei Ursachen: Reload ersetzte die
  Liste, "Erneut senden" lief ins Leere)
- Teamer:innen über den Plus-Button in der Konfi-Übersicht anlegen
- "Was ist neu?" als eigener Block über den Einstellungen (alle drei Rollen)
- Challenges: Reiter Aktuell/Archiv
- Abgesagte Termine werden auch der Leitung durchgestrichen angezeigt
- Doppelte Aktivität "Gottesdienst" in Hennstedt zusammengeführt

## Nächster Schritt: Test-DB-Schema

Zweifach unabhängig verifiziert (beide Agenten haben das Test-Schema
materialisiert und maschinell gegen Produktion gedifft, nicht geschätzt):

Das Test-Schema ist ein Patchwork aus vier Schichten — Repo-init-script, ein
~250-zeiliger handgeschriebener Block in `globalSetup.js`, Einzel-Statements,
dann Migrationen ab 064. **Die Wurzel ist nicht eine fehlende Spalte, sondern
dass jeder Fehler verschluckt wird:** fehlgeschlagene Migrationen werden
trotzdem als "applied" markiert, handgeschriebene Statements tragen
`.catch(() => {})`.

Echte Testlücken:
- `daily_verses` fehlt → Losung-Cache-Pfad ungetestet (Test akzeptiert "200
  oder 500")
- `activities.category` fehlt → die **gesamte** Wrapped-Snapshot-Generierung
  ist ungetestet, jeder Snapshot scheitert
- `konfi_profiles.password_plain` fehlt → ein Test patcht die Spalte zur
  Laufzeit per ALTER TABLE selbst rein

Zwei echte Bugs als Beifang, die nicht nur Tests betreffen:
1. `daily_verses` und `activities.category` haben **nirgends im Repo ein DDL** —
   sie existieren nur in Produktion, manuell angelegt. Eine Neuinstallation
   aus dem Repo hätte sie nicht.
2. Migration 064 braucht `invite_codes`, das erst 079 anlegt. Auf einer
   frischen DB bricht die Kette, 73 Indexe werden übersprungen.

Dazu ~200 Spalten mit Typabweichung (Prod ist SQLite-Erbe: bigint/text/uuid).
Verhaltensrelevant: `chat_polls.options` ist in Prod `text`, im Test `jsonb` —
`JSON.parse` in `chat.js:72` verhält sich dadurch unterschiedlich.

Empfehlung beider Analysen, identisch: Prod-Schema-Dump als einzige Quelle
einchecken, darauf nur noch offene Migrationen, und `globalSetup` hart failen
lassen statt Fehler zu schlucken. Vorsicht: Die weichen Assertions verdecken
womöglich weitere Fehler — die CI kann dabei erstmal rot werden.

## Danach

Vollständige API-Dokumentation nach **OpenAPI 3.1** über alle 223 Routen.
`docs/api/` deckt bisher 106 ab; die 25 LÜCKE-Marker darin waren keine
Doku-Lücken, sondern Sicherheitsbefunde — die sind jetzt abgearbeitet.

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
