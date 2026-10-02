# 13. Store-Freigabe 2.3.0

Stand 02.10.2026, abends. Simon hat den Release freigegeben („Go").

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

- [ ] **1. Versions-Tag `2.3.0` setzen.** Die Cloud-Umgebung darf keine Tags
      pushen; deshalb hier.

      git fetch origin
      git tag -a 2.3.0 dac246ebcbb0a190ab1e53646c1b1d61105ff424 -m "Konfi Quest 2.3.0"
      git push origin 2.3.0

      Prüfen: `git ls-remote --tags origin 'refs/tags/2.3.0^{}'` zeigt auf
      `dac246eb…`. Gibt es `2.3.0` auf GitHub schon und zeigt er woanders
      hin: nicht überschreiben, Simon fragen.

- [ ] **2. Deploy prüfen**, sobald #1065 grün ist
      ([Nach jedem Deploy](../../betrieb/routinen.md#nach-jedem-deploy)).
      `GET /api/status` mehrmals, damit beide Backends antworten:
      - `version` `2.3.0`, `commit` beginnt mit `dac246e`;
      - `checks.database`, `checks.migrations` und `checks.cron_leader` `ok`;
      - `migrationen.gesamt` 112, `fehlgeschlagen` leer;
      - in den Logs beider Backends `Migration FAILED`: 0;
      - im Log des Jobs `deploy` je Stufe „keine anderen Dienste neu
        erstellt".

      Ist #1065 rot, ist nichts deployt und das Release-Tor hält den
      Android-Lauf an. Dann den roten Job und die Fehlerzeile ins Ergebnis,
      Simon Bescheid geben, nichts neu anstoßen.

- [ ] **3. Android-Lauf #66 verfolgen.** Erwartet: grün; Tag
      `2.3.0+android.134` auf `dac246eb`; in der Play Console steht
      2.3.0 (134) in internem Test und Alpha, in Produktion mit 10 % und
      dem Status „In Prüfung".

      Ist der Lauf rot: Protokoll lesen und ins Ergebnis. **Nicht ohne
      Rücksprache neu starten** — war der Upload schon durch, ist
      versionCode 134 verbraucht, und ein zweiter Lauf scheitert daran.

- [ ] **4. iOS zur Prüfung einreichen** (App Store Connect):
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

## Ergebnis

<!-- Je Punkt Datum, Messwert oder Status; keine Namen, Adressen oder
     Zugangsdaten. -->
