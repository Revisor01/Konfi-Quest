# Store-Texte 2.0.0

Quelle: Abschnitt `## [Unreleased] - 2.0.0` in `CHANGELOG.md`.
Beide Texte sind getrennt zu verwenden — niemals mischen.

---

## iOS — App Store Connect, "Neues in dieser Version"

> **Kein Wort über andere Plattformen — Apple lehnt danach ab.**
> Am 29.08.2026 wurde 2.0.0 (Build 149) unter Guideline 2.3.10 zurückgewiesen,
> weil im letzten Absatz "der Anzeige auf Android" stand. Ein einziger
> Halbsatz, gedacht als Aufzählung behobener Fehler. Die Ablehnung kostete
> zwei Tage Wartezeit, danach eine neue Prüfrunde — der Build selbst war in
> Ordnung und blieb unverändert.
> Verboten sind Android, Google Play, Windows und Verweise auf eine Web-App,
> in JEDEM Feld: Neues in dieser Version, Beschreibung, Werbetext, Keywords.
> Vor dem Einreichen prüfen:
> `grep -niE "android|google play|play store|windows" docs/store-texte-*.md`
> — im iOS-Abschnitt darf davon nichts stehen.

Zeichen: 1820 (Limit 4000)

```
Konfi Quest 2.0 ist das größte Update bisher.

Challenges
Neu sind Challenges: Aufgaben, auf die ihr über einen selbst gewählten Zeitraum mit Foto, Text, Aufnahme oder Link antwortet. Bewusst ohne Punkte, ohne Zähler und ohne Rangliste — fürs Mitmachen gibt es einen Stempel. Bei jedem Beitrag entscheidet ihr selbst, ob er mit Namen, anonym oder nur für die Leitung sichtbar ist. Teamer:innen und Leitung machen mit, es gibt auch Runden nur fürs Team. Challenges haben einen eigenen Platz unten in der Leiste.

Mitmachen statt Events
Der Tab "Events" heißt jetzt "Mitmachen" und trägt Termine und Aktivitäten gemeinsam. Aus "Anträgen" werden überall "Aktivitäten" — gemeldet wird, was schon passiert ist. Teamer:innen können bei Terminen jetzt ausdrücklich zu- oder absagen, mit freiwilliger Begründung. Für Teamer:innen gibt es eigene Plätze und eine eigene Warteliste.

Handbuch
Unter konfi-quest.de/docs steht ein Handbuch, das für Konfis, Teamer:innen und die Leitung getrennt erklärt, was in der App geht — Kapitel für Kapitel, mit Nachschlage-Teilen zu Zugängen und zu allen Abzeichen.

Chat
Private Zweiergespräche kann nur noch lesen, wer selbst daran beteiligt ist. Anonyme Umfragen sind wirklich anonym. Ungesendete Nachrichten überleben einen App-Neustart und gehen später zuverlässig raus. Die Leitung kann einen Chat-Verlauf als Textdatei sichern.

Offline
Termine, Tageslosung und das Melden von Aktivitäten funktionieren jetzt auch ohne Verbindung; Meldungen werden nachgesendet. Aktionen, die wirklich Netz brauchen, sagen das.

Außerdem
Listen und Zähler aktualisieren sich live bei allen Beteiligten. Der Jahresrückblick erzählt jetzt euren eigenen Weg statt Platzierungen. Dazu viele Korrekturen an Abzeichen, Terminzahlen, Anwesenheit und der Darstellung.

Diese Version braucht iOS 16.4 oder neuer.
```

---

## Android — Google Play, "Was ist neu"

> **Dieser Text muss nach `frontend/release-notes-de.txt` kopiert werden.**
> Der Build-Workflow liest AUSSCHLIESSLICH diese Datei
> (`android-release.yml` → `upload-play.py`), nicht diese Doku hier.
> Am 27.08.2026 stand dort noch der Text von 1.5.3 vom 04.08. — zwei
> Play-Uploads gingen deshalb mit falschen Release-Notes raus und mussten
> von Hand nachkorrigiert werden. Wer den Text hier ändert, ändert die
> Datei mit.

Zeichen: 465 (Limit 500)

```
Konfi Quest 2.0 bringt Challenges: Aufgaben, auf die ihr mit Foto, Text, Aufnahme oder Link antwortet — ohne Punkte und ohne Rangliste, mit Stempel fürs Mitmachen. Ihr entscheidet je Beitrag, ob mit Namen, anonym oder nur für die Leitung.

Aus "Events" wird "Mitmachen" mit Terminen und Aktivitäten. Teamer:innen können zu- und absagen. Neu: ein Handbuch für alle Rollen.

Vieles geht jetzt offline, Listen aktualisieren sich live, Push kommt wieder zuverlässig an.
```
