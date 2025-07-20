import React, { useState, useEffect } from 'react';
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
  IonButton,
  IonButtons,
  IonInput,
  IonModal,
  IonAlert,
  useIonAlert
} from '@ionic/react';
import {
  person,
  key,
  mail,
  save,
  close,
  eye,
  eyeOff,
  logOut,
  checkmark,
  information
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

const AdminProfilePage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Email form state
  const [emailData, setEmailData] = useState({
    email: ''
  });

  const handleChangePassword = async () => {
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      setError('Alle Passwort-Felder sind erforderlich');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Neue Passwörter stimmen nicht überein');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('Neues Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.current_password,
        newPassword: passwordData.new_password
      });
      setSuccess('Passwort erfolgreich geändert');
      setIsPasswordModalOpen(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    }
  };

  const handleUpdateEmail = async () => {
    if (!emailData.email.trim()) {
      setError('E-Mail-Adresse ist erforderlich');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.email)) {
      setError('Ungültige E-Mail-Adresse');
      return;
    }

    try {
      await api.post('/auth/update-email', {
        email: emailData.email.trim()
      });
      setSuccess('E-Mail-Adresse erfolgreich aktualisiert');
      setIsEmailModalOpen(false);
      setEmailData({ email: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren der E-Mail-Adresse');
    }
  };

  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Möchten Sie sich wirklich abmelden?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: () => {
            localStorage.removeItem('konfi_token');
            localStorage.removeItem('konfi_user');
            window.location.href = '/';
          }
        }
      ]
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Admin-Profil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        {/* Admin Info */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: '600'
              }}>
                {user?.display_name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '600' }}>
                {user?.display_name || 'Administrator'}
              </h1>
              <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
                Administrator
              </p>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Account Settings */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              Konto-Einstellungen
            </h3>
            
            <IonItem button onClick={() => setIsEmailModalOpen(true)}>
              <IonIcon icon={mail} slot="start" color="primary" />
              <IonLabel>
                <h3>E-Mail-Adresse ändern</h3>
                <p>E-Mail für Benachrichtigungen und Passwort-Reset</p>
              </IonLabel>
            </IonItem>

            <IonItem button onClick={() => setIsPasswordModalOpen(true)}>
              <IonIcon icon={key} slot="start" color="warning" />
              <IonLabel>
                <h3>Passwort ändern</h3>
                <p>Sicherheitseinstellungen</p>
              </IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* App Info */}
        <IonCard style={{ margin: '16px', borderRadius: '16px' }}>
          <IonCardContent>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '600' }}>
              App-Info
            </h3>
            <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
              <IonIcon icon={information} slot="start" color="primary" />
              <IonLabel>
                <h4>Konfi Quest</h4>
                <p>Version 2.0 - Ionic 8</p>
              </IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Logout */}
        <IonCard style={{ margin: '16px 16px 32px 16px', borderRadius: '16px' }}>
          <IonCardContent>
            <IonButton 
              expand="block" 
              color="danger" 
              fill="outline"
              onClick={handleLogout}
            >
              <IonIcon icon={logOut} slot="start" />
              Abmelden
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Change Email Modal */}
        <IonModal isOpen={isEmailModalOpen} onDidDismiss={() => setIsEmailModalOpen(false)}>
          <IonPage>
            <IonHeader>
              <IonToolbar>
                <IonTitle>E-Mail-Adresse ändern</IonTitle>
                <IonButtons slot="start">
                  <IonButton onClick={() => setIsEmailModalOpen(false)}>
                    <IonIcon icon={close} />
                  </IonButton>
                </IonButtons>
                <IonButtons slot="end">
                  <IonButton onClick={handleUpdateEmail}>
                    <IonIcon icon={save} />
                  </IonButton>
                </IonButtons>
              </IonToolbar>
            </IonHeader>
            <IonContent>
              <div style={{ padding: '16px' }}>
                <IonCard>
                  <IonCardContent>
                    <IonItem>
                      <IonLabel position="stacked">E-Mail-Adresse *</IonLabel>
                      <IonInput
                        type="email"
                        value={emailData.email}
                        onIonInput={(e) => setEmailData(prev => ({ ...prev, email: e.detail.value! }))}
                        placeholder="admin@konfi-quest.de"
                      />
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                <IonCard style={{ background: 'rgba(56, 128, 255, 0.1)' }}>
                  <IonCardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={information} color="primary" />
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#3880ff' }}>
                        Diese E-Mail-Adresse wird für Passwort-Reset und Benachrichtigungen verwendet.
                      </p>
                    </div>
                  </IonCardContent>
                </IonCard>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>

        {/* Change Password Modal */}
        <IonModal isOpen={isPasswordModalOpen} onDidDismiss={() => setIsPasswordModalOpen(false)}>
          <IonPage>
            <IonHeader>
              <IonToolbar>
                <IonTitle>Passwort ändern</IonTitle>
                <IonButtons slot="start">
                  <IonButton onClick={() => setIsPasswordModalOpen(false)}>
                    <IonIcon icon={close} />
                  </IonButton>
                </IonButtons>
                <IonButtons slot="end">
                  <IonButton onClick={handleChangePassword}>
                    <IonIcon icon={save} />
                  </IonButton>
                </IonButtons>
              </IonToolbar>
            </IonHeader>
            <IonContent>
              <div style={{ padding: '16px' }}>
                <IonCard>
                  <IonCardContent>
                    <IonItem>
                      <IonLabel position="stacked">Aktuelles Passwort *</IonLabel>
                      <IonInput
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.current_password}
                        onIonInput={(e) => setPasswordData(prev => ({ ...prev, current_password: e.detail.value! }))}
                        placeholder="Aktuelles Passwort eingeben"
                      />
                      <IonButton 
                        slot="end" 
                        fill="clear" 
                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      >
                        <IonIcon icon={showPasswords.current ? eyeOff : eye} />
                      </IonButton>
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Neues Passwort *</IonLabel>
                      <IonInput
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.new_password}
                        onIonInput={(e) => setPasswordData(prev => ({ ...prev, new_password: e.detail.value! }))}
                        placeholder="Neues Passwort eingeben"
                      />
                      <IonButton 
                        slot="end" 
                        fill="clear" 
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      >
                        <IonIcon icon={showPasswords.new ? eyeOff : eye} />
                      </IonButton>
                    </IonItem>

                    <IonItem>
                      <IonLabel position="stacked">Neues Passwort bestätigen *</IonLabel>
                      <IonInput
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirm_password}
                        onIonInput={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.detail.value! }))}
                        placeholder="Neues Passwort bestätigen"
                      />
                      <IonButton 
                        slot="end" 
                        fill="clear" 
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      >
                        <IonIcon icon={showPasswords.confirm ? eyeOff : eye} />
                      </IonButton>
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                <IonCard style={{ background: 'rgba(56, 128, 255, 0.1)' }}>
                  <IonCardContent>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={checkmark} color="primary" />
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#3880ff' }}>
                        Das Passwort muss mindestens 6 Zeichen lang sein.
                      </p>
                    </div>
                  </IonCardContent>
                </IonCard>
              </div>
            </IonContent>
          </IonPage>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default AdminProfilePage;