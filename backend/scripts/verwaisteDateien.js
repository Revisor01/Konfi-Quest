// backend/scripts/verwaisteDateien.js
//
// Verwaiste Upload-Dateien finden -- und nur auf ausdruecklichen Wunsch
// entfernen. EIN Skript fuer die vier Upload-Bereiche (02.10.2026).
//
// Bis dahin gab es zwei, die dasselbe unterschiedlich taten:
//   - das fruehere scripts/cleanupOrphanPhotos.js (im Image) loeschte ohne Schalter
//     SOFORT und ohne Altersschutz: Eine Datei, deren Zeile die Route gerade
//     erst schreibt, war schon weg. Nur mit --dry-run blieb alles liegen.
//   - das fruehere scripts/verwaiste-dateien.mjs (Repo-Wurzel) berichtete
//     nur, schonte junge Dateien und meldete auch die Gegenrichtung -- lag
//     aber nicht im Image und liess sich im Container gar nicht aufrufen.
// Jetzt eines, mit dem sicheren Verhalten, im Image.
//
// Warum es das gibt: Bis zu den Loeschfixes vom 26.08.2026 blieben Dateien
// liegen, wenn ihr Datensatz verschwand (abgelehnte Antraege, geloeschte
// Personen, aufgeraeumte Chats), dazu Reste aus Loeschpfaden, die mittendrin
// abbrachen. uploads/challenges/ seit 29.09.2026 (Audit Sicherheit BF-19):
// Eine Challenge-Datei wird nur ueber ihre Zeile in challenge_submissions
// ausgeliefert -- ohne Zeile ist sie nicht mehr erreichbar, nur gespeichert.
//
// Zwei Richtungen:
//   WAISE    Datei liegt auf der Platte, keine Zeile verweist darauf.
//   FEHLEND  Eine Zeile verweist auf eine Datei, die es nicht gibt. Wird nur
//            gemeldet: Ein fehlender Anhang ist ein Hinweis auf ein anderes
//            Problem, kein Aufraeumfall.
//
// STANDARD: NUR BERICHT. Erst --loeschen entfernt Waisen, und auch dann nur
// solche, die aelter sind als --mindestalter Tage (Standard 7) -- eine frisch
// hochgeladene Datei liegt kurz ohne Zeile da.
//
// Aufruf IM BACKEND-CONTAINER (DATABASE_URL steht dort schon):
//   docker exec <backend-container> node scripts/verwaisteDateien.js
//   docker exec <backend-container> node scripts/verwaisteDateien.js --loeschen
//   ... --bereich chat          nur ein Bereich
//   ... --mindestalter 30       Altersgrenze in Tagen (0 = jede Waise)
//   ... --uploads /pfad         anderes Upload-Verzeichnis (Standard: uploads/)
// Ohne DATABASE_URL bricht es ab, statt gegen eine falsche Datenbank zu
// laufen und danach echte Dateien zu loeschen. Eine unbekannte Angabe bricht
// ebenso ab (ein vertippter Schalter soll nicht still etwas anderes tun).
//
// Eigener Pool (NICHT database.js importieren -- das wuerde Migrationen starten).

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const STANDARD_UPLOADS = path.join(__dirname, '..', 'uploads');
const STANDARD_MINDESTALTER_TAGE = 7;
const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * Die vier Upload-Bereiche mit der Abfrage, die ALLE noch benutzten
 * Dateinamen liefert. Die Abfrage muss jede Zeile erfassen, die auf eine
 * Datei verweist -- ein vergessener Filter erklaerte eine benutzte Datei zur
 * Waise. Deshalb bewusst ohne Bedingung auf Gemeinde, Status oder
 * Sichtbarkeit.
 *
 * Soft-geloeschte Chat-Nachrichten (deleted_at gesetzt) zaehlen als benutzt:
 * Ihre Dateien bleiben ABSICHTLICH liegen (Entscheidung 26.08.2026 --
 * Nachrichten-Loeschen ist Soft-Delete, damit die Leitung rechtlich
 * relevante Inhalte wiederherstellen kann). Ein Filter auf
 * `deleted_at IS NULL` raeumte genau diese Dateien weg.
 */
const BEREICHE = [
  {
    name: 'requests',
    beschreibung: 'Nachweisfotos zu Aktivitäts-Meldungen',
    abfrage: `SELECT photo_filename AS datei FROM activity_requests
              WHERE photo_filename IS NOT NULL AND photo_filename <> ''`,
  },
  {
    name: 'chat',
    beschreibung: 'Anhänge in Chat-Nachrichten',
    abfrage: `SELECT file_path AS datei FROM chat_messages
              WHERE file_path IS NOT NULL AND file_path <> ''`,
  },
  {
    name: 'material',
    beschreibung: 'Material-Dateien',
    abfrage: `SELECT stored_name AS datei FROM material_files
              WHERE stored_name IS NOT NULL AND stored_name <> ''`,
  },
  {
    name: 'challenges',
    beschreibung: 'Beiträge zu Challenges',
    abfrage: `SELECT file_path AS datei FROM challenge_submissions
              WHERE file_path IS NOT NULL AND file_path <> ''`,
  },
];

