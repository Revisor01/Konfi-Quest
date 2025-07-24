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
  pricetag, 
  createOutline, 
  trashOutline,
  checkmarkOutline,
  closeOutline,
  arrowBack
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  type: 'activity' | 'event' | 'both';
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
    description: '',
    type: 'both' as 'activity' | 'event' | 'both'
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        type: category.type
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'both'
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
        description: formData.description.trim() || null,
        type: formData.type
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
              placeholder="z.B. ausflug, gottesdienst"
              disabled={loading}
            />
          </IonItem>

          <IonItem style={{ marginTop: '16px' }}>
            <IonLabel position="stacked">Beschreibung</IonLabel>
            <IonTextarea
              value={formData.description}
              onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
              placeholder="Beschreibung der Kategorie..."
              rows={3}
              disabled={loading}
            />
          </IonItem>
        </div>
      </IonContent>
    </IonPage>
  );
};

const AdminCategoriesPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('admin-settings');
  const { user, setSuccess, setError } = useApp();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  // Modal mit useIonModal Hook - stable reference
  const [presentCategoryModalHook, dismissCategoryModalHook] = useIonModal(CategoryModal, {
    category: editCategory,
    onClose: () => {
      dismissCategoryModalHook();
      setEditCategory(null);
    },
    onSuccess: () => {
      dismissCategoryModalHook();
      setEditCategory(null);
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
    
    try {
      await api.delete(`/admin/categories/${category.id}`);
      setSuccess(`Kategorie "${category.name}" gelöscht`);
      loadCategories();
    } catch (error: any) {
      if (error.response?.status === 400) {
        setError('Kategorie kann nicht gelöscht werden - wird bereits verwendet');
      } else if (error.response?.status === 409) {
        setError('Kategorie kann nicht gelöscht werden - wird bereits verwendet');
      } else {
        setError('Fehler beim Löschen der Kategorie');
      }
    }
  };

  const openCreateModal = () => {
    setEditCategory(null);
    presentCategoryModalHook({
      presentingElement: presentingElement
    });
  };

  const openEditModal = (category: Category) => {
    setEditCategory(category);
    presentCategoryModalHook({
      presentingElement: presentingElement
    });
  };

  // Permission checks
  const canCreate = user?.permissions?.includes('admin.categories.create') || false;
  const canEdit = user?.permissions?.includes('admin.categories.edit') || false;
  const canDelete = user?.permissions?.includes('admin.categories.delete') || false;

  if (loading) {
    return (
      <IonPage>
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

        {/* Header Statistics Card */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
        }}>
          <IonCardContent>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <IonIcon icon={pricetag} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                <h3 style={{ margin: '0', fontSize: '1.5rem' }}>
                  {categories.length}
                </h3>
                <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.8 }}>
                  Kategorien
                </p>
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        {/* Categories List */}
        <IonCard style={{ margin: '16px', marginTop: '8px' }}>
          <IonCardContent style={{ padding: '0' }}>
            {categories.length === 0 ? (
              <IonItem lines="none">
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Noch keine Kategorien angelegt</p>
                </IonLabel>
              </IonItem>
            ) : (
              categories.map((category) => (
                <IonItemSliding key={category.id}>
                  <IonItem 
                    button={canEdit}
                    onClick={canEdit ? () => openEditModal(category) : undefined}
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
                        icon={pricetag} 
                        style={{ 
                          fontSize: '1.2rem', 
                          color: 'white'
                        }} 
                      />
                    </div>
                    <IonLabel>
                      <h2 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                        {category.name}
                      </h2>
                      {category.description && (
                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.85rem', 
                          color: '#666' 
                        }}>
                          {category.description}
                        </p>
                      )}
                    </IonLabel>
                  </IonItem>
                  
                  {canDelete && (
                    <IonItemOptions side="end">
                      <IonItemOption 
                        color="danger" 
                        onClick={() => handleDelete(category)}
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

      </IonContent>
    </IonPage>
  );
};

export default AdminCategoriesPage;