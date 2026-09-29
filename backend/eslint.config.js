// ESLint fuer das Backend (Release-Audit 26.09.2026: Toolchain BF-06, Tests BF-16).
//
// Bis zum 29.09.2026 hatte das Backend gar keine Lint-Pruefung. Die Regeln
// hier sind bewusst schmal: js.configs.recommended plus Node- und
// Vitest-Globals. Was sie fangen soll, ist vor allem die Klasse, die sonst erst
// in Produktion auffaellt -- ein Tippfehler in einem selten laufenden Pfad
// (Cron-Job, Fehlerzweig): `no-undef` ist deshalb ein FEHLER.
//
// Die CI (ci.yml, Job backend-test, Schritt Lint) bewertet nur Fehler, nicht
// Warnungen -- wie im Frontend.
//
// Auf 'warn' herabgestuft, mit Begruendung:
//
//   no-unused-vars          Altbestand (76 Stellen am 26.09.2026, 54 davon
//                           ausserhalb der Tests), ohne Laufzeitwirkung. Er
//                           wird beim Anfassen der jeweiligen Datei
//                           abgebaut; ein Sammel-Umbau quer durch alle Routen
//                           waere Risiko ohne Nutzen. Neue Stellen zeigt das
//                           Lint-Log. Wie im Frontend: Parameter, die zur
//                           Signatur gehoeren, werden mit _ gekennzeichnet.
//   no-useless-assignment   Durchweg das Muster "erst null, dann im try
//                           gesetzt" (z. B. routes/events/checkin.js) --
//                           lesbar und harmlos.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    // uploads/ entsteht bei lokalen Laeufen und in Tests, gehoert nicht zum Code.
    ignores: ['node_modules/', 'uploads/', 'coverage/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      'no-useless-assignment': 'warn',
    },
  },
  {
    // Vitest laeuft mit `globals: true` (tests/vitest.config.ts): describe,
    // it, expect, vi usw. stehen ohne Import zur Verfuegung.
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  {
    // Die einzige Testdatei mit ESM-import in einer .js-Datei; Vitest
    // verkraftet das, ESLint braucht dafuer den sourceType.
    files: ['tests/services/pushKennungMitsenden.test.js'],
    languageOptions: {
      sourceType: 'module',
    },
  },
];
