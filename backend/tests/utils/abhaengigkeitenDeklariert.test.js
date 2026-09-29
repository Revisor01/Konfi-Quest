// backend/tests/utils/abhaengigkeitenDeklariert.test.js
// Jedes Paket, das der Backend-Code lädt, steht in package.json -- und zwar
// dort, wo es im Betrieb auch installiert ist (Release-Audit 26.09.2026,
// Toolchain BF-05 und BF-10).
//
// Anlass: `node-fetch` (Tageslosung), `validator` (E-Mail-Prüfung in
// routes/auth.js) und `proxy-addr` (Client-Adresse hinter dem Proxy) wurden
// geladen, standen aber in keiner package.json. Sie lagen nur zufällig im
// Baum, weil ein anderes Paket sie mitbrachte -- `node-fetch` sogar nur über
// eine OPTIONALE Kette von firebase-admin. Ein Update dieses anderen Pakets
// kann die Kette kappen, und der Fehler zeigt sich erst zur Laufzeit.
//
// Zwei Regeln:
//   1. Code ausserhalb von tests/ lädt nur Pakete aus `dependencies`. Das
//      Backend-Image installiert ohne devDependencies; ein require auf eine
//      devDependency liefe dort ins Leere.
//   2. Code in tests/ (und die ESLint-Konfiguration) lädt nur Pakete aus
//      `dependencies` oder `devDependencies`.
//
// Geprüft wird der Quelltext, nicht das Laufzeitverhalten -- genau das ist
// hier der Gegenstand: welche Namen der Code lädt.
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const WURZEL = path.join(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(WURZEL, 'package.json'), 'utf8'));
const PROD = new Set(Object.keys(pkg.dependencies || {}));
const DEV = new Set(Object.keys(pkg.devDependencies || {}));
const EINGEBAUT = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

const AUSGELASSEN = new Set(['node_modules', 'uploads', 'coverage']);

function jsDateien(dir) {
  const ergebnis = [];
  for (const eintrag of fs.readdirSync(dir, { withFileTypes: true })) {
    if (AUSGELASSEN.has(eintrag.name) || eintrag.name.startsWith('.')) continue;
    const voll = path.join(dir, eintrag.name);
    if (eintrag.isDirectory()) ergebnis.push(...jsDateien(voll));
    else if (/\.(c|m)?js$/.test(eintrag.name)) ergebnis.push(voll);
  }
  return ergebnis;
}

// Paketname aus einem Modul-Spezifizierer, oder null für Relatives/Eingebautes.
function paketName(spezifizierer) {
  if (spezifizierer.startsWith('.') || spezifizierer.startsWith('/')) return null;
  if (EINGEBAUT.has(spezifizierer) || EINGEBAUT.has(spezifizierer.split('/')[0])) return null;
  const teile = spezifizierer.split('/');
  return spezifizierer.startsWith('@') ? teile.slice(0, 2).join('/') : teile[0];
}

// require('x'), import('x'), import ... from 'x' -- ohne Kommentarzeilen, damit
// ein Satz wie "Bis hier stand import('node-fetch')" nicht mitzählt.
function geladenePakete(datei) {
  const pakete = new Set();
  const muster = /(?:\brequire\(\s*|\bimport\(\s*|\bfrom\s+|^\s*import\s+)['"]([^'"]+)['"]/g;
  for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
    const t = zeile.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    let treffer;
    while ((treffer = muster.exec(zeile))) {
      const name = paketName(treffer[1]);
      if (name) pakete.add(name);
    }
  }
  return pakete;
}

function verstoesse(dateien, erlaubt) {
  const liste = [];
  for (const datei of dateien) {
    for (const name of geladenePakete(datei)) {
      if (!erlaubt(name)) liste.push(`${path.relative(WURZEL, datei)}: ${name}`);
    }
  }
  return liste.sort();
}

const alle = jsDateien(WURZEL);
const TESTS = path.join(WURZEL, 'tests') + path.sep;
// Werkzeug-Konfiguration läuft nur in Entwicklung und CI, nie im Image.
const WERKZEUG = new Set([path.join(WURZEL, 'eslint.config.js')]);
const nurEntwicklung = (d) => d.startsWith(TESTS) || WERKZEUG.has(d);
const betrieb = alle.filter((d) => !nurEntwicklung(d));
const tests = alle.filter(nurEntwicklung);

describe('Backend: geladene Pakete stehen in package.json', () => {
  it('findet überhaupt Code und Tests (sonst prüft der Test nichts)', () => {
    expect(betrieb.length).toBeGreaterThan(100);
    expect(tests.length).toBeGreaterThan(100);
    expect(betrieb.some((d) => d.endsWith(path.join('routes', 'auth.js')))).toBe(true);
  });

  it('Betriebscode lädt nur Pakete aus dependencies', () => {
    expect(verstoesse(betrieb, (name) => PROD.has(name))).toEqual([]);
  });

  it('Tests und Werkzeug-Konfiguration laden nur deklarierte Pakete', () => {
    expect(verstoesse(tests, (name) => PROD.has(name) || DEV.has(name))).toEqual([]);
  });

  it('erkennt ein undeklariertes Paket (Selbstprobe mit dem alten Losung-Code)', () => {
    const probe = path.join(require('os').tmpdir(), `abhaengigkeiten-probe-${process.pid}.js`);
    // Zusammengesetzt, damit diese Testdatei selbst keinen Ladeaufruf enthält,
    // den der Scan oben mitzählen würde.
    const imp = 'imp' + 'ort';
    const req = 'req' + 'uire';
    fs.writeFileSync(probe, [
      `// Kommentar: ${imp}('kommentar-zaehlt-nicht')`,
      `const fetch = (await ${imp}('node-fetch')).default;`,
      `const validator = ${req}('validator');`,
      `const fs = ${req}('node:fs');`,
      `const eigen = ${req}('./eigen');`,
    ].join('\n'));
    try {
      expect([...geladenePakete(probe)].sort()).toEqual(['node-fetch', 'validator']);
    } finally {
      fs.unlinkSync(probe);
    }
  });
});
