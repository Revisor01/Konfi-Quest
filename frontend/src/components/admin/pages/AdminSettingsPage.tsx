import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonList,
  IonButton,
  useIonAlert
} from '@ionic/react';
import {
  people,
  shield,
  business,
  pricetag,
  school,
  person,
  trophy,
  logOut,
  flash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import PushNotificationSettings from '../../common/PushNotificationSettings';
import { logout } from '../../../services/auth';

const AdminSettingsPage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-settings');
  const { user } = useApp();
  const [presentAlert] = useIonAlert();

  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Möchtest du dich wirklich abmelden?',
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
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Mehr</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* BLOCK 1: Verwaltung - für org_admin UND super_admin */}
        {(user?.role_name === 'org_admin' || user?.role_name === 'super_admin') && (
          <div style={{ margin: '16px 16px 8px 16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#007aff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={shield} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{
                fontWeight: '600',
                fontSize: '1.1rem',
                margin: '0',
                color: '#333'
              }}>
                Verwaltung
              </h2>
            </div>
            <IonCard style={{
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e0e0e0',
              margin: '0'
            }}>
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem
                    button
                    routerLink="/admin/users"
                    lines="none"
                    style={{
                      '--min-height': '56px',
                      '--padding-start': '16px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px'
                    }}
                  >
                    <div slot="start" style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#007aff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      <IonIcon icon={people} style={{ fontSize: '1.2rem', color: 'white' }} />
                    </div>
                    <IonLabel>
                      <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Benutzer:innen</h2>
                      <p style={{ fontSize: '0.8rem', color: '#666' }}>Admins, Teamer:innen und Rollen verwalten</p>
                    </IonLabel>
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* System-Administration - NUR für super_admin */}
        {user?.role_name === 'super_admin' && (
          <div style={{ margin: '16px 16px 8px 16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#2dd36f',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(45, 211, 111, 0.3)',
                flexShrink: 0
              }}>
                <IonIcon icon={business} style={{ fontSize: '1rem', color: 'white' }} />
              </div>
              <h2 style={{
                fontWeight: '600',
                fontSize: '1.1rem',
                margin: '0',
                color: '#333'
              }}>
                System-Administration
              </h2>
            </div>
            <IonCard style={{
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e0e0e0',
              margin: '0'
            }}>
              <IonCardContent style={{ padding: '16px' }}>
                <IonList style={{ background: 'transparent' }} lines="none">
                  <IonItem
                    button
                    routerLink="/admin/organizations"
                    lines="none"
                    style={{
                      '--min-height': '56px',
                      '--padding-start': '16px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px'
                    }}
                  >
                      <div slot="start" style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#2dd36f',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px'
                      }}>
                        <IonIcon icon={business} style={{ fontSize: '1.2rem', color: 'white' }} />
                      </div>
                      <IonLabel>
                        <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Organisationen</h2>
                        <p style={{ fontSize: '0.8rem', color: '#666' }}>Gemeinden und Organisationen verwalten</p>
                      </IonLabel>
                    </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* BLOCK 2: Inhalt */}
        <div style={{ margin: '16px 16px 8px 16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#ff9500',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
              flexShrink: 0
            }}>
              <IonIcon icon={pricetag} style={{ fontSize: '1rem', color: 'white' }} />
            </div>
            <h2 style={{
              fontWeight: '600',
              fontSize: '1.1rem',
              margin: '0',
              color: '#333'
            }}>
              Inhalt
            </h2>
          </div>
          <IonCard style={{
            borderRadius: '12px',
            background: 'white',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            border: '1px solid #e0e0e0',
            margin: '0'
          }}>
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }} lines="none">
                <IonItem
                  button
                  routerLink="/admin/activities"
                  lines="none"
                  style={{
                    '--min-height': '56px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <div slot="start" style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#16a34a',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon icon={flash} style={{ fontSize: '1.2rem', color: 'white' }} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Aktivitäten</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Aktivitäten und Punkte verwalten</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  button
                  routerLink="/admin/settings/categories"
                  lines="none"
                  style={{
                    '--min-height': '56px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <div slot="start" style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#ff9500',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon icon={pricetag} style={{ fontSize: '1.2rem', color: 'white' }} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Kategorien</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Kategorien für Aktivitäten und Events</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  button
                  routerLink="/admin/settings/jahrgaenge"
                  lines="none"
                  style={{
                    '--min-height': '56px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <div slot="start" style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#007aff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon icon={school} style={{ fontSize: '1.2rem', color: 'white' }} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Jahrgänge</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Konfirmand:innen verwalten</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  button
                  routerLink="/admin/settings/levels"
                  lines="none"
                  style={{
                    '--min-height': '56px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <div slot="start" style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#ff2d55',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon icon={trophy} style={{ fontSize: '1.2rem', color: 'white' }} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Level-System</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Punkte-Level und Belohnungen</p>
                  </IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>

        <div style={{ margin: '0 16px 16px 16px' }}>
          <PushNotificationSettings />
        </div>

        {/* Konto */}
        <div style={{ margin: '16px 16px 8px 16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#007aff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
              flexShrink: 0
            }}>
              <IonIcon icon={person} style={{ fontSize: '1rem', color: 'white' }} />
            </div>
            <h2 style={{
              fontWeight: '600',
              fontSize: '1.1rem',
              margin: '0',
              color: '#333'
            }}>
              Konto
            </h2>
          </div>
          <IonCard style={{
            borderRadius: '12px',
            background: 'white',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            border: '1px solid #e0e0e0',
            margin: '0'
          }}>
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }} lines="none">
                <IonItem
                  button
                  routerLink="/admin/profile"
                  lines="none"
                  style={{
                    '--min-height': '56px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <div slot="start" style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#007aff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px'
                  }}>
                    <IonIcon icon={person} style={{ fontSize: '1.2rem', color: 'white' }} />
                  </div>
                  <IonLabel>
                    <h2 style={{ fontWeight: '500', fontSize: '0.95rem' }}>Profil</h2>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>Passwort und E-Mail ändern</p>
                  </IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>

        <div style={{ margin: '16px', paddingBottom: '16px' }}>
          <IonButton
            expand="block"
            color="danger"
            fill="outline"
            onClick={handleLogout}
          >
            <IonIcon icon={logOut} slot="start" />
            Abmelden
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettingsPage;
