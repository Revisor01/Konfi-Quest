# Gestaltung

Wie Konfi Quest aussieht und wo das festgelegt ist — für die App auf iPhone,
Android und im Browser, dazu ein Abschnitt zu den Doku-Seiten. Die Werte
selbst stehen nur im Code; hier steht, wo, und welche Regeln Tests halten.
Stand: 09.10.2026.

## Wo es festgelegt ist

| Datei (unter `frontend/src/`) | Inhalt |
|---|---|
| `theme/variables.css` | Einstieg: Farb-Tokens, Anbindung an Ionic, Dunkelmodus, die gemeinsamen Klassen; lädt die übrigen Dateien |
| `theme/typografie.css` | Schriftgrößen und -schnitte: `--app-text-*` (Fließtext bis Überschrift), `--app-anzeige-*` (große Zahlen, Symbole), `--app-schrift-*` (400–900) |
| `theme/abstaende.css` | Abstände `--app-abstand-*` (Standard `basis` 16 px, `eng` 8 px), Radien `--app-radius-*`, Schatten `--app-schatten-*` |
| `theme/barrierefreiheit.css` | sichtbarer Fokus, Berührungsziele ab 44 px (`.app-beruehrungsziel`), nackte Knöpfe (`.app-knopf-nackt`), reduzierte Bewegung |
| `theme/colors.ts` | Spiegel der Farben für Stellen, an denen CSS-Variablen nicht gehen (SVG-Attribute, QR-Code, Alpha-Rechnungen) |
| `components/shared/icons.ts` | die zentral vergebenen Symbole (Ionicons, dazu ein eigener Zurück-Pfeil im Heroicons-Stil) |
| `utils/rollenNamen.ts` | Rolle → Farbe (`rollenFarbe`, `rollenFarbeVar`) und Anzeigename der Rolle |

Das Grundaussehen kommt aus zwei Ionic-Themes: `@rdlabo/ionic-theme-ios27`
für iOS und `@rdlabo/ionic-theme-md3` (Material Design 3) für Android. Beide
folgen der Systemeinstellung hell/dunkel; Ionics Palette `dark.system.css`
lädt `App.tsx`.

## Regeln, die Tests halten

- **Farben nur als Token.** Keine rohe Hexfarbe in `.tsx`-Komponenten, keine
  rohe Farbe und kein rohes `rgba()` in CSS-Regeln; je Rolle genau ein
  Verlauf; `theme/colors.ts` trägt exakt die Token-Werte
  (`farbTokens.test.ts`).
- **Schrift nur als Token.** Keine Komponente setzt `fontSize` oder
  `fontWeight` als Zahl, px, rem oder em (`typografieTokens.test.ts`).
- **Abstände, Radien, Schatten nur als Token**, auch in Ionic-Teilvariablen;
  jedes neutrale Schatten-Token hat eine dunkle Fassung
  (`abstaendeTokens.test.ts`).
- **Symbole zentral** aus `components/shared/icons.ts`
  (`zentraleIcons.test.ts`); Symbole sind Ionicons, keine Emojis als
  Bedienelement.
- **Dunkelmodus:** die Stylesheet-Tests (`dunkelmodus.test.ts`) und
  gerendert von Hand vor und nach jeder Farbänderung
  ([dunkelmodus-pruefen.md](dunkelmodus-pruefen.md)).
