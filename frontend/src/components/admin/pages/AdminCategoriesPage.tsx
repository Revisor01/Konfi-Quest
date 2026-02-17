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
  IonTextarea,
  IonSpinner
} from '@ionic/react';
import {
  add,
  pricetag,
  checkmarkOutline,
  closeOutline,
  arrowBack,
  trash,
  informationCircleOutline,
  pricetagOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Category {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

interface CategoryModalProps {
  category?: Category | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  category,
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
    description: ''
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || ''
      });
    } else {
      setFormData({
        name: '',
        description: ''
      });
    }
  }, [category]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null
      };

      if (category) {
        await api.put(`/admin/categories/${category.id}`, payload);
        setSuccess('Kategorie aktualisiert');
      } else {
        await api.post('/admin/categories', payload);
        setSuccess('Kategorie erstellt');
      }
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern der Kategorie');
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
            {category ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
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
        {/* Kategorie Details - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={pricetag} />
            </div>
            <IonLabel>Kategorie Details</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={formData.name}
                    onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                    placeholder="z.B. Ausflug, Gottesdienst"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Beschreibung</IonLabel>
                  <IonTextarea
                    value={formData.description}
                    onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                    placeholder="Beschreibung der Kategorie..."
                    rows={3}
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

const AdminCategoriesPage: React.FC = () => {
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-categories');
  const { user, setSuccess, setError } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentCategoryModalHook, dismissCategoryModalHook] = useIonModal(CategoryModal, {
    category: editCategory,
    onClose: () => dismissCategoryModalHook(),
    onSuccess: () => {
      dismissCategoryModalHook();
      loadCategories();
    }
  });

  // Memoized refresh function for live updates
  const refreshCategories = useCallback(() => {
 console.log('Live Update: Refreshing categories...');
    loadCategories();
  }, []);

  // Subscribe to live updates for categories
  useLiveRefresh('categories', refreshCategories);

  const loadCategories = async () => {
    try {
      const response = await api.get('/admin/categories');
      setCategories(response.data);
    } catch (error) {
      setError('Fehler beim Laden der Kategorien');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);


  const handleRefresh = async (event: CustomEvent) => {
    await loadCategories();
    (event.target as HTMLIonRefresherElement).complete();
  };

  const handleDelete = async (category: Category) => {
    presentAlert({
      header: 'Kategorie löschen',
      message: `Kategorie "${category.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            const slidingElement = slidingRefs.current.get(category.id);
            try {
              await api.delete(`/admin/categories/${category.id}`);
              setSuccess(`Kategorie "${category.name}" gelöscht`);
              loadCategories();
            } catch (error: any) {
              if (slidingElement) {
                await slidingElement.close();
              }
              const errorMessage = error.response?.data?.error || 'Fehler beim Löschen der Kategorie';
              setError(errorMessage);
            }
          }
        }
      ]
    });
  };

  const openCreateModal = () => {
    setEditCategory(null);
    presentCategoryModalHook({ presentingElement });
  };

  const openEditModal = (category: Category) => {
    setEditCategory(category);
    presentCategoryModalHook({ presentingElement });
  };

  // Rollen-basierte Berechtigungen (org_admin und admin duerfen alles)
  const isAdmin = ['org_admin', 'admin'].includes(user?.role_name || '');
  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;

  if (loading) {
    return (
      <IonPage ref={pageRef}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Kategorien</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <LoadingSpinner fullScreen message="Kategorien werden geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Kategorien</IonTitle>
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
            <IonTitle size="large" style={{ color: 'black' }}>Kategorien</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {/* Header - Kompaktes Banner-Design */}
        <div style={{
          background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
          borderRadius: '20px',
          padding: '24px',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(255, 149, 0, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IonIcon icon={pricetag} style={{ fontSize: '1.6rem', color: 'white' }} />
            </div>
            <div>
              <h2 style={{ margin: '0', fontSize: '1.4rem', fontWeight: '700', color: 'white' }}>Kategorien</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)' }}>Aktivitäten und Events</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 12px', textAlign: 'center', flex: '1 1 0', maxWidth: '100px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>{categories.length}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GESAMT</div>
            </div>
          </div>
        </div>

        {/* Categories List - iOS26 Pattern */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={pricetagOutline} />
            </div>
            <IonLabel>Kategorien ({categories.length})</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              {categories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <IonIcon
                    icon={pricetag}
                    style={{
                      fontSize: '3rem',
                      color: '#f59e0b',
                      marginBottom: '16px',
                      display: 'block',
                      margin: '0 auto 16px auto'
                    }}
                  />
                  <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Kategorien gefunden</h3>
                  <p style={{ color: '#999', margin: '0' }}>Noch keine Kategorien angelegt</p>
                </div>
              ) : (
                <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                  {categories.map((category, index) => (
                    <IonItemSliding
                      key={category.id}
                      ref={(el) => {
                        if (el) {
                          slidingRefs.current.set(category.id, el);
                        } else {
                          slidingRefs.current.delete(category.id);
                        }
                      }}
                      style={{ marginBottom: index < categories.length - 1 ? '8px' : '0' }}
                    >
                      <IonItem
                        button={canEdit}
                        onClick={canEdit ? () => openEditModal(category) : undefined}
                        detail={false}
                        lines="none"
                        style={{
                          '--background': 'transparent',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          '--inner-padding-end': '0',
                          '--inner-border-width': '0',
                          '--border-style': 'none',
                          '--min-height': 'auto'
                        }}
                      >
                        <div
                          className="app-list-item app-list-item--badges"
                          style={{ width: '100%' }}
                        >
                          <div className="app-list-item__row">
                            <div className="app-list-item__main">
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--badges">
                                <IonIcon icon={pricetag} />
                              </div>
                              <div className="app-list-item__content">
                                <div className="app-list-item__title">
                                  {category.name}
                                </div>
                                {category.description && (
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      {category.description}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </IonItem>

                      {canDelete && (
                        <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' }}>
                          <IonItemOption
                            onClick={() => handleDelete(category)}
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

      </IonContent>
    </IonPage>
  );
};

export default AdminCategoriesPage;