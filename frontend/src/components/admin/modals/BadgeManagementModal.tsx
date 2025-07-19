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
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonText,
  IonCheckbox
} from '@ionic/react';
import { save, close, ribbon, settings } from 'ionicons/icons';
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
    is_hidden: false
  });

  // Available data for dropdowns
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [criteriaTypes, setCriteriaTypes] = useState<any[]>([]);

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

      // Load categories for badges
      const categoriesResponse = await api.get('/activity-categories');
      setCategories(categoriesResponse.data);

      // Load criteria types
      const criteriaResponse = await api.get('/badge-criteria-types');
      setCriteriaTypes(criteriaResponse.data);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadBadge = async () => {
    if (!badgeId) return;
    
    setLoading(true);
    try {
      const response = await api.get('/badges');
      const badges = response.data;
      const badge = badges.find((b: Badge) => b.id === badgeId);
      
      if (badge) {
        setFormData({
          name: badge.name,
          icon: badge.icon,
          description: badge.description || '',
          criteria_type: badge.criteria_type,
          criteria_value: badge.criteria_value,
          criteria_extra: badge.criteria_extra || '{}',
          is_active: badge.is_active,
          is_hidden: badge.is_hidden
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
          <IonItem>
            <IonLabel position="stacked">Aktivität auswählen</IonLabel>
            <IonSelect
              value={extraCriteria.activity_id}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, activity_id: e.detail.value })}
              placeholder="Aktivität wählen"
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
          <IonItem>
            <IonLabel position="stacked">Kategorie auswählen</IonLabel>
            <IonSelect
              value={extraCriteria.required_category}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, required_category: e.detail.value })}
              placeholder="Kategorie wählen"
            >
              {categories.map(category => (
                <IonSelectOption key={category} value={category}>
                  {category}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        );

      case 'time_based':
        return (
          <IonItem>
            <IonLabel position="stacked">Zeitraum (Tage)</IonLabel>
            <IonInput
              type="number"
              value={extraCriteria.days || 7}
              onIonInput={(e) => setExtraCriteria({ ...extraCriteria, days: parseInt(e.detail.value!) || 7 })}
              placeholder="7"
              min={1}
              max={365}
            />
          </IonItem>
        );

      case 'activity_combination':
        return (
          <IonItem>
            <IonLabel position="stacked">Aktivitäten kombinieren</IonLabel>
            <IonSelect
              multiple
              value={extraCriteria.activity_ids || []}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, activity_ids: e.detail.value })}
              placeholder="Aktivitäten wählen"
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
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={loading}>
              <IonIcon icon={save} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Basis-Informationen */}
        <IonCard>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Name *</IonLabel>
              <IonInput
                value={formData.name}
                onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                placeholder="Badge-Name eingeben"
                required
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Icon (Emoji)</IonLabel>
              <IonInput
                value={formData.icon}
                onIonInput={(e) => setFormData({ ...formData, icon: e.detail.value! })}
                placeholder="🏆"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Beschreibung</IonLabel>
              <IonTextarea
                value={formData.description}
                onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                placeholder="Beschreibung des Badges"
                rows={3}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

        {/* Kriterien */}
        <IonCard>
          <IonCardContent>
            <IonItem>
              <IonIcon icon={settings} slot="start" color="primary" />
              <IonLabel>
                <h2>Kriterien</h2>
                <p>Bestimme, wann dieses Badge verliehen wird</p>
              </IonLabel>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Kriterium-Typ</IonLabel>
              <IonSelect
                value={formData.criteria_type}
                onIonChange={(e) => {
                  setFormData({ ...formData, criteria_type: e.detail.value });
                  setExtraCriteria({}); // Reset extra criteria when type changes
                }}
              >
                {Object.entries(criteriaTypeLabels).map(([value, label]) => (
                  <IonSelectOption key={value} value={value}>
                    {label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">{getValueLabel()}</IonLabel>
              <IonInput
                type="number"
                value={formData.criteria_value}
                onIonInput={(e) => setFormData({ ...formData, criteria_value: parseInt(e.detail.value!) || 1 })}
                placeholder="10"
                min={1}
                max={1000}
              />
            </IonItem>

            {renderCriteriaSpecificFields()}
          </IonCardContent>
        </IonCard>

        {/* Status-Einstellungen */}
        <IonCard>
          <IonCardContent>
            <IonItem>
              <IonIcon icon={ribbon} slot="start" color="warning" />
              <IonLabel>
                <h2>Status</h2>
                <p>Sichtbarkeit und Aktivierung</p>
              </IonLabel>
            </IonItem>

            <IonItem>
              <IonLabel>
                <h3>Aktiv</h3>
                <p>Badge kann verliehen werden</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_active}
                onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
              />
            </IonItem>

            <IonItem>
              <IonLabel>
                <h3>Versteckt</h3>
                <p>Badge ist für Konfis nicht sichtbar</p>
              </IonLabel>
              <IonToggle
                checked={formData.is_hidden}
                onIonChange={(e) => setFormData({ ...formData, is_hidden: e.detail.checked })}
              />
            </IonItem>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
};

export default BadgeManagementModal;