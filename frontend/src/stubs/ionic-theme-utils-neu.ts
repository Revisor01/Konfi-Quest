/*
 * Ersatz-Eintritt fuer @rdlabo/ionic-theme-utils (24.09.2026).
 *
 * WARUM: Das Paket ist `"type": "module"`, aber sein dist/index.js macht
 *
 *   export { createIosTransitionAnimation, shadow } from './transition/ios.transition';
 *
 * OHNE Dateiendung. Bei ESM ist das ungueltig — Node verlangt dort die
 * vollstaendige Endung, findet die vorhandene ios.transition.js nicht und
 * bricht ab:
 *   Cannot find module '.../dist/transition/ios.transition'
 * Im Testlauf riss das App.test.tsx mit (0 Tests, die Datei laedt gar nicht).
 *
 * Das ist ein Fehler des Pakets, keine Eigenheit unserer Einrichtung. Diese
 * Datei reicht dieselben Ausfuhren weiter, nur mit vollstaendiger Endung.
 * Sie kann wieder weg, sobald das Paket es korrigiert (oder ueberhaupt in npm
 * veroeffentlicht ist — bislang existiert es nur als Git-Repository, siehe
 * frontend/.npmrc).
 */
// Absoluter Pfad ueber den Alias in vite.config.ts: Ein Zugriff per
// Paketname scheitert am `exports`-Feld von ionic-theme-ios26, das den
// Tiefenzugriff auf sein verschachteltes node_modules nicht freigibt
// ("is not exported under the conditions ...").
// @ts-expect-error -- kein Typ-Eintrag; die Ausfuhren stehen unten explizit.
export { createIosTransitionAnimation, shadow } from 'ionic-theme-utils-ios-transition';
