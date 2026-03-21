import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonToggle,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { arrowBack, appsOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import { SectionHeader } from '../../shared';
import LoadingSpinner from '../../common/LoadingSpinner';
import { triggerPullHaptic } from '../../../utils/haptics';

interface DashboardConfig {
  show_konfirmation: boolean;
  show_events: boolean;
  show_losung: boolean;
  show_badges: boolean;
  show_ranking: boolean;
}

interface TeamerDashboardConfig {
  show_zertifikate: boolean;
  show_events: boolean;
  show_badges: boolean;
  show_losung: boolean;
}

const AdminDashboardSettingsPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const [dashboardSegment, setDashboardSegment] = useState<'konfi' | 'teamer'>('konfi');

  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({
    show_konfirmation: true,
    show_events: true,
    show_losung: true,
    show_badges: true,
    show_ranking: true
  });

  const [teamerDashboardConfig, setTeamerDashboardConfig] = useState<TeamerDashboardConfig>({
    show_zertifikate: true,
    show_events: true,
    show_badges: true,
    show_losung: true
  });

  // Offline-Query: Settings
  const { loading, refresh: refreshSettings } = useOfflineQuery<any>(
    'admin:settings:' + user?.organization_id,
    async () => { const res = await api.get('/settings'); return res.data; },
    {
      ttl: CACHE_TTL.SETTINGS,
      onSuccess: (data: any) => {
        setDashboardConfig({
          show_konfirmation: data.dashboard_show_konfirmation ?? true,
          show_events: data.dashboard_show_events ?? true,
          show_losung: data.dashboard_show_losung ?? true,
          show_badges: data.dashboard_show_badges ?? true,
          show_ranking: data.dashboard_show_ranking ?? true
        });
        setTeamerDashboardConfig({
          show_zertifikate: data.teamer_dashboard_show_zertifikate ?? true,
          show_events: data.teamer_dashboard_show_events ?? true,
          show_badges: data.teamer_dashboard_show_badges ?? true,
          show_losung: data.teamer_dashboard_show_losung ?? true
        });
      }
    }
  );

  const handleDashboardToggle = async (key: keyof DashboardConfig, value: boolean) => {
    // Optimistic UI zuerst
    setDashboardConfig(prev => ({ ...prev, [key]: value }));

    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'PUT',
        url: '/settings',
        body: { [`dashboard_${key}`]: value },
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `dashboard-${key}-${Date.now()}`, label: 'Dashboard-Einstellung' },
      });
      return;
    }

    try {
      await api.put('/settings', { [`dashboard_${key}`]: value });
    } catch {
      // Revert bei Fehler
      setDashboardConfig(prev => ({ ...prev, [key]: !value }));
      setError('Fehler beim Speichern');
    }
  };

  const handleTeamerDashboardToggle = async (key: keyof TeamerDashboardConfig, value: boolean) => {
    // Optimistic UI zuerst
    setTeamerDashboardConfig(prev => ({ ...prev, [key]: value }));

    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'PUT',
        url: '/settings',
        body: { [`teamer_dashboard_${key}`]: value },
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `teamer-dashboard-${key}-${Date.now()}`, label: 'Teamer-Dashboard-Einstellung' },
      });
      return;
    }

    try {
      await api.put('/settings', { [`teamer_dashboard_${key}`]: value });
    } catch {
      // Revert bei Fehler
      setTeamerDashboardConfig(prev => ({ ...prev, [key]: !value }));
      setError('Fehler beim Speichern');
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Dashboard</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <LoadingSpinner fullScreen message="Einstellungen werden geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Dashboard</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await refreshSettings();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <SectionHeader
          title="Dashboard"
          subtitle="Sichtbare Bereiche konfigurieren"
          icon={appsOutline}
          colors={{ primary: '#667eea', secondary: '#5a67d8' }}
          stats={[
            { value: Object.values(dashboardConfig).filter(Boolean).length, label: 'Konfi' },
            { value: Object.values(teamerDashboardConfig).filter(Boolean).length, label: 'Teamer' }
          ]}
        />

        <div className="app-segment-wrapper">
          <IonSegment
            value={dashboardSegment}
            onIonChange={(e) => setDashboardSegment(e.detail.value as 'konfi' | 'teamer')}
          >
            <IonSegmentButton value="konfi">
              <IonLabel>Konfi</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="teamer">
              <IonLabel>Teamer:innen</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {dashboardSegment === 'konfi' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--settings">
                <IonIcon icon={appsOutline} />
              </div>
              <IonLabel>Konfi-Dashboard</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList style={{ background: 'transparent', padding: '0' }}>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Konfirmations-Countdown</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={dashboardConfig.show_konfirmation}
                      onIonChange={(e) => handleDashboardToggle('show_konfirmation', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Events</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={dashboardConfig.show_events}
                      onIonChange={(e) => handleDashboardToggle('show_events', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Tageslosung</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={dashboardConfig.show_losung}
                      onIonChange={(e) => handleDashboardToggle('show_losung', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Badges</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={dashboardConfig.show_badges}
                      onIonChange={(e) => handleDashboardToggle('show_badges', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel>Ranking</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={dashboardConfig.show_ranking}
                      onIonChange={(e) => handleDashboardToggle('show_ranking', e.detail.checked)}
                    />
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {dashboardSegment === 'teamer' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--settings">
                <IonIcon icon={appsOutline} />
              </div>
              <IonLabel>Teamer:innen-Dashboard</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <IonList style={{ background: 'transparent', padding: '0' }}>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Zertifikate</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={teamerDashboardConfig.show_zertifikate}
                      onIonChange={(e) => handleTeamerDashboardToggle('show_zertifikate', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Events</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={teamerDashboardConfig.show_events}
                      onIonChange={(e) => handleTeamerDashboardToggle('show_events', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent' }}>
                    <IonLabel>Badges</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={teamerDashboardConfig.show_badges}
                      onIonChange={(e) => handleTeamerDashboardToggle('show_badges', e.detail.checked)}
                    />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel>Tageslosung</IonLabel>
                    <IonToggle
                      slot="end"
                      checked={teamerDashboardConfig.show_losung}
                      onIonChange={(e) => handleTeamerDashboardToggle('show_losung', e.detail.checked)}
                    />
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboardSettingsPage;
