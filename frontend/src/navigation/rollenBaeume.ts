import { lazy } from 'react';
import type React from 'react';
import {
  ICON_CHALLENGE_GEFUELLT,
  ICON_CHATS_GEFUELLT,
  ICON_DATEI_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_MEHR,
  ICON_PERSON_GEFUELLT,
  ICON_STARTSEITE_GEFUELLT,
  ICON_ABZEICHEN_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../components/shared/icons';
import type { Rolle, RollenBaum } from './routes';
import { SUPPORT_MENUE } from './supportMenue';

// Code-Splitting entlang der Rollen (30.08.2026): Jede Seite wird per
// React.lazy erst geladen, wenn ihre Route erstmals rendert. Ein Konfi laedt
// damit nicht mehr die komplette Leitungsoberflaeche (52 Dateien, ~25.000
// Zeilen) mit, die er nie sieht. Vorher lag ALLES in einem Einstiegs-Bundle
// von ~3 MB (715 kB gepackt).
//
// faul() merkt sich zu jeder lazy-Seite ihren Lade-Thunk, damit
// ladeRolleVor() alle Seiten einer Rolle im Hintergrund NACHLADEN kann
// (MainTabs stoesst das kurz nach dem Start an). Das ist die
// Offline-Versicherung: Ist eine Seite einmal importiert, haelt die
// Modul-Registry sie im Speicher — ein spaeterer Tab-Wechsel braucht dann
// KEIN Netz mehr. Ohne das waere eine noch nie besuchte Seite offline
// unerreichbar (die App hat keinen Service Worker; nativ kommen die Chunks
// ohnehin aus dem App-Bundle von der Platte).

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Props sind kontravariant: Eine Tabelle, die Seiten mit UND ohne
Parameter-Props traegt, laesst sich nur ueber any gemeinsam typisieren
(ComponentType<Record<string, unknown>> nimmt die spezielleren Seiten
gerade nicht an). Dass Route und Props zusammenpassen, sichert
stattdessen __tests__/navigation/. */
type Lader = () => Promise<{ default: React.ComponentType<any> }>;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Props sind kontravariant: Eine Tabelle, die Seiten mit UND ohne
Parameter-Props traegt, laesst sich nur ueber any gemeinsam typisieren
(ComponentType<Record<string, unknown>> nimmt die spezielleren Seiten
gerade nicht an). Dass Route und Props zusammenpassen, sichert
stattdessen __tests__/navigation/. */
const LADER = new Map<React.ComponentType<any>, Lader>();

// Ein fehlgeschlagener lazy-Import bleibt in React DAUERHAFT kaputt (die
// Huelle merkt sich die Ablehnung bis zum Reload). Ein kurzer Funkabriss im
// falschen Moment wuerde die Route fuer die ganze Sitzung sperren — darum
// ein zweiter Versuch nach kurzer Pause, bevor der Fehler durchschlaegt.
const mitZweitversuch = (lade: Lader): Lader => async () => {
  try {
    return await lade();
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    return lade();
  }
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Props sind kontravariant: Eine Tabelle, die Seiten mit UND ohne
Parameter-Props traegt, laesst sich nur ueber any gemeinsam typisieren
(ComponentType<Record<string, unknown>> nimmt die spezielleren Seiten
gerade nicht an). Dass Route und Props zusammenpassen, sichert
stattdessen __tests__/navigation/. */
const faul = (lade: Lader): React.ComponentType<any> => {
  const laden = mitZweitversuch(lade);
  const Seite = lazy(laden);
  LADER.set(Seite, laden);
  return Seite;
};

// Welche Seiten-Chunks bereits im Speicher sind. MainTabs fragt das ab, um
// eine schon geladene Seite OHNE Umweg ueber einen Ladezustand zu rendern —
// sonst blitzt bei jedem Tab-Wechsel kurz der Spinner auf.
/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Dieselbe Menge wie bei LADER: Sie haelt genau die Komponenten, die `faul`
erzeugt, und traegt deshalb denselben Typ. Begruendung siehe oben. */
const GELADEN = new Set<React.ComponentType<any>>();

/** Ist der Chunk dieser Seite schon da? */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Props sind kontravariant, siehe Begruendung an LADER. */
export const istGeladen = (seite: React.ComponentType<any>): boolean => GELADEN.has(seite);

/**
 * Laedt den Chunk EINER Seite und merkt sich das.
 *
 * Gebraucht, damit der IonRouterOutlet nie einen Platzhalter gegen die
 * fertige Seite tauschen muss — diesen Tausch bekommt Ionic nicht mit
 * (Befund aus Simons Geraetetest, 31.08.2026: erster Aufruf weiss, zweiter
 * in Ordnung). Schlaegt das Laden fehl, wird NICHT als geladen vermerkt,
 * damit der naechste Versuch es erneut probiert.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Props sind kontravariant, siehe Begruendung an LADER. */
export const ladeSeite = async (seite: React.ComponentType<any>): Promise<void> => {
  if (GELADEN.has(seite)) return;
  const lader = LADER.get(seite);
  if (!lader) {
    // Keine lazy-Seite (etwa in Tests direkt hineingereicht) -> nichts zu laden.
    GELADEN.add(seite);
    return;
  }
  try {
    await lader();
    GELADEN.add(seite);
  } catch {
    // Offline oder Funkabriss: nicht vermerken, der naechste Aufruf versucht
    // es wieder. mitZweitversuch() hat bereits einmal nachgefasst.
  }
};

/** Nur fuer Tests: Ist diese Seite per ladeRolleVor() vorladbar? */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
Props sind kontravariant: Eine Tabelle, die Seiten mit UND ohne
Parameter-Props traegt, laesst sich nur ueber any gemeinsam typisieren
(ComponentType<Record<string, unknown>> nimmt die spezielleren Seiten
gerade nicht an). Dass Route und Props zusammenpassen, sichert
stattdessen __tests__/navigation/. */
export const hatLader = (seite: React.ComponentType<any>): boolean => LADER.has(seite);

/**
 * Laedt alle Seiten einer Rolle im Hintergrund nach (dedupliziert).
 * Liefert die Zahl der erfolgreich geladenen Module — Fehler (z.B. kein
 * Netz) werden geschluckt: Dann laedt die Seite eben beim ersten Besuch.
 */
export const ladeRolleVor = async (rolle: Rolle): Promise<number> => {
  const lader = new Set<Lader>();
  for (const route of BAEUME[rolle].routes) {
    const l = LADER.get(route.page);
    if (l) lader.add(l);
  }
  const ergebnisse = await Promise.allSettled([...lader].map((l) => l()));
  // Vorgeladene Seiten als geladen vermerken, damit der Renderer sie ohne
  // Ladezustand einhaengt.
  for (const route of BAEUME[rolle].routes) {
    if (LADER.has(route.page)) GELADEN.add(route.page);
  }
  return ergebnisse.filter((e) => e.status === 'fulfilled').length;
};

const AdminKonfisPage = faul(() => import('../components/admin/pages/AdminKonfisPage'));
const AdminActivitiesPage = faul(() => import('../components/admin/pages/AdminActivitiesPage'));
const AdminEventsPage = faul(() => import('../components/admin/pages/AdminEventsPage'));
const AdminCategoriesPage = faul(() => import('../components/admin/pages/AdminCategoriesPage'));
const AdminJahrgaengeePage = faul(() => import('../components/admin/pages/AdminJahrgaengeePage'));
const AdminBadgesPage = faul(() => import('../components/admin/pages/AdminBadgesPage'));
const AdminUsersPage = faul(() => import('../components/admin/pages/AdminUsersPage'));
const AdminOrganizationsPage = faul(() => import('../components/admin/pages/AdminOrganizationsPage'));
const AdminMetricsPage = faul(() => import('../components/admin/pages/AdminMetricsPage'));
const AdminProfilePage = faul(() => import('../components/admin/pages/AdminProfilePage'));
const AdminSettingsPage = faul(() => import('../components/admin/pages/AdminSettingsPage'));
const AdminMaterialPage = faul(() => import('../components/admin/pages/AdminMaterialPage'));
const AdminWrappedPage = faul(() => import('../components/admin/pages/AdminWrappedPage'));
const AdminCertificatesPage = faul(() => import('../components/admin/pages/AdminCertificatesPage'));
const AdminDashboardSettingsPage = faul(() => import('../components/admin/pages/AdminDashboardSettingsPage'));
const AdminLevelsPage = faul(() => import('../components/admin/pages/AdminLevelsPage'));
const AdminInvitePage = faul(() => import('../components/admin/pages/AdminInvitePage'));
const AdminChallengesPage = faul(() => import('../components/admin/pages/AdminChallengesPage'));
// Eine Challenge als eigene Seite fuer Team und Leitung (2.4.0) -- dieselbe
// Seite in beiden Baeumen, wie die Liste (shared/ChallengesPage).
const ChallengeLeitungPage = faul(() => import('../components/shared/ChallengeLeitungPage'));
const ChatOverviewPage = faul(() => import('../components/chat/pages/ChatOverviewPage'));
const ChatRoomView = faul(() => import('../components/chat/views/ChatRoomView'));
const KonfiDetailView = faul(() => import('../components/admin/views/KonfiDetailView'));
const EventDetailView = faul(() => import('../components/admin/views/EventDetailView'));
const KonfiDashboardPage = faul(() => import('../components/konfi/pages/KonfiDashboardPage'));
const KonfiEventsPage = faul(() => import('../components/konfi/pages/KonfiEventsPage'));
const KonfiEventDetailPage = faul(() => import('../components/konfi/pages/KonfiEventDetailPage'));
const KonfiBadgesPage = faul(() => import('../components/konfi/pages/KonfiBadgesPage'));
const KonfiChallengesPage = faul(() => import('../components/konfi/pages/KonfiChallengesPage'));
const KonfiChallengeDetailPage = faul(() => import('../components/konfi/pages/KonfiChallengeDetailPage'));
const KonfiProfilePage = faul(() => import('../components/konfi/pages/KonfiProfilePage'));
const TeamerDashboardPage = faul(() => import('../components/teamer/pages/TeamerDashboardPage'));
const TeamerEventsPage = faul(() => import('../components/teamer/pages/TeamerEventsPage'));
const TeamerMaterialPage = faul(() => import('../components/teamer/pages/TeamerMaterialPage'));
const TeamerProfilePage = faul(() => import('../components/teamer/pages/TeamerProfilePage'));
const TeamerBadgesPage = faul(() => import('../components/teamer/pages/TeamerBadgesPage'));
const TeamerKonfiStatsPage = faul(() => import('../components/teamer/pages/TeamerKonfiStatsPage'));
const TeamerChallengesPage = faul(() => import('../components/teamer/pages/TeamerChallengesPage'));
// Support-Ansicht der Web-Version (03.10.2026, docs/planung/web-version.md):
// Uebersicht, Struktur, Support-Konten. Dazu gehoeren die vorhandenen Seiten
// Gemeinden und Betrieb. Die Seiten zeigen sich nur Konten mit Super-Admin-Recht
// (components/support/SupportBausteine.tsx).
const SupportUebersichtPage = faul(() => import('../components/support/SupportUebersichtPage'));
const SupportStrukturPage = faul(() => import('../components/support/SupportStrukturPage'));
const SupportKontenPage = faul(() => import('../components/support/SupportKontenPage'));
// Support-Mail (03.10.2026, docs/planung/support-mail.md): Posteingang, eine
// Mail, Textbausteine.
const SupportPosteingangPage = faul(() => import('../components/support/SupportPosteingangPage'));
const SupportPostDetailPage = faul(() => import('../components/support/SupportPostDetailPage'));
const SupportTextbausteinePage = faul(() => import('../components/support/SupportTextbausteinePage'));
// Vorgaenge (03.10.2026, docs/planung/support-vorgaenge.md): jedes Anliegen --
// Anfrage, Formular, Mail, vom Support angelegt -- ist ein Vorgang. Die
// Anfrage und der Schriftwechsel einer Gemeinde haben keine eigenen Seiten
// mehr; ihre alten Adressen fuehren in die Vorgaenge (unten).
const SupportVorgaengePage = faul(() => import('../components/support/SupportVorgaengePage'));
const SupportVorgangDetailPage = faul(() => import('../components/support/SupportVorgangDetailPage'));
const SupportAnfrageWeiterleitungPage = faul(() => import('../components/support/SupportAnfrageWeiterleitungPage'));

// Die Routen der Support-Ansicht, in zwei Baeumen gleich: im Baum super_admin
// (Support-Konto ohne Gemeinde) und im Baum der Leitung, weil Simons Konto --
// Gemeindeleitung mit Super-Admin-Merkmal -- dort lebt und die Ansicht ueber
// "Mehr" erreicht (AdminSettingsPage). Andere Leitungen sehen keinen Weg
// dorthin; wer die Adresse eintippt, bekommt den Hinweis "Nur fuer den
// Support", und der Server antwortet ohnehin 403 (requireSuperAdmin).
// Alte Adressen (docs/planung/support-vorgaenge.md, Entscheidung 7): Die Liste
// der Anfragen ist ein Filter der Vorgaenge (Art „Neue Gemeinde"), der
// Schriftwechsel einer Gemeinde die Liste ihrer Vorgaenge -- mit „Schreiben".
// Eine einzelne Anfrage (/admin/support/anfragen/:id) ist eine Seite unter
// SUPPORT_ROUTEN: Sie sucht den Vorgang der Anfrage und ersetzt sich durch ihn.
// /post/gemeinde ohne Kennung fuehrt in den Posteingang statt auf eine Mail
// „gemeinde".
const SUPPORT_UMLEITUNGEN: RollenBaum['redirects'] = [
  { from: '/admin/support/anfragen', to: '/admin/support/vorgaenge?art=neue_gemeinde' },
  { from: '/admin/support/post/gemeinde/:id', to: '/admin/support/vorgaenge?gemeinde=:id' },
  { from: '/admin/support/post/gemeinde', to: '/admin/support/post' },
];

const SUPPORT_ROUTEN: RollenBaum['routes'] = [
  { path: '/admin/support', page: SupportUebersichtPage },
  { path: '/admin/support/vorgaenge/:id', page: SupportVorgangDetailPage, param: 'id', propName: 'vorgangId' },
  { path: '/admin/support/vorgaenge', page: SupportVorgaengePage },
  { path: '/admin/support/anfragen/:id', page: SupportAnfrageWeiterleitungPage, param: 'id', propName: 'anfrageId' },
  { path: '/admin/support/post/:id', page: SupportPostDetailPage, param: 'id', propName: 'nachrichtId' },
  { path: '/admin/support/post', page: SupportPosteingangPage },
  { path: '/admin/support/bausteine', page: SupportTextbausteinePage },
  { path: '/admin/support/struktur', page: SupportStrukturPage },
  { path: '/admin/support/konten', page: SupportKontenPage },
];

// Die drei Rollenbäume als Tabelle. Reihenfolge der Routen ist bedeutsam:
// spezifischere Pfade (/admin/events/:id) müssen VOR den allgemeineren
// stehen, sonst greift der falsche — das galt schon in der JSX-Fassung.

export const BAEUME: Record<Rolle, RollenBaum> = {
  admin: {
    home: '/admin/konfis',
    routes: [
      { path: '/admin/konfis', page: AdminKonfisPage },
      { path: '/admin/konfis/:id', page: KonfiDetailView, param: 'id', propName: 'konfiId' },
      { path: '/admin/chat', page: ChatOverviewPage },
      { path: '/admin/chat/room/:roomId', page: ChatRoomView, param: 'roomId', propName: 'roomId' },
      { path: '/admin/activities', page: AdminActivitiesPage },
      { path: '/admin/events/:id', page: EventDetailView, param: 'id', propName: 'eventId' },
      { path: '/admin/events', page: AdminEventsPage },
      { path: '/admin/settings/categories', page: AdminCategoriesPage },
      { path: '/admin/settings/jahrgaenge', page: AdminJahrgaengeePage },
      { path: '/admin/settings/levels', page: AdminLevelsPage },
      { path: '/admin/settings/invite', page: AdminInvitePage },
      { path: '/admin/settings/certificates', page: AdminCertificatesPage },
      { path: '/admin/settings/dashboard', page: AdminDashboardSettingsPage },
      { path: '/admin/settings', page: AdminSettingsPage },
      { path: '/admin/badges', page: AdminBadgesPage },
      // Eine Challenge als eigene Seite statt im Dialog (2.4.0, Simon
      // 02.10.2026: "damit man direkt auf die challenge linken kann aus
      // einem push"). Wie /admin/events/:id: Kennung als challengeId, der
      // Zurueck-Weg ohne Verlauf ist die Liste (MainTabs, elternPfad).
      { path: '/admin/challenges/:id', page: ChallengeLeitungPage, param: 'id', propName: 'challengeId' },
      { path: '/admin/challenges', page: AdminChallengesPage },
      { path: '/admin/users', page: AdminUsersPage },
      { path: '/admin/organizations', page: AdminOrganizationsPage },
      { path: '/admin/material', page: AdminMaterialPage },
      { path: '/admin/wrapped', page: AdminWrappedPage },
      { path: '/admin/profile', page: AdminProfilePage },
      // Auch im normalen Admin-Outlet: super_admins haben meist
      // role_name=org_admin (is_super_admin=true). Die Seite prüft die
      // Berechtigung serverseitig (403 für nicht-super-admins).
      { path: '/admin/metrics', page: AdminMetricsPage },
      ...SUPPORT_ROUTEN,
    ],
    redirects: [
      { from: '/admin', to: '/admin/konfis' },
      // Aktivitäten sind ein Segment im Mitmachen-Tab. Die alte Route bleibt
      // wegen bestehender Deep-Links aus Push-Nachrichten erhalten.
      { from: '/admin/requests', to: '/admin/events?segment=antraege' },
      ...SUPPORT_UMLEITUNGEN,
    ],
    tabs: [
      { tab: 'admin-konfis', href: '/admin/konfis', icon: ICON_GRUPPE_GEFUELLT, label: 'Konfis' },
      { tab: 'admin-chat', href: '/admin/chat', icon: ICON_CHATS_GEFUELLT, label: 'Chat', badge: 'chat' },
      // Kalender wie bei Teamer und Konfi (Simon, 05.09.2026): Derselbe Reiter
      // trug bei der Leitung einen Blitz, bei den anderen beiden einen
      // Kalender -- gleiche Beschriftung, anderes Zeichen.
      { tab: 'admin-events', href: '/admin/events', icon: ICON_TERMIN_GEFUELLT, label: 'Mitmachen', badge: 'events' },
      { tab: 'admin-challenges', href: '/admin/challenges', icon: ICON_CHALLENGE_GEFUELLT, label: 'Challenges', badge: 'challenges' },
      { tab: 'admin-settings', href: '/admin/settings', icon: ICON_MEHR, label: 'Mehr' },
    ],
    // Unten in der Seitenleiste der Web-Version, ueber „Abmelden".
    profil: { path: '/admin/profile', label: 'Profil', icon: ICON_PERSON_GEFUELLT },
    // Seiten ohne eigenen Eintrag in der Leiste werden ueber „Mehr" erreicht,
    // auch der Katalog der Aktivitaeten (wie in der App; der Reiter
    // „Aktivitaeten" unter Mitmachen zeigt die gemeldeten, Simon 06.10.2026).
    // Gemeinden und Betrieb haben im Konto mit Super-Admin-Recht eigene
    // Eintraege (die gehen vor).
    zugehoerig: [
      { von: '/admin/activities', zu: '/admin/settings' },
      { von: '/admin/users', zu: '/admin/settings' },
      { von: '/admin/badges', zu: '/admin/settings' },
      { von: '/admin/material', zu: '/admin/settings' },
      { von: '/admin/wrapped', zu: '/admin/settings' },
      { von: '/admin/metrics', zu: '/admin/settings' },
      { von: '/admin/organizations', zu: '/admin/settings' },
    ],
  },

  teamer: {
    home: '/teamer/dashboard',
    routes: [
      { path: '/teamer/dashboard', page: TeamerDashboardPage },
      { path: '/teamer/chat', page: ChatOverviewPage },
      { path: '/teamer/chat/room/:roomId', page: ChatRoomView, param: 'roomId', propName: 'roomId' },
      { path: '/teamer/events', page: TeamerEventsPage },
      { path: '/teamer/material', page: TeamerMaterialPage },
      { path: '/teamer/badges', page: TeamerBadgesPage },
      // Eigene Seite auch fuers Team (Festlegung 02.10.2026) -- anders als
      // beim Termin, dessen Teamer-Detail in der Liste lebt
      // (/teamer/events/:id unten bei den Umleitungen).
      { path: '/teamer/challenges/:id', page: ChallengeLeitungPage, param: 'id', propName: 'challengeId' },
      { path: '/teamer/challenges', page: TeamerChallengesPage },
      { path: '/teamer/profile/badges', page: TeamerBadgesPage },
      { path: '/teamer/profile/material', page: TeamerMaterialPage },
      { path: '/teamer/profile/konfi-stats', page: TeamerKonfiStatsPage },
      { path: '/teamer/profile', page: TeamerProfilePage },
    ],
    redirects: [
      { from: '/teamer', to: '/teamer/dashboard' },
      { from: '/teamer/requests', to: '/teamer/events?segment=antraege' },
      // Termin-Detail fuer Teamer:innen (24.09.2026). Ihre Detailansicht
      // lebt IN der Terminliste (TeamerEventsPage, selectedEvent) und wird
      // dort seit jeher ueber ?eventId= geoeffnet -- so springt das
      // Dashboard hinein. Die Termin-Pushes bauen dagegen fuer alle Rollen
      // /<rolle>/events/<id>; ohne diese Route fiel der Link in den Catch-all
      // und landete auf dem Dashboard, schlechter noch als die Liste. Der
      // Platzhalter :id wird beim Umleiten aus der URL gefuellt (MainTabs,
      // Umleitung). Kein zweites Termin-Detail: Eine eigene Seite unter
      // dieser Route haette die 1.900 Zeilen Detailansicht dupliziert oder
      // die Liste zweimal montiert.
      { from: '/teamer/events/:id', to: '/teamer/events?eventId=:id' },
    ],
    tabs: [
      { tab: 'teamer-dashboard', href: '/teamer/dashboard', icon: ICON_STARTSEITE_GEFUELLT, label: 'Start' },
      { tab: 'teamer-chat', href: '/teamer/chat', icon: ICON_CHATS_GEFUELLT, label: 'Chat', badge: 'chat' },
      // Reihenfolge wie beim Konfi (Simon, 04.09.2026): Challenges vor
      // Mitmachen -- beide Rollen sollen dieselbe Tab-Folge haben.
      { tab: 'teamer-challenges', href: '/teamer/challenges', icon: ICON_CHALLENGE_GEFUELLT, label: 'Challenges', badge: 'challenges' },
      { tab: 'teamer-events', href: '/teamer/events', icon: ICON_TERMIN_GEFUELLT, label: 'Mitmachen' },
      // Material in der Tab-Leiste, Badges dafuer im Profil (Simon,
      // 04.09.2026): Material braucht das Team im Alltag, Badges schaut man
      // gelegentlich an.
      { tab: 'teamer-material', href: '/teamer/profile/material', icon: ICON_DATEI_GEFUELLT, label: 'Material' },
    ],
    profil: { path: '/teamer/profile', label: 'Profil', icon: ICON_PERSON_GEFUELLT },
  },

  konfi: {
    home: '/konfi/dashboard',
    routes: [
      { path: '/konfi/dashboard', page: KonfiDashboardPage },
      { /* Holt sich die id selbst per useParams — kein propName noetig. */
        path: '/konfi/events/:id', page: KonfiEventDetailPage },
      { path: '/konfi/events', page: KonfiEventsPage },
      { path: '/konfi/badges', page: KonfiBadgesPage },
      { path: '/konfi/challenges/:id', page: KonfiChallengeDetailPage, param: 'id', propName: 'challengeId' },
      { path: '/konfi/challenges', page: KonfiChallengesPage },
      { path: '/konfi/chat', page: ChatOverviewPage },
      { path: '/konfi/chat/room/:roomId', page: ChatRoomView, param: 'roomId', propName: 'roomId' },
      { path: '/konfi/profile', page: KonfiProfilePage },
    ],
    redirects: [
      { from: '/konfi', to: '/konfi/dashboard' },
      { from: '/konfi/requests', to: '/konfi/events?segment=antraege' },
    ],
    tabs: [
      { tab: 'dashboard', href: '/konfi/dashboard', icon: ICON_STARTSEITE_GEFUELLT, label: 'Start' },
      { tab: 'chat', href: '/konfi/chat', icon: ICON_CHATS_GEFUELLT, label: 'Chat', badge: 'chat' },
      { tab: 'challenges', href: '/konfi/challenges', icon: ICON_CHALLENGE_GEFUELLT, label: 'Challenges', badge: 'challenges' },
      { tab: 'events', href: '/konfi/events', icon: ICON_TERMIN_GEFUELLT, label: 'Mitmachen' },
      { tab: 'badges', href: '/konfi/badges', icon: ICON_ABZEICHEN_GEFUELLT, label: 'Badges', badge: 'badges' },
    ],
    profil: { path: '/konfi/profile', label: 'Profil', icon: ICON_PERSON_GEFUELLT },
  },

  // Support-Konto ohne Gemeinde (Systemrolle super_admin): die
  // Support-Ansicht, ohne Reiterleiste. Startseite ist die Uebersicht -- sie
  // traegt auf schmalen Bildschirmen den Weg zu allen Bereichen und das
  // Abmelden; breit zeigt die Seitenleiste der Web-Version dieselben Bereiche
  // (`menue`, eine Liste mit der Uebersicht: navigation/supportMenue.ts).
  super_admin: {
    home: '/admin/support',
    routes: [
      ...SUPPORT_ROUTEN,
      { path: '/admin/organizations', page: AdminOrganizationsPage },
      { path: '/admin/metrics', page: AdminMetricsPage },
    ],
    redirects: [{ from: '/admin', to: '/admin/support' }, ...SUPPORT_UMLEITUNGEN],
    tabs: [],
    menue: [...SUPPORT_MENUE],
  },
};
