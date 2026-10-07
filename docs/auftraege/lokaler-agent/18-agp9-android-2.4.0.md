# 18. Android-Gradle-Plugin 9 für 2.4.0, getestet von Malte

Stand 07.10.2026. Simon: „warum updaten wir nicht auf die 9 und testen es mit
malte" — „das machen wir also alles in der 2.4.0". Anlass: die Empfehlungen
der Play Console zu Release 2.3.0, eingetragen in
[offene-befunde.md](../../offene-befunde.md) unter „Release“ (Punkt 4: R8).

## Ziel

Die Android-App baut mit dem Android-Gradle-Plugin (AGP) 9. In der Play
Console bekommen damit auch „Optimierte Entfernung von Ressourcen“ und
„Klassen neu bündeln“ ihren Haken („Vollständiger Modus“ und „Entfernung von
Ressourcen“ haben ihn schon). Malte prüft den Build vorher im internen
Testtrack auf seinem Gerät. Ausgeliefert wird mit 2.4.0.

## Bekannter Stolperstein

AGP 9 kennt die Standarddatei `proguard-android.txt` nicht mehr; Capacitor
selbst und viele Plugins haben sie verwendet, dann bricht der Build. Das
Capacitor-Team hat es in Core und allen offiziellen Plugins auf
`proguard-android-optimize.txt` umgestellt — es reicht, `@capacitor/android`,
`@capacitor/core` und die offiziellen Plugins auf den neuesten Stand zu
bringen. Notbehelf (nur vorübergehend): `android.r8.proguardAndroidTxt.disallowed=false`
in `android/gradle.properties`.

## Schritte

- [x] **1. Branch** von `main`. AGP in `frontend/android/build.gradle`
      (heute 8.13.1) auf 9.x, dazu den Gradle-Wrapper auf die Version, die
      AGP 9 verlangt. Capacitor-Pakete und offizielle Plugins aktualisieren.
      *Erledigt 08.10.2026, Branch `chore/agp9-android`:* AGP 9.2.1, Gradle
      9.5.1, google-services 4.5.0 (die Kombination von Capacitor 9).
      Die npm-Pakete blieben bewusst stehen: Kein Plugin brauchte ein Update
      (siehe 2), und ein Plugin-Update im selben Build hätte Maltes Befunde
      unklar gemacht.
- [x] **2. Fremd-Plugins prüfen**, eins nach dem anderen (Firebase, Barcode,
      alle übrigen aus `frontend/package.json`): verweist eins noch auf
      `proguard-android.txt`? Nicht raten — im Paket nachsehen.
      *Erledigt:* Alle 17 Plugins und Capacitor selbst nutzen schon
      `proguard-android-optimize.txt`; der Test
      `androidGradlePlugin9.test.ts` hält das fest. Lokal (unsigniert, kein
      Store-Bau) AGP 8 gegen 9 verglichen: In Bridge, Plugins, App, Firebase,
      ShortcutBadger und Cordova entfernt R8 nichts zusätzlich; Firebase- und
      Crashlytics-Kennungen stehen in beiden Bundles.
- [x] **3. Android-Build in der CI grün.** Lokal wird nicht gebaut
      (siehe Release-Workflow). `android-test` und der Release-Workflow im
      Probelauf müssen durchlaufen.
- [x] **4. Interner Testtrack für Malte** — nur auf Simons Zuruf hochladen.
      Testinfo mit Klickpfad: Start und Anmeldung, Push empfangen und
      antippen, QR-Code scannen (Check-in), Foto zu einer Aktivität
      hochladen, Datei im Chat, Systemleiste oben und unten (hell/dunkel).
      *Erledigt 08.10.2026:* `android-test` grün (PR #231). Auf Simons
      Zuruf ohne Probelauf gleich hochgeladen: versionCode 135 in internal
      und alpha, Tag `2.4.0+android.135`, Bundle 9.329.552 Bytes, Mapping
      zu Crashlytics hochgeladen. **Offen: Maltes Rückmeldung je Prüfpunkt.**
      Der Bau enthält alles, was seit 134 auf `main` liegt, nicht nur AGP 9.
- [ ] **5. Ausliefern mit 2.4.0**, wenn Malte nichts findet; CHANGELOG unter
      „Sonstiges“ (Interna, ohne Versions- oder Werkzeugnamen in Nutzersicht).

**Nicht in denselben Build:** die Play-Hinweise zu den eingestellten
Statusleisten-APIs und zur festen Ausrichtung (Punkte 2 und 3 in der
Befundliste). Findet Malte etwas, soll klar sein, woher es kommt.

**Ergebnis:** AGP 9 im Repo, Build in der CI grün, Maltes Rückmeldung je
Prüfpunkt, Haken in der Play Console nach dem Release.
