// Wer hat die Anwesenheit eingetragen? (Migration 148, 13.09.2026)
//
// Simons Fall: In der Teilnehmerliste steht "Abgemeldet: krank, Mutter hat
// angerufen". Wer das aufgenommen hat, war nicht zu sehen -- bei einer
// Rueckfrage half der Eintrag dann nicht weiter. Die Zeile steht klein unter
// Grund und Notiz, ohne Tippen sichtbar (Entscheidung Simon).
//
// ZWEI URHEBER, GETRENNT GEFUEHRT (Migration 149, 13.09.2026):
// Simons Rueckfrage: "Was ist wenn einer einen Vermerk schreibt und einer den
// Grund. Wie wird das angezeigt." Mit einem gemeinsamen Urheber gar nicht --
// wer zuletzt schrieb, ueberschrieb den anderen, und die Zeile behauptete,
// er habe beides eingetragen. Seither gilt attendance_set_by fuer den STATUS
// samt Abmeldegrund und note_set_by fuer die NOTIZ. Jede Zeile nennt ihren
// eigenen Urheber, klein darunter.
//
// NULL HEISST UNBEKANNT, NICHT NIEMAND: Buchungen von vor der Migration und
// Selbst-Check-ins per QR-Code tragen keinen Urheber. Dann faellt die Zeile
// ersatzlos weg -- "Eingetragen von unbekannt" behauptet mehr, als bekannt
// ist, und stuende unter jedem alten Eintrag.
//
// WOHER DIE ANWESENHEIT KAM (Migration 151, 15.09.2026): Genau dieses
// ersatzlose Wegfallen war beim QR-Check-in zu viel des Guten. Dort ist
// naemlich sehr wohl etwas bekannt -- nur eben keine Person. Die Quelle
// (checkin_quelle) sagt es ohne Namen, und checkinZeile() macht daraus
// "Eingecheckt per QR-Code, 15.09.". Der Altbestand bleibt ohne jede Zeile.

export interface UrheberAngabe {
  attendance_set_by_name?: string | null;
  attendance_set_at?: string | null;
  note_set_by_name?: string | null;
  note_set_at?: string | null;
  checkin_quelle?: string | null;
  checked_in_at?: string | null;
}

/**
 * Die Absage haengt am TERMIN, nicht an einer Buchung -- deshalb ein eigener
 * Typ und nicht zwei weitere Felder in UrheberAngabe. Ein Event ist keine
 * Buchung, und die vier Felder oben haben an ihm keine Bedeutung.
 */
export interface AbsageAngabe {
  cancelled_by_name?: string | null;
  cancelled_at?: string | null;
}

/**
 * Die Zeile unter Status und Grund, z. B. "Eingetragen von Simon Luthe, 13.09."
 * oder ohne Datum, wenn nur der Name bekannt ist.
 *
 * Gibt null zurueck, wenn kein Name vorliegt. Ohne Namen gibt es nichts zu
 * sagen: Ein blosses Datum beantwortet die Frage "wer war das?" nicht.
 */
export const urheberZeile = (angabe: UrheberAngabe | null | undefined): string | null =>
  zeile('Eingetragen von', angabe?.attendance_set_by_name, angabe?.attendance_set_at);

/**
 * Die Zeile unter der Notiz, z. B. "Notiz von Anna Meier, 13.09."
 *
 * Eigener Wortlaut statt "Eingetragen von": Stehen beide Zeilen untereinander
 * -- weil verschiedene Leute Status und Notiz geschrieben haben --, muss auf
 * einen Blick klar sein, welcher Name zu welchem Eintrag gehoert.
 */
export const notizUrheberZeile = (angabe: UrheberAngabe | null | undefined): string | null =>
  zeile('Notiz von', angabe?.note_set_by_name, angabe?.note_set_at);

