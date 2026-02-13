import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import BadgesView from '../views/BadgesView';
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
  const { pageRef, presentingElement } = useModalPage('konfi-badges');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeStats, setBadgeStats] = useState<{totalVisible: number, totalSecret: number}>({totalVisible: 0, totalSecret: 0});
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('alle');

  // Memoized refresh function for live updates
  const refreshBadges = useCallback(() => {
 console.log('Live Update: Refreshing badges...');
    loadBadges();
  }, []);

  // Subscribe to live updates for badges
  useLiveRefresh('badges', refreshBadges);

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
        
 console.log('Badge API points are null, calculating from activities + bonus');
        
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
        
 console.log('Badge calculated points with bonus by category:', {
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
 console.log('Badge using API points:', { currentGottesdienstPoints, currentGemeindePoints, currentTotalPoints });
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

      // Mark all badges as seen (removes TabBar badge)
      const hasUnseenBadges = badgeData.earned.some((badge: any) => !badge.seen);
      if (hasUnseenBadges) {
        try {
          await api.post('/konfi/badges/mark-seen');
        } catch (markError) {
 console.log('Could not mark badges as seen:', markError);
        }
      }

    } catch (err) {
      setError('Fehler beim Laden der Badges');
 console.error('Error loading badges:', err);
    } finally {
      setLoading(false);
    }
  };





  if (loading) {
    return <LoadingSpinner message="Badges werden geladen..." />;
  }

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Badges</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Badges</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadBadges();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>




        {loading ? (
          <LoadingSpinner message="Badges werden geladen..." />
        ) : (
          <BadgesView 
            badges={badges}
            badgeStats={badgeStats}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiBadgesPage;