export interface Badge {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  criteria_type: string;
  criteria_value: number;
  criteria_activity_id?: number;
  is_hidden?: boolean;
  sort_order?: number;
  awarded_date?: string;
  earned_at?: string;
}

/**
 * Ein Abzeichen, wie es GET /konfi/badges bzw. GET /teamer/badges liefert
 * (utils/konfiBadgeProgress.js: SELECT cb.* plus earned/earned_at/seen und
 * der berechnete Fortschritt).
 *
 * Achtung: Das Feld heisst hier `earned` (boolean), NICHT `is_earned` — die
 * Oberflaeche rechnet es selbst in ihr eigenes Badge-Format um.
 */
export interface ApiBadge {
  id: number;
  name: string;
  description?: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string | null;
  is_hidden: boolean;
  is_active: boolean;
  color?: string;
  earned: boolean;
  earned_at?: string | null;
  seen: boolean;
  /** Vom Server berechnet; fehlt bei Abzeichen ohne zaehlbares Kriterium. */
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
  /** Bedingung nicht mehr erfuellbar (z.B. Punkteart im Jahrgang aus). */
  unreachable?: boolean;
}

/**
 * Ein Abzeichen in der ANZEIGE-Form der Abzeichen-Seite.
 *
 * Anders als `ApiBadge` trägt es `is_earned` und den bereits verrechneten
 * Fortschritt; die Seite baut es aus der API-Antwort. Bis 30.08.2026 stand
 * dieselbe Definition zweimal (Seite und Ansicht) — mit `criteria_extra?:
 * string`, obwohl die Datenbankspalte nullbar ist.
 */
export interface AnzeigeBadge {
  id: number;
  name: string;
  description?: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string | null;
  is_hidden: boolean;
  is_active: boolean;
  color?: string;
  is_earned: boolean;
  earned_at?: string | null;
  progress_points?: number;
  progress_percentage?: number;
}

/** Antwort von GET /konfi/badges und GET /teamer/badges. */
export interface BadgeUebersicht {
  earned: ApiBadge[];
  available: ApiBadge[];
  stats: {
    totalVisible: number;
    totalSecret: number;
  };
}

// DashboardEvent ist jetzt ein Re-Export von Event
export type { Event as DashboardEvent } from './event';

export interface RankingEntry {
  user_id: number;
  display_name: string;
  total_points: number;
  rank: number;
  separator?: boolean;
  isCurrentUser?: boolean;
  isNeighbor?: boolean;
  initials?: string;
  actualRank?: number;
}
