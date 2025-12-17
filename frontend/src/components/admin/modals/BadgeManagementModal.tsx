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
  IonSpinner,
  IonList,
  IonListHeader,
  IonAccordion,
  IonAccordionGroup
} from '@ionic/react';
import {
  checkmarkOutline,
  closeOutline,
  ribbon,
  settings,
  trophy,
  star,
  removeOutline,
  addOutline,
  medal,
  flame,
  heart,
  thumbsUp,
  flash,
  diamond,
  rocket,
  shield,
  sparkles,
  sunny,
  moon,
  leaf,
  rose,
  gift,
  balloon,
  musicalNote,
  book,
  school,
  restaurant,
  fitness,
  bicycle,
  car,
  airplane,
  boat,
  home,
  business,
  construct,
  hammer,
  brush,
  colorPalette,
  camera,
  image,
  chatbubbles,
  people,
  personAdd,
  checkmarkCircle,
  alertCircle,
  informationCircle,
  helpCircle,
  flag,
  pin,
  navigate,
  location,
  compass,
  timer,
  stopwatch,
  calendar,
  today,
  time
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

// Badge Icon Mapping
const BADGE_ICONS = {
  trophy: { icon: trophy, name: 'Pokal', category: 'Erfolg' },
  medal: { icon: medal, name: 'Medaille', category: 'Erfolg' },
  ribbon: { icon: ribbon, name: 'Band', category: 'Erfolg' },
  star: { icon: star, name: 'Stern', category: 'Erfolg' },
  checkmarkCircle: { icon: checkmarkCircle, name: 'Bestanden', category: 'Erfolg' },
  diamond: { icon: diamond, name: 'Diamant', category: 'Erfolg' },
  shield: { icon: shield, name: 'Schild', category: 'Erfolg' },

  flame: { icon: flame, name: 'Flamme', category: 'Engagement' },
  flash: { icon: flash, name: 'Blitz', category: 'Engagement' },
  rocket: { icon: rocket, name: 'Rakete', category: 'Engagement' },
  sparkles: { icon: sparkles, name: 'Funken', category: 'Engagement' },
  thumbsUp: { icon: thumbsUp, name: 'Daumen hoch', category: 'Engagement' },

  heart: { icon: heart, name: 'Herz', category: 'Gemeinschaft' },
  people: { icon: people, name: 'Gruppe', category: 'Gemeinschaft' },
  personAdd: { icon: personAdd, name: 'Neue Person', category: 'Gemeinschaft' },
  chatbubbles: { icon: chatbubbles, name: 'Chat', category: 'Gemeinschaft' },
  gift: { icon: gift, name: 'Geschenk', category: 'Gemeinschaft' },

  book: { icon: book, name: 'Buch', category: 'Lernen' },
  school: { icon: school, name: 'Schule', category: 'Lernen' },
  construct: { icon: construct, name: 'Werkzeug', category: 'Lernen' },
  brush: { icon: brush, name: 'Pinsel', category: 'Lernen' },
  colorPalette: { icon: colorPalette, name: 'Farbpalette', category: 'Lernen' },

  sunny: { icon: sunny, name: 'Sonne', category: 'Natur' },
  moon: { icon: moon, name: 'Mond', category: 'Natur' },
  leaf: { icon: leaf, name: 'Blatt', category: 'Natur' },
  rose: { icon: rose, name: 'Rose', category: 'Natur' },

  calendar: { icon: calendar, name: 'Kalender', category: 'Zeit' },
  today: { icon: today, name: 'Heute', category: 'Zeit' },
  time: { icon: time, name: 'Uhr', category: 'Zeit' },
  timer: { icon: timer, name: 'Timer', category: 'Zeit' },
  stopwatch: { icon: stopwatch, name: 'Stoppuhr', category: 'Zeit' },

  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitäten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitäten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitäten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitäten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitäten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitäten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitäten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitäten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitäten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitäten' },

  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebäude', category: 'Orte' },
  location: { icon: location, name: 'Standort', category: 'Orte' },
  navigate: { icon: navigate, name: 'Navigation', category: 'Orte' },
  compass: { icon: compass, name: 'Kompass', category: 'Orte' },
  pin: { icon: pin, name: 'Pin', category: 'Orte' },
  flag: { icon: flag, name: 'Flagge', category: 'Orte' },

  informationCircle: { icon: informationCircle, name: 'Info', category: 'Sonstiges' },
  helpCircle: { icon: helpCircle, name: 'Hilfe', category: 'Sonstiges' },
  alertCircle: { icon: alertCircle, name: 'Warnung', category: 'Sonstiges' },
  hammer: { icon: hammer, name: 'Hammer', category: 'Sonstiges' }
};

// Helper function to get icon from string
const getIconFromString = (iconName: string) => {
  return BADGE_ICONS[iconName as keyof typeof BADGE_ICONS]?.icon || trophy;
};

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
    icon: 'trophy',
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
    'event_count': 'Event-Teilnahmen',
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
      const activitiesResponse = await api.get('/admin/activities');
      setActivities(activitiesResponse.data);

      // Load categories
      const categoriesResponse = await api.get('/admin/categories');
      setCategories(categoriesResponse.data);

      // Load criteria types
      const criteriaResponse = await api.get('/admin/badges/criteria-types');
      console.log('📛 Criteria Types geladen:', criteriaResponse.data);
      setCriteriaTypes(criteriaResponse.data);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadBadge = async () => {
    if (!badgeId) return;

    setLoading(true);
    try {
      const response = await api.get(`/admin/badges/${badgeId}`);
      const badge = response.data;

      console.log('📛 Badge geladen:', badge);
      console.log('📛 Icon:', badge.icon);
      console.log('📛 Farbe:', badge.color);
      console.log('📛 Kriterium Typ:', badge.criteria_type);

      if (badge) {
        // Parse extra criteria FIRST
        let extra = {};
        try {
          extra = typeof badge.criteria_extra === 'string'
            ? JSON.parse(badge.criteria_extra || '{}')
            : (badge.criteria_extra || {});
        } catch (e) {
          console.error('Error parsing criteria_extra:', e);
          extra = {};
        }

        const newFormData = {
          name: badge.name || '',
          icon: badge.icon || '🏆',
          description: badge.description || '',
          criteria_type: badge.criteria_type || 'total_points',
          criteria_value: badge.criteria_value || 10,
          criteria_extra: badge.criteria_extra || '{}',
          is_active: badge.is_active !== undefined ? badge.is_active : true,
          is_hidden: badge.is_hidden !== undefined ? badge.is_hidden : false,
          color: badge.color || '#667eea'
        };

        console.log('📛 Form Data gesetzt:', newFormData);
        setFormData(newFormData);
        setExtraCriteria(extra);
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
        await api.put(`/admin/badges/${badgeId}`, badgeData);
        setSuccess('Badge erfolgreich aktualisiert');
      } else {
        await api.post('/admin/badges', badgeData);
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
        const selectedActivity = activities.find(a => a.id === extraCriteria.activity_id);
        return (
          <div style={{ marginTop: '16px' }}>
            <IonAccordionGroup>
              <IonAccordion value="activity-picker">
                <IonItem slot="header" lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                      Aktivität auswählen
                    </h3>
                    {selectedActivity && (
                      <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                        {selectedActivity.name} ({selectedActivity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'})
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activities.map(activity => {
                      const isSelected = extraCriteria.activity_id === activity.id;
                      return (
                        <div
                          key={activity.id}
                          className={`app-list-item app-list-item--info ${isSelected ? 'app-list-item--selected' : ''}`}
                          onClick={() => setExtraCriteria({ ...extraCriteria, activity_id: activity.id })}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0',
                            borderLeftColor: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div
                              className="app-icon-circle"
                              style={{ backgroundColor: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
                            >
                              <IonIcon icon={activity.type === 'gottesdienst' ? home : people} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">{activity.name}</div>
                              <div className="app-list-item__subtitle">
                                {activity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                              </div>
                            </div>
                          </div>
                          <IonCheckbox
                            checked={isSelected}
                            style={{
                              '--checkbox-background-checked': activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              '--border-color-checked': activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              '--checkmark-color': 'white'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        );

      case 'category_activities':
        const selectedCategory = categories.find(c => c.name === extraCriteria.required_category);
        return (
          <div style={{ marginTop: '16px' }}>
            <IonAccordionGroup>
              <IonAccordion value="category-picker">
                <IonItem slot="header" lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                      Kategorie auswählen
                    </h3>
                    {selectedCategory && (
                      <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                        {selectedCategory.name}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {categories.map(category => {
                      const isSelected = extraCriteria.required_category === category.name;
                      return (
                        <div
                          key={category.id}
                          className={`app-list-item app-list-item--warning ${isSelected ? 'app-list-item--selected' : ''}`}
                          onClick={() => setExtraCriteria({ ...extraCriteria, required_category: category.name })}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div className="app-icon-circle app-icon-circle--warning">
                              <IonIcon icon={flag} />
                            </div>
                            <div className="app-list-item__title">{category.name}</div>
                          </div>
                          <IonCheckbox
                            checked={isSelected}
                            style={{
                              '--checkbox-background-checked': '#ff9500',
                              '--border-color-checked': '#ff9500',
                              '--checkmark-color': 'white'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
        );

      case 'time_based':
        return (
          <IonItem lines="none" style={{ '--background': 'transparent', marginTop: '16px' }}>
            <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Zeitraum (Wochen)</IonLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <IonButton
                fill="outline"
                size="small"
                disabled={loading || (extraCriteria.weeks || 4) <= 1}
                onClick={() => setExtraCriteria({ ...extraCriteria, weeks: Math.max(1, (extraCriteria.weeks || 4) - 1) })}
                style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
              >
                <IonIcon icon={removeOutline} />
              </IonButton>
              <IonInput
                type="text"
                inputMode="numeric"
                value={(extraCriteria.weeks || 4).toString()}
                onIonInput={(e) => {
                  const value = e.detail.value!;
                  if (value === '') {
                    setExtraCriteria({ ...extraCriteria, weeks: 1 });
                  } else {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 1 && num <= 52) {
                      setExtraCriteria({ ...extraCriteria, weeks: num });
                    }
                  }
                }}
                placeholder="4"
                disabled={loading}
                style={{ textAlign: 'center', flex: 1 }}
              />
              <IonButton
                fill="outline"
                size="small"
                disabled={loading || (extraCriteria.weeks || 4) >= 52}
                onClick={() => setExtraCriteria({ ...extraCriteria, weeks: Math.min(52, (extraCriteria.weeks || 4) + 1) })}
                style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
              >
                <IonIcon icon={addOutline} />
              </IonButton>
            </div>
          </IonItem>
        );

      case 'activity_combination':
        const selectedActivities = activities.filter(a => (extraCriteria.activity_ids || []).includes(a.id));
        return (
          <div style={{ marginTop: '16px' }}>
            <IonAccordionGroup>
              <IonAccordion value="activity-combination-picker">
                <IonItem slot="header" lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                      Aktivitäten kombinieren (mehrere auswählbar)
                    </h3>
                    {selectedActivities.length > 0 && (
                      <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                        {selectedActivities.map(a => a.name).join(', ')}
                      </p>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activities.map(activity => {
                      const activityIds = extraCriteria.activity_ids || [];
                      const isSelected = activityIds.includes(activity.id);

                      return (
                        <div
                          key={activity.id}
                          className={`app-list-item app-list-item--info ${isSelected ? 'app-list-item--selected' : ''}`}
                          onClick={() => {
                            const currentIds = extraCriteria.activity_ids || [];
                            const newIds = isSelected
                              ? currentIds.filter((id: number) => id !== activity.id)
                              : [...currentIds, activity.id];
                            setExtraCriteria({ ...extraCriteria, activity_ids: newIds });
                          }}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0',
                            borderLeftColor: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div
                              className="app-icon-circle"
                              style={{ backgroundColor: activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f' }}
                            >
                              <IonIcon icon={activity.type === 'gottesdienst' ? home : people} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">{activity.name}</div>
                              <div className="app-list-item__subtitle">
                                {activity.type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde'}
                              </div>
                            </div>
                          </div>
                          <IonCheckbox
                            checked={isSelected}
                            style={{
                              '--checkbox-background-checked': activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              '--border-color-checked': activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              '--checkmark-color': 'white'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>
          </div>
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
      case 'both_categories':
      case 'bonus_points':
        return 'Punkte';
      case 'specific_activity':
        return 'Anzahl (Spezifische Aktivität)';
      case 'activity_count':
        return 'Anzahl (Aktivitäten & Events)';
      case 'event_count':
        return 'Anzahl (Events)';
      case 'category_activities':
        return 'Anzahl (Kategorie-Aktivitäten & Events)';
      case 'unique_activities':
        return 'Anzahl (Verschiedene Aktivitäten)';
      case 'streak':
        return 'Anzahl (Aufeinanderfolgende Wochen)';
      case 'time_based':
        return 'Anzahl (Aktivitäten & Events im Zeitraum)';
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
            <IonButton onClick={onClose} style={{
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
              onClick={handleSave}
              disabled={loading || !formData.name.trim()}
            >
              {loading ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Badge-Informationen */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--warning">
              <IonIcon icon={ribbon} />
            </div>
            <IonLabel>Badge-Informationen</IonLabel>
          </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Name *</IonLabel>
                <IonInput
                  value={formData.name}
                  onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                  placeholder="Badge-Name eingeben"
                  required
                  clearInput={true}
                  disabled={loading}
                />
              </IonItem>

              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Beschreibung</IonLabel>
                <IonTextarea
                  value={formData.description}
                  onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                  placeholder="Beschreibung des Badges..."
                  rows={3}
                  disabled={loading}
                />
              </IonItem>

              <div style={{ marginTop: '16px' }}>
                <IonAccordionGroup>
                  <IonAccordion value="icon-picker">
                    <IonItem slot="header" lines="none" style={{ '--background': 'transparent' }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: formData.color,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        marginRight: '12px'
                      }}>
                        <IonIcon
                          icon={getIconFromString(formData.icon)}
                          style={{ fontSize: '1.8rem', color: 'white' }}
                        />
                      </div>
                      <IonLabel>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                          Icon *
                        </h3>
                        {formData.icon && BADGE_ICONS[formData.icon as keyof typeof BADGE_ICONS] && (
                          <p style={{ fontSize: '0.85rem', color: '#333', margin: '0', fontWeight: '500' }}>
                            {BADGE_ICONS[formData.icon as keyof typeof BADGE_ICONS].name} ({BADGE_ICONS[formData.icon as keyof typeof BADGE_ICONS].category})
                          </p>
                        )}
                      </IonLabel>
                    </IonItem>
                    <div slot="content" style={{ padding: '16px' }}>
                      {Object.entries(BADGE_ICONS).reduce((acc, [key, data]) => {
                        const categoryIndex = acc.findIndex((group: any) => group.category === data.category);
                        if (categoryIndex === -1) {
                          acc.push({ category: data.category, icons: [{ key, data }] });
                        } else {
                          acc[categoryIndex].icons.push({ key, data });
                        }
                        return acc;
                      }, [] as any[]).map((group: any) => (
                        <div key={group.category} style={{ marginBottom: '16px' }}>
                          <IonText style={{ fontSize: '0.85rem', fontWeight: '600', color: '#666', marginBottom: '8px', display: 'block' }}>
                            {group.category}
                          </IonText>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '8px' }}>
                            {group.icons.map(({ key, data }: any) => (
                              <div
                                key={key}
                                onClick={() => setFormData({ ...formData, icon: key })}
                                style={{
                                  width: '100%',
                                  aspectRatio: '1',
                                  backgroundColor: formData.icon === key ? formData.color : '#f8f9fa',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  border: formData.icon === key ? '2px solid ' + formData.color : '1px solid #e0e0e0',
                                  boxShadow: formData.icon === key ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <IonIcon
                                  icon={data.icon}
                                  style={{
                                    fontSize: '1.5rem',
                                    color: formData.icon === key ? 'white' : '#666'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </IonAccordion>
                </IonAccordionGroup>
              </div>

              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Badge-Farbe</IonLabel>
                <div style={{ marginTop: '8px', width: '100%' }}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: '60px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '12px',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
        </IonList>

        {/* SEKTION: Badge-Kriterien */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--warning">
              <IonIcon icon={settings} />
            </div>
            <IonLabel>Badge-Kriterien</IonLabel>
          </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonAccordionGroup>
              <IonAccordion value="criteria-types">
                <IonItem slot="header" lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666', margin: '0 0 4px 0' }}>
                      Kriterium-Typ
                    </h3>
                    {formData.criteria_type && criteriaTypes[formData.criteria_type] && (
                      <>
                        <p style={{ fontSize: '0.85rem', color: '#333', margin: '0 0 2px 0', fontWeight: '500' }}>
                          {criteriaTypes[formData.criteria_type].label.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim()}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#999', margin: '0', whiteSpace: 'normal' }}>
                          {criteriaTypes[formData.criteria_type].description}
                        </p>
                      </>
                    )}
                  </IonLabel>
                </IonItem>
                <div slot="content" style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(criteriaTypes).map(([value, type]: [string, any]) => {
                      const isSelected = formData.criteria_type === value;
                      // Remove emojis from label
                      const labelWithoutEmoji = type.label.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

                      return (
                        <div
                          key={value}
                          className={`app-list-item app-list-item--warning ${isSelected ? 'app-list-item--selected' : ''}`}
                          onClick={() => {
                            if (!loading) {
                              // Set default criteria_value based on type
                              let defaultValue = 10;
                              if (value === 'activity_count' || value === 'unique_activities' ||
                                  value === 'specific_activity' || value === 'category_activities' ||
                                  value === 'event_count') {
                                defaultValue = 5;
                              } else if (value === 'activity_combination') {
                                defaultValue = 3;
                              } else if (value === 'streak') {
                                defaultValue = 4;
                              }
                              setFormData({ ...formData, criteria_type: value, criteria_value: defaultValue });
                              setExtraCriteria({});
                            }
                          }}
                          style={{
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div className="app-icon-circle app-icon-circle--warning">
                              <IonIcon icon={flash} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">{labelWithoutEmoji}</div>
                              <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal' }}>
                                {type.help}
                              </div>
                            </div>
                          </div>
                          <IonCheckbox
                            checked={isSelected}
                            disabled={loading}
                            style={{
                              '--checkbox-background-checked': '#ff9500',
                              '--border-color-checked': '#ff9500',
                              '--checkmark-color': 'white'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </IonAccordion>
            </IonAccordionGroup>

            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px', marginTop: '16px' }}>
                <IonLabel position="stacked" style={{ marginBottom: '8px' }}>{getValueLabel()}</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={loading || formData.criteria_value <= 1}
                    onClick={() => setFormData({ ...formData, criteria_value: Math.max(1, formData.criteria_value - 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={removeOutline} />
                  </IonButton>
                  <IonInput
                    type="text"
                    inputMode="numeric"
                    value={formData.criteria_value.toString()}
                    onIonInput={(e) => {
                      const value = e.detail.value!;
                      if (value === '') {
                        setFormData({ ...formData, criteria_value: 1 });
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num)) {
                          setFormData({ ...formData, criteria_value: Math.min(1000, Math.max(1, num)) });
                        }
                      }
                    }}
                    disabled={loading}
                    style={{ textAlign: 'center', flex: 1 }}
                  />
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={loading || formData.criteria_value >= 1000}
                    onClick={() => setFormData({ ...formData, criteria_value: Math.min(1000, formData.criteria_value + 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={addOutline} />
                  </IonButton>
                </div>
              </IonItem>

              {renderCriteriaSpecificFields()}
            </IonList>
          </IonCardContent>
        </IonCard>
        </IonList>

        {/* SEKTION: Badge-Status */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--warning">
              <IonIcon icon={ribbon} />
            </div>
            <IonLabel>Badge-Status</IonLabel>
          </IonListHeader>
        <IonCard className="app-card">
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel>
                  <h3 style={{ color: '#333', margin: '0 0 4px 0', fontWeight: '600' }}>Aktiv</h3>
                  <p style={{ color: '#666', margin: '0', fontSize: '0.85rem' }}>Badge kann verliehen werden</p>
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={formData.is_active}
                  onIonChange={(e) => setFormData({ ...formData, is_active: e.detail.checked })}
                  color="success"
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel>
                  <h3 style={{ color: '#333', margin: '0 0 4px 0', fontWeight: '600' }}>Geheim</h3>
                  <p style={{ color: '#666', margin: '0', fontSize: '0.85rem' }}>Badge ist für Konfis nicht sichtbar bis sie es erhalten</p>
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={formData.is_hidden}
                  onIonChange={(e) => setFormData({ ...formData, is_hidden: e.detail.checked })}
                  color="warning"
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

export default BadgeManagementModal;