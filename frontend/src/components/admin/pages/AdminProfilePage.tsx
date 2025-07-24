import React, { useState, useEffect, useRef } from 'react';
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
  IonAlert,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import {
  person,
  key,
  mail,
  save,
  close,
  eye,
  eyeOff,
  arrowBack,
  logOut,
  checkmark,
  information
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import ChangeEmailModal from '../modals/ChangeEmailModal';
import ChangePasswordModal from '../modals/ChangePasswordModal';

const AdminProfilePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-profile');
  const { user, setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  
  // Email Modal mit useIonModal Hook
  const [presentEmailModalHook, dismissEmailModalHook] = useIonModal(ChangeEmailModal, {
    onClose: () => dismissEmailModalHook(),
    onSuccess: () => dismissEmailModalHook(),
    initialEmail: user?.email || ''
  });

  // Password Modal mit useIonModal Hook
  const [presentPasswordModalHook, dismissPasswordModalHook] = useIonModal(ChangePasswordModal, {
    onClose: () => dismissPasswordModalHook(),
    onSuccess: () => dismissPasswordModalHook()
  });

  useEffect(() => {
    // Setze das presentingElement nach dem ersten Mount
    setPresentingElement(pageRef.current);
  }, []);

  const handleOpenEmailModal = () => {
    presentEmailModalHook({
      presentingElement: presentingElement || undefined
    });
  };

  const handleOpenPasswordModal = () => {
    presentPasswordModalHook({
      presentingElement: presentingElement || undefined
    });
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
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start">
          <IonButton onClick={() => window.history.back()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonButtons>
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
            
            <IonItem button onClick={handleOpenEmailModal}>
              <IonIcon icon={mail} slot="start" color="primary" />
              <IonLabel>
                <h3>E-Mail-Adresse ändern</h3>
                <p>{user?.email ? `Aktuell: ${user.email}` : 'E-Mail für Benachrichtigungen und Passwort-Reset'}</p>
              </IonLabel>
            </IonItem>

            <IonItem button onClick={handleOpenPasswordModal}>
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

      </IonContent>
    </IonPage>
  );
};

export default AdminProfilePage;