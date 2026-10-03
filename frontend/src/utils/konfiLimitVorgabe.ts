// Vorgabe fuer das Konfi-Limit beim Anlegen und Umstellen einer Gemeinde --
// EINE Stelle fuer beide Formulare (Gemeinde anlegen/bearbeiten unter
// Gemeinden, Anlage aus einer Anfrage in der Support-Ansicht).
//
// Simon, 03.10.2026:
//   "Testphase 5 danach unbegrenzt. Das andere als Optionen solange es noch
//   nicht von der EKD gekauft ist."
//   "Die anderen Limits muessen aber erhalten bleiben. [...] Am Anfang
//   duerfen die die Limits auch auswaehlen. Bis die EKD wirklich zahlt. Also
//   die Leute waehlen ihre Wunsch[lizenz]!"
// Daraus:
//   - In der Testphase steht das Limit auf 5, wie auf der Startseite zugesagt
//     ("30 Tage kostenlos mit 5 Konfis testen").
//   - Danach steht es auf der Konfi-Zahl der Lizenz, die die Gemeinde im
//     Anfrageformular gewaehlt hat (utils/lizenzen.ts, lizenzLimit). Ohne
//     Wunsch -- oder beim Verbund, dessen Limit abgesprochen wird -- auf
//     unbegrenzt.
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
 * Das vorgegebene Limit als Formularwert: '5' in der Testphase, sonst das
 * Limit der Wunschlizenz (`lizenzLimit`, '' = unbegrenzt).
 */
export function limitVorgabe(testphase: boolean, lizenzLimit = ''): string {
  return testphase ? String(TESTPHASE_KONFIS) : lizenzLimit;
}

/**
 * Das Limit nach dem Umschalten zwischen Testphase und Lizenz. Steht es noch
 * auf der Vorgabe des alten Zustands, folgt es der des neuen; ein bewusst
 * gewaehlter Tarif bleibt stehen.
 */
export function limitNachUmschalten(aktuell: string, warTestphase: boolean, istTestphase: boolean, lizenzLimit = ''): string {
  if (warTestphase === istTestphase) return aktuell;
  return aktuell.trim() === limitVorgabe(warTestphase, lizenzLimit) ? limitVorgabe(istTestphase, lizenzLimit) : aktuell;
}
