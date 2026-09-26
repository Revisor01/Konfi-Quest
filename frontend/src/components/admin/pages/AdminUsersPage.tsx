import { ICON_PERSON_HINZUFUEGEN_GEFUELLT, ICON_HINZUFUEGEN_GEFUELLT } from '../../shared/icons';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import { fehlerText } from '../../../utils/fehler';
import React, { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { offlineBlockiert } from '../../../utils/offlineAktion';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import UsersView from '../UsersView';
import LoadingSpinner from '../../common/LoadingSpinner';
import EinladungModal from '../modals/EinladungModal';
import UserManagementModal from '../modals/UserManagementModal';
import { AdminUser } from '../../../types/user';
import { triggerPullHaptic } from '../../../utils/haptics';

const AdminUsersPage: React.FC = () => {
  const { setError, user, isOnline } = useApp();
  const { pageRef, presentingElement } = useModalPage('admin-users');
  
  // Offline-Query: Users
  const { data: users, loading, refresh: refreshUsers, refreshLive: refreshUsersLive } = useOfflineQuery<AdminUser[]>(
    'admin:users:' + user?.organization_id,
    async () => { const res = await api.get('/users'); return res.data; },
    { ttl: CACHE_TTL.KONFIS }
  );
  
  // Modal state
  const [modalUserId, setModalUserId] = useState<number | null>(null);

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  // Einladung einer BESTEHENDEN Person in diese Gemeinde (26.09.2026) --
  // getrennt vom Anlegen, weil es etwas anderes tut: Hier entsteht kein Konto,
  // sondern eine Anfrage an jemanden, der schon eins hat.
  const [presentEinladungHook, dismissEinladungHook] = useIonModal(EinladungModal, {
    onClose: () => dismissEinladungHook(),
    onSuccess: () => { dismissEinladungHook(); refreshUsers(); }
  });

  const [presentUserModalHook, dismissUserModalHook] = useIonModal(UserManagementModal, {
    userId: modalUserId,
    onClose: () => {
      dismissUserModalHook();
      setModalUserId(null);
    },
    onSuccess: () => {
      dismissUserModalHook();
      setModalUserId(null);
      refreshUsers();
    }
  });

  // Subscribe to live updates for users
  useLiveRefresh('users', refreshUsersLive);

  const handleDeleteUser = async (userToDelete: AdminUser) => {
    if (offlineBlockiert(isOnline, setError)) return;
    presentAlert({
      header: 'Benutzer löschen',
      message: `Benutzer "${userToDelete.display_name}" (@${userToDelete.username}) wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/users/${userToDelete.id}`);
              await refreshUsers();
            } catch (err) {
              setError(fehlerText(err, 'Fehler beim Löschen des Benutzers'));
            }
          }
        }
      ]
    });
  };

  const handleSelectUser = (user: AdminUser) => {
    setModalUserId(user.id);
    presentUserModalHook({
      presentingElement: presentingElement
    });
  };

  const presentUserModal = () => {
    setModalUserId(null);
    presentUserModalHook({
      presentingElement: presentingElement
    });
  };

  return (
    <IonPage ref={pageRef}>
      {/* Kein Gemeinde-Umschalter auf dieser Unterseite (Simon, 25.09.2026). */}
      <AppKopfzeile
        titel="Benutzer:innen"
        onZurueck={() => window.history.back()}
        gemeindeUmschalter={false}
        rechts={user?.role_name === 'org_admin' ? (
          <>
            {/* Eine Person, die schon ein Konto hat, in diese Gemeinde
                einladen (26.09.2026). Sie entscheidet selbst. */}
            <IonButton aria-label="Person in diese Gemeinde einladen" onClick={() => presentEinladungHook({ presentingElement })}>
              <IonIcon icon={ICON_PERSON_HINZUFUEGEN_GEFUELLT} slot="icon-only" />
            </IonButton>
          <IonButton aria-label="Neue Benutzer:in anlegen" onClick={presentUserModal}>
            <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
          </IonButton>
          </>
        ) : undefined}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Benutzer:innen" />
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshUsers();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Benutzer werden geladen..." />
        ) : (
          <UsersView 
            users={users || []}
            onUpdate={refreshUsers}
            onSelectUser={handleSelectUser}
            onDeleteUser={handleDeleteUser}
            // Befund 16: Die Route /admin/users ist ungegatet. Verwalten darf
            // nur org_admin (users.js:385) — der Anlegen-Knopf oben prueft das
            // seit jeher, die Loesch-Wische in der Liste nicht.
            darfVerwalten={user?.role_name === 'org_admin'}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminUsersPage;