// Die Filter der Listen von Mitmachen bei Konfis und Team (Web-Fassung,
// 03.10.2026) -- auch als `?filter=` in der Adresse vorgebbar.

/** Eigene Aktivitaeten (Konfis und Team): Offen, Angerechnet, Abgelehnt, Alle. */
export type EigenerAntragFilter = 'offen' | 'angerechnet' | 'abgelehnt' | 'alle';
export const EIGENER_ANTRAG_FILTER: readonly EigenerAntragFilter[] = ['offen', 'angerechnet', 'abgelehnt', 'alle'];

/**
 * Events der Konfis: Alle, Meine, Konfirmation -- wie die Reiter der App
 * (konfi/views/EventsView.tsx), in derselben Reihenfolge. Simon, 06.10.2026:
 * „angleichen" (bis dahin „Anstehend" statt „Alle" und ein Filter „Pflicht",
 * den die App nicht hat). Alte Adressen mit ?filter=anstehend|pflicht fuehren
 * zur Vorgabe „Meine".
 */
export type KonfiEventFilter = 'alle' | 'meine' | 'konfirmation';
export const KONFI_EVENT_FILTER: readonly KonfiEventFilter[] = ['alle', 'meine', 'konfirmation'];

/** Events des Teams: Alle, Meine, Team (sucht oder nur fuers Team). */
export type TeamEventFilter = 'alle' | 'meine' | 'team';
export const TEAM_EVENT_FILTER: readonly TeamEventFilter[] = ['alle', 'meine', 'team'];

/** Der Reiter von Mitmachen bei Konfis und Team: Events oder die eigenen Aktivitaeten (`?segment=antraege`). */
export type MitgliedSegment = 'events' | 'antraege';

export function mitgliedSegmentAusAdresse(search: string): MitgliedSegment {
  return new URLSearchParams(search).get('segment') === 'antraege' ? 'antraege' : 'events';
}
