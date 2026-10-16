# Barrierefreiheit im App Store angeben

Apple zeigt auf der Produktseite, welche Bedienungshilfen eine App
unterstützt („Accessibility Nutrition Labels"). Die Angaben macht der Betrieb
in App Store Connect; dieses Blatt sagt, was Konfi Quest heute angeben darf
und warum. Geprüft am 15.10.2026 am Code und an Apples Kriterien, gegengeprüft
von einer zweiten Durchsicht. Offene Lücken stehen in
[offene-befunde.md](../offene-befunde.md#release) („Barrierefreiheitsangaben
im App Store").

## Wo und wann

- **Wo:** App Store Connect › die App › *App Accessibility* (App-Barrierefreiheit)
  › *Get Started*. Die Fragen kommen je Gerät; Konfi Quest läuft nur auf dem
  **iPhone** (`TARGETED_DEVICE_FAMILY = 1`). Auf iPad, Mac und Vision Pro
  gelten die iPhone-Angaben.
- **Wann:** Die Angaben gelten für die App, nicht für eine Version, und sind
  nach dem Veröffentlichen sofort sichtbar (bis zu 24 Stunden). Veröffentlichen
  lässt Apple nur für ein Gerät mit einer Live-Version. **Erst veröffentlichen,
  wenn 2.4.0 live ist** — in 2.3.0 bauen sich die Punkte-Ringe auch bei
  „Bewegung reduzieren" noch auf.
- **Grundregel von Apple:** Ein Merkmal nur ankreuzen, wenn *alle häufigen
  Aufgaben* der App damit gehen. Fehler, die die Antwort ändern würden,
  heißen: nicht angeben.

Häufige Aufgaben von Konfi Quest: Einführung und Anmeldung (Konfis auch
Registrieren mit Code), Profil und Mitteilungen, Postfach, Chat (lesen,
schreiben, Dateien, Reaktionen, Umfragen); Konfi: Punkte, Events anmelden und
einchecken, Aktivität melden, Challenges, Badges; Team: Events zusagen,
Challenges, Material; Leitung: Konfis, Punkte, Anträge prüfen, Events und
Anwesenheit, Challenges freigeben, Benutzer:innen.

## Was ankreuzen

| Merkmal (App Store Connect) | Angabe | Grund |
|---|---|---|
| Reduced Motion — Reduzierte Bewegung | **Ja** (ab 2.4.0 live) | Bei „Bewegung reduzieren" stehen Seitenübergänge, Fenster, Schütteln, Ladepunkte, Badge-Puls und Glas-Effekt still; Ringe und Zähler stehen sofort auf ihrem Wert. Mit Tests und im [Handbuch](../handbuch/03-bedienung.md#bewegung-reduzieren). |
| Dark Interface — Dunkle Benutzeroberfläche | Nein | Die App folgt dem Dunkelmodus vollständig, aber der Startbildschirm ist ein deckend weißes Bild: Beim Kaltstart blitzt er weiß auf. Wird er dunkel, ist „Ja" möglich. |
| Differentiate Without Color Alone — Ohne Farben unterscheiden | Nein | Ausgewählte Einträge in Mehrfachauswahlen tragen nur eine Tönung, keinen Haken; Rollen sind an manchen Stellen nur an der Farbe zu erkennen. |
| Sufficient Contrast — Ausreichender Kontrast | Nein | Mehrere Texte und Marken liegen im Hellen unter 4,5:1; auf „Kontrast erhöhen" reagiert die App nicht (Entscheidung 29.09.2026: zurückgestellt). |
| VoiceOver | Nein | Ein Durchgang am iPhone fehlt; im Code sagen viele Symbole und Fotos nichts an, die Anwesenheitsmatrix ist für VoiceOver stumm. |
| Voice Control — Sprachsteuerung | Nein | Ein Durchgang am iPhone fehlt (lange drücken, wischen, passende Namen). |
| Larger Text — Größerer Text | Nein | Die Schrift folgt der Systemgröße; ob bei den größten Stufen (AX3 bis AX5) nichts überlappt oder unlesbar gekürzt wird, ist am Gerät noch nicht geprüft. |
| Captions — Untertitel | Nein | Videos und Sprachaufnahmen von Nutzer:innen (Chat, Challenges) lassen sich nicht untertiteln; Apple verlangt dafür einen Weg. |
| Audio Descriptions — Audiobeschreibungen | Nein | Wie bei den Untertiteln: für Videos von Nutzer:innen gibt es keine Beschreibungsspur. |

## Vor dem nächsten „Ja" am iPhone prüfen

Mit einem TestFlight-Build auf einem iPhone mit iOS 26, je ein Konto als
Konfi, Teamer:in und Leitung, jeweils alle häufigen Aufgaben der Rolle:

- **Bewegung reduzieren:** Bedienungshilfen › Bewegung › „Bewegung
  reduzieren" an, App neu starten: Seitenwechsel, Fenster, falsches Passwort,
  Punkte-Ringe, Einführung, Reiterleiste. Dann die Einstellung bei laufender
  App umschalten — die Seitenübergänge werden erst nach einem Neustart ruhig.
- **Dunkelmodus:** iPhone auf Dunkel, App ganz beenden und neu öffnen —
  blitzt der Startbildschirm weiß auf? Danach alle Aufgaben im Dunkeln.
- **Ohne Farbe:** Bedienungshilfen › Anzeige & Textgröße › Farbfilter ›
  Graustufen: Stand von Events, Anträgen, Challenges und Badges, Anwesenheit,
  Auswahl in Listen, Umfrage-Wahl, Rollen.
- **Größerer Text:** „Größere Schriftgrößen" an, erst AX3, dann ganz rechts
  (AX5), App jeweils neu starten.
- **VoiceOver** und **Sprachsteuerung** („Nummern einblenden", „Namen
  einblenden", „Lange drücken", „Nach links wischen").

Nur ankreuzen, was in allen häufigen Aufgaben bestanden hat; Ergebnis und
Datum in [offene-befunde.md](../offene-befunde.md#release) nachtragen.

## Quellen

- [Overview of Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels)
- [Manage Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/manage-accessibility-nutrition-labels)
- Kriterien je Merkmal: die Seiten „… evaluation criteria" unter
  [Manage app accessibility](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/)
