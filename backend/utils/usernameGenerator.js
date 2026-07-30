// Generiert aus einem Anzeigenamen einen Benutzernamen, der die zentralen
// Username-Regeln erfuellt (commonValidations.username in middleware/validation.js):
// nur a-z, 0-9, Punkt und Bindestrich. Umlaute werden transliteriert (ä->ae usw.),
// damit Admin-angelegte Konfis dieselben Regeln erfuellen wie die
// Selbstregistrierung (die Umlaute ablehnt).
const UMLAUT_MAP = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'
};

function generateUsernameFromName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUT_MAP[c])
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '');
}

// Findet einen global freien Benutzernamen (case-insensitiv, wie der
// Duplikat-Check der Selbstregistrierung — die DB erzwingt Eindeutigkeit nur
// pro Organisation, der Login sucht aber global per LOWER-Vergleich).
// Bei Kollision wird hochgezaehlt: anna.musterfrau, anna.musterfrau2, ...
async function generateUniqueUsername(queryable, name) {
  const base = generateUsernameFromName(name) || 'konfi';
  let candidate = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await queryable.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [candidate]
    );
    if (rows.length === 0) return candidate;
    candidate = `${base}${i++}`;
  }
}

module.exports = { generateUsernameFromName, generateUniqueUsername };
