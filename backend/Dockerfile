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

FROM node:26-bookworm AS abhaengigkeiten
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:26-bookworm-slim
WORKDIR /app

# curl NUR fuer den Healthcheck des Stacks: deploy/compose.konfi_quest.yml
# (und damit der Portainer-Stack) prueft backend, backend2 und backend-test mit
# `curl -f http://localhost:5000/api/health`. Das Slim-Image hat kein curl --
# ohne diese Zeile waere jeder neue Container "unhealthy", und deploy/rollend.sh
# wartet genau auf "healthy". Kann weg, sobald der Stack wie dieses Image
# `node healthcheck.js` benutzt (Auftrag docs/auftraege/lokaler-agent/08).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=abhaengigkeiten /app/node_modules ./node_modules
COPY . .

# Git-Commit-SHA fuer /api/status (vom CI via --build-arg gesetzt)
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

# Upload-Verzeichnis. Dem Nutzer `node` (uid 1000) gehoerig, damit das Image
# auch ohne root laufen kann; der Prozess laeuft vorerst weiter als root, weil
# das gemountete Upload-Verzeichnis in Produktion root gehoert (Umstellung:
# Auftrag docs/auftraege/lokaler-agent/08). Mit Mount gilt der Besitzer des
# Host-Verzeichnisses, ohne Mount (E2E, lokal) dieser hier.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

EXPOSE 5000

CMD ["node", "server.js"]
