// ========================================
// Konfi Wrapped - TypeScript Interfaces
// Matchen 1:1 die Backend JSONB-Struktur (wrapped_snapshots.data)
// ========================================

// --- Konfi-Snapshot Slides ---

export interface KonfiPunkteSlide {
  gottesdienst: number;
  gemeinde: number;
  total: number;
  bonus: number;
}

export interface KonfiEventsSlide {
  total_attended: number;
  total_available: number;
  lieblings_event: { name: string; date: string } | null;
}

export interface KonfiBadgesSlide {
  total_earned: number;
  total_available: number;
  badges: Array<{ name: string; icon: string; color: string }>;
}

export interface KonfiAktivsterMonatSlide {
  monat: number;
  monat_name: string;
  aktivitaeten: number;
}

export interface KonfiChatSlide {
  nachrichten_gesendet: number;
}

export interface KonfiEndspurtSlide {
  aktiv: boolean;
  fehlende_punkte: number;
  ziel_total: number;
  aktuell_total: number;
}

export interface KonfiZeitraumSlide {
  start: string;
  ende: string;
}

export interface KonfiWrappedData {
  version: number;
  slides: {
    punkte: KonfiPunkteSlide;
    events: KonfiEventsSlide;
    badges: KonfiBadgesSlide;
    aktivster_monat: KonfiAktivsterMonatSlide;
    chat: KonfiChatSlide;
    endspurt: KonfiEndspurtSlide;
    zeitraum: KonfiZeitraumSlide;
  };
}

// --- Teamer-Snapshot Slides ---

export interface TeamerEventsGeleitetSlide {
  total: number;
  meiste_teilnehmer_event: { name: string; teilnehmer: number } | null;
}

export interface TeamerKonfisBetreutSlide {
  total_konfis: number;
  jahrgaenge: string[];
}

export interface TeamerBadgesSlide {
  total_earned: number;
  badges: Array<{ name: string; icon: string; color: string }>;
}

export interface TeamerZertifikateSlide {
  total: number;
  zertifikate: Array<{ name: string; issued_date: string }>;
}

export interface TeamerEngagementSlide {
  teamer_seit: string;
  jahre_aktiv: number;
}

export interface TeamerZeitraumSlide {
  year: number;
}

export interface TeamerWrappedData {
  version: number;
  slides: {
    events_geleitet: TeamerEventsGeleitetSlide;
    konfis_betreut: TeamerKonfisBetreutSlide;
    badges: TeamerBadgesSlide;
    zertifikate: TeamerZertifikateSlide;
    engagement: TeamerEngagementSlide;
    zeitraum: TeamerZeitraumSlide;
  };
}

// --- API Response ---

export interface WrappedResponse {
  data: KonfiWrappedData | TeamerWrappedData;
  computed_at: string;
  year: number;
  wrapped_type: 'konfi' | 'teamer';
}

// --- Slide-Props Basis ---

export interface SlideProps {
  isActive: boolean;
}
