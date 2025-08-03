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
// Removed icons - using emojis instead for cleaner look
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
  // Calculated fields
  is_earned: boolean;
  earned_at?: string;
  progress_points?: number;
  progress_percentage?: number;
}

interface BadgeData {
  earned: any[];
  available: any[];
  progress: string;
}

const KonfiBadgesPage: React.FC = () => {
  const { user, setError } = useApp();
  const [badges, setBadges] = useState<Badge[]>([]);
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

      // Process ALL badges (available + earned, but hide secret ones unless earned)
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
        .filter((badge: any) => {
          // Show badge if: not hidden OR already earned
          return !badge.is_hidden || badgeData.earned.some((earned: any) => earned.id === badge.id);
        })
        .map((badge: any) => {
          const isEarned = badgeData.earned.some((earned: any) => earned.id === badge.id);
          const earnedBadge = badgeData.earned.find((earned: any) => earned.id === badge.id);
          
          let progressPoints = 0;
          let progressPercentage = 0;
          
          if (!isEarned) {
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
    switch (selectedFilter) {
      case 'erhalten':
        return badges.filter(badge => badge.is_earned);
      case 'in_arbeit':
        return badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0);
      default:
        return badges;
    }
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
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle>Badges</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadBadges();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Achievements Header Card */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
          color: 'white',
          boxShadow: '0 10px 30px rgba(255, 107, 53, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background Pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            fontSize: '6rem',
            fontWeight: '900',
            opacity: 0.1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: '0.1em'
          }}>
            ACHIEVEMENTS
          </div>
          
          <IonCardContent style={{ padding: '24px', position: 'relative', zIndex: 2 }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏆</div>
              <h2 style={{ margin: '0', fontSize: '1.3rem', fontWeight: '600' }}>
                Achievements
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
                Sammle Badges und erreiche Meilensteine
              </p>
            </div>
            <IonGrid>
              <IonRow>
                <IonCol size="12">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '2.2rem', fontWeight: '700' }}>
                      {badges.length}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.9 }}>
                      Badges verfügbar
                    </p>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

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
              <IonSegmentButton value="erhalten">
                <IonLabel style={{ fontWeight: '600' }}>Erhalten</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="in_arbeit">
                <IonLabel style={{ fontWeight: '600' }}>In Arbeit</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonCardContent>
        </IonCard>

        {/* Badges Liste */}
        <div style={{ margin: '0 16px', paddingBottom: '32px' }}>
          {filteredBadges.map((badge) => (
            <IonCard 
              key={badge.id}
              style={{ 
                margin: '0 0 12px 0',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                background: badge.is_earned 
                  ? `linear-gradient(135deg, ${getBadgeColor(badge)} 0%, ${getBadgeColor(badge)}dd 100%)`
                  : '#ffffff',
                border: badge.is_earned ? 'none' : '1px solid #e0e0e0',
                boxShadow: badge.is_earned 
                  ? `0 8px 25px ${getBadgeColor(badge)}40`
                  : '0 2px 12px rgba(0,0,0,0.08)'
              }}
            >
              {/* Special Effects für erhalten Badges */}
              {badge.is_earned && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  color: 'white'
                }}>
                  {badge.is_hidden ? '🎉 GEHEIM' : '✓ ERREICHT'}
                </div>
              )}
              
              <IonCardContent style={{ 
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                {/* Badge Icon */}
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: badge.is_earned 
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  flexShrink: 0
                }}>
                  {badge.is_earned ? badge.icon : '🔒'}
                </div>

                {/* Badge Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Badge Name */}
                  <h3 style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: '1rem', 
                    fontWeight: '700',
                    color: badge.is_earned ? 'white' : '#333',
                    lineHeight: '1.2'
                  }}>
                    {badge.name}
                  </h3>
                  
                  {/* Badge Description */}
                  {badge.description && (
                    <p style={{
                      margin: '0 0 8px 0',
                      fontSize: '0.85rem',
                      color: badge.is_earned ? 'rgba(255,255,255,0.9)' : '#666',
                      lineHeight: '1.3'
                    }}>
                      {badge.description}
                    </p>
                  )}

                  {/* Progress/Status */}
                  {badge.is_earned ? (
                    <div style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: '0.8rem',
                      fontWeight: '500'
                    }}>
                      {badge.is_hidden && '🎊 Geheimes Badge entdeckt!'}
                    </div>
                  ) : badge.progress_percentage && badge.progress_percentage > 0 ? (
                    <div>
                      <IonProgressBar 
                        value={badge.progress_percentage / 100}
                        style={{ 
                          height: '6px', 
                          borderRadius: '3px',
                          marginBottom: '8px',
                          '--progress-background': getBadgeColor(badge)
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        <span>{badge.progress_points || 0}/{badge.criteria_value}</span>
                        <span>{Math.round(badge.progress_percentage)}%</span>
                      </div>
                    </div>
                  ) : (
                    <p style={{ 
                      margin: '0', 
                      fontSize: '0.8rem', 
                      color: '#999',
                      fontWeight: '500'
                    }}>
                      Noch nicht erreicht • {badge.criteria_value} benötigt
                    </p>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          ))}

          {filteredBadges.length === 0 && (
            <IonCard style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '3rem', color: '#ccc', marginBottom: '16px' }}>🏆</div>
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
              <p style={{ color: '#999', margin: '0' }}>
                {selectedFilter === 'erhalten' 
                  ? 'Du hast noch keine Badges erreicht. Sammle Punkte!' 
                  : selectedFilter === 'in_arbeit'
                  ? 'Du arbeitest noch an keinem Badge. Sammle Punkte!'
                  : 'Noch keine Badges verfügbar'
                }
              </p>
            </IonCard>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default KonfiBadgesPage;