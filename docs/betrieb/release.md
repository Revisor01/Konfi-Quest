# Ein Release ausrollen

Vom Versionsheben bis zum Tag im Store. Was eine Version ist und welche
Stelle steigt, regelt [CLAUDE.md](../../CLAUDE.md) („Versionsnummern"); hier
steht der Ablauf. Zugangsdaten und Konten stehen nicht hier — das Repo ist
öffentlich.

## 1. Versionsnummern setzen

`frontend/version.json` ist die eine Quelle für App-Version, Android
`versionCode` und iOS-Build-Nummer. Gesetzt wird nur über das Skript, aus der
Wurzel:

```bash
npm run version:setzen -- 2.4.0 --android 134 --ios 241
npm run version:pruefen        # Exit 1 bei jeder Abweichung
```

Das Skript schreibt `version.json`, die drei `package.json` samt Lockfiles,
`MARKETING_VERSION` und `CURRENT_PROJECT_VERSION` im iOS-Projekt und die
beiden Versionen in der `Info.plist`. Die Build-Nummern steigen mit **jedem**
Store-Upload um eins, auch bei Testbuilds, unabhängig von der App-Version.
Der Test `versionsnummernEineQuelle` und `version:pruefen` prüfen den
Gleichlauf.

## 2. CHANGELOG abschließen

Die erste Versionsüberschrift heißt bis zum Release
`## [Unreleased] - 2.4.0`. Beim Release von Hand umbenennen und direkt
darunter die Build-Zeile aus `frontend/version.json` eintragen:

```markdown
## [2.4.0] - 2026-11-03

iOS-Build 241 · Android versionCode 134
```

Das ist die einzige Stelle mit Build-Nummern im CHANGELOG. `version:pruefen`
liest die Version der ersten Überschrift mit.

## 3. Store-Texte schreiben

- **`docs/store-texte-<version>.md`** mit je einem Abschnitt `## iOS` und
  `## Android`, aus dem CHANGELOG-Block der Version, aus Sicht der
  Nutzer:innen. Der iOS-Abschnitt darf weder Android noch Google Play,
  Play Store oder Windows nennen (Apple, Guideline 2.3.10): `ios-release.yml`
  prüft jede `docs/store-texte-*.md` vor dem Build und bricht sonst ab.
  Zeilen, die mit `>` beginnen, sind Hinweise an uns und zählen nicht.
- **`frontend/release-notes-de.txt`** — die „Neuigkeiten" für Google Play,
  höchstens 500 Zeichen; `upload-play.py` bricht bei mehr ab.
- Bildschirmfotos für die Stores nur neu ziehen, wenn sich das Aussehen
  geändert hat — erst nach dem Deploy, jedes Bild ansehen (CLAUDE.md,
  „Screenshots").

## 4. Vor dem Merge

- Schema-Dump fortschreiben und Rückspielprobe:
  [routinen.md](routinen.md#schema-dump-fortschreiben),
  [sicherung.md](sicherung.md#rückspielprobe).
- Ausgelieferte Apps nicht brechen: Antwortformen gleich, nur neue Felder,
  Migrationen additiv (CLAUDE.md). [ABRISS.md](../api/ABRISS.md) sagt, welche
  Routen alte App-Versionen noch rufen.

## 5. Merge und Deploy

Ein Merge nach `main` ist der Produktions-Deploy: `ci.yml` testet, baut die
Images und tauscht die Backends nacheinander aus (`deploy/rollend.sh`, zwei
Stufen, Verify gegen den Commit). Den Merge gibt Simon frei. Danach
`GET /api/status` beider Backends: `version` und `commit` stimmen,
`checks.migrations` ist `ok` ([routinen.md](routinen.md#nach-jedem-deploy)).

## 6. Store-Builds

Beide Workflows laufen nur von Hand (`workflow_dispatch`) und haben ein
**Release-Tor** (`ci-gate`, `.github/scripts/release-gate.py`): Der Commit muss
auf `main` liegen, und `ci.yml` muss für genau diesen Commit grün sein; läuft
die CI noch, wartet das Tor bis zu 45 Minuten.

**iOS** — `ios-release.yml`, Eingaben:

| Eingabe | Vorgabe | Bedeutung |
|---|---|---|
| `allow_non_main` | aus | Build von einem anderen Ref; nur für bewusste Testbuilds, die CI des Commits muss trotzdem grün sein |

```bash
gh workflow run ios-release.yml --ref main
```

Jeder Build — Store, TestFlight und interner Testtrack — spricht mit der
Produktion; eine Eingabe für eine andere API-Adresse gibt es nicht. Das
frühere Test-Backend (eigener Hostname an derselben Datenbank, mit denselben
Schlüsseln) ist seit dem 08.10.2026 abgeschafft (Simons Entscheidung). Die
fünf TestFlight-Builds, die darauf zeigten (153, 154, 155, 157, 158, gebaut
31.08.–02.09.2026), wurden vorher in App Store Connect abgelaufen gelassen.
Android hatte nie eine solche Eingabe.

Der Build landet in App Store Connect und TestFlight; das Einreichen zur
Prüfung geschieht dort von Hand.

**Android** — `android-release.yml`, Eingaben:

| Eingabe | Vorgabe | Bedeutung |
|---|---|---|
| `tracks` | `internal,alpha` | kommagetrennt aus `internal`, `alpha`, `beta`, `production`; Namen werden vor dem Bau geprüft. `production` reicht **sofort** zur Prüfung ein und ist nicht umkehrbar — nur bewusst hinschreiben |
| `production_anteil` | `0.1` | nur für `production`: Anteil der Nutzer:innen, die das Update zuerst bekommen; `1` = sofort an alle. Erhöhen in der Play Console oder mit einem weiteren Lauf |
| `dry_run` | aus | kompletter Durchlauf mit Upload und Prüfung, die Änderung bei Google wird aber verworfen; der `versionCode` wird dafür nur im Lauf um 10.000 angehoben und nicht verbraucht, es entsteht kein Tag |
| `allow_non_main` | aus | wie bei iOS |

```bash
gh workflow run android-release.yml --ref main -f tracks=internal -f dry_run=true
gh workflow run android-release.yml --ref main -f tracks=internal
gh workflow run android-release.yml --ref main -f tracks=production -f production_anteil=0.1
```

Reihenfolge: erst die Testkanäle (Android `internal`, iOS TestFlight),
Gerätetest, dann die Produktion.

## 7. Tags

- **Build-Tags setzen die Workflows selbst**: nach jedem erfolgreichen Upload
  `<version>+ios.<build>` bzw. `<version>+android.<versionCode>` auf den
  gebauten Commit (`.github/scripts/store-tag.py`). Beim Dry-Run entsteht
  keiner; ein vorhandener Tag wird nie überschrieben (zeigt er auf einen
  anderen Commit, warnt der Lauf).
- **Den Versions-Tag** setzt der Mensch beim Store-Release, ohne `v`:

  ```bash
  git tag -a 2.4.0 <commit> -m "Konfi Quest 2.4.0"
  git push origin 2.4.0
  ```

## 8. Das Apple-Zertifikat jährlich erneuern

Der iOS-Build signiert mit einem Apple-Distribution-Zertifikat und dem
App-Store-Profil **„Konfi Quest AppStore CI"**. Das Profil kann nicht länger
gelten als das Zertifikat, mit dem es erzeugt wurde. **Das jetzige Zertifikat
und damit das Profil laufen am 28.11.2026 ab.** Vorher, rechtzeitig:

1. Im Apple-Developer-Konto ein neues Zertifikat vom Typ *Apple Distribution*
   erzeugen (Zertifikatsanfrage aus der Schlüsselbundverwaltung) und samt
   privatem Schlüssel als `.p12` mit Passwort exportieren.
2. In GitHub die beiden Secrets ersetzen: `IOS_DIST_P12_BASE64` (die `.p12`
   als Base64) und `IOS_P12_PASSWORD` (ihr Passwort).
3. Das Profil „Konfi Quest AppStore CI" (App Store, App-ID mit „Associated
   Domains") mit dem neuen Zertifikat neu erzeugen und den Namen behalten.
   Der Workflow lädt es über die App-Store-Connect-API nach diesem Namen,
   verlangt den Zustand `ACTIVE` und prüft es gegen die Berechtigungen in
   `AppRelease.entitlements` (`.github/scripts/profil-pruefen.py`).
4. Einen Testbuild laufen lassen; das alte Zertifikat erst danach
   widerrufen.
