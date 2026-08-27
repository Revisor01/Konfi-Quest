# Agenten-Berichte

Hier liegen die Ergebnisse aller Prüfaufträge, die an Agenten vergeben wurden.

**Warum das Verzeichnis existiert:** Prüfberichte lagen bisher in temporären
Verzeichnissen und waren nach der Sitzung weg. Dieselbe Frage wurde dadurch
mehrfach untersucht, und niemand konnte nachsehen, was beim letzten Mal
herauskam (Nutzerhinweis 25.08.2026).

## Regeln

1. **Jeder Agentenauftrag schreibt hierher**, nicht in ein Temp-Verzeichnis.
2. **Dateiname:** `JJJJ-MM-TT-thema.md` — Datum zuerst, damit die Liste
   chronologisch sortiert.
3. **Kopf jeder Datei:** Auftrag, Datum, geprüfter Commit, Urteil in einem Satz.
4. **Berichte werden nicht gelöscht**, auch nicht wenn der Befund behoben ist.
   Stattdessen oben ein Vermerk: `ERLEDIGT am TT.MM. durch <commit>`.
   Sonst liest sich das Verzeichnis später wie eine Liste offener Lücken.
5. **Ein Befund ist eine Behauptung.** Was hier steht, ist geprüft worden —
   aber wer es umsetzt, prüft gegen den Code nach. Widerlegte Befunde bleiben
   stehen, mit Vermerk `WIDERLEGT` und Begründung.

## Register

