# Store-Texte 2.1.0

Quelle: Abschnitt `## [2.1.0]` in `CHANGELOG.md`.
Beide Texte sind getrennt zu verwenden — niemals mischen.

---

## iOS — App Store Connect, "Neues in dieser Version"

> **Kein Wort über andere Plattformen — Apple lehnt danach ab.**
> Am 29.08.2026 wurde 2.0.0 (Build 149) unter Guideline 2.3.10 zurückgewiesen,
> weil im letzten Absatz "der Anzeige auf Android" stand. Ein einziger
> Halbsatz, gedacht als Aufzählung behobener Fehler. Zwei Tage Wartezeit,
> danach eine neue Prüfrunde — der Build selbst war in Ordnung.
> Verboten sind Android, Google Play, Windows und Verweise auf eine Web-App,
> in JEDEM Feld: Neues in dieser Version, Beschreibung, Werbetext, Keywords.
> Der `ios-release`-Workflow prüft das seit dem 29.08.2026 vor dem Build.

```
Diese Version räumt auf: viele kleine Fehler sind weg, und einiges läuft jetzt verlässlicher als vorher.

Konfispruch
Beim Wählen steht jetzt der Wortlaut da — in Luther 2017 und in der Gute Nachricht Bibel. Bisher sah man nur die Stellenangabe.

Ohne Netz
Wartende Vorgänge sind überall sichtbar: Was ohne Verbindung eingetragen wurde und noch nicht gesendet ist, zeigt sich unten in einer Leiste. Bisher gab es das nur bei Aktivitäten. Was endgültig nicht rausging, verschwindet nicht mehr nach vier Sekunden, sondern bleibt stehen, bis ihr es gesehen habt.

Mitteilungen
Wer die App länger nicht öffnet, bekommt danach wieder Mitteilungen — bisher endete die Zustellung nach 30 Tagen Pause stillschweigend. Wer in mehreren Gemeinden ist, meldet sich jetzt sauber ab. Gesperrte Konten bleiben still.

Termine
Bei Terminreihen öffnete die Anmeldung teils erst nach dem Termin — behoben. Termine lassen sich nicht mehr überbuchen, wenn sich jemand gleichzeitig abmeldet. Teilnehmerzahlen bedeuten überall dasselbe.

Chat
Beim Löschen eines Raums verschwinden auch die geteilten Bilder und Dateien. Die Leitung kann in eigenen Umfragen abstimmen.

Diese Version braucht iOS 16.4 oder neuer.
```

---

## Android — Google Play, "Was ist neu"

> **Dieser Text muss nach `frontend/release-notes-de.txt` kopiert werden.**
> Der Build-Workflow liest AUSSCHLIESSLICH diese Datei
> (`android-release.yml` → `upload-play.py`), nicht diese Doku hier.
> Am 27.08.2026 stand dort noch der Text von 1.5.3 — zwei Play-Uploads
> gingen mit falschen Release-Notes raus. Wer den Text hier ändert,
> ändert die Datei mit.

```
Diese Version räumt auf: viele kleine Fehler sind weg, und einiges läuft verlässlicher.

Beim Konfispruch steht jetzt der Wortlaut da, in Luther 2017 und Gute Nachricht.

Ohne Netz seht ihr überall, was noch aussteht — und was nicht rausging, verschwindet nicht mehr unbemerkt.

Mitteilungen kommen auch nach längerer Pause wieder an. Bei Terminreihen öffnet die Anmeldung rechtzeitig, und überbuchen geht nicht mehr.
```
