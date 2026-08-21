// Dateisystem-Helfer fuer hochgeladene Medien (Antrags-Nachweisfotos in
// uploads/requests/, Challenge-Beitraege in uploads/challenges/).
// Zentralisiert das Loeschen, damit alle Aufrufer (Konfi-Antrag-Loeschen,
// User-Loeschung, manuelles Admin-Loeschen, Orphan-Cleanup, Challenge-Beitrag
// zuruecknehmen) dieselbe sichere Logik verwenden.

const fs = require('fs');
const path = require('path');

const REQUESTS_DIR = path.join(__dirname, '../uploads/requests');
const CHALLENGES_DIR = path.join(__dirname, '../uploads/challenges');

// Loescht eine Datei aus einem der Upload-Verzeichnisse anhand des in der DB
// gespeicherten Dateinamens. Gibt true zurueck, wenn geloescht wurde, false
// wenn nichts zu tun war. Wirft NICHT — Fehler werden geloggt, damit ein
// fehlendes File nie eine DB-Operation (Antrag/User/Beitrag loeschen) blockiert.
async function deleteFileInDir(dir, filename, label) {
  if (!filename) return false;

  // Schutz gegen Path-Traversal: nur der reine Basename ist erlaubt.
  const safeName = path.basename(filename);
  if (safeName !== filename) {
    console.error(`${label}: verdaechtiger Dateiname abgewiesen:`, filename);
    return false;
  }

  const filePath = path.join(dir, safeName);
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false; // Datei existiert nicht (mehr) — kein Fehler
    }
    console.error(`${label}: Loeschen fehlgeschlagen fuer`, safeName, err.message);
    return false;
  }
}

async function deletePhotoFile(filename) {
  return deleteFileInDir(REQUESTS_DIR, filename, 'deletePhotoFile');
}

// Challenge-Beitraege (Foto/Audio/Video) liegen verschluesselt in
// uploads/challenges/ unter einem zufaelligen Hex-Namen.
async function deleteChallengeFile(filename) {
  return deleteFileInDir(CHALLENGES_DIR, filename, 'deleteChallengeFile');
}

module.exports = { deletePhotoFile, deleteChallengeFile, REQUESTS_DIR, CHALLENGES_DIR };
