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
  abgesagt?: number;
}

export interface KonfiBadgesSlide {
  total_earned: number;
  total_available: number;
  badges: Array<{ name: string; icon: string; color: string }>;
  /**
   * Das seltenste Abzeichen dieser Person ("das haben nur x %").
   * Ab 03.09.2026; null, wenn die Gemeinde weniger als 5 Konfis hat --
   * dort waere eine Prozentzahl ohne Aussage.
   */
  seltenstes?: {
    name: string;
    icon: string;
    color: string;
    haben_es: number;
    konfis: number;
    prozent: number;
  } | null;
}

export interface KonfiAktivsterMonatSlide {
  monat: number;
  monat_name: string;
  aktivitaeten: number;
}

export interface KonfiChatSlide {
  nachrichten_gesendet: number;
  /** Ab Version 3 (01.09.2026). In aelteren Snapshots nicht vorhanden. */
  reaktionen_gegeben?: number;
  reaktionen_bekommen?: number;
}

/** Challenge-Zahlen fuer das Highlight -- ab Version 3. */
export interface KonfiChallengesSlide {
  beitraege: number;
  top_challenge: { title: string; badge_icon: string; count: number } | null;
}

/** Verlaesslichkeit (Selbst-Abmeldungen) -- ab Version 3. */
export interface KonfiVerlaesslichkeitSlide {
  abmeldungen: number;
  nie_abgesagt: boolean;
}

/**
 * Das persoenliche Highlight -- ab Version 3. Der Jahrgangsschnitt ist
 * anonym (nur die Zahl, nie Namen) und wird im Frontend nur gezeigt,
 * wenn der eigene Wert darueber liegt (freundliche Vergleiche only).
 */
export interface KonfiHighlight {
  type: HighlightType;
  wert: number;
  jahrgangsschnitt: number | null;
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
  /**
   * Der echte Konfirmationstermin, null wenn der Jahrgang keinen hat.
   * Ab Snapshot-Version 2.1 (01.09.2026). Bei aelteren Snapshots nicht
   * vorhanden -- dort wurde `ende` als Konfirmationstermin gerendert, was
   * ohne Konfirmations-Termin einen erfundenen Stichtag zeigte.
   */
  konfirmation?: string | null;
}

export interface KonfiGottesdienstSlide {
  count: number;
}

export interface KonfiKategorieSlide {
  verteilung: Array<{
    kategorie: string;
    count: number;
    /**
     * Auf welche feste Seite dieser Name zeigt ('kategorie:freizeit'), oder
     * null bei einem eigenen Namen der Gemeinde. Ab 03.09.2026 -- das
     * Backend liefert die Zuordnung mit, damit sie nicht an zwei Stellen
     * gepflegt werden muss.
     */
    seite?: string | null;
    /** Getrennt gezaehlt ab 03.09.2026 (Termine vs. Aktivitaeten). */
    aus_terminen?: number;
    aus_aktivitaeten?: number;
  }>;
  top_kategorie: string | null;
}

export interface KonfiPflichtSlide {
  besucht: number;
  gesamt: number;
}

/** Ein einzelner Challenge-Beitrag des Konfi (Quelle: challenge_submissions). */
export interface KonfiChallengeMoment {
  challenge_title: string;
  badge_icon: string;
  media_type: 'text' | 'photo' | 'audio' | 'video' | 'link';
  file_path?: string | null;
  file_name?: string | null;
  text_content?: string | null;
  link_url?: string | null;
  /** Musikdienst-Metadaten; in Snapshots vor der Erlaubnisliste nicht enthalten. */
  link_title?: string | null;
  link_author?: string | null;
  link_album?: string | null;
  created_at: string;
}

/** Slide "Deine Momente" — ab Snapshot-Version 2. */
export type KonfiChallengeMomenteSlide = KonfiChallengeMoment[];

export type HighlightType =
  | 'events_held'
  | 'badge_collector'
  | 'chat_champion'
  | 'gottesdienst_treue'
  | 'gemeinde_aktiv'
  | 'ueber_das_ziel'
  // Ab Snapshot-Version 3 (01.09.2026): persoenliche Highlights aus
  // Chat, Reaktionen, Challenges und Verlaesslichkeit.
  | 'chat_star'
  | 'reaktions_magnet'
  | 'challenge_fan'
  | 'verlaesslich';

export interface KonfiWrappedData {
  /** 1 = Alt-Snapshots (History), ab 2 = Challenges-Wrapped. */
  version: number;
  /**
   * Die Seiten dieses Rueckblicks in Anzeigereihenfolge, vom Backend
   * gewaehlt (utils/wrappedKacheln.js, Simons Dramaturgie). Ab 03.09.2026.
   * Fehlt bei aelteren Snapshots -- dann rendert das Frontend wie bisher
   * ueber seine eigene feste Reihenfolge.
   */
  kacheln?: string[];
  highlight_type: HighlightType;
  formulierung_seed: number;
  slides: {
    punkte: KonfiPunkteSlide;
    events: KonfiEventsSlide;
    badges: KonfiBadgesSlide;
    aktivster_monat: KonfiAktivsterMonatSlide;
    endspurt: KonfiEndspurtSlide;
    zeitraum: KonfiZeitraumSlide;
    kategorie: KonfiKategorieSlide;
    /** Ab Version 2. Bei Version-1-Snapshots nicht vorhanden. */
    challenge_momente?: KonfiChallengeMomenteSlide;
    /** Ab Version 3: das persoenliche Highlight dieser Person. */
    highlight?: KonfiHighlight;
    /** Ab Version 3: Challenge-Zahlen fuer die Highlight-Seite. */
    challenges?: KonfiChallengesSlide;
    /** Ab Version 3: Selbst-Abmeldungen (nur positiv/neutral verwendet). */
    verlaesslichkeit?: KonfiVerlaesslichkeitSlide;
    /**
     * Version 1: nur nachrichten_gesendet, wurde nicht mehr gerendert.
     * Ab Version 3 wieder befuellt (gleicher Typ, zwei Felder mehr) und
     * von der Highlight-Seite verwendet.
     */
    chat?: KonfiChatSlide;
    /** Nur noch Alt-Daten (Version 1), wird nicht mehr gerendert. */
    gottesdienst?: KonfiGottesdienstSlide;
    /** Backend liefert es weiter, wird aber nicht mehr gerendert. */
    pflicht?: KonfiPflichtSlide;
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
  // Nullbar: Das Backend liefert null, wenn users.teamer_since nicht gesetzt
  // ist (wrapped.js:446). Der Typ behauptete string und verdeckte damit, dass
  // die Seite "0 Jahre als Teamer:in" anzeigen konnte.
  teamer_seit: string | null;
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
  /** Name der Ausgabe -- steht auf der ersten Seite. Ab 03.09.2026. */
  titel?: string | null;
  ausgabe_id?: number | null;
}

// --- History ---

export interface WrappedHistoryEntry {
  id: number;
  wrapped_type: 'konfi' | 'teamer';
  year: number;
  data: KonfiWrappedData | TeamerWrappedData;
  computed_at: string;
  /**
   * Name der Ausgabe ("Zwischenstand", "Dein Abschluss"). Ab 03.09.2026 --
   * das Backend liefert ihn mit, damit mehrere Ausgaben desselben Jahres
   * unterscheidbar sind. Bei Alt-Snapshots ohne Ausgabe nicht gesetzt.
   */
  titel?: string | null;
  ausgabe_id?: number | null;
  freigegeben_at?: string | null;
}

// --- Slide-Props Basis ---

export interface SlideProps {
  isActive: boolean;
}
