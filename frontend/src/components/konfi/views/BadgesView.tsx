import React, { useState, useRef } from 'react';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonPopover,
  IonList,
  IonListHeader
} from '@ionic/react';
import {
  trophy,
  trophyOutline,
  medal,
  ribbon,
  star,
  checkmarkCircle,
  diamond,
  shield,
  flame,
  flash,
  rocket,
  sparkles,
  thumbsUp,
  heart,
  people,
  personAdd,
  chatbubbles,
  gift,
  book,
  school,
  construct,
  brush,
  colorPalette,
  sunny,
  moon,
  leaf,
  rose,
  calendar,
  today,
  time,
  timer,
  stopwatch,
  restaurant,
  fitness,
  bicycle,
  car,
  airplane,
  boat,
  camera,
  image,
  musicalNote,
  balloon,
  home,
  business,
  location,
  navigate,
  compass,
  pin,
  flag,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer,
  lockClosed,
  layersOutline,
  gridOutline,
  prismOutline,
  cubeOutline,
  handLeft,
  checkmark
} from 'ionicons/icons';

// Badge Icon Mapping
const BADGE_ICONS: Record<string, { icon: string; name: string; category: string }> = {
  trophy: { icon: trophy, name: 'Pokal', category: 'Erfolg' },
  medal: { icon: medal, name: 'Medaille', category: 'Erfolg' },
  ribbon: { icon: ribbon, name: 'Band', category: 'Erfolg' },
  star: { icon: star, name: 'Stern', category: 'Erfolg' },
  checkmarkCircle: { icon: checkmarkCircle, name: 'Bestanden', category: 'Erfolg' },
  diamond: { icon: diamond, name: 'Diamant', category: 'Erfolg' },
  shield: { icon: shield, name: 'Schild', category: 'Erfolg' },
  flame: { icon: flame, name: 'Flamme', category: 'Engagement' },
  flash: { icon: flash, name: 'Blitz', category: 'Engagement' },
  rocket: { icon: rocket, name: 'Rakete', category: 'Engagement' },
  sparkles: { icon: sparkles, name: 'Funken', category: 'Engagement' },
  thumbsUp: { icon: thumbsUp, name: 'Daumen hoch', category: 'Engagement' },
  heart: { icon: heart, name: 'Herz', category: 'Gemeinschaft' },
  people: { icon: people, name: 'Gruppe', category: 'Gemeinschaft' },
  personAdd: { icon: personAdd, name: 'Neue Person', category: 'Gemeinschaft' },
  chatbubbles: { icon: chatbubbles, name: 'Chat', category: 'Gemeinschaft' },
  gift: { icon: gift, name: 'Geschenk', category: 'Gemeinschaft' },
  book: { icon: book, name: 'Buch', category: 'Lernen' },
  school: { icon: school, name: 'Schule', category: 'Lernen' },
  construct: { icon: construct, name: 'Werkzeug', category: 'Lernen' },
  brush: { icon: brush, name: 'Pinsel', category: 'Lernen' },
  colorPalette: { icon: colorPalette, name: 'Farbpalette', category: 'Lernen' },
  sunny: { icon: sunny, name: 'Sonne', category: 'Natur' },
  moon: { icon: moon, name: 'Mond', category: 'Natur' },
  leaf: { icon: leaf, name: 'Blatt', category: 'Natur' },
  rose: { icon: rose, name: 'Rose', category: 'Natur' },
  calendar: { icon: calendar, name: 'Kalender', category: 'Zeit' },
  today: { icon: today, name: 'Heute', category: 'Zeit' },
  time: { icon: time, name: 'Uhr', category: 'Zeit' },
  timer: { icon: timer, name: 'Timer', category: 'Zeit' },
  stopwatch: { icon: stopwatch, name: 'Stoppuhr', category: 'Zeit' },
  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitäten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitäten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitäten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitäten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitäten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitäten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitäten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitäten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitäten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitäten' },
  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebäude', category: 'Orte' },
  location: { icon: location, name: 'Standort', category: 'Orte' },
  navigate: { icon: navigate, name: 'Navigation', category: 'Orte' },
  compass: { icon: compass, name: 'Kompass', category: 'Orte' },
  pin: { icon: pin, name: 'Pin', category: 'Orte' },
  flag: { icon: flag, name: 'Flagge', category: 'Orte' },
  informationCircle: { icon: informationCircle, name: 'Info', category: 'Sonstiges' },
  helpCircle: { icon: helpCircle, name: 'Hilfe', category: 'Sonstiges' },
  alertCircle: { icon: alertCircle, name: 'Warnung', category: 'Sonstiges' },
  hammer: { icon: hammer, name: 'Hammer', category: 'Sonstiges' }
};

