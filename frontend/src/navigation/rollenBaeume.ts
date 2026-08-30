import { home, people, chatbubbles, calendar, flash, flag, star, ellipsisHorizontal } from 'ionicons/icons';
import type { Rolle, RollenBaum } from './routes';

import AdminKonfisPage from '../components/admin/pages/AdminKonfisPage';
import AdminActivitiesPage from '../components/admin/pages/AdminActivitiesPage';
import AdminEventsPage from '../components/admin/pages/AdminEventsPage';
import AdminCategoriesPage from '../components/admin/pages/AdminCategoriesPage';
import AdminJahrgaengeePage from '../components/admin/pages/AdminJahrgaengeePage';
import AdminBadgesPage from '../components/admin/pages/AdminBadgesPage';
import AdminUsersPage from '../components/admin/pages/AdminUsersPage';
import AdminOrganizationsPage from '../components/admin/pages/AdminOrganizationsPage';
import AdminMetricsPage from '../components/admin/pages/AdminMetricsPage';
import AdminProfilePage from '../components/admin/pages/AdminProfilePage';
import AdminSettingsPage from '../components/admin/pages/AdminSettingsPage';
import AdminMaterialPage from '../components/admin/pages/AdminMaterialPage';
import AdminCertificatesPage from '../components/admin/pages/AdminCertificatesPage';
import AdminDashboardSettingsPage from '../components/admin/pages/AdminDashboardSettingsPage';
import AdminLevelsPage from '../components/admin/pages/AdminLevelsPage';
import AdminInvitePage from '../components/admin/pages/AdminInvitePage';
import AdminChallengesPage from '../components/admin/pages/AdminChallengesPage';
import ChatOverviewPage from '../components/chat/pages/ChatOverviewPage';
import ChatRoomView from '../components/chat/views/ChatRoomView';
import KonfiDetailView from '../components/admin/views/KonfiDetailView';
import EventDetailView from '../components/admin/views/EventDetailView';
import KonfiDashboardPage from '../components/konfi/pages/KonfiDashboardPage';
import KonfiEventsPage from '../components/konfi/pages/KonfiEventsPage';
import KonfiEventDetailPage from '../components/konfi/pages/KonfiEventDetailPage';
import KonfiBadgesPage from '../components/konfi/pages/KonfiBadgesPage';
import KonfiChallengesPage from '../components/konfi/pages/KonfiChallengesPage';
import KonfiProfilePage from '../components/konfi/pages/KonfiProfilePage';
import TeamerDashboardPage from '../components/teamer/pages/TeamerDashboardPage';
import TeamerEventsPage from '../components/teamer/pages/TeamerEventsPage';
import TeamerMaterialPage from '../components/teamer/pages/TeamerMaterialPage';
import TeamerMaterialDetailPage from '../components/teamer/pages/TeamerMaterialDetailPage';
import TeamerProfilePage from '../components/teamer/pages/TeamerProfilePage';
import TeamerBadgesPage from '../components/teamer/pages/TeamerBadgesPage';
import TeamerKonfiStatsPage from '../components/teamer/pages/TeamerKonfiStatsPage';
import TeamerChallengesPage from '../components/teamer/pages/TeamerChallengesPage';

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
      { path: '/admin/challenges', page: AdminChallengesPage },
      { path: '/admin/users', page: AdminUsersPage },
      { path: '/admin/organizations', page: AdminOrganizationsPage },
      { path: '/admin/material', page: AdminMaterialPage },
      { path: '/admin/profile', page: AdminProfilePage },
      // Auch im normalen Admin-Outlet: super_admins haben meist
      // role_name=org_admin (is_super_admin=true). Die Seite prüft die
      // Berechtigung serverseitig (403 für nicht-super-admins).
      { path: '/admin/metrics', page: AdminMetricsPage },
    ],
    redirects: [
      { from: '/admin', to: '/admin/konfis' },
      // Aktivitäten sind ein Segment im Mitmachen-Tab. Die alte Route bleibt
      // wegen bestehender Deep-Links aus Push-Nachrichten erhalten.
      { from: '/admin/requests', to: '/admin/events?segment=antraege' },
    ],
    tabs: [
      { tab: 'admin-konfis', href: '/admin/konfis', icon: people, label: 'Konfis' },
      { tab: 'admin-chat', href: '/admin/chat', icon: chatbubbles, label: 'Chat', badge: 'chat' },
      { tab: 'admin-events', href: '/admin/events', icon: flash, label: 'Mitmachen', badge: 'events' },
      { tab: 'admin-challenges', href: '/admin/challenges', icon: flag, label: 'Challenges', badge: 'challenges' },
      { tab: 'admin-settings', href: '/admin/settings', icon: ellipsisHorizontal, label: 'Mehr' },
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
      { path: '/teamer/challenges', page: TeamerChallengesPage },
      { path: '/teamer/profile/badges', page: TeamerBadgesPage },
      { path: '/teamer/profile/material', page: TeamerMaterialPage },
      { path: '/teamer/profile/konfi-stats', page: TeamerKonfiStatsPage },
      { path: '/teamer/profile', page: TeamerProfilePage },
    ],
    redirects: [
      { from: '/teamer', to: '/teamer/dashboard' },
      { from: '/teamer/requests', to: '/teamer/events?segment=antraege' },
    ],
    tabs: [
      { tab: 'teamer-dashboard', href: '/teamer/dashboard', icon: home, label: 'Start' },
      { tab: 'teamer-chat', href: '/teamer/chat', icon: chatbubbles, label: 'Chat', badge: 'chat' },
      { tab: 'teamer-events', href: '/teamer/events', icon: calendar, label: 'Mitmachen' },
      { tab: 'teamer-challenges', href: '/teamer/challenges', icon: flag, label: 'Challenges', badge: 'challenges' },
      { tab: 'teamer-badges', href: '/teamer/badges', icon: star, label: 'Badges', badge: 'badges' },
    ],
  },

  konfi: {
    home: '/konfi/dashboard',
    routes: [
      { path: '/konfi/dashboard', page: KonfiDashboardPage },
      { /* Holt sich die id selbst per useParams — kein propName noetig. */
        path: '/konfi/events/:id', page: KonfiEventDetailPage },
      { path: '/konfi/events', page: KonfiEventsPage },
      { path: '/konfi/badges', page: KonfiBadgesPage },
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
      { tab: 'dashboard', href: '/konfi/dashboard', icon: home, label: 'Start' },
      { tab: 'chat', href: '/konfi/chat', icon: chatbubbles, label: 'Chat', badge: 'chat' },
      { tab: 'challenges', href: '/konfi/challenges', icon: flag, label: 'Challenges' },
      { tab: 'events', href: '/konfi/events', icon: calendar, label: 'Mitmachen' },
      { tab: 'badges', href: '/konfi/badges', icon: star, label: 'Badges', badge: 'badges' },
    ],
  },

  // Super-Admins bekommen nur die Organisations-Verwaltung, ohne Tab-Leiste.
  super_admin: {
    home: '/admin/organizations',
    routes: [
      { path: '/admin/organizations', page: AdminOrganizationsPage },
      { path: '/admin/metrics', page: AdminMetricsPage },
    ],
    redirects: [{ from: '/admin', to: '/admin/organizations' }],
    tabs: [],
  },
};
