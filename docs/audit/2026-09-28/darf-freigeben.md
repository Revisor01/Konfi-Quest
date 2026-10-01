# „Darf freigeben" — Planung für die Version nach 2.3.0

Stand 01.10.2026. Simon: „wir wollen lieber die Einstellung darf freigeben.
Diese Einstellung geben wir für die nächste Version auf. Das ist eine größere
Sache, die wir planen müssen." Der persönliche Schalter „Offene Aufgaben am
App-Symbol mitzählen" entfällt damit.

## Anlass

Rückmeldung eines Testers (Gerätetest Build 130/236): Am App-Symbol stand 52,
obwohl in seiner Gemeinde nur eine Person (Marisa) Anträge entscheidet und
Events verbucht. Die Zahl zählt bei der Leitung die offene Arbeit mit, und wer
alles sieht, bekommt alles in die Zahl.

## Was heute gilt

- **Regel** (CLAUDE.md, „Wer sieht und bekommt was"): Org-Admin sieht, darf und
  bekommt alles seiner Gemeinde; Admin und Teamer:in nur für ihre Jahrgänge.
  **Mitteilung = Sichtbarkeit:** Push, Postfach und rote Zahl bekommt genau,
  wer den Vorgang in seiner Liste sieht und bearbeiten darf. Liste, Zähler und
  Empfänger lesen dieselbe Regel-Stelle.
- **Feld `can_edit`** an jeder Jahrgangs-Zuweisung
  (`user_jahrgang_assignments`, Vorgabe `false`). Es steuert heute
  Schreibwege an Jahrgang und Konfis: Jahrgang bearbeiten, Konfis anlegen,
  verschieben, löschen, Einmalpasswort, Beförderung
  (`utils/jahrgangsZugriff.js`, `darfJahrgang`/`darfKonfi` mit
  `{ edit: true }`). Anträge, Verbuchen und Challenge-Freigaben hängen
  **nicht** daran.
- Teamer:innen moderieren Challenges schon heute (freigeben, ausblenden,
  anonymisieren) — für „Nur Team"-Challenges und die ihrer Jahrgänge.

## Was zu entscheiden ist

1. **Welche Vorgänge** hängen am Recht? Anträge entscheiden, Events verbuchen,
   Challenge-Beiträge freigeben — alle drei, oder einzeln?
2. **Je Konto oder je Jahrgang?** Ein Schalter am Konto ist einfach; je
   Jahrgang (wie `can_edit`) passt zu Gemeinden, in denen verschiedene Leute
   verschiedene Jahrgänge betreuen.
3. **Org-Admin:** hat das Recht immer (heutige Regel „darf alles") — oder kann
   auch ein Org-Admin es abgeben? Davon hängt ab, ob dem Tester geholfen ist,
   falls er Org-Admin ist.
4. **Sehen ohne Recht:** Sieht, wer nicht freigeben darf, die offenen Vorgänge
   weiter (nur lesend) — oder gar nicht? Nach „Mitteilung = Sichtbarkeit"
   bekäme er dann weder Push noch Zahl, nur die Liste.
5. **Vorgabe für bestehende Konten:** Alle behalten das Recht (nichts ändert
   sich, die Leitung nimmt es gezielt weg), oder nur Org-Admins?
6. **Wo einstellen:** bei „Benutzer:innen" am Konto bzw. an der
   Jahrgangs-Zuweisung; wer darf es vergeben (nur Org-Admin)?

## Was dabei mitläuft

- Eine Regel-Stelle je Vorgang (Vorbild `utils/challengeLeitungSicht.js`):
  Liste, Zähler, App-Symbol-Summe (`utils/appIconBadge.js`), Push-Empfänger
  und Server-Prüfung lesen sie gemeinsam.
- Migration additiv (neue Spalte mit Vorgabe), API-Felder nur hinzufügen;
  die Store-Apps 2.2.x/2.3.x lesen die neuen Felder nicht und dürfen nicht
  brechen.
- Handbuch (Leitung, Benutzer:innen), API-Doku, Tests je Vorgang für den
  erlaubten und den verbotenen Fall.
