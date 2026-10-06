// Typen der Web-Fassung von Mitmachen bei der Leitung (03.10.2026).

import type { Event } from '../../../../types/event';

/** Ein gemeldeter Antrag (GET /admin/activities/requests) -- wie in ActivityRequestsView. */
export interface AntragZeile {
  id: number;
  konfi_id: number;
  konfi_name: string;
  jahrgang_name?: string;
  activity_id: number;
  activity_name: string;
  activity_type?: string;
  activity_points?: number;
  requested_date: string;
  comment?: string;
  photo_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  approved_by?: number;
  approved_by_name?: string;
  activity_target_role?: 'konfi' | 'teamer';
  created_at: string;
  updated_at: string;
}

/**
 * Die Reiter oben, wie in der App: Events und Aktivitaeten -- die gemeldeten
 * (Schluessel `antraege`, wie die Deep-Links `?segment=antraege`). Der Katalog
 * der Aktivitaeten steht wie in der App unter Mehr (/admin/activities); Simon,
 * 06.10.2026: der Reiter heisst ueberall „Aktivitaeten".
 */
export type LeitungSegment = 'events' | 'antraege';

/** Was die Leitung an Events tun kann -- die Funktionen kommen aus AdminEventsPage, dieselben wie in der App. */
export interface TerminAktionen {
  neu: () => void;
  kopieren: (event: Event) => void;
  /** Absagen -- oder, an einem abgesagten Event, den Grund bearbeiten. */
  absagen: (event: Event) => void;
  zuruecknehmen: (event: Event) => void;
  loeschen: (event: Event) => void;
}

export interface AntragAktionen {
  /** Oeffnet den Antrag zum Pruefen (Freigeben oder Ablehnen im Modal). */
  pruefen: (antrag: AntragZeile) => void;
  zuruecksetzen: (antrag: AntragZeile) => void;
}

/** Der Reiter aus der Adresse: `?segment=antraege`, sonst Events (`aktivitaeten` leitet AdminEventsPage unter Mehr um). */
export function segmentAusAdresse(search: string): LeitungSegment {
  const wert = new URLSearchParams(search).get('segment');
  return wert === 'antraege' ? wert : 'events';
}

/** Die Zeitraeume der Event-Tabelle -- auch als `?filter=` in der Adresse. */
export type ZeitFilter = 'aktuell' | 'verbuchen' | 'vergangen' | 'abgesagt';
export const ZEIT_FILTER: readonly ZeitFilter[] = ['aktuell', 'verbuchen', 'vergangen', 'abgesagt'];

/** Die Status der Antrags-Tabelle -- auch als `?filter=` in der Adresse. */
export type AntragFilter = 'offen' | 'verbucht' | 'abgelehnt' | 'alle';
export const ANTRAG_FILTER: readonly AntragFilter[] = ['offen', 'verbucht', 'abgelehnt', 'alle'];
