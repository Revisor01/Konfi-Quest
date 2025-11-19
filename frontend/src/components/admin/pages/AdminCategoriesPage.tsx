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
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  add,
  pricetag,
  createOutline,
  trashOutline,
  checkmarkOutline,
  closeOutline,
  arrowBack,
  flash,
  list,
  trash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
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
            backgroundColor: '#ff9500',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={pricetag} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Kategorie Details
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
                placeholder="z.B. ausflug, gottesdienst"
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
              <IonLabel position="stacked" style={{ marginBottom: '8px', color: '#666' }}>Beschreibung</IonLabel>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                placeholder="Beschreibung der Kategorie..."
                rows={3}
                disabled={loading}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>
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

  // Modal mit useIonModal Hook
  const [presentCategoryModalHook, dismissCategoryModalHook] = useIonModal(CategoryModal, {
    category: editCategory,
    onClose: () => dismissCategoryModalHook(),
    onSuccess: () => {
      dismissCategoryModalHook();
      loadCategories();
    }
  });


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
    if (!window.confirm(`Kategorie "${category.name}" wirklich löschen?`)) return;
    
    const slidingElement = slidingRefs.current.get(category.id);
    
    try {
      await api.delete(`/admin/categories/${category.id}`);
      setSuccess(`Kategorie "${category.name}" gelöscht`);
      loadCategories();
      // Bei erfolgreichem Löschen schließt sich das Sliding automatisch durch den Re-render
    } catch (error: any) {
      // Bei Fehler: Sliding automatisch schließen für bessere UX
      if (slidingElement) {
        await slidingElement.close();
      }
      
      const errorMessage = error.response?.data?.error || 'Fehler beim Löschen der Kategorie';
      alert(errorMessage);
    }
  };

  const openCreateModal = () => {
    setEditCategory(null);
    presentCategoryModalHook({ presentingElement });
  };

  const openEditModal = (category: Category) => {
    setEditCategory(category);
    presentCategoryModalHook({ presentingElement });
  };

  // Permission checks
  const canCreate = user?.permissions?.includes('admin.categories.create') || false;
  const canEdit = user?.permissions?.includes('admin.categories.edit') || false;
  const canDelete = user?.permissions?.includes('admin.categories.delete') || false;

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

        {/* Header - Dashboard-Style */}
        <div style={{
          background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(255, 149, 0, 0.3)',
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
              KATEGORIEN
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
                  icon={pricetag}
                  style={{
                    fontSize: '2rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '8px',
                    display: 'block',
                    margin: '0 auto 8px auto'
                  }}
                />
                <div style={{ fontSize: '2rem', fontWeight: '800' }}>
                  {categories.length}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                  Kategorien
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories List */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '8px 0' }}>
            {categories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={pricetag}
                  style={{
                    fontSize: '3rem',
                    color: '#ff9500',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Kategorien gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Noch keine Kategorien angelegt</p>
              </div>
            ) : (
              categories.map((category) => (
                <IonItemSliding
                  key={category.id}
                  ref={(el) => {
                    if (el) {
                      slidingRefs.current.set(category.id, el);
                    } else {
                      slidingRefs.current.delete(category.id);
                    }
                  }}
                >
                  <IonItem
                    button={canEdit}
                    onClick={canEdit ? () => openEditModal(category) : undefined}
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
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: '#ff9500',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
                          flexShrink: 0
                        }}>
                          <IonIcon
                            icon={pricetag}
                            style={{
                              fontSize: '1.2rem',
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
                            {category.name}
                          </h2>
                          {category.description && (
                            <p style={{
                              margin: '0',
                              fontSize: '0.8rem',
                              color: '#666'
                            }}>
                              {category.description}
                            </p>
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
                        onClick={() => handleDelete(category)}
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

      </IonContent>
    </IonPage>
  );
};

export default AdminCategoriesPage;