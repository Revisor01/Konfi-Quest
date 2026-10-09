# „Darf freigeben" — Planung für die Version nach 2.3.0

Stand 01.10.2026. Simon: „wir wollen lieber die Einstellung darf freigeben.
Diese Einstellung geben wir für die nächste Version auf. Das ist eine größere
Sache, die wir planen müssen." Der persönliche Schalter „Offene Aufgaben am
App-Symbol mitzählen" entfällt damit.

**Entschieden 02.10.2026:** Simon: „darf freigeben werden wir bauen". Die
sechs Fragen unter „Was zu entscheiden ist" sind die nächsten Schritte.

**Verschoben 08.10.2026:** Simon: „machen wir viel später". Nicht in 2.4.0;
die sechs Fragen bleiben offen, bis das Thema wieder aufgenommen wird.

**Wieder aufgenommen 09.10.2026:** Simon hat die sechs Fragen beantwortet
(Abschnitt „Entschieden 09.10.2026"), dazu eine Kennzahlen-Wahl für jede
Leitung. Gebaut für 2.4.0.

**Kennzahlen-Wahl abgebaut 09.10.2026:** Simon nahm sie am selben Tag
zurück; es entscheidet allein das Recht (Abschnitt „Abgebaut 09.10.2026: nur
das Recht entscheidet").

## Entschieden 09.10.2026

1. **Welche Vorgänge:** drei Rechte, je einzeln festlegbar — *Anträge
   entscheiden*, *Events verbuchen*, *Challenge-Beiträge freigeben*.
2. **Je Jahrgang**, an der Jahrgangs-Zuweisung wie `can_edit`: drei neue
   Felder an `user_jahrgang_assignments`, additiv per Migration.
3. **Org-Admin** hat alle drei Rechte immer; er kann sie nicht abgeben.
4. **Sehen ohne Recht:** Die Liste bleibt sichtbar, nur lesend. Die Knöpfe
   zum Entscheiden, Verbuchen und Freigeben fehlen; der Server antwortet
   mit 403. Wer einen Vorgang nicht freigeben darf, bekommt dafür weder Push
   noch Postfach-Eintrag noch Zahl.
5. **Vorgabe für bestehende Konten:** Alle behalten alle drei Rechte (Spalten
   mit Vorgabe `true`); niemand bekommt nach dem Deploy weniger.
6. **Wo einstellen:** an der Jahrgangs-Zuweisung bei „Benutzer:innen", in App
   und Web-Fassung. Vergeben darf nur der Org-Admin.

Dazu, ohne Frage-Nummer:

- ~~**Kennzahlen-Wahl für jede Leitung** (Admin und Org-Admin): eine persönliche
  Einstellung am eigenen Konto, je Gemeinde. Je Bereich — Anträge, Events
  verbuchen, Challenge-Beiträge — an oder aus. Aus heißt: keine rote Zahl am
  Reiter, nichts davon in der Zahl am App-Symbol und kein Push dafür. Vorgabe:
  alles an, wie bisher.~~ Abgebaut am selben Tag, siehe unten.
- ~~**Teamer:innen** behalten ihr Verhalten: Sie moderieren Challenges für
  „Nur das Team" und ihre Jahrgänge; die Rechte an der Zuweisung gelten für
  die Rolle Admin.~~ Abgelöst am selben Tag, siehe „Teamer:innen
  (09.10.2026)".

### Umsetzung (09.10.2026)

- Migration 204: `user_jahrgang_assignments.darf_antraege_entscheiden`,
  `darf_events_verbuchen`, `darf_challenges_freigeben` (Vorgabe `true`) und
  die Tabelle `leitung_kennzahlen` (Person × Gemeinde, drei Schalter,
  Vorgabe: keine Zeile = alles an).
- Vorgänge ohne Jahrgang (Anträge von Teamer:innen, Termine „Nur Team" und
  ohne Jahrgang, Challenges „Nur das Team"): Ein Admin darf sie, wenn er das
  Recht in mindestens einem seiner Jahrgänge hat — oder gar keinem Jahrgang
  zugewiesen ist (dann gibt es nichts, woran es fehlen könnte; so bekommt
  niemand nach dem Deploy weniger).
- Regel-Stellen: die Mechanik in `backend/utils/freigabeRechte.js`, je
  Vorgang die Bedingung in `antragLeitungSicht.js`, `terminLeitungSicht.js`
  und `challengeLeitungSicht.js`; die Kennzahlen in
  `backend/utils/leitungKennzahlen.js`. Liste (Feld `darf_…`), Zähler,
  App-Symbol, Push-Empfänger, Postfach und Server-Prüfung lesen sie.
- ~~Kennzahlen-Abwahl nimmt Zahl und Push, nicht den Postfach-Eintrag (Simon
  nannte für die Abwahl „Push und Zahl", für das fehlende Recht zusätzlich das
  Postfach). Ausnahme: Die tägliche Verbuchen-Erinnerung ist selbst eine Zahl
  und entfällt mit der Abwahl ganz, auch im Postfach.~~ Abgebaut, siehe unten.
- Nicht am Recht hängen: die Termin-Meldungen an die Leitung (Abmeldungen,
  Zu- und Absagen) und das Erzeugen des QR-Codes zum Selbst-Check-in — sie
  folgen weiter der Sicht.

### Bestätigt 09.10.2026

Simon hat die drei Festlegungen aus der Umsetzung bestätigt:

1. **Vorgänge ohne Jahrgang:** Wer in keinem Jahrgang zugewiesen ist oder das
   Recht in mindestens einem seiner Jahrgänge hat, darf sie — bestätigt.
2. ~~**Postfach-Eintrag „Neuer Antrag"** bleibt bei abgewählter Kennzahl —
   bestätigt.~~ Gegenstandslos mit dem Abbau der Kennzahlen-Wahl.
3. **Notizen, Abmelden, QR-Code und Löschen** hängen an keinem der drei
   Rechte — bestätigt.

### Teamer:innen (09.10.2026)

Simon: Teamer:innen bekommen dasselbe Rechtemanagement je Jahrgang, „bezogen
auf Challenges".

- **Gemessen vorher** (Routen): Von den drei Handlungen durften
  Teamer:innen nur Challenge-Beiträge moderieren
  (`PUT /challenges/admin/submissions/:id/moderate`, `requireTeamer`).
  Anträge entscheiden (`PUT /admin/activities/requests/:id` und `/reset`)
  und Verbuchen (`PUT /events/:id/participants/…/attendance` und
  `/attendance-all`) sind `requireAdmin` — das bleibt so, keine neue
  Befugnis.
- **Das Recht „Challenge-Beiträge freigeben"** gilt für Teamer:innen wie für
  Admins: je Jahrgang an der Zuweisung, „Nur das Team" nach Regel 1 oben.
  Dieselbe Regel-Stelle (`backend/utils/freigabeRechte.js`) liest Server-
  Prüfung, Feld `darf_freigeben`, Zähler, App-Symbol und die Empfänger von
  „Neuer Challenge-Beitrag".
- **can_view und can_edit** bleiben, wie sie sind: Das Recht zählt nur an
  Zuweisungen mit `can_view`; `can_edit` (bei Teamer:innen meist `false`)
  spielt dafür keine Rolle.
- ~~**Kennzahlen-Wahl:** Teamer:innen bekommen Zahl und Push für
  Challenge-Beiträge und deshalb dieselbe Wahl, nur für diesen einen
  Bereich (`GET/PUT /notifications/kennzahlen`, Profil in App und Browser).~~
  Abgebaut, siehe unten.
- **Oberfläche:** Im Benutzerfenster setzt die Gemeindeleitung an der
  Zuweisung einer Teamer:in nur den Schalter „Challenge-Beiträge freigeben";
  nur dieses Feld geht mit. Alte Apps schicken kein Feld — der bisherige Wert
  bleibt.
- **Vorgabe:** Spalte steht bei allen Zuweisungen auf `true`; nach dem Deploy
  darf jede Teamer:in, was sie vorher durfte.

### Abgebaut 09.10.2026: nur das Recht entscheidet

Simon: „Kennzahlen ausblenden auch für Admins raus. Der Gedanke ist: Du darfst
nicht verwalten, dann brauchst du es nicht sehen. Aber passiert bei
Challenges was, dann guckst du es dir gefälligst an. Also die Funktion wieder
abbauen." — „Ein sauberes Rechtemanagement und gut ist."

- **Mit Recht** (an der Jahrgangs-Zuweisung, Org-Admin immer): rote Zahl am
  Reiter, Zahl am App-Symbol und am Gemeinde-Umschalter, Push und
  Postfach-Eintrag — immer, ohne persönliche Abwahl. Den Push aufs Handy
  regelt nur noch die allgemeine Auswahl der Push-Gruppen.
- **Ohne Recht:** nichts davon; die Liste bleibt lesbar.
- **Challenge-Neuigkeiten** (neue sichtbare Beiträge seit dem letzten
  Öffnen) folgen wieder allein der Sicht, wie vor der Kennzahlen-Wahl.
- **Entfernt:** `GET/PUT /notifications/kennzahlen`, das Fenster
  „Kennzahlen" (App: Mehr › Konto und Teamer-Profil; Web: Profil der Leitung
  und des Teams), die Regel-Stelle `backend/utils/leitungKennzahlen.js` und
  die Tabelle `leitung_kennzahlen` (Migration 205, `DROP TABLE IF EXISTS`).
  Kein Store-Build hat die Routen gerufen (nur TestFlight 242).
- **Bleibt:** das Rechtemanagement — die Spalten `darf_*` an
  `user_jahrgang_assignments`, die Schalter an der Zuweisung für Admins und
  Teamer:innen, `backend/utils/freigabeRechte.js`.

## Anlass

Rückmeldung aus dem Gerätetest (Build 130/236): Am App-Symbol stand 52,
obwohl in der Gemeinde nur eine Person Anträge entscheidet und Events
verbucht. Die Zahl zählt bei der Leitung die offene Arbeit mit, und wer
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
