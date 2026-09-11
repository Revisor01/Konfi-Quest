# Store-Texte 2.1.1

Quelle: Abschnitt `## [2.1.1]` in `CHANGELOG.md`.
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

> **Die Benachrichtigungsgruppen gehören hier NICHT hinein.** Sie sind eine
> Eigenheit des jeweils anderen Systems; auf dem iPhone gibt es nur einen
> Schalter für die ganze App. Ein Hinweis darauf wäre nicht nur ein
> Plattform-Verweis, sondern schlicht falsch.

```
Beim Senden und Öffnen von Dateien im Chat zeigt die Nachricht jetzt, wie weit sie ist. Vorher passierte scheinbar nichts, besonders bei größeren PDFs.

Der Jahresrückblick fürs Team ist da: eigene Seiten für Challenges und Zertifikate. Wer ein Jahr pausiert hat, bekommt einen Zuspruch statt leerer Zahlen. Während der Konfizeit steht am Ende ein Blick nach vorn.

Neue Gemeinden starten mit Abzeichen fürs Team. Ein neues Handbuch-Kapitel erklärt, was überall gleich funktioniert.

Die App startet schneller: Beim Öffnen wird nur geladen, was die eigene Rolle braucht.

Behoben: Ein Einladungslink mit Code ließ die Seite endlos neu laden. Die Registrierung funktioniert wieder.
```

---

## Android — Google Play, "Was ist neu"

> **Dieser Text muss nach `frontend/release-notes-de.txt` kopiert werden.**
> Der Build-Workflow liest AUSSCHLIESSLICH diese Datei
> (`android-release.yml` → `upload-play.py`), nicht diese Doku hier.
> Am 27.08.2026 stand dort noch der Text von 1.5.3 — zwei Play-Uploads
> gingen mit falschen Release-Notes raus. Wer den Text hier ändert,
> ändert die Datei mit.

> **Höchstens 500 Zeichen.** `upload-play.py` bricht sonst ab (bewusst, statt
> still abzuschneiden). Der Text unten hat 445.

```
Benachrichtigungen lassen sich jetzt einzeln einstellen: Nachrichten, Termine, Punkte und Abzeichen sowie Anfragen und Freigaben. Jede Gruppe kann für sich leiser oder stumm gestellt werden.

Beim Senden und Öffnen von Dateien im Chat zeigt die Nachricht, wie weit sie ist. Vorher passierte scheinbar nichts.

Die Anmeldung per Fingerabdruck steht wieder zur Verfügung.

Behoben: Ein Einladungslink mit Code ließ die Seite endlos neu laden.
```
