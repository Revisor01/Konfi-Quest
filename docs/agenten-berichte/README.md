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
| 25.08.2026 | [Termin-Zählungen](2026-08-25-termin-zaehlungen.md) | Fünf SQL-Stellen, drei Semantiken; Anmeldung konnte still schließen | TEILWEISE (`bdc04fad`) — Befund 3 und Vereinfachung offen |
| 25.08.2026 | [Offline-Fähigkeit](2026-08-25-offline-faehigkeit.md) | Listen gecacht, Details nicht; über 30 stille Abbrüche | ERLEDIGT (`c8348375`, `c2b40ad6`) |
| 26.08.2026 | [Chat-Löschlogiken](2026-08-26-chat-loeschlogiken.md) | Raum-Löschen sauber; Schwächen bei Anhängen und Kaskaden daneben | ERLEDIGT (PRs #73, #74, #75) |
| 26.08.2026 | [Löschlogiken gesamt](2026-08-26-loeschlogiken-gesamt.md) | Pfade einzeln sorgfältig, aber blockierte Wege, verwaiste Dateien und Punkte ohne Beleg | ERLEDIGT (PRs #72–#75), zwei Punkte bewusst offen |
| 26.08.2026 | Fremdschlüssel ohne Löschregel (in diesem Register, kein eigener Bericht) | 30 Kandidaten geprüft, 2 echte Lücken bei der Org-Löschung — beide brachen das Löschen ganz ab | ERLEDIGT (PR #77), Wächter in PR #78 |
| 26.08.2026 | Punkteart ausblenden (in diesem Register, kein eigener Bericht) | Server und Konfi-Ansicht sauber, gesamter Leitungs-Baum ignorierte die Einstellung | ERLEDIGT (PR #79) |
| 26.08.2026 | [Rollen-Berechtigungen](2026-08-26-rollen-berechtigungen.md) | Backend weitgehend korrekt; Teamer-Ansicht setzt zugesicherte Rechte nicht um, zwei Admin-Aktionen liefen in 403, eine Chat-Lücke | TEILWEISE — Chat (PR #81), Admin-Rechte (PR #82) erledigt; Rest in BAUSTELLEN.md |
| 26.08.2026 | [Drei-Ansichten-Lücken](2026-08-26-drei-ansichten-luecken.md) | Fehlerklasse real, fast ausschliesslich zulasten der Teamer-Ansicht; 6 HOCH, 9 MITTEL, 8 NIEDRIG | OFFEN — H1-H6 in BAUSTELLEN.md |
| 26.08.2026 | [Dashboard/Profil-Durchgang](2026-08-26-dashboard-profil-durchgang.md) | Nachgeholter Durchgang; bestaetigt die Chat-Lücke unabhängig, zwei falsche Teamer-Versprechen, sonst Entwarnung | TEILWEISE — Chat (PR #81) und Texte (PR #83) erledigt |
| 26.08.2026 | [Abhängigkeiten und Ionic](2026-08-26-abhaengigkeiten-ionic.md) | Keine Sicherheitslücken; rote CI aller sechs Dependabot-PRs nur wegen veraltetem Basis-Commit; react-router 8 darf NICHT gemergt werden | OFFEN — Empfehlungen im Bericht |
