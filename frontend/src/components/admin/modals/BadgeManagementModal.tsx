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
  IonList
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
        return (
          <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0', '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Aktivität auswählen</strong>
            </IonLabel>
            <IonSelect
              value={extraCriteria.activity_id}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, activity_id: e.detail.value })}
              placeholder="Aktivität wählen"
              interface="action-sheet"
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
          <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0', '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Kategorie auswählen</strong>
            </IonLabel>
            <IonSelect
              value={extraCriteria.required_category}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, required_category: e.detail.value })}
              placeholder="Kategorie wählen"
              interface="action-sheet"
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
          <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0', '--background': 'transparent' }}>
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
            />
          </IonItem>
        );

      case 'activity_combination':
        return (
          <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0', '--background': 'transparent' }}>
            <IonLabel position="stacked" color="dark">
              <strong>Aktivitäten kombinieren</strong>
            </IonLabel>
            <IonSelect
              multiple
              value={extraCriteria.activity_ids || []}
              onIonChange={(e) => setExtraCriteria({ ...extraCriteria, activity_ids: e.detail.value })}
              placeholder="Aktivitäten wählen"
              interface="action-sheet"
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

      <IonContent style={{ '--padding-top': '16px', '--background': '#f8f9fa' }}>
        {/* SEKTION: Badge-Informationen */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={ribbon} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Badge-Informationen
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
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

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
                <IonLabel position="stacked">Beschreibung</IonLabel>
                <IonTextarea
                  value={formData.description}
                  onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                  placeholder="Beschreibung des Badges..."
                  rows={3}
                  disabled={loading}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
                <IonLabel position="stacked">Icon *</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginTop: '8px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: formData.color,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    flexShrink: 0
                  }}>
                    <IonIcon
                      icon={getIconFromString(formData.icon)}
                      style={{ fontSize: '1.8rem', color: 'white' }}
                    />
                  </div>
                  <IonSelect
                    value={formData.icon}
                    onIonChange={(e) => setFormData({ ...formData, icon: e.detail.value })}
                    interface="action-sheet"
                    placeholder="Icon wählen"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    {Object.entries(BADGE_ICONS).reduce((acc, [key, data]) => {
                      const categoryIndex = acc.findIndex((group: any) => group.category === data.category);
                      if (categoryIndex === -1) {
                        acc.push({ category: data.category, icons: [{ key, data }] });
                      } else {
                        acc[categoryIndex].icons.push({ key, data });
                      }
                      return acc;
                    }, [] as any[]).map((group: any) => (
                      <React.Fragment key={group.category}>
                        <IonSelectOption disabled style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#666' }}>
                          {group.category}
                        </IonSelectOption>
                        {group.icons.map(({ key, data }: any) => (
                          <IonSelectOption key={key} value={key}>
                            {data.name}
                          </IonSelectOption>
                        ))}
                      </React.Fragment>
                    ))}
                  </IonSelect>
                </div>
              </IonItem>

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

        {/* SEKTION: Badge-Kriterien */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={settings} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Badge-Kriterien
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem lines="none" style={{ paddingBottom: '8px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Kriterium-Typ</IonLabel>
              </IonItem>
              {Object.entries(criteriaTypes).map(([value, type]: [string, any]) => {
                const isSelected = formData.criteria_type === value;
                // Remove emojis from label
                const labelWithoutEmoji = type.label.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

                return (
                  <IonItem
                    key={value}
                    lines="none"
                    button
                    detail={false}
                    onClick={() => {
                      if (!loading) {
                        setFormData({ ...formData, criteria_type: value });
                        setExtraCriteria({});
                      }
                    }}
                    disabled={loading}
                    style={{
                      '--min-height': '72px',
                      '--padding-start': '16px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px'
                    }}
                  >
                    <IonLabel>
                      <h3 style={{ fontWeight: '500', fontSize: '0.95rem', margin: '0 0 4px 0' }}>{labelWithoutEmoji}</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', margin: '0', whiteSpace: 'normal' }}>
                        {type.help}
                      </p>
                    </IonLabel>
                    <IonCheckbox
                      slot="end"
                      checked={isSelected}
                      disabled={loading}
                    />
                  </IonItem>
                );
              })}

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
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

        {/* SEKTION: Badge-Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={ribbon} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Badge-Status
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
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
                  <h3 style={{ color: '#333', margin: '0 0 4px 0', fontWeight: '600' }}>Versteckt (Geheimes Badge)</h3>
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

      </IonContent>
    </IonPage>
  );
};

export default BadgeManagementModal;