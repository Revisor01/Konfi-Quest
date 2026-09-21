<p align="center">
  <img src="frontend/public/apple-touch-icon.png" alt="Konfi Quest" width="128" height="128">
</p>

<h1 align="center">Konfi Quest</h1>

<p align="center">
  Die App für die Konfizeit — für Konfis, Teamer:innen und die Gemeindeleitung.<br>
  Punkte sammeln, Termine finden, miteinander reden. Auf iPhone, Android und im Browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Plattform-iOS%20%C2%B7%20Android%20%C2%B7%20Web-blue" alt="Plattform">
  <img src="https://img.shields.io/github/v/release/Revisor01/Konfi-Quest?label=Version&color=green&sort=semver" alt="Version">
  <img src="https://img.shields.io/badge/Ionic-9-3880ff?logo=ionic" alt="Ionic">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Quelle-offen%20einsehbar-2ea44f" alt="Quelle offen einsehbar">
  <img src="https://img.shields.io/badge/Nutzung-nur%20mit%20Erlaubnis-orange" alt="Nutzung nur mit Erlaubnis">
</p>

## Worum es geht

In der Konfizeit passiert viel: Gottesdienste, Freizeiten, Projekte, das
Mitarbeiten in der Gemeinde. Konfi Quest hält fest, wer wobei dabei war —
nicht als Pflichtheft, sondern als etwas, das man gern in die Hand nimmt.

Konfis sammeln zwei Arten von Punkten: für Gottesdienste und für die Gemeinde.
Sie melden sich zu Terminen an, stellen sich Challenges, sammeln Abzeichen und
bekommen am Ende des Jahres einen Rückblick auf ihre Konfizeit.

Teamer:innen begleiten ihre Gruppen, tragen Punkte ein und bekommen einen
eigenen Rückblick. Die Leitung verwaltet Jahrgänge, gibt Anträge frei und behält
den Überblick — auch über mehrere Gemeinden hinweg, sauber voneinander getrennt.

## Funktionen

### Für Konfis
- **Punkte** — Gottesdienst und Gemeinde getrennt, mit Zielen je Jahrgang
- **Termine** — anmelden, abmelden, Warteliste, Check-in per QR-Code
- **Challenges** — Aufgaben mit Foto, Video oder Text, sichtbar im Jahrgangs-Feed
- **Abzeichen** — für Meilensteine, Serien und besondere Anlässe
- **Rückblick** — der eigene Jahresrückblick, teilbar wie eine Story
- **Chat** — Jahrgang, Gruppen, Termine und Direktnachrichten

### Für Teamer:innen
- Eigenes Dashboard mit den betreuten Jahrgängen
- Punkte eintragen, Anträge sichten, Challenges stellen
- Zertifikate und Nachweise (JuLeiCa, Teamer-Card)
- Eigener Jahresrückblick über die geleistete Arbeit

### Für die Leitung
- Jahrgänge, Konfis und Team verwalten
- Aktivitäten, Kategorien und Punkteziele festlegen
- Anträge freigeben, Abzeichen gestalten, Termine anlegen
- Mehrere Gemeinden in einer Anmeldung, streng getrennte Daten