- **Texte:** echte Umlaute (`umlauteInNutzertexten.test.ts`); die Begriffe
  Events, Badges, Challenges, Stempel (`begriffeEinheitlich.test.ts`; Glossar
  im Handbuch, [Die Begriffe der App kennen](../handbuch/03-bedienung.md#die-begriffe-der-app-kennen)).
- **Bedienbarkeit:** Formularfelder mit Namen für Vorlesehilfen, klickbare
  Flächen mit Rolle und Tastatur, benannte Dialoge (Tests unter
  `__tests__/components/`, etwa `klickbareElementeBedienbar.test.ts`).

## Farben

Jeder Bereich der App hat eine Farbe, als Token `--app-color-<bereich>` mit
`-rgb` (für Transparenz) und meist `-dunkel` (Verlaufsende). Die Werte
stehen in `theme/variables.css`, Block „APP COLOR TOKENS".

| Token | Bereich |
|---|---|
| `events` | Events |
| `activities` | Aktivitäten und Anträge |
| `gottesdienst`, `gemeinde` | die beiden Punktarten |
| `konfis` | Konfis (Rolle konfi) |
| `teamer` | Team (Rolle teamer) |
| `leitung` | Leitung (Rolle admin) |
| `users` | Gemeindeleitung (Rolle org_admin), Benutzerverwaltung |
| `challenges` | Challenges und Stempel |
| `badges` | Badges |
| `chat` | Chat |
| `material` | Material |
| `jahrgang`, `categories`, `level`, `bonus`, `zertifikate`, `wrapped` | Jahrgänge, Kategorien, Level, Bonuspunkte, Zertifikate, Jahresrückblick |
| `success`, `warning`, `danger`, `info`, `neutral` | Zustände |

**Schrift in Bereichsfarbe** schreibt mit `--app-text-<bereich>`: im Hellen
die Bereichsfarbe selbst, im Dunkeln eine aufgehellte Stufe mit mindestens
4,5:1 auf Karte und Seitengrund. Grautöne für Text: `--app-text-muted`,
`--app-text-system`, `--app-text-tertiary`. Flächen im Dunkelmodus hängen an
`--app-surface-*`; Ionics Flächenvariablen sind je Plattform darauf gebunden,
damit iOS und Android gleich aussehen.

## Schriften

- **Text:** die Systemschrift des Geräts (Ionic-Vorgabe).
- **Überschriften:** Outfit (500–800), geladen über Google Fonts in
  `theme/variables.css`; Token `--app-schriftart-ueberschrift`. Sie gilt für
  Banner-Titel, Abschnittsköpfe (`ion-list-header`), Titel in Listen,
  Kennzahlen und die Startseiten.
- **Marke:** Bebas Neue, geladen in `index.html`; Token
  `--app-schriftart-marke` — der Schriftzug „KONFI QUEST" auf den
  Anmeldeseiten und die Akzentschrift im Jahresrückblick.

## Bausteine einer Seite

| Baustein | Wofür |
|---|---|
| `IonContent className="app-gradient-background"` | Seitengrund |
| `AppKopfzeile` (`components/shared/`) | Kopfzeile mit Titel, Gemeinde-Umschalter (nur auf den Seiten der Leiste unten) und Glocke |
| `SectionHeader` | farbiger Kopf-Banner einer Seite mit bis zu drei Kennzahl-Kacheln; Farbe über `preset` (Bereich) |
| `ListSection` | Abschnitt: eingerückte Liste (`IonList inset`) mit Kopf (`IonListHeader`, runder Symbolkreis `.app-section-icon`, Titel, Anzahl) und Karte (`IonCard .app-card`); bringt den Leerzustand mit |
| `.app-list-item` mit `--<bereich>` | Eintrag mit farbigem Rand links; innen `__row`, `__main`, `__content`, `__title`, `__meta`; ausgewählt `--selected` |
| `.app-icon-circle` (`--lg` 40 px) mit `--<bereich>` | runder Symbolkreis im Eintrag und in den Wisch-Aktionen (`--danger` zum Löschen) |
| `.app-corner-badge` | Eck-Marke oben rechts (Zustand eines Events, Warteschlange); `EventCornerBadges` |
| `EmptyState` | Leerzustand mit Symbol und Satz |
| `IonItemSliding` | Wisch-Aktionen; Löschen nach links |

**Dialoge** öffnen über den Hook `useIonModal`, mit eigener `IonPage`,
Kopfzeile (Schließen links, Speichern rechts) und `app-gradient-background`.
`<IonModal>` steht nur dort, wo es nicht anders geht — Datumswähler,
Postfach, „Neuer Rückblick". Den Namen für Vorlesehilfen setzt
`utils/modalNamen.ts` aus dem Titel.

## Reiter, Filter und Leertexte einer Seite

Jede Seite gibt es zweimal: als App (`components/**/pages`, `views`) und im
breiten Browserfenster als Web-Fassung (`components/**/web`); die Weiche ist
`useBreitesLayout()`. Was beide zeigen — Reiter mit Schlüssel und
Beschriftung, Filteroptionen mit ihrem Prädikat, der Satz zur Zahl am Reiter,
Leertexte, Titel —, steht je Seite **einmal** unter `frontend/src/seiten/`
(`mitmachenLeitung.ts`, `badgesKonfi.ts`, …), gebaut mit `wahlen()` aus
`seiten/beschreibung.ts`. Die App macht daraus `IonSegmentButton`s, die
Web-Fassung `WebChips` oder `WebReiter`; beide lesen mit
`inFassung(liste, 'app' | 'web')`.

- **Einen Filter oder Reiter hinzufügen:** in der Datei der Seite einen
  Eintrag `{ schluessel, label, leer, passt }` an der richtigen Stelle der
  Liste ergänzen. App und Browser zeigen ihn danach beide; der Schlüssel gilt
  auch für `?filter=` in der Adresse. Rechnet die Seite die Liste nicht mit
  einem Prädikat (etwa die Zeiträume der Events, die offene und abgesagte
  Events zugleich brauchen), steht der Grund am Eintrag.
- **Nur in einer Fassung:** `nurIn: 'app' | 'web'` mit `warum` — ohne Grund
  baut es nicht. So steht ein bewusster Unterschied an derselben Stelle wie
  das Gemeinsame.
- **Zu lang für die Reiterleiste der App:** `kurz` („GoDi" statt
  „Gottesdienst"); der Browser zeigt `label`.
- **Bleibt in der Fassung:** Beschriftung und Platzhalter der Suchfelder (in
  der App heißt dasselbe Feld in allen Rollen gleich,
  `begriffeEinheitlich.test.ts`; im Browser ist der Platzhalter ein Beispiel)
  und alles, was nur das Aussehen betrifft.

Gerenderte Tests prüfen je Seite, dass App und Web-Fassung genau die Reiter
der Beschreibung zeigen (`__tests__/seiten/`,
`__tests__/components/termineWeb/seitenbeschreibungMitmachen.test.tsx`).

## Doku-Seiten

Handbuch und API-Referenz unter `frontend/public/docs/` erzeugen
`scripts/build-handbuch.mjs` und `scripts/build-api-docs.mjs` mit eigenem
Stylesheet, nicht mit dem der App. Sie lehnen sich an die App an: Bebas Neue
für Überschriften und Kennzahlen (wie der Schriftzug der App), Plus Jakarta
Sans für Text, JetBrains Mono für Code, alle drei über Google Fonts. Die
Farbe je Handbuch-Kapitel steht im Kopf des Kapitels (`farbe:`), die Farbe
je API-Gruppe in `GRUPPEN` in `build-api-docs.mjs` — beide von Hand nach den
Bereichsfarben der App gewählt, nicht aus `theme/variables.css` gelesen.
