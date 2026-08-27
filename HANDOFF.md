# Handoff — Stand 27.08.2026, mittags

Das laufende Register steht in `BAUSTELLEN.md`, die Prüfberichte in
`docs/agenten-berichte/` (mit eigenem Register in dessen `README.md`).

---

## Wo wir stehen

Seit dem nächtlichen Handoff sind **21 PRs zusammengeführt**. Damit sind alle
HOCH- und alle MITTEL-Befunde aus dem Drei-Ansichten-Bericht erledigt, dazu
sieben der acht NIEDRIG-Befunde, die Handbuch-Punkte und der komplette
Dashboard/Profil-Durchgang.

### Offene PRs — alle grün, nur noch mergen

| PR | Inhalt |
|---|---|
| **#109** | Benutzerverwaltung: Lösch-Wische nur für org_admin |
| **#110** | Team-Chat leeren nur für admin und org_admin |
| **#111** | Wrapped-Einstieg nur bei vorhandenem Snapshot |
| **#113** | Material-Tags entfernt |
| **#114** | Hinweis bei fehlender Jahrgangs-Zuweisung |

Alle fünf waren zuletzt aufgefrischt und gepusht. **Vor dem Mergen die CI
abwarten** — jeder Merge macht die übrigen konfliktbehaftet.

---

## Was als Nächstes ansteht

**Simons Auftrag vom 27.08. mittags, in dieser Reihenfolge:**

1. **N2 Teil 2** — die 250-Zeilen-Inline-Kopie in `routes/teamer.js`.
   Vorbereitet, siehe eigener Abschnitt unten.
2. **N6** — Simon will bei **jedem** der sieben offenen Punkte gefragt
   werden. Nichts davon ohne Rückfrage bauen.