// Helper function to get icon from string
const getIconFromString = (iconName: string): string => {
  return BADGE_ICONS[iconName]?.icon || trophy;
};

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
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [popoverEvent, setPopoverEvent] = useState<any>(null);

  // Badges nach Kategorien gruppieren
  const getBadgeCategories = () => {
    let filtered = badges;
    switch (selectedFilter) {
      case 'nicht_erhalten':
        filtered = badges.filter(badge => !badge.is_earned);
        break;
      case 'in_arbeit':
        filtered = badges.filter(badge => !badge.is_earned && badge.progress_percentage && badge.progress_percentage > 0);
        break;
      default:
        filtered = badges;
    }

    const categories: { key: string; title: string; icon: string; color: string; badges: Badge[] }[] = [
      { key: 'total_points', title: 'Punkte-Sammler', icon: trophy, color: '#ffd700', badges: filtered.filter(b => b.criteria_type === 'total_points').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'gottesdienst_points', title: 'Gottesdienst-Held', icon: sunny, color: '#ff9500', badges: filtered.filter(b => b.criteria_type === 'gottesdienst_points').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'gemeinde_points', title: 'Gemeinde-Star', icon: people, color: '#059669', badges: filtered.filter(b => b.criteria_type === 'gemeinde_points').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'bonus_points', title: 'Bonus-Jäger', icon: gift, color: '#ff6b9d', badges: filtered.filter(b => b.criteria_type === 'bonus_points').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'both_categories', title: 'Allrounder', icon: layersOutline, color: '#5856d6', badges: filtered.filter(b => b.criteria_type === 'both_categories').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'activity_count', title: 'Aktiv dabei', icon: checkmarkCircle, color: '#3880ff', badges: filtered.filter(b => b.criteria_type === 'activity_count').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'unique_activities', title: 'Vielseitig', icon: gridOutline, color: '#10dc60', badges: filtered.filter(b => b.criteria_type === 'unique_activities').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'activity_combination', title: 'Kombinier-Profi', icon: prismOutline, color: '#7044ff', badges: filtered.filter(b => b.criteria_type === 'activity_combination').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'category_activities', title: 'Kategorie-Meister', icon: cubeOutline, color: '#0cd1e8', badges: filtered.filter(b => b.criteria_type === 'category_activities').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'specific_activity', title: 'Spezialist', icon: handLeft, color: '#ffce00', badges: filtered.filter(b => b.criteria_type === 'specific_activity').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'streak', title: 'Serien-Champion', icon: flame, color: '#eb445a', badges: filtered.filter(b => b.criteria_type === 'streak').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'time_based', title: 'Zeitreisender', icon: time, color: '#8e8e93', badges: filtered.filter(b => b.criteria_type === 'time_based').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'event_count', title: 'Event-Champion', icon: calendar, color: '#e63946', badges: filtered.filter(b => b.criteria_type === 'event_count').sort((a, b) => a.criteria_value - b.criteria_value) }
    ];

    return categories.filter(cat => cat.badges.length > 0);
  };

  const badgeCategories = getBadgeCategories();
  const earnedSecretCount = badges.filter(b => b.is_earned && b.is_hidden).length;

  const getBadgeColor = (badge: Badge) => {
    if (badge.color) return badge.color;
    if (badge.criteria_type === 'total_points') {
      if (badge.criteria_value <= 5) return '#cd7f32';
      if (badge.criteria_value <= 15) return '#c0c0c0';
      return '#ffd700';
    }
    return '#667eea';
  };

  return (
    <div>
      {/* Achievements Header */}
      <div style={{
        background: 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)',
        borderRadius: '20px',
        padding: '24px',
        margin: '16px',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(255, 149, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IonIcon icon={trophy} style={{ fontSize: '1.6rem', color: 'white' }} />
          </div>
          <div>
            <h2 style={{ margin: '0', fontSize: '1.4rem', fontWeight: '700', color: 'white' }}>Deine Badges</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)' }}>Sammle alle Erfolge!</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 12px', textAlign: 'center', flex: '1 1 0', maxWidth: '100px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>{badges.filter(b => b.is_earned && !b.is_hidden).length}/{badgeStats.totalVisible}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>SICHTBAR</div>
          </div>
          {badgeStats.totalSecret > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 12px', textAlign: 'center', flex: '1 1 0', maxWidth: '100px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>{earnedSecretCount}/{badgeStats.totalSecret}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GEHEIM</div>
            </div>
          )}
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 12px', textAlign: 'center', flex: '1 1 0', maxWidth: '100px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'white' }}>{Math.round((badges.filter(b => b.is_earned).length / (badgeStats.totalVisible + badgeStats.totalSecret)) * 100) || 0}%</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GESAMT</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ margin: '16px' }}>
        <IonSegment value={selectedFilter} onIonChange={(e) => onFilterChange(e.detail.value as string)}>
          <IonSegmentButton value="alle"><IonLabel>Alle</IonLabel></IonSegmentButton>
          <IonSegmentButton value="nicht_erhalten"><IonLabel>Offen</IonLabel></IonSegmentButton>
          <IonSegmentButton value="in_arbeit"><IonLabel>In Arbeit</IonLabel></IonSegmentButton>
        </IonSegment>
      </div>

      {/* Badges Grid */}
      <IonList inset={true} style={{ margin: '16px' }}>
        <IonListHeader>
          <div className="app-section-icon app-section-icon--warning">
            <IonIcon icon={trophy} />
          </div>
          <IonLabel>Erreichte Badges ({badges.filter(b => b.is_earned).length})</IonLabel>
        </IonListHeader>
        {badgeCategories.length === 0 ? (
          <IonCard className="app-card">
            <IonCardContent>
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <IonIcon icon={trophyOutline} style={{ fontSize: '3rem', color: '#ff9500', marginBottom: '16px', display: 'block', margin: '0 auto 16px auto' }} />
                <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Badges gefunden</h3>
                <p style={{ color: '#999', margin: '0' }}>Sammle Punkte für deine ersten Badges!</p>
              </div>
            </IonCardContent>
          </IonCard>
        ) : (
          badgeCategories.map((category, index) => {
            const earnedCount = category.badges.filter(b => b.is_earned).length;
            const totalCount = category.badges.length;
            const progressPercent = Math.round((earnedCount / totalCount) * 100);
            const categorySecretCount = category.badges.filter(b => b.is_hidden).length;
            const categoryEarnedSecretCount = category.badges.filter(b => b.is_hidden && b.is_earned).length;
            const categoryHasUndiscoveredSecrets = categorySecretCount > categoryEarnedSecretCount;

            return (
              <IonCard key={category.key} className="app-card" style={{ marginTop: index > 0 ? '8px' : '0' }}>
                <IonCardContent style={{ padding: '16px' }}>
                  {/* Category Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}cc 100%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 12px ${category.color}40`
                      }}>
                        <IonIcon icon={category.icon} style={{ fontSize: '1.3rem', color: 'white' }} />
                      </div>
                      <div>
                        <h3 style={{ margin: '0', fontSize: '1.1rem', fontWeight: '700', color: '#333' }}>{category.title}</h3>
                        <span style={{ fontSize: '0.85rem', color: '#888' }}>{earnedCount} von {totalCount}</span>
                      </div>
                    </div>

                    {/* Progress Circle */}
                    <div style={{ width: '48px', height: '48px', position: 'relative' }}>
                      <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="24" cy="24" r="20" fill="none" stroke="#e8e8e8" strokeWidth="4" />
                        <circle cx="24" cy="24" r="20" fill="none" stroke={category.color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${progressPercent * 1.257} 125.7`} />
                      </svg>
                      <span style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        fontSize: progressPercent === 100 && categoryHasUndiscoveredSecrets ? '0.6rem' : '0.7rem',
                        fontWeight: '700', color: category.color
                      }}>
                        {progressPercent === 100 && categoryHasUndiscoveredSecrets ? '100%?' : `${progressPercent}%`}
                      </span>
                    </div>
                  </div>

                  {/* 3-Column Badge Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px'
                  }}>
                    {category.badges.map((badge) => {
                      const badgeColor = getBadgeColor(badge);
                      const isEarned = badge.is_earned;
                      const hasProgress = !isEarned && badge.progress_percentage && badge.progress_percentage > 0;

                      return (
                        <div
                          key={badge.id}
                          onClick={(e) => {
                            setSelectedBadge(badge);
                            setPopoverEvent(e);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '12px 8px',
                            borderRadius: '16px',
                            background: isEarned ? `${badgeColor}10` : '#f5f5f5',
                            border: isEarned ? `2px solid ${badgeColor}40` : '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            position: 'relative'
                          }}
                        >
                          {/* Badge Icon */}
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isEarned
                              ? `linear-gradient(145deg, ${badgeColor} 0%, ${badgeColor}cc 100%)`
                              : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
                            boxShadow: isEarned ? `0 4px 12px ${badgeColor}40` : '0 2px 8px rgba(0,0,0,0.1)',
                            position: 'relative',
                            marginBottom: '8px'
                          }}>
                            {/* Progress Ring */}
                            {hasProgress && (
                              <svg style={{ position: 'absolute', top: '-4px', left: '-4px', width: '64px', height: '64px', transform: 'rotate(-90deg)' }}>
                                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="3" />
                                <circle cx="32" cy="32" r="28" fill="none" stroke="#667eea" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(badge.progress_percentage || 0) * 1.76} 176`} />
                              </svg>
                            )}

                            <IonIcon
                              icon={getIconFromString(badge.icon)}
                              style={{
                                fontSize: '1.8rem',
                                color: isEarned ? 'white' : '#999'
                              }}
                            />

                            {/* Earned Checkmark */}
                            {isEarned && (
                              <div style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#22c55e',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid white'
                              }}>
                                <IonIcon icon={checkmark} style={{ fontSize: '0.7rem', color: 'white' }} />
                              </div>
                            )}

                            {/* Lock for not earned */}
                            {!isEarned && !hasProgress && (
                              <div style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: '#8e8e93',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid white'
                              }}>
                                <IonIcon icon={lockClosed} style={{ fontSize: '0.6rem', color: 'white' }} />
                              </div>
                            )}
                          </div>

                          {/* Badge Name */}
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: isEarned ? '#333' : '#999',
                            textAlign: 'center',
                            lineHeight: '1.2',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {badge.name}
                          </span>

                          {/* Progress percentage for in-progress badges */}
                          {hasProgress && (
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: '700',
                              color: '#667eea',
                              marginTop: '2px'
                            }}>
                              {badge.progress_percentage}%
                            </span>
                          )}

                          {/* Secret Badge Eselsohr */}
                          {badge.is_hidden && badge.is_earned && (
                            <div
                              className="app-corner-badge"
                              style={{
                                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                                fontSize: '0.5rem',
                                padding: '3px 8px'
                              }}
                            >
                              GEHEIM
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </IonCardContent>
              </IonCard>
            );
          })
        )}
      </IonList>

      {/* Badge Detail Popover - Kompakt */}
      <IonPopover
        isOpen={!!selectedBadge}
        event={popoverEvent}
        onDidDismiss={() => {
          setSelectedBadge(null);
          setPopoverEvent(null);
        }}
        className="badge-detail-popover"
        style={{ '--width': 'auto', '--min-width': '220px', '--max-width': '85vw', '--background': 'white' } as any}
      >
        {selectedBadge && (
          <div style={{ padding: '12px', background: 'white' }}>
            {/* Kompakte Darstellung */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Badge Icon - kleiner */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: selectedBadge.is_earned
                  ? `linear-gradient(145deg, ${getBadgeColor(selectedBadge)} 0%, ${getBadgeColor(selectedBadge)}cc 100%)`
                  : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
                boxShadow: selectedBadge.is_earned
                  ? `0 2px 8px ${getBadgeColor(selectedBadge)}40`
                  : '0 1px 4px rgba(0,0,0,0.1)'
              }}>
                <IonIcon
                  icon={getIconFromString(selectedBadge.icon)}
                  style={{
                    fontSize: '1.4rem',
                    color: selectedBadge.is_earned ? 'white' : '#999'
                  }}
                />
              </div>

              {/* Text Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '700', color: '#333', whiteSpace: 'nowrap' }}>
                  {selectedBadge.name}
                </h3>
                <p style={{
                  margin: '0',
                  fontSize: '0.8rem',
                  color: '#666',
                  lineHeight: '1.3'
                }}>
                  {selectedBadge.description || 'Keine Beschreibung'}
                </p>
              </div>
            </div>

            {/* Status und Datum */}
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {selectedBadge.is_earned ? (
                <>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#22c55e',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    <IonIcon icon={checkmarkCircle} style={{ fontSize: '0.75rem' }} />
                    Erreicht
                  </div>
                  {selectedBadge.earned_at && (
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>
                      {new Date(selectedBadge.earned_at).toLocaleDateString('de-DE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  )}
                </>
              ) : selectedBadge.progress_percentage && selectedBadge.progress_percentage > 0 ? (
                <>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#667eea',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    {selectedBadge.progress_percentage}% - In Arbeit
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>
                    {selectedBadge.progress_points || 0} / {selectedBadge.criteria_value}
                  </span>
                </>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#8e8e93',
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  fontWeight: '600'
                }}>
                  <IonIcon icon={lockClosed} style={{ fontSize: '0.7rem' }} />
                  Noch nicht erreicht
                </div>
              )}
            </div>
          </div>
        )}
      </IonPopover>
    </div>
  );
};

export default BadgesView;
