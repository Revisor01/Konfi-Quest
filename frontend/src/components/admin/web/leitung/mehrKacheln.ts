// Die Kacheln der Web-Fassung von "Mehr" (/admin/settings) -- als Daten, damit
// die Rechte an EINER Stelle stehen und sich einzeln pruefen lassen.
//
// Dieselben Eintraege und dieselben Bedingungen wie in der Liste der App
// (AdminSettingsPage): Benutzer:innen, Dashboard und Einladungen fuer die
// Gemeindeleitung; die Inhalte fuer Gemeindeleitung und Leitung; Support und
// Betrieb nur fuer Konten mit Super-Admin-Recht (der Server haelt ohnehin 403).
// "Hilfe und Support" fuehrt nach draussen auf das Support-Formular der Homepage
// (Simon, 03.10.2026: "Support kommt auf die HP").

import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_AKTION_GEFUELLT,
  ICON_APPS,
  ICON_DATEI_GEFUELLT,
  ICON_FUNKELN,
  ICON_GRUPPE_GEFUELLT,
  ICON_HILFE_GEFUELLT,
  ICON_JAHRGANG_GEFUELLT,
  ICON_KATEGORIE_GEFUELLT,
  ICON_KOMPASS,
  ICON_PERSON_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_PULS,
  ICON_QRCODE_GEFUELLT,
  ICON_SUPPORT,
  ICON_TERMIN_GEFUELLT,
} from '../../../shared/icons';
import { istSuperAdmin, type KontoMitRecht } from '../../../../utils/superAdmin';

/** Das Support-Formular der Homepage (die genaue Adresse legt die Support-Seite fest). */
export const SUPPORT_FORMULAR_URL = 'https://konfi-quest.de/#support';

export type MehrFarbe =
  | 'users' | 'activities' | 'badges' | 'jahrgang' | 'categories' | 'level' | 'material' | 'wrapped'
  | 'teamer' | 'organizations' | 'konfis' | 'events' | 'chat';

export type MehrAktion = 'tour' | 'neuigkeiten' | 'mitmachen';

export interface MehrKachel {
  id: string;
  titel: string;
  text: string;
  icon: string;
  farbe: MehrFarbe;
  /** Eine Seite der App. */
  href?: string;
  /** Eine fremde Seite; sie oeffnet in einem neuen Tab. */
  extern?: string;
  /** Ein Fenster der Seite (Tour, Neuerungen, Erklaerung). */
  aktion?: MehrAktion;
  /** Schluessel der Erklaerung (INFOS der Seite), wenn es eine gibt. */
  info?: string;
}

export interface MehrGruppe {
  id: string;
  titel: string;
  beschreibung: string;
  kacheln: MehrKachel[];
}

export interface MehrKonto extends KontoMitRecht {
  role_name?: string;
}

