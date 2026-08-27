# Handoff — Stand 27.08.2026, nachts

Das laufende Register steht in `BAUSTELLEN.md`, die Prüfberichte in
`docs/agenten-berichte/` (mit eigenem Register in dessen `README.md`).

---

## Wo wir stehen

Die vier PRs aus der Löschlogik-Prüfung sind zusammengeführt. Danach liefen
fünf Prüfläufe, aus denen 23 Befunde kamen — **alle sechs HOCH-Befunde sind
behoben**, dazu ein Großteil der MITTEL. Was offen ist, steht einzeln in
`BAUSTELLEN.md`; nichts mehr als Sammelzeile.

**Am 27.08. nachts sind #87, #89, #90, #93 und #94 alle zusammengeführt.**
Damit sind H2, H3, H4, H6, M1, M2, M4, M6, M7 und M8 erledigt. Offen ist
nur noch **#96** (M5, M9, N5) und dieser Doku-PR.

### Was beim Zusammenführen anders lief als erwartet

- **Der Konflikt lag nicht immer im CHANGELOG.** #87 kollidierte in
  `backend/tests/routes/notifications.test.js`: Git hatte zwei
  `describe`-Blöcke ineinandergeschoben, weil beide einen `zaehler`-Helper
  haben. Beide Testgruppen mussten erhalten bleiben — blindes Auflösen
  hätte vier oder fünf Tests verschluckt.
- **Additiv heißt nicht immer "beide Seiten aneinanderhängen".** Bei #93
  stand ein Eintrag der Gegenseite bereits *unterhalb* des Konfliktblocks;
  stumpfes Zusammenkleben hätte ihn doppelt eingetragen.
- **Jeder Merge macht den nächsten PR konfliktbehaftet.** Nach jedem Merge
  wollen die verbliebenen Branches erneut `git merge origin/main`. Das ist
  normal, kostet aber je einen CI-Durchlauf (~8 Min Backend-Test).
  Auto-Merge ist im Repo **nicht** aktiviert und lässt sich per CLI auch
  nicht einschalten (`enablePullRequestAutoMerge` schlägt fehl).
- Die drei Doku-Generatoren nach jedem Merge laufen lassen, sonst wird die
  CI rot:

      node scripts/build-handbuch.mjs
      node scripts/build-api-docs.mjs
      node scripts/build-openapi.mjs

  Sie ändern dabei regelmäßig nur die `lastmod`-Daten in
  `frontend/public/sitemap.xml`. Das ist kein Drift — verwerfen statt
  mitcommitten, sonst rauscht es durch jeden Merge-Commit.

---

## Was zuerst zu tun ist

1. **#96 mergen** (M5, M9, N5), danach diesen Doku-PR.
2. **Danach weiter im Register**: M3, N1–N4, N6–N8, die Handbuch-Punkte aus
   dem Rollen-Bericht, B2b (App-Icon-Semantik).
