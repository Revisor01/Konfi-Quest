#!/usr/bin/env node
/**
 * Verwaiste Upload-Dateien finden (und auf Wunsch entfernen).
 *
 * Warum es das gibt: Bis zu den Löschfixes vom 26.08.2026 blieben Dateien
 * liegen, wenn ihr Datensatz verschwand — beim Ablehnen von Anträgen, beim
 * Löschen von Personen, beim Aufräumen von Chats. Die Fixes verhindern neue
 * Waisen, räumen den Altbestand aber nicht ab. Genau dafür ist dieses Skript.
 *
 * Es arbeitet in beide Richtungen, weil beide Fälle vorkommen:
 *   - WAISE:  Datei liegt auf der Platte, kein Datensatz verweist darauf.
 *   - FEHLEND: Ein Datensatz verweist auf eine Datei, die es nicht mehr gibt.
 * Die zweite Richtung löscht nichts, sie meldet nur — ein fehlender Anhang
 * ist ein Hinweis auf ein anderes Problem, kein Aufräumfall.
 *
 * Standardmäßig wird NICHTS gelöscht. Erst `--loeschen` entfernt Dateien,
 * und auch dann nur Waisen, die älter sind als `--mindestalter` Tage (Standard
 * 7). Das Mindestalter schützt frisch hochgeladene Dateien, deren Datensatz
 * gerade erst geschrieben wird.
 *
 * Aufruf:
 *   node scripts/verwaiste-dateien.mjs                    (nur berichten)
 *   node scripts/verwaiste-dateien.mjs --loeschen          (Waisen entfernen)
 *   node scripts/verwaiste-dateien.mjs --bereich chat      (nur ein Bereich)
 *   node scripts/verwaiste-dateien.mjs --mindestalter 30
 *   node scripts/verwaiste-dateien.mjs --uploads /pfad/zu/uploads
 *
 * Auf dem Server (die Uploads liegen im Container):
 *   docker exec -e DATABASE_URL=... konfi_quest-backend-1 \
 *     node scripts/verwaiste-dateien.mjs
 *
 * Braucht DATABASE_URL. Ohne die Variable bricht das Skript ab, statt gegen
 * eine falsche Datenbank zu laufen und danach echte Dateien zu löschen.
 */

import { readdir, stat, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const hatFlag = (name) => args.includes(`--${name}`);
const argWert = (name, standard) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : standard;
};

const LOESCHEN = hatFlag('loeschen');
const MINDESTALTER_TAGE = Number(argWert('mindestalter', '7'));
const UPLOADS = argWert('uploads', join(WURZEL, 'backend', 'uploads'));
const NUR_BEREICH = argWert('bereich', null);

if (!Number.isFinite(MINDESTALTER_TAGE) || MINDESTALTER_TAGE < 0) {
  console.error(`--mindestalter braucht eine Zahl >= 0, bekommen: ${argWert('mindestalter', '')}`);
  process.exit(1);
}

/**
 * Die vier Upload-Bereiche mit der Abfrage, die ALLE noch benutzten Dateinamen
 * liefert. Wichtig: Die Abfrage muss jede Zeile erfassen, die auf eine Datei
 * verweist — ein vergessener Filter würde eine benutzte Datei zur Waise
 * erklären und löschen lassen. Deshalb bewusst ohne WHERE auf Organisation,
 * Status oder Sichtbarkeit.
 *
 * Soft-gelöschte Chat-Nachrichten (`chat_messages.deleted_at` gesetzt) zählen
 * bewusst als benutzt: Ihre Dateien bleiben ABSICHTLICH liegen (Entscheidung
 * vom 26.08.2026 — Nachrichten-Löschen ist Soft-Delete, damit die Leitung
 * rechtlich relevante Inhalte wiederherstellen kann). Ein Filter auf
 * `deleted_at IS NULL` würde genau diese Dateien wegräumen und die
 * Wiederherstellung unmöglich machen. Deshalb steht er hier nicht.
 */
const BEREICHE = [
  {
    name: 'requests',
    verzeichnis: 'requests',
    beschreibung: 'Nachweisfotos zu Aktivitäts-Meldungen',
    abfrage: `SELECT photo_filename AS datei FROM activity_requests
              WHERE photo_filename IS NOT NULL AND photo_filename <> ''`,
  },
  {
    name: 'chat',
    verzeichnis: 'chat',
    beschreibung: 'Anhänge in Chat-Nachrichten',
    // Soft-gelöschte Nachrichten zählen mit: ihre Datei wird für eine
    // mögliche Wiederherstellung gebraucht.
    abfrage: `SELECT file_path AS datei FROM chat_messages
              WHERE file_path IS NOT NULL AND file_path <> ''`,
  },
  {
    name: 'challenges',
    verzeichnis: 'challenges',
    beschreibung: 'Beiträge zu Challenges',
    abfrage: `SELECT file_path AS datei FROM challenge_submissions
              WHERE file_path IS NOT NULL AND file_path <> ''`,
  },
  {
    name: 'material',
    verzeichnis: 'material',
    beschreibung: 'Material-Dateien',
    abfrage: `SELECT stored_name AS datei FROM material_files
              WHERE stored_name IS NOT NULL AND stored_name <> ''`,
  },
];

