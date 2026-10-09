// MIGRATION 176: In konfi_profiles.password_plain kann kein Klartext mehr
// landen (Audit Datenbank BF-06 / Sicherheit BF-06, 29.09.2026).
//
// Die Spalte stammt aus der SQLite-Zeit, als Konfi-Passwoerter im Klartext
// gespeichert und der Leitung angezeigt wurden. Migration 165 hat die Werte
// geleert (Produktion vor dem Deploy: 0 von 130 Zeilen mit Wert). Uebrig war:
//   - die Spalte selbst -- jede kuenftige Stelle, die wieder hineinschreibt,
//     haette ein Klartext-Passwort eines Kindes in jeder Sicherung;
//   - eine Schreibstelle (regenerate-password setzte sie auf NULL).
//
// Jetzt: keine Code-Stelle nennt die Spalte mehr, und ein CHECK laesst nur
// NULL zu. DROP COLUMN folgt erst, wenn keine Server-Fassung mehr laeuft, die
// sie noch anfasst: Beim rollenden Deploy und im Test-Backend (eigenes Image)
// laeuft die bisherige Fassung weiter und schreibt dort NULL -- ohne Spalte
// bekaeme die Leitung beim Erzeugen eines Einmalpassworts einen Fehler. Das
// NULL laesst der CHECK zu.
//
// Seit 09.10.2026 stehen 176 und 187 (entfernt die Spalte samt CHECK) im
// Schema-Dump (tests/schema/prod-schema.sql); beide Dateien sind aus
// backend/migrations/ entfernt. Den CHECK auf dem Stand vor 187 gibt es
// damit nirgends mehr aufzubauen -- sein Test liegt in der Git-Historie,
// dass die Spalte fehlt, prueft migration187PasswordPlainEntfernt.test.js.
// Hier bleibt der Waechter, dass keine Code-Stelle die Spalte nennt.
const fs = require('fs');
const path = require('path');

describe('Keine Code-Stelle fasst password_plain mehr an', () => {
  // Voraussetzung fuer das spaetere DROP COLUMN: Liest oder schreibt keine
  // Stelle die Spalte, bricht ihr Wegfall nichts. Migrationen und Tests
  // duerfen sie nennen.
  const BACKEND = path.join(__dirname, '..', '..');
  const ORDNER = ['routes', 'services', 'utils', 'middleware', 'scripts'];
  const EINZELN = ['server.js', 'createApp.js', 'database.js'];

  const dateien = (ordner) => fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) return dateien(voll);
    return e.name.endsWith('.js') ? [voll] : [];
  });

  it('weder in Routen, Diensten, Hilfen noch in Skripten', () => {
    const alle = [
      ...ORDNER.flatMap((o) => dateien(path.join(BACKEND, o))),
      ...EINZELN.map((f) => path.join(BACKEND, f)),
    ];
    expect(alle.length).toBeGreaterThan(50);
    const treffer = alle.filter((f) => fs.readFileSync(f, 'utf8').includes('password_plain'))
      .map((f) => path.relative(BACKEND, f));
    expect(treffer).toEqual([]);
  });
});
