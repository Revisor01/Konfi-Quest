// Die Datensaetze des Materials, so wie die Web-Fassung sie liest (Teamer-Ansicht
// und das Fenster der Details). Die Formen sind die der Seiten
// (teamer/pages/TeamerMaterialPage.tsx, TeamerMaterialDetailPage.tsx).

export interface MaterialDatei {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface MaterialDetailDaten {
  id: number;
  title: string;
  description?: string;
  events?: { id: number; name: string }[];
  jahrgaenge?: { id: number; name: string }[];
  jahrgang_name?: string;
  admin_name?: string;
  files?: MaterialDatei[];
  link_url?: string | null;
  links?: { id: number; url: string }[];
  ist_global?: boolean;
  created_at: string;
}

export interface MaterialListeneintrag {
  id: number;
  title: string;
  description?: string;
  event_count?: number;
  jahrgaenge?: { id: number; name: string }[];
  jahrgang_name?: string;
  file_count?: number;
  link_url?: string | null;
  link_count?: number;
  ist_global?: boolean;
  created_at: string;
}

/** Welche Datei gerade geladen wird (Fortschritt in Prozent, null = unbestimmt). */
export interface LadendeDatei {
  pfad: string;
  prozent: number | null;
}
