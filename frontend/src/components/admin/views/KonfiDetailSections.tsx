import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonLabel,
  IonList,
  IonListHeader,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonIcon,
  IonButton,
  IonProgressBar
} from '@ionic/react';
import {
  trophy,
  flash,
  calendar,
  school,
  add,
  time,
  gift,
  trash,
  image,
  podium,
  personOutline,
  closeCircle,
  eyeOff,
  ribbon,
  documentOutline,
  calendarOutline,
  timeOutline,
  starOutline,
  flashOutline,
  giftOutline
} from 'ionicons/icons';
import ActivityRings from './ActivityRings';

// ---- Shared Types ----

export interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string;
  gottesdienst_points?: number;
  gemeinde_points?: number;
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
  target_gottesdienst?: number;
  target_gemeinde?: number;
  points?: {
    gottesdienst: number;
    gemeinde: number;
  };
  bonus?: number;
  bonusPoints?: number;
  totalBonus?: number;
  badgeCount?: number;
  activities_count?: number;
  role_name?: string;
  user_type?: string;
  teamer_since?: string;
}

export interface Activity {
  id: number | string;
  name: string;
  points: number;
  type: string;
  date: string;
  admin?: string;
  isPending?: boolean;
  photo_filename?: string;
  requestId?: number;
  hasPhoto?: boolean;
}

// ---- KonfiHeaderCard ----

interface KonfiHeaderCardProps {
  currentKonfi: Konfi | null;
  isTeamer: boolean;
  getTotalPoints: () => number;
  getGottesdienstPoints: () => number;
  getGemeindePoints: () => number;
  certificates: Array<{ id: number }>;
  teamerEvents: Array<{ id: number }>;
  activities: Activity[];
}

