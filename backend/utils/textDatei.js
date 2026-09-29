// Text-Uploads auf ihren Inhalt pruefen (Audit Sicherheit BF-20, 29.09.2026).
//
// Chat und Material nehmen text/plain und text/csv an. Anders als Bilder,
// PDFs oder Office-Dateien haben Textdateien keine Magic Bytes, deshalb galt
// bis zum 29.09.2026 allein der angegebene Typ ("Header vertrauen"): Wer
// text/plain angab, legte beliebigen Inhalt ab -- auch eine HTML-Seite oder
// eine Programmdatei --, der dann als Datei der Gemeinde weitergereicht
// wurde. Die Auslieferung war schon entschaerft (nosniff, CSP script-src
// 'none', Material als attachment); jetzt wird auch der Inhalt geprueft:
//
//   - hoechstens TEXT_GRENZE Bytes (Chat erlaubt 5 MB, Material 20 MB fuer
//     alle Dateien; eine Textdatei dieser Groesse ist kein Handzettel mehr),
//   - keine Binaerdaten: kein NUL und keine Steuerzeichen ausser Tab,
//     Zeilenumbruch, Wagenruecklauf und Seitenvorschub,
//   - keine HTML- oder Skript-Signatur (<script, <html, <!doctype, <iframe,
//     <svg, <object, <embed), gleich in welcher Schreibweise.
//
// BEWUSST NICHT verlangt: gueltiges UTF-8. Eine CSV aus Excel unter Windows
// ist meist Windows-1252 (Umlaute als einzelne Bytes ueber 0x7F); sie ist
// Text und soll durchgehen. Geprueft wird die Signatur deshalb in beiden
// Lesarten: als UTF-8, wenn die Bytes gueltig sind, sonst als Latin-1.

const fs = require('fs');

const TEXT_MIMES = ['text/plain', 'text/csv'];
const TEXT_GRENZE = 2 * 1024 * 1024;
// Wie ein Browser ein Tag erkennt: "<" direkt vor dem Namen. "a < b" oder
// "<3" bleiben Text.
const VERDAECHTIG = /<(script|html|!doctype|iframe|svg|object|embed)\b/i;

function istTextTyp(mimetype) {
  return TEXT_MIMES.includes(mimetype);
}

function enthaeltBinaerdaten(puffer) {
  for (const b of puffer) {
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0c && b !== 0x0d) return true;
  }
  return false;
}

function alsText(puffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(puffer);
  } catch {
    return puffer.toString('latin1');
  }
}

/**
 * @param {string} pfad     Temporaerdatei aus dem Upload
 * @param {number} groesse  req.file.size
 * @returns {Promise<null | {status: number, error: string}>}  null = in Ordnung
 */
async function pruefeTextDatei(pfad, groesse) {
  if (groesse > TEXT_GRENZE) {
    return { status: 413, error: 'Textdatei ist zu groß (max. 2 MB).' };
  }
  const puffer = await fs.promises.readFile(pfad);
  if (puffer.length > TEXT_GRENZE) {
    return { status: 413, error: 'Textdatei ist zu groß (max. 2 MB).' };
  }
  if (enthaeltBinaerdaten(puffer)) {
    return { status: 415, error: 'Die Datei ist keine Textdatei.' };
  }
  if (VERDAECHTIG.test(alsText(puffer))) {
    return { status: 415, error: 'Textdateien mit HTML oder Skript werden nicht angenommen.' };
  }
  return null;
}

/**
 * Content-Type fuer die Auslieferung einer Textdatei: immer text/plain bzw.
 * text/csv mit charset, nie der beim Hochladen angegebene Wert. null, wenn es
 * keine Textdatei ist (Aufrufer behaelt dann seine Regel).
 */
function textInhaltsTyp({ mimetype = null, dateiname = null } = {}) {
  const endung = typeof dateiname === 'string' && dateiname.includes('.')
    ? dateiname.slice(dateiname.lastIndexOf('.')).toLowerCase()
    : '';
  if (mimetype === 'text/csv' || endung === '.csv') return 'text/csv; charset=utf-8';
  if (mimetype === 'text/plain' || endung === '.txt') return 'text/plain; charset=utf-8';
  return null;
}

module.exports = { TEXT_GRENZE, istTextTyp, pruefeTextDatei, textInhaltsTyp };
