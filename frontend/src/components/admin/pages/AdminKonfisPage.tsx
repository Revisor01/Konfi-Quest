import React, { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import KonfisView from '../KonfisView';
import LoadingSpinner from '../../common/LoadingSpinner';
import KonfiModal from '../modals/KonfiModal';
import { triggerPullHaptic } from '../../../utils/haptics';

interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string; // Backend liefert jahrgang_name
  // Backend liefert diese Felder:
  gottesdienst_points?: number;
  gemeinde_points?: number;
  // Legacy support für alte Struktur:
  points?: {
    gottesdienst: number;
    gemeinde: number;
  };
  badgeCount?: number;
  activities_count?: number;
}

interface Jahrgang {
  id: number;
  name: string;
}

interface Settings {
  target_gottesdienst?: string;
  target_gemeinde?: string;
}


const AdminKonfisPage: React.FC = () => {
  const { setSuccess, setError, user, isOnline } = useApp();
  const history = useHistory();
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-konfis');
  
  // Offline-Query: Konfis
  const { data: konfis, loading: konfisLoading, refresh: refreshKonfis } = useOfflineQuery<Konfi[]>(
    'admin:konfis:' + user?.organization_id,
    async () => { const res = await api.get('/admin/konfis'); return res.data; },
    { ttl: CACHE_TTL.KONFIS }
  );

  // Offline-Query: Jahrgaenge
  const { data: jahrgaenge, refresh: refreshJahrgaenge } = useOfflineQuery<Jahrgang[]>(
    'admin:jahrgaenge:' + user?.organization_id,
    async () => { const res = await api.get('/admin/jahrgaenge'); return res.data; },
    { ttl: CACHE_TTL.STAMMDATEN }
  );

  // Offline-Query: Settings
  const { data: settings, refresh: refreshSettings } = useOfflineQuery<Settings>(
    'admin:settings:' + user?.organization_id,
    async () => { const res = await api.get('/settings'); return res.data; },
    { ttl: CACHE_TTL.SETTINGS }
  );

  const loading = konfisLoading;

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  const [presentKonfiModalHook, dismissKonfiModalHook] = useIonModal(KonfiModal, {
    jahrgaenge: jahrgaenge || [],
    onClose: () => dismissKonfiModalHook(),
    onSave: (konfiData: any) => {
      handleAddKonfi(konfiData);
      dismissKonfiModalHook();
    },
    dismiss: () => dismissKonfiModalHook()
  });

  // Memoized refresh function for live updates
  const refreshAll = useCallback(() => {
    refreshKonfis();
    refreshJahrgaenge();
    refreshSettings();
  }, [refreshKonfis, refreshJahrgaenge, refreshSettings]);

  // Subscribe to live updates for konfis
  useLiveRefresh('konfis', refreshAll);

  const handleDeleteKonfi = async (konfi: Konfi) => {
    if (!isOnline) return;
    presentAlert({
      header: 'Konfi löschen',
      message: `Konfi "${konfi.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/konfis/${konfi.id}`);
              setSuccess(`Konfi "${konfi.name}" gelöscht`);
              await refreshKonfis();
            } catch (err) {
              setError('Fehler beim Löschen');
            }
          }
        }
      ]
    });
  };

  const handleSelectKonfi = (konfi: Konfi) => {
    history.push(`/admin/konfis/${konfi.id}`);
  };

  const presentKonfiModal = () => {
    presentKonfiModalHook({
      presentingElement: presentingElement
    });
  };

  const handleAddKonfi = async (konfiData: any) => {
    try {
      const response = await api.post('/admin/konfis', konfiData);

      // Automatisch Jahrgangschat erstellen/zuweisen
      if (konfiData.jahrgang_id) {
        await createOrJoinJahrgangChat(konfiData.jahrgang_id, response.data.id);
      }

      const tempPassword = response.data.temporaryPassword;
      if (tempPassword) {
        presentAlert({
          header: 'Einmalpasswort',
          subHeader: tempPassword,
          message: `Konfi "${konfiData.display_name}" erstellt. Kopiere das Passwort und gib es dem Konfi weiter.`,
          buttons: [
            {
              text: 'Kopieren',
              handler: () => {
                navigator.clipboard.writeText(tempPassword);
                setSuccess('Passwort kopiert');
                return false;
              }
            },
            { text: 'Fertig', role: 'cancel' }
          ]
        });
      } else {
        setSuccess(`Konfi "${response.data.name}" erfolgreich hinzugefügt`);
      }

      // Sofortige Aktualisierung
      await refreshKonfis();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('Ein Konfi mit diesem Namen existiert bereits. Bitte wählen Sie einen anderen Namen.');
      } else {
        setError(err.response?.data?.error || 'Fehler beim Hinzufügen des Konfis');
      }
    }
  };

  const createOrJoinJahrgangChat = async (jahrgangId: number, konfiId: number) => {
    try {
      // Finde den Jahrgang-Namen
      const jahrgangResponse = await api.get(`/admin/jahrgaenge/${jahrgangId}`);
      const jahrgangName = jahrgangResponse.data.name;
      
      // Erstelle oder finde existierenden Jahrgangschat
      await api.post('/chat/rooms', {
        type: 'jahrgang',
        name: `Jahrgang ${jahrgangName}`,
        jahrgang_id: jahrgangId
      });
      
    } catch (err) {
 console.error('Fehler beim Jahrgangschat:', err);
      // Nicht als kritischer Fehler behandeln, da der Konfi bereits erstellt wurde
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Konfirmand:innen</IonTitle>
          <IonButtons slot="end">
            {['org_admin', 'admin'].includes(user?.role_name || '') && (
              <IonButton onClick={presentKonfiModal}>
                <IonIcon icon={add} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Konfirmand:innen</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          refreshAll();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Konfis werden geladen..." />
        ) : (
          <KonfisView 
            konfis={konfis || []}
            jahrgaenge={jahrgaenge || []}
            settings={settings || {}}
            onUpdate={refreshAll}
            onAddKonfiClick={presentKonfiModal}
            onSelectKonfi={handleSelectKonfi}
            onDeleteKonfi={handleDeleteKonfi}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminKonfisPage;