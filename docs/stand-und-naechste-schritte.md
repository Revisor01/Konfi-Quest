# Handoff — Stand 02.09.2026, 23:30

Für die nächste Sitzung. Alles ist auf `main` gepusht und getestet
(Backend 2085, Frontend 1039).

---

# 1. WRAPPED — das große Thema

**Simons Ärger war berechtigt und der Grund muss verstanden werden:** Ich
hatte Module gebaut, getestet und **nicht angeschlossen**. Die Tests waren
grün, weil sie die Module isoliert prüfen — ein Modul ohne Aufrufer besteht
jeden Test und tut trotzdem nichts. Simon sah deshalb keine Änderung.

**Lehre für den Umbau: Nach jedem Schritt prüfen, ob der Code auch WIRKLICH
aufgerufen wird** (`grep -rn "funktionsname" src/ | grep -v test`), nicht nur
ob die Tests grün sind.

## Was zum Wrapped fertig ist

| Sache | Zustand |
|---|---|
| Migration 143 `wrapped_ausgaben` | ausgerollt, gegen Produktionskopie getestet |
| 16 Bildmotive (Unsplash, WebP, 1,0 MB) | in `SlideBase` **angeschlossen** |
| Abzeichen-Symbole (`-outline`-Fehler) | behoben, 74 von 174 zeigten einen Pokal |
| Teamer-Rückblick für die Leitung sichtbar | behoben |
| `DELETE /wrapped/teamer?year=` | Jahresfilter ergänzt |

## Was zum Wrapped OFFEN ist — das ist die eigentliche Arbeit

**Alles steht ausführlich in `docs/wrapped-kacheln-konzept.md`. Das ist die
Quelle der Wahrheit. Simon hat ausdrücklich gesagt: „wehe irgendwelche
meiner Ideen gehen verloren."**

### 1.1 Die Kachel-Auswahl hängt an keinem Aufrufer
`backend/utils/wrappedKacheln.js` existiert, wird aber von **nichts**
gerufen. `WrappedModal.tsx` stellt die Seiten weiterhin fest verdrahtet
zusammen (`addSlide('intro')` usw., ab Zeile 239).

### 1.2 Das Modul bildet das FALSCHE Modell ab
Es steht noch auf „4 feste + 4 dynamische, Obergrenze 8". **Simons Modell ist
ein anderes:** eine Erzählung mit fester Dramaturgie, in die sich dynamische
Seiten einschieben, rund **10 Seiten** für eine aktive Person:

> Opener · Chat · Events · Kategorie · Challenges · Challenges Special ·
> Punkte · Badges · Konfi · Abschluss

### 1.3 Über 50 Kachel-Ideen sind notiert, keine gebaut
Für Konfis **und** Teamer:innen. Simons eigene Ideen namentlich:
- **Das seltenste Abzeichen**: „Das haben nur x %" (rechenbar, Abfrage steht
  im Konzept)
- **Auf den letzten Drücker**: „10 Punkte in den letzten drei Monaten"
- **Anmelde-Kacheln**: „Bei sechs Terminen unter den ersten drei", „Deine
  erste Anmeldung kam elf Minuten nach der Ankündigung", Warteliste-Held:in.
  **Nur positiv wenden** — „angemeldet, aber nicht da" ist ausgeschlossen.
- **Kategorie-Seiten**: 8 feste, benannte Seiten (Kasualien, Gottesdienst,
  Freizeit, Unterricht, Gemeinde, Jugend, Advent/Weihnachten,
  Öffentlichkeitsarbeit)
- **Über das Datum statt der Kategorie**: „Gottesdienst im Dezember ist ja
  immer auch Advent." Sechs Zeitfenster notiert. **1. Advent und Ostern
  müssen berechnet werden, nicht hartkodiert.**

### 1.4 ACHTUNG: Das Wrapped liest die falsche Datenquelle
**Muss VOR den Kategorie-Seiten behoben werden.** `routes/wrapped.js` liest
die Kategorie über `COALESCE(a.category, a.type)` — also das Textfeld
`activities.category`. Das ist bei **allen 48 Aktivitäten NULL** und wird
nirgends befüllt. Der Rückblick fällt immer auf `a.type` zurück und kennt nur
„gottesdienst" und „gemeinde".

