import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonProgressBar,
  IonBadge
} from '@ionic/react';
import { trophy, ribbon, star, eye, eyeOff } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

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
  color?: string; // Badge color from database
  // Calculated fields
  is_earned: boolean;
  earned_at?: string;
  progress_points?: number;
  progress_percentage?: number;
}

interface BadgeData {
  earned: any[];
  available: any[];
  stats: {
    totalVisible: number;
    totalSecret: number;
  };
}

const KonfiBadgesPage: React.FC = () => {
  const { user, setError } = useApp();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeStats, setBadgeStats] = useState<{totalVisible: number, totalSecret: number}>({totalVisible: 0, totalSecret: 0});
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('alle');

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error('Keine Benutzer-ID verfügbar');
      }

      // Get current konfi data for progress calculation
      const [badgesResponse, konfiResponse] = await Promise.all([
        api.get(`/konfi/badges`),
        api.get(`/konfi/profile`)
      ]);

      const badgeData: BadgeData = badgesResponse.data;
      
      // Save badge stats from API
      if (badgeData.stats) {
        setBadgeStats(badgeData.stats);
      }
      const konfiData = konfiResponse.data;
      
      // Check if API has calculated points or if we need to calculate from activities
      let currentGottesdienstPoints = konfiData.gottesdienst_points;
      let currentGemeindePoints = konfiData.gemeinde_points;
      let currentTotalPoints = konfiData.total_points;
      
      // If points are null/undefined, calculate from activities + bonus
      if (currentGottesdienstPoints === null || currentGottesdienstPoints === undefined || 
          currentGemeindePoints === null || currentGemeindePoints === undefined) {
        
        console.log('📊 Badge API points are null, calculating from activities + bonus');
        
        // Base points from activities
        const baseGottesdienstPoints = konfiData.activities
          ?.filter((activity: any) => activity.type === 'gottesdienst')
          ?.reduce((sum: number, activity: any) => sum + (activity.points || 0), 0) || 0;
        
        const baseGemeindePoints = konfiData.activities
          ?.filter((activity: any) => activity.type === 'gemeinde')
          ?.reduce((sum: number, activity: any) => sum + (activity.points || 0), 0) || 0;
        
        // Bonus points categorized by type - use bonusPoints (not bonus_points!)
        let bonusGottesdienstPoints = 0;
        let bonusGemeindePoints = 0;
        
        if (konfiData.bonusPoints && Array.isArray(konfiData.bonusPoints)) {
          bonusGottesdienstPoints = konfiData.bonusPoints
            .filter((bonus: any) => bonus.type === 'gottesdienst')
            .reduce((sum: number, bonus: any) => sum + (bonus.points || 0), 0);
          
          bonusGemeindePoints = konfiData.bonusPoints
            .filter((bonus: any) => bonus.type === 'gemeinde')
            .reduce((sum: number, bonus: any) => sum + (bonus.points || 0), 0);
        }
        
        // Total per category (activities + bonus)
        currentGottesdienstPoints = baseGottesdienstPoints + bonusGottesdienstPoints;
        currentGemeindePoints = baseGemeindePoints + bonusGemeindePoints;
        currentTotalPoints = currentGottesdienstPoints + currentGemeindePoints;
        
        console.log('📊 Badge calculated points with bonus by category:', {
          baseGottesdienst: baseGottesdienstPoints,
          baseGemeinde: baseGemeindePoints,
          bonusGottesdienst: bonusGottesdienstPoints,
          bonusGemeinde: bonusGemeindePoints,
          finalGottesdienst: currentGottesdienstPoints,
          finalGemeinde: currentGemeindePoints,
          total: currentTotalPoints,
          activities: konfiData.activities?.length || 0,
          bonusEntries: konfiData.bonus_points?.length || 0
        });
      } else {
        // Use API points directly
        currentTotalPoints = currentTotalPoints || (currentGottesdienstPoints + currentGemeindePoints);
        console.log('📊 Badge using API points:', { currentGottesdienstPoints, currentGemeindePoints, currentTotalPoints });
      }

      // Process ALL badges (available + earned) - show ALL badges for motivation
      const allBadges = [...badgeData.available, ...badgeData.earned];
      
      // Remove duplicates and process
      const uniqueBadges = allBadges.reduce((acc: any[], current: any) => {
        const existingIndex = acc.findIndex(badge => badge.id === current.id);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          // If we already have this badge, prefer the earned version
          if (current.earned && !acc[existingIndex].earned) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      }, []);
      
      const processedBadges: Badge[] = uniqueBadges
        // Show ALL badges - even hidden ones for completionist motivation
        .map((badge: any) => {
          const isEarned = badgeData.earned.some((earned: any) => earned.id === badge.id);
          const earnedBadge = badgeData.earned.find((earned: any) => earned.id === badge.id);
          
          // Use progress from backend if available, otherwise calculate
          let progressPoints = badge.progress?.current || 0;
          let progressPercentage = badge.progress?.percentage || 0;
          
          // If backend didn't provide progress, calculate basic ones
          if (!badge.progress && !isEarned) {
            if (badge.criteria_type === 'total_points') {
              progressPoints = Math.min(currentTotalPoints, badge.criteria_value);
              progressPercentage = (progressPoints / badge.criteria_value) * 100;
            } else if (badge.criteria_type === 'gottesdienst_points') {
              progressPoints = Math.min(currentGottesdienstPoints, badge.criteria_value);
              progressPercentage = (progressPoints / badge.criteria_value) * 100;
            } else if (badge.criteria_type === 'gemeinde_points') {
              progressPoints = Math.min(currentGemeindePoints, badge.criteria_value);
              progressPercentage = (progressPoints / badge.criteria_value) * 100;
            } else if (badge.criteria_type === 'both_categories') {
              // For both_categories, show progress as minimum of both
              const gottesdienstProgress = Math.min(currentGottesdienstPoints, badge.criteria_value);
              const gemeindeProgress = Math.min(currentGemeindePoints, badge.criteria_value);
              progressPoints = Math.min(gottesdienstProgress, gemeindeProgress);
              progressPercentage = (progressPoints / badge.criteria_value) * 100;
            }
          }
          
          return {
            id: badge.id,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            criteria_type: badge.criteria_type,
            criteria_value: badge.criteria_value,
            criteria_extra: badge.criteria_extra,
            is_hidden: badge.is_hidden,
            is_active: badge.is_active,
            color: badge.color, // Include badge color
            is_earned: isEarned,
            earned_at: earnedBadge?.earned_at,
            progress_points: progressPoints,
            progress_percentage: progressPercentage
          };
        });

      setBadges(processedBadges);
      
      // Debug: Log filter counts after loading
      setTimeout(() => {
        getFilterCounts();
      }, 100);
    } catch (err) {
      setError('Fehler beim Laden der Badges');
      console.error('Error loading badges:', err);
    } finally {
      setLoading(false);
    }
  };

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
        filtered = badges; // Default: alle
    }
    
    // Alphabetisch sortieren
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Debug-Funktion für Filter
  const getFilterCounts = () => {
    const all = badges.length;
    const earned = badges.filter(badge => badge.is_earned).length;
    const inWork = badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0).length;
    console.log('🔍 Badge Filter Counts:', { all, earned, inWork, badges: badges.map(b => ({ name: b.name, earned: b.is_earned, progress: b.progress_percentage })) });
    return { all, earned, inWork };
  };

  const getBadgeColor = (badge: Badge) => {
    // Use badge color from database if available
    if (badge.color) {
      return badge.color;
    }
    
    // Fallback to old logic if no color is set
    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32'; // Bronze
      if (badge.criteria_value <= 15) return '#c0c0c0'; // Silver
      return '#ffd700'; // Gold
    }
    return '#667eea'; // Default
  };

  // Entfernt - verwenden jetzt getFilterCounts() für Debug

  const filteredBadges = getFilteredBadges();

  if (loading) {
    return <LoadingSpinner message="Badges werden geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Achievements</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Achievements</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadBadges();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

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
            <IonGrid style={{ padding: '0', margin: '0 8px' }}>
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

        {/* Progress Overview - AUSKOMMENTIERT: Zu viel visuelle Unruhe
        <div style={{
          background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
          borderRadius: '20px',
          padding: '16px',
          margin: '16px',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon 
                icon={ribbon} 
                style={{ 
                  fontSize: '1.2rem', 
                  color: 'white' 
                }} 
              />
              <span style={{ fontSize: '1rem', color: 'white', fontWeight: '600' }}>
                Badge-Fortschritt
              </span>
            </div>
            <span style={{ fontSize: '1rem', color: 'white', fontWeight: '700' }}>
              <span style={{ fontSize: '1.3rem' }}>{badges.filter(b => b.is_earned).length}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8 }}> / {badgeStats.totalVisible + badgeStats.totalSecret}</span>
            </span>
          </div>
          
          <IonProgressBar 
            value={Math.min(badges.filter(b => b.is_earned).length / (badgeStats.totalVisible + badgeStats.totalSecret), 1)}
            style={{
              height: '10px',
              borderRadius: '5px',
              '--progress-background': 'linear-gradient(90deg, #667eea, #764ba2)',
              '--background': 'rgba(255, 255, 255, 0.3)'
            }}
          />
          
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '0.8rem', 
                color: 'rgba(255, 255, 255, 0.9)', 
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={eye} style={{ fontSize: '0.8rem' }} />
                  <span>Sichtbare</span>
                </div>
                <span style={{ fontWeight: '700' }}>
                  <span style={{ fontSize: '0.9rem' }}>{badges.filter(b => b.is_earned && !b.is_hidden).length}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalVisible}</span>
                </span>
              </div>
              <IonProgressBar 
                value={Math.min(badges.filter(b => b.is_earned && !b.is_hidden).length / badgeStats.totalVisible, 1)}
                style={{
                  height: '4px',
                  borderRadius: '2px',
                  '--progress-background': '#2dd36f',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '0.8rem', 
                color: 'rgba(255, 255, 255, 0.9)', 
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={star} style={{ fontSize: '0.8rem' }} />
                  <span>Geheime</span>
                </div>
                <span style={{ fontWeight: '700' }}>
                  <span style={{ fontSize: '0.9rem' }}>{badges.filter(b => b.is_earned && b.is_hidden).length}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '500', opacity: 0.8 }}>/{badgeStats.totalSecret}</span>
                </span>
              </div>
              <IonProgressBar 
                value={Math.min(badges.filter(b => b.is_earned && b.is_hidden).length / badgeStats.totalSecret, 1)}
                style={{
                  height: '4px',
                  borderRadius: '2px',
                  '--progress-background': '#ffd700',
                  '--background': 'rgba(255, 255, 255, 0.3)'
                }}
              />
            </div>
          </div>
        </div>
        */}

        {/* Filter Navigation - Vereinfacht wie gewünscht */}
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
                <IonLabel style={{ fontWeight: '600' }}>Alle</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="nicht_erhalten">
                <IonLabel style={{ fontWeight: '600' }}>Nicht erhalten</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="in_arbeit">
                <IonLabel style={{ fontWeight: '600' }}>In Arbeit</IonLabel>
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
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <div style={{ fontSize: '3rem', color: '#ccc', marginBottom: '16px' }}>🏆</div>
                  <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
                  <p style={{ color: '#999', margin: '0' }}>
                    {selectedFilter === 'alle' 
                      ? 'Noch keine Badges verfügbar' 
                      : selectedFilter === 'nicht_erhalten'
                      ? 'Alle Badges bereits erreicht! 🎉'
                      : selectedFilter === 'in_arbeit'
                      ? 'Du arbeitest noch an keinem Badge. Sammle Punkte!'
                      : 'Keine Badges gefunden'
                    }
                  </p>
                </div>
              </IonCol>
            </IonRow>
          )}
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default KonfiBadgesPage;