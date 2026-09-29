#!/usr/bin/env node
/**
 * Prüft, was wirklich in der App landet (29.09.2026, Toolchain-Audit BF-02).
 *
 * Aufruf (aus frontend/):
 *   node scripts/app-buendel-pruefen.mjs                      prüft dist-app/
 *   node scripts/app-buendel-pruefen.mjs android/app/src/main/assets/public
 *   node scripts/app-buendel-pruefen.mjs ios/App/App/public
 *
 * Die Release-Workflows rufen es nach `npx cap sync` mit der Kopie im
 * nativen Projekt auf. Das ist die Gegenprobe zum Build selbst: Stünde in
 * capacitor.config.ts wieder `webDir: 'dist'`, wäre dist-app/ zwar sauber,
 * in der App lägen aber Handbuch und Webseiten — genau das meldet dieser
 * Schritt dann und hält das Release an.
 *
 * Regeln und Grenze stehen in scripts/app-buendel.mjs.
 */
import { join, resolve } from 'node:path';
import { APP_BUDGET_BYTES, APP_VERZEICHNIS, FRONTEND, alleDateien, appBuendelPruefen } from './app-buendel.mjs';
import { statSync } from 'node:fs';

const verzeichnisse = process.argv.slice(2);
if (verzeichnisse.length === 0) verzeichnisse.push(join(FRONTEND, APP_VERZEICHNIS));

let rot = false;
for (const angabe of verzeichnisse) {
  const verzeichnis = resolve(angabe);
  const fehler = appBuendelPruefen(verzeichnis, { publicVerzeichnis: join(FRONTEND, 'public') });
  if (fehler.length) {
    rot = true;
    console.error(`App-Bündel ${angabe}: ${fehler.length} Befund(e)`);
    // Die Grenze steht immer am Ende der Liste; bei einem Rückfall auf
    // dist/ kämen sonst über 80 Zeilen, die alle dasselbe sagen.
    const zeigen = fehler.length > 25 ? [...fehler.slice(0, 24), `… ${fehler.length - 25} weitere`, fehler.at(-1)] : fehler;
    for (const f of zeigen) console.error(`  ${f}`);
    continue;
  }
  const dateien = alleDateien(verzeichnis);
  const bytes = dateien.reduce((summe, pfad) => summe + statSync(join(verzeichnis, pfad)).size, 0);
  console.log(`App-Bündel ${angabe}: in Ordnung — ${dateien.length} Dateien, ${bytes} Bytes (Grenze ${APP_BUDGET_BYTES})`);
}
process.exit(rot ? 1 : 0);
