# 12. Token-Schlüssel prüfen und privaten Meldeweg einschalten

Stand 02.10.2026. **Dringend, vor allem anderen.**

## Anlass

In `backend/BACKEND_ANALYSE.md`, einer alten Analyse vom 30.12.2025, stand
wörtlich ein früherer Entwicklungswert für `JWT_SECRET`. Mit diesem Schlüssel
signiert das Backend die Anmelde-Tokens. Das Repo ist öffentlich; der Wert
steht in der Git-Historie und bleibt dort, auch wenn die Datei gelöscht ist.

**Läuft Produktion noch mit genau diesem Wert, kann jede:r gültige Anmeldungen
für beliebige Konten fälschen** — auch für Gemeindeleitungen und Super-Admins.

Der Code hat keinen eingebauten Ersatzwert: `backend/middleware/rbac.js`
bricht ab, wenn `JWT_SECRET` fehlt. Der Wert kommt also allein aus der
Umgebung des Stacks.

## Was zu tun ist

- [x] **Vergleichen, ohne den Wert anzuzeigen** — in **jedem** Backend-Container
      (beide Repliken, dazu das Test-Backend):

      docker exec <container> sh -c 'test "$JWT_SECRET" = "konfi-secret-super-secure-2025" && echo GLEICH || echo ANDERS; echo "Länge: ${#JWT_SECRET}"'

      Den alten Wert nur in diesem Befehl verwenden, nirgends sonst ablegen.
      Den echten Wert **nie** ausgeben, kopieren oder protokollieren.

- [x] **Bei `ANDERS` und Länge ≥ 32:** nichts weiter zu tun. Ergebnis unten
      eintragen.

- [ ] **Bei `GLEICH` (oder Länge < 32):** sofort Simon Bescheid geben, dann
      1. neuen Wert erzeugen: `openssl rand -base64 48`
      2. als Stack-Variable `JWT_SECRET` in Portainer setzen — für **beide**
         Backend-Repliken derselbe Wert, sonst lehnt die eine die Tokens der
         anderen ab;
      3. Stack neu ausrollen;
      4. prüfen: `/api/status` ok, Anmeldung in der Web-Version klappt.

      Folge: Alle bestehenden Sitzungen werden ungültig, alle melden sich
      einmal neu an. Das ist gewollt.

- [x] **Privaten Meldeweg für Sicherheitslücken einschalten.** `SECURITY.md`
      verweist auf GitHubs „Report a vulnerability". Das muss im Repo
      eingeschaltet sein:

      gh api -X PUT repos/Revisor01/Konfi-Quest/private-vulnerability-reporting

      Prüfen: `gh api repos/Revisor01/Konfi-Quest/private-vulnerability-reporting`
      liefert `{"enabled":true}`. Fehlt das Recht, macht es Simon unter
      Settings → Code security → Private vulnerability reporting → Enable.

## Ergebnis

02.10.2026, lokaler Agent:

| Container | Vergleich | Länge |
|---|---|---|
| `konfi_quest-backend-1` | ANDERS | 61 |
| `konfi_quest-backend2-1` | ANDERS | 61 |
| `konfi_quest-backend-test-1` | ANDERS | 61 |

- Beide Repliken tragen denselben Schlüssel (Hash-Vergleich, kein Wert
  ausgegeben). Das Test-Backend trägt ebenfalls denselben; es hängt aber auch
  an derselben Datenbank wie Produktion, ist also kein eigener Vertrauensraum.
- Schlüssel **nicht** erneuert — nicht nötig.
- Privater Meldeweg: `{"enabled":true}`, war bereits eingeschaltet.