| Datum | Thema | Urteil | Status |
|---|---|---|---|
| 25.08.2026 | [Live-Aktualisierung (Socket.io)](2026-08-25-live-aktualisierung.md) | Regression im In-flight-Dedupe, fehlende Empfänger in allen drei Bäumen | ERLEDIGT (`8fc097ce`, `23ee763a`) |
| 25.08.2026 | [Abzeichen-Bedingungen](2026-08-25-abzeichen-bedingungen.md) | Logik in Ordnung; Befunde lagen in den Daten und im Regler | ERLEDIGT (`4d7f520b`, Datenpflege in Prod) |
| 25.08.2026 | [Drei Registerpunkte](2026-08-25-drei-registerpunkte.md) | Alle drei längst erledigt, nur nicht vermerkt | ERLEDIGT (`ccf09d5f`) |
| 25.08.2026 | [Termin-Zählungen](2026-08-25-termin-zaehlungen.md) | Fünf SQL-Stellen, drei Semantiken; Anmeldung konnte still schließen | TEILWEISE (`bdc04fad`) — **Befund 3 erledigt** (`events.js:184-185`, `:307-308`), offen nur die gemeinsame SQL-View (nach 2.0.0) |
| 25.08.2026 | [Offline-Fähigkeit](2026-08-25-offline-faehigkeit.md) | Listen gecacht, Details nicht; über 30 stille Abbrüche | ERLEDIGT (`c8348375`, `c2b40ad6`) |
| 26.08.2026 | [Chat-Löschlogiken](2026-08-26-chat-loeschlogiken.md) | Raum-Löschen sauber; Schwächen bei Anhängen und Kaskaden daneben | ERLEDIGT (PRs #73, #74, #75) |
| 26.08.2026 | [Löschlogiken gesamt](2026-08-26-loeschlogiken-gesamt.md) | Pfade einzeln sorgfältig, aber blockierte Wege, verwaiste Dateien und Punkte ohne Beleg | **ERLEDIGT** (PRs #72–#78). *Die frühere Angabe „zwei Punkte bewusst offen" liess sich am 27.08. weder im Bericht noch in BAUSTELLEN.md belegen — dort stehen alle drei Aufträge als erledigt. Angabe deshalb gestrichen.* |
| 26.08.2026 | Fremdschlüssel ohne Löschregel (in diesem Register, kein eigener Bericht) | 30 Kandidaten geprüft, 2 echte Lücken bei der Org-Löschung — beide brachen das Löschen ganz ab | ERLEDIGT (PR #77), Wächter in PR #78 |
| 26.08.2026 | Punkteart ausblenden (in diesem Register, kein eigener Bericht) | Server und Konfi-Ansicht sauber, gesamter Leitungs-Baum ignorierte die Einstellung | ERLEDIGT (PR #79) |
| 26.08.2026 | [Rollen-Berechtigungen](2026-08-26-rollen-berechtigungen.md) | Backend weitgehend korrekt; Teamer-Ansicht setzt zugesicherte Rechte nicht um, zwei Admin-Aktionen liefen in 403, eine Chat-Lücke | **ERLEDIGT** (27.08.) bis auf die Konfi-Stammdaten-Bearbeitung (PR #123) — sechs von sieben Punkten am Code belegt |
| 26.08.2026 | [Drei-Ansichten-Lücken](2026-08-26-drei-ansichten-luecken.md) | Fehlerklasse real, fast ausschliesslich zulasten der Teamer-Ansicht; 6 HOCH, 9 MITTEL, 8 NIEDRIG | **ERLEDIGT** (27.08.) — H1–H6, alle MITTEL und N2/N3/N6 behoben (PRs #87–#120). Offen nur N8 und die Antwortform der Teamer-Abzeichen |
| 26.08.2026 | [Dashboard/Profil-Durchgang](2026-08-26-dashboard-profil-durchgang.md) | Nachgeholter Durchgang; bestaetigt die Chat-Lücke unabhängig, zwei falsche Teamer-Versprechen, sonst Entwarnung | **ERLEDIGT** (27.08.) — Chat (PR #81), Texte (PR #83), DN1 (`AdminKonfisPage.tsx:403` nutzt `NeuerungenBanner`) |
| 26.08.2026 | [Abhängigkeiten und Ionic](2026-08-26-abhaengigkeiten-ionic.md) (**Korrektur 27.08. abends: der Bericht existiert doch** — 280 Zeilen, angelegt am 26.08. in `8d2217d6`, einem Commit zu einem ganz anderen Thema. Deshalb fand ihn später niemand, und er galt als Phantom-Bericht. Die Zahlen der eigenen Nachmessung decken sich mit ihm.) | Keine Sicherheitslücken; rote CI aller sechs Dependabot-PRs nur wegen veraltetem Basis-Commit; react-router 8 darf NICHT gemergt werden (Ionic 9 verlangt v6) | TEILWEISE — Themes aktualisiert (PR #85), Ionic 9 eingeplant |
| 27.08.2026 | [Abzeichen-Zähler](2026-08-27-abzeichen-zaehler.md) | Zwei Aktualisierungswege statt einem; Konfi-Zähler seit 03.07. kaputt; Konsolidierung lohnt sich | **ERLEDIGT** (PRs #92, #108) — auch B2b (`utils/appIconBadge.js`) und die Konsolidierung (`notifications.js:180`). Offen bleibt allein der Hintergrund-Sync in `backgroundService.js` |
| 27.08.2026 | [Chat-Baum](2026-08-27-chat-baum.md) | Die gemeinsame Ansicht trennt die Rollen im Kern sauber und org-dicht — eine echte Lücke: Teamer-Reaktion lief in einen 500er, weil der DB-Constraint nur `admin`/`konfi` kannte | **ERLEDIGT** (PR #129, Migration 133). Der HOCH-Befund war unabhängig neu gemessen worden, bevor jemand den Bericht gelesen hatte. Offen: Reaktions-/Vote-Zugriff für Leitung ohne Teilnehmerschaft (MITTEL, 403 nur gemessen, nicht festgeschrieben) |
| 27.08.2026 | [Offline-Schreibvorgänge](2026-08-27-offline-schreibvorgaenge.md) | Warteschlange solide (FIFO, Retry-Budget, kein Datenverlust im Transport), aber abgelehnte Nachreichungen verschwinden still; 2 HOCH, 3 MITTEL, 2 NIEDRIG | OFFEN — H1 (stiller Verlust der Ablehnung) und H2 (Teamer-Buchung verwirft die Server-Antwort) stehen in BAUSTELLEN.md, **nach 2.0.0** |
| 27.08.2026 | [Push-Zustellung](2026-08-27-push-zustellung.md) | Alle 30 Push-Arten inventarisiert; 1 HOCH, 4 MITTEL, 4 NIEDRIG, drei davon gemessen | TEILWEISE — **H1 erledigt** (Erinnerungen an abgesagte Termine, PR #130; ebenfalls unabhängig neu gemessen). Offen: M2, 10 von 30 Push-Arten ohne Antipp-Ziel, **nach 2.0.0** |

> **Zu diesen drei Berichten (Korrektur 27.08.2026, abends):** Sie galten als
> "nie geschrieben" und ihre Prüfaufträge in `BAUSTELLEN.md` als unbeauftragte
> Vorschläge. Beides war falsch. Die Dateien lagen im WIP-Commit `15c46930`
> auf dem Branch `fix/app-icon-hintergrund-sync`, nicht auf `main` — ein `ls`
> im Arbeitsbaum sah sie nicht, `git log --all --diff-filter=A` hätte sie
> gefunden. Zusammen mit dem Abhängigkeiten-Bericht (siehe oben) waren damit
> **alle vier angeblichen Phantom-Berichte real.**
