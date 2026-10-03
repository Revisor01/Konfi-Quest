import {
  ICON_AT_ZEICHEN,
  ICON_MAIL,
  ICON_NETZWERK,
  ICON_ORGANISATION,
  ICON_PULS,
  ICON_SCHLUESSEL,
  ICON_STATISTIK,
  ICON_TEXTDOKUMENT,
} from '../components/shared/icons';
import type { MenueEintrag } from './routes';

// Die Bereiche der Support-Ansicht (Web-Version, Entscheidung 2, 02.10.2026:
// "Verwaltung und Support-Dashboard sind eine Ansicht").
//
// EINE Liste fuer zwei Stellen: die Seitenleiste der Web-Version (Feld
// `menue` im Baum super_admin, rollenBaeume.ts, und in Simons Konto
// angehaengt an seine eigenen Eintraege) und die Uebersichtsseite
// /admin/support, die auf schmalen Bildschirmen und in einem Konto mit
// Gemeinde (Simons Konto, Weg ueber "Mehr") denselben Weg zu allen Bereichen
// bietet. Eine neue Seite der Support-Ansicht kommt hier dazu und steht damit
// an beiden Stellen.
//
// `badge` haengt eine rote Zahl an den Eintrag (navigation/reiterZaehler.ts):
// Anfragen und Posteingang zaehlen ungelesene Mails (Support-Mail,
// 03.10.2026, docs/planung/support-mail.md).

export interface SupportBereich extends MenueEintrag {
  /** Ein Satz, wofuer der Bereich da ist (Uebersichtsseite). */
  beschreibung: string;
}

export const SUPPORT_START = '/admin/support';

export const SUPPORT_BEREICHE: SupportBereich[] = [
  { path: SUPPORT_START, label: 'Übersicht', icon: ICON_STATISTIK, gruppe: 'Support',
    beschreibung: 'Kennzahlen je Landeskirche, Kirchenkreis und Gemeinde' },
  { path: '/admin/support/anfragen', label: 'Anfragen', icon: ICON_MAIL, gruppe: 'Support', badge: 'supportAnfragen',
    beschreibung: 'Anfragen von der Homepage bearbeiten, beantworten und Gemeinden anlegen' },
  { path: '/admin/support/post', label: 'Posteingang', icon: ICON_AT_ZEICHEN, gruppe: 'Support', badge: 'supportPost',
    beschreibung: 'Mails an moin@ und support@ zuordnen und beantworten, Schriftwechsel mit Gemeinden' },
  { path: '/admin/organizations', label: 'Gemeinden', icon: ICON_ORGANISATION, gruppe: 'Verwaltung',
    beschreibung: 'Stammdaten, Laufzeit, Konfi-Limit und Gemeindeleitungen' },
  { path: '/admin/support/struktur', label: 'Struktur', icon: ICON_NETZWERK, gruppe: 'Verwaltung',
    beschreibung: 'Landeskirchen und Kirchenkreise anlegen und zuordnen' },
  { path: '/admin/support/konten', label: 'Support-Konten', icon: ICON_SCHLUESSEL, gruppe: 'Verwaltung',
    beschreibung: 'Konten ohne Gemeinde anlegen, sperren und löschen' },
  { path: '/admin/support/bausteine', label: 'Textbausteine', icon: ICON_TEXTDOKUMENT, gruppe: 'Verwaltung',
    beschreibung: 'Bausteine für Antworten, Platzhalter, Absendername und Fußzeile' },
  { path: '/admin/metrics', label: 'Betrieb', icon: ICON_PULS, gruppe: 'Betrieb',
    beschreibung: 'Antwortzeiten, Fehler und Last des Servers' },
];

/**
 * Die Bereiche als Eintraege der Seitenleiste (ohne die Beschreibung, die nur
 * die Uebersichtsseite braucht). EINE Rechnung fuer beide Leisten, die sie
 * zeigen: den Baum super_admin (Support-Konto ohne Gemeinde, rollenBaeume.ts)
 * und die Leiste in Simons Konto -- Gemeindeleitung mit Super-Admin-Merkmal --,
 * die sie nach den eigenen Eintraegen anhaengt (components/layout/
 * Seitenleiste.tsx, 03.10.2026).
 */
export const SUPPORT_MENUE: MenueEintrag[] = SUPPORT_BEREICHE.map(({ path, label, icon, gruppe, badge }) => ({
  path, label, icon, gruppe, badge,
}));
