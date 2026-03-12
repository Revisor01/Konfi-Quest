import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonLabel,
  IonIcon,
  IonList,
  IonListHeader,
  IonButton,
  IonItem,
  IonToggle,
  IonSegment,
  IonSegmentButton,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import AdminInvitePage from './AdminInvitePage';
import {
  people,
  shield,
  business,
  pricetag,
  school,
  person,
  trophy,
  ribbon,
  logOut,
  flash,
  notifications,
  qrCode,
  appsOutline,
  add,
  createOutline,
  trash,
  documentOutline,
  document as documentIcon
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { logout } from '../../../services/auth';
import { useHistory } from 'react-router-dom';
import api from '../../../services/api';

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

interface CertificateType {
  id: number;
  name: string;
  icon: string;
  is_active: boolean;
}

const AdminSettingsPage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-settings');
  const { user, pushNotificationsPermission, requestPushPermissions, setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();
  const history = useHistory();

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

  const [dashboardSegment, setDashboardSegment] = useState<'konfi' | 'teamer'>('konfi');
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get('/settings');
        const data = response.data;
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
      } catch {
        // Defaults bleiben bestehen
      }
    };
    loadSettings();
    loadCertificateTypes();
  }, []);

  const loadCertificateTypes = async () => {
    try {
      const response = await api.get('/teamer/certificate-types');
      setCertificateTypes(response.data);
    } catch {
      // Ignorieren
    }
  };

  const handleDashboardToggle = async (key: keyof DashboardConfig, value: boolean) => {
    setDashboardConfig(prev => ({ ...prev, [key]: value }));
    try {
      await api.put('/settings', { [`dashboard_${key}`]: value });
    } catch {
      // Revert bei Fehler
      setDashboardConfig(prev => ({ ...prev, [key]: !value }));
      setError('Fehler beim Speichern der Dashboard-Einstellung');
    }
  };

  const handleTeamerDashboardToggle = async (key: keyof TeamerDashboardConfig, value: boolean) => {
    setTeamerDashboardConfig(prev => ({ ...prev, [key]: value }));
    try {
      await api.put('/settings', { [`teamer_dashboard_${key}`]: value });
    } catch {
      setTeamerDashboardConfig(prev => ({ ...prev, [key]: !value }));
      setError('Fehler beim Speichern der Teamer-Dashboard-Einstellung');
    }
  };

  const handleCreateCertificateType = () => {
    presentAlert({
      header: 'Neuen Zertifikat-Typ erstellen',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Name (z.B. JuLeiCa)' },
        { name: 'icon', type: 'text', placeholder: 'Icon-Name (z.B. ribbon, medkit)' }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Erstellen',
          handler: async (data) => {
            if (!data.name?.trim()) {
              setError('Bitte einen Namen eingeben');
              return false;
            }
            try {
              await api.post('/teamer/certificate-types', {
                name: data.name.trim(),
                icon: data.icon?.trim() || 'ribbon'
              });
              setSuccess('Zertifikat-Typ erstellt');
              loadCertificateTypes();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Erstellen');
            }
          }
        }
      ]
    });
  };

  const handleEditCertificateType = (certType: CertificateType) => {
    presentAlert({
      header: 'Zertifikat-Typ bearbeiten',
      inputs: [
        { name: 'name', type: 'text', value: certType.name, placeholder: 'Name' },
        { name: 'icon', type: 'text', value: certType.icon, placeholder: 'Icon-Name' }
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Speichern',
          handler: async (data) => {
            if (!data.name?.trim()) {
              setError('Bitte einen Namen eingeben');
              return false;
            }
            try {
              await api.put(`/teamer/certificate-types/${certType.id}`, {
                name: data.name.trim(),
                icon: data.icon?.trim() || certType.icon
              });
              setSuccess('Zertifikat-Typ aktualisiert');
              loadCertificateTypes();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Aktualisieren');
            }
          }
        }
      ]
    });
  };

  const handleDeleteCertificateType = (certType: CertificateType) => {
    presentAlert({
      header: 'Zertifikat-Typ loeschen',
      message: `"${certType.name}" wirklich loeschen? Dies ist nur moeglich, wenn keine Zuweisungen bestehen.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Loeschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/teamer/certificate-types/${certType.id}`);
              setSuccess('Zertifikat-Typ geloescht');
              loadCertificateTypes();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Loeschen - moeglicherweise noch Zuweisungen vorhanden');
            }
          }
        }
      ]
    });
  };

  const [presentInviteModal, dismissInviteModal] = useIonModal(AdminInvitePage, {
    onClose: () => dismissInviteModal(),
    dismiss: () => dismissInviteModal()
  });

  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Moechtest du dich wirklich abmelden?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: async () => {
            try {
              await logout();
              window.location.href = '/';
            } catch (error) {
console.error('Logout error:', error);
              // Fallback: direct logout even if token removal fails
              localStorage.removeItem('konfi_token');
              localStorage.removeItem('konfi_user');
              window.location.href = '/';
            }
          }
        }
      ]
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Mehr</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Mehr</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Konto */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={person} />
            </div>
            <IonLabel>Konto</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div
                className="app-list-item app-list-item--users app-settings-item"
                onClick={() => history.push('/admin/profile')}
              >
                <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                  <IonIcon icon={person} />
                </div>
                <div className="app-flex-fill">
                  <h2 className="app-settings-item__title">Profil</h2>
                  <p className="app-settings-item__subtitle">Passwort und E-Mail aendern</p>
                </div>
              </div>

              <div
                className="app-list-item app-list-item--users app-settings-item"
                onClick={() => pushNotificationsPermission !== 'granted' && requestPushPermissions()}
                style={{
                  cursor: pushNotificationsPermission !== 'granted' ? 'pointer' : 'default',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {pushNotificationsPermission === 'granted' && (
                  <div
                    className="app-corner-badge"
                    style={{ backgroundColor: '#059669' }}
                  >
                    Aktiviert
                  </div>
                )}
                <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                  <IonIcon icon={notifications} />
                </div>
                <div className="app-flex-fill">
                  <h2 className="app-settings-item__title">Benachrichtigungen</h2>
                  <p className="app-settings-item__subtitle">Chat-Nachrichten und Updates</p>
                </div>
              </div>

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* BLOCK 1: Verwaltung - fuer org_admin UND super_admin */}
        {(user?.role_name === 'org_admin' || user?.role_name === 'super_admin') && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={shield} />
              </div>
              <IonLabel>Verwaltung</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div
                  className="app-list-item app-list-item--users app-settings-item"
                  onClick={() => history.push('/admin/users')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                    <IonIcon icon={people} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Benutzer:innen</h2>
                    <p className="app-settings-item__subtitle">Admins, Teamer:innen und Rollen verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--users app-settings-item"
                  onClick={() => presentInviteModal({ presentingElement: presentingElement })}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
                    <IonIcon icon={qrCode} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Konfis einladen</h2>
                    <p className="app-settings-item__subtitle">QR-Code fuer Selbstregistrierung</p>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* System-Administration - NUR fuer super_admin */}
        {user?.role_name === 'super_admin' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={business} />
              </div>
              <IonLabel>System-Administration</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div
                  className="app-list-item app-list-item--success app-settings-item"
                  onClick={() => history.push('/admin/organizations')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--success">
                    <IonIcon icon={business} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Organisationen</h2>
                    <p className="app-settings-item__subtitle">Gemeinden und Organisationen verwalten</p>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* BLOCK 2: Inhalt -- nur fuer org_admin/teamer, NICHT fuer super_admin */}
        {user?.role_name !== 'super_admin' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={pricetag} />
              </div>
              <IonLabel>Inhalt</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <div
                  className="app-list-item app-list-item--activities app-settings-item"
                  onClick={() => history.push('/admin/activities')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--activities">
                    <IonIcon icon={flash} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Aktivitaeten</h2>
                    <p className="app-settings-item__subtitle">Aktivitaeten und Punkte verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--badges app-settings-item"
                  onClick={() => history.push('/admin/badges')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--badges">
                    <IonIcon icon={ribbon} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Badges</h2>
                    <p className="app-settings-item__subtitle">Auszeichnungen und Erfolge verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--jahrgang app-settings-item"
                  onClick={() => history.push('/admin/settings/jahrgaenge')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--jahrgang">
                    <IonIcon icon={school} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Jahrgaenge</h2>
                    <p className="app-settings-item__subtitle">Konfirmand:innen verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--categories app-settings-item"
                  onClick={() => history.push('/admin/settings/categories')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--categories">
                    <IonIcon icon={pricetag} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Kategorien</h2>
                    <p className="app-settings-item__subtitle">Kategorien fuer Aktivitaeten und Events</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--material app-settings-item"
                  onClick={() => history.push('/admin/material')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--material">
                    <IonIcon icon={documentIcon} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Material</h2>
                    <p className="app-settings-item__subtitle">Materialien und Dokumente verwalten</p>
                  </div>
                </div>

                <div
                  className="app-list-item app-list-item--level app-settings-item"
                  onClick={() => history.push('/admin/settings/levels')}
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--level">
                    <IonIcon icon={trophy} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Level-System</h2>
                    <p className="app-settings-item__subtitle">Punkte-Level und Belohnungen</p>
                  </div>
                </div>

                {/* Zertifikat-Typen */}
                <div
                  className="app-list-item app-list-item--badges app-settings-item"
                  style={{ cursor: 'default' }}
                >
                  <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: '#5b21b6' }}>
                    <IonIcon icon={documentOutline} />
                  </div>
                  <div className="app-flex-fill">
                    <h2 className="app-settings-item__title">Zertifikat-Typen</h2>
                    <p className="app-settings-item__subtitle">Zertifikat-Typen fuer Teamer:innen verwalten</p>
                  </div>
                </div>

              </IonCardContent>
            </IonCard>

            {/* Zertifikat-Typen CRUD */}
            <IonCard className="app-card" style={{ marginTop: '0' }}>
              <IonCardContent>
                {certificateTypes.length === 0 ? (
                  <div className="app-empty-state">
                    <p className="app-empty-state__text">Noch keine Zertifikat-Typen erstellt</p>
                  </div>
                ) : (
                  <IonList className="app-list-inner" lines="none">
                    {certificateTypes.map((certType, index) => (
                      <IonItemSliding key={certType.id} style={{ marginBottom: index < certificateTypes.length - 1 ? '8px' : '0' }}>
                        <IonItem
                          className="app-item-transparent"
                          detail={false}
                          lines="none"
                          onClick={() => handleEditCertificateType(certType)}
                        >
                          <div className="app-list-item" style={{ borderLeftColor: '#5b21b6' }}>
                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className="app-icon-circle" style={{ backgroundColor: '#5b21b6' }}>
                                  <IonIcon icon={ribbon} />
                                </div>
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title">{certType.name}</div>
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      <IonIcon icon={createOutline} />
                                      Icon: {certType.icon}
                                    </span>
                                    <span className="app-list-item__meta-item">
                                      {certType.is_active ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </IonItem>
                        <IonItemOptions className="app-swipe-actions" side="end">
                          <IonItemOption
                            className="app-swipe-action"
                            onClick={() => handleDeleteCertificateType(certType)}
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={trash} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      </IonItemSliding>
                    ))}
                  </IonList>
                )}
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleCreateCertificateType}
                  style={{ marginTop: '12px' }}
                >
                  <IonIcon icon={add} slot="start" />
                  Neuen Typ erstellen
                </IonButton>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Dashboard-Konfiguration - nur fuer org_admin */}
        {user?.role_name === 'org_admin' && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--users">
                <IonIcon icon={appsOutline} />
              </div>
              <IonLabel>Dashboard-Konfiguration</IonLabel>
            </IonListHeader>

            {/* Segment Toggle Konfi/Teamer */}
            <IonSegment
              value={dashboardSegment}
              onIonChange={(e) => setDashboardSegment(e.detail.value as 'konfi' | 'teamer')}
              style={{ marginBottom: '8px', padding: '0 16px' }}
            >
              <IonSegmentButton value="konfi">
                <IonLabel>Konfi</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="teamer">
                <IonLabel>Teamer</IonLabel>
              </IonSegmentButton>
            </IonSegment>

            {/* Konfi Dashboard Config */}
            {dashboardSegment === 'konfi' && (
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList style={{ background: 'transparent', padding: '0' }}>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Konfirmations-Countdown anzeigen</IonLabel>
                      <IonToggle
                        checked={dashboardConfig.show_konfirmation}
                        onIonChange={(e) => handleDashboardToggle('show_konfirmation', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Events anzeigen</IonLabel>
                      <IonToggle
                        checked={dashboardConfig.show_events}
                        onIonChange={(e) => handleDashboardToggle('show_events', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Tageslosung anzeigen</IonLabel>
                      <IonToggle
                        checked={dashboardConfig.show_losung}
                        onIonChange={(e) => handleDashboardToggle('show_losung', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Badges anzeigen</IonLabel>
                      <IonToggle
                        checked={dashboardConfig.show_badges}
                        onIonChange={(e) => handleDashboardToggle('show_badges', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel>Ranking anzeigen</IonLabel>
                      <IonToggle
                        checked={dashboardConfig.show_ranking}
                        onIonChange={(e) => handleDashboardToggle('show_ranking', e.detail.checked)}
                      />
                    </IonItem>
                  </IonList>
                </IonCardContent>
              </IonCard>
            )}

            {/* Teamer Dashboard Config */}
            {dashboardSegment === 'teamer' && (
              <IonCard className="app-card">
                <IonCardContent>
                  <IonList style={{ background: 'transparent', padding: '0' }}>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Zertifikate anzeigen</IonLabel>
                      <IonToggle
                        checked={teamerDashboardConfig.show_zertifikate}
                        onIonChange={(e) => handleTeamerDashboardToggle('show_zertifikate', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Events anzeigen</IonLabel>
                      <IonToggle
                        checked={teamerDashboardConfig.show_events}
                        onIonChange={(e) => handleTeamerDashboardToggle('show_events', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonLabel>Badges anzeigen</IonLabel>
                      <IonToggle
                        checked={teamerDashboardConfig.show_badges}
                        onIonChange={(e) => handleTeamerDashboardToggle('show_badges', e.detail.checked)}
                      />
                    </IonItem>
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonLabel>Tageslosung anzeigen</IonLabel>
                      <IonToggle
                        checked={teamerDashboardConfig.show_losung}
                        onIonChange={(e) => handleTeamerDashboardToggle('show_losung', e.detail.checked)}
                      />
                    </IonItem>
                  </IonList>
                </IonCardContent>
              </IonCard>
            )}
          </IonList>
        )}

        <div className="app-segment-wrapper">
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={handleLogout}
            className="app-action-button"
          >
            <IonIcon icon={logOut} slot="start" />
            Abmelden
          </IonButton>
        </div>

        <div className="ion-padding-bottom"></div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettingsPage;
