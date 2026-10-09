# Mindestversion setzen

Wie der Betrieb ältere App-Fassungen zum Update bittet. Was die Nutzer:innen
dabei sehen, beschreibt das Handbuch unter „Die App aktuell halten"
([03-bedienung.md](../handbuch/03-bedienung.md#die-app-aktuell-halten)).
Adressen und Zugangsdaten stehen nicht hier — das Repo ist öffentlich.

## Was die Variablen bewirken

`GET /api/app-version` meldet je Plattform `min_version`, gelesen bei jeder
Anfrage aus den Umgebungsvariablen des Backends
(`backend/utils/betriebshinweise.js`). Leer oder nicht gesetzt heißt aus.

| Variable | Wirkung |
|---|---|
| `APP_MIN_VERSION_IOS` | iOS ab 2.3: Dialog „Bitte aktualisiere Konfi Quest" mit „Später" und Store-Link |
| `APP_MIN_VERSION_ANDROID` | Android ab 2.4: zuerst Googles Vollbild-Update (sofortiges In-App-Update); kann Google nicht, derselbe Dialog wie auf iOS. Android 2.3: nur der Dialog |
| `WARTUNG_HINWEIS` | Klartext für den gelben Wartungshinweis |

Auf Android ab 2.4 lädt die App außerdem ohne jede Variable eine neuere
Version selbst im Hintergrund (flexibles In-App-Update) und bietet danach
den Neustart an. Ob es eine neuere gibt, sagt dabei Google Play für genau
dieses Gerät (Track, gestaffelte Freigabe) — nicht die Store-Version des
Servers, die aus dem App Store stammt. Die Mindestversion entscheidet nur, ob
statt dessen das Vollbild kommt.

Keine Sperre: Auch Googles Vollbild lässt sich mit der Zurück-Taste
schließen; die App läuft dann weiter, und gefragt wird beim nächsten Start
wieder (Entscheidung 27.09.2026 „Keine Zwangsupdates").

## Die Variable setzen

1. Prüfen, welche Version in Google Play für **alle** freigegeben ist
   (Play Console, Produktion, Anteil 100 %). Die Mindestversion nie höher
   setzen: Ein Gerät, dem Play die Version noch nicht anbietet, bekommt kein
   Vollbild-Update, sondern nur den Dialog — und der führt zu einer
   Store-Seite ohne Update.
2. Im Stack der Produktion `APP_MIN_VERSION_ANDROID` auf die Version setzen,
   Form `x.y.z` (etwa `2.4.0`). `2.4` oder `v2.4.0` gelten als nicht gesetzt
   und stehen einmal im Server-Log.
3. Stack aktualisieren; die Container starten neu und lesen den Wert.
4. Gegenprobe: `GET /api/app-version` muss unter `android.min_version` den
   Wert zeigen. Steht dort `null`, kommt die Variable nicht im Container an.

**Die Variable muss im Stack an den Dienst weitergereicht werden.** Die
Referenz `deploy/compose.konfi_quest.yml` trägt dafür im Backend-Dienst die
Zeilen `APP_MIN_VERSION_IOS`, `APP_MIN_VERSION_ANDROID` und
`WARTUNG_HINWEIS` unter `environment`. Fehlen sie im Live-Stack, wirkt eine
dort gesetzte Stack-Variable nicht — der offene Eintrag dazu steht in
[offene-befunde.md](../offene-befunde.md) („Live-Stack ohne Mindestversion
und Wartungshinweis"). Erst die Zeilen übernehmen, dann den Wert setzen.

Zurücknehmen: Variable leeren, Stack aktualisieren.

## Am Gerät prüfen (interner Testtrack)

Googles In-App-Updates gibt es nur für eine App, die **aus Google Play**
installiert ist, mit einem Konto, das sie dort schon einmal geladen hat, und
nur auf eine höhere `versionCode` mit demselben Signaturschlüssel. Eine per
Kabel oder APK installierte App bekommt immer den bisherigen Hinweis.

- **Vollbild:** Fassung A aus dem internen Track installieren, Fassung B mit
  höherem `versionCode` in den internen Track laden, bis Play sie dem Gerät
  anbietet (Play-Store-App: „Updates verfügbar"). `APP_MIN_VERSION_ANDROID`
  vorübergehend über die Version von A setzen. App neu starten → Googles
  Vollbild. Danach die Variable zurücknehmen.
- **Flexibel:** wie oben, aber ohne Mindestversion. App neu starten →
  Googles Rückfrage, Laden im Hintergrund, danach auf der Startseite die
  blaue Karte „Das Update ist geladen"; Tippen installiert und startet neu.
  „Nein" bei Google oder das Kreuz: Für diesen `versionCode` fragt die App
  nicht wieder, erst beim nächsten.
- **Rückfall:** dieselbe Fassung per APK installieren → nur der bisherige
  Hinweis mit Store-Link.

Datenschutz: Die Abfrage geht an die Play-Store-App des Geräts; Konfi Quest
selbst erhebt dabei nichts. Google beschreibt die Daten (Gerätemerkmale,
App-Version) in der Doku der Play-Core-Bibliotheken als Teil des
Play-Dienstes. Der Abschnitt „Datensicherheit" in der Play Console ändert
sich dadurch nicht; das iOS-Datenschutzmanifest ist nicht betroffen, weil
das Plugin dort nicht eingebunden ist.
