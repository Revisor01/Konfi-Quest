// Eine Mail einsortieren: in einen bestehenden oder einen neuen Vorgang.
// App: components/support/SupportPostDetailPage.tsx (Abschnitt
// „Einsortieren"). Web: components/support/web/WebEinsortieren.tsx (Dialog).
// Die Logik steht in components/support/useEinsortieren.ts.

import { wahlen } from './beschreibung';
import { suchTreffer, suchbegriff } from '../utils/supportWeb';
import { VORGANG_STATUS, artKurz, type Vorgang } from '../utils/supportVorgaenge';

/** Wohin die Mail kommt. Vorgabe: ein bestehender Vorgang (useEinsortieren). */
export const EINSORTIEREN_IN = wahlen([
  { schluessel: 'bestehend', label: 'Bestehender Vorgang' },
  { schluessel: 'neu', label: 'Neuer Vorgang' },
]);
export const EINSORTIEREN_IN_BESCHRIFTUNG = 'Einsortieren in';

type VorgangKurz = Pick<Vorgang, 'id' | 'betreff' | 'gemeinde_name' | 'art' | 'status'>;

/** Ein Vorgang in der Auswahl: Titel und Beschreibung, wie beide Fassungen ihn zeigen. */
export const vorgangEintrag = (v: VorgangKurz) => ({
  wert: String(v.id),
  titel: `Nr. ${v.id} · ${v.betreff || '(ohne Betreff)'}`,
  beschreibung: `${v.gemeinde_name ?? 'Keine Gemeinde'} · ${artKurz(v.art)} · ${VORGANG_STATUS[v.status].kurz}`,
});

/**
 * Passt ein Vorgang zur Suche? Gesucht wird in allem, was die Auswahl zeigt
 * (Nummer, Betreff, Gemeinde, Art, Status) -- dieselbe Regel wie
 * WebAuswahlSuche im Browser. Bis 09.10.2026 suchte die App nur in Nummer,
 * Betreff und Gemeinde.
 */
export const vorgangPasstZurSuche = (v: VorgangKurz, suche: string): boolean => {
  if (!suchbegriff(suche)) return true;
  const e = vorgangEintrag(v);
  return suchTreffer(e.titel, suche).length > 0 || suchTreffer(e.beschreibung, suche).length > 0;
};
