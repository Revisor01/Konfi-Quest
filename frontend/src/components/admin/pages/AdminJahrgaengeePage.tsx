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
  IonCardHeader,
  IonCardContent,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonTextarea,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  add,
  school,
  createOutline,
  trashOutline,
  checkmarkOutline,
  closeOutline,
  people,
  arrowBack,
  calendar,
  trash
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

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* Section Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
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
            <IonIcon icon={school} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Jahrgang Details
          </h2>
        </div>

        {/* Card */}
        <IonCard style={{
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0',
          margin: '0 16px 16px 16px'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonItem lines="none" style={{
              '--background': '#f5f5f5',
              '--border-radius': '12px',
              '--padding-start': '16px',
              margin: '0 0 12px 0',
              border: '1px solid #e0e0e0',
              borderRadius: '12px'
            }}>
              <IonLabel position="stacked" style={{ marginBottom: '8px', color: '#666' }}>Name *</IonLabel>
              <IonInput
                value={formData.name}
                onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                placeholder="z.B. Jahrgang 2024/2025"
                disabled={loading}
              />
            </IonItem>

            <IonItem lines="none" style={{
              '--background': '#f5f5f5',
              '--border-radius': '12px',
              '--padding-start': '16px',
              margin: '0',
              border: '1px solid #e0e0e0',
              borderRadius: '12px'
            }}>
              <IonLabel position="stacked" style={{ marginBottom: '8px', color: '#666' }}>Konfirmationsdatum</IonLabel>
              <IonInput
                type="date"
                value={formData.confirmation_date}
                onIonInput={(e) => setFormData({ ...formData, confirmation_date: e.detail.value! })}
                disabled={loading}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>
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

        {/* Jahrgaenge List */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '8px 0' }}>
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
              jahrgaenge.map((jahrgang) => (
                <IonItemSliding
                  key={jahrgang.id}
                  ref={(el) => {
                    if (el) {
                      slidingRefs.current.set(jahrgang.id, el);
                    } else {
                      slidingRefs.current.delete(jahrgang.id);
                    }
                  }}
                >
                  <IonItem
                    button={canEdit}
                    onClick={canEdit ? () => openEditModal(jahrgang) : undefined}
                    detail={false}
                    style={{
                      '--min-height': '70px',
                      '--padding-start': '16px',
                      '--background': '#f5f5f5',
                      '--border-radius': '12px',
                      margin: '4px 8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px',
                      opacity: canEdit ? 1 : 0.6,
                      cursor: canEdit ? 'pointer' : 'default'
                    }}
                  >
                    <IonLabel>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: '#007aff',
                          marginTop: '2px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
                          flexShrink: 0
                        }}>
                          <IonIcon
                            icon={school}
                            style={{
                              fontSize: '0.9rem',
                              color: 'white'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h2 style={{
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            margin: '0 0 4px 0',
                            color: '#333'
                          }}>
                            {jahrgang.name}
                          </h2>
                          {jahrgang.confirmation_date && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <IonIcon icon={calendar} style={{ fontSize: '0.8rem', color: '#dc2626' }} />
                              <span style={{
                                fontSize: '0.8rem',
                                color: '#666'
                              }}>
                                Konfirmationsdatum: {new Date(jahrgang.confirmation_date).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </IonLabel>
                  </IonItem>

                  {canDelete && (
                    <IonItemOptions side="end" style={{
                      gap: '4px',
                      '--ion-item-background': 'transparent'
                    }}>
                      <IonItemOption
                        onClick={() => handleDeleteWithSlideClose(jahrgang)}
                        style={{
                          '--background': 'transparent',
                          '--background-activated': 'transparent',
                          '--background-focused': 'transparent',
                          '--background-hover': 'transparent',
                          '--color': 'transparent',
                          '--ripple-color': 'transparent',
                          padding: '0 8px',
                          paddingRight: '20px',
                          minWidth: '56px',
                          maxWidth: '56px'
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          backgroundColor: '#dc3545',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                        }}>
                          <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                        </div>
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