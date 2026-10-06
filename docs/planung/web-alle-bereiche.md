# Web-Fassung für alle Bereiche

Stand: 03.10.2026. Baut auf der Web-Version ([web-version.md](web-version.md))
und der Web-Fassung der Support-Ansicht ([support-web.md](support-web.md)) auf.

## Was Simon will (03.10.2026)

> „Alle anderen Bereiche sollen im Web auch auf eine bessere Ansicht umgebaut
> werden. Kriegst du das mit dem bestehenden CSS hin? So dass wir zu einer
> nativen iOS- und einer nativen Web-Experience kommen. Das wäre toll.
> Dashboard, Chat etc. Mach das ein großer Wurf. Von mir aus auch getrennte
> Systeme."

## Entschieden

1. **Zwei Gesichter, eine App.** Jede Seite zeigt im Browser ab 992 px
   (`useBreitesLayout()`, `navigation/breitesLayout.ts`) eine eigene
   **Web-Fassung**; die App (iPhone, Android) und das schmale Fenster bleiben
   **unverändert** — sie sind das native Gesicht für die Geräte. Bestehende
   Tests der App-Darstellung bleiben unangetastet grün.
2. **Getrennte Systeme, gemeinsame Logik.** Die Web-Fassung ist ein eigener
   Komponentenbaum je Seite (`components/<bereich>/web/`); Daten, Rechte und
   Aktionen kommen aus denselben Hooks bzw. Funktionen wie in der App. Wo eine
   Seite ihre Logik noch im Render hat, wird sie zuerst in einen Hook gezogen
   (Vorbild: `components/support/use*.ts`) — ohne die App-Darstellung zu
   ändern.
3. **Bausteine:** `components/web/` (Seite, Karte, Kachel, Tabelle, Pill,
   Chips, Suche, Akkordeon, Link, Knopf, Dialog, Feld, Auswahl, Spalten,
   Diagramme, Zustände). Neue allgemeine Bausteine eines Bereichs entstehen
   zunächst in `components/<bereich>/web/` und wandern beim Zusammenführen
   nach `components/web/`.
4. **Stylesheets:** `theme/web-ansicht.css` (allgemein, nicht ändern ohne
   Absprache) und je Bereich `theme/web/<bereich>.css`, eingebunden von den
   Web-Komponenten des Bereichs. Regeln für beide: Präfix `web-`, nur Tokens,
   Dunkelmodus über Tokens, keine Bewegung, kein Eingriff in Ionic —
   `__tests__/components/webAnsichtCss.test.ts` prüft das.
5. **Webmäßig heißt:** Inhalte nutzen die Breite (Raster, Spalten, Tabellen
   statt Listenelemente); echte Links (`WebLink`, Mittelklick öffnet neuen
   Tab); Hover und sichtbarer Fokus; Tastatur (Enter, Escape, Pfeiltasten wo
   sinnvoll); Seitenkopf mit Titel und Aktionen statt Kopfzeilen-Knöpfen;
   Detailseiten zweispaltig; Formulare in `WebDialog` oder auf der Seite —
   bestehende Ionic-Modale dürfen für große Formulare bleiben, wo ein Umbau
   die Logik doppeln würde.
6. **Je Bereich:**
   - **Chat** (alle Rollen): zweigeteilt wie ein Messenger im Browser — links
     die Räume mit Suche und Zahlen, rechts der geöffnete Raum; `/…/chat` zeigt
     die Liste mit leerem rechten Teil, `/…/chat/room/:id` dieselbe Ansicht mit
     dem Raum. Eingabe unten, Enter sendet, Umschalt+Enter neue Zeile.
   - **Start** (Konfi, Team): Raster aus Karten — Punkte und Ziele, nächste
     Termine, laufende Challenges, neue Badges, Hinweise; Badges und Profil
     als Raster bzw. zweispaltige Seite.
   - **Termine / Mitmachen** (alle Rollen): Liste als Tabelle bzw. Karten im
     Raster mit Filtern; Detail zweispaltig (Angaben links, Teilnehmende,
     Anwesenheit, Aktionen rechts); Anträge der Leitung als Tabelle.
   - **Challenges** (alle Rollen): Karten im Raster; Detail zweispaltig
     (Aufgabe und Beiträge, rechts Status, Stempel, Aktionen).
   - **Leitung**: Konfis als Tabelle mit Suche, Filtern, Sortierung; Konfi-
     Detail zweispaltig; Team/Benutzer:innen als Tabelle; „Mehr" als Raster
     der Bereiche; Kategorien, Jahrgänge, Level, Einladungen, Zertifikate,
     Startseiten-Einstellungen, Material, Rückblick, Betrieb als Tabellen und
     Formulare.
7. **Keine Änderung an Antwortformen.** Das Paket ist Frontend; braucht eine
   Web-Fassung Daten, die es nicht gibt, steht das im Bericht und wird
   additiv nachgezogen.

## Gebaut (06.10.2026)

Web-Fassungen für Chat, Start, Badges und Profil (Konfi, Team, Leitung),
Mitmachen (Events, Aktivitäten, Anträge), Challenges und die Leitung (Konfis,
Team, Verwaltungsseiten, „Mehr" als Kacheln, Material), im PR „Web-Ansicht
aller Bereiche und Support-Vorgänge". Bausteine in `components/web/`,
Bereichsteile in `components/<bereich>/web/`, Stil in `theme/web/<bereich>.css`;
der Wächter `webAnsichtCss.test.ts` prüft beides. Beschrieben im Handbuch je
Kapitel unter „Im Browser …".

## Offen

- Konfi-Detail und Termin-Detail sind die größten Seiten; was dort an
  Ionic-Modalen bleibt, wird nach dem ersten Durchgang entschieden.
