# 07 — Client-Adresse hinter dem Proxy (Sicherheit BF-13)

Nach dem Deploy des Stands vom 29.09.2026. Gehört zu „Auf Produktion
nachzumessen" Nr. 4 in `docs/audit/2026-09-26/backend-sicherheit-datenschutz.md`
und zu Nr. 8 in [03](03-nach-dem-deploy.md) — dieser Auftrag ist der
ausführliche Weg dafür.

## Worum es geht

Alle Grenzen je Client (Fehlversuche beim Anmelden, Registrierung,
Passwort-Reset, Doku-Anmeldung, Namensprüfung beim Registrieren) zählen auf
die Adresse aus `utils/clientIp.js`:

- Kommt die Anfrage aus dem Docker-Netz (Loopback, Link-Local, private
  Bereiche), gilt der Header `X-Real-IP`.
- Sonst oder ohne gültigen Header gilt `req.ip` — hinter dem Proxy ist das
  die Adresse des Proxys, für **alle** Nutzer:innen dieselbe.

Im Code erledigt (26.09.2026): Der Header gilt nur noch aus dem Docker-Netz,
und die Zähler liegen in der gemeinsamen Tabelle `rate_limit_zaehler`, also
über beide Backends. Nur der allgemeine Flutschutz (2000 Anfragen je
Viertelstunde) zählt bewusst je Backend.

**Offen ist allein, was ankommt.** Das Backend kann nicht prüfen, ob der
Header vom eigenen Proxy stammt oder vom Client durchgereicht wurde. Drei
Fälle:

| Fall | Was im Backend ankommt | Folge |
|---|---|---|
| A | `X-Real-IP` = echte Adresse des Clients, vom Proxy **gesetzt** | richtig |
| B | `X-Real-IP` = Wert, den der Client selbst schickt | jede Grenze umgehbar: neue Adresse je Anfrage |
| C | kein `X-Real-IP` oder die Adresse eines Proxys | alle teilen einen Zähler: eine Konfi-Gruppe im WLAN sperrt die ganze Plattform |

## 1. Messen (nur lesend, bis auf zwei Fehlversuche)

- [x] Von einem Rechner mit bekannter öffentlicher Adresse (`<EIGENE_IP>`)
      zwei **fehlgeschlagene** Anmeldungen an `POST /api/auth/login` über die
      öffentliche Adresse der App schicken, mit einem Benutzernamen, den es
      nicht gibt (etwa `messung-bf13-kein-konto`) und einem beliebigen
      Passwort:
      1. ohne weitere Header,
      2. mit dem Header `X-Real-IP: 198.51.100.77` (Dokumentationsadresse,
         gehört niemandem).
      Beide müssen 401 geben. Ein unbekannter Name zählt für kein echtes Konto.
- [x] Direkt danach in der Datenbank ablesen:
      `SELECT schluessel, treffer, ablauf FROM rate_limit_zaehler WHERE schluessel LIKE 'auth:%' ORDER BY ablauf DESC LIMIT 20;`
      Bei IPv6 steht statt der Adresse das /56-Netz.
- [x] Zuordnen:
      - Beide Versuche unter `auth:<EIGENE_IP>` → **Fall A**. Fertig mit
        Abschnitt 2, weiter bei 3.
      - Der zweite unter `auth:198.51.100.77` → **Fall B**.
      - Beide unter einer privaten Adresse (10.x, 172.16–31.x, 192.168.x) →
        **Fall C**.
- [x] Nur in Fall C zusätzlich: Setzt der vordere Proxy den Header überhaupt?
      Im Zugriffs- oder Debug-Log des vorderen Proxys bzw. an der
      Konfiguration ablesen. Und am Traefik-Entrypoint nachsehen, ob die
      Adresse des vorderen Proxys unter `forwardedHeaders.trustedIPs` steht:
      Traefik ersetzt `X-Forwarded-*` und `X-Real-Ip` von Absendern, denen es
      nicht vertraut, durch eigene Werte.

**Ergebnis:** 01.10.2026, 00:25 — **Fall A.** Beide Fehlversuche von
`<EIGENE_IP>` (IPv4; die App hat keine IPv6-Adresse) gaben 401, der zweite
mit `X-Real-IP: 198.51.100.77`. In `rate_limit_zaehler` danach genau eine
Zeile `auth:<EIGENE_IP>` mit `treffer` 2, keine unter der
Dokumentationsadresse, keine private Adresse. Der vordere Proxy setzt den
Header mit `RequestHeader set X-Real-IP %{REMOTE_ADDR}s` (überschreibt);
Fall C entfällt, der Traefik-Entrypoint vertraut Loopback und den
Docker-Netzen ohnehin (`forwardedHeaders.trustedIPs`).

## 2. Proxy einstellen (nur Fall B oder C)

Vorher Stand der Proxy-Konfiguration sichern (außerhalb des Repos). Jede
Änderung am vorderen Proxy wirkt auf alle Anfragen — Zeitpunkt mit Simon
absprechen.

- [x] Vorderer Proxy: Header **überschreiben**, nicht anhängen und nicht
      „nur wenn leer" — bei Apache
      `RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"` im VirtualHost der App.
      Damit ist ein vom Client geschickter Wert immer ersetzt (Fall B).
- [x] Traefik (Fall C): Die Adresse des vorderen Proxys als vertrauten
      Absender eintragen (`forwardedHeaders.trustedIPs` am Entrypoint), damit
      Traefik dessen `X-Real-IP` weiterreicht. **Nicht** `insecure` —
      sonst reicht Traefik auch Header von Fremden durch.
- [x] Prüfen, dass Traefik und das Backend von außen nur über den vorderen
      Proxy erreichbar sind: Der Backend-Port ist nicht auf dem Host
      veröffentlicht (Referenz `deploy/compose.konfi_quest.yml`), und die
      Traefik-Ports lauschen nicht öffentlich an ihm vorbei. Sonst setzt ein
      Client den Header am Proxy vorbei selbst.
- [x] Abschnitt 1 wiederholen; erst mit Fall A ist der Punkt erledigt.

**Ergebnis:** 01.10.2026 — entfällt, weil Fall A. Nichts eingestellt.
Geprüft trotzdem, dass niemand am vorderen Proxy vorbeikommt: Die Backends
veröffentlichen keinen Port auf dem Host, Traefik lauscht nur auf Loopback
(Web- und Metrik-Entrypoint).

## 3. Gegenprobe im Betrieb

- [x] Von einem **zweiten** Anschluss (etwa Mobilfunk, `<ZWEITE_IP>`) einen
      Fehlversuch schicken: In `rate_limit_zaehler` steht ein eigener
      Schlüssel `auth:<ZWEITE_IP>`. Zwei Anschlüsse, zwei Zähler.
- [x] Die Messzeilen verfallen nach 15 Minuten von selbst; nichts löschen.

**Ergebnis:** 01.10.2026, 00:26 — ein Fehlversuch von einer zweiten
öffentlichen Adresse (`<ZWEITE_IP>`, nicht Mobilfunk, sondern ein Server mit
eigener Adresse; der erste Anschluss war bereits Mobilfunk): 401, eigene
Zeile `auth:<ZWEITE_IP>` mit `treffer` 1 neben `auth:<EIGENE_IP>` mit 2.
Zwei Anschlüsse, zwei Zähler. Nichts gelöscht.

## Rückmeldung

In `docs/audit/2026-09-26/backend-sicherheit-datenschutz.md` unter BF-13 und
im Abschnitt „Unklar" (X-Real-IP) je eine Zeile mit Datum, Fall (A/B/C) und
dem, was eingestellt wurde — ohne Adressen.
