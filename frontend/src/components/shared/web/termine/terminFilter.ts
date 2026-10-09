// Die Filter der Listen von Mitmachen bei Konfis und Team (Web-Fassung,
// 03.10.2026) -- auch als `?filter=` in der Adresse vorgebbar. Schlüssel,
// Beschriftung und Reihenfolge stehen seit 09.10.2026 in der gemeinsamen
// Beschreibung für App und Web (seiten/mitmachenMitglied.ts); hier nur die
// Typen und die erlaubten Werte der Adresse daraus.

import { schluesselIn } from '../../../../seiten/beschreibung';
import { EIGENE_ANTRAG_STATUS, KONFI_EVENTS, MITGLIED_BEREICHE, TEAM_EVENTS } from '../../../../seiten/mitmachenMitglied';

/** Eigene Aktivitaeten (Konfis und Team): Offen, Angerechnet, Abgelehnt, Alle. */
export type EigenerAntragFilter = (typeof EIGENE_ANTRAG_STATUS)[number]['schluessel'];
export const EIGENER_ANTRAG_FILTER: readonly EigenerAntragFilter[] = schluesselIn(EIGENE_ANTRAG_STATUS, 'web');

/**
 * Events der Konfis: Alle, Meine, Konfirmation -- wie die Reiter der App.
 * Alte Adressen mit ?filter=anstehend|pflicht fuehren zur Vorgabe „Meine".
 */
export type KonfiEventFilter = (typeof KONFI_EVENTS)[number]['schluessel'];
export const KONFI_EVENT_FILTER: readonly KonfiEventFilter[] = schluesselIn(KONFI_EVENTS, 'web');

/** Events des Teams: Alle, Meine, Team (sucht oder nur fuers Team). */
export type TeamEventFilter = (typeof TEAM_EVENTS)[number]['schluessel'];
export const TEAM_EVENT_FILTER: readonly TeamEventFilter[] = schluesselIn(TEAM_EVENTS, 'web');

/** Der Reiter von Mitmachen bei Konfis und Team: Events oder die eigenen Aktivitaeten (`?segment=antraege`). */
export type MitgliedSegment = (typeof MITGLIED_BEREICHE)[number]['schluessel'];

export function mitgliedSegmentAusAdresse(search: string): MitgliedSegment {
  return new URLSearchParams(search).get('segment') === 'antraege' ? 'antraege' : 'events';
}
