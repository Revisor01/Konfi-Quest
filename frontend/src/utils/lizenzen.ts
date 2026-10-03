// Die Lizenzen von Konfi Quest fuer die Oberflaeche (03.10.2026).
//
// Simon, 03.10.2026: Die Gemeinde waehlt im Anfrageformular ihre
// Wunschlizenz; die Tarife bleiben, bis die EKD zahlt. Dieselbe Liste wie
// backend/utils/lizenzen.js -- src/__tests__/utils/lizenzen.test.ts haelt
// beide gleich. Namen, Grenzen und Preise wie auf der Startseite.

/** Schluessel einer Lizenz (gemeinde_anfragen.wunsch_lizenz). */
export type LizenzSchluessel = 'klein' | 'standard' | 'plus' | 'gross' | 'verbund';

export interface Lizenz {
  schluessel: LizenzSchluessel;
  name: string;
  /** Konfi-Grenze; null beim Verbund (bis 4 Gemeinden, Limit nach Absprache). */
  konfis: number | null;
  euro: number;
}

export const LIZENZEN: readonly Lizenz[] = [
  { schluessel: 'klein', name: 'Klein', konfis: 15, euro: 49 },
  { schluessel: 'standard', name: 'Standard', konfis: 50, euro: 99 },
  { schluessel: 'plus', name: 'Plus', konfis: 75, euro: 139 },
  { schluessel: 'gross', name: 'Groß', konfis: 100, euro: 179 },
  { schluessel: 'verbund', name: 'Verbund', konfis: null, euro: 390 },
];

/** Die Lizenz zu einem Schluessel -- oder null (keine Angabe, unbekannt). */
export function lizenzFinden(schluessel: string | null | undefined): Lizenz | null {
  return LIZENZEN.find((l) => l.schluessel === schluessel) ?? null;
}

/** "Standard — bis 50 Konfis", "Verbund — bis 4 Gemeinden". */
export function lizenzText(lizenz: Lizenz): string {
  return `${lizenz.name} — ${lizenz.konfis === null ? 'bis 4 Gemeinden' : `bis ${lizenz.konfis} Konfis`}`;
}

/**
 * Das Konfi-Limit einer Lizenz als Formularwert: '50' fuer Standard, ''
 * (unbegrenzt) ohne Lizenz und beim Verbund, dessen Limit abgesprochen wird.
 */
export function lizenzLimit(schluessel: string | null | undefined): string {
  const lizenz = lizenzFinden(schluessel);
  return lizenz && lizenz.konfis !== null ? String(lizenz.konfis) : '';
}

/** Eine Zeile der Tarif-Auswahl: Formularwert ('' = unbegrenzt) und Text mit Preis. */
export interface TarifOption {
  wert: string;
  name: string;
  text: string;
}

/** Wert der Auswahl fuer "Eigenes Limit …" (Zahlenfeld statt Tarif). */
export const EIGENES_LIMIT = '__eigen__';

/**
 * Die Tarif-Auswahl beider Formulare (Gemeinde, Anlage aus einer Anfrage),
 * mit Preis (Simon, 03.10.2026: "bei der Auswahl muss auch der Preis mit
 * stehen"). Testphase 5 kostenlos, die Lizenzen mit fester Konfi-Zahl und
 * Unbegrenzt -- das bleibt immer waehlbar ("Unbegrenzt will ich aber setzen
 * koennen", etwa fuer die eigene Gemeinde). Der Verbund hat keine feste
 * Zahl und steht deshalb nicht darin; sein Limit ist Unbegrenzt oder ein
 * eigenes.
 */
export const TARIF_OPTIONEN: readonly TarifOption[] = [
  { wert: '5', name: 'Testphase', text: 'Testphase — bis 5 Konfis · kostenlos, 30 Tage' },
  ...LIZENZEN.filter((l) => l.konfis !== null).map((l) => ({
    wert: String(l.konfis),
    name: l.name,
    text: `${l.name} — bis ${l.konfis} Konfis · ${l.euro} € pro Jahr`,
  })),
  { wert: '', name: 'Unbegrenzt', text: 'Unbegrenzt — ohne Konfi-Grenze' },
];

/** Steht ein Limit auf einem Tarif der Auswahl (sonst: eigenes Limit)? */
export function istTarif(limit: string): boolean {
  return TARIF_OPTIONEN.some((t) => t.wert === limit.trim());
}
