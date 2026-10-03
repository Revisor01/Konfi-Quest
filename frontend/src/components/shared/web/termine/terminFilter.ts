// Die Filter der Listen von Mitmachen bei Konfis und Team (Web-Fassung,
// 03.10.2026) -- auch als `?filter=` in der Adresse vorgebbar.

/** Eigene Aktivitaeten (Konfis und Team): Offen, Angerechnet, Abgelehnt, Alle. */
export type EigenerAntragFilter = 'offen' | 'angerechnet' | 'abgelehnt' | 'alle';
export const EIGENER_ANTRAG_FILTER: readonly EigenerAntragFilter[] = ['offen', 'angerechnet', 'abgelehnt', 'alle'];

/** Events der Konfis: Anstehend (fuer alle), Meine, Konfirmation, Pflicht. */
export type KonfiEventFilter = 'anstehend' | 'meine' | 'konfirmation' | 'pflicht';
export const KONFI_EVENT_FILTER: readonly KonfiEventFilter[] = ['anstehend', 'meine', 'konfirmation', 'pflicht'];

/** Events des Teams: Alle, Meine, Team (sucht oder nur fuers Team). */
export type TeamEventFilter = 'alle' | 'meine' | 'team';
export const TEAM_EVENT_FILTER: readonly TeamEventFilter[] = ['alle', 'meine', 'team'];

/** Der Reiter von Mitmachen bei Konfis und Team: Events oder die eigenen Aktivitaeten (`?segment=antraege`). */
export type MitgliedSegment = 'events' | 'antraege';

export function mitgliedSegmentAusAdresse(search: string): MitgliedSegment {
  return new URLSearchParams(search).get('segment') === 'antraege' ? 'antraege' : 'events';
}