/**
 * Die Zeile bei einem Selbst-Check-in, z. B. "Eingecheckt per QR-Code, 15.09."
 *
 * WARUM UEBERHAUPT EINE ZEILE: Beim QR-Check-in bleibt der Urheber bewusst
 * leer (Migration 148) -- die Konfi checkt sich SELBST ein, "Eingetragen von
 * Emilia" laese sich wie eine Leitungsentscheidung. Damit stand der
 * Selbst-Check-in aber im selben Nichts wie der Altbestand von vor der
 * Migration: zweimal gar keine Zeile, obwohl im einen Fall bekannt ist, was
 * passiert ist. Diese Zeile schliesst die Luecke, ohne jemanden zu benennen.
 *
 * WARUM DIESER WORTLAUT: "Eingecheckt per QR-Code, 15.09." statt "Checkin via
 * QR-Code am 15.09.". Die Zeile steht unmittelbar neben "Eingetragen von
 * Simon Luthe, 13.09." und "Notiz von Anna Meier, 13.09." -- alle drei
 * beginnen deshalb mit einem deutschen Partizip und enden auf ", TT.MM.".
 * "Checkin via ... am ..." braeche in derselben kurzen Zeile gleich zweimal
 * aus (Anglizismus, anderer Datumsanschluss) und laese die drei Zeilen
 * auseinanderfallen, obwohl sie dasselbe beantworten.
 *
 * Gibt null zurueck, wenn die Quelle nicht 'qr' ist: Bei einem manuellen
 * Eintrag steht der Name schon in urheberZeile(), und beim Altbestand ist
 * nichts bekannt. Zwei Zeilen untereinander wuerden sich sonst widersprechen.
 */
export const checkinZeile = (angabe: UrheberAngabe | null | undefined): string | null => {
  if (angabe?.checkin_quelle !== 'qr') return null;
  return mitDatum('Eingecheckt per QR-Code', angabe?.checked_in_at);
};

/**
 * Wer den TERMIN abgesagt hat, z. B. "Abgesagt von Simon Luthe, 15.09."
 * (Migration 150, 15.09.2026).
 *
 * WARUM HIER UND NICHT IN EINER EIGENEN DATEI: Die Frage ist dieselbe wie bei
 * den drei Zeilen darueber -- "wer war das, und wann?" --, und die Antwort
 * steht an derselben Stelle im Bild: klein, leise, direkt unter dem Grund.
 * Ein zweiter Ort mit demselben Format liefe frueher oder spaeter
 * auseinander; kurzesDatum() und mitDatum() sind schon hier.
 *
 * DER BEZUG IST EIN ANDERER, DER WORTLAUT DESHALB AUCH: Die drei Zeilen
 * darueber haengen an der Buchung EINER Person ("Abgemeldet: krank"), diese
 * am Termin selbst. "Abgesagt von ..." statt "Eingetragen von ..." macht das
 * ohne Umschweife klar -- und unterscheidet sich hoerbar von "Abgesagt von
 * dir", was in der Teamer-Ansicht die eigene Absage MEINT (die eigene
 * Teilnahme, nicht den Termin).
 *
 * Gibt null zurueck, wenn kein Name vorliegt: Termine, die vor Migration 150
 * abgesagt wurden, haben keinen Urheber -- die Zeile faellt dann ersatzlos
 * weg, statt "Abgesagt von unbekannt" zu behaupten.
 */
export const absageUrheberZeile = (angabe: AbsageAngabe | null | undefined): string | null =>
  zeile('Abgesagt von', angabe?.cancelled_by_name, angabe?.cancelled_at);

const zeile = (
  vorspann: string,
  name: string | null | undefined,
  zeitstempel: string | null | undefined
): string | null => {
  const sauber = name?.trim();
  if (!sauber) return null;

  return mitDatum(`${vorspann} ${sauber}`, zeitstempel);
};

/**
 * Haengt ", 13.09." an, falls der Zeitstempel lesbar ist. Ein unlesbarer
 * faellt weg -- die Aussage der Zeile haengt nicht am Datum.
 */
const mitDatum = (text: string, zeitstempel: string | null | undefined): string => {
  const datum = kurzesDatum(zeitstempel);
  return datum ? `${text}, ${datum}` : text;
};

/**
 * Tag und Monat, mehr nicht ("13.09."). Das Jahr wuerde die Zeile laenger
 * machen, ohne etwas beizutragen -- sie steht an einem Termin, dessen Datum
 * eine Zeile darueber schon sichtbar ist.
 *
 * Ein unlesbarer Zeitstempel fuehrt zu null statt zu "Invalid Date": lieber
 * nur der Name als eine kaputte Angabe.
 */
const kurzesDatum = (zeitstempel: string | null | undefined): string | null => {
  if (!zeitstempel) return null;
  const d = new Date(zeitstempel);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};
