import { ICON_HINZUFUEGEN_GEFUELLT } from '../../shared/icons';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import React, { useCallback } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import OrganizationView from '../OrganizationView';
import WartungsHinweis from '../../shared/WartungsHinweis';
import LoadingSpinner from '../../common/LoadingSpinner';
import { triggerPullHaptic } from '../../../utils/haptics';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import { istSuperAdmin } from '../../../utils/superAdmin';
import WebGemeinden from '../../support/web/WebGemeinden';
import { useGemeindeAktionen } from './useGemeindeAktionen';

interface Organization {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  contact_email?: string;
  website?: string;
  kirchenkreis?: string | null;
  // Zuordnung aus der Struktur der Support-Ansicht (GET /organizations
  // liefert sie seit der Web-Version zusaetzlich; ein aelterer Server nicht).
  kirchenkreis_id?: number | null;
  landeskirche_id?: number | null;
  landeskirche?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_count: number;
  konfi_count: number;
  activity_count: number;
  event_count: number;
  badge_count: number;
}

// Die Darstellung der App und des schmalen Fensters: Liste mit Wischaktionen.
const GemeindenApp: React.FC = () => {
  // SWR-Cache für Organisationen
  const { data: organizationsData, loading, refresh: loadOrganizations } = useOfflineQuery<Organization[]>(
    'super-admin-organizations',
    useCallback(async () => {
      const response = await api.get('/organizations');
      return response.data;
    }, []),
    { ttl: CACHE_TTL.STAMMDATEN }
  );
  const organizations = organizationsData ?? [];

  // Formular "Gemeinde", direkter Sprung (?gemeinde=<id>) und Loeschen --
  // dieselben Aktionen wie in der Web-Fassung (useGemeindeAktionen).
  const { pageRef, bearbeiten, neu, loeschen } = useGemeindeAktionen(loadOrganizations);

  // Subscribe to live updates for organizations
  useLiveRefresh('organizations', loadOrganizations);

  return (
    <IonPage ref={pageRef}>
      {/* Kein Gemeinde-Umschalter: die Seite ist gemeindeuebergreifend (Betrieb). */}
      <AppKopfzeile
        titel="Gemeinden"
        onZurueck={() => window.history.back()}
        gemeindeUmschalter={false}
        rechts={(
          <IonButton aria-label="Neue Gemeinde anlegen" onClick={neu}>
            <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
          </IonButton>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Gemeinden" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadOrganizations();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Wartungshinweis des Betriebs (E-05) -- auch hier, damit der
            Super-Admin sieht, was gerade bei allen Rollen steht. */}
        <WartungsHinweis />

        {loading ? (
          <LoadingSpinner message="Gemeinden werden geladen..." />
        ) : (
          <>
            <OrganizationView
              organizations={organizations}
              onUpdate={loadOrganizations}
              onSelectOrganization={(organization) => bearbeiten(organization.id)}
              onDeleteOrganization={loeschen}
            />

            <div style={{ height: '32px' }} />
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite (docs/planung/support-web.md, Entscheidung 1):
// im breiten Browserfenster fuer Konten mit Super-Admin-Recht die Tabelle der
// Support-Ansicht (GET /support/gemeinden, nur Super-Admin), sonst die
// Darstellung der App -- unveraendert.
const AdminOrganizationsPage: React.FC = () => {
  const breit = useBreitesLayout();
  const { user } = useApp();
  return breit && istSuperAdmin(user) ? <WebGemeinden /> : <GemeindenApp />;
};

export default AdminOrganizationsPage;