### Überall
- **Ohne Netz nutzbar** — Eingetragenes wird gespeichert und später gesendet
- **Benachrichtigungen** — für Nachrichten, Termine, Punkte und Freigaben
- **Anmeldung per Face ID, Touch ID oder Fingerabdruck**
- **Handbuch in der App** — [auch online lesbar](https://konfi-quest.de/docs/)

## Installation

### App Store

**[Im App Store laden »](https://apps.apple.com/de/app/konfi-quest/id6748016619)**

### Google Play

**[Bei Google Play laden »](https://play.google.com/store/apps/details?id=de.godsapp.konfiquest)**

### Im Browser

**[konfi-quest.de »](https://konfi-quest.de)** — dieselbe Oberfläche, ohne Installation.

### Eigene Gemeinde

Konfi Quest lässt sich für die eigene Gemeinde nutzen. Schreib einfach an
[moin@konfi-quest.de](mailto:moin@konfi-quest.de).

## Bildschirmfotos

<p align="center">
  <img src="docs/screenshots/iphone/konfi-startseite.png" width="200" alt="Startseite">
  <img src="docs/screenshots/iphone/konfi-challenges.png" width="200" alt="Challenges">
  <img src="docs/screenshots/iphone/konfi-chat.png" width="200" alt="Chat">
  <img src="docs/screenshots/iphone/konfi-abzeichen.png" width="200" alt="Abzeichen">
</p>

Weitere Ansichten für alle drei Rollen liegen in
[docs/screenshots/](docs/screenshots/).

## Versionen

Was sich wann geändert hat, steht in [CHANGELOG.md](CHANGELOG.md) — nach
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), aus Sicht der
Nutzer:innen geschrieben. Die [Releases](https://github.com/Revisor01/Konfi-Quest/releases)
fassen jede Version zusammen.

## Selbst betreiben

```bash
git clone https://github.com/Revisor01/Konfi-Quest.git
cd Konfi-Quest

# Backend
cd backend && npm install && npm start

# Frontend (zweites Terminal)
cd frontend && npm install && npm run dev
```

Das Backend braucht PostgreSQL 15 und eine `.env` mit `DATABASE_URL`,
`JWT_SECRET`, `QR_SECRET` und `ACTIVITY_PHOTO_ENCRYPTION_KEY`. Für
Benachrichtigungen und E-Mail kommen Firebase- und SMTP-Zugangsdaten dazu;
ohne sie läuft alles andere weiter.

Die Mitarbeit am Projekt beschreibt [CLAUDE.md](CLAUDE.md) — vor allem die
Regel, dass ausgelieferte App-Versionen niemals brechen dürfen.

## Aufbau

```
Konfi-Quest
├── frontend/          — Ionic 9 + React 19, TypeScript
│   ├── src/
│   │   ├── components/  — nach Rolle getrennt: konfi, teamer, admin, shared
│   │   ├── contexts/    — App-Zustand, Abzeichen, Anmeldung
│   │   ├── services/    — API, Offline-Warteschlange, Biometrie, Push
│   │   └── __tests__/   — 1625 Tests
│   ├── ios/ · android/  — Capacitor 8
│   └── public/docs/     — erzeugtes Handbuch und API-Referenz
├── backend/           — Node 22 + Express 5, PostgreSQL 15
│   ├── routes/          — nach Bereich getrennt, RBAC je Route
│   ├── services/        — Push, Abzeichen, Rückblick, E-Mail
│   ├── migrations/      — additiv, nie zerstörend
│   └── tests/           — 2470 Tests gegen eine echte Datenbank
├── docs/              — Quelle für Handbuch, API-Doku und Store-Texte
└── e2e/               — Playwright, gegen den vollen Stack
```

**Worauf es beim Bauen ankommt:**
- **Ausgelieferte Apps nie brechen.** Antwortformen sind ein Vertrag: Aus einem
  Array wird kein Objekt, Felder verschwinden nicht. Wer die Form ändern will,
  legt eine neue Route an.
- **Migrationen laufen additiv** — erst die Spalte dazu, dann beide Stände
  bedienen, Altes erst entfernen, wenn keine alte App mehr darauf zugreift.
- **Jede Verhaltensänderung bekommt Tests, Handbuch und CHANGELOG** im selben
  Commit.
- **Rollentrennung bis in die Datenbank.** Mehrere Gemeinden teilen sich eine
  Instanz, sehen aber nie Daten der anderen.

## Mitmachen

Fehlermeldungen und Vorschläge sind willkommen — gern als
[Issue](https://github.com/Revisor01/Konfi-Quest/issues).

## Lizenz

**Quelloffen zur Einsicht — Nutzung nur mit schriftlicher Erlaubnis.**
Der vollständige Text steht in [LICENSE](LICENSE).

Der Quelltext ist öffentlich einsehbar, und das bleibt so. Eine App, die
mit den Daten von Jugendlichen umgeht, muss nachprüfbar sein: Jede und
jeder soll nachlesen können, was gespeichert wird und wie es gesichert ist.

- **Ohne Weiteres erlaubt:** lesen, herunterladen, studieren, zu Lern- und
  Prüfzwecken auf eigenen Geräten ausführen, Sicherheitslücken melden,
  darüber berichten.
- **Braucht eine Vereinbarung:** der Betrieb für echte Nutzer:innen, die
  Weitergabe an Dritte, die Verwendung von Teilen des Codes in anderer
  Software — unabhängig davon, ob damit Geld verdient wird.

Sie möchten Konfi Quest in Ihrer Gemeinde einsetzen? Schreiben Sie mir,
das lässt sich regeln.

## Kontakt

Pastor Simon Luthe · [moin@konfi-quest.de](mailto:moin@konfi-quest.de) ·
[konfi-quest.de](https://konfi-quest.de)
