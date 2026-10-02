# 13. Store-Freigabe 2.3.0, alte Branches aufräumen

Stand 02.10.2026, abends. Simon hat den Release freigegeben („Go").

> **Keine neuen Store-Builds von `main` starten.** Nach #216 kam #217
> (Aufräumen, Version 2.4.0). `main` steht damit auf 2.4.0, aber noch mit
> den Build-Nummern iOS 240 / Android 134, die 2.3.0 schon belegt. Ein
> Lauf von `ios-release.yml` oder `android-release.yml` scheitert daran
> oder lädt den falschen Stand hoch. Die Builds für 2.3.0 gibt es schon
> (unten).

## Wo der Release steht

- **Gemergt:** #216 als `dac246ebcbb0a190ab1e53646c1b1d61105ff424` auf `main`.
  Der Lauf „CI Pipeline" #1065 testet, baut und deployt diesen Commit.
- **Android:** `android-release.yml` Lauf #66 von `main` mit den Tracks
  `internal,alpha,production`, Produktion gestaffelt mit 10 %, versionCode
  134. Der Lauf wartet am Release-Tor, bis #1065 grün ist, und lädt dann
  hoch. Nach dem Upload setzt er selbst den Tag `2.3.0+android.134`.
- **iOS:** Build 240 liegt in TestFlight, gebaut aus `d99346fe` (Tag
  `2.3.0+ios.240`). Zwischen `d99346fe` und `dac246eb` liegen nur Doku,
  CHANGELOG, Store-Texte und der Android-versionCode in
  `frontend/version.json` — kein App-Code. Build 240 ist also der
  Release-Build; ein neuer iOS-Build ist nicht nötig.
- **Offen:** Versions-Tag, Prüfung des Deploys, iOS einreichen, beide
  Prüfungen verfolgen, danach den Android-Anteil anheben.

## Was zu tun ist

- [x] **1. Versions-Tag `2.3.0` setzen.** Die Cloud-Umgebung darf keine Tags
      pushen; deshalb hier.

      git fetch origin
      git tag -a 2.3.0 dac246ebcbb0a190ab1e53646c1b1d61105ff424 -m "Konfi Quest 2.3.0"
      git push origin 2.3.0

      Prüfen: `git ls-remote --tags origin 'refs/tags/2.3.0^{}'` zeigt auf
      `dac246eb…`. Gibt es `2.3.0` auf GitHub schon und zeigt er woanders
      hin: nicht überschreiben, Simon fragen.

- [x] **2. Deploy prüfen.** 2.3.0 ist schon geprüft: #1065 grün, um
      23:05 UTC meldeten beide Backends `version` 2.3.0, `commit` `dac246eb`,
      alle drei Checks `ok`, `migrationen.gesamt` 112, nichts
      fehlgeschlagen (aus der Cloud-Sitzung gemessen). Zu prüfen bleibt der
      Deploy von #217 danach
      ([Nach jedem Deploy](../../betrieb/routinen.md#nach-jedem-deploy)).
      `GET /api/status` mehrmals, damit beide Backends antworten:
      - `version` `2.4.0`, `commit` gleich dem Merge-Commit von #217
        (`git log -1 --format=%h origin/main`);
      - `checks.database`, `checks.migrations` und `checks.cron_leader` `ok`;
      - `migrationen.gesamt` **10**, `fehlgeschlagen` leer. 10 ist richtig:
        Das Feld zählt die Dateien in `backend/migrations/`, und dort liegen
        seit #217 nur noch die ab 174. Die Datenbank hat weiter alle;
        Gegenprobe mit `comm` aus `init-scripts/README.md`, die Ausgabe muss
        leer sein;
      - in den Logs beider Backends `Migration FAILED`: 0;
      - im Log des Jobs `deploy` je Stufe „keine anderen Dienste neu
        erstellt".

      Ist die CI von #217 auf `main` rot, ist nichts deployt; Produktion
      bleibt auf 2.3.0. Dann den roten Job und die Fehlerzeile ins Ergebnis,
      Simon Bescheid geben, nichts neu anstoßen.

- [x] **3. Android-Lauf #66 verfolgen.** Erwartet: grün; Tag
      `2.3.0+android.134` auf `dac246eb`; in der Play Console steht
      2.3.0 (134) in internem Test und Alpha, in Produktion mit 10 % und
      dem Status „In Prüfung".

      Ist der Lauf rot: Protokoll lesen und ins Ergebnis. **Nicht ohne
      Rücksprache neu starten** — war der Upload schon durch, ist
      versionCode 134 verbraucht, und ein zweiter Lauf scheitert daran.

- [x] **4. iOS zur Prüfung einreichen** (App Store Connect):
      1. Version 2.3.0 öffnen oder anlegen und **Build 240** zuordnen.
      2. „Neues in dieser Version": der Text unter der iOS-Überschrift in
         [docs/store-texte-2.3.0.md](../../store-texte-2.3.0.md) bis zur
         Android-Überschrift, **ohne** die Zeilen, die mit `>` beginnen
         (das sind Hinweise an uns).
      3. Vor dem Absenden lesen: kein Wort über Android, Google Play,
         Windows oder eine Web-App (Guideline 2.3.10, 2.0.0 wurde daran
         schon einmal abgelehnt).
      4. Exportkonformität und Veröffentlichungsart wie bei 2.2.0. Im
         Zweifel „manuell veröffentlichen" wählen und Simon fragen.
      5. Zur Prüfung einreichen.

      Ohne Zugang zu App Store Connect: „entfällt, macht Simon" eintragen.

- [ ] **5. Beide Prüfungen verfolgen.** Bei einer Ablehnung den Grund im
      Wortlaut ins Ergebnis (ohne Namen) und Simon Bescheid geben; an App
      und Texten nichts selbst ändern.

- [ ] **6. Nach der Freigabe:**
      - Android: Absturzberichte und Play-Vitals für 2.3.0 (134) ansehen.
        Den Anteil in der Play Console erst mit Simons Okay auf 100 %
        heben.
      - iOS: Bei „manuell veröffentlichen" mit Simons Okay veröffentlichen.

- [x] **7. Alte Branches löschen.** Gemessen am 02.10.2026: Diese 13
      Branches haben keinen Commit, der nicht schon auf `main` liegt.

      git fetch --prune origin
      for b in betrieb/deploy-luecke-container betrieb/messungen-nach-deploy \
               betrieb/sicherung-schema docs/screenshots-2.3 docs/umami-texte \
               feat/challenge-liste-rote-kugel-freigaben feat/postfach-ohne-zahl \
               feat/segment-zahlen-leitung fix/challenge-neu-zaehler \
               fix/eventdatum-im-konfiprofil fix/logs-und-refresh-tokens \
               fix/punkt-plural-teamer-titel fix/rolle-leitung-admin; do
        echo "$b: $(git rev-list --count origin/main..origin/$b) Commits vor main"
      done

      Nur Branches mit **0** löschen (`git push origin --delete <branch> …`),
      einen mit mehr stehen lassen und ins Ergebnis. **Nicht löschen:**
      `main` und `claude/fervent-edison-wp5yfj` (Arbeitszweig der
      Cloud-Sitzung).

      Damit es nicht wieder vollläuft, Branches beim Merge automatisch
      löschen lassen:

      gh api -X PATCH repos/Revisor01/Konfi-Quest -F delete_branch_on_merge=true
      gh api repos/Revisor01/Konfi-Quest --jq .delete_branch_on_merge   # true

      Fehlt das Recht: Simon unter Settings → General → Pull Requests →
      „Automatically delete head branches".

## Ergebnis

<!-- Je Punkt Datum, Messwert oder Status; keine Namen, Adressen oder
     Zugangsdaten. -->

03.10.2026, lokaler Agent (Zeiten UTC):

- **1. Tag:** `2.3.0` (annotiert) auf `dac246eb` gepusht, `ls-remote` bestätigt.
  Dazu GitHub-Release `2.3.0` mit Kurzfassung und Verweis auf den CHANGELOG.
- **2. Deploy von #217** (`4cc24f0e`, CI grün, alle sieben Jobs): 8 Abfragen
  von `/api/status` alle `version` 2.4.0, `commit` `4cc24f0e`, drei Checks
  `ok`, `migrationen.gesamt` 10, `fehlgeschlagen` leer. Gegenprobe mit
  `comm`: leer (102 Namen der Liste, 112 in der Datenbank). Beide Backends
  `healthy`, 0 `Migration FAILED`, 0 Fehlerzeilen seit dem Start. Deploy-Log:
  „Stufe 1: keine anderen Dienste neu erstellt." und dasselbe für Stufe 2;
  Postgres läuft unverändert seit 30.09., 23:27.
- **3. Android:** Lauf #66 grün, Tag `2.3.0+android.134` auf `dac246eb`.
  Play-API: 134 in `internal` und `alpha` `completed`, in `production`
  `inProgress` mit 10 %. Prüfstatus zeigt nur die Console.
  **Auf 100 % gehoben** (Simon, 03.10.: „100% ausrollen"): `production` jetzt
  2.3.0 (134) `completed`, Release-Notizen (488 Zeichen) erhalten.
- **4. iOS:** Version 2.3.0 angelegt, Build 240 (`VALID`, keine
  Verschlüsselung) zugeordnet, „Neues in dieser Version" = iOS-Text
  (2.343 Zeichen, keine Plattform-Wörter), Veröffentlichung „nach Freigabe
  automatisch" wie 2.2.0. Eingereicht 02.10., 23:25: `WAITING_FOR_REVIEW`.
- **5./6.** offen — Prüfungen bei Apple und Google laufen.
- **7. Branches:** alle 13 mit 0 Commits vor `main`, gelöscht.
  `delete_branch_on_merge` = `true`. Folge: Beim Merge von #217 wurde auch
  `claude/fervent-edison-wp5yfj` gelöscht (lag vollständig auf `main`);
  wiederherstellbar unter dem PR.
