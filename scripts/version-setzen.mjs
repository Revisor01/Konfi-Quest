#!/usr/bin/env node
// Versionsnummern aus EINER Quelle setzen und prüfen.
//
// Quelle der Wahrheit ist frontend/version.json (App-Version, Android
// versionCode, iOS Build-Nummer). Dieses Skript zieht alles nach, was ihr
// folgen muss, und prüft den Gleichlauf:
//   - package.json + package-lock.json in Wurzel, frontend/ und backend/
//     (deshalb meldet GET /api/status die App-Version)
//   - die erste Versionsüberschrift im CHANGELOG
//   - MARKETING_VERSION im iOS-Projekt (apply-version.sh schreibt sie beim
//     Store-Build ebenfalls; hier steht sie, damit das Repo nicht lügt)
//
// Aufruf (aus der Repo-Wurzel):
//   npm run version:setzen -- 2.4.0                  App-Version überall setzen
//   npm run version:setzen -- 2.4.0 --android 125 --ios 231
//   npm run version:pruefen                           nur prüfen, Exit 1 bei Abweichung
//
// Warum ein Skript und kein Handgriff: Bis zum 27.09.2026 standen im Repo
// vier verschiedene App-Versionen (2.9.0, 0.0.1, 1.0.1 und 2.3.0), und
// /api/status meldete 1.0.1 auf einem 2.3.0-System (Audit, Sammelbefund S-13).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_JSON = join(WURZEL, 'frontend', 'version.json');
const PAKETE = ['.', 'frontend', 'backend'];
const CHANGELOG = join(WURZEL, 'CHANGELOG.md');
const PBXPROJ = join(WURZEL, 'frontend', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

const liesJson = (pfad) => JSON.parse(readFileSync(pfad, 'utf-8'));

/** Alle Stellen, die der Quelle folgen müssen, mit ihrem aktuellen Wert. */
export function versionsstaende(wurzel = WURZEL) {
  const quelle = liesJson(join(wurzel, 'frontend', 'version.json'));
  const staende = [{ stelle: 'frontend/version.json', wert: quelle.version }];
  for (const p of PAKETE) {
    const pj = join(wurzel, p, 'package.json');
    staende.push({ stelle: join(p, 'package.json'), wert: liesJson(pj).version });
    const lock = join(wurzel, p, 'package-lock.json');
    if (existsSync(lock)) {
      const l = liesJson(lock);
      staende.push({ stelle: join(p, 'package-lock.json'), wert: l.version });
      staende.push({ stelle: join(p, 'package-lock.json') + ' (packages[""])', wert: l.packages?.['']?.version });
    }
  }
  const changelog = readFileSync(join(wurzel, 'CHANGELOG.md'), 'utf-8');
  const m = changelog.match(/^## \[(?:Unreleased\] - |)(\d+\.\d+\.\d+)/m);
  staende.push({ stelle: 'CHANGELOG.md (erste Versionsüberschrift)', wert: m ? m[1] : undefined });
  const pbx = readFileSync(join(wurzel, 'frontend/ios/App/App.xcodeproj/project.pbxproj'), 'utf-8');
  const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((x) => x[1].trim());
  staende.push({ stelle: 'ios project.pbxproj (MARKETING_VERSION)', wert: marketing.length ? [...new Set(marketing)].join(', ') : undefined });
  return { quelle, staende };
}

export function pruefen(wurzel = WURZEL) {
  const { quelle, staende } = versionsstaende(wurzel);
  const abweichungen = staende.filter((s) => s.wert !== quelle.version);
  return { quelle, staende, abweichungen };
}

function setzen(version, { android, ios }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Keine gültige Version: ${version} (erwartet x.y.z)`);
  }
  const quelle = liesJson(VERSION_JSON);
  quelle.version = version;
  if (android !== undefined) quelle.androidVersionCode = android;
  if (ios !== undefined) quelle.iosBuildNumber = ios;
  writeFileSync(VERSION_JSON, JSON.stringify(quelle, null, 2) + '\n');
  for (const p of PAKETE) {
    // npm schreibt package.json UND package-lock.json; ohne Git-Tag, ohne Netz.
    execFileSync('npm', ['version', version, '--no-git-tag-version', '--allow-same-version', '--ignore-scripts'], {
      cwd: join(WURZEL, p), stdio: 'ignore',
    });
  }
  // iOS-Projekt: dieselbe Ersetzung wie apply-version.sh, damit das Repo den Stand trägt.
  const pbx = readFileSync(PBXPROJ, 'utf-8').replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  writeFileSync(PBXPROJ, pbx);
}

function ausgeben({ quelle, staende, abweichungen }) {
  console.log(`Quelle frontend/version.json: ${quelle.version} (Android ${quelle.androidVersionCode}, iOS ${quelle.iosBuildNumber})`);
  for (const s of staende) {
    const ok = s.wert === quelle.version ? '  ' : '!!';
    console.log(`${ok} ${s.stelle.padEnd(48)} ${s.wert}`);
  }
  if (abweichungen.length) {
    console.error(`\n${abweichungen.length} Abweichung(en) — mit \`npm run version:setzen -- ${quelle.version}\` gleichziehen.`);
  } else {
    console.log('\nAlle Stellen tragen dieselbe Version.');
  }
}

const istHauptmodul = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (istHauptmodul) {
  const args = process.argv.slice(2);
  const nurPruefen = args.includes('--pruefen');
  const version = args.find((a) => /^\d+\.\d+\.\d+$/.test(a));
  const zahl = (flag) => { const i = args.indexOf(flag); return i >= 0 ? parseInt(args[i + 1], 10) : undefined; };
  if (!nurPruefen) {
    if (!version) { console.error('Aufruf: version-setzen.mjs <x.y.z> [--android <code>] [--ios <build>] | --pruefen'); process.exit(2); }
    setzen(version, { android: zahl('--android'), ios: zahl('--ios') });
  }
  const ergebnis = pruefen();
  ausgeben(ergebnis);
  process.exit(ergebnis.abweichungen.length ? 1 : 0);
}
