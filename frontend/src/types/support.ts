// Antwortformen der Support-API (Web-Version, 03.10.2026).
//
// Quelle ist der gemeinsame Vertrag der Pakete B (Backend) und C (Oberflaeche)
// zu docs/planung/web-version.md: Routen unter /api/support (nur Super-Admin),
// dazu die Support-Konten unter /api/organizations/support-konten (seit #218,
// docs/api/verwaltung-auth.yaml). Felder, die der Server leer lassen darf,
// sind hier `| null`.

import type { LizenzSchluessel } from '../utils/lizenzen';

/** Status einer Anfrage aus dem Formular der Homepage. */
export type AnfrageStatus = 'neu' | 'in_arbeit' | 'angelegt' | 'abgelehnt';

/** GET /support/anfragen — ein Eintrag. */
export interface GemeindeAnfrage {
  id: number;
  gemeinde: string;
  kirchenkreis: string | null;
  landeskirche: string | null;
  kontakt_name: string;
  funktion: string | null;
  email: string;
  mobil: string | null;
  anzahl_konfis: number | null;
  anzahl_teamer: number | null;
  nachricht: string | null;
  status: AnfrageStatus;
  notiz: string | null;
  organization_id: number | null;
  created_at: string;
  updated_at: string;
  /** Wunschlizenz aus dem Formular (Migration 192); null = keine Angabe. */
  wunsch_lizenz?: LizenzSchluessel | null;
  /**
   * Ungelesene eingehende Mails zu dieser Anfrage (Support-Mail,
   * docs/planung/support-mail.md). Optional: aeltere Server liefern es nicht.
   */
  ungelesen?: number;
}

/** POST /support/anfragen/:id/anlegen — Koerper. */
export interface AnfrageAnlegenDaten {
  name: string;
  display_name?: string;
  kirchenkreis_id?: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  max_konfis?: number | null;
  trial_ends_at?: string | null;
  /** Wie bei POST /organizations: Testphase (Hinweis auf den Startseiten) oder Lizenz. */
  is_trial?: boolean;
  admin_username: string;
  admin_display_name: string;
  admin_email?: string | null;
  admin_password: string;
}

/** POST /support/anfragen/:id/anlegen — Antwort (201). */
export interface AnfrageAngelegt {
  organization_id: number;
  admin_id: number;
}

/** GET /support/landeskirchen — ein Eintrag mit seinen Kirchenkreisen. */
export interface Landeskirche {
  id: number;
  name: string;
  kirchenkreise: Array<{ id: number; name: string }>;
}

/** GET /support/kirchenkreise — ein Eintrag. */
export interface Kirchenkreis {
  id: number;
  name: string;
  landeskirche_id: number | null;
  landeskirche: string | null;
}

/** Konten einer Gemeinde je Rolle (GET /support/statistik). */
export interface KontenJeRolle {
  konfi: number;
  teamer: number;
  admin: number;
  org_admin: number;
}

/** GET /support/statistik — eine Gemeinde, ohne Namen von Personen. */
export interface GemeindeKennzahlen {
  id: number;
  name: string;
  is_active: boolean;
  kirchenkreis_id: number | null;
  kirchenkreis: string | null;
  landeskirche_id: number | null;
  landeskirche: string | null;
  konten: KontenJeRolle;
  aktiv_30_tage: number;
  jahrgaenge: number;
}

/** GET /support/statistik — Antwort. */
export interface SupportStatistik {
  /** ISO-Zeit der Erhebung. */
  stand: string;
  gemeinden: GemeindeKennzahlen[];
}

/** GET /organizations/support-konten — ein Konto ohne Gemeinde. */
export interface SupportKonto {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  /** Gemeinden, in denen das Konto als Gast eingetragen ist. */
  gemeinden: Array<{ id: number; name: string; display_name: string; role_name: string }>;
}

// ---------------------------------------------------------------------------
// Support-Mail (03.10.2026, docs/planung/support-mail.md): Postfaecher lesen
// und sortieren, Anfragen und Gemeinden antworten, Textbausteine, Fusszeile.
// Routen unter /api/support/mail, /api/support/anfragen/:id/… und
// /api/support/gemeinden/:id/… -- alle nur Super-Admin.
// ---------------------------------------------------------------------------

/** Die zwei Postfaecher: "moin" fuer Anfragen, "support" fuer Gemeinden. */
export type Postfach = 'moin' | 'support';

/** Eingehend (an ein Postfach) oder ausgehend (Antwort aus der Support-Ansicht). */
export type MailRichtung = 'ein' | 'aus';

/** Ein Anhang -- nur Name, Groesse und Typ; Inhalte speichert der Server nicht. */
export interface MailAnhang {
  name: string;
  groesse?: number | null;
  typ?: string | null;
}

