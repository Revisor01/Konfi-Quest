import React, { useState, useEffect, useRef } from 'react';
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
  useIonModal
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import KonfisView from '../KonfisView';
import LoadingSpinner from '../../common/LoadingSpinner';
import KonfiModal from '../modals/KonfiModal';

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

interface Activity {
  id: number;
  name: string;
  points: number;
}

const AdminKonfisPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const history = useHistory();
  const { pageRef, presentingElement, cleanupModals } = useModalPage('konfis');
  
  // State
  const [konfis, setKonfis] = useState<Konfi[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  
  // Modal mit useIonModal Hook - löst Tab-Navigation Problem
  const [presentKonfiModalHook, dismissKonfiModalHook] = useIonModal(KonfiModal, {
    jahrgaenge: jahrgaenge,
    onClose: () => dismissKonfiModalHook(),
    onSave: (konfiData: any) => {
      handleAddKonfi(konfiData);
      dismissKonfiModalHook();
    },
    dismiss: () => dismissKonfiModalHook()
  });

  useEffect(() => {
    loadData();
    // Setze das presentingElement nach dem ersten Mount
    
    // Event-Listener für Updates aus KonfiDetailView
    const handleKonfisUpdated = () => {
      loadData();
    };
    
    window.addEventListener('konfis-updated', handleKonfisUpdated);
    
    return () => {
      window.removeEventListener('konfis-updated', handleKonfisUpdated);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [konfisRes, jahrgaengeRes, activitiesRes, settingsRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/admin/jahrgaenge'),
        api.get('/admin/activities'),
        api.get('/settings')
      ]);
      
      setKonfis(konfisRes.data);
      setJahrgaenge(jahrgaengeRes.data);
      setActivities(activitiesRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKonfi = async (konfi: Konfi) => {
    if (!window.confirm(`Konfi "${konfi.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/admin/konfis/${konfi.id}`);
      setSuccess(`Konfi "${konfi.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadData();
    } catch (err) {
      setError('Fehler beim Löschen');
    }
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
      setSuccess(`Konfi "${response.data.name}" erfolgreich hinzugefügt`);
      // Sofortige Aktualisierung
      await loadData();
    } catch (err) {
      setError('Fehler beim Hinzufügen');
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Konfirmand:innen</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={presentKonfiModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Konfirmand:innen</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadData();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Konfis werden geladen..." />
        ) : (
          <KonfisView 
            konfis={konfis}
            jahrgaenge={jahrgaenge}
            settings={settings}
            onUpdate={loadData}
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