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
