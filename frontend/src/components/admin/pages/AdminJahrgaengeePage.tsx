import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  useIonAlert,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSpinner
} from '@ionic/react';
import {
  add,
  school,
  checkmarkOutline,
  closeOutline,
  arrowBack,
  calendar,
  trash,
  schoolOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
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
            <IonButton onClick={handleClose} disabled={loading} style={{
              '--background': '#f8f9fa',
              '--background-hover': '#e9ecef',
              '--color': '#6c757d',
              '--border-radius': '8px'
            }}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSubmit}
              disabled={!formData.name.trim() || loading}
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

      <IonContent className="app-gradient-background">
        {/* Jahrgang Details - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--primary">
              <IonIcon icon={school} />
            </div>
            <IonLabel>Jahrgang Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={formData.name}
                    onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                    placeholder="z.B. Jahrgang 2024/2025"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Konfirmationsdatum</IonLabel>
                  <IonInput
                    type="date"
                    value={formData.confirmation_date}
                    onIonInput={(e) => setFormData({ ...formData, confirmation_date: e.detail.value! })}
                    disabled={loading}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

const AdminJahrgaengeePage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-jahrgaenge');
  const { user, setSuccess, setError } = useApp();

  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [loading, setLoading] = useState(true);
  const [editJahrgang, setEditJahrgang] = useState<Jahrgang | null>(null);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentJahrgangModalHook, dismissJahrgangModalHook] = useIonModal(JahrgangModal, {
    jahrgang: editJahrgang,
    onClose: () => dismissJahrgangModalHook(),
    onSuccess: () => {
      dismissJahrgangModalHook();
      loadJahrgaenge();
    }
  });

  // Memoized refresh function for live updates
  const refreshJahrgaenge = useCallback(() => {
    console.log('Live Update: Refreshing jahrgaenge...');
    loadJahrgaenge();
  }, []);

  // Subscribe to live updates for jahrgaenge
  useLiveRefresh('jahrgaenge', refreshJahrgaenge);

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

  const handleDeleteWithSlideClose = async (jahrgang: Jahrgang, forceDelete = false) => {
    const performDelete = async () => {
      const slidingElement = slidingRefs.current.get(jahrgang.id);
      try {
        const url = forceDelete ? `/admin/jahrgaenge/${jahrgang.id}?force=true` : `/admin/jahrgaenge/${jahrgang.id}`;
        await api.delete(url);
        setSuccess(`Jahrgang "${jahrgang.name}" gelöscht`);
        loadJahrgaenge();
      } catch (error: any) {
        if (slidingElement) {
          await slidingElement.close();
        }

        if (error.response?.data?.canForceDelete) {
          // Org Admin kann trotzdem löschen
          presentAlert({
            header: 'Chat-Nachrichten vorhanden',
            message: `${error.response.data.error}\n\nAls Organisation-Admin können Sie dennoch löschen. Dadurch werden ALLE Chat-Nachrichten unwiderruflich gelöscht!`,
            buttons: [
              { text: 'Abbrechen', role: 'cancel' },
              {
                text: 'Dennoch löschen',
                role: 'destructive',
                handler: () => handleDeleteWithSlideClose(jahrgang, true)
              }
            ]
          });
        } else {
          const errorMessage = error.response?.data?.error || 'Fehler beim Löschen des Jahrgangs';
          setError(errorMessage);
        }
      }
    };

    if (forceDelete) {
      await performDelete();
    } else {
      presentAlert({
        header: 'Jahrgang löschen',
        message: `Jahrgang "${jahrgang.name}" wirklich löschen?`,
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          {
            text: 'Löschen',
            role: 'destructive',
            handler: performDelete
          }
        ]
      });
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

  // Rollen-basierte Berechtigungen (org_admin und admin duerfen alles)
  const isAdmin = ['org_admin', 'admin'].includes(user?.role_name || '');
  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;


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
            {/* Header - Dashboard-Style */}
            <div style={{
              background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
              borderRadius: '24px',
              padding: '0',
              margin: '16px',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(0, 122, 255, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '12px',
                zIndex: 1
              }}>
                <h2 style={{
                  fontSize: '4rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.1)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  JAHRGÄNGE
                </h2>
              </div>

              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '70px 24px 24px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={school}
                    style={{
                      fontSize: '2rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '2rem', fontWeight: '800' }}>
                    {jahrgaenge.length}
                  </div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                    Jahrgänge
                  </div>
                </div>
              </div>
              </div>
            </div>

        {/* Jahrgaenge List - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--primary">
              <IonIcon icon={schoolOutline} />
            </div>
            <IonLabel>Jahrgänge ({jahrgaenge.length})</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              {jahrgaenge.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <IonIcon
                    icon={school}
                    style={{
                      fontSize: '3rem',
                      color: '#007aff',
                      marginBottom: '16px',
                      display: 'block',
                      margin: '0 auto 16px auto'
                    }}
                  />
                  <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Jahrgänge gefunden</h3>
                  <p style={{ color: '#999', margin: '0' }}>Noch keine Jahrgänge angelegt</p>
                </div>
              ) : (
                <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                  {jahrgaenge.map((jahrgang, index) => (
                    <IonItemSliding
                      key={jahrgang.id}
                      ref={(el) => {
                        if (el) {
                          slidingRefs.current.set(jahrgang.id, el);
                        } else {
                          slidingRefs.current.delete(jahrgang.id);
                        }
                      }}
                      style={{ marginBottom: index < jahrgaenge.length - 1 ? '8px' : '0' }}
                    >
                      <IonItem
                        button={canEdit}
                        onClick={canEdit ? () => openEditModal(jahrgang) : undefined}
                        detail={false}
                        lines="none"
                        className="app-list-item app-list-item--primary"
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--inner-padding-end': '0',
                          opacity: canEdit ? 1 : 0.6,
                          cursor: canEdit ? 'pointer' : 'default'
                        }}
                      >
                        <div className="app-icon-circle app-icon-circle--lg app-icon-circle--primary" slot="start" style={{ marginRight: '12px' }}>
                          <IonIcon icon={school} />
                        </div>
                        <IonLabel>
                          <h2 style={{ fontWeight: '600', fontSize: '0.95rem', margin: '0 0 4px 0', color: '#333' }}>
                            {jahrgang.name}
                          </h2>
                          {jahrgang.confirmation_date && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IonIcon icon={calendar} style={{ fontSize: '0.8rem', color: '#dc2626' }} />
                              <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                Konfirmationsdatum: {new Date(jahrgang.confirmation_date).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                          )}
                        </IonLabel>
                      </IonItem>

                      {canDelete && (
                        <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' }}>
                          <IonItemOption
                            onClick={() => handleDeleteWithSlideClose(jahrgang)}
                            style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                          >
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                              <IonIcon icon={trash} />
                            </div>
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>
          </>
        )}

      </IonContent>
    </IonPage>
  );
};

export default AdminJahrgaengeePage;