/**
 * Kommandozeile lesen. Wirft bei allem, was es nicht kennt.
 *
 * @param {string[]} argv  ohne node und Skriptpfad
 * @returns {{loeschen: boolean, mindestalterTage: number, bereich: string|null, uploads: string}}
 */
function argumenteLesen(argv) {
  const angaben = {
    loeschen: false,
    mindestalterTage: STANDARD_MINDESTALTER_TAGE,
    bereich: null,
    uploads: STANDARD_UPLOADS,
  };
  const wert = (i, schalter) => {
    const w = argv[i + 1];
    if (w === undefined || w.startsWith('--')) throw new Error(`${schalter} braucht einen Wert`);
    return w;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--loeschen') {
      angaben.loeschen = true;
    } else if (a === '--mindestalter') {
      const w = wert(i, a);
      const tage = Number(w);
      if (w.trim() === '' || !Number.isFinite(tage) || tage < 0) {
        throw new Error(`--mindestalter braucht eine Zahl >= 0, bekommen: ${w}`);
      }
      angaben.mindestalterTage = tage;
      i++;
    } else if (a === '--bereich') {
      const w = wert(i, a);
      if (!BEREICHE.some((b) => b.name === w)) {
        throw new Error(`Unbekannter Bereich "${w}". Möglich: ${BEREICHE.map((b) => b.name).join(', ')}`);
      }
      angaben.bereich = w;
      i++;
    } else if (a === '--uploads') {
      angaben.uploads = path.resolve(wert(i, a));
      i++;
    } else {
      throw new Error(`Unbekannte Angabe "${a}". Möglich: --loeschen, --mindestalter <Tage>, --bereich <Name>, --uploads <Pfad>`);
    }
  }
  return angaben;
}

/**
 * Einen Bereich pruefen und -- nur mit loeschen -- seine alten Waisen
 * entfernen.
 *
 * @param {{query: Function}} pool
 * @param {object} bereich  ein Eintrag aus BEREICHE
 * @param {object} optionen
 * @param {string} optionen.uploads
 * @param {boolean} [optionen.loeschen=false]
 * @param {number} [optionen.mindestalterTage=7]
 * @param {number} [optionen.jetzt=Date.now()]
 */
async function bereichPruefen(pool, bereich, {
  uploads, loeschen = false, mindestalterTage = STANDARD_MINDESTALTER_TAGE, jetzt = Date.now(),
}) {
  const verzeichnis = path.join(uploads, bereich.name);
  let namen;
  try {
    const eintraege = await fs.promises.readdir(verzeichnis, { withFileTypes: true });
    namen = eintraege.filter((e) => e.isFile()).map((e) => e.name).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return { bereich: bereich.name, verzeichnis, vorhanden: false };
    throw err;
  }

  const { rows } = await pool.query(bereich.abfrage);
  const benutzt = new Set(rows.map((r) => r.datei));
  const grenze = jetzt - mindestalterTage * TAG_MS;

  const waisen = [];
  const zuJung = [];
  let bytes = 0;
  for (const name of namen) {
    if (benutzt.has(name)) continue;
    const info = await fs.promises.stat(path.join(verzeichnis, name));
    if (info.mtimeMs > grenze) {
      zuJung.push(name);
      continue;
    }
    waisen.push({ name, groesse: info.size, geaendert: info.mtime });
    bytes += info.size;
  }

  const aufPlatte = new Set(namen);
  const fehlend = [...benutzt].filter((name) => !aufPlatte.has(name)).sort();

  const geloescht = [];
  const nichtLoeschbar = [];
  if (loeschen) {
    for (const waise of waisen) {
      try {
        await fs.promises.unlink(path.join(verzeichnis, waise.name));
        geloescht.push(waise.name);
      } catch (err) {
        // Eine nicht loeschbare Datei kippt den Lauf nicht.
        nichtLoeschbar.push({ name: waise.name, fehler: err.code || err.message });
      }
    }
  }

  return {
    bereich: bereich.name,
    verzeichnis,
    vorhanden: true,
    dateien: namen.length,
    benutzt: namen.length - waisen.length - zuJung.length,
    zuJung,
    waisen,
    bytes,
    fehlend,
    geloescht,
    nichtLoeschbar,
  };
}

