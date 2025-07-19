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
  IonButton,
  IonItem,
  IonLabel,
  IonChip,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonInput,
  IonModal,
  IonButtons,
  IonProgressBar,
  IonBadge,
  IonAvatar
} from '@ionic/react';
import {
  trophy,
  star,
  medal,
  ribbon,
  gift,
  flame,
  heart,
  sparkles,
  rocket,
  checkmark,
  close,
  search,
  lockClosed,
  informationCircle,
  statsChart,
  calendar,
  flash
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface Badge {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  points_required: number;
  is_earned: boolean;
  earned_at?: string;
  progress_points?: number;
  progress_percentage?: number;
  category?: string;
  requirements?: string[];
  activities?: Activity[];
}

interface Activity {
  id: number;
  title: string;
  points: number;
  is_completed: boolean;
}

interface BadgeStats {
  total_badges: number;
  earned_badges: number;
  progress_badges: number;
  locked_badges: number;
  total_possible_points: number;
  earned_points: number;
}

const KonfiBadgesPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('alle');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    setLoading(true);
    try {
      const [badgesResponse, statsResponse] = await Promise.all([
        api.get('/konfi/badges'),
        api.get('/konfi/badges/stats')
      ]);
      setBadges(badgesResponse.data);
      setStats(statsResponse.data);
    } catch (err) {
      setError('Fehler beim Laden der Badges');
      console.error('Error loading badges:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBadges = () => {
    let filtered = badges;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(badge =>
        badge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        badge.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        badge.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    switch (selectedFilter) {
      case 'erhalten':
        filtered = filtered.filter(badge => badge.is_earned);
        break;
      case 'fortschritt':
        filtered = filtered.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0);
        break;
      case 'verfuegbar':
        filtered = filtered.filter(badge => !badge.is_earned && badge.progress_percentage === 0);
        break;
    }

    // Sort: earned first, then by progress, then by points required
    return filtered.sort((a, b) => {
      if (a.is_earned && !b.is_earned) return -1;
      if (!a.is_earned && b.is_earned) return 1;
      if (!a.is_earned && !b.is_earned) {
        const aProgress = a.progress_percentage || 0;
        const bProgress = b.progress_percentage || 0;
        if (aProgress !== bProgress) return bProgress - aProgress;
        return a.points_required - b.points_required;
      }
      return new Date(b.earned_at || '').getTime() - new Date(a.earned_at || '').getTime();
    });
  };

  const getBadgeIcon = (badge: Badge) => {
    switch (badge.icon) {
      case 'star': return star;
      case 'trophy': return trophy;
      case 'medal': return medal;
      case 'ribbon': return ribbon;
      case 'flame': return flame;
      case 'heart': return heart;
      case 'sparkles': return sparkles;
      case 'rocket': return rocket;
      default: return gift;
    }
  };

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'gold': return '#ffd700';
      case 'silver': return '#c0c0c0';
      case 'bronze': return '#cd7f32';
      case 'blue': return '#3880ff';
      case 'green': return '#2dd36f';
      case 'purple': return '#8b5cf6';
      case 'orange': return '#ff6b35';
      case 'red': return '#f53d3d';
      default: return '#667eea';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'gottesdienst': return '#8b5cf6';
      case 'gemeinde': return '#2dd36f';
      case 'aktivität': return '#3880ff';
      case 'besonders': return '#ff6b35';
      default: return '#667eea';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getEarnedCount = () => {
    return badges.filter(badge => badge.is_earned).length;
  };

  const getProgressCount = () => {
    return badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0).length;
  };

  const getAvailableCount = () => {
    return badges.filter(badge => !badge.is_earned && (badge.progress_percentage === 0 || !badge.progress_percentage)).length;
  };

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
              <IonIcon icon={trophy} style={{ fontSize: '2.5rem', marginBottom: '8px' }} />
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
                      {getProgressCount()}
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

            {stats && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Fortschritt</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                    {Math.round((stats.earned_badges / stats.total_badges) * 100)}%
                  </span>
                </div>
                <IonProgressBar 
                  value={stats.earned_badges / stats.total_badges}
                  style={{ 
                    height: '8px', 
                    borderRadius: '4px',
                    '--progress-background': 'linear-gradient(90deg, #B8860B, #DAA520)'
                  }}
                />
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {/* Search and Filter */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '16px' }}>
            {/* Search Bar */}
            <IonItem 
              lines="none" 
              style={{ 
                '--background': '#f8f9fa',
                '--border-radius': '8px',
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                '--padding-start': '12px',
                '--padding-end': '12px',
                '--min-height': '44px'
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

            {/* Filter Tabs */}
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
              <IonSegmentButton value="fortschritt">
                <IonIcon icon={statsChart} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>In Arbeit</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="verfuegbar">
                <IonIcon icon={star} style={{ fontSize: '1rem', marginRight: '4px' }} />
                <IonLabel>Verfügbar</IonLabel>
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
                    button
                    onClick={() => {
                      setSelectedBadge(badge);
                      setIsDetailModalOpen(true);
                    }}
                    style={{ 
                      margin: '0 0 16px 0',
                      borderRadius: '16px',
                      height: '180px',
                      position: 'relative',
                      overflow: 'hidden',
                      background: badge.is_earned 
                        ? `linear-gradient(135deg, ${getBadgeColor(badge.color)} 0%, ${getBadgeColor(badge.color)}cc 100%)`
                        : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                      border: badge.is_earned ? 'none' : '2px dashed #dee2e6'
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
                        opacity: badge.is_earned ? 1 : 0.4
                      }}>
                        {badge.is_earned ? (
                          <IonIcon 
                            icon={getBadgeIcon(badge)} 
                            style={{ 
                              fontSize: '2rem', 
                              color: 'white'
                            }} 
                          />
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
                        margin: '0 0 8px 0', 
                        fontSize: '0.9rem', 
                        fontWeight: '600',
                        color: badge.is_earned ? 'white' : '#333',
                        lineHeight: '1.2'
                      }}>
                        {badge.name}
                      </h3>

                      {/* Badge Info */}
                      <div style={{ marginTop: 'auto', width: '100%' }}>
                        {badge.is_earned ? (
                          <>
                            <IonChip 
                              style={{ 
                                '--background': 'rgba(255, 255, 255, 0.2)',
                                '--color': 'white',
                                fontSize: '0.7rem',
                                height: '20px',
                                marginBottom: '8px'
                              }}
                            >
                              <IonIcon icon={checkmark} style={{ fontSize: '0.7rem', marginRight: '2px' }} />
                              Erhalten
                            </IonChip>
                            {badge.earned_at && (
                              <p style={{ 
                                margin: '0', 
                                fontSize: '0.7rem', 
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontWeight: '500'
                              }}>
                                {formatDate(badge.earned_at)}
                              </p>
                            )}
                          </>
                        ) : badge.progress_percentage && badge.progress_percentage > 0 ? (
                          <>
                            <IonProgressBar 
                              value={badge.progress_percentage / 100}
                              style={{ 
                                height: '4px', 
                                borderRadius: '2px',
                                marginBottom: '8px',
                                '--progress-background': getBadgeColor(badge.color)
                              }}
                            />
                            <p style={{ 
                              margin: '0', 
                              fontSize: '0.7rem', 
                              color: '#666',
                              fontWeight: '500'
                            }}>
                              {Math.round(badge.progress_percentage)}% ({badge.progress_points}/{badge.points_required} Punkte)
                            </p>
                          </>
                        ) : (
                          <p style={{ 
                            margin: '0', 
                            fontSize: '0.7rem', 
                            color: '#999',
                            fontWeight: '500'
                          }}>
                            {badge.points_required} Punkte benötigt
                          </p>
                        )}
                      </div>

                      {/* Category Badge */}
                      {badge.category && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px'
                        }}>
                          <IonBadge 
                            style={{ 
                              '--background': getCategoryColor(badge.category),
                              fontSize: '0.6rem',
                              padding: '2px 6px'
                            }}
                          >
                            {badge.category}
                          </IonBadge>
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>

          {filteredBadges.length === 0 && (
            <IonCard style={{ textAlign: 'center', padding: '32px' }}>
              <IonIcon icon={trophy} style={{ fontSize: '3rem', color: '#ccc', marginBottom: '16px' }} />
              <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
              <p style={{ color: '#999', margin: '0' }}>
                {searchTerm.trim() 
                  ? 'Versuche einen anderen Suchbegriff'
                  : 'Noch keine Badges verfügbar'
                }
              </p>
            </IonCard>
          )}
        </div>

        {/* Badge Detail Modal */}
        <IonModal isOpen={isDetailModalOpen} onDidDismiss={() => setIsDetailModalOpen(false)}>
          {selectedBadge && (
            <IonPage>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>{selectedBadge.name}</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setIsDetailModalOpen(false)}>
                      <IonIcon icon={close} />
                    </IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent>
                <div style={{ padding: '16px' }}>
                  {/* Badge Header */}
                  <div style={{
                    background: selectedBadge.is_earned 
                      ? `linear-gradient(135deg, ${getBadgeColor(selectedBadge.color)} 0%, ${getBadgeColor(selectedBadge.color)}cc 100%)`
                      : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                    borderRadius: '20px',
                    padding: '32px',
                    color: selectedBadge.is_earned ? 'white' : '#333',
                    marginBottom: '16px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: selectedBadge.is_earned 
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(146, 146, 150, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px'
                    }}>
                      <IonIcon 
                        icon={selectedBadge.is_earned ? getBadgeIcon(selectedBadge) : lockClosed} 
                        style={{ 
                          fontSize: '3rem', 
                          color: selectedBadge.is_earned ? 'white' : '#929296'
                        }} 
                      />
                    </div>
                    
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '600' }}>
                      {selectedBadge.name}
                    </h1>
                    
                    {selectedBadge.category && (
                      <IonChip 
                        style={{ 
                          '--background': selectedBadge.is_earned ? 'rgba(255, 255, 255, 0.2)' : getCategoryColor(selectedBadge.category) + '20',
                          '--color': selectedBadge.is_earned ? 'white' : getCategoryColor(selectedBadge.category),
                          fontSize: '0.8rem',
                          marginBottom: '8px'
                        }}
                      >
                        {selectedBadge.category}
                      </IonChip>
                    )}

                    {selectedBadge.is_earned && selectedBadge.earned_at && (
                      <p style={{ margin: '0', opacity: 0.9, fontSize: '0.9rem' }}>
                        Erhalten am {formatDate(selectedBadge.earned_at)}
                      </p>
                    )}

                    {/* Sparkle effects for earned badges */}
                    {selectedBadge.is_earned && (
                      <>
                        <IonIcon 
                          icon={sparkles} 
                          style={{ 
                            position: 'absolute',
                            top: '20px',
                            left: '20px',
                            fontSize: '1.2rem',
                            opacity: 0.6,
                            animation: 'pulse 2s infinite'
                          }} 
                        />
                        <IonIcon 
                          icon={sparkles} 
                          style={{ 
                            position: 'absolute',
                            bottom: '20px',
                            right: '20px',
                            fontSize: '1rem',
                            opacity: 0.4,
                            animation: 'pulse 2s infinite 1s'
                          }} 
                        />
                      </>
                    )}
                  </div>

                  {/* Badge Description */}
                  {selectedBadge.description && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 12px 0' }}>Beschreibung</h3>
                        <p style={{ margin: '0', lineHeight: '1.5' }}>
                          {selectedBadge.description}
                        </p>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Progress */}
                  {!selectedBadge.is_earned && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 16px 0' }}>Fortschritt</h3>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                              {selectedBadge.progress_points || 0} / {selectedBadge.points_required} Punkte
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                              {Math.round(selectedBadge.progress_percentage || 0)}%
                            </span>
                          </div>
                          <IonProgressBar 
                            value={(selectedBadge.progress_percentage || 0) / 100}
                            style={{ 
                              height: '8px', 
                              borderRadius: '4px',
                              '--progress-background': getBadgeColor(selectedBadge.color)
                            }}
                          />
                        </div>

                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.85rem', 
                          color: '#666',
                          fontStyle: 'italic'
                        }}>
                          {selectedBadge.progress_percentage === 0 
                            ? 'Noch nicht angefangen - sammle Punkte um dieses Badge zu erhalten!'
                            : 'Du bist auf dem besten Weg! Weiter so! 🎉'
                          }
                        </p>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Requirements */}
                  {selectedBadge.requirements && selectedBadge.requirements.length > 0 && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 16px 0' }}>Anforderungen</h3>
                        <IonList style={{ margin: '0' }}>
                          {selectedBadge.requirements.map((requirement, index) => (
                            <IonItem key={index} lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                              <IonIcon 
                                icon={informationCircle} 
                                slot="start" 
                                color="primary" 
                                style={{ fontSize: '1rem' }}
                              />
                              <IonLabel>
                                <p style={{ margin: '0', fontSize: '0.9rem' }}>
                                  {requirement}
                                </p>
                              </IonLabel>
                            </IonItem>
                          ))}
                        </IonList>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Related Activities */}
                  {selectedBadge.activities && selectedBadge.activities.length > 0 && (
                    <IonCard>
                      <IonCardContent>
                        <h3 style={{ margin: '0 0 16px 0' }}>Zugehörige Aktivitäten</h3>
                        <IonList style={{ margin: '0' }}>
                          {selectedBadge.activities.map((activity) => (
                            <IonItem key={activity.id} lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                              <div slot="start" style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: activity.is_completed 
                                  ? 'linear-gradient(135deg, #2dd36f 0%, #26c764 100%)'
                                  : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '12px'
                              }}>
                                <IonIcon 
                                  icon={activity.is_completed ? checkmark : flash} 
                                  style={{ 
                                    fontSize: '0.9rem', 
                                    color: activity.is_completed ? 'white' : '#929296'
                                  }} 
                                />
                              </div>
                              <IonLabel>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: '500' }}>
                                  {activity.title}
                                </h4>
                                <p style={{ margin: '0', fontSize: '0.8rem', color: '#666' }}>
                                  {activity.points} {activity.points === 1 ? 'Punkt' : 'Punkte'}
                                  {activity.is_completed && ' • Abgeschlossen'}
                                </p>
                              </IonLabel>
                            </IonItem>
                          ))}
                        </IonList>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Motivational Message */}
                  {!selectedBadge.is_earned && (
                    <IonCard style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      marginBottom: '32px'
                    }}>
                      <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                        <IonIcon icon={rocket} style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                        <p style={{ margin: '0', fontSize: '0.9rem', fontStyle: 'italic' }}>
                          "Jeder Schritt bringt dich deinem Ziel näher! Du schaffst das! 💪"
                        </p>
                      </IonCardContent>
                    </IonCard>
                  )}
                </div>
              </IonContent>
            </IonPage>
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default KonfiBadgesPage;