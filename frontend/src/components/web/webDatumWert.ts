// Werte des Datumsfelds der Web-Fassung (WebDatum.tsx): dieselben lokalen
// Zeichenketten wie in den Formularen der App -- "2026-10-11" (Datum),
// "2026-10-11T18:30:00" (Datum und Uhrzeit, lokal ohne Zeitzone, wie
// toIonDatetimeISO in utils/terminVorbelegung.ts), "18:30" (Uhrzeit).

export type WebDatumArt = 'datum' | 'datumUhrzeit' | 'uhrzeit';

export const INPUT_TYP: Record<WebDatumArt, 'date' | 'datetime-local' | 'time'> = {
  datum: 'date',
  datumUhrzeit: 'datetime-local',
  uhrzeit: 'time',
};

/** Der Wert eines Formulars in der Form, die das Feld anzeigt. */
export const fuerFeld = (wert: string | null | undefined, art: WebDatumArt): string => {
  const w = (wert ?? '').trim();
  if (!w) return '';
  if (art === 'datum') return /^\d{4}-\d{2}-\d{2}/.test(w) ? w.slice(0, 10) : '';
  if (art === 'datumUhrzeit') return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(w) ? w.slice(0, 16) : '';
  const zeit = w.includes('T') ? w.split('T')[1] : w;
  return /^\d{2}:\d{2}/.test(zeit) ? zeit.slice(0, 5) : '';
};

/** Was das Feld liefert, in der Form der App-Formulare ("…T18:30:00"). */
export const ausFeld = (wert: string, art: WebDatumArt): string => {
  if (!wert) return '';
  if (art === 'datumUhrzeit') return wert.length === 16 ? `${wert}:00` : wert;
  return wert;
};
