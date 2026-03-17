import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonIcon,
  IonCard,
  IonCardContent,
  IonButton,
  IonSegment,
  IonSegmentButton,
  useIonModal,
  useIonAlert,
  useIonPopover
} from '@ionic/react';
import {
  personOutline,
  mailOutline,
  keyOutline,
  briefcaseOutline,
  calendarOutline,
  settingsOutline,
  trophy,
  trophyOutline,
  ribbon,
  star,
  logOutOutline,
  flashOutline,
  informationCircleOutline,
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
  checkmark,
  medal
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import { logout } from '../../../services/auth';
import ChangeEmailModal from '../../konfi/modals/ChangeEmailModal';
import ChangePasswordModal from '../../konfi/modals/ChangePasswordModal';
import ChangeRoleTitleModal from '../../admin/modals/ChangeRoleTitleModal';
import PointsHistoryModal from '../../konfi/modals/PointsHistoryModal';
import LoadingSpinner from '../../common/LoadingSpinner';

interface TeamerProfile {
  user: {
    display_name: string;
    username: string;
    email: string;
    role_title: string;
    teamer_since: string | null;
    organization_name: string;
  };
  konfi_data: {
    gottesdienst_points: number;
    gemeinde_points: number;
    jahrgang_name: string;
    badges: Array<{
      badge_id: number;
      name: string;
      icon: string;
      color: string;
      awarded_date: string;
    }>;
  };
}

interface TeamerBadge {
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
  earned: boolean;
  awarded_date?: string;
  progress_points?: number;
  progress_percentage?: number;
}

// Badge Icon Mapping (aus BadgesView)
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
  restaurant: { icon: restaurant, name: 'Restaurant', category: 'Aktivitaeten' },
  fitness: { icon: fitness, name: 'Fitness', category: 'Aktivitaeten' },
  bicycle: { icon: bicycle, name: 'Fahrrad', category: 'Aktivitaeten' },
  car: { icon: car, name: 'Auto', category: 'Aktivitaeten' },
  airplane: { icon: airplane, name: 'Flugzeug', category: 'Aktivitaeten' },
  boat: { icon: boat, name: 'Boot', category: 'Aktivitaeten' },
  camera: { icon: camera, name: 'Kamera', category: 'Aktivitaeten' },
  image: { icon: image, name: 'Bild', category: 'Aktivitaeten' },
  musicalNote: { icon: musicalNote, name: 'Musik', category: 'Aktivitaeten' },
  balloon: { icon: balloon, name: 'Ballon', category: 'Aktivitaeten' },
  home: { icon: home, name: 'Zuhause', category: 'Orte' },
  business: { icon: business, name: 'Gebaeude', category: 'Orte' },
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

const getIconFromString = (iconName: string): string => {
  return BADGE_ICONS[iconName]?.icon || trophy;
};

// Popover Content Komponente fuer Badge-Details
const BadgePopoverContent: React.FC<{
  badgeRef: React.RefObject<{ badge: TeamerBadge | null; getBadgeColor: (badge: TeamerBadge) => string } | null>;
}> = ({ badgeRef }) => {
  const data = badgeRef.current;
  if (!data || !data.badge) return null;
  const badge = data.badge;
  const badgeColor = data.getBadgeColor(badge);

  return (
    <div style={{ padding: '12px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: badge.earned
            ? `linear-gradient(145deg, ${badgeColor} 0%, ${badgeColor}cc 100%)`
            : 'linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%)',
          boxShadow: badge.earned
            ? `0 2px 8px ${badgeColor}40`
            : '0 1px 4px rgba(0,0,0,0.1)'
        }}>
          <IonIcon
            icon={getIconFromString(badge.icon)}
            style={{
              fontSize: '1.4rem',
              color: badge.earned ? 'white' : '#999'
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '700', color: '#333', whiteSpace: 'nowrap' }}>
            {badge.name}
          </h3>
          <p style={{
            margin: '0',
            fontSize: '0.8rem',
            color: '#666',
            lineHeight: '1.3'
          }}>
            {badge.description || 'Keine Beschreibung'}
          </p>
        </div>
      </div>
      <div style={{
        marginTop: '10px',
        paddingTop: '10px',
        borderTop: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {badge.earned ? (
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
            {badge.awarded_date && (
              <span style={{ fontSize: '0.7rem', color: '#888' }}>
                {new Date(badge.awarded_date).toLocaleDateString('de-DE', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            )}
          </>
        ) : badge.progress_percentage && badge.progress_percentage > 0 ? (
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
              {badge.progress_percentage}% - In Arbeit
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888' }}>
              {badge.progress_points || 0} / {badge.criteria_value}
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
  );
};

const TeamerProfilePage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('profile');
  const { user, setUser, setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();

  const [profile, setProfile] = useState<TeamerProfile | null>(null);
  const [teamerBadges, setTeamerBadges] = useState<TeamerBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<string>('alle');

  const badgePopoverRef = useRef<{ badge: TeamerBadge | null; getBadgeColor: (badge: TeamerBadge) => string }>({ badge: null, getBadgeColor: () => '#e11d48' });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, badgesRes] = await Promise.all([
        api.get('/teamer/profile'),
        api.get('/teamer/badges')
      ]);
      setProfile(profileRes.data);
      setTeamerBadges(badgesRes.data || []);
    } catch (err) {
      setError('Fehler beim Laden des Profils');
      console.error('Error loading teamer profile:', err);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Modals
  const [presentEmailModal, dismissEmailModal] = useIonModal(ChangeEmailModal, {
    onClose: () => dismissEmailModal(),
    onSuccess: async () => {
      dismissEmailModal();
      await loadProfile();
      try {
        const response = await api.get('/auth/me');
        if (user) {
          const updatedUser = { ...user, email: response.data.email };
          localStorage.setItem('konfi_user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      } catch (err) {
        console.error('Error refreshing user:', err);
      }
    }
  });

  const [presentPasswordModal, dismissPasswordModal] = useIonModal(ChangePasswordModal, {
    onClose: () => dismissPasswordModal(),
    onSuccess: () => dismissPasswordModal()
  });

  const [presentRoleTitleModal, dismissRoleTitleModal] = useIonModal(ChangeRoleTitleModal, {
    onClose: () => dismissRoleTitleModal(),
    onSuccess: () => {
      dismissRoleTitleModal();
      loadProfile();
    },
    initialRoleTitle: profile?.user.role_title || ''
  });

  const [presentPointsModal, dismissPointsModal] = useIonModal(PointsHistoryModal, {
    onClose: () => dismissPointsModal(),
    pointConfig: { gottesdienst_enabled: true, gemeinde_enabled: true }
  });

  const [presentBadgePopover] = useIonPopover(BadgePopoverContent, {
    badgeRef: badgePopoverRef
  });

  // Logout
  const handleLogout = () => {
    presentAlert({
      header: 'Abmelden',
      message: 'Willst du dich wirklich abmelden?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Abmelden',
          role: 'destructive',
          handler: async () => {
            try {
              await logout();
              window.location.href = '/';
            } catch (error) {
              console.error('Logout error:', error);
              localStorage.removeItem('konfi_token');
              localStorage.removeItem('konfi_user');
              window.location.href = '/';
            }
          }
        }
      ]
    });
  };

  // Badge helpers
  const getBadgeColor = (badge: TeamerBadge) => {
    if (badge.color) return badge.color;
    return '#e11d48';
  };

  const getTeamerBadgeCategories = () => {
    let filtered = teamerBadges;
    switch (selectedBadgeFilter) {
      case 'nicht_erhalten':
        filtered = teamerBadges.filter(b => !b.earned);
        break;
      case 'in_arbeit':
        filtered = teamerBadges.filter(b => !b.earned && b.progress_percentage && b.progress_percentage > 0);
        break;
      default:
        filtered = teamerBadges;
    }

    const categories: { key: string; title: string; icon: string; color: string; badges: TeamerBadge[] }[] = [
      { key: 'activity_count', title: 'Aktivitaeten', icon: checkmarkCircle, color: '#3880ff', badges: filtered.filter(b => b.criteria_type === 'activity_count').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'event_count', title: 'Event-Champion', icon: calendar, color: '#e63946', badges: filtered.filter(b => b.criteria_type === 'event_count').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'streak', title: 'Serien-Champion', icon: flame, color: '#eb445a', badges: filtered.filter(b => b.criteria_type === 'streak').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'collection', title: 'Sammler', icon: trophy, color: '#ffd700', badges: filtered.filter(b => b.criteria_type === 'collection').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'yearly', title: 'Jahres-Badges', icon: calendarOutline, color: '#8e8e93', badges: filtered.filter(b => b.criteria_type === 'yearly').sort((a, b) => a.criteria_value - b.criteria_value) },
      { key: 'category_activities', title: 'Kategorie-Meister', icon: cubeOutline, color: '#0cd1e8', badges: filtered.filter(b => b.criteria_type === 'category_activities').sort((a, b) => a.criteria_value - b.criteria_value) }
    ];

    // Fallback fuer unbekannte Typen
    const knownTypes = new Set(categories.map(c => c.key));
    const unknownBadges = filtered.filter(b => !knownTypes.has(b.criteria_type));
    if (unknownBadges.length > 0) {
      categories.push({ key: 'weitere', title: 'Weitere', icon: star, color: '#667eea', badges: unknownBadges.sort((a, b) => a.criteria_value - b.criteria_value) });
    }

    return categories.filter(cat => cat.badges.length > 0);
  };

  const handleBadgeClick = (badge: TeamerBadge, e: React.MouseEvent) => {
    badgePopoverRef.current = { badge, getBadgeColor };
    presentBadgePopover({
      event: e.nativeEvent,
      side: 'top',
      alignment: 'center',
      cssClass: 'badge-detail-popover'
    });
  };

  const itemStyle: Record<string, string> = {
    '--background': 'transparent',
    '--padding-start': '0',
    '--padding-end': '0',
    '--inner-padding-end': '0',
    '--inner-border-width': '0',
    '--border-style': 'none',
    '--min-height': 'auto'
  };

  if (loading) {
    return <LoadingSpinner message="Profil wird geladen..." />;
  }

  if (!profile) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <p>Fehler beim Laden des Profils</p>
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={handleLogout}
              style={{ marginTop: '24px', height: '48px', borderRadius: '12px', fontWeight: '600' }}
            >
              <IonIcon icon={logOutOutline} slot="start" />
              Abmelden
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const badgeCategories = getTeamerBadgeCategories();
  const earnedTeamerBadges = teamerBadges.filter(b => b.earned).length;

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Profil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Profil</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadProfile().then(() => e.detail.complete());
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* 1. Detail-Header */}
        <div className="app-detail-header" style={{
          background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
          boxShadow: '0 20px 40px rgba(225, 29, 72, 0.3)'
        }}>
          <div className="app-detail-header__content" style={{ padding: '70px 24px 24px 24px', alignItems: 'center', textAlign: 'center' }}>
            <div className="app-icon-circle" style={{
              width: '80px', height: '80px',
              background: 'rgba(255, 255, 255, 0.2)',
              marginBottom: '16px',
              color: 'white', fontSize: '2rem', fontWeight: '600',
              border: '3px solid rgba(255, 255, 255, 0.3)'
            }}>
              {profile.user.display_name?.charAt(0)?.toUpperCase() || 'T'}
            </div>
            <h1 className="app-detail-header__title">{profile.user.display_name}</h1>
            <p className="app-detail-header__subtitle">
              {profile.user.role_title || 'Teamer:in'}
            </p>
            <div className="app-detail-header__info-row" style={{ justifyContent: 'center' }}>
              {profile.user.email && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={mailOutline} style={{ fontSize: '0.85rem' }} />
                  {profile.user.email}
                </div>
              )}
              {profile.user.teamer_since && (
                <div className="app-detail-header__info-chip">
                  <IonIcon icon={calendarOutline} style={{ fontSize: '0.85rem' }} />
                  Teamer:in seit {new Date(profile.user.teamer_since).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Konto-Einstellungen */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={settingsOutline} />
            </div>
            <IonLabel>Konto-Einstellungen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                {/* Funktionsbeschreibung */}
                <IonItem
                  button
                  onClick={() => presentRoleTitleModal({ presentingElement: presentingElement || undefined })}
                  detail={false}
                  lines="none"
                  style={{ ...itemStyle, marginBottom: '8px' } as any}
                >
                  <div className="app-list-item app-list-item--users" style={{ width: '100%' }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={briefcaseOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Funktionsbeschreibung</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {profile.user.role_title ? `Aktuell: ${profile.user.role_title}` : 'z.B. Jugendleiter:in'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* E-Mail aendern */}
                <IonItem
                  button
                  onClick={() => presentEmailModal({ presentingElement: presentingElement || undefined })}
                  detail={false}
                  lines="none"
                  style={{ ...itemStyle, marginBottom: '8px' } as any}
                >
                  <div className="app-list-item app-list-item--users" style={{ width: '100%' }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={mailOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">E-Mail-Adresse ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              {profile.user.email ? `Aktuell: ${profile.user.email}` : 'E-Mail fuer Benachrichtigungen'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>

                {/* Passwort aendern */}
                <IonItem
                  button
                  onClick={() => presentPasswordModal({ presentingElement: presentingElement || undefined })}
                  detail={false}
                  lines="none"
                  style={itemStyle as any}
                >
                  <div className="app-list-item app-list-item--users" style={{ width: '100%' }}>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-icon-circle app-icon-circle--users">
                          <IonIcon icon={keyOutline} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">Passwort ändern</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">Sicherheitseinstellungen</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* 3. Teamer-Badges */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon" style={{ backgroundColor: '#5b21b6' }}>
              <IonIcon icon={ribbon} />
            </div>
            <IonLabel>Teamer-Badges ({earnedTeamerBadges})</IonLabel>
          </IonListHeader>

          {/* Filter */}
          <div style={{ margin: '8px 0 12px 0' }}>
            <IonSegment value={selectedBadgeFilter} onIonChange={(e) => setSelectedBadgeFilter(e.detail.value as string)}>
              <IonSegmentButton value="alle"><IonLabel>Alle</IonLabel></IonSegmentButton>
              <IonSegmentButton value="nicht_erhalten"><IonLabel>Offen</IonLabel></IonSegmentButton>
              <IonSegmentButton value="in_arbeit"><IonLabel>In Arbeit</IonLabel></IonSegmentButton>
            </IonSegment>
          </div>

          {badgeCategories.length === 0 ? (
            <IonCard className="app-card">
              <IonCardContent>
                <div className="app-empty-state">
                  <IonIcon icon={trophyOutline} style={{ fontSize: '3rem', color: '#8e8e93', marginBottom: '8px' }} />
                  <p className="app-empty-state__text">
                    {selectedBadgeFilter === 'nicht_erhalten' ? 'Alle Badges erreicht!' :
                     selectedBadgeFilter === 'in_arbeit' ? 'Keine Badges in Arbeit' :
                     'Noch keine Teamer-Badges'}
                  </p>
                </div>
              </IonCardContent>
            </IonCard>
          ) : (
            badgeCategories.map((category, index) => {
              const earnedCount = category.badges.filter(b => b.earned).length;
              const totalCount = category.badges.length;
              const progressPercent = Math.round((earnedCount / totalCount) * 100);

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
                          fontSize: '0.7rem', fontWeight: '700', color: category.color
                        }}>
                          {progressPercent}%
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
                        const isEarned = badge.earned;
                        const hasProgress = !isEarned && badge.progress_percentage && badge.progress_percentage > 0;

                        return (
                          <div
                            key={badge.id}
                            onClick={(e) => handleBadgeClick(badge, e)}
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

                            {/* Progress percentage */}
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

                            {/* Secret Badge */}
                            {badge.is_hidden && badge.earned && (
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

        {/* 4. Konfi-Badges - nur wenn vorhanden */}
        {profile.konfi_data.badges.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon" style={{ backgroundColor: '#f59e0b' }}>
                <IonIcon icon={trophy} />
              </div>
              <IonLabel>Konfi-Badges ({profile.konfi_data.badges.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <IonList lines="none" style={{ background: 'transparent', padding: '0', margin: '0' }}>
                  {profile.konfi_data.badges.map((badge) => (
                    <IonItem key={badge.badge_id} lines="none" style={itemStyle as any}>
                      <div className="app-list-item" style={{ width: '100%', marginBottom: '8px' }}>
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div
                              className="app-icon-circle"
                              style={{ backgroundColor: badge.color || '#f59e0b' }}
                            >
                              <IonIcon icon={getIconFromString(badge.icon)} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title">{badge.name}</div>
                              <div className="app-list-item__meta">
                                <span className="app-list-item__meta-item">
                                  {new Date(badge.awarded_date).toLocaleDateString('de-DE', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* 5. Konfi-Stats - nur wenn Daten vorhanden */}
        {profile.konfi_data.jahrgang_name && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--activities">
                <IonIcon icon={flashOutline} />
              </div>
              <IonLabel>Konfi-Punkte</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>Jahrgang</span>
                  <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{profile.konfi_data.jahrgang_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>Gottesdienst-Punkte</span>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{profile.konfi_data.gottesdienst_points || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>Gemeinde-Punkte</span>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{profile.konfi_data.gemeinde_points || 0}</span>
                </div>
                <IonButton
                  fill="clear"
                  expand="block"
                  onClick={() => presentPointsModal({ presentingElement: presentingElement || undefined })}
                  style={{ '--color': '#e11d48', fontWeight: '600' }}
                >
                  Details anzeigen
                </IonButton>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* 6. Logout-Button */}
        <div style={{ padding: '0 16px', marginTop: '16px' }}>
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={handleLogout}
            style={{
              height: '48px',
              borderRadius: '12px',
              fontWeight: '600'
            }}
          >
            <IonIcon icon={logOutOutline} slot="start" />
            Abmelden
          </IonButton>
        </div>

        <div style={{ height: '32px' }}></div>
      </IonContent>
    </IonPage>
  );
};

export default TeamerProfilePage;
