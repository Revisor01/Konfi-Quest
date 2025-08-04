import React, { useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonText,
  IonCheckbox,
  IonSpinner
} from '@ionic/react';
import { checkmarkOutline, closeOutline, ribbon, settings, trophy } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Badge {
  id: number;
  name: string;
  icon: string;
  description?: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string;
  is_active: boolean;
  is_hidden: boolean;
  earned_count: number;
  created_at: string;
}

interface Activity {
  id: number;
  name: string;
  type: 'gottesdienst' | 'gemeinde';
  categories?: Category[];
}

interface Category {
  id: number;
  name: string;
}

interface BadgeManagementModalProps {
  badgeId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BadgeManagementModal: React.FC<BadgeManagementModalProps> = ({
  badgeId,
  onClose,
  onSuccess
}) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    icon: '🏆',
    description: '',
    criteria_type: 'total_points',
    criteria_value: 10,
    criteria_extra: '{}',
    is_active: true,
    is_hidden: false,
    color: '#667eea'
  });

  // Available data for dropdowns
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [criteriaTypes, setCriteriaTypes] = useState<any>({});

  // Additional form fields for complex criteria
  const [extraCriteria, setExtraCriteria] = useState<any>({});

  const isEditMode = !!badgeId;

  const criteriaTypeLabels: Record<string, string> = {
    'total_points': 'Gesamtpunkte',
    'gottesdienst_points': 'Gottesdienst-Punkte',
    'gemeinde_points': 'Gemeinde-Punkte',
    'specific_activity': 'Spezielle Aktivität',
    'both_categories': 'Beide Kategorien',
    'activity_combination': 'Aktivitätskombination',
    'category_activities': 'Kategorie-Aktivitäten',
    'time_based': 'Zeitbasiert',
    'activity_count': 'Aktivitätsanzahl',
    'bonus_points': 'Bonuspunkte',
    'streak': 'Serie',
    'unique_activities': 'Einzigartige Aktivitäten'
  };

  useEffect(() => {
    loadInitialData();
    if (isEditMode) {
      loadBadge();
    }
  }, [badgeId]);

  const loadInitialData = async () => {
    try {
      // Load activities
      const activitiesResponse = await api.get('/activities');
      setActivities(activitiesResponse.data);

      // Load categories
      const categoriesResponse = await api.get('/categories');
      setCategories(categoriesResponse.data);

      // Load criteria types
      const criteriaResponse = await api.get('/badges/criteria-types');
      setCriteriaTypes(criteriaResponse.data);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadBadge = async () => {
    if (!badgeId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/badges/${badgeId}`);
      const badge = response.data;
      
      if (badge) {
        setFormData({
          name: badge.name,
          icon: badge.icon,
          description: badge.description || '',
          criteria_type: badge.criteria_type,
          criteria_value: badge.criteria_value,
          criteria_extra: badge.criteria_extra || '{}',
          is_active: badge.is_active,
          is_hidden: badge.is_hidden,
          color: badge.color || '#667eea'
        });

        // Parse extra criteria
        try {
          const extra = JSON.parse(badge.criteria_extra || '{}');
          setExtraCriteria(extra);
        } catch (e) {
          setExtraCriteria({});
        }
      }
    } catch (err) {
      setError('Fehler beim Laden des Badges');
      console.error('Error loading badge:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      return;
    }

    setLoading(true);
    try {
      // Prepare criteria_extra based on criteria_type
      let criteriaExtra = {};
      
      switch (formData.criteria_type) {
        case 'specific_activity':
          if (extraCriteria.activity_id) {
            criteriaExtra = { activity_id: extraCriteria.activity_id };
          }
          break;
        case 'category_activities':
          if (extraCriteria.required_category) {
            criteriaExtra = { required_category: extraCriteria.required_category };
          }
          break;
        case 'time_based':
          if (extraCriteria.days) {
            criteriaExtra = { days: extraCriteria.days };
          }
          break;
        case 'activity_combination':
          if (extraCriteria.activity_ids && extraCriteria.activity_ids.length > 0) {
            criteriaExtra = { activity_ids: extraCriteria.activity_ids };
          }
          break;
      }

      const badgeData = {
        ...formData,
        criteria_extra: JSON.stringify(criteriaExtra)
      };

      if (isEditMode) {
        await api.put(`/badges/${badgeId}`, badgeData);
        setSuccess('Badge erfolgreich aktualisiert');
      } else {
        await api.post('/badges', badgeData);
        setSuccess('Badge erfolgreich erstellt');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern des Badges');
    } finally {
      setLoading(false);
    }
  };

  const renderCriteriaSpecificFields = () => {
    switch (formData.criteria_type) {
      case 'specific_activity':
        return (
          <IonItem lines="none" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Aktivität auswählen</strong>
            </IonLabel>
            <IonSelect
              value={extraCriteria.activity_id}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, activity_id: e.detail.value })}
              placeholder="Aktivität wählen"
              style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
            >
              {activities.map(activity => (
                <IonSelectOption key={activity.id} value={activity.id}>
                  {activity.name} ({activity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'})
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        );

      case 'category_activities':
        return (
          <IonItem lines="none" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Kategorie auswählen</strong>
            </IonLabel>
            <IonSelect
              value={extraCriteria.required_category}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, required_category: e.detail.value })}
              placeholder="Kategorie wählen"
              style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
            >
              {categories.map(category => (
                <IonSelectOption key={category.id} value={category.name}>
                  {category.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        );

      case 'time_based':
        return (
          <IonItem lines="none" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Zeitraum (Tage)</strong>
            </IonLabel>
            <IonInput
              type="number"
              value={extraCriteria.days || 7}
              onIonInput={(e) => setExtraCriteria({ ...extraCriteria, days: parseInt(e.detail.value!) || 7 })}
              placeholder="7"
              min={1}
              max={365}
              style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
            />
          </IonItem>
        );

      case 'activity_combination':
        return (
          <IonItem lines="none" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Aktivitäten kombinieren</strong>
            </IonLabel>
            <IonSelect
              multiple
              value={extraCriteria.activity_ids || []}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, activity_ids: e.detail.value })}
              placeholder="Aktivitäten wählen"
              style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
            >
              {activities.map(activity => (
                <IonSelectOption key={activity.id} value={activity.id}>
                  {activity.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        );

      default:
        return null;
    }
  };

  const getValueLabel = () => {
    switch (formData.criteria_type) {
      case 'total_points':
      case 'gottesdienst_points':
      case 'gemeinde_points':
      case 'bonus_points':
        return 'Punkte';
      case 'specific_activity':
      case 'activity_count':
      case 'category_activities':
      case 'unique_activities':
        return 'Anzahl';
      case 'streak':
        return 'Aufeinanderfolgende Tage';
      case 'time_based':
        return 'Aktivitäten in Zeitraum';
      default:
        return 'Wert';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEditMode ? 'Badge bearbeiten' : 'Neues Badge'}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} fill="clear">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={loading} fill="clear">
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding"  style={{ '--background': '#f8f9fa' }}>
        {/* Basis-Informationen */}
        <IonCard style={{ '--background': 'white', marginBottom: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ color: '#333', fontSize: '1.2rem' }}>
              <IonIcon icon={trophy} style={{ marginRight: '8px', color: '#ffd700' }} />
              Badge-Informationen
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked" color="dark">
                <strong>Name *</strong>
              </IonLabel>
              <IonInput
                value={formData.name}
                onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                placeholder="Badge-Name eingeben"
                required
                style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
              />
            </IonItem>

            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked" color="dark">
                <strong>Icon (Emoji)</strong>
              </IonLabel>
              <IonInput
                value={formData.icon}
                onIonInput={(e) => setFormData({ ...formData, icon: e.detail.value! })}
                placeholder="🏆"
                style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
              />
            </IonItem>

            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked" color="dark">
                <strong>Badge-Farbe</strong>
              </IonLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={{
                    width: '50px',
                    height: '40px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                />
                <IonInput
                  value={formData.color}
                  onIonInput={(e) => setFormData({ ...formData, color: e.detail.value! })}
                  placeholder="#667eea"
                  style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
                />
              </div>
            </IonItem>

            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked" color="dark">
                <strong>Beschreibung</strong>
              </IonLabel>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                placeholder="Beschreibung des Badges"
                rows={3}
                style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Kriterien */}
        <IonCard style={{ '--background': 'white', marginBottom: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ color: '#333', fontSize: '1.2rem' }}>
              <IonIcon icon={settings} style={{ marginRight: '8px', color: '#667eea' }} />
              Badge-Kriterien
            </IonCardTitle>
            <IonText color="medium">
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                Bestimme, wann dieses Badge verliehen wird
              </p>
            </IonText>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked" color="dark">
                <strong>Kriterium-Typ</strong>
              </IonLabel>
              <IonSelect
                value={formData.criteria_type}
                onIonChange={(e) => {
                  setFormData({ ...formData, criteria_type: e.detail.value });
                  setExtraCriteria({}); // Reset extra criteria when type changes
                }}
                style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
              >
                {Object.entries(criteriaTypes).map(([value, type]: [string, any]) => (
                  <IonSelectOption key={value} value={value}>
                    {type.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked" color="dark">
                <strong>{getValueLabel()}</strong>
              </IonLabel>
              <IonInput
                type="number"
                value={formData.criteria_value}
                onIonInput={(e) => setFormData({ ...formData, criteria_value: parseInt(e.detail.value!) || 1 })}
                placeholder="10"
                min={1}
                max={1000}
                style={{ '--background': '#f8f9fa', '--border-radius': '8px', '--padding-start': '12px', '--padding-end': '12px' }}
              />
            </IonItem>

            {renderCriteriaSpecificFields()}
          </IonCardContent>
        </IonCard>

        {/* Status-Einstellungen */}
        <IonCard style={{ '--background': 'white', marginBottom: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ color: '#333', fontSize: '1.2rem' }}>
              <IonIcon icon={ribbon} style={{ marginRight: '8px', color: '#ff6b6b' }} />
              Badge-Status
            </IonCardTitle>
            <IonText color="medium">
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                Sichtbarkeit und Aktivierung des Badges
              </p>
            </IonText>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
              <IonLabel>
                <h3 style={{ color: '#333', margin: '0 0 4px 0' }}>Aktiv</h3>
                <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>Badge kann verliehen werden</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_active}
                onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
                color="success"
              />
            </IonItem>

            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel>
                <h3 style={{ color: '#333', margin: '0 0 4px 0' }}>Versteckt (Geheimes Badge)</h3>
                <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>Badge ist für Konfis nicht sichtbar bis sie es erhalten</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_hidden}
                onIonChange={(e) => setFormData({ ...formData, is_hidden: e.detail.checked })}
                color="warning"
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
};

export default BadgeManagementModal;