const zahl = (n) => n.toLocaleString('de-DE');
const dateienText = (n) => `${zahl(n)} Datei${n === 1 ? '' : 'en'}`;
const mb = (b) => `${(b / 1024 / 1024).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;

function berichten(bereich, e, { loeschen, log }) {
  log(`-- ${e.bereich} (${bereich.beschreibung})`);
  if (!e.vorhanden) {
    log(`   ${e.verzeichnis} existiert nicht – übersprungen.`);
    log('');
    return;
  }
  log(`   Dateien auf der Platte: ${zahl(e.dateien)}`);
  log(`   Davon benutzt:          ${zahl(e.benutzt)}`);
  if (e.zuJung.length > 0) log(`   Zu jung (geschont):     ${zahl(e.zuJung.length)}`);
  log(`   Verwaist:               ${zahl(e.waisen.length)}${e.waisen.length ? ` (${mb(e.bytes)})` : ''}`);
  if (loeschen) {
    if (e.waisen.length > 0) log(`   Gelöscht:               ${zahl(e.geloescht.length)}`);
    for (const n of e.nichtLoeschbar) log(`   NICHT löschbar: ${n.name} (${n.fehler})`);
  } else {
    for (const w of e.waisen.slice(0, 10)) {
      log(`      ${w.name}  ${mb(w.groesse)}  ${w.geaendert.toISOString().slice(0, 10)}`);
    }
    if (e.waisen.length > 10) log(`      ... und ${zahl(e.waisen.length - 10)} weitere`);
  }
  if (e.fehlend.length > 0) {
    log(`   FEHLEND: ${zahl(e.fehlend.length)} Datensätze verweisen auf Dateien, die es nicht gibt.`);
    for (const name of e.fehlend.slice(0, 10)) log(`      ${name}`);
    if (e.fehlend.length > 10) log(`      ... und ${zahl(e.fehlend.length - 10)} weitere`);
  }
  log('');
}

/**
 * Der ganze Lauf. Gibt den Exit-Code zurueck, statt den Prozess zu beenden
 * (testbar).
 *
 * @param {string[]} argv
 * @param {{env?: object, log?: Function, fehler?: Function}} [umgebung]
 * @returns {Promise<number>} 0 = gelaufen, 1 = abgebrochen
 */
async function main(argv, { env = process.env, log = console.log, fehler = console.error } = {}) {
  let angaben;
  try {
    angaben = argumenteLesen(argv);
  } catch (err) {
    fehler(err.message);
    return 1;
  }
  if (!env.DATABASE_URL) {
    fehler('DATABASE_URL ist nicht gesetzt. Ohne sie liefe das Skript gegen eine falsche');
    fehler('Datenbank und würde danach echte Dateien löschen. Abbruch.');
    return 1;
  }

  const bereiche = angaben.bereich ? BEREICHE.filter((b) => b.name === angaben.bereich) : BEREICHE;
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  log(angaben.loeschen
    ? 'Verwaiste Upload-Dateien – LÖSCHMODUS'
    : 'Verwaiste Upload-Dateien – nur Bericht (löschen mit --loeschen)');
  log(`Uploads:      ${angaben.uploads}`);
  log(`Mindestalter: ${angaben.mindestalterTage} Tage`);
  log('');

  let waisen = 0;
  let bytes = 0;
  let geloescht = 0;
  let fehlend = 0;
  try {
    for (const bereich of bereiche) {
      const e = await bereichPruefen(pool, bereich, angaben);
      berichten(bereich, e, { loeschen: angaben.loeschen, log });
      if (!e.vorhanden) continue;
      waisen += e.waisen.length;
      bytes += e.bytes;
      geloescht += e.geloescht.length;
      fehlend += e.fehlend.length;
    }
  } finally {
    await pool.end();
  }

  log('---');
  log(`Verwaist gesamt: ${dateienText(waisen)} (${mb(bytes)})`);
  if (fehlend > 0) log(`Fehlend gesamt:  ${zahl(fehlend)} Datensätze ohne Datei – bitte ansehen.`);
  if (angaben.loeschen) {
    log(`Gelöscht:        ${dateienText(geloescht)}`);
  } else if (waisen > 0) {
    log('Nichts gelöscht. Zum Aufräumen mit --loeschen erneut aufrufen.');
  }
  return 0;
}

// Nur als Skript starten, nicht beim require aus einem Test.
if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (err) => {
      console.error('Abgebrochen:', err.message);
      process.exitCode = 1;
    }
  );
}

module.exports = { BEREICHE, STANDARD_MINDESTALTER_TAGE, argumenteLesen, bereichPruefen, main };
