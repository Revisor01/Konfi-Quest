# Backend-Image: nur was zur Laufzeit gebraucht wird (29.09.2026, Audit CI
# BF-06 / Toolchain BF-03).
#
# Bis dahin: Vollimage node:*-bookworm mit g++, make, python3, git; darin
# `npm install --omit=dev && npm install pg`. Das zweite `npm install` ohne
# Schalter holte alle Dev-Abhaengigkeiten wieder herein (vitest, nodemon,
# supertest) und nahm `pg` in der jeweils neuesten Version statt der aus dem
# Lockfile. `COPY . .` ohne .dockerignore brachte tests/ samt dem
# Produktions-Schema-Dump (tests/schema/prod-schema.sql) ins oeffentlich
# lesbare Image. Gemessen: 1,92 GB, 319 Module, 253 Testdateien.
#
# Jetzt zwei Stufen:
#   1. abhaengigkeiten: `npm ci --omit=dev` -- genau das Lockfile, bricht ab,
#      wenn package.json und Lockfile auseinanderlaufen. Im Vollimage, damit
#      ein natives Modul ohne passendes Prebuild (bcrypt) hier notfalls
#      kompiliert werden kann; der Compiler bleibt in dieser Stufe.
#   2. Laufzeit: das schlanke Image, node_modules aus Stufe 1, der Code ohne
#      Tests und Doku (backend/.dockerignore).

FROM node:24-bookworm AS abhaengigkeiten
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:24-bookworm-slim
WORKDIR /app

# Kein curl (01.10.2026): Der Stack prueft backend, backend2 und backend-test
# seitdem wie dieses Image mit `node healthcheck.js` (Auftrag
# docs/auftraege/lokaler-agent/09-backend-container.md). Bis dahin wurde curl
# eigens fuer den Healthcheck des Stacks nachinstalliert.

COPY --from=abhaengigkeiten /app/node_modules ./node_modules
COPY . .

# Git-Commit-SHA fuer /api/status (vom CI via --build-arg gesetzt)
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

# Upload-Verzeichnis. Dem Nutzer `node` (uid 1000) gehoerig, damit das Image
# auch ohne root laeuft (E2E, lokal: ohne Mount gilt dieser Besitz). In
# Produktion laeuft der Prozess seit dem 01.10.2026 als eigene uid
# 10001:10001 (`user:` im Stack); Upload-Verzeichnis und Push-Schluessel
# gehoeren am Host 10001, fuer andere Nutzer gesperrt. Bewusst nicht 1000:
# die gehoert am Host einem bestehenden Systemnutzer (Auftrag
# docs/auftraege/lokaler-agent/09-backend-container.md).
RUN mkdir -p /app/uploads && chown node:node /app/uploads

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

EXPOSE 5000

CMD ["node", "server.js"]
