// Die Datensaetze der Verwaltungsseiten (Kategorien, Level, Zertifikate,
// Jahrgaenge, Einladungen, Rueckblick, Material), so wie die Web-Fassung sie
// liest. Die Formen sind die der Seiten (admin/pages/Admin*Page.tsx): Sie laden
// und halten die Daten, die Web-Fassung stellt sie dar.

export interface KategorieEintrag {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface LevelEintrag {
  id: number;
  name: string;
  title: string;
  description?: string;
  points_required: number;
  icon?: string;
  color?: string;
  reward_type?: string;
  reward_value?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZertifikatTyp {
  id: number;
  name: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface JahrgangEintrag {
  id: number;
  name: string;
  created_at: string;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  target_gottesdienst?: number;
  target_gemeinde?: number;
  konfspruch_enabled?: boolean;
  wrapped_released_at?: string | null;
  konfi_count?: number;
}

export interface EinladungsCode {
  id: number;
  invite_code: string;
  jahrgang_id: number;
  jahrgang_name: string;
  expires_at: string;
  used_count: number;
}

export interface RueckblickAusgabe {
  id: number;
  typ: 'konfi' | 'teamer';
  jahrgang_id: number | null;
  jahrgang_name: string | null;
  titel: string;
  zeitraum_start: string;
  zeitraum_ende: string;
  freigegeben: boolean;
  freigegeben_at: string | null;
  snapshots: number;
  created_at: string;
}

export interface TeamJahr {
  jahr: number;
  gesperrt: boolean;
}

export interface MaterialEintrag {
  id: number;
  title: string;
  description?: string;
  event_count?: number;
  jahrgaenge?: { id: number; name: string }[];
  jahrgang_id?: number;
  jahrgang_name?: string;
  file_count?: number;
  link_url?: string | null;
  link_count?: number;
  ist_global?: boolean;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}