/** Eine Mail, ein- oder ausgehend (Verlauf einer Anfrage oder Gemeinde, Faden). */
export interface MailNachricht {
  id: number;
  postfach: Postfach;
  richtung: MailRichtung;
  /** Zugeordnet zu einer Anfrage ODER einer Gemeinde -- oder keins (Posteingang). */
  anfrage_id: number | null;
  organization_id: number | null;
  message_id?: string | null;
  in_reply_to?: string | null;
  referenzen?: string[] | null;
  von_adresse: string;
  von_name: string | null;
  an_adressen: string[] | null;
  betreff: string | null;
  /** Nur Klartext. */
  text: string | null;
  anhaenge: MailAnhang[] | null;
  gesendet_am: string;
  /** Eingehend: wann im Support gesehen; ausgehend: = gesendet_am. */
  gelesen_am: string | null;
  verfasst_von?: number | null;
  created_at?: string;
}

/** GET /support/mail/nachrichten/:id — eine Mail mit allen Mails desselben Fadens. */
export interface MailVerlauf extends MailNachricht {
  verlauf: MailNachricht[];
}

/** GET /support/mail/eingang — ein Eintrag (nicht zugeordnet, neueste zuerst). */
export interface MailEingangEintrag {
  id: number;
  postfach: Postfach;
  von_adresse: string;
  von_name: string | null;
  betreff: string | null;
  auszug: string | null;
  gesendet_am: string;
  gelesen_am: string | null;
  anhaenge: MailAnhang[] | null;
}

/** Zustand eines Postfachs (GET /support/mail/status). */
export interface MailPostfachStatus {
  postfach: Postfach;
  adresse: string;
  /** Benutzer, Passwort und IMAP-Host gesetzt. */
  eingerichtet: boolean;
  abgeholt_am: string | null;
  fehler: string | null;
  fehler_am: string | null;
  /**
   * false: Dieser Server holt nicht ab und versendet nicht (Testserver ohne
   * Hintergrund-Jobs; Nachtrag zum Vertrag, 03.10.2026). Fehlt das Feld
   * (aelterer Server), gilt true.
   */
  auf_diesem_server?: boolean;
}

/** GET /support/mail/status — Antwort. */
export interface MailStatus {
  postfaecher: MailPostfachStatus[];
}

/** GET /support/mail/zaehler — ungelesene eingehende Mails. */
export interface MailZaehler {
  anfragen: number;
  gemeinden: number;
  /** Nicht zugeordnet (Posteingang). */
  eingang: number;
  /** Je Anfrage bzw. Gemeinde: Kennung (als Schluessel) -> Zahl. */
  je_anfrage: Record<string, number>;
  je_gemeinde: Record<string, number>;
}

/** Ein Textbaustein (GET /support/mail/bausteine). */
export interface MailBaustein {
  id: number;
  titel: string;
  betreff: string | null;
  text: string;
  /** null = fuer beide Postfaecher. */
  postfach: Postfach | null;
  sortierung: number;
  updated_at?: string;
  bearbeitet_von?: number | null;
}

/** POST /support/mail/bausteine, PUT /support/mail/bausteine/:id — Koerper. */
export interface MailBausteinDaten {
  titel: string;
  betreff: string | null;
  text: string;
  postfach: Postfach | null;
}

/** GET/PUT /support/mail/einstellungen. */
export interface MailEinstellungen {
  fusszeile: string;
  absendername: string;
}

/** GET /support/mail/platzhalter?anfrage_id= bzw. ?organization_id= — Werte; leer = unbekannt. */
export interface Platzhalter {
  name: string | null;
  gemeinde: string | null;
  lizenz: string | null;
  testphase_bis: string | null;
  benutzername: string | null;
  absender: string | null;
}

/**
 * GET /support/gemeinden/:id/empfaenger — ein moeglicher Empfaenger. Der
 * Vertrag nennt nur den Inhalt (Gemeindeleitungen und Leitung mit Adresse,
 * dazu Absender aus dem Verlauf), nicht die Form; die Oberflaeche nimmt
 * deshalb Zeichenketten und Objekte mit `adresse` oder `email`
 * (utils/supportMail.ts, empfaengerLesen).
 */
export interface MailEmpfaenger {
  adresse: string;
  name: string | null;
  /** Woher die Adresse stammt, wenn der Server es sagt (z. B. "Gemeindeleitung"). */
  herkunft: string | null;
}

/** POST /support/anfragen/:id/antworten u. a. — Koerper. */
export interface MailAntwortDaten {
  text: string;
  betreff?: string;
  /** Nur bei Gemeinden: eine Adresse aus /empfaenger. */
  an?: string;
}

/** Eine Gemeinde, wie GET /organizations sie liefert (nur, was die Support-Mail braucht). */
export interface GemeindeKurz {
  id: number;
  name: string;
  display_name?: string | null;
  is_active?: boolean;
}
