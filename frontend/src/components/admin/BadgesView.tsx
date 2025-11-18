import React, { useState } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonBadge,
  IonList,
  IonChip,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  IonSegment,
  IonSegmentButton,
  useIonActionSheet
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
  eyeOff
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { filterBySearchTerm } from '../../utils/helpers';

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
  const [presentActionSheet] = useIonActionSheet();
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

      {/* Badges Liste */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '8px 0' }}>
          <IonList lines="none" style={{ background: 'transparent' }}>
            {filteredAndSortedBadges.map((badge) => {
              const badgeColor = badge.color || '#667eea';
              const isInactive = !badge.is_active;

              return (
                <IonItemSliding key={badge.id}>
                  <IonItem
                    button
                    onClick={() => onSelectBadge(badge)}
                    detail={false}
                    style={{
                      '--min-height': '110px',
                      '--padding-start': '16px',
                      '--padding-top': '0px',
                      '--padding-bottom': '0px',
                      '--background': '#fbfbfb',
                      '--border-radius': '12px',
                      margin: '6px 8px',
                      boxShadow: isInactive ? '0 2px 8px rgba(0,0,0,0.06)' : `0 2px 8px ${badgeColor}20`,
                      border: isInactive ? '1px solid #e0e0e0' : `1px solid ${badgeColor}30`,
                      borderRadius: '12px',
                      opacity: isInactive ? 0.6 : 1
                    }}
                  >
                    <IonLabel>
                      {/* Header mit Icon und Status Badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: isInactive ? '#6c757d' : badgeColor,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isInactive ? '0 2px 8px rgba(108, 117, 125, 0.3)' : `0 2px 8px ${badgeColor}50`,
                          flexShrink: 0,
                          fontSize: '1rem'
                        }}>
                          {badge.icon || '🏆'}
                        </div>
                        <h2 style={{
                          fontWeight: '600',
                          fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                          margin: '0',
                          color: isInactive ? '#999' : '#333',
                          lineHeight: '1.3',
                          flex: 1,
                          minWidth: 0,
                          marginRight: '110px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {badge.name}
                        </h2>

                        {/* Status Badge */}
                        <span style={{
                          fontSize: '0.7rem',
                          color: (() => {
                            if (!badge.is_active) return '#dc3545';
                            if (badge.is_hidden) return '#fd7e14';
                            return badgeColor;
                          })(),
                          fontWeight: '600',
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
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          position: 'absolute',
                          right: '0px',
                          top: '50%',
                          transform: 'translateY(-50%)'
                        }}>
                          {(() => {
                            if (!badge.is_active) return 'INAKTIV';
                            if (badge.is_hidden) return 'VERSTECKT';
                            return 'AKTIV';
                          })()}
                        </span>
                      </div>

                      {/* Beschreibung */}
                      {badge.description && (
                        <div style={{
                          fontSize: '0.85rem',
                          color: isInactive ? '#999' : '#666',
                          marginBottom: '6px',
                          marginLeft: '44px',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {badge.description}
                        </div>
                      )}

                      {/* Kriterien und Verleihungen */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        fontSize: '0.8rem',
                        color: isInactive ? '#999' : '#666',
                        marginLeft: '44px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={star} style={{ fontSize: '0.8rem', color: isInactive ? '#999' : '#ffc409' }} />
                          <span>{getCriteriaTypeText(badge.criteria_type)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={trophy} style={{ fontSize: '0.8rem', color: isInactive ? '#999' : '#34c759' }} />
                          <span>{badge.earned_count || 0} {badge.earned_count === 1 ? 'Verleihung' : 'Verleihungen'}</span>
                        </div>
                        {badge.criteria_type.includes('points') && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={ribbon} style={{ fontSize: '0.8rem', color: isInactive ? '#999' : badgeColor }} />
                            <span>{badge.criteria_value} Punkte</span>
                          </div>
                        )}
                      </div>
                    </IonLabel>
                  </IonItem>

                  <IonItemOptions side="end">
                    <IonItemOption
                      color="danger"
                      onClick={() => onDeleteBadge(badge)}
                    >
                      <IonIcon icon={trash} />
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}

            {filteredAndSortedBadges.length === 0 && (
              <IonItem>
                <IonLabel style={{ textAlign: 'center', color: '#666' }}>
                  <p>Keine Badges gefunden</p>
                </IonLabel>
              </IonItem>
            )}
          </IonList>
        </IonCardContent>
      </IonCard>
    </>
  );
};

export default BadgesView;