import { fehlerDaten, type ApiFehlerAntwort } from './fehler';

/**
 * Wartende bestaetigen: bei vollem Event erst nachfragen, dann ueberbuchen
 * (Simon, 28.09.2026, Variante c: "Überbuchen ist gewollt, kann ja sein das
 * ich mehr brauche von der Warteliste").
 *
 * Der Server lehnt das Bestaetigen einer Wartenden bei vollem Event weiter ab
 * (400, error_code 'event_voll', dazu max und belegt) und nimmt es erst mit
 * `ueberbuchen: true` an -- still ueberbucht wird nicht. Die App fragt
 * dazwischen nach. Ablauf und Text stehen hier, damit sie sich ohne die
 * ganze Detailansicht pruefen lassen (__tests__/utils/ueberbuchen.test.ts).
 */

export interface UeberbuchenFrage {
  header: string;
  message: string;
}

export type BestaetigenErgebnis = 'bestaetigt' | 'ueberbucht' | 'abgebrochen';

/** Die Ablehnung "Event voll" erkennt die App am error_code, nicht am Text. */
export function istEventVoll(daten: ApiFehlerAntwort | undefined): boolean {
  return daten?.error_code === 'event_voll';
}

const zahl = (wert: unknown): number | undefined =>
  typeof wert === 'number' && Number.isFinite(wert) ? wert : undefined;

/** Rueckfrage mit Person, Plaetzen und der Folge. */
export function ueberbuchenFrage(name: string | undefined, daten: ApiFehlerAntwort | undefined): UeberbuchenFrage {
  const max = zahl(daten?.max);
  const belegt = zahl(daten?.belegt);
  const plaetze = max !== undefined ? `Alle ${max} Plätze sind vergeben` : 'Alle Plätze sind vergeben';
  const schonUeber = max !== undefined && belegt !== undefined && belegt > max ? `, ${belegt} sind bestätigt` : '';
  return {
    header: 'Das Event ist voll',
    message: `${plaetze}${schonUeber}. ${name || 'Diese Person'} trotzdem bestätigen? Das Event ist dann überbucht.`
  };
}

/**
 * Sendet das Bestaetigen; ist das Event voll, fragt es nach und sendet nach
 * dem Ja mit `ueberbuchen`. Jeder andere Fehler -- auch einer beim zweiten
 * Versuch -- geht unveraendert an den Aufrufer.
 *
 * @param senden  schickt den PUT, mit `ueberbuchen` = true nur nach dem Ja
 * @param fragen  zeigt die Rueckfrage, true = trotzdem bestaetigen
 */
export async function bestaetigenMitRueckfrage(
  senden: (ueberbuchen: boolean) => Promise<void>,
  fragen: (frage: UeberbuchenFrage) => Promise<boolean>,
  name?: string
): Promise<BestaetigenErgebnis> {
  try {
    await senden(false);
    return 'bestaetigt';
  } catch (err) {
    const daten = fehlerDaten(err);
    if (!istEventVoll(daten)) throw err;
    if (!(await fragen(ueberbuchenFrage(name, daten)))) return 'abgebrochen';
    await senden(true);
    return 'ueberbucht';
  }
}
