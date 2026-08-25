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