export const KonfiHeaderCard = React.memo<KonfiHeaderCardProps>(({
  currentKonfi,
  isTeamer,
  getTotalPoints,
  getGottesdienstPoints,
  getGemeindePoints,
  certificates,
  teamerEvents,
  activities
}) => (
  <div
    style={{
      background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
      borderRadius: '24px',
      padding: '24px',
      margin: '16px',
      boxShadow: '0 20px 40px rgba(91, 33, 182, 0.3)',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    {/* Ueberschrift - gross und ueberlappend */}
    <div
      style={{
        position: 'absolute',
        top: '-5px',
        left: '12px',
        zIndex: 1
      }}
    >
      <h2
        style={{
          fontSize: '3rem',
          fontWeight: '900',
          color: 'rgba(255, 255, 255, 0.08)',
          margin: '0',
          lineHeight: '0.8',
          letterSpacing: '-2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '280px'
        }}
      >
        {(currentKonfi?.name || 'KONFI').toUpperCase()}
      </h2>
    </div>

    {/* Voller Name */}
    <div
      style={{
        textAlign: 'center',
        marginTop: '32px',
        marginBottom: '4px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <IonIcon
          icon={personOutline}
          style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.8)' }}
        />
        <h1
          style={{
            margin: '0',
            fontSize: '1.4rem',
            fontWeight: '700',
            color: 'white'
          }}
        >
          {currentKonfi?.name || 'Konfi'}
        </h1>
      </div>
    </div>

    {/* Username und Jahrgang */}
    <div
      style={{
        textAlign: 'center',
        marginBottom: isTeamer ? '4px' : '16px',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '0.85rem'
      }}
    >
      {currentKonfi?.jahrgang_name || currentKonfi?.jahrgang} - @{currentKonfi?.username}
    </div>

    {/* Teamer: Aktiv seit */}
    {isTeamer && currentKonfi?.teamer_since && (
      <div
        style={{
          textAlign: 'center',
          marginBottom: '16px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.8rem'
        }}
      >
        Teamer:in seit {new Date(currentKonfi.teamer_since).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
      </div>
    )}

    {/* Activity Rings - nur fuer Konfis */}
    {!isTeamer && (
      <ActivityRings
        totalPoints={getTotalPoints()}
        gottesdienstPoints={getGottesdienstPoints()}
        gemeindePoints={getGemeindePoints()}
        gottesdienstGoal={currentKonfi?.target_gottesdienst || 10}
        gemeindeGoal={currentKonfi?.target_gemeinde || 10}
        gottesdienstEnabled={currentKonfi?.gottesdienst_enabled}
        gemeindeEnabled={currentKonfi?.gemeinde_enabled}
        size={160}
      />
    )}

    {/* Teamer Stats Chips */}
    {isTeamer && (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { value: currentKonfi?.badgeCount || 0, label: 'Badges' },
          { value: certificates.length, label: 'Zertifikate' },
          { value: teamerEvents.length, label: 'Events' },
          { value: activities.filter(a => !a.isPending).length, label: 'Aktivitäten' }
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              padding: '8px 12px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white' }}>{stat.value}</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600', letterSpacing: '0.3px' }}>{stat.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
    )}

    {/* Badge Count - nur fuer Konfis (Teamer haben Stats Chips) */}
    {!isTeamer && (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '16px'
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <IonIcon icon={trophy} className="app-icon-color--badges" style={{ fontSize: '1.2rem' }} />
          <span style={{ color: 'white', fontWeight: '600' }}>{currentKonfi?.badgeCount || 0} Badges</span>
        </div>
      </div>
    )}
  </div>
));

// ---- BonusSection ----

interface BonusSectionProps {
  bonusEntries: any[];
  currentKonfi: Konfi | null;
  getBonusPoints: () => number;
  formatDate: (dateString: string) => string;
  handleDeleteBonus: (bonus: any) => void;
  presentBonusModal: (opts?: any) => void;
  presentingElement: HTMLElement | null;
}

export const BonusSection = React.memo<BonusSectionProps>(({
  bonusEntries,
  currentKonfi,
  getBonusPoints,
  formatDate,
  handleDeleteBonus,
  presentBonusModal,
  presentingElement
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--bonus">
        <IonIcon icon={gift} />
      </div>
      <IonLabel>Bonus ({getBonusPoints()})</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {bonusEntries.length === 0 ? (
          <div className="app-empty-state">
            <p className="app-empty-state__text">Noch keine Bonuspunkte erhalten</p>
          </div>
        ) : (
          <IonList className="app-list-inner" lines="none">
            {bonusEntries.map((bonus: any, index: number) => {
              const isTypeDisabled = (bonus.type === 'gottesdienst' && currentKonfi?.gottesdienst_enabled === false)
                || (bonus.type === 'gemeinde' && currentKonfi?.gemeinde_enabled === false);
              return (
              <IonItemSliding key={bonus.id || index} style={{ marginBottom: index < bonusEntries.length - 1 ? '8px' : '0' }}>
                <IonItem
                  className="app-item-transparent"
                  detail={false}
                  lines="none"
                >
                  <div
                    className="app-list-item app-list-item--bonus"
                    style={{
                      borderLeftColor: bonus.type === 'gottesdienst' ? '#3b82f6' : '#059669',
                      ...(isTypeDisabled ? { opacity: 0.4, filter: 'grayscale(100%)' } : {})
                    }}
                  >
                    {/* Corner Badge fuer Punkte */}
                    <div className="app-corner-badges">
                      <div
                        className="app-corner-badge"
                        style={{
                          backgroundColor: bonus.type === 'gottesdienst' ? '#3b82f6' : '#059669'
                        }}
                      >
                        +{bonus.points}P
                      </div>
                    </div>
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div
                          className="app-icon-circle"
                          style={{
                            backgroundColor: bonus.type === 'gottesdienst' ? '#3b82f6' : '#059669'
                          }}
                        >
                          <IonIcon icon={gift} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title app-list-item__title--badge-space">
                            {bonus.description || 'Bonuspunkte'}
                            {isTypeDisabled && (
                              <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: '400', marginLeft: '6px' }}>(deaktiviert)</span>
                            )}
                          </div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={calendar} className="app-icon-color--events" />
                              {formatDate(bonus.completed_date || bonus.date)}
                            </span>
                            <span className="app-list-item__meta-item">{bonus.admin || 'Admin'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>
                <IonItemOptions className="app-swipe-actions" side="end">
                  <IonItemOption
                    className="app-swipe-action"
                    onClick={() => handleDeleteBonus(bonus)}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                      <IonIcon icon={trash} />
                    </div>
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            );
            })}
          </IonList>
        )}
        <IonButton
          expand="block"
          fill="outline"
          onClick={() =>
            presentBonusModal({
              presentingElement: presentingElement || undefined
            })
          }
        >
          <IonIcon icon={add} slot="start" />
          Bonuspunkte hinzufügen
        </IonButton>
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- EventPointsSection ----

interface EventPointsSectionProps {
  eventPoints: any[];
  currentKonfi: Konfi | null;
}

export const EventPointsSection = React.memo<EventPointsSectionProps>(({
  eventPoints,
  currentKonfi
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={podium} />
      </div>
      <IonLabel>Events ({eventPoints.reduce((sum: number, ep: any) => sum + (ep.points || 0), 0)})</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {eventPoints.length === 0 ? (
          <div className="app-empty-state">
            <p className="app-empty-state__text">Noch keine Event-Punkte erhalten</p>
          </div>
        ) : (
          <IonList className="app-list-inner" lines="none">
            {eventPoints.map((eventPoint: any, index: number) => {
              const isEventTypeDisabled = (eventPoint.point_type === 'gottesdienst' && currentKonfi?.gottesdienst_enabled === false)
                || (eventPoint.point_type === 'gemeinde' && currentKonfi?.gemeinde_enabled === false);
              return (
              <div
                key={eventPoint.id || index}
                className="app-list-item app-list-item--events"
                style={{
                  marginBottom: index < eventPoints.length - 1 ? '8px' : '0',
                  borderLeftColor: eventPoint.point_type === 'gottesdienst' ? '#3b82f6' : '#059669',
                  ...(isEventTypeDisabled ? { opacity: 0.4, filter: 'grayscale(100%)' } : {})
                }}
              >
                {/* Corner Badge fuer Punkte */}
                <div className="app-corner-badges">
                  <div
                    className="app-corner-badge"
                    style={{
                      backgroundColor: eventPoint.point_type === 'gottesdienst' ? '#3b82f6' : '#059669'
                    }}
                  >
                    +{eventPoint.points}P
                  </div>
                </div>
                <div className="app-list-item__row">
                  <div className="app-list-item__main">
                    <div
                      className="app-icon-circle"
                      style={{
                        backgroundColor: eventPoint.point_type === 'gottesdienst' ? '#3b82f6' : '#059669'
                      }}
                    >
                      <IonIcon icon={podium} />
                    </div>
                    <div className="app-list-item__content">
                      <div className="app-list-item__title app-list-item__title--badge-space">
                        {eventPoint.event_name || 'Event'}
                        {isEventTypeDisabled && (
                          <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: '400', marginLeft: '6px' }}>(deaktiviert)</span>
                        )}
                      </div>
                      <div className="app-list-item__meta">
                        <span className="app-list-item__meta-item">
                          <IonIcon icon={calendar} className="app-icon-color--events" />
                          {eventPoint.awarded_date &&
                            new Date(eventPoint.awarded_date).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit'
                            })}
                        </span>
                        <span className="app-list-item__meta-item">{eventPoint.admin_name || 'Admin'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </IonList>
        )}
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- AttendanceSection ----

interface AttendanceSectionProps {
  attendanceStats: {
    total_mandatory: number;
    attended: number;
    percentage: number;
    missed_events: Array<{
      event_id: number;
      event_name: string;
      event_date: string;
      location: string;
      status: 'opted_out' | 'absent';
      opt_out_reason: string | null;
    }>;
  };
}

export const AttendanceSection = React.memo<AttendanceSectionProps>(({
  attendanceStats
}) => (
  <IonList className="app-section-inset" inset={true}>
    <IonListHeader>
      <div className="app-section-icon" style={{ backgroundColor: '#6366f1' }}>
        <IonIcon icon={calendar} />
      </div>
      <IonLabel>Anwesenheit</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {/* Quote Summary */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
              {attendanceStats.attended}/{attendanceStats.total_mandatory} anwesend
            </span>
            <span style={{
              fontWeight: '700',
              fontSize: '1.1rem',
              color: attendanceStats.percentage >= 80 ? '#059669' :
                     attendanceStats.percentage >= 50 ? '#f59e0b' : '#ef4444'
            }}>
              {attendanceStats.percentage}%
            </span>
          </div>
          <IonProgressBar
            value={attendanceStats.percentage / 100}
            color={attendanceStats.percentage >= 80 ? 'success' :
                   attendanceStats.percentage >= 50 ? 'warning' : 'danger'}
            style={{ borderRadius: '4px', height: '8px' }}
          />
        </div>

        {/* Verpasste Events Liste */}
        {attendanceStats.missed_events.length > 0 && (
          <>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px'
            }}>
              Verpasste Pflicht-Events
            </div>
            <IonList className="app-list-inner" lines="none">
              {attendanceStats.missed_events.map((event, index) => (
                <div
                  key={event.event_id}
                  className="app-list-item"
                  style={{
                    marginBottom: index < attendanceStats.missed_events.length - 1 ? '8px' : '0',
                    borderLeftColor: event.status === 'opted_out' ? '#f59e0b' : '#ef4444'
                  }}
                >
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div
                        className="app-icon-circle"
                        style={{
                          backgroundColor: event.status === 'opted_out' ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        <IonIcon icon={event.status === 'opted_out' ? eyeOff : closeCircle} />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title">
                          {event.event_name}
                        </div>
                        <div className="app-list-item__meta">
                          <span className="app-list-item__meta-item">
                            <IonIcon icon={calendar} className="app-icon-color--events" />
                            {new Date(event.event_date).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="app-list-item__meta-item" style={{
                            color: event.status === 'opted_out' ? '#f59e0b' : '#ef4444'
                          }}>
                            {event.status === 'opted_out'
                              ? `Opt-out: ${event.opt_out_reason || 'Ohne Begründung'}`
                              : 'Nicht erschienen'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </IonList>
          </>
        )}
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- TeamerEventsSection ----

interface TeamerEventsSectionProps {
  teamerEvents: Array<{
    id: number;
    name: string;
    event_date: string;
    location: string;
    teamer_only: boolean;
    teamer_needed: boolean;
    booking_status: string;
    booking_date: string;
  }>;
  formatDate: (dateString: string) => string;
}

export const TeamerEventsSection = React.memo<TeamerEventsSectionProps>(({
  teamerEvents,
  formatDate
}) => (
  <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={calendar} />
      </div>
      <IonLabel>Events ({teamerEvents.length})</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        <IonList className="app-list-inner" lines="none">
          {teamerEvents.slice(0, 10).map((event, index) => {
            const isPast = new Date(event.event_date) < new Date();
            return (
              <IonItem
                key={event.id}
                className="app-item-transparent"
                detail={false}
                lines="none"
                style={{ marginBottom: index < Math.min(teamerEvents.length, 10) - 1 ? '8px' : '0' }}
              >
                <div
                  className="app-list-item"
                  style={{
                    borderLeftColor: isPast ? '#9ca3af' : '#dc2626',
                    opacity: isPast ? 0.7 : 1
                  }}
                >
                  {event.teamer_only && (
                    <div className="app-corner-badges">
                      <div className="app-corner-badge" style={{ backgroundColor: '#5b21b6' }}>
                        TEAM
                      </div>
                    </div>
                  )}
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div
                        className="app-icon-circle"
                        style={{ backgroundColor: isPast ? '#9ca3af' : '#dc2626' }}
                      >
                        <IonIcon icon={calendar} />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title app-list-item__title--badge-space">
                          {event.name}
                        </div>
                        <div className="app-list-item__meta">
                          <span className="app-list-item__meta-item">
                            <IonIcon icon={calendarOutline} className="app-icon-color--events" />
                            {formatDate(event.event_date)}
                          </span>
                          {event.location && (
                            <span className="app-list-item__meta-item">{event.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </IonItem>
            );
          })}
        </IonList>
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- ActivitiesSection ----

interface ActivitiesSectionProps {
  activities: Activity[];
  currentKonfi: Konfi | null;
  isTeamer: boolean;
  formatDate: (dateString: string) => string;
  handleDeleteActivity: (activity: Activity) => void;
  handlePhotoClick: (activity: Activity) => void;
  presentActivityModal: (opts?: any) => void;
  presentingElement: HTMLElement | null;
}

export const ActivitiesSection = React.memo<ActivitiesSectionProps>(({
  activities,
  currentKonfi,
  isTeamer,
  formatDate,
  handleDeleteActivity,
  handlePhotoClick,
  presentActivityModal,
  presentingElement
}) => (
  <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--activities">
        <IonIcon icon={flash} />
      </div>
      <IonLabel>Aktivitäten {!isTeamer && `(${activities.filter((a) => !a.isPending).reduce((sum, a) => sum + (a.points || 0), 0)})`} {isTeamer && `(${activities.filter((a) => !a.isPending).length})`}</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {activities.length === 0 ? (
          <div className="app-empty-state">
            <p className="app-empty-state__text">Noch keine Aktivitäten vorhanden</p>
          </div>
        ) : (
          <IonList className="app-list-inner" lines="none">
            {activities.slice(0, 10).map((activity, index) => {
              const isActivityTypeDisabled = !activity.isPending
                && ((activity.type === 'gottesdienst' && currentKonfi?.gottesdienst_enabled === false)
                || (activity.type === 'gemeinde' && currentKonfi?.gemeinde_enabled === false));
              return (
              <IonItemSliding key={activity.id} style={{ marginBottom: index < Math.min(activities.length, 10) - 1 ? '8px' : '0' }}>
                <IonItem
                  className="app-item-transparent"
                  button={activity.hasPhoto}
                  onClick={() => handlePhotoClick(activity)}
                  detail={false}
                  lines="none"
                >
                  <div
                    className={`app-list-item ${activity.isPending ? 'app-list-item--warning' : ''}`}
                    style={{
                      borderLeftColor: activity.isPending
                        ? '#f59e0b'
                        : activity.type === 'gottesdienst'
                        ? '#3b82f6'
                        : '#059669',
                      opacity: activity.isPending ? 0.8 : isActivityTypeDisabled ? 0.4 : 1,
                      ...(isActivityTypeDisabled ? { filter: 'grayscale(100%)' } : {})
                    }}
                  >
                    {/* Corner Badge fuer Punkte - bei Teamer ausblenden */}
                    {!isTeamer && (
                      <div className="app-corner-badges">
                        <div
                          className="app-corner-badge"
                          style={{
                            backgroundColor: activity.isPending
                              ? '#f59e0b'
                              : activity.type === 'gottesdienst'
                              ? '#3b82f6'
                              : '#059669'
                          }}
                        >
                          {activity.isPending ? '?' : '+'}{activity.points}P
                        </div>
                      </div>
                    )}
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div
                          className="app-icon-circle"
                          style={{
                            backgroundColor: activity.isPending
                              ? '#f59e0b'
                              : activity.type === 'gottesdienst'
                              ? '#3b82f6'
                              : '#059669'
                          }}
                        >
                          <IonIcon icon={activity.isPending ? time : activity.type === 'gottesdienst' ? school : flash} />
                        </div>
                        <div className="app-list-item__content">
                          <div
                            className="app-list-item__title app-list-item__title--badge-space"
                            style={{
                              color: activity.isPending ? '#f59e0b' : undefined,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {activity.name}
                            {isActivityTypeDisabled && (
                              <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: '400' }}>(deaktiviert)</span>
                            )}
                            {activity.hasPhoto && (
                              <IonIcon icon={image} className="app-icon-color--category" style={{ fontSize: '0.8rem', opacity: 0.7 }} />
                            )}
                          </div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={calendar} className="app-icon-color--events" />
                              {formatDate(activity.date)}
                            </span>
                            <span className="app-list-item__meta-item">{activity.admin}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>
                {!activity.isPending && (
                  <IonItemOptions className="app-swipe-actions" side="end">
                    <IonItemOption
                      className="app-swipe-action"
                      onClick={() => handleDeleteActivity(activity)}
                    >
                      <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                        <IonIcon icon={trash} />
                      </div>
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
            );
            })}
          </IonList>
        )}
        <IonButton
          expand="block"
          fill="outline"
          onClick={() =>
            presentActivityModal({
              presentingElement: presentingElement || undefined
            })
          }
        >
          <IonIcon icon={add} slot="start" />
          Aktivität hinzufügen
        </IonButton>
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- CertificatesSection ----

interface CertificatesSectionProps {
  certificates: Array<{
    id: number;
    certificate_type_id: number;
    name: string;
    icon: string;
    issued_date: string;
    expiry_date: string | null;
    status: string;
  }>;
  isOnline: boolean;
  formatDate: (dateString: string) => string;
  handleAssignCertificate: () => void;
  handleDeleteCertificate: (cert: { id: number; name: string }) => void;
}

export const CertificatesSection = React.memo<CertificatesSectionProps>(({
  certificates,
  isOnline,
  formatDate,
  handleAssignCertificate,
  handleDeleteCertificate
}) => (
  <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
    <IonListHeader>
      <div className="app-section-icon" style={{ backgroundColor: '#5b21b6' }}>
        <IonIcon icon={documentOutline} />
      </div>
      <IonLabel>Zertifikate</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {certificates.length === 0 ? (
          <div className="app-empty-state">
            <p className="app-empty-state__text">Noch keine Zertifikate zugewiesen</p>
          </div>
        ) : (
          <IonList className="app-list-inner" lines="none">
            {certificates.map((cert, index) => (
              <IonItemSliding key={cert.id} style={{ marginBottom: index < certificates.length - 1 ? '8px' : '0' }}>
                <IonItem
                  className="app-item-transparent"
                  detail={false}
                  lines="none"
                >
                  <div
                    className="app-list-item"
                    style={{
                      borderLeftColor: cert.status === 'valid' ? '#059669' : cert.status === 'expired' ? '#ef4444' : '#9ca3af'
                    }}
                  >
                    {cert.status === 'expired' && (
                      <div className="app-corner-badges">
                        <div className="app-corner-badge" style={{ backgroundColor: '#ef4444' }}>
                          Abgelaufen
                        </div>
                      </div>
                    )}
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div
                          className="app-icon-circle"
                          style={{
                            backgroundColor: cert.status === 'valid' ? '#059669' : cert.status === 'expired' ? '#ef4444' : '#9ca3af'
                          }}
                        >
                          <IonIcon icon={ribbon} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title app-list-item__title--badge-space">
                            {cert.name}
                          </div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={calendar} className="app-icon-color--events" />
                              {formatDate(cert.issued_date)}
                            </span>
                            {cert.expiry_date && (
                              <span className="app-list-item__meta-item">
                                Ablauf: {formatDate(cert.expiry_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </IonItem>
                <IonItemOptions className="app-swipe-actions" side="end">
                  <IonItemOption
                    className="app-swipe-action"
                    onClick={() => handleDeleteCertificate(cert)}
                  >
                    <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                      <IonIcon icon={trash} />
                    </div>
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}
        <IonButton
          expand="block"
          fill="outline"
          disabled={!isOnline}
          onClick={handleAssignCertificate}
        >
          <IonIcon icon={add} slot="start" />
          {!isOnline ? 'Du bist offline' : 'Zertifikat zuweisen'}
        </IonButton>
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- TeamerSinceSection ----

interface TeamerSinceSectionProps {
  currentKonfi: Konfi | null;
  konfiId: number;
  api: any;
  setCurrentKonfi: (fn: (prev: Konfi | null) => Konfi | null) => void;
  setSuccess: (msg: string) => void;
  setError: (msg: string) => void;
}

export const TeamerSinceSection = React.memo<TeamerSinceSectionProps>(({
  currentKonfi,
  konfiId,
  api: apiInstance,
  setCurrentKonfi,
  setSuccess,
  setError
}) => (
  <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
    <IonListHeader>
      <div className="app-section-icon" style={{ backgroundColor: '#5b21b6' }}>
        <IonIcon icon={calendarOutline} />
      </div>
      <IonLabel>Teamer:in seit</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
          <IonLabel position="stacked" style={{ fontSize: '0.85rem', color: 'var(--ion-color-medium)' }}>Aktiv seit</IonLabel>
          <input
            type="date"
            value={currentKonfi?.teamer_since ? new Date(currentKonfi.teamer_since).toISOString().split('T')[0] : ''}
            onChange={async (e) => {
              const newDate = e.target.value;
              if (!newDate) return;
              try {
                await apiInstance.put(`/admin/konfis/${konfiId}/teamer-since`, { teamer_since: newDate });
                setCurrentKonfi(prev => prev ? { ...prev, teamer_since: newDate } : prev);
                setSuccess('Aktiv-seit-Datum aktualisiert');
              } catch {
                setError('Fehler beim Aktualisieren');
              }
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--ion-color-light-shade)',
              borderRadius: '8px',
              fontSize: '1rem',
              background: 'var(--ion-background-color)',
              color: 'var(--ion-text-color)',
              marginTop: '4px'
            }}
          />
        </IonItem>
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- KonfiHistorySection ----

interface KonfiHistorySectionProps {
  konfiHistory: {
    history: Array<{ id: number; title: string; points: number; category: string; date: string; source_type: string }>;
    totals: { gottesdienst: number; gemeinde: number; total: number };
  };
  formatDate: (dateString: string) => string;
}

export const KonfiHistorySection = React.memo<KonfiHistorySectionProps>(({
  konfiHistory,
  formatDate
}) => (
  <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--purple">
        <IonIcon icon={timeOutline} />
      </div>
      <IonLabel>Konfi-Historie ({konfiHistory.totals.total} Punkte)</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        {/* Punkte-Uebersicht */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {konfiHistory.totals.gottesdienst > 0 && (
            <div style={{
              flex: 1,
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '10px',
              padding: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#3b82f6' }}>{konfiHistory.totals.gottesdienst}</div>
              <div style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: '600' }}>GOTTESDIENST</div>
            </div>
          )}
          {konfiHistory.totals.gemeinde > 0 && (
            <div style={{
              flex: 1,
              background: 'rgba(5, 150, 105, 0.1)',
              borderRadius: '10px',
              padding: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#059669' }}>{konfiHistory.totals.gemeinde}</div>
              <div style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: '600' }}>GEMEINDE</div>
            </div>
          )}
          <div style={{
            flex: 1,
            background: 'rgba(91, 33, 182, 0.1)',
            borderRadius: '10px',
            padding: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#5b21b6' }}>{konfiHistory.totals.total}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: '600' }}>GESAMT</div>
          </div>
        </div>

        {/* Verlauf */}
        {konfiHistory.history.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {konfiHistory.history.slice(0, 8).map((entry) => {
              const categoryColor = entry.category === 'gottesdienst' ? '#3b82f6' : '#059669';
              const entryIcon = entry.source_type === 'bonus' ? giftOutline
                : entry.source_type === 'event' ? calendarOutline
                : entry.category === 'gottesdienst' ? starOutline : flashOutline;
              return (
                <div
                  key={`${entry.source_type}-${entry.id}`}
                  className="app-list-item"
                  style={{ borderLeftColor: categoryColor, position: 'relative', overflow: 'hidden' }}
                >
                  <div className="app-corner-badges">
                    <div className="app-corner-badge" style={{ backgroundColor: categoryColor }}>
                      +{entry.points}P
                    </div>
                  </div>
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div className="app-icon-circle" style={{ backgroundColor: categoryColor }}>
                        <IonIcon icon={entryIcon} />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title app-list-item__title--badge-space">{entry.title}</div>
                        <div className="app-list-item__meta">
                          <span className="app-list-item__meta-item">{formatDate(entry.date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {konfiHistory.history.length > 8 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--ion-color-medium)', textAlign: 'center', margin: '8px 0 0' }}>
                + {konfiHistory.history.length - 8} weitere Einträge
              </p>
            )}
          </div>
        ) : (
          <div className="app-empty-state">
            <p className="app-empty-state__text">Keine Konfi-Punkte vorhanden</p>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- PromoteSection ----

interface PromoteSectionProps {
  isOnline: boolean;
  handlePromoteToTeamer: () => void;
}

export const PromoteSection = React.memo<PromoteSectionProps>(({
  isOnline,
  handlePromoteToTeamer
}) => (
  <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
    <IonListHeader>
      <div className="app-section-icon app-section-icon--purple">
        <IonIcon icon={ribbon} />
      </div>
      <IonLabel>Rolle ändern</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent className="app-card-content">
        <p style={{ fontSize: '0.8rem', color: 'var(--ion-color-medium)', textAlign: 'center', marginBottom: '12px' }}>
          Beim Befördern bleiben Konfi-Punkte und Badges als Historie erhalten. Event-Buchungen und offene Anträge werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <IonButton
          expand="block"
          style={{ '--background': '#5b21b6', '--background-hover': '#4c1d95' }}
          disabled={!isOnline}
          onClick={handlePromoteToTeamer}
        >
          <IonIcon icon={ribbon} slot="start" />
          {!isOnline ? 'Du bist offline' : 'Zum Teamer befördern'}
        </IonButton>
      </IonCardContent>
    </IonCard>
  </IonList>
));
