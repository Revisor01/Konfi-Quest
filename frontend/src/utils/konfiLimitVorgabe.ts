// Vorgabe fuer das Konfi-Limit beim Anlegen und Umstellen einer Gemeinde --
// EINE Stelle fuer beide Formulare (Gemeinde anlegen/bearbeiten unter
// Gemeinden, Anlage aus einer Anfrage in der Support-Ansicht).
//
// Simon, 03.10.2026: "Testphase 5 danach unbegrenzt. Das andere als Optionen
// solange es noch nicht von der EKD gekauft ist."
//   - In der Testphase steht das Limit auf 5, wie auf der Startseite zugesagt
//     ("30 Tage kostenlos mit 5 Konfis testen").
//   - Danach (Lizenz oder ohne Ablaufdatum) steht es auf unbegrenzt.
//   - Die Tarif-Stufen 15/50/75/100 und ein eigenes Limit bleiben waehlbar.
//
// Es ist eine VORGABE, keine Durchsetzung: Wer bewusst einen Tarif waehlt,
// behaelt ihn auch beim Umschalten. Nur ein Limit, das noch auf der Vorgabe
// des alten Zustands steht, folgt dem neuen. Der Server legt nichts fest
// (backend/utils/gemeindeAnlegen.js, konfiLimitLesen): Er speichert, was das
// Formular schickt.

/** Konfi-Limit in der Testphase. */
export const TESTPHASE_KONFIS = 5;

/**
 * Das vorgegebene Limit als Formularwert: '5' in der Testphase, sonst ''
 * (leer = unbegrenzt).
 */
export function limitVorgabe(testphase: boolean): string {
  return testphase ? String(TESTPHASE_KONFIS) : '';
}

/**
 * Das Limit nach dem Umschalten zwischen Testphase und Lizenz. Steht es noch
 * auf der Vorgabe des alten Zustands, folgt es der des neuen; ein bewusst
 * gewaehlter Tarif bleibt stehen.
 */
export function limitNachUmschalten(aktuell: string, warTestphase: boolean, istTestphase: boolean): string {
  if (warTestphase === istTestphase) return aktuell;
  return aktuell.trim() === limitVorgabe(warTestphase) ? limitVorgabe(istTestphase) : aktuell;
}