const zahl = (n) => n.toLocaleString('de-DE');
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function dateienImVerzeichnis(pfad) {
  try {
    const eintraege = await readdir(pfad, { withFileTypes: true });
    return eintraege.filter((e) => e.isFile()).map((e) => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return null; // Verzeichnis gibt es nicht
    throw err;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ist nicht gesetzt.');
    console.error('Ohne sie liefe das Skript gegen die falsche Datenbank und');
    console.error('würde danach echte Dateien löschen. Abbruch.');
    process.exit(1);
  }

  const bereiche = NUR_BEREICH
    ? BEREICHE.filter((b) => b.name === NUR_BEREICH)
    : BEREICHE;

  if (bereiche.length === 0) {
    console.error(`Unbekannter Bereich "${NUR_BEREICH}".`);
    console.error(`Möglich: ${BEREICHE.map((b) => b.name).join(', ')}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  console.log(LOESCHEN
    ? 'Verwaiste Upload-Dateien — LÖSCHMODUS'
    : 'Verwaiste Upload-Dateien — nur Bericht (löschen mit --loeschen)');
  console.log(`Uploads:      ${UPLOADS}`);
  console.log(`Mindestalter: ${MINDESTALTER_TAGE} Tage`);
  console.log('');

  const grenze = Date.now() - MINDESTALTER_TAGE * 24 * 60 * 60 * 1000;
  let waisenGesamt = 0;
  let bytesGesamt = 0;
  let geloeschtGesamt = 0;
  let fehlendGesamt = 0;

  try {
    for (const bereich of bereiche) {
      const verzeichnis = join(UPLOADS, bereich.verzeichnis);
      const dateien = await dateienImVerzeichnis(verzeichnis);

      console.log(`── ${bereich.name} (${bereich.beschreibung})`);

      if (dateien === null) {
        console.log('   Verzeichnis existiert nicht — übersprungen.');
        console.log('');
        continue;
      }

      const { rows } = await pool.query(bereich.abfrage);
      const benutzt = new Set(rows.map((r) => r.datei));

      // Richtung 1: Dateien ohne Datensatz.
      const waisen = [];
      let zuJung = 0;
      for (const name of dateien) {
        if (benutzt.has(name)) continue;
        const info = await stat(join(verzeichnis, name));
        if (info.mtimeMs > grenze) {
          zuJung += 1;
          continue;
        }
        waisen.push({ name, groesse: info.size, geaendert: info.mtime });
      }

      // Richtung 2: Datensätze ohne Datei. Wird nur gemeldet.
      const vorhanden = new Set(dateien);
      const fehlend = [...benutzt].filter((name) => !vorhanden.has(name));

      const bytes = waisen.reduce((s, w) => s + w.groesse, 0);
      waisenGesamt += waisen.length;
      bytesGesamt += bytes;
      fehlendGesamt += fehlend.length;

      console.log(`   Dateien auf der Platte: ${zahl(dateien.length)}`);
      console.log(`   Davon benutzt:          ${zahl(dateien.length - waisen.length - zuJung)}`);
      if (zuJung > 0) {
        console.log(`   Zu jung (geschont):     ${zahl(zuJung)}`);
      }
      console.log(`   Verwaist:               ${zahl(waisen.length)}${waisen.length ? ` (${mb(bytes)})` : ''}`);

      if (waisen.length > 0) {
        if (LOESCHEN) {
          let geloescht = 0;
          for (const waise of waisen) {
            try {
              await unlink(join(verzeichnis, waise.name));
              geloescht += 1;
            } catch (err) {
              // Eine nicht löschbare Datei kippt den Lauf nicht.
              console.log(`   NICHT löschbar: ${waise.name} (${err.code || err.message})`);
            }
          }
          geloeschtGesamt += geloescht;
          console.log(`   Gelöscht:               ${zahl(geloescht)}`);
        } else {
          for (const waise of waisen.slice(0, 10)) {
            const tag = waise.geaendert.toISOString().slice(0, 10);
            console.log(`      ${waise.name}  ${mb(waise.groesse)}  ${tag}`);
          }
          if (waisen.length > 10) console.log(`      ... und ${zahl(waisen.length - 10)} weitere`);
        }
      }

      if (fehlend.length > 0) {
        console.log(`   FEHLEND: ${zahl(fehlend.length)} Datensätze verweisen auf Dateien, die es nicht gibt.`);
        for (const name of fehlend.slice(0, 10)) console.log(`      ${name}`);
        if (fehlend.length > 10) console.log(`      ... und ${zahl(fehlend.length - 10)} weitere`);
      }

      console.log('');
    }

    console.log('───');
    console.log(`Verwaist gesamt: ${zahl(waisenGesamt)} Dateien (${mb(bytesGesamt)})`);
    if (fehlendGesamt > 0) {
      console.log(`Fehlend gesamt:  ${zahl(fehlendGesamt)} Datensätze ohne Datei — bitte ansehen.`);
    }
    if (LOESCHEN) {
      console.log(`Gelöscht:        ${zahl(geloeschtGesamt)} Dateien`);
    } else if (waisenGesamt > 0) {
      console.log('Nichts gelöscht. Zum Aufräumen mit --loeschen erneut aufrufen.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Abgebrochen:', err.message);
  process.exit(1);
});