3. **Der Store-Review-Block** wurde bewusst verschoben ("machen wir viel,
   viel später") — deployen, Build, Testinfos, Tag/Release, CHANGELOG-Datum.

---

## Entscheidungen vom 26./27.08., die nicht verloren gehen dürfen

- **Teamer:innen und Termine: bleibt wie es ist.** Die frühere
  Designentscheidung ist zurückgenommen. Das Backend erlaubt Teamer:innen
  weiterhin das volle Event-Management — **bewusst nicht angefasst**, die
  Oberfläche bietet es schlicht nicht an.
- **Admins dürfen Teamer:innen anlegen, bearbeiten UND löschen**, ebenso
  Zertifikate verwalten. Die Rollen-Hierarchie bleibt die Grenze: `admin` kann
  keine Org-Admins und keine weiteren Admins verwalten.
- **Admin ohne Jahrgangs-Zuweisung sieht eine leere Konfi-Liste** — bleibt so.
  Offen ist nur, das sichtbar zu machen.
- **Abgesagte Termine bleiben aufrufbar**, wenn man angemeldet war.
- **Biometrie bleibt, 90 Tage bleiben.** Face ID verlängert die Anmeldedauer
  NICHT — die App war auch vorher dauerhaft angemeldet, der Token lag nur im
  Klartext. Der Gewinn ist der Speicherort, nicht die Dauer. Simons
  Begründung: Konfis sollen lange angemeldet bleiben UND ihren Zugang vor den
  Eltern schützen können.
- **Rollenwechsler verworfen.** "Dann sind es halt drei Logins."
- **RVR60 (Reina-Valera) wird nicht angeboten.** Entfernt statt überall
  ergänzt.
- **Ionic 9 fest eingeplant, aber nicht vor 2.0.0.** Details mit gemessenen
  Zahlen in `BAUSTELLEN.md` unter "Nach 2.0.0".

---

## Was beim Arbeiten aufgefallen ist

- **Ein Agentenbericht ist eine Behauptung.** Diesmal bestätigt: Der
  Chat-Bericht vom 26.08. hatte das Nachrichten-Löschen als "konsistent
  gelöst" bewertet — beim Gegenlesen war es eine echte Berechtigungslücke.
  Umgekehrt hat ein Agent den M8-Befund präzisiert statt ihn blind zu
  übernehmen: Der Admin-Endpunkt filtert sehr wohl korrekt.
- **Prüfen, ob ein Agent seinen Bericht wirklich geschrieben hat.** Der
  Abhängigkeiten-Agent meldete einen Bericht, der nie existierte. Die Zahlen
  darin stammen aus eigener Nachmessung.
- **Worktree-Agenten zweigen manchmal vom falschen Stand ab.** Der
  Biometrie-Branch hätte die komplette Punkteart-Arbeit gelöscht (36 statt 12
  Dateien). Vor dem Übernehmen `git diff --stat origin/main..HEAD` ansehen.
- **Dokumentieren ersetzt Reparieren nicht.** Ich hatte die Zähler-Falle
  ausführlich beschrieben — der eigentliche Fehler (B1) bestand seit dem
  03.07. unbemerkt und wurde erst durch den Umbau behoben.
- **Bestehende Tests können überholt sein, nicht falsch.** Mehrfach
  vorgekommen: `'Admin bekommt 403'` schrieb eine Regel fest, die Simon
  geändert hat. Angepasst mit Vermerk, nicht aufgeweicht.
- **Das Register ist selbst eine Behauptung.** Beim Abarbeiten am 27.08.
  stimmten drei Einträge nicht mehr mit dem Code überein: B1 und M4 waren
  längst erledigt, M5 betraf **vier** Stellen mit drei Verhaltensweisen statt
  der beschriebenen zwei. Und meine eigene Korrektur zu M4 war ebenfalls
  falsch — sie beschrieb den Stand vor dem #93-Merge. **Vor dem Eintragen
  von "erledigt" wie von "offen" am Code nachsehen**, auch beim eigenen
  Vermerk von vor einer Stunde.
- **Ein Wächtertest schützt nur vor der Schreibweise, die er kennt.** Der
  Test gegen stilles Offline-Scheitern prüfte `if (!isOnline) return` und war
  für `if (!networkMonitor.isOnline) return` blind — genau die Variante, die
  M5 ausmachte. Bei solchen Mustertests lohnt die Frage, welche zweite
  Schreibweise dasselbe bewirkt.
- **`git filter-branch` und `rebase --onto` sind hier die falschen
  Werkzeuge.** Ein Versuch, eine WIP-Commit-Nachricht zu glätten, schrieb 28
  Commits neu, darunter bereits gemergte aus `main`. Mit
  `git reset --hard <hash>` zurückgeholt. Eine unschöne Commit-Nachricht in
  der Historie ist billiger als das.
- **Der Testabbruch tritt weiter auf.** Bei #90 fiel ein Test in
  `teamer.test.js` um; beim Wiederholen 72/72 grün. Erst wiederholen, dann
  suchen.

---

## Fallen, die weiter gelten

- **Drei Ansichten**: `admin/`, `teamer/`, `konfi/`. Eine Änderung in nur
  einem Baum ist für zwei Drittel der Nutzer:innen nicht gemacht. Die
  belastbarste Erkenntnis aus zwei Berichten: **Wo Komponenten geteilt werden,
  gibt es keine Lücken; wo kopiert wurde, driftet es.**
- **Sporadischer Testabbruch** ("socket hang up", "Parse Error"). Vor dem
  Reparieren eines roten Tests den Lauf **wiederholen**.
- **Volle Backend-Suite lokal laufen lassen**, nicht nur die berührte Datei —
  die RBAC-Matrix hat schon zweimal einen Guard-Wechsel mitbekommen, den ich
  lokal nicht gesehen hatte.
- **Containername:** `konfi_quest-postgres-1` (CLAUDE.md ist veraltet).
- **Migrationstabelle:** `schema_migrations`, nicht `migrations`.
- **Image-Tags sind SIEBEN Zeichen** (`git rev-parse --short=7`).
- **bcrypt-Hashes nie durch die Shell reichen** — die `$`-Teile werden
  gefressen, der Hash landet verstümmelt in der DB. Über eine SQL-Datei.
- **Keine Secrets ins Repo** — es ist öffentlich.

---

## Werkzeuge

- `node scripts/drei-ansichten.mjs` — Leitung, Teamer:in und Konfi
  nebeneinander, angemeldet. `--url https://konfi-quest.de` für Produktion.
- `node scripts/screenshots.mjs` — 19 Bildschirmfotos aus der Demo-Gemeinde.
- `node scripts/verwaiste-dateien.mjs` — findet Upload-Dateien ohne Datensatz.
  Ohne `--loeschen` wird nur berichtet; braucht `DATABASE_URL`.

Alle drei brauchen `source ~/.claude/secrets.env`.

---

## Zugänge

- **Server:** `ssh root@server.godsapp.de`, Stack unter
  `/opt/stacks/portainer/compose/249/v220/docker-compose.yml`
- **Datenbank:** `docker exec konfi_quest-postgres-1 psql -U konfi_user -d konfi_db`
- **Demo-Gemeinde (Org 4):** Passwort in `~/.claude/secrets.env`
  (`KONFI_DEMO_PASSWORT`). **Nicht anfassen:** `review-*`, `google-test-*`.
- **Org 1 ist Simons ECHTE Gemeinde** — dort nichts zum Testen anlegen.
- Notfall-Anleitung: `/opt/konfi-quest/NOTFALL.md` auf dem Fahrtenbuch-Server,
  bewusst nicht im Repo.
