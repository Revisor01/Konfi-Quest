# Handoff — Stand 11.08.2026

Übergabe an die nächste Sitzung. Thema dort: **Release 2.0.0 vorbereiten**
(Screenshots, Store-Beschreibung, What's New).

## Wo wir stehen

- Branch: `feature/challenges-2.0`, Arbeitsverzeichnis sauber, alles gepusht.
- Version **2.0.0**, iOS-Build **122** (Android versionCode 78, unverändert).
- Backend-Tests: 830 grün. TypeScript und Vite-Build sauber.
- **Noch nicht nach `main` gemergt.**

### Rückkehrpunkt

`git reset --hard vor-challenges-zusammenlegung` (Tag auf Build 118, gepusht)
— falls die Zusammenlegung von "Verwalten | Mitmachen" doch nicht überzeugt.

## CHANGELOG

Vollständig fortgeschrieben unter `## [Unreleased] - 2.0.0`, 48 Einträge in
allen vier Kategorien. Beim Release nur noch die Überschrift auf
`## [2.0.0] - <Datum>` ändern.

**Für die Store-Texte:** Alles außer "Sonstiges" verwenden — dieser Abschnitt
betrifft Website, CI und Infrastruktur und gehört nicht in die Release-Notes.

## Was in 2.0.0 steckt (Kurzfassung für die Store-Texte)

Drei große Blöcke:

1. **Challenges** — das neue Feature. Aufgaben über einen frei gewählten
   Zeitraum, Antworten als Foto, Text, Aufnahme oder Link. Punktefrei und ohne
   Rangliste, nur ein Abzeichen fürs Mitmachen. Teamer:innen und Leitung machen
   selbst mit, es gibt auch Runden nur fürs Team.
2. **Tab-Umbau** — eigener Challenges-Tab; die Anträge sind kein eigener Tab
   mehr, sondern ein Bereich im Veranstaltungs-Tab. Betrifft alle drei Rollen
   und ist der Punkt, an dem Bestandsnutzer sich umgewöhnen müssen.
3. **Wrapped v2** — erzählt den eigenen Weg statt Platzierungen, ohne Rang.

Dazu: Teamer-Kontingent bei Veranstaltungen mit eigener Warteliste, anonyme
Nutzungsmessung, Barrierefreiheit (201 Beschriftungen), und ein größerer
Stapel Fehlerbehebungen.

## Offene Punkte

### Muss vor dem Release

- **Nach `main` mergen.** Der Branch ist vier Wochen alt und trägt 39 Commits.
- **Android**: versionCode steht noch auf 78 und wurde diese Runde nie gebaut.
  Vor dem Release prüfen, ob der Android-Build durchläuft.
- **`apply-version.sh`-Fix** liegt laut Memory auf diesem Branch und muss nach
  `main` — siehe `konfi-quest-offener-apply-version-fix`.

### Sollte geprüft werden

- **Build 122 am Gerät testen.** Enthält den Routing-Fix (Detail-Routen ohne
  `exact` kaperten andere Tabs) — das war der schwerste Fehler und ist nur am
  Gerät verifizierbar.
- **Challenge-Detail bei vielen Beiträgen**: Seit der Zusammenlegung stehen
  eigener Beitrag und Moderation untereinander. Bei fünf Beiträgen
  unproblematisch, bei dreißig womöglich zu lang. Offene Designfrage.
- **Nutzungsmessung**: läuft erst mit echter Nutzung an. In Umami unter
  "Konfi Quest App" (getrennt von der Landingpage).

### Aus dem Usability-Audit bewusst offen gelassen

Nicht-interaktive Listen sehen aus wie tippbare (KonfiDetailSections), und
Event-Punkte im Konfi-Detail haben als einzige Liste keine Löschmöglichkeit.
Beides braucht je eine Designentscheidung, keine reine Umsetzung.

## Umgebungen

| | Stand | Hinweis |
|---|---|---|
| Produktion | 1.5.3 | `konfi-quest.de`, unberührt |
| Staging | Build 122 | `staging.konfi-quest.de`, eigene Datenbank |
| TestFlight | Build 122 | Builds 117–122 alle mit Testinfos |

**Staging aktualisieren** (Code ist ins Image gebacken, Neustart allein reicht
nicht):

```bash
ssh root@server.godsapp.de
cd /opt/Konfi-Quest-Staging/src && git pull origin feature/challenges-2.0
# Backend:
cd backend && docker build -t konfi-quest-backend:staging .
# Frontend:
cd ../frontend && docker build --build-arg VITE_API_URL=https://staging.konfi-quest.de/api \
  -t konfi-quest-frontend:staging .
docker restart konfi_quest_staging-backend-1 konfi_quest_staging-frontend-1
```

Der Staging-Stand hat diese Runde eine Fehlersuche gekostet (er hing vier
Commits zurück, deshalb fehlten Daten, die es im Code längst gab). **Vor dem
Testen immer kurz `git log --oneline -1` dort prüfen.**

## Wiederkehrende Fallen dieser Runde

- **Stats-Kacheln**: `.app-stats-row__label` ist auf 100px begrenzt, in
  Großbuchstaben, ohne Umbruch. Labels über ~9 Zeichen laufen heraus. Ist mir
  dreimal passiert.
- **`null.localeCompare()`**: Hat zweimal zum Rauswurf geführt. Fehlt ein Feld,
  wirft der Render, die ErrorBoundary fängt ihn — und deren Ausweg löscht Auth
  und Cache. Sieht für Nutzer aus wie ein spontaner Logout.
- **JSX-Kommentar direkt nach `return (` oder `&& (`** ist ungültig. Zweimal
  hineingelaufen.
- **TestFlight-Testinfos**: Das API-Feld heißt `whatsNew`, nicht `whatsToTest`.

## Zugänge

- ntfy: `$NTFY_URL` und `$NTFY_TOKEN` in `~/.claude/secrets.env`,
  Topic `konfi-quest`.
- App Store Connect: `~/.claude/secrets/asc-jwt.sh`, App-ID `6748016619`.
- Umami: `t.godsapp.de`, App-Website-ID `72da966c-4b34-41f8-9dbe-e7fb7397f6d6`.
