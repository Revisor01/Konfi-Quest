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
  eye,
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
          top: '-10px',
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
            ACHIEVE
          </h2>
          <h2 style={{
            fontSize: '4rem',
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
                    <span style={{ fontSize: '1.5rem' }}>{badges.filter(b => b.is_earned).length}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalVisible + badgeStats.totalSecret}</span>
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
                    icon={eye} 
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
                    Sichtbar
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

      {/* Badges Grid - 2 nebeneinander */}
      <IonGrid style={{ padding: '0 8px', paddingBottom: '32px' }}>
        <IonRow>
          {filteredBadges.map((badge) => (
            <IonCol size="6" key={badge.id} style={{ padding: '8px' }}>
              <div style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '16px',
                background: badge.is_earned 
                  ? `${getBadgeColor(badge)}10` 
                  : '#f8f9fa',
                border: badge.is_earned 
                  ? `2px solid ${getBadgeColor(badge)}` 
                  : '2px dashed #c0c0c0',
                boxShadow: badge.is_earned 
                  ? `0 4px 20px ${getBadgeColor(badge)}30`
                  : '0 2px 12px rgba(0,0,0,0.05)',
                opacity: badge.is_earned ? 1 : 0.6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Geheimer Badge Chip */}
                {badge.is_hidden && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: '#ff6b35',
                    color: 'white',
                    fontSize: '0.6rem',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '8px'
                  }}>
                    GEHEIM
                  </div>
                )}

                {/* Badge Icon */}
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '12px',
                  background: badge.is_earned 
                    ? `linear-gradient(135deg, ${getBadgeColor(badge)} 0%, ${getBadgeColor(badge)}dd 100%)`
                    : 'linear-gradient(135deg, #e0e0e0 0%, #d0d0d0 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  marginBottom: '12px',
                  boxShadow: badge.is_earned 
                    ? `0 4px 15px ${getBadgeColor(badge)}30`
                    : '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    color: badge.is_earned ? 'white' : '#999',
                    textShadow: badge.is_earned ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                    filter: badge.is_earned ? 'none' : 'grayscale(100%)'
                  }}>
                    {badge.icon}
                  </div>
                </div>

                {/* Badge Name */}
                <h3 style={{ 
                  margin: '0 0 4px 0', 
                  fontSize: '0.9rem', 
                  fontWeight: '700',
                  color: badge.is_earned ? '#333' : '#666',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}>
                  {badge.name}
                </h3>

                {/* Badge Beschreibung/Kriterium */}
                <p style={{
                  margin: '0 0 8px 0',
                  fontSize: '0.6rem',
                  color: badge.is_earned ? '#555' : '#888',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}>
                  {badge.description || `${badge.criteria_value} ${badge.criteria_type.replace('_', ' ')}`}
                </p>

                {/* Status/Progress */}
                {badge.is_earned ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      color: '#2dd36f',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}>
                      ✓ ERREICHT
                    </div>
                    {badge.earned_at && (
                      <div style={{
                        fontSize: '0.6rem',
                        color: '#999'
                      }}>
                        {new Date(badge.earned_at).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </div>
                ) : badge.progress_percentage && badge.progress_percentage > 0 ? (
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <IonProgressBar 
                      value={badge.progress_percentage / 100}
                      style={{ 
                        height: '4px', 
                        borderRadius: '2px',
                        marginBottom: '6px',
                        '--progress-background': '#667eea'
                      }}
                    />
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#666',
                      fontWeight: '600'
                    }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>{badge.progress_points || 0}</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: '500', opacity: 0.8 }}>/{badge.criteria_value}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#999',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>0</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: '500', opacity: 0.8 }}>/{badge.criteria_value}</span>
                  </div>
                )}
              </div>
            </IonCol>
          ))}
        </IonRow>

        {filteredBadges.length === 0 && (
          <IonRow>
            <IonCol size="12">
              <IonCard style={{ margin: '16px' }}>
                <IonCardContent>
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
                    <p style={{ color: '#999', margin: '0' }}>
                      {selectedFilter === 'alle' 
                        ? 'Noch keine Badges verfügbar' 
                        : selectedFilter === 'nicht_erhalten'
                        ? 'Alle Badges bereits erreicht!'
                        : selectedFilter === 'in_arbeit'
                        ? 'Du arbeitest noch an keinem Badge. Sammle Punkte!'
                        : 'Keine Badges gefunden'
                      }
                    </p>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        )}
      </IonGrid>
    </div>
  );
};

export default BadgesView;