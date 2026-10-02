# Dokumentation

Was unter `docs/` liegt, für wen es gedacht ist und was daraus erzeugt wird.
Wie Doku zusammen mit dem Code geändert wird, steht in
[CLAUDE.md](../CLAUDE.md) („Drei Dinge im selben Commit mitschreiben").

## Wo was steht

| Ort | Inhalt | Für wen |
|---|---|---|
| [handbuch/](handbuch/) | Anwenderhandbuch, ein Kapitel je Datei; Einstieg [00-start.md](handbuch/00-start.md) | Gemeinden: Konfis, Team, Leitung |
| [api/](api/) | API-Doku als OpenAPI 3.1, eine Datei je Bereich; dazu [ABRISS.md](api/ABRISS.md), welche Routen alte App-Versionen noch rufen und wann sie wegdürfen | Entwicklung |
| [architektur.md](architektur.md) | wie die Teile zusammenhängen: Gemeinden, Rollen, Backend, Datenbank, Push, Apps, Deploy | Entwicklung, Betrieb |
| [offene-befunde.md](offene-befunde.md) | **die eine Liste für alles Offene**: Fehler, Entscheidungen bei Simon, Geplantes, Zurückgestelltes | alle |
| [planung/](planung/) | was als Nächstes gebaut wird: [Web-Version mit Support-Ansicht](planung/web-version.md), [„darf freigeben"](planung/darf-freigeben.md), [Mehrfach-Konten](planung/mehrfach-konten.md), [Feature-Empfehlungen](planung/feature-empfehlungen.md) | Simon, Entwicklung |
| [betrieb/](betrieb/) | [Sicherung und Wiederherstellung](betrieb/sicherung.md), [Gemeinde anlegen](betrieb/gemeinde-anlegen.md), [wiederkehrende Routinen](betrieb/routinen.md), [Release](betrieb/release.md) | Betrieb |
| [auftraege/lokaler-agent/](auftraege/lokaler-agent/) | aktuelle Aufträge an den lokalen Agenten mit Server- und Konsolenzugang | lokaler Agent |
| [wissen/](wissen/) | Hintergrund: [Gestaltung](wissen/gestaltung.md), [Dunkelmodus prüfen](wissen/dunkelmodus-pruefen.md) | Entwicklung |
| [messung/umami.md](messung/umami.md) | anonyme Nutzungsmessung: was gemessen wird, was nicht, offene Vorschläge | Simon, Entwicklung |
| [screenshots/](screenshots/) | Bildschirmfotos, je Gerät ein Ordner (`iphone/`, `play/`); Quelle für Handbuch und Store-Einträge | Handbuch, Stores |
| [store-texte-2.3.0.md](store-texte-2.3.0.md) | Texte für App Store und Google Play zur aktuellen Version | Release |
| [bildnachweise.md](bildnachweise.md) | Herkunft und Lizenz verwendeter Bilder | alle |

Store-Texte heißen immer `store-texte-<version>.md` und bleiben unter diesem
Namen: `ios-release.yml` prüft jede solche Datei auf Plattform-Verweise im
iOS-Abschnitt. Die Texte älterer Versionen stehen in der Git-Historie.

## Was erzeugt wird

`docs/` ist die Quelle, `frontend/public/docs/` das eingecheckte Ergebnis,
das mit dem Frontend ausgeliefert wird. Wer eine Quelle ändert, lässt den
Generator laufen und checkt das Ergebnis im selben Commit ein; die CI prüft,
dass beides zusammenpasst.

| Quelle | Befehl (aus der Wurzel) | Ergebnis |
|---|---|---|
| `docs/handbuch/*.md`, `docs/screenshots/` | `npm --prefix frontend run docs:handbuch` | `frontend/public/docs/*.html`, die eingebundenen Bilder als WebP unter `frontend/public/docs/bilder/` samt `stand.json`, `frontend/public/sitemap.xml` |
| `docs/api/*.yaml` | `npm --prefix frontend run docs:api` | `frontend/public/docs/api/index.html` |
| `docs/api/*.yaml` | `npm --prefix frontend run docs:openapi` | `frontend/public/docs/api/openapi.json`, `swagger.html` |

Die Generatoren liegen unter `scripts/` (`build-handbuch.mjs`,
`build-api-docs.mjs`, `build-openapi.mjs`). Neue Bildschirmfotos zieht
`scripts/screenshots.mjs` — erst nach dem Deploy, und jedes Bild ansehen
(CLAUDE.md, „Screenshots").

## Befundkennungen

In Code, Tests, Skripten und `docs/api/` stehen gut 1.000 Zeilen mit
Kennungen wie „BF-03", „Sicherheit BF-01", „Audit wer-bekommt-was, BF-16",
„F-10", „S-18", „Gesamtabnahme Punkt 25" oder „E-08" (gezählt am
02.10.2026: 1.161 Zeilen mit „BF-"). Sie stammen aus dem
Release-Audit vom 26.–28.09.2026 und nennen den Befund, der die Stelle
begründet. Die Berichte selbst sind aus dem Repo entfernt (02.10.2026); was
daraus noch offen war, steht in [offene-befunde.md](offene-befunde.md), das
Produkt-Backlog in [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md).

Nachlesen in der Git-Historie, letzter Stand mit allen Berichten:

```
git show e90d3e729229f0acbea59b1043be1f6fc330b172:docs/audit/2026-09-26/<datei>.md
```

| Datei | Kennung im Code | Bereich |
|---|---|---|
| `00-gesamtabnahme.md` | „Gesamtabnahme Punkt N", Sammelbefunde S-01 bis S-24 | Release-Entscheidung, Sammelbefunde, Reihenfolge, Messliste |
| `behebungsbericht.md` | „Behebungsbericht" | was bis zum 30.09. behoben wurde, was offen blieb |
| `app-grundgeruest.md` | „Grundgerüst BF-N" (im Code oft „Grundgeruest") | Anmeldung, Sitzung, Navigation, Offline, Push-Empfang, Gemeinde-Umschalter |
| `app-screens-konfi-teamer.md` | „Screens Konfi/Teamer BF-N", „app-screens-konfi-teamer BF-N" | Oberflächen von Konfis und Team, Chat, Rückblick |
| `app-screens-leitung.md` | „Leitung BF-N", „app-screens-leitung BF-N" | Oberflächen der Leitung, Gemeindeverwaltung |
| `backend-fachlogik-punkte-termine.md` | „Punkte/Termine BF-N", Nachtrag „Rolle je Gemeinde" | Punkte, Aktivitäten, Events, Jahrgänge, Badges, Level |
| `backend-fachlogik-chat-challenges-rueckblick.md` | „Chat BF-N", „backend-fachlogik-chat-challenges-rueckblick BF-N" | Chat, Challenges, Rückblick, Material, Postfach, Push, E-Mail, Hintergrund-Jobs |
| `backend-sicherheit-datenschutz.md` | „Sicherheit BF-N" | Mandantentrennung, Rechte, Anmeldung, Uploads, Datenschutz, Geheimnisse |
| `betrieb-skalierung.md` | „Betrieb BF-N" | Last bei Zielgröße, Replicas, Hintergrund-Jobs, Logs |
| `ci-deployment-store.md` | „CI BF-N" | Workflows, Images, Deploy, Store-Reife |
| `darkmode.md` | „Dunkelmodus-Audit BF-N" | Dunkelmodus: Messung, Ursachen, Weg |
| `datenbank-migrationen.md` | „Datenbank BF-N" | Schema, Migrationen, Indizes, Sicherung |
| `dokumentation-gegen-code.md` | „Doku BF-N" | Handbuch, API-Doku, CHANGELOG, README und Kommentare gegen den Code |
| `feature-empfehlungen.md` | „E-N" | liegt jetzt als [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md) im Repo |
| `tests-testinfrastruktur.md` | „Tests BF-N" | Backend-, Frontend- und E2E-Tests, CI-Testjobs |
| `toolchain-abhaengigkeiten.md` | „Toolchain BF-N" | Pakete, Node, Lint, TypeScript, native Toolchain |
| `ui-barrierefreiheit.md` | „UI BF-N" | Barrierefreiheit, Begriffe, Screenshots, Web-Variante |

Dazu in anderen Ordnern desselben Stands:

- `docs/audit/2026-09-27/wer-bekommt-was.md` — „Audit wer-bekommt-was,
  BF-N" und die Fragen „F-N": wer welche Mitteilung, Zahl und Liste bekommt,
  gemessen an der Regel in CLAUDE.md.
- `docs/audit/2026-09-28/offene-punkte.md` — Stand aller Befunde nach den
  Paketen vom 28.–30.09.2026 und Simons Antworten bis 02.10.2026.

Eine Kennung gilt je Bericht: „BF-03" allein ist mehrdeutig, der Bereich
davor („Sicherheit BF-03") macht sie eindeutig. Neue Kennungen werden nicht
mehr vergeben — neue Befunde kommen als Eintrag mit Titel in
[offene-befunde.md](offene-befunde.md).

## Erledigte Aufträge und frühere Listen

Ebenfalls im Stand `e90d3e729229f0acbea59b1043be1f6fc330b172`:

- **Aufträge des lokalen Agenten 00–11** (`docs/auftraege/lokaler-agent/`,
  27.09.–02.10.2026: Release 2.3.0, Portainer-Stack, Messungen nach dem
  Deploy, CI, Sicherung und Notfall, Mischkonten, Client-Adresse hinter dem
  Proxy, Screenshots, Backend-Container, Deploy-Lücke, Schema und
  Rückspielprobe) mit allen Messwerten. Code-Kommentare nennen sie als
  „Auftrag 05" usw. Was davon regelmäßig wiederkommt, steht in
  [betrieb/routinen.md](betrieb/routinen.md).
- **Die alte Liste `docs/offene-befunde.md`** mit den Nummern 1–16
  (02.09.–02.10.2026). Verweise wie „offene-befunde Nr. 3" meinen diese
  Fassung.
