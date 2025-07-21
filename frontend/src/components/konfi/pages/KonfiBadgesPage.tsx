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
import {
  trophy,
  checkmark,
  statsChart,
  lockClosed
} from 'ionicons/icons';
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

      // Process all available badges
      const processedBadges: Badge[] = badgeData.available
        .filter((badge: any) => !badge.is_hidden) // Hide secret badges from overview
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

  const getBadgeColor = (badge: Badge) => {
    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32'; // Bronze
      if (badge.criteria_value <= 15) return '#c0c0c0'; // Silver
      return '#ffd700'; // Gold
    }
    return '#667eea'; // Default
  };

  const getEarnedCount = () => badges.filter(badge => badge.is_earned).length;
  const getInWorkCount = () => badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0).length;

  const filteredBadges = getFilteredBadges();

  if (loading) {
    return <LoadingSpinner message="Badges werden geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Badges</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadBadges();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Header Statistiken */}
        <IonCard style={{
          margin: '16px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
          color: '#8B4513',
          boxShadow: '0 10px 30px rgba(255, 215, 0, 0.3)'
        }}>
          <IonCardContent style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏆</div>
              <h2 style={{ margin: '0', fontSize: '1.3rem', fontWeight: '600' }}>
                Badge-Sammlung
              </h2>
            </div>
            <IonGrid>
              <IonRow>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '1.8rem', fontWeight: '700' }}>
                      {getEarnedCount()}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                      Erhalten
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '1.8rem', fontWeight: '700' }}>
                      {getInWorkCount()}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                      In Arbeit
                    </p>
                  </div>
                </IonCol>
                <IonCol size="4">
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0', fontSize: '1.8rem', fontWeight: '700' }}>
                      {badges.length}
                    </h3>
                    <p style={{ margin: '0', fontSize: '0.85rem', opacity: 0.8 }}>
                      Gesamt
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
                borderRadius: '8px',
                padding: '4px'
              }}
            >
              <IonSegmentButton value="alle">
                <IonIcon icon={trophy} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Alle</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="erhalten">
                <IonIcon icon={checkmark} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Erhalten</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="in_arbeit">
                <IonIcon icon={statsChart} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>In Arbeit</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonCardContent>
        </IonCard>

        {/* Badges Grid */}
        <div style={{ margin: '0 16px', paddingBottom: '32px' }}>
          <IonGrid>
            <IonRow>
              {filteredBadges.map((badge) => (
                <IonCol size="6" key={badge.id}>
                  <IonCard 
                    style={{ 
                      margin: '0 0 16px 0',
                      borderRadius: '16px',
                      height: '180px',
                      position: 'relative',
                      overflow: 'hidden',
                      background: badge.is_earned 
                        ? `linear-gradient(135deg, ${getBadgeColor(badge)} 0%, ${getBadgeColor(badge)}cc 100%)`
                        : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                      border: badge.is_earned ? 'none' : '2px dashed #dee2e6',
                      boxShadow: badge.is_earned 
                        ? `0 8px 25px ${getBadgeColor(badge)}40`
                        : '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <IonCardContent style={{ 
                      padding: '16px', 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      {/* Badge Icon */}
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: badge.is_earned 
                          ? 'rgba(255, 255, 255, 0.2)'
                          : 'rgba(146, 146, 150, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px',
                        opacity: badge.is_earned ? 1 : 0.4,
                        fontSize: badge.is_earned ? '2rem' : '1.5rem'
                      }}>
                        {badge.is_earned ? (
                          <div>{badge.icon}</div>
                        ) : (
                          <IonIcon 
                            icon={badge.progress_percentage && badge.progress_percentage > 0 ? statsChart : lockClosed} 
                            style={{ 
                              fontSize: '1.5rem', 
                              color: '#929296'
                            }} 
                          />
                        )}
                      </div>

                      {/* Badge Name */}
                      <h3 style={{ 
                        margin: '0 0 4px 0', 
                        fontSize: '0.9rem', 
                        fontWeight: '600',
                        color: badge.is_earned ? 'white' : '#333',
                        lineHeight: '1.2'
                      }}>
                        {badge.name}
                      </h3>
                      
                      {/* Badge Description */}
                      {badge.description && (
                        <p style={{
                          margin: '0 0 8px 0',
                          fontSize: '0.7rem',
                          color: badge.is_earned ? 'rgba(255,255,255,0.8)' : '#666',
                          lineHeight: '1.1',
                          textAlign: 'center'
                        }}>
                          {badge.description}
                        </p>
                      )}

                      {/* Badge Info */}
                      <div style={{ marginTop: 'auto', width: '100%' }}>
                        {badge.is_earned ? (
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            fontSize: '0.7rem',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontWeight: '600'
                          }}>
                            ✓ Erhalten
                          </div>
                        ) : badge.progress_percentage && badge.progress_percentage > 0 ? (
                          <>
                            <IonProgressBar 
                              value={badge.progress_percentage / 100}
                              style={{ 
                                height: '4px', 
                                borderRadius: '2px',
                                marginBottom: '8px',
                                '--progress-background': getBadgeColor(badge)
                              }}
                            />
                            <p style={{ 
                              margin: '0', 
                              fontSize: '0.7rem', 
                              color: '#666',
                              fontWeight: '500'
                            }}>
                              {Math.round(badge.progress_percentage)}%
                            </p>
                          </>
                        ) : (
                          <p style={{ 
                            margin: '0', 
                            fontSize: '0.7rem', 
                            color: '#999',
                            fontWeight: '500'
                          }}>
                            {badge.criteria_value} Punkte benötigt
                          </p>
                        )}
                      </div>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>

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