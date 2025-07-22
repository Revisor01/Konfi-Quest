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


const AdminKonfisPage: React.FC = () => {
  const { setSuccess, setError, user } = useApp();
  const history = useHistory();
  const { pageRef, presentingElement, cleanupModals } = useModalPage('konfis');
  
  // State
  const [konfis, setKonfis] = useState<Konfi[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
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
      const [konfisRes, jahrgaengeRes, settingsRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/admin/jahrgaenge'),
        api.get('/settings')
      ]);
      
      setKonfis(konfisRes.data);
      setJahrgaenge(jahrgaengeRes.data);
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
      
      // Automatisch Jahrgangschat erstellen/zuweisen
      if (konfiData.jahrgang_id) {
        await createOrJoinJahrgangChat(konfiData.jahrgang_id, response.data.id);
      }
      
      setSuccess(`Konfi "${response.data.name}" erfolgreich hinzugefügt`);
      // Sofortige Aktualisierung
      await loadData();
    } catch (err) {
      setError('Fehler beim Hinzufügen');
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
      
      console.log(`✅ Konfi zu Jahrgangschat "${jahrgangName}" hinzugefügt`);
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
            {user?.permissions?.includes('admin.konfis.create') && (
              <IonButton onClick={presentKonfiModal}>
                <IonIcon icon={add} />
              </IonButton>
            )}
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