// backend/tests/schema/composeVorlagen.test.js
//
// Die Datenbank-Dienste der beiden Compose-Dateien gegen die Produktion.
//
// deploy/compose.konfi_quest.yml ist die Vorlage fuer jede neue Instanz,
// docker-compose.e2e.yml der Stack, gegen den die E2E-Specs laufen. Beide
// sollen sich so verhalten wie die Produktion; beide wichen ab (Audit
// 26.09.2026, Tests BF-03/BF-13, Datenbank "Erst-Einrichtung"):
//   - Eine neue Instanz nach der Vorlage lief in Berliner Zeit, die
//     Produktion in UTC: Das Image uebernimmt TZ beim ersten Start in
//     postgresql.conf, das Datenverzeichnis der Produktion ist aelter als der
//     TZ-Eintrag (nachgestellt 29.09.2026 mit postgres:15-alpine).
//   - Der E2E-Stack lief auf Postgres 16, ohne Server-Zeitzone, ohne
//     QR_SECRET und ACTIVITY_PHOTO_ENCRYPTION_KEY, und bekam nur den Dump --
//     schema_migrations kam leer, alle Migrationen liefen ein zweites Mal,
//     zwei scheiterten bei jedem Start.
// Gelesen wird der Text der Dateien (ohne YAML-Bibliothek): Die Abschnitte
// sind klein und haben feste Einrueckung.
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..', '..');
const VORLAGE = fs.readFileSync(path.join(WURZEL, 'deploy', 'compose.konfi_quest.yml'), 'utf8');

// Der Block eines Dienstes: von "  <name>:" bis zum naechsten Dienst auf
// derselben Einrueckung (oder Dateiende).
function dienst(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`Dienst ${name} nicht gefunden`);
  const rest = text.slice(start + 1);
  const ende = rest.slice(3).search(/\n {2}[a-z0-9-]+:\n/);
  return ende < 0 ? rest : rest.slice(0, ende + 3);
}

// Kommentare weg, damit ein auskommentierter Eintrag nicht zaehlt.
const ohneKommentare = (block) => block.split('\n').filter((z) => !/^\s*#/.test(z)).join('\n');

const vorlageDb = ohneKommentare(dienst(VORLAGE, 'postgres'));

const imageVon = (block) => (block.match(/^\s+image:\s*(\S+)/m) || [])[1];

describe('Compose-Vorlage: eine neue Instanz verhaelt sich wie die Produktion', () => {
  it('die Server-Zeitzone steht fest auf UTC', () => {
    // Als "-c" / "timezone=UTC" in der Liste unter command.
    expect(vorlageDb).toMatch(/- "-c"\n\s+- "timezone=UTC"/);
  });

  it('Postgres 15 wie die Produktion', () => {
    expect(imageVon(vorlageDb)).toBe('postgres:15-alpine');
  });
});
