import {
  ICON_AKTENTASCHE,
  ICON_EINSTELLUNGEN,
  ICON_GALERIE,
  ICON_LOESCHEN,
  ICON_MAIL,
  ICON_SCHLUESSEL,
  ICON_TERMIN,
} from '../../shared/icons';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import React, { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonList,
  IonListHeader,
  IonRefresher,
  IonRefresherContent,
  useIonAlert,
  useIonModal
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import { triggerPullHaptic } from '../../../utils/haptics';
import ChangeEmailModal from '../../shared/ChangeEmailModal';
import ChangePasswordModal from '../../shared/ChangePasswordModal';
import { useNeueEmailUebernehmen } from '../../shared/useEmailAendern';
import WebEmailAendern from '../../shared/web/konto/WebEmailAendern';
import WebPasswortAendern from '../../shared/web/konto/WebPasswortAendern';
import WebFunktionDialog from '../../shared/web/konto/WebFunktionDialog';
import WebKontoLoeschenDialog from '../../shared/web/konto/WebKontoLoeschenDialog';
import AppSperreSchalter from '../../shared/AppSperreSchalter';
import EinladungenKarte from '../../shared/EinladungenKarte';
import AbsturzberichteSchalter from '../../shared/AbsturzberichteSchalter';
import ChangeRoleTitleModal from '../modals/ChangeRoleTitleModal';
import DeleteAccountModal from '../../shared/DeleteAccountModal';
import { useMediaCacheControl } from '../../../hooks/useMediaCacheControl';
import { datumKurz } from '../../../utils/dateUtils';
import { rollenName, selbstbezeichnung } from '../../../utils/rollenNamen';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebSeite from '../../web/WebSeite';
import WebAdminProfil from '../web/start/WebAdminProfil';

const AdminProfilePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-profile');
  const { user, signOut } = useApp();
  const [presentAlert] = useIonAlert();
  const { cacheLabel, clearMediaCache: handleClearMediaCache } = useMediaCacheControl();
  // Browser ab 992 px: die Web-Fassung (web/start/WebAdminProfil), zweispaltig.
  const breit = useBreitesLayout();

  // Offline-Query: Profile (user-spezifisch)
  const { data: profileData, refresh: refreshProfile } = useOfflineQuery<{ role_title?: string; email?: string; created_at?: string }>(
    'user:me:' + user?.id,
    async () => { const res = await api.get('/auth/me'); return res.data; },
    { ttl: CACHE_TTL.SETTINGS }
  );

  // Nach einer neuen Adresse: Profil neu laden, dann die Adresse in den
  // Context und den TokenStore (App-Modal und Web-Dialog gleich).
  const emailUebernehmen = useNeueEmailUebernehmen(refreshProfile);
  // Im breiten Fenster (Web-Fassung) oeffnen E-Mail, Passwort,
  // Funktionsbeschreibung und Konto loeschen einen eigenen Dialog statt des
  // App-Modals (Simon, 11.10. und 15.10.2026) -- mit derselben Logik.
  const [webDialog, setWebDialog] = useState<'email' | 'passwort' | 'funktion' | 'loeschen' | null>(null);

  // Email Modal mit useIonModal Hook
  const [presentEmailModalHook, dismissEmailModalHook] = useIonModal(ChangeEmailModal, {
    onClose: () => dismissEmailModalHook(),
    onSuccess: async () => {
      dismissEmailModalHook();
      // User-Daten im Context aktualisieren
      await emailUebernehmen();
    },
    variante: 'users'
  });

  // Password Modal mit useIonModal Hook
  const [presentPasswordModalHook, dismissPasswordModalHook] = useIonModal(ChangePasswordModal, {
    onClose: () => dismissPasswordModalHook(),
    onSuccess: () => dismissPasswordModalHook(),
    variante: 'users'
  });

  // RoleTitle Modal mit useIonModal Hook
  const [presentRoleTitleModalHook, dismissRoleTitleModalHook] = useIonModal(ChangeRoleTitleModal, {
    onClose: () => dismissRoleTitleModalHook(),
    onSuccess: () => {
      dismissRoleTitleModalHook();
      refreshProfile();
    },
    initialRoleTitle: profileData?.role_title || ''
  });

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

  const handleOpenRoleTitleModal = () => {
    presentRoleTitleModalHook({
      presentingElement: presentingElement || undefined
    });
  };

  // Account-Löschung (D-01)
  const [presentDeleteAccount, dismissDeleteAccount] = useIonModal(DeleteAccountModal, {
    onClose: () => dismissDeleteAccount()
  });

  const handleOpenDeleteAccount = () => {
    presentDeleteAccount({
      presentingElement: presentingElement || undefined
    });
  };

  // Abmelden im Profil der Web-Fassung (15.10.2026): Die Karte „Konto"
  // kuendigte es an, hatte aber keinen Knopf. Dieselbe Rueckfrage wie unten
  // in der Seitenleiste (components/layout/Seitenleiste.tsx) und im Profil
  // von Konfis und Team.
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
            // signOut() ist failsafe -> garantiert zurueck zur Anmeldung.
            await signOut();
          }
        }
      ]
    });
  };

  if (breit) {
    const rolle = rollenName(user?.role_name, 'Leitung');
    const funktion = selbstbezeichnung(profileData?.role_title);
    return (
      <WebSeite bereich="Profil" titel="Mein Profil" untertitel="Konto und Einstellungen" pageRef={pageRef}>
        <WebAdminProfil
          name={user?.display_name || rolle}
          untertitel={funktion ? `${rolle} · ${funktion}` : rolle}
          benutzername={user?.username}
          email={profileData?.email || user?.email || ''}
          rolle={rolle}
          rolleName={user?.role_name}
          gemeinde={user?.organization}
          seit={profileData?.created_at ? datumKurz(profileData.created_at) : undefined}
          funktion={selbstbezeichnung(profileData?.role_title)}
          cacheLabel={cacheLabel}
          onFunktion={() => setWebDialog('funktion')}
          onEmail={() => setWebDialog('email')}
          onPasswort={() => setWebDialog('passwort')}
          onCache={handleClearMediaCache}
          onAbmelden={handleLogout}
          onLoeschen={() => setWebDialog('loeschen')}
        />
        {webDialog === 'email' && (
          <WebEmailAendern
            initialEmail={profileData?.email || user?.email || ''}
            onSchliessen={() => setWebDialog(null)}
            onGespeichert={() => { setWebDialog(null); void emailUebernehmen(); }}
          />
        )}
        {webDialog === 'passwort' && (
          <WebPasswortAendern onSchliessen={() => setWebDialog(null)} onGespeichert={() => setWebDialog(null)} />
        )}
        {webDialog === 'funktion' && (
          <WebFunktionDialog
            initialRoleTitle={profileData?.role_title || ''}
            onSchliessen={() => setWebDialog(null)}
            onGespeichert={() => { setWebDialog(null); void refreshProfile(); }}
          />
        )}
        {webDialog === 'loeschen' && <WebKontoLoeschenDialog onSchliessen={() => setWebDialog(null)} />}
      </WebSeite>
    );
  }

  return (
    <IonPage ref={pageRef}>
      {/* Kein Gemeinde-Umschalter: das Profil gehoert zum Konto, nicht zur Gemeinde. */}
      <AppKopfzeile titel="Profil" onZurueck={() => window.history.back()} gemeindeUmschalter={false} />

      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Profil" />

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshProfile().then(() => e.detail.complete());
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Header - Dashboard-Style mit Blasen-Effekt */}
        <div className="app-detail-header" style={{
          background: 'var(--app-gradient-admin)',
          // Marken-Glow des Admin-Hero — bleibt bewusst inline (05.09.2026, Token-Konsolidierung)
          boxShadow: '0 20px 40px rgba(var(--app-color-users-rgb), 0.35)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Floating Bubbles */}
          <div className="app-dashboard-header__circle" style={{ top: '-40px', right: '-40px', width: '140px', height: '140px', background: 'rgba(255, 255, 255, 0.08)' }} />
          <div className="app-dashboard-header__circle" style={{ top: '60px', right: '30px', width: '60px', height: '60px' }} />
          <div className="app-dashboard-header__circle" style={{ bottom: '-30px', left: '-30px', width: '100px', height: '100px' }} />
          <div className="app-dashboard-header__circle" style={{ bottom: '40px', left: '40px', width: '40px', height: '40px' }} />

          <div className="app-detail-header__content" style={{ padding: 'var(--app-freiraum-kopf-l) var(--app-abstand-weit) var(--app-abstand-weit) var(--app-abstand-weit)', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            {/* Avatar */}
            <div className="app-icon-circle" style={{
              width: '80px', height: '80px',
              background: 'rgba(255, 255, 255, 0.2)',
              marginBottom: 'var(--app-abstand-basis)',
              color: 'white', fontSize: 'var(--app-anzeige-zahl)', fontWeight: 'var(--app-schrift-halbfett)',
              border: '3px solid rgba(255, 255, 255, 0.3)'
            }}>
              {user?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <h1 className="app-detail-header__title">{user?.display_name || rollenName(user?.role_name, 'Leitung')}</h1>
            <p className="app-detail-header__subtitle">
              {/* Rolle nach role_name (utils/rollenNamen), wie ueberall in der App. */}
              {/* Dahinter die Selbstbezeichnung, getrimmt; nur Leerzeichen zaehlen nicht. */}
              {selbstbezeichnung(profileData?.role_title)
                ? `${rollenName(user?.role_name, 'Leitung')} · ${selbstbezeichnung(profileData?.role_title)}`
                : rollenName(user?.role_name, 'Leitung')}
            </p>
            <div className="app-detail-header__info-row" style={{ justifyContent: 'center' }}>
              {(profileData?.email || user?.email) && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={ICON_MAIL} style={{ fontSize: 'var(--app-text-sekundaer)' }} />
                  {profileData?.email || user?.email}
                </div>
              )}
              {profileData?.created_at && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={ICON_TERMIN} style={{ fontSize: 'var(--app-text-sekundaer)' }} />
                  Seit {datumKurz(profileData?.created_at)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Konto-Einstellungen - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={ICON_EINSTELLUNGEN} />
            </div>
            <IonLabel>Konto-Einstellungen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Funktionsbeschreibung */}
                <IonItem
                  button
                  onClick={handleOpenRoleTitleModal}
                  detail={false}
                  lines="none"
                  className="app-list-wrapper"
                >
                  <div
                    className="app-list-item app-list-item--users"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={ICON_AKTENTASCHE} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Funktionsbeschreibung</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {profileData?.role_title ? `Aktuell: ${profileData.role_title}` : 'z.B. Pastor, Diakonin'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* E-Mail ändern */}
                <IonItem
                  button
                  onClick={handleOpenEmailModal}
                  detail={false}
                  lines="none"
                  className="app-list-wrapper"
                >
                  <div
                    className="app-list-item app-list-item--users"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={ICON_MAIL} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">E-Mail-Adresse ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {(profileData?.email || user?.email) ? `Aktuell: ${profileData?.email || user?.email}` : 'E-Mail für Benachrichtigungen'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* Passwort ändern */}
                <IonItem
                  button
                  onClick={handleOpenPasswordModal}
                  detail={false}
                  lines="none"
                  className="app-list-wrapper"
                >
                  <div
                    className="app-list-item app-list-item--users"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={ICON_SCHLUESSEL} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Passwort ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">Sicherheitseinstellungen</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* Biometrische Anmeldung (blendet sich selbst aus, wenn das
                    Geraet keine eingerichtete Biometrie hat) */}

                {/* Medien-Cache leeren */}
                <IonItem
                  button
                  onClick={handleClearMediaCache}
                  detail={false}
                  lines="none"
                  className="app-list-wrapper"
                >
                  <div
                    className="app-list-item app-list-item--users"
                    style={{ width: '100%' }}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={ICON_GALERIE} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Medien-Cache leeren</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">{cacheLabel}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* App-Sperre: Face ID / Fingerabdruck vor der laufenden App */}
                <AppSperreSchalter variante="users" />
                {/* Absturzberichte an/aus (nur in der App, im Browser leer) */}
                <AbsturzberichteSchalter variante="users" />
                {/* Offene Einladungen in eine weitere Gemeinde -- im Profil
                    wie bei Konfis und Team; Push und Postfach fuehren hierher
                    (pushNavigation: gemeinde_einladung -> /admin/profile).
                    Bis zum 26.09.2026 stand die Karte auf dem Reiter "Mehr",
                    der Tipp auf die Mitteilung landete aber hier -- und fand
                    nichts. */}
                <EinladungenKarte variante="users" />
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        <div style={{ padding: '0 var(--app-abstand-basis)', marginTop: 'var(--app-abstand-basis)' }}>
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={handleOpenDeleteAccount}
            style={{
              height: '48px',
              borderRadius: 'var(--app-radius-karte)',
              fontWeight: 'var(--app-schrift-halbfett)'
            }}
          >
            <IonIcon icon={ICON_LOESCHEN} slot="start" />
            Account löschen
          </IonButton>
        </div>

        <div style={{ height: '32px' }} />
      </IonContent>
    </IonPage>
  );
};

export default AdminProfilePage;
