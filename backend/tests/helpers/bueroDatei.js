// Echte, kleine Office-Dateien fuer die Upload-Tests -- im Test erzeugt statt
// als Binaerdatei eingecheckt.
//
// Eine .docx ist ein ZIP-Archiv mit [Content_Types].xml, _rels/.rels und
// word/document.xml. Dieser Schreiber legt die Eintraege deflate-komprimiert
// ab, mit CRC-32 und Zentralverzeichnis -- so, dass `unzip -t` sie als
// fehlerfrei meldet und Word sie oeffnet. Die Reihenfolge der Eintraege ist
// waehlbar: Word schreibt [Content_Types].xml zuerst, LibreOffice zuletzt.
// Das entscheidet, was file-type in den ersten 4.100 Bytes sieht
// (leseKopfBytes, utils/photoCrypto.js).

const zlib = require('zlib');
const crypto = require('crypto');

function zip(eintraege) {
  const lokal = [];
  const zentral = [];
  let versatz = 0;
  for (const [name, inhalt] of eintraege) {
    const daten = Buffer.isBuffer(inhalt) ? inhalt : Buffer.from(inhalt, 'utf8');
    const gepackt = zlib.deflateRawSync(daten);
    const crc = zlib.crc32(daten);
    const nameBytes = Buffer.from(name, 'utf8');

    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0); // Local file header
    kopf.writeUInt16LE(20, 4); // benoetigte Version
    kopf.writeUInt16LE(0, 6); // Flags
    kopf.writeUInt16LE(8, 8); // deflate
    kopf.writeUInt16LE(0, 10); // Uhrzeit
    kopf.writeUInt16LE(0x21, 12); // Datum 1980-01-01
    kopf.writeUInt32LE(crc, 14);
    kopf.writeUInt32LE(gepackt.length, 18);
    kopf.writeUInt32LE(daten.length, 22);
    kopf.writeUInt16LE(nameBytes.length, 26);
    kopf.writeUInt16LE(0, 28);
    lokal.push(kopf, nameBytes, gepackt);

    const verzeichnis = Buffer.alloc(46);
    verzeichnis.writeUInt32LE(0x02014b50, 0); // Central directory header
    verzeichnis.writeUInt16LE(20, 4);
    verzeichnis.writeUInt16LE(20, 6);
    verzeichnis.writeUInt16LE(0, 8);
    verzeichnis.writeUInt16LE(8, 10);
    verzeichnis.writeUInt16LE(0, 12);
    verzeichnis.writeUInt16LE(0x21, 14);
    verzeichnis.writeUInt32LE(crc, 16);
    verzeichnis.writeUInt32LE(gepackt.length, 20);
    verzeichnis.writeUInt32LE(daten.length, 24);
    verzeichnis.writeUInt16LE(nameBytes.length, 28);
    verzeichnis.writeUInt32LE(versatz, 42);
    zentral.push(verzeichnis, nameBytes);

    versatz += kopf.length + nameBytes.length + gepackt.length;
  }
  const verzeichnisBytes = Buffer.concat(zentral);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0); // End of central directory
  ende.writeUInt16LE(eintraege.length, 8);
  ende.writeUInt16LE(eintraege.length, 10);
  ende.writeUInt32LE(verzeichnisBytes.length, 12);
  ende.writeUInt32LE(versatz, 16);
  return Buffer.concat([...lokal, verzeichnisBytes, ende]);
}

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Default Extension="png" ContentType="image/png"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '</Types>';

const RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>';

const DOKUMENT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  + '<w:body><w:p><w:r><w:t>Einladung zur Konfi-Freizeit</w:t></w:r></w:p></w:body>'
  + '</w:document>';

/**
 * Eine Word-Datei in drei Bauweisen:
 *   'word'        -- [Content_Types].xml zuerst (so schreibt Word)
 *   'libreoffice' -- [Content_Types].xml zuletzt, davor ein grosses Bild
 *   'vorschau'    -- zuerst ein grosses Vorschaubild ausserhalb von word/
 * Das Bild ist Zufall und laesst sich kaum packen: Es schiebt alles Weitere
 * hinter die 4.100 Kopfbytes, die der Server prueft.
 */
function wordDatei(bauweise = 'word') {
  const bild = crypto.randomBytes(20000);
  if (bauweise === 'word') {
    return zip([['[Content_Types].xml', CONTENT_TYPES], ['_rels/.rels', RELS], ['word/document.xml', DOKUMENT]]);
  }
  if (bauweise === 'libreoffice') {
    return zip([['_rels/.rels', RELS], ['word/media/image1.png', bild], ['word/document.xml', DOKUMENT], ['[Content_Types].xml', CONTENT_TYPES]]);
  }
  if (bauweise === 'vorschau') {
    return zip([['docProps/thumbnail.jpeg', bild], ['[Content_Types].xml', CONTENT_TYPES], ['_rels/.rels', RELS], ['word/document.xml', DOKUMENT]]);
  }
  throw new Error(`Unbekannte Bauweise: ${bauweise}`);
}

/**
 * Kopf einer Tondatei im MP4-Behaelter (Sprachmemo, .m4a): ftyp-Box mit der
 * Marke "M4A ". file-type erkennt daran audio/x-m4a.
 */
function tonDatei() {
  const puffer = Buffer.alloc(64);
  puffer.writeUInt32BE(32, 0);
  puffer.write('ftypM4A ', 4, 'latin1');
  puffer.writeUInt32BE(0, 12);
  puffer.write('M4A isommp42', 16, 'latin1');
  puffer.writeUInt32BE(8, 32);
  puffer.write('free', 36, 'latin1');
  return puffer;
}

/** Kopf eines Windows-Programms (MZ ... PE), aufgefuellt auf 4.100 Bytes. */
function programmDatei() {
  const puffer = Buffer.alloc(4100);
  puffer.write('MZ', 0, 'latin1');
  puffer.writeUInt32LE(0x80, 0x3c);
  puffer.write('PE\0\0', 0x80, 'latin1');
  return puffer;
}

/**
 * Ein multipart-Koerper mit EINER Datei, deren Teil gar keine
 * Content-Type-Zeile traegt -- supertest/form-data setzt sonst immer einen
 * Typ (aus der Endung geraten). busboy gibt so einem Teil 'text/plain'.
 */
function multipartOhneTyp(feld, dateiname, inhalt, felder = {}) {
  const grenze = `----konfiquest${crypto.randomBytes(8).toString('hex')}`;
  const teile = [];
  for (const [name, wert] of Object.entries(felder)) {
    teile.push(Buffer.from(`--${grenze}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${wert}\r\n`));
  }
  teile.push(Buffer.from(`--${grenze}\r\nContent-Disposition: form-data; name="${feld}"; filename="${dateiname}"\r\n\r\n`));
  teile.push(inhalt);
  teile.push(Buffer.from(`\r\n--${grenze}--\r\n`));
  return { koerper: Buffer.concat(teile), typ: `multipart/form-data; boundary=${grenze}` };
}

const DOCX_TYP = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

module.exports = { zip, wordDatei, tonDatei, programmDatei, multipartOhneTyp, DOCX_TYP };
