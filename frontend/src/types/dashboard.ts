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

export interface DashboardEvent {
  id: number;
  title?: string;
  name?: string;
  description?: string;
  event_date: string;
  date?: string;
  location?: string;
  is_registered?: boolean;
  booking_status?: string;
  waitlist_position?: number;
  booked_timeslot_start?: string;
  booked_timeslot_end?: string;
  max_participants?: number;
  cancelled?: boolean;
  category_names?: string;
}

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