Die echten Zuordnungen stehen in `activity_categories` (35 Stück: Kasualien
12, Gottesdienst 6, Gemeinde 5, Sonntag 5, Konfitreff 2). Auch die heutige
Seite „Dein Schwerpunkt" zeigt deshalb nur den Typ.

### 1.5 Das Layout folgt nicht Simons Entwurf
Sein Claude-Design-Projekt ist über `DesignSync` lesbar:
`projectId: 4ae8af14-e2ab-4a21-bc41-6b9e36877c6d`, Datei
`Konfi Wrapped.dc.html`. Acht Artboards, inklusive einer eigenen
Teamer-Abschlussseite.

Übernommen ist bisher nur die Bildtechnik. **Nicht übernommen:** Typo-Skala
(128 px Riesenzahl bis 14 px Label), Bebas Neue als Akzent, die
Fortschrittsleiste oben, die Seitenaufteilung.

Hinweis: Die Bilder im Entwurf sind Adobe-Stock-**Vorschauen** (ftcdn.net,
240 px) — für die Auslieferung nicht geeignet. Deshalb liegen eigene
Unsplash-Motive in `frontend/public/assets/wrapped/`.

### 1.6 Weitere offene Punkte
- Routen für die Ausgaben (`/wrapped/ausgaben` anlegen, freigeben,
  generieren) samt Oberfläche. Rechte: **Admin nur eigene Jahrgänge,
  Teamer-Ausgaben nur org_admin** (Simons Entscheidung).
- Der geplante **Abriss** steht als Kommentar in Migration 143: welche
  Spalten und Routen wann fallen. `jahrgaenge.wrapped_released_at` muss
  bleiben, solange alte App-Versionen sie lesen.

---

# 2. Sonstiger Stand

## Fertig und live
- **Update-Hinweis** in der Form der „Was ist neu"-Karte, in Blau. Tippen
  öffnet den Store.
- **„Was ist neu in Version 2.1"** für alle drei Rollen, mit eigenen
  Inhalten. Über `NEUERUNGEN_VERSION = '2_1'` gesteuert (der Weg ist in
  `useOnboardingOnce.ts` dokumentiert).
- **Chat-Ungelesen-Markierung** — zwei Fehler behoben (Cache nach dem Lesen
  nicht verworfen; Gesamtzähler las aus veralteter Closure).
  **Simon wollte das noch auf dem Gerät gegenprüfen.**
- **Drei neue Standardkategorien** für neue Gemeinden: Advent und
  Weihnachten, Jugend, Öffentlichkeitsarbeit.
- **Demo-Gemeinde gefüllt** (Org 4): 3 Foto-Challenges, 14 Beiträge mit
  Bildern, 16 Chat-Nachrichten, Teamer-Vorgeschichte. `review-konfi` hat
  jetzt 3 Momente, 19 Abzeichen, 8 Chat-Nachrichten.
- **TestFlight Build 159** ist VALID, Testinfos gesetzt.

## Wichtig zu wissen
- **Autodeploy ist AKTIV.** Jeder Push auf `main` deployt Produktion. Vorher
  Backup ziehen.
- Der Deploy prüft den Commit **nicht**, wenn ein Push kein `backend/`
  anfasst — dann selbst nachmessen (`curl konfi-quest.de/api/status`).
- Der Wrapped-Zeitraum ist das **Konfi-Jahr** (01.09.–01.05.), nicht das
  Kalenderjahr. Daten außerhalb werden ignoriert — das hat schon einmal
  eine Stunde gekostet.
- **Umlaute** in Kommentaren und Texten ausschreiben (ä, ö, ü), nicht ae/oe/ue.

## Offene Befunde
`docs/offene-befunde.md` — aktuell nur der Chat-Befund (behoben, zur
Nachvollziehbarkeit dokumentiert).

## Simon sollte noch
- Den **Unsplash-Secret rotieren** (stand im Klartext im Chatverlauf). Der
  Access-Key in `secrets.env` reicht für die Suche.
- Build 159 auf dem Gerät prüfen, besonders die Chat-Markierung.
