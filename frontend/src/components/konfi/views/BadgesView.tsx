import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonProgressBar
} from '@ionic/react';
import { 
  trophy,
  eyeOff,
  statsChart,
  trophyOutline
} from 'ionicons/icons';

interface Badge {
  id: number;
  name: string;
  description?: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string;
  is_hidden: boolean;
  is_active: boolean;
  color?: string;
  is_earned: boolean;
  earned_at?: string;
  progress_points?: number;
  progress_percentage?: number;
}

interface BadgesViewProps {
  badges: Badge[];
  badgeStats: {
    totalVisible: number;
    totalSecret: number;
  };
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

const BadgesView: React.FC<BadgesViewProps> = ({ 
  badges, 
  badgeStats,
  selectedFilter,
  onFilterChange
}) => {

  const getFilteredBadges = () => {
    let filtered;
    switch (selectedFilter) {
      case 'alle':
        filtered = badges;
        break;
      case 'nicht_erhalten':
        filtered = badges.filter(badge => !badge.is_earned);
        break;
      case 'in_arbeit':
        filtered = badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0);
        break;
      default:
        filtered = badges;
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getBadgeColor = (badge: Badge) => {
    if (badge.color) {
      return badge.color;
    }
    
    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32'; // Bronze
      if (badge.criteria_value <= 15) return '#c0c0c0'; // Silver
      return '#ffd700'; // Gold
    }
    return '#667eea'; // Default
  };

  const filteredBadges = getFilteredBadges();

  return (
    <div>
      {/* Achievements Header - Dashboard-Style */}
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
          top: '-10px',
          left: '12px',
          zIndex: 1
        }}>
          <h2 style={{
            fontSize: '3.5rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            ACHIEVE
          </h2>
          <h2 style={{
            fontSize: '3.5rem',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.1)',
            margin: '0',
            lineHeight: '0.8',
            letterSpacing: '-2px'
          }}>
            MENTS
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
                    <span style={{ fontSize: '1.5rem' }}>{badges.filter(b => b.is_earned && !b.is_hidden).length}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalVisible}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Badges
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
                    icon={statsChart} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{Math.round((badges.filter(b => b.is_earned).length / badges.length) * 100) || 0}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>%</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Erreicht
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
                    icon={eyeOff} 
                    style={{ 
                      fontSize: '1.5rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '8px', 
                      display: 'block',
                      margin: '0 auto 8px auto'
                    }} 
                  />
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '1.5rem' }}>{badges.filter(b => b.is_earned && b.is_hidden).length}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalSecret}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    Geheim
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </div>

      {/* Filter Navigation */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '16px' }}>
          <IonSegment 
            value={selectedFilter} 
            onIonChange={(e) => onFilterChange(e.detail.value as string)}
            style={{ 
              '--background': '#f8f9fa',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <IonSegmentButton value="alle">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem'  }}>Alle</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="nicht_erhalten">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem'  }}>Nicht erhalten</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="in_arbeit">
              <IonLabel style={{ fontWeight: '600', fontSize: '0.7rem'  }}>In Arbeit</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonCardContent>
      </IonCard>

      {/* Badges Grid - 2er Grid mit Square Cards */}
      <IonCard style={{ margin: '16px' }}>
        <IonCardContent style={{ padding: '14px 0px' }}>
          {filteredBadges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <IonIcon 
                icon={trophyOutline} 
                style={{ 
                  fontSize: '3rem', 
                  color: '#ff9500', 
                  marginBottom: '16px',
                  display: 'block',
                  margin: '0 auto 16px auto'
                }} 
              />
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
              <p style={{ color: '#999', margin: '0' }}>Sammle Punkte für deine ersten Achievements!</p>
            </div>
          ) : (
            <IonGrid style={{ padding: '0', margin: '0 4px' }}>
              <IonRow>
                {filteredBadges.map((badge) => (
                  <IonCol size="6" key={badge.id} style={{ padding: '0px 4px 8px 4px' }}>
                    <IonCard style={{
                      margin: '0',
                      backgroundColor: badge.is_earned ? '#fbfbfb' : '#f8f9fa',
                      border: badge.is_earned 
                        ? `1px solid ${getBadgeColor(badge)}30` 
                        : '1px solid #e0e0e0',
                      boxShadow: badge.is_earned 
                        ? `0 4px 12px ${getBadgeColor(badge)}20`
                        : '0 2px 8px rgba(0,0,0,0.04)',
                      opacity: badge.is_earned ? 1 : 0.7,
                      position: 'relative',
                      aspectRatio: '1',
                      height: 'auto',
                      borderRadius: '12px',
                    }}>
                      <IonCardContent style={{ 
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        position: 'relative'
                      }}>
                        {/* Farbiger Hintergrund für erreichte Badges */}
                        {badge.is_earned && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: `linear-gradient(135deg, ${getBadgeColor(badge)}15 0%, ${getBadgeColor(badge)}08 100%)`,
                            borderRadius: '12px',
                            zIndex: 0
                          }} />
                        )}
                        
                        {/* Content */}
                        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          {/* Header mit Icon und Status */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                            {/* Badge Icon - Klein oben links */}
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: badge.is_earned 
                                ? `linear-gradient(135deg, ${getBadgeColor(badge)} 0%, ${getBadgeColor(badge)}dd 100%)`
                                : 'linear-gradient(135deg, #e0e0e0 0%, #d0d0d0 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem',
                              boxShadow: badge.is_earned 
                                ? `0 3px 12px ${getBadgeColor(badge)}40`
                                : '0 2px 8px rgba(0,0,0,0.1)',
                              position: 'relative',
                              flexShrink: 0
                            }}>
                              {/* Geheimer Badge Chip */}
                              {badge.is_hidden && (
                                <div style={{
                                  position: 'absolute',
                                  top: '-4px',
                                  right: '-4px',
                                  background: '#ff6b35',
                                  color: 'white',
                                  fontSize: '0.5rem',
                                  fontWeight: '600',
                                  padding: '2px 4px',
                                  borderRadius: '6px',
                                  zIndex: 2
                                }}>
                                  ●
                                </div>
                              )}
                              <div style={{ 
                                color: badge.is_earned ? 'white' : '#999',
                                textShadow: badge.is_earned ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                                filter: badge.is_earned ? 'none' : 'grayscale(100%)'
                              }}>
                                {badge.icon}
                              </div>
                            </div>

                            {/* Status Badge mit Datum - Oben rechts */}
                            {badge.is_earned ? (
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: '2px',
                                flexShrink: 0
                              }}>
                                <span style={{
                                  color: getBadgeColor(badge),
                                  backgroundColor: `${getBadgeColor(badge)}20`,
                                  fontSize: '0.6rem',
                                  fontWeight: '700',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  border: `1px solid ${getBadgeColor(badge)}50`
                                }}>
                                  ERREICHT
                                </span>
                                {badge.earned_at && (
                                  <span style={{
                                    fontSize: '0.5rem',
                                    color: '#999'
                                  }}>
                                    {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                                  </span>
                                )}
                              </div>
                            ) : badge.progress_percentage && badge.progress_percentage > 0 ? (
                              <span style={{
                                color: '#667eea',
                                backgroundColor: '#667eea20',
                                fontSize: '0.6rem',
                                fontWeight: '700',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                border: '1px solid #667eea50',
                                flexShrink: 0
                              }}>
                                {badge.progress_points && badge.criteria_value ? 
                                  `${badge.progress_points}/${badge.criteria_value}` : 
                                  `${Math.round(badge.progress_percentage)}%`}
                              </span>
                            ) : (
                              <span style={{
                                color: '#999',
                                backgroundColor: '#f5f5f5',
                                fontSize: '0.6rem',
                                fontWeight: '600',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                flexShrink: 0
                              }}>
                                OFFEN
                              </span>
                            )}
                          </div>

                          {/* Badge Name und Beschreibung */}
                          <div style={{ flex: 1, marginBottom: '8px' }}>
                            <h3 style={{ 
                              margin: '0 0 4px 0', 
                              fontSize: '0.85rem', 
                              fontWeight: '600',
                              color: badge.is_earned ? '#333' : '#666',
                              lineHeight: '1.2'
                            }}>
                              {badge.name}
                            </h3>

                            <p style={{
                              margin: '0',
                              fontSize: '0.7rem',
                              color: badge.is_earned ? '#555' : '#888',
                              lineHeight: '1.3',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {badge.description}
                            </p>
                          </div>

                          {/* Progress Bar für laufende Badges */}
                          {!badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0 && (
                            <div style={{ width: '100%', marginBottom: '8px' }}>
                              <IonProgressBar 
                                value={badge.progress_percentage / 100}
                                style={{ 
                                  height: '4px', 
                                  borderRadius: '2px',
                                  '--progress-background': '#667eea'
                                }}
                              />
                            </div>
                          )}

                          {/* Zusatz-Info unten */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {/* Links: Geheim-Badge oder Datum */}
                            <div>
                              {badge.is_hidden && (
                                <span style={{
                                  fontSize: '0.55rem',
                                  color: '#ff6b35',
                                  fontWeight: '600',
                                  backgroundColor: '#fff5f0',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  border: '1px solid #ff6b35'
                                }}>
                                  GEHEIM
                                </span>
                              )}
                            </div>

                            {/* Rechts: Punkte */}
                            {badge.criteria_value > 0 && badge.criteria_type === 'total_points' && (
                              <div style={{
                                fontSize: '0.6rem',
                                color: badge.is_earned ? getBadgeColor(badge) : '#999',
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
                ))}
              </IonRow>
            </IonGrid>
          )}
        </IonCardContent>
      </IonCard>
    </div>
  );
};

export default BadgesView;