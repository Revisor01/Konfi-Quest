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

# Kein curl (01.10.2026): Der Stack prueft backend und backend2
# seitdem wie dieses Image mit `node healthcheck.js` (Auftrag 09 des lokalen
# Agenten, erledigt; docs/README.md, "Erledigte Auftraege"). Bis dahin wurde
# curl eigens fuer den Healthcheck des Stacks nachinstalliert.

COPY --from=abhaengigkeiten /app/node_modules ./node_modules
COPY . .

# Git-Commit-SHA fuer /api/status (vom CI via --build-arg gesetzt)
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

# Eigener Nutzer konfi mit fester uid/gid 10001 (02.10.2026, Simon: fest ins
# Image). In Produktion lief der Prozess seit dem 01.10.2026 mit
# `user: "10001:10001"` im Stack; seitdem gehoeren Upload-Verzeichnis und
# Push-Schluessel am Host 10001, fuer andere Nutzer gesperrt. Jetzt bringt das
# Image denselben Nutzer selbst mit -- ein Stack ohne `user:` faellt nicht
# mehr auf root zurueck. Bewusst nicht `node` (uid 1000): die gehoert am Host
# einem bestehenden Systemnutzer, und weitere Container laufen dort als 1000
# (Auftrag 09 des lokalen Agenten, 01.10.2026; docs/README.md).
#
# Geschrieben wird nur unter /app/uploads (Unterordner und Zwischenlager legt
# createApp.js beim Start an). Ohne Mount (E2E, lokal) gilt der Besitz hier;
# mit Mount der am Host. Der Code unter /app gehoert root und bleibt fuer den
# Prozess nur lesbar.
RUN groupadd --system --gid 10001 konfi \
  && useradd --system --uid 10001 --gid 10001 --no-create-home \
     --home-dir /app --shell /usr/sbin/nologin konfi \
  && mkdir -p /app/uploads && chown 10001:10001 /app/uploads

USER 10001:10001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

EXPOSE 5000

CMD ["node", "server.js"]
