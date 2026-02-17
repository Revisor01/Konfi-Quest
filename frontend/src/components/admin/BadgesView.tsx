import React, { useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonItem,
  IonItemGroup,
  IonLabel,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/react';
import {
  trash,
  ribbon,
  ribbonOutline,
  trophy,
  checkmark,
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
  time,
  filterOutline,
  search
} from 'ionicons/icons';
import { filterBySearchTerm } from '../../utils/helpers';

import { star } from 'ionicons/icons';

// Badge Icon Mapping (shared with BadgeManagementModal)
const BADGE_ICONS: Record<string, any> = {
  trophy, medal, ribbon, star, checkmarkCircle, diamond, shield,
  flame, flash, rocket, sparkles, thumbsUp,
  heart, people, personAdd, chatbubbles, gift,
  book, school, construct, brush, colorPalette,
  sunny, moon, leaf, rose,
  calendar, today, time, timer, stopwatch,
  restaurant, fitness, bicycle, car, airplane, boat, camera, image, musicalNote, balloon,
  home, business, location, navigate, compass, pin, flag,
  informationCircle, helpCircle, alertCircle, hammer
};

// Helper function to get icon from string
const getIconFromString = (iconName: string) => {
  return BADGE_ICONS[iconName] || ribbon;
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
  color?: string;
}

interface BadgesViewProps {
  badges: Badge[];
  onUpdate: () => void;
  onAddBadgeClick: () => void;
  onSelectBadge: (badge: Badge) => void;
  onDeleteBadge: (badge: Badge) => void;
}

const BadgesView: React.FC<BadgesViewProps> = ({ 
  badges, 
  onUpdate, 
  onAddBadgeClick,
  onSelectBadge,
  onDeleteBadge
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');

  const filteredAndSortedBadges = (() => {
    let result = filterBySearchTerm(badges, searchTerm, ['name', 'description']);
    
    // Filter by status
    if (selectedFilter === 'aktiv') {
      result = result.filter(badge => badge.is_active && !badge.is_hidden);
    } else if (selectedFilter === 'versteckt') {
      result = result.filter(badge => badge.is_hidden);
    } else if (selectedFilter === 'inaktiv') {
      result = result.filter(badge => !badge.is_active);
    }
    
    // Sort by criteria_type first, then by name
    result = result.sort((a, b) => {
      const typeCompare = a.criteria_type.localeCompare(b.criteria_type);
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
    });
    
    return result;
  })();

  const getActiveBadges = () => {
    return badges.filter(badge => badge.is_active && !badge.is_hidden);
  };

  const getHiddenBadges = () => {
    return badges.filter(badge => badge.is_hidden);
  };

  const getInactiveBadges = () => {
    return badges.filter(badge => !badge.is_active);
  };

  const getTotalEarnedCount = () => {
    return badges.reduce((sum, badge) => sum + (badge.earned_count || 0), 0);
  };

  const getCriteriaTypeText = (type: string) => {
    switch (type) {
      case 'total_points': return 'Gesamtpunkte';
      case 'gottesdienst_points': return 'Gottesdienst';
      case 'gemeinde_points': return 'Gemeinde';
      case 'specific_activity': return 'Spezielle Aktivität';
      case 'both_categories': return 'Beide Kategorien';
      case 'activity_combination': return 'Aktivitätskombination';
      case 'category_activities': return 'Kategorie-Aktivitäten';
      case 'time_based': return 'Zeitbasiert';
      case 'activity_count': return 'Aktivitätsanzahl';
      case 'event_count': return 'Event-Teilnahmen';
      case 'bonus_points': return 'Bonuspunkte';
      case 'streak': return 'Serie';
      case 'unique_activities': return 'Einzigartige Aktivitäten';
      default: return type;
    }
  };

  const getBadgeStatusColor = (badge: Badge) => {
    if (!badge.is_active) return 'danger';
    if (badge.is_hidden) return 'warning';
    return 'success';
  };

  const getBadgeStatusText = (badge: Badge) => {
    if (!badge.is_active) return 'Inaktiv';
    if (badge.is_hidden) return 'Versteckt';
    return 'Aktiv';
  };

  return (
    <>
      {/* Header - Dashboard-Style */}
      <div style={{
        background: 'linear-gradient(135deg, #ff9500 0%, #e63946 100%)',
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
            BADGES
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
          <IonGrid style={{ padding: '0', margin: '0 4px' }}>
            <IonRow>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={ribbon}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{badges.length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Gesamt
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={checkmark}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getActiveBadges().length}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Aktiv
                  </div>
                </div>
              </IonCol>
              <IonCol size="4" style={{ padding: '0 4px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <IonIcon
                    icon={trophy}
                    style={{
                      fontSize: '1.5rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      marginBottom: '8px',
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }}
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getTotalEarnedCount()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Verliehen
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Tab Navigation - einfaches IonSegment */}
      <div style={{ margin: '16px' }}>
        <IonSegment
          value={selectedFilter}
          onIonChange={(e) => setSelectedFilter(e.detail.value as string)}
        >
          <IonSegmentButton value="alle">
            <IonLabel>Alle</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="aktiv">
            <IonLabel>Aktiv</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="versteckt">
            <IonLabel>Geheim</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="inaktiv">
            <IonLabel>Inaktiv</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {/* Suche */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--badges">
            <IonIcon icon={filterOutline} />
          </div>
          <IonLabel>Suche & Filter</IonLabel>
        </IonListHeader>
        <IonItemGroup>
          <IonItem>
            <IonIcon icon={search} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
            <IonInput
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Badge suchen..."
            />
          </IonItem>
        </IonItemGroup>
      </IonList>

      {/* Badges Liste - Gruppiert nach Typ */}
      {filteredAndSortedBadges.length === 0 ? (
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={ribbonOutline} />
            </div>
            <IonLabel>Badges (0)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon
                  icon={ribbonOutline}
                  style={{
                    fontSize: '3rem',
                    color: '#ff9500',
                    marginBottom: '16px',
                    display: 'block',
                    margin: '0 auto 16px auto'
                  }}
                />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Erstelle deinen ersten Badge!</p>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
      ) : (
        (() => {
          // Gruppiere Badges nach criteria_type
          const groupedBadges = filteredAndSortedBadges.reduce((acc, badge) => {
            const type = badge.criteria_type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(badge);
            return acc;
          }, {} as Record<string, Badge[]>);

          // Sortiere die Gruppen alphabetisch nach deutschem Namen
          const sortedGroups = Object.entries(groupedBadges).sort((a, b) =>
            getCriteriaTypeText(a[0]).localeCompare(getCriteriaTypeText(b[0]))
          );

          return sortedGroups.map(([criteriaType, typeBadges]) => (
            <IonList key={criteriaType} inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--badges">
                  <IonIcon icon={flash} />
                </div>
                <IonLabel>{getCriteriaTypeText(criteriaType)} ({typeBadges.length})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '16px' }}>
                  <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                    {typeBadges.map((badge, index) => {
                      const badgeColor = badge.color || '#667eea';
                      const isInactive = !badge.is_active;

                      // Status-Farbe und Text (Aktiv/Inaktiv)
                      const activeColor = badge.is_active ? '#34c759' : '#dc3545';
                      const activeText = badge.is_active ? 'Aktiv' : 'Inaktiv';

                      // Sichtbarkeits-Farbe und Text (Sichtbar/Geheim)
                      const visibilityColor = badge.is_hidden ? '#fd7e14' : '#007aff';
                      const visibilityText = badge.is_hidden ? 'Geheim' : 'Sichtbar';

                      return (
                        <IonItemSliding key={badge.id} style={{ marginBottom: index < typeBadges.length - 1 ? '8px' : '0' }}>
                          <IonItem
                            button
                            onClick={() => onSelectBadge(badge)}
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
                              className="app-list-item app-list-item--warning"
                              style={{
                                width: '100%',
                                borderLeftColor: badgeColor,
                                opacity: isInactive ? 0.6 : 1,
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Dual Corner Badges - Aktivität + Sichtbarkeit */}
                              <div style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                display: 'flex',
                                flexDirection: 'row',
                                zIndex: 10
                              }}>
                                {/* Sichtbarkeits-Badge */}
                                <div style={{
                                  backgroundColor: visibilityColor,
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '0 0 8px 8px'
                                }}>
                                  {visibilityText}
                                </div>
                                {/* Weißer Abstand */}
                                <div style={{ width: '2px', background: 'white' }} />
                                {/* Aktiv/Inaktiv-Badge */}
                                <div style={{
                                  backgroundColor: activeColor,
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '0 8px 0 8px'
                                }}>
                                  {activeText}
                                </div>
                              </div>
                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  {/* Badge Icon - mit Badge-eigener Farbe */}
                                  <div
                                    className="app-icon-circle app-icon-circle--lg"
                                    style={{ backgroundColor: isInactive ? '#999' : badgeColor }}
                                  >
                                    <IonIcon icon={getIconFromString(badge.icon)} />
                                  </div>

                                  {/* Content */}
                                  <div className="app-list-item__content">
                                    {/* Zeile 1: Titel */}
                                    <div
                                      className="app-list-item__title"
                                      style={{
                                        color: isInactive ? '#999' : undefined,
                                        paddingRight: '120px'
                                      }}
                                    >
                                      {badge.name}
                                    </div>

                                    {/* Zeile 2: Beschreibung */}
                                    {badge.description && (
                                      <div className="app-list-item__subtitle" style={{
                                        color: isInactive ? '#999' : '#666',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {badge.description}
                                      </div>
                                    )}

                                    {/* Zeile 3: Verliehen-Count */}
                                    <div className="app-list-item__meta">
                                      <span className="app-list-item__meta-item">
                                        <IonIcon icon={trophy} style={{ color: isInactive ? '#999' : '#ff9500' }} />
                                        {badge.earned_count || 0}x verliehen
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </IonItem>

                          <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none', gap: '0' } as any}>
                            <IonItemOption
                              onClick={() => onDeleteBadge(badge)}
                              style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                            >
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                <IonIcon icon={trash} />
                              </div>
                            </IonItemOption>
                          </IonItemOptions>
                        </IonItemSliding>
                      );
                    })}
                  </IonList>
                </IonCardContent>
              </IonCard>
            </IonList>
          ));
        })()
      )}
    </>
  );
};

export default BadgesView;