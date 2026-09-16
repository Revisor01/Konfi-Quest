// Zentrale Event-Typen — alle Consumer importieren von hier

export interface Category {
  id: number;
  name: string;
  description?: string;
  type?: 'activity' | 'event' | 'both';
}

export interface Timeslot {
  id?: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count?: number;
  waitlist_count?: number;
}

export interface Jahrgang {
  id: number;
  name: string;
  // Punktearten-Schalter des Jahrgangs. Das Backend liefert sie ueber
  // SELECT j.* mit; ohne sie boten die Termin-Formulare auch eine im Jahrgang
  // abgeschaltete Punkteart an (Befund 26.08.2026).
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
}

// Vollstaendiges Event-Interface (alle Felder aus allen 8 Definitionen vereint)
export interface Event {
  id: number;
  name: string;
  title?: string;
  description?: string;
  event_date: string;
  date?: string;
  event_end_time?: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  point_type?: 'gottesdienst' | 'gemeinde';
  categories?: Category[];
  category_names?: string;
  category?: string;
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  // Optional und um 'mandatory' erweitert (06.09.2026): Der Wert fehlte in
  // GET /events/:id ganz -- die Leitungs-Detailansicht las ihn dort als
  // undefined und zeigte deshalb "Geschlossen" an einem offenen Termin
  // (Prod-Event 130). Das Backend liefert ihn jetzt auch im Detail; der Typ
  // sagt trotzdem "kann fehlen", denn aeltere Antworten und Cache-Staende
  // haben ihn nicht. Wer ihn liest, muss den Fall behandeln.
  registration_status?: 'upcoming' | 'open' | 'closed' | 'cancelled' | 'mandatory';
  // Eigener Status fuer das Teamer-Kontingent (Migration 120). registration_status
  // rechnet ausschliesslich mit Konfi-Zahlen -- die beiden Kontingente sind
  // unabhaengig voneinander. 'none' heisst: An diesem Termin werden gar keine
  // Teamer:innen gesucht. Fehlt der Wert, ist die Antwort aelter als 27.08.2026.
  teamer_registration_status?: 'none' | 'upcoming' | 'open' | 'waitlist' | 'closed' | 'cancelled';
  created_at?: string;
  is_registered?: boolean;
  registered?: boolean;
  can_register?: boolean;
  start_time?: string;
  // Waitlist
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
  waitlist_count?: number;
  waitlist_position?: number;
  // Booking
  booking_status?: 'confirmed' | 'waitlist' | 'pending' | 'opted_out' | null;
  registration_status_detail?: string;
  is_opted_out?: boolean;
  // Attendance ('excused' seit Migration 147: nachgetragene Abmeldung)
  attendance_status?: 'present' | 'absent' | 'excused' | null;
  cancelled?: boolean;
  // Absage: Grund und Urheber (Migration 150). Der Grund ist freiwillig --
  // null heisst "kein Grund angegeben" und ist der Normalfall. Der Name fehlt
  // bei Terminen, die vor der Migration abgesagt wurden; dann faellt die
  // Urheberzeile ersatzlos weg (siehe absageUrheberZeile).
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  cancelled_by?: number | null;
  cancelled_by_name?: string | null;
  // Wer den Grund zuletzt gesetzt hat (Migration 152). Beim Absagen dieselbe
  // Person wie cancelled_by; erst nach einer nachtraeglichen Korrektur gehen
  // die beiden auseinander (siehe absagegrundUrheberZeile).
  cancelled_reason_set_by?: number | null;
  cancelled_reason_set_by_name?: string | null;
  cancelled_reason_set_at?: string | null;
  // Timeslots
  has_timeslots?: boolean;
  booked_timeslot_id?: number;
  booked_timeslot_start?: string;
  booked_timeslot_end?: string;
  // Pflicht/Optionen
  mandatory?: boolean;
  is_konfirmation?: boolean;
  bring_items?: string;
  checkin_window?: number;
  // Teamer
  teamer_needed?: boolean;
  teamer_only?: boolean;
  teamer_count?: number;
  teamer_max_participants?: number;
  teamer_waitlist_enabled?: boolean;
  teamer_max_waitlist_size?: number;
  teamer_waitlist_count?: number;
  // Serien
  is_series?: boolean;
  series_id?: number;
  // Event-Chat: nur gesetzt, wenn die abrufende Person Mitglied des Raums ist
  // (die Listen-Endpunkte liefern sonst null, siehe events.js / konfi.js).
  chat_room_id?: number | null;
  // Admin-spezifisch
  pending_bookings_count?: number;
  jahrgang_ids?: string;
  jahrgang_names?: string;
  jahrgaenge?: Jahrgang[];
  material_count?: number;
  // Dashboard
  max_participants_display?: number;
}

