// backend/tests/utils/usernameGenerator.test.js
// Tests fuer die Username-Generierung aus Anzeigenamen (Admin-Anlage).
// Muss dieselben Zeichenregeln erfuellen wie die Selbstregistrierung
// (commonValidations.username): nur a-z, 0-9, Punkt, Bindestrich.
const { generateUsernameFromName, generateUniqueUsername } = require('../../utils/usernameGenerator');

describe('generateUsernameFromName', () => {
  it('macht aus Vor- und Nachname einen Punkt-getrennten Username', () => {
    expect(generateUsernameFromName('Anna Musterfrau')).toBe('anna.musterfrau');
  });

  it('transliteriert Umlaute und scharfes S', () => {
    expect(generateUsernameFromName('Jürgen Müller')).toBe('juergen.mueller');
    expect(generateUsernameFromName('Björn Größe')).toBe('bjoern.groesse');
    expect(generateUsernameFromName('Aßmann')).toBe('assmann');
  });

  it('behaelt Zahlen und Bindestriche', () => {
    expect(generateUsernameFromName('Lisa-Marie Meyer 2')).toBe('lisa-marie.meyer.2');
  });

  it('entfernt unzulaessige Sonderzeichen', () => {
    expect(generateUsernameFromName("Anna! (Musterfrau)")).toBe('anna.musterfrau');
  });

  it('kollabiert Mehrfach-Punkte und trimmt Rand-Punkte', () => {
    expect(generateUsernameFromName('  Anna   Musterfrau  ')).toBe('anna.musterfrau');
    expect(generateUsernameFromName('.Anna.')).toBe('anna');
  });

  it('erfuellt immer die zentralen Username-Zeichenregeln', () => {
    const beispiele = ['Anna Musterfrau', 'Jürgen Müßig-Größe 2', 'Éva Öztürk', 'K@i #Sonderzeichen'];
    for (const name of beispiele) {
      expect(generateUsernameFromName(name)).toMatch(/^[a-z0-9.-]*$/);
    }
  });
});

describe('generateUniqueUsername', () => {
  const mockDb = (vergeben) => ({
    query: async (_sql, [candidate]) => ({
      rows: vergeben.includes(candidate.toLowerCase()) ? [{ id: 1 }] : []
    })
  });

  it('gibt den Basis-Username zurueck wenn frei', async () => {
    const db = mockDb([]);
    expect(await generateUniqueUsername(db, 'Anna Musterfrau')).toBe('anna.musterfrau');
  });

  it('zaehlt bei Kollision hoch', async () => {
    const db = mockDb(['anna.musterfrau', 'anna.musterfrau2']);
    expect(await generateUniqueUsername(db, 'Anna Musterfrau')).toBe('anna.musterfrau3');
  });

  it('faellt bei leerem Ergebnis auf "konfi" zurueck', async () => {
    const db = mockDb(['konfi']);
    expect(await generateUniqueUsername(db, '!!!')).toBe('konfi2');
  });
});
