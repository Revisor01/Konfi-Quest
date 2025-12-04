import React, { useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  add,
  trash,
  create,
  search,
  ribbon,
  trophy,
  star,
  checkmark,
  eye,
  eyeOff,
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
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

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
    
    // Sort by name
    result = result.sort((a, b) => a.name.localeCompare(b.name));
    
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

      {/* Suchfeld */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '14px 16px' }}>
          <IonItem
            lines="none"
            style={{
              '--background': '#f8f9fa',
              '--border-radius': '12px',
              '--padding-start': '12px',
              '--padding-end': '12px',
              margin: '0'
            }}
          >
            <IonIcon
              icon={search}
              slot="start"
              style={{
                color: '#8e8e93',
                marginRight: '8px',
                fontSize: '1rem'
              }}
            />
            <IonInput
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
              placeholder="Badge suchen..."
              style={{
                '--color': '#000',
                '--placeholder-color': '#8e8e93'
              }}
            />
          </IonItem>
        </IonCardContent>
      </IonCard>

      {/* Tab Filter */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonSegment
            value={selectedFilter}
            onIonChange={(e) => setSelectedFilter(e.detail.value as string)}
            style={{
              '--background': '#f8f9fa',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="aktiv">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Aktiv</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="versteckt">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Versteckt</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="inaktiv">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.75rem' }}>Inaktiv</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Badges Grid - Kachel-Ansicht wie Konfi-Dashboard */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '14px 0px' }}>
          {filteredAndSortedBadges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <IonIcon
                icon={ribbon}
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
          ) : (
            <IonGrid style={{ padding: '0', margin: '0 4px' }}>
              <IonRow>
                {filteredAndSortedBadges.map((badge) => {
                  const badgeColor = badge.color || '#667eea';
                  const isInactive = !badge.is_active;

                  return (
                    <IonCol size="6" sizeMd="4" sizeLg="3" sizeXl="2" key={badge.id} style={{ padding: '0px 4px 8px 4px' }}>
                      <IonCard
                        button
                        onClick={() => onSelectBadge(badge)}
                        style={{
                          margin: '0',
                          backgroundColor: isInactive ? '#f5f5f5' : '#fbfbfb',
                          border: isInactive
                            ? '1px solid #e0e0e0'
                            : `1px solid ${badgeColor}30`,
                          boxShadow: isInactive
                            ? '0 2px 8px rgba(0,0,0,0.04)'
                            : `0 4px 12px ${badgeColor}20`,
                          opacity: isInactive ? 0.7 : 1,
                          position: 'relative',
                          aspectRatio: '1',
                          height: 'auto',
                          borderRadius: '12px',
                        }}>

                        {/* Delete Button - oben rechts */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBadge(badge);
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '28px',
                            height: '28px',
                            backgroundColor: 'rgba(220, 53, 69, 0.9)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(220, 53, 69, 0.4)',
                            zIndex: 10,
                            cursor: 'pointer'
                          }}
                        >
                          <IonIcon icon={trash} style={{ fontSize: '0.85rem', color: 'white' }} />
                        </div>

                        <IonCardContent style={{
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          height: '100%',
                          position: 'relative'
                        }}>
                          {/* Farbiger Hintergrund */}
                          {!isInactive && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: `linear-gradient(135deg, ${badgeColor}15 0%, ${badgeColor}08 100%)`,
                              borderRadius: '12px',
                              zIndex: 0
                            }} />
                          )}

                          {/* Content */}
                          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            {/* Header mit Icon und Status */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                              {/* Badge Icon */}
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: isInactive
                                  ? 'linear-gradient(135deg, #e0e0e0 0%, #d0d0d0 100%)'
                                  : `linear-gradient(135deg, ${badgeColor} 0%, ${badgeColor}dd 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isInactive
                                  ? '0 2px 8px rgba(0,0,0,0.1)'
                                  : `0 3px 12px ${badgeColor}40`,
                                flexShrink: 0
                              }}>
                                <IonIcon
                                  icon={getIconFromString(badge.icon)}
                                  style={{
                                    fontSize: '1.3rem',
                                    color: 'white'
                                  }}
                                />
                              </div>

                              {/* Status Badge */}
                              <span style={{
                                fontSize: '0.55rem',
                                color: (() => {
                                  if (!badge.is_active) return '#dc3545';
                                  if (badge.is_hidden) return '#fd7e14';
                                  return badgeColor;
                                })(),
                                fontWeight: '700',
                                backgroundColor: (() => {
                                  if (!badge.is_active) return 'rgba(220, 38, 38, 0.15)';
                                  if (badge.is_hidden) return 'rgba(253, 126, 20, 0.15)';
                                  return `${badgeColor}20`;
                                })(),
                                padding: '3px 6px',
                                borderRadius: '6px',
                                border: (() => {
                                  if (!badge.is_active) return '1px solid rgba(220, 38, 38, 0.3)';
                                  if (badge.is_hidden) return '1px solid rgba(253, 126, 20, 0.3)';
                                  return `1px solid ${badgeColor}50`;
                                })(),
                                flexShrink: 0
                              }}>
                                {(() => {
                                  if (!badge.is_active) return 'INAKTIV';
                                  if (badge.is_hidden) return 'VERSTECKT';
                                  return 'AKTIV';
                                })()}
                              </span>
                            </div>

                            {/* Badge Name und Beschreibung */}
                            <div style={{ flex: 1, marginBottom: '8px' }}>
                              <h3 style={{
                                margin: '0 0 4px 0',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                color: isInactive ? '#999' : '#333',
                                lineHeight: '1.2'
                              }}>
                                {badge.name}
                              </h3>

                              {badge.description && (
                                <p style={{
                                  margin: '0',
                                  fontSize: '0.7rem',
                                  color: isInactive ? '#aaa' : '#666',
                                  lineHeight: '1.3',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}>
                                  {badge.description}
                                </p>
                              )}
                            </div>

                            {/* Footer: Verleihungen und Punkte */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <IonIcon icon={trophy} style={{ fontSize: '0.7rem', color: isInactive ? '#999' : '#34c759' }} />
                                <span style={{ fontSize: '0.65rem', color: isInactive ? '#999' : '#666' }}>
                                  {badge.earned_count || 0}x
                                </span>
                              </div>
                              {badge.criteria_type.includes('points') && (
                                <div style={{
                                  fontSize: '0.6rem',
                                  color: isInactive ? '#999' : badgeColor,
                                  fontWeight: '600'
                                }}>
                                  {badge.criteria_value} Pkt
                                </div>
                              )}
                            </div>
                          </div>
                        </IonCardContent>
                      </IonCard>
                    </IonCol>
                  );
                })}
              </IonRow>
            </IonGrid>
          )}
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default BadgesView;