export function mehrGruppen(konto: MehrKonto | null | undefined): MehrGruppe[] {
  const rolle = konto?.role_name;
  const gemeindeleitung = rolle === 'org_admin';
  // Wie die Liste der App: Verwaltung fuer org_admin und super_admin, Inhalt fuer
  // alle ausser dem Support-Konto ohne Gemeinde, das hier gar nicht hinkommt.
  const verwalten = gemeindeleitung || rolle === 'super_admin';
  const inhalte = rolle !== 'super_admin';
  const leitung = gemeindeleitung || rolle === 'admin';

  const gruppen: MehrGruppe[] = [];

  if (inhalte) {
    gruppen.push({
      id: 'inhalt',
      titel: 'Punkte und Inhalte',
      beschreibung: 'Was die Konfis tun können, wofür es Punkte gibt und was sie sehen.',
      kacheln: [
        { id: 'aktivitaeten', titel: 'Aktivitäten', text: 'Aktivitäten und Punkte verwalten', icon: ICON_AKTION_GEFUELLT, farbe: 'activities', href: '/admin/activities', info: 'activities' },
        { id: 'level', titel: 'Punkte und Level', text: 'Punkte-Level und Belohnungen', icon: ICON_POKAL_GEFUELLT, farbe: 'level', href: '/admin/settings/levels', info: 'levels' },
        { id: 'kategorien', titel: 'Kategorien', text: 'Kategorien für Aktivitäten und Events', icon: ICON_KATEGORIE_GEFUELLT, farbe: 'categories', href: '/admin/settings/categories', info: 'categories' },
        { id: 'badges', titel: 'Badges', text: 'Auszeichnungen und Erfolge verwalten', icon: ICON_ABZEICHEN_GEFUELLT, farbe: 'badges', href: '/admin/badges', info: 'badges' },
        { id: 'material', titel: 'Material', text: 'Materialien und Dokumente fürs Team', icon: ICON_DATEI_GEFUELLT, farbe: 'material', href: '/admin/material', info: 'material' },
        { id: 'rueckblick', titel: 'Jahresrückblick', text: 'Ausgaben anlegen, benennen und freigeben', icon: ICON_FUNKELN, farbe: 'wrapped', href: '/admin/wrapped', info: 'wrapped' },
      ],
    });
  }

  const gemeinde: MehrKachel[] = [];
  if (verwalten) {
    gemeinde.push({ id: 'benutzer', titel: 'Benutzer:innen', text: 'Leitung, Team und Rollen verwalten', icon: ICON_GRUPPE_GEFUELLT, farbe: 'users', href: '/admin/users', info: 'users' });
  }
  if (inhalte) {
    gemeinde.push({ id: 'jahrgaenge', titel: 'Jahrgänge', text: 'Punkteziele und Konfisprüche verwalten', icon: ICON_JAHRGANG_GEFUELLT, farbe: 'jahrgang', href: '/admin/settings/jahrgaenge', info: 'jahrgaenge' });
  }
  if (verwalten) {
    gemeinde.push({ id: 'einladungen', titel: 'Einladungen', text: 'QR-Code und Link für die Selbstregistrierung', icon: ICON_QRCODE_GEFUELLT, farbe: 'users', href: '/admin/settings/invite', info: 'invite' });
  }
  if (gemeindeleitung) {
    gemeinde.push({ id: 'dashboard', titel: 'Dashboard', text: 'Sichtbare Bereiche für Konfis und Team', icon: ICON_APPS, farbe: 'organizations', href: '/admin/settings/dashboard', info: 'dashboard' });
  }
  if (inhalte) {
    gemeinde.push({ id: 'zertifikate', titel: 'Zertifikate', text: 'Zertifikate fürs Team verwalten', icon: ICON_ABZEICHEN_GEFUELLT, farbe: 'teamer', href: '/admin/settings/certificates', info: 'certificates' });
  }
  if (gemeinde.length > 0) {
    gruppen.push({
      id: 'gemeinde',
      titel: 'Gemeinde',
      beschreibung: 'Wer dabei ist, in welchem Jahrgang und wie die Gemeinde die App einrichtet.',
      kacheln: gemeinde,
    });
  }

  const konto2: MehrKachel[] = [
    { id: 'profil', titel: 'Profil', text: 'Passwort und E-Mail ändern', icon: ICON_PERSON_GEFUELLT, farbe: 'users', href: '/admin/profile' },
    { id: 'tour', titel: 'App-Tour', text: 'Kurze Einführung durch die App', icon: ICON_KOMPASS, farbe: 'users', aktion: 'tour' },
    { id: 'neuigkeiten', titel: 'Was ist neu?', text: 'Die Neuerungen im Überblick', icon: ICON_FUNKELN, farbe: 'wrapped', aktion: 'neuigkeiten' },
    { id: 'mitmachen', titel: 'Events und Aktivitäten', text: 'So funktioniert der Mitmachen-Reiter', icon: ICON_TERMIN_GEFUELLT, farbe: 'events', aktion: 'mitmachen' },
  ];
  if (leitung) {
    konto2.push({ id: 'hilfe', titel: 'Hilfe und Support', text: 'Fragen, Fehler und Wünsche an den Support', icon: ICON_HILFE_GEFUELLT, farbe: 'chat', extern: SUPPORT_FORMULAR_URL });
  }
  gruppen.push({ id: 'konto', titel: 'Konto und Hilfe', beschreibung: 'Dein Profil, die Einführung und der Weg zum Support.', kacheln: konto2 });

  if (istSuperAdmin(konto)) {
    gruppen.push({
      id: 'support',
      titel: 'Support und Betrieb',
      beschreibung: 'Nur für Konten mit Super-Admin-Recht.',
      kacheln: [
        { id: 'support', titel: 'Support-Ansicht', text: 'Gemeinden, Anfragen, Struktur und Support-Konten', icon: ICON_SUPPORT, farbe: 'organizations', href: '/admin/support' },
        { id: 'betrieb', titel: 'Betrieb', text: 'Performance und Fehler des Servers', icon: ICON_PULS, farbe: 'chat', href: '/admin/metrics' },
      ],
    });
  }

  return gruppen;
}
