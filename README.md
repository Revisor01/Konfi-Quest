# Konfi Quest

Eine moderne Web-Anwendung zur Verwaltung von Konfirmandenpunkten mit React 19 + TypeScript + Ionic 8 Frontend und Express.js Backend.

## Projekt-Struktur

```
KonfipointsNew/
├── frontend/          # React 19 + TypeScript + Ionic 8 Frontend
├── backend/           # Express.js API Server
├── API Definitionen.md # Vollständige API-Spezifikation
├── docker-compose.yml # Container-Orchestrierung
└── CLAUDE.md         # Entwicklungsrichtlinien für Claude Code
```

## Schnellstart

### Frontend starten
```bash
cd frontend
npm install
npm run dev
```

### Backend starten
```bash
cd backend
npm install
npm run dev
```

### Mit Docker
```bash
docker-compose up -d
```

## Features

- 🔐 **Zwei-Ebenen-Authentifizierung**: Admin und Konfi-Zugänge
- 📱 **Mobile-First**: Ionic 8 für iOS-Deployment optimiert
- 🎮 **Gamification**: Punkte sammeln und Badges verdienen
- 💬 **Chat-System**: Kommunikation zwischen Admins und Konfis
- 📊 **Dashboard**: Übersichten und Statistiken
- 🏆 **Ranking-System**: Anonymisierte Bestenlisten

## Technologie-Stack

### Frontend
- React 19 mit TypeScript
- Ionic 8 für mobile UI
- Vite als Build-Tool
- Vitest für Unit-Tests
- Cypress für E2E-Tests

### Backend
- Node.js + Express.js
- SQLite3 Datenbank
- JWT-Authentifizierung
- Multer für File-Uploads

## API

Die vollständige API-Dokumentation findest du in `API Definitionen.md`.

**Base URL**: https://konfipoints.godsapp.de/api

## Entwicklung

Siehe `CLAUDE.md` für detaillierte Entwicklungsrichtlinien und Architektur-Informationen.

## Lizenz

[Lizenz-Information hier einfügen]