Erledigt aus demselben Auftrag: Material-Tags entfernt (#113), Admin-Hinweis
gebaut (#114, mit der vorhandenen `EmptyState`-Komponente).

---

## N2 Teil 2 — vorbereitet, noch nicht angefasst

Der Umbau, den Simon als Nächstes will. **Kein Einzeiler:** Er ändert eine
API-Antwortform, an der das Frontend hängt.

### Was ist

- **Konfi:** `utils/konfiBadgeProgress.js` liefert `{ available, earned,
  stats }` (Zeile 303-305).
- **Teamer:** `routes/teamer.js:270` rechnet **271 Zeilen inline** nach, mit
  eigener Antwortform — flaches Array plus Zählwerte in HTTP-Headern.

### Die Falle, die den Umbau teuer macht

**Zwei Frontend-Stellen lesen den Header aus:**

- `teamer/pages/TeamerBadgesPage.tsx:57`
- `teamer/pages/TeamerDashboardPage.tsx:283`

Beide holen `res.headers['x-badges-secret-total']`. Wer die Antwortform
umstellt, muss diese beiden mitziehen — sonst verschwindet die Zahl der
geheimen Abzeichen stillschweigend.

### Der dritte Unterschied

Der Teamer-Pfad hat die **"unerreichbar"-Ausblendung** des Konfi-Pfads nicht
(`konfiBadgeProgress.js:154-183`). Vor dem Zusammenlegen klären, ob sie für
Teamer:innen überhaupt gelten soll — die Kriterien sind andere
(`teamer_year`, gezählte Teamer-Aktivitäten).

### Empfehlung

Erst messen, was die beiden Pfade tatsächlich unterschiedlich ausgeben
(gleiche Daten, beide Endpunkte, Ausgaben vergleichen), dann umbauen. Sonst
gleicht man Verhalten an, das absichtlich verschieden war.

---

## Was diesen Durchgang ausgemacht hat

**Fünf Befunde, die als "praktisch folgenlos", "kosmetisch" oder als bloße
Anzeige-Divergenz notiert waren, waren beim Nachmessen offene API-Wege.**
Jedes Mal derselbe Grund: Die Oberfläche filtert, die Route nicht.

| Befund | Notiert als | Gemessen |
|---|---|---|
| N1 | "praktisch vermutlich folgenlos" | Anmeldung zu Teamer-Termin **200**, zu abgesagtem **200** |
| N3 | Anzeige-Divergenz beim Lesen | Konfi-Antrag auf Teamer-Aktivität **201**, in der Liste sichtbar |
| Bonuspunkte | MITTEL | Bonus an fremden Jahrgang **201**, Eintrag angelegt |
| B2b | "eigene Baustelle" | Chat-Push überschrieb alle anderen Zähler im App-Icon |
| has_wrapped | NIEDRIG | Einstieg sichtbar (`true`), Abruf **404** |

Beim sechsten (Benutzerseite Deep-Link) stimmte "kosmetisch" dagegen — dort
hielt `requireOrgAdmin` serverseitig. **Der Unterschied lässt sich nicht raten,
nur messen.**

### Zwei wiederkehrende Muster

- **Zwei Rechte an einer Variable.** Bei der Chat-Mitgliederliste war das Gate
  zu eng (`isAdmin` deckte Liste *und* Umfragen ab), beim Team-Chat-Mülleimer
  zu weit (`istLeitung` war für den Export gebaut). Wer so etwas findet:
  trennen, nicht verengen — und die jeweils andere Hälfte mit einer Gegenprobe
  festhalten.
- **Dieselbe Frage, zwei richtige Antworten.** Bei N5 brauchte es kein
  Freigabe-Gate (Snapshot und Freigabe entstehen in einer Transaktion), bei
  `has_wrapped` sehr wohl (`Promise.allSettled` setzt die Freigabe auch bei
  Fehlern). Beide am Code belegt. Nicht von einem auf den anderen schließen.

---

## Fallen, die neu dazugekommen sind

- **`rbac.js:13` hält einen 30-Sekunden-User-Cache.** Ein `DELETE` auf
  `user_jahrgang_assignments` ändert die Datenbank, nicht den Cache. Ein Test
  dazu war **isoliert grün und im vollen Lauf rot** — gemessen: keine
  Zuweisung in der DB, aber der Server sah weiter zwei Konfis. Lösung: einen
  frisch angelegten User verwenden, den vorher niemand geladen hat.
- **Gestapelte PRs nicht bauen.** PR #99 lief gegen einen `fix/`-Branch und
  wurde beim Merge von dessen Basis **automatisch mitgeschlossen**, ohne
  selbst gemergt zu werden. Wiedereröffnen ging nicht mehr; der Inhalt musste
  als neuer PR gegen `main` gehen. Immer gegen `main` abzweigen.
- **Additives Auflösen erzeugt Doppeleinträge.** Beim Auffrischen kollidieren
  `BAUSTELLEN.md`-Zeilen so, dass derselbe Punkt einmal als `[ ]` und einmal
  als `[x]` dasteht. **Nach jedem Auffrischen prüfen** — ein Skript dafür liegt
  im Scratchpad (`auffrischen.sh`), es löst die Konflikte und meldet
  Dopplungen.
- **`git filter-branch` und `rebase --onto` sind hier die falschen Werkzeuge.**
  Ein Versuch, eine WIP-Commit-Nachricht zu glätten, schrieb 28 Commits neu,
  darunter bereits gemergte. Mit `git reset --hard <hash>` zurückgeholt.
- **Die Generatoren ändern regelmäßig nur `lastmod` in `sitemap.xml`.** Kein
  Drift — verwerfen statt mitcommitten.
- **Test-DB und Docker laufen nicht über Sitzungen hinweg.** Nach einem
  Neustart: `colima start`, dann
  `docker compose -f docker-compose.test.yml up -d --wait` im `backend/`.

---

## Fallen, die weiter gelten

- **Drei Ansichten**: `admin/`, `teamer/`, `konfi/`. Eine Änderung in nur
  einem Baum ist für zwei Drittel der Nutzer:innen nicht gemacht.
- **Ein Bericht ist eine Behauptung — das Register auch.** Beim Abarbeiten
  stimmten drei Registereinträge nicht mehr mit dem Code überein, und eine
  eigene Korrektur von vor einer Stunde war ebenfalls falsch (sie beschrieb
  den Stand vor einem Merge). Vor dem Eintragen von "erledigt" wie von "offen"
  am Code nachsehen.
- **Ein Wächtertest schützt nur vor der Schreibweise, die er kennt.** Der Test
  gegen stilles Offline-Scheitern prüfte `if (!isOnline) return` und war für
  `if (!networkMonitor.isOnline) return` blind — genau die Variante, die M5
  ausmachte.
- **Sporadischer Testabbruch**: Vor dem Reparieren eines roten Tests den Lauf
  wiederholen.
- **Volle Backend-Suite lokal laufen lassen**, nicht nur die berührte Datei.
- **Containername:** `konfi_quest-postgres-1`. **Migrationstabelle:**
  `schema_migrations`. **Image-Tags:** sieben Zeichen.
- **bcrypt-Hashes nie durch die Shell reichen** — über eine SQL-Datei.
- **Keine Secrets ins Repo** — es ist öffentlich.

---

## Entscheidungen, die nicht verloren gehen dürfen

Zusätzlich zu denen im nächtlichen Handoff:

- **Der Server rechnet die App-Icon-Zahl** (B2b). Begründung gegen die
  Alternative "Badge aus Pushes raus": Bei geschlossener App gibt es keinen
  Client, und genau dann ist das Icon das Einzige, was jemand vor dem Öffnen
  sieht.
- **`super_admin` darf den Team-Chat nicht leeren.** Das Backend hatte recht,
  nicht das Frontend — die Rolle ist für Org-*Verwaltung* zuständig, nicht für
  das Löschen fremder Inhalte.
- **Die Mitgliederliste im Chat sehen alle**, Umfragen anlegen bleibt bei der
  Leitung. Die Verwaltungsaktionen im Modal hängen an einem eigenen Gate.
- **Material-Tags sind entfernt.** Vor dem Löschen gemessen: 1 Tag, 0
  Zuordnungen.
- **Der `LEFT JOIN` bei Konfi-Anträgen bleibt** (N3). Beim Teamer fällt ein
  Antrag zu einer gelöschten Aktivität aus der Liste, beim Konfi bleibt er
  stehen. Anzeigen ist besser als Verlieren. Wer angleicht, stellt den
  **Teamer**-Weg um.
- **N6: Simon will bei jedem Punkt gefragt werden.**

---

## Werkzeuge

- `node scripts/drei-ansichten.mjs` — Leitung, Teamer:in und Konfi
  nebeneinander, angemeldet.
- `node scripts/screenshots.mjs` — 19 Bildschirmfotos aus der Demo-Gemeinde.
- `node scripts/verwaiste-dateien.mjs` — findet Upload-Dateien ohne Datensatz.

Alle drei brauchen `source ~/.claude/secrets.env`.

Nach **jedem** Merge die drei Doku-Generatoren laufen lassen:

    node scripts/build-handbuch.mjs
    node scripts/build-api-docs.mjs
    node scripts/build-openapi.mjs

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
