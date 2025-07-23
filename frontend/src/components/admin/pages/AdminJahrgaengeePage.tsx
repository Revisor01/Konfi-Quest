import React, { useState, useEffect, useRef } from 'react';
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
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonTextarea,
  IonSpinner
} from '@ionic/react';
import { 
  add, 
  school, 
  createOutline, 
  trashOutline,
  checkmarkOutline,
  closeOutline,
  people,
  arrowBack
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Jahrgang {
  id: number;
  name: string;
  confirmation_date?: string;
  created_at: string;
}

interface JahrgangModalProps {
  jahrgang?: Jahrgang | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const JahrgangModal: React.FC<JahrgangModalProps> = ({
  jahrgang,
  onClose,
  onSuccess,
  dismiss
}) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    confirmation_date: ''
  });

  useEffect(() => {
    if (jahrgang) {
      setFormData({
        name: jahrgang.name,
        confirmation_date: jahrgang.confirmation_date || ''
      });
    } else {
      setFormData({
        name: '',
        confirmation_date: ''
      });
    }
  }, [jahrgang]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        confirmation_date: formData.confirmation_date.trim() || null
      };

      if (jahrgang) {
        await api.put(`/admin/jahrgaenge/${jahrgang.id}`, payload);
        setSuccess('Jahrgang aktualisiert');
      } else {
        await api.post('/admin/jahrgaenge', payload);
        setSuccess('Jahrgang erstellt');
      }
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern des Jahrgangs');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {jahrgang ? 'Jahrgang bearbeiten' : 'Neuer Jahrgang'}
          </IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton 
              onClick={handleSubmit} 
              disabled={!formData.name.trim() || loading}
              strong={true}
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: '16px' }}>
          <IonItem>
            <IonLabel position="stacked">Name *</IonLabel>
            <IonInput
              value={formData.name}
              onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
              placeholder="z.B. Jahrgang 2024/2025"
              disabled={loading}
            />
          </IonItem>

          <IonItem style={{ marginTop: '16px' }}>
            <IonLabel position="stacked">Konfirmationsdatum</IonLabel>
            <IonInput
              type="date"
              value={formData.confirmation_date}
              onIonInput={(e) => setFormData({ ...formData, confirmation_date: e.detail.value! })}
              disabled={loading}
            />
          </IonItem>
        </div>
      </IonContent>
    </IonPage>
  );
};

const AdminJahrgaengeePage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('jahrgaenge');
  const { user, setSuccess, setError } = useApp();
  
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [loading, setLoading] = useState(true);
  const [editJahrgang, setEditJahrgang] = useState<Jahrgang | null>(null);

  // Modal mit useIonModal Hook
  const [presentJahrgangModalHook, dismissJahrgangModalHook] = useIonModal(JahrgangModal, {
    jahrgang: editJahrgang,
    onClose: () => dismissJahrgangModalHook(),
    onSuccess: () => {
      dismissJahrgangModalHook();
      loadJahrgaenge();
    }
  });

  const loadJahrgaenge = async () => {
    try {
      const response = await api.get('/admin/jahrgaenge');
      setJahrgaenge(response.data);
    } catch (error) {
      setError('Fehler beim Laden der Jahrgänge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJahrgaenge();
  }, []);

  const handleRefresh = async (event: CustomEvent) => {
    await loadJahrgaenge();
    (event.target as HTMLIonRefresherElement).complete();
  };

  const handleDelete = async (jahrgang: Jahrgang) => {
    if (!window.confirm(`Jahrgang "${jahrgang.name}" wirklich löschen?`)) return;
    
    try {
      await api.delete(`/admin/jahrgaenge/${jahrgang.id}`);
      setSuccess(`Jahrgang "${jahrgang.name}" gelöscht`);
      loadJahrgaenge();
    } catch (error: any) {
      if (error.response?.status === 400) {
        setError('Jahrgang kann nicht gelöscht werden - wird bereits von Konfis verwendet');
      } else {
        setError('Fehler beim Löschen des Jahrgangs');
      }
    }
  };

  const openCreateModal = () => {
    setEditJahrgang(null);
    presentJahrgangModalHook({ presentingElement });
  };

  const openEditModal = (jahrgang: Jahrgang) => {
    setEditJahrgang(jahrgang);
    presentJahrgangModalHook({ presentingElement });
  };

  // Permission checks
  const canCreate = user?.permissions?.includes('admin.jahrgaenge.create') || false;
  const canEdit = user?.permissions?.includes('admin.jahrgaenge.edit') || false;
  const canDelete = user?.permissions?.includes('admin.jahrgaenge.delete') || false;


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Jahrgänge</IonTitle>
          {canCreate && (
            <IonButtons slot="end">
              <IonButton onClick={openCreateModal}>
                <IonIcon icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Jahrgänge</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Jahrgänge werden geladen..." />
        ) : (
          <>
            {/* Header Statistics Card */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <IonIcon icon={school} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                  {jahrgaenge.length}
                </h3>
                <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                  Jahrgänge
                </p>
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Jahrgaenge List */}
        <IonCard style={{ margin: '16px', marginTop: '8px' }}>
          <IonCardContent style={{ padding: '0' }}>
            {jahrgaenge.length === 0 ? (
              <IonItem lines="none">
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Noch keine Jahrgänge angelegt</p>
                </IonLabel>
              </IonItem>
            ) : (
              jahrgaenge.map((jahrgang) => (
                <IonItemSliding key={jahrgang.id}>
                  <IonItem 
                    button={canEdit}
                    onClick={canEdit ? () => openEditModal(jahrgang) : undefined}
                    style={{ 
                      '--min-height': '60px',
                      opacity: canEdit ? 1 : 0.6,
                      cursor: canEdit ? 'pointer' : 'default'
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
                      <IonIcon 
                        icon={school} 
                        style={{ 
                          fontSize: '1.2rem', 
                          color: 'white'
                        }} 
                      />
                    </div>
                    <IonLabel>
                      <h2 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                        {jahrgang.name}
                      </h2>
                      {jahrgang.confirmation_date && (
                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.85rem', 
                          color: '#666' 
                        }}>
                          Konfirmation: {new Date(jahrgang.confirmation_date).toLocaleDateString('de-DE')}
                        </p>
                      )}
                    </IonLabel>
                  </IonItem>
                  
                  {canDelete && (
                    <IonItemOptions side="end">
                      <IonItemOption 
                        color="danger" 
                        onClick={() => handleDelete(jahrgang)}
                      >
                        <IonIcon icon={trashOutline} />
                      </IonItemOption>
                    </IonItemOptions>
                  )}
                </IonItemSliding>
              ))
            )}
          </IonCardContent>
        </IonCard>
          </>
        )}

      </IonContent>
    </IonPage>
  );
};

export default AdminJahrgaengeePage;