# Handoff — Stand 27.08.2026, abends

Das laufende Register steht in `BAUSTELLEN.md`, die Prüfberichte in
`docs/agenten-berichte/` (mit eigenem Register in dessen `README.md`).

---

## Wo wir stehen

**24 PRs sind heute zusammengeführt.** N2 und N6 — die beiden Punkte aus
Simons Auftrag vom Mittag — sind vollständig erledigt.

**Vor 2.0.0 blockiert nur noch eines: Simons Test, dann Tag und Release.**
Das ist an allen offenen Registerpunkten einzeln nachgeprüft.

### Offene PRs — alle grün oder in der CI

| PR | Inhalt |
|---|---|
| **#126** | Beide Hinweis-Karten auf der Leitungs-Startseite |
| **#129** | Teamer:innen können im Chat reagieren (Migration 132) |
| **#130** | Keine Erinnerungen für abgesagte Termine |
| **#131** | App-Icon bei geschlossener App |

**#129, #130 und #131 wurden gerade aufgefrischt** und laufen neu durch die
CI. Vor dem Mergen abwarten; jeder Merge macht die übrigen konfliktbehaftet.

---

## Was heute die eigentliche Arbeit war

**Drei Register waren veraltet, in beide Richtungen.** Das hat mehr Zeit
gekostet als jeder einzelne Fix:

- `BAUSTELLEN.md`: **zehn von elf** geprüften Befunden standen als offen,
  obwohl längst behoben (PR #117).
- `docs/agenten-berichte/README.md`: **sechs von dreizehn** Zeilen falsch.
  Die gravierendste — "Drei-Ansichten-Lücken: OFFEN" — obwohl alle sechs
  HOCH-Befunde erledigt waren (PR #124).
- Der Statistik-Kopf war zu drei Vierteln gebaut, nur nie abgehakt.

**Die Lehre, die im Register steht:** Erst bis zum Ende des Eintrags lesen,
dann messen, dann fragen. Ich habe einmal eine Entscheidung eingeholt, die
gar nicht mehr nötig war, weil ich den Erledigt-Vermerk zwanzig Zeilen
unter dem Befundtext übersehen hatte.

---

## VIER PHANTOM-BERICHTE — die wichtigste Falle des Tages

**Agenten melden Berichte, die sie nie geschrieben haben.** Heute dreimal
passiert (Chat-Baum, Offline-Schreibvorgänge, Push-Zustellung), am 26.08.
schon einmal (Abhängigkeiten/Ionic). Die Zusammenfassungen klingen
plausibel, mit konkreten Befundzahlen — die Dateien existieren nicht.

**Neu in `docs/agenten-berichte/README.md`: Regel 6** — gemeldete Berichte
vor der Übernahme auf Existenz prüfen (`ls`, nicht glauben).

**Was daraus folgte:** Ich habe Simon zwei Befunde als "gemessen"
weitergegeben, die unbelegt waren. Beide erwiesen sich beim Nachprüfen als
echt — aber das war Glück, nicht Methode. Die Fix-Agenten bekamen deshalb
ausdrücklich den Auftrag, den Befund ZUERST selbst am Code zu prüfen.

**Die drei Prüfaufträge sind damit NICHT erledigt.** Chat-Baum,
Offline-Schreibvorgänge und Push-Zustellung stehen weiter offen im
Register.

---

## PARALLELE AGENTEN IM SELBEN VERZEICHNIS — teuer

Bis zu fünf Agenten liefen gleichzeitig im selben Arbeitsbaum. Folgen,
alle real eingetreten:

- **Branches wurden unter laufenden Agenten weggecheckt**, uncommittete
  Stände verschwanden. Einmal musste ein Agent seine Arbeit im isolierten
  Worktree neu aufbauen.
- **Ein Branch-Zeiger zeigte plötzlich auf `main`** — die Commits existierten,
  nur der Zeiger war überschrieben. Mit `git branch -f <sha>` zurückgeholt.
- **Die Test-Datenbank wurde mitten im Lauf gedroppt** (`globalSetup` macht
  `DROP DATABASE`). Ergebnis: bis zu 1265 rote Tests, die nichts mit dem
  Code zu tun hatten.
- Zwei Agenten schrieben in dieselbe Messdatei `zzz-messung.test.js`.

**Konsequenz für die nächste Sitzung:** Jeder parallele Auftrag bekommt
einen eigenen Worktree (`git worktree add`), oder sie laufen nacheinander.
Und: `node_modules` in den Worktree symlinken, sonst fehlen die Globals.

**Beim Testen:** Vor dem Urteil über rote Tests immer prüfen, ob die
Datenbank frei war. Der belastbare Vergleich ist derselbe Lauf auf `main`
— heute: `main` 1223 Fehler, Feature-Branch 75. Die CI urteilt
verlässlicher, sie startet mit frischer Datenbank.

---

## Was heute gebaut wurde

**Zwei Sicherheitsfunde, beide gemessen statt vermutet:**

- **Mandantenlücke** (PR #119): `PUT /admin/konfis/:id` prüfte den
  Ziel-Jahrgang nicht gegen die eigene Organisation. Gemessen: Konfi 1
  (Org 1) mit Jahrgang 2 (Org 2) → **HTTP 200**, in der Datenbank stand
  danach der fremde Jahrgang. Der POST prüfte es seit jeher, im PUT fehlten
  genau diese vier Zeilen.
- **500er-Risiko** (PR #118): Im Teamer-Abzeichen-Pfad stand das JSON-Parsen
  ohne Auffangnetz. Ein einziger beschädigter Datensatz hätte die ganze
  Seite unbenutzbar gemacht.

**N2 Teil 2** (PR #118): Der Fortschritt kommt aus einer Quelle
(`utils/badgeProgress.js`), netto 107 Zeilen weniger. Die Antwortform des
Teamer-Pfads blieb bewusst unangetastet — daran hängen zwei Ansichten und
vier Tests. **Die Vereinheitlichung steht als eigener Punkt im Register.**

**N6** (PR #116): Termin-Detail in allen drei Ansichten angeglichen. Der
wichtigste Fund: Die Registernotiz "reine Frontend-Änderung" war falsch —
Konfi und Teamer lesen ihren Termin aus der LISTE, nicht aus
`GET /events/:id`. **Wer eine Anzeige für diese beiden ergänzt, prüft
zuerst, ob das Feld in der Liste steht.**

**„Abzeichen" → „Stempel"** (PR #120) bei Challenges: App, Handbuch, Push
und beide Store-Texte. Der Widerspruch war größer als notiert — die
Konfi-Ansicht warb wörtlich mit "Mach mit und **sammle** Abzeichen!" über
einem Abschnitt, der das Sammeln verneint.

---

## Entscheidungen, die nicht verloren gehen dürfen

- **Alles Offene geht hinter 2.0.0**, außer dem Release selbst.
- **Jahrgangswechsel: "Neuer Jahrgang, die Regeln des Jahrgangs gelten."**
  Termine fallen weg, Rückblick verschwindet bis zur Freigabe des neuen
  Jahrgangs, Punkte einer dort abgeschalteten Art werden nicht mehr
  angezeigt. Simons Einordnung: Der typische Fall ist "falsch angelegt,
  muss in den richtigen Jahrgang" — nicht ein Wechsel kurz vor der
  Konfirmation. **Nichts am Wrapped bauen**, das Verhalten ist richtig.
- **Warnen statt blockieren** bei Punktearten und fremdem Jahrgang.
  **Harter Schnitt** bei Challenge-Beiträgen, keine Ausnahme.
- **Wartelisten-Einstellungen entfernt** (PR #121) — gemessen: null
  Datensätze in Produktion, es ging nichts verloren.
- **Der Statistik-Kopf** war schon zu drei Vierteln gebaut; die dritte
  Kachel heißt "Abgelehnt", nicht "Versteckt" wie im Register.

---

## N8 — durchgemessen, nach 2.0.0

Sieben Stellen, nicht vier. Frontend: null Änderungen nötig.

**Die Falle, die einen ersten Versuch kosten würde:** Die Defaults sind
verschieden. `users.bible_translation` ist `NOT NULL DEFAULT 'LUT'`,
`konfi_profiles.bible_translation` ist **nullable**. "Noch leer" heißt an
`users` also `= 'LUT'`, NICHT `IS NULL`.

- Mit `IS NULL` geprüft überträgt die Migration **gar nichts**.
- Ohne die Bedingung **überschreibt** sie die neuere Wahl beförderter
  Teamer:innen.
- Richtig ist dreiteilig: Quelle gesetzt UND `<> 'LUT'` UND Ziel noch `'LUT'`.

Ein bestehender Test prüft genau das Verhalten, das der Umbau abschafft —
er muss **ersetzt** werden, nicht aufgeweicht. Details im Register.

---

## Fallen, die weiter gelten

- **Drei Ansichten**: `admin/`, `teamer/`, `konfi/`. Eine Änderung in nur
  einem Baum ist für zwei Drittel der Nutzer:innen nicht gemacht.
- **Ein Bericht ist eine Behauptung — das Register auch**, und heute war es
  dreimal falsch. Vor "erledigt" wie vor "offen" am Code nachsehen.
- **Ein Wächtertest schützt nur vor der Schreibweise, die er kennt.** Heute
  wieder passiert: Ein Test prüfte auf den Tabellennamen `custom_badges` und
  wurde rot, als der günstige Zähler dieselbe Tabelle joint. Der Test hatte
  im Kern recht, traf aber das falsche Merkmal — geschärft auf
  `criteria_type`/`criteria_value`, nicht aufgeweicht.
- **Sporadischer Testabbruch**: Vor dem Reparieren den Lauf wiederholen.
- **Containername:** `konfi_quest-postgres-1`. **Migrationstabelle:**
  `schema_migrations`. **Image-Tags:** sieben Zeichen.
- **bcrypt-Hashes nie durch die Shell reichen** — über eine SQL-Datei.
- **Keine Secrets ins Repo** — es ist öffentlich.
- Test-DB nach Neustart: `colima start`, dann
  `docker compose -f docker-compose.test.yml up -d --wait` im `backend/`.

---

## Werkzeuge

- `node scripts/drei-ansichten.mjs` — alle drei Rollen nebeneinander
- `node scripts/screenshots.mjs` — 19 Bildschirmfotos aus der Demo-Gemeinde
- `node scripts/verwaiste-dateien.mjs` — Upload-Dateien ohne Datensatz

Alle drei brauchen `source ~/.claude/secrets.env`.

Nach **jedem** Merge die drei Doku-Generatoren laufen lassen:

    node scripts/build-handbuch.mjs
    node scripts/build-api-docs.mjs
    node scripts/build-openapi.mjs

Sie ändern regelmäßig nur `lastmod` in `frontend/public/sitemap.xml` — kein
Drift, verwerfen statt mitcommitten.

---

## Zugänge

- **Server:** `ssh root@server.godsapp.de`
- **Datenbank:** `docker exec konfi_quest-postgres-1 psql -U konfi_user -d konfi_db`
- **Demo-Gemeinde (Org 4):** Passwort in `~/.claude/secrets.env`.
  **Nicht anfassen:** `review-*`, `google-test-*`.
- **Org 1 ist Simons ECHTE Gemeinde** — dort nichts zum Testen anlegen.
- Notfall-Anleitung: `/opt/konfi-quest/NOTFALL.md` auf dem Fahrtenbuch-Server.