/**
 * Ein Eintrag aus der Teilnehmerliste eines Termins
 * (GET /events/:id -> participants, backend/routes/events/lesen.js).
 *
 * Die Abfrage liefert `eb.*` aus event_bookings, angereichert um Name,
 * Jahrgang, Rolle und die Zeiten des gebuchten Zeitfensters. Deshalb sind
 * hier ALLE Buchungsstatus moeglich — auch 'waitlist' und 'opted_out'.
 *
 * Diese Definition ist die einzige: bis zum 30.08.2026 gab es sie zweimal,
 * und die Fassung im ParticipantManagementModal kannte nur
 * 'confirmed' | 'pending', obwohl sie dieselbe Antwort las.
 */
export interface Participant {
  id: number;
  user_id?: number;
  participant_name: string;
  jahrgang_name?: string;
  role_name?: string;
  created_at: string;
  /**
   * 'excused' kam am 15.09.2026 dazu (Migration 153): Eine Abmeldung setzt
   * seither NICHT mehr nur attendance_status, sondern auch den
   * Buchungsstatus. Ohne diesen Wert im Typ meldet tsc jeden Vergleich damit
   * als unmoeglich -- und die Anzeige haette ihn stillschweigend als
   * "Gebucht" behandelt.
   */
  status?: 'confirmed' | 'waitlist' | 'pending' | 'opted_out' | 'excused';
  /**
   * 'excused' (Migration 147, 12.09.2026): von der Leitung nachgetragene
   * Abmeldung — jemand wurde ausserhalb der App abgemeldet (Anruf der
   * Eltern, Krankheit). Punkte verhalten sich wie bei 'absent'; der
   * Unterschied liegt in der Dokumentation.
   */
  attendance_status?: 'present' | 'absent' | 'excused' | null;
  /** Grund der nachgetragenen Abmeldung; gehoert zu attendance_status='excused'. */
  excuse_reason?: string | null;
  /** Freie Notiz unabhaengig vom Status ("ging um 14 Uhr"). */
  attendance_note?: string | null;
  /**
   * Wer den Anwesenheits-STATUS (samt excuse_reason) zuletzt gesetzt hat
   * (Migration 148, 13.09.2026). Seit Migration 149 gilt das Paar NICHT
   * mehr fuer die Notiz -- die hat mit note_set_by/_at einen eigenen
   * Urheber, weil Status und Notiz von verschiedenen Personen stammen
   * koennen.
   *
   * NULL/fehlend heisst UNBEKANNT, nicht "niemand": Bestandszeilen von vor
   * der Migration und Selbst-Check-ins per QR-Code haben keinen Urheber.
   * Die Anzeige laesst die Zeile dann weg.
   */
  attendance_set_by?: number | null;
  attendance_set_by_name?: string | null;
  attendance_set_at?: string | null;
  /**
   * Wer die NOTIZ zuletzt geschrieben hat (Migration 149, 13.09.2026).
   * Gleiche Regel: NULL heisst unbekannt, nicht niemand -- Notizen von vor
   * der Migration tragen keinen Urheber, und ohne Notiz gibt es keinen.
   */
  note_set_by?: number | null;
  note_set_by_name?: string | null;
  note_set_at?: string | null;
  /**
   * WOHER die Anwesenheit kam (Migration 151, 15.09.2026): 'qr' = die Person
   * hat sich selbst per QR-Code eingecheckt, 'manuell' = die Leitung hat den
   * Status gesetzt.
   *
   * Ergaenzt die Urheber-Felder, ersetzt sie nicht: Beim QR-Check-in bleibt
   * attendance_set_by bewusst leer (Migration 148) -- ein Selbst-Check-in ist
   * keine Leitungsentscheidung und traegt keinen Namen. Vorher stand er damit
   * im selben NULL wie der Altbestand; die Quelle trennt beides.
   *
   * NULL/fehlend heisst weiterhin UNBEKANNT: Bestandszeilen von vor der
   * Migration. Dort faellt jede Zeile weg.
   */
  checkin_quelle?: 'qr' | 'manuell' | null;
  checked_in_at?: string | null;
  timeslot_id?: number;
  timeslot_start_time?: string;
  timeslot_end_time?: string;
  opt_out_reason?: string;
  opt_out_date?: string;
  /**
   * Hat diese Absage eine vorherige Zusage zurueckgenommen? (Migration 141,
   * 01.09.2026). Nur beim Teamer-Zusage-Weg gesetzt; fuer die Leitung der
   * Unterschied zwischen "war nie eingeplant" und "kurzfristig abgesprungen".
   */
  absage_nach_zusage?: boolean;
}

/**
 * Material, das an einem Termin haengt (GET /material/by-event/:eventId,
 * backend/routes/material.js). Die Abfrage liefert genau diese Felder;
 * file_count wird serverseitig zur Zahl gemacht.
 */
export interface EventMaterial {
  id: number;
  title: string;
  description?: string;
  created_at: string;
  created_by_name?: string;
  file_count?: number;
  /** Gesetzt, wenn das Material einen Link statt Dateien traegt (ab 31.08.2026). */
  link_url?: string | null;
}

/** Eine Abmeldung von einem Termin (GET /events/:id -> unregistrations). */
export interface Unregistration {
  id: number;
  user_id: number;
  konfi_name: string;
  reason?: string;
  unregistered_at: string;
}
