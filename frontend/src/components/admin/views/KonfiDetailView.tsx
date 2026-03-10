import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent,
  IonLabel,
  IonList,
  IonListHeader,
  IonItem,
  IonRefresher,
  IonRefresherContent,
  useIonModal,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonAlert,
  IonProgressBar
} from '@ionic/react';
import {
  arrowBack,
  trophy,
  flash,
  calendar,
  school,
  add,
  time,
  key,
  gift,
  trash,
  image,
  close,
  podium,
  personOutline,
  closeCircle,
  eyeOff,
  ribbon
} from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import ActivityModal from '../modals/ActivityModal';
import BonusModal from '../modals/BonusModal';
import ActivityRings from './ActivityRings';

interface Konfi {
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
}

interface Activity {
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

interface KonfiDetailViewProps {
  konfiId: number;
  onBack: () => void;
}

const KonfiDetailView: React.FC<KonfiDetailViewProps> = ({ konfiId, onBack }) => {
  const { setSuccess, setError } = useApp();
  const [presentAlert] = useIonAlert();
  const pageRef = React.useRef<HTMLElement>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [bonusEntries, setBonusEntries] = useState<any[]>([]);
  const [eventPoints, setEventPoints] = useState<any[]>([]);
  const [currentKonfi, setCurrentKonfi] = useState<Konfi | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<{
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
  } | null>(null);

  // Activity Modal mit useIonModal Hook
  const [presentActivityModalHook, dismissActivityModalHook] = useIonModal(ActivityModal, {
    konfiId: konfiId,
    onClose: () => dismissActivityModalHook(),
    onSave: async () => {
      await loadKonfiData();
      setSuccess('Aktivität hinzugefügt');
      window.dispatchEvent(new CustomEvent('konfis-updated'));
      dismissActivityModalHook();
    }
  });

  // Bonus Modal mit useIonModal Hook
  const [presentBonusModalHook, dismissBonusModalHook] = useIonModal(BonusModal, {
    konfiId: konfiId,
    onClose: () => dismissBonusModalHook(),
    onSave: async () => {
      await loadKonfiData();
      setSuccess('Bonuspunkte hinzugefügt');
      window.dispatchEvent(new CustomEvent('konfis-updated'));
      dismissBonusModalHook();
    }
  });

  // Photo Modal Component
  const PhotoModal: React.FC<{ onClose: () => void; photoUrl: string }> = ({ onClose, photoUrl }) => (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Foto</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <img
            src={photoUrl}
            alt="Aktivitätsfoto"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
        </div>
      </IonContent>
    </IonPage>
  );

  // Photo Modal mit useIonModal Hook
  const [presentPhotoModalHook, dismissPhotoModalHook] = useIonModal(PhotoModal, {
    onClose: () => {
      if (selectedPhoto && selectedPhoto.startsWith('blob:')) {
        URL.revokeObjectURL(selectedPhoto);
      }
      setSelectedPhoto(null);
      dismissPhotoModalHook();
    },
    photoUrl: selectedPhoto || ''
  });

  useEffect(() => {
    loadKonfiData();
  }, [konfiId]);

  useEffect(() => {
    setPresentingElement(pageRef.current);
  }, []);

  const loadKonfiData = async () => {
    setLoading(true);
    try {
      const konfiRes = await api.get(`/admin/konfis/${konfiId}`);

      let requestsRes = { data: [] };
      try {
        requestsRes = await api.get('/admin/activities/requests');
      } catch (requestsError) {
 console.warn('Could not load activity requests:', requestsError);
      }

      const konfiData = konfiRes.data;
      const allActivities = konfiData.activities || [];

      // bonusPoints vom Backend ist ein Array, nicht eine Zahl!
      const bonusEntriesArray = Array.isArray(konfiData.bonusPoints) ? konfiData.bonusPoints : [];
      setBonusEntries(bonusEntriesArray);

      setCurrentKonfi({
        ...konfiData,
        // Nicht die bonus-Werte aus dem Backend übernehmen - wir berechnen aus bonusEntries
      });

      try {
        const eventPointsRes = await api.get(`/admin/konfis/${konfiId}/event-points`);
        setEventPoints(eventPointsRes.data || []);
      } catch (eventPointsError) {
        setEventPoints([]);
      }

      try {
        const attendanceRes = await api.get(`/admin/konfis/${konfiId}/attendance-stats`);
        setAttendanceStats(attendanceRes.data);
      } catch (attendanceError) {
        setAttendanceStats(null);
      }

      const enhancedActivities = allActivities.map((activity: any) => ({
        ...activity,
        hasPhoto: false
      }));

      const pendingRequests = (requestsRes.data || [])
        .filter((req: any) => req.konfi_id === konfiId && req.status === 'pending')
        .map((req: any) => ({
          id: `request-${req.id}`,
          name: `${req.activity_name} (Antrag)`,
          points: req.activity_points,
          type: 'pending',
          date: req.requested_date,
          admin: 'Wartend auf Genehmigung',
          isPending: true,
          photo_filename: req.photo_filename,
          requestId: req.id,
          hasPhoto: !!req.photo_filename
        }));

      setActivities([...enhancedActivities, ...pendingRequests]);
    } catch (err) {
      setError('Fehler beim Laden der Konfi-Daten');
    } finally {
      setLoading(false);
    }
  };

  const getGottesdienstPoints = () => {
    if (!currentKonfi) return 0;
    return currentKonfi.gottesdienst_points ?? currentKonfi.points?.gottesdienst ?? 0;
  };

  const getGemeindePoints = () => {
    if (!currentKonfi) return 0;
    return currentKonfi.gemeinde_points ?? currentKonfi.points?.gemeinde ?? 0;
  };

  const getTotalPoints = () => {
    return getGottesdienstPoints() + getGemeindePoints();
  };

  const getBonusPoints = () => {
    // Nur aus den bonusEntries berechnen - das ist die einzige zuverlässige Quelle
    return bonusEntries.reduce((sum, bonus) => sum + (bonus.points || 0), 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handlePasswordAction = () => {
    presentAlert({
      header: 'Einmalpasswort generieren',
      message: 'Es wird ein neues temporäres Passwort erstellt. Das aktuelle Passwort wird überschrieben.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Generieren',
          handler: () => {
            setTimeout(() => handlePasswordReset(), 300);
          }
        }
      ]
    });
  };

  const handleDeleteActivity = async (activity: Activity) => {
    presentAlert({
      header: 'Aktivität löschen',
      message: `Aktivität "${activity.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/konfis/${konfiId}/activities/${activity.id}`);
              setSuccess(`Aktivität "${activity.name}" gelöscht`);
              await loadKonfiData();
              window.dispatchEvent(new CustomEvent('konfis-updated'));
            } catch (err) {
              setError('Fehler beim Löschen der Aktivität');
            }
          }
        }
      ]
    });
  };

  const handleDeleteBonus = async (bonus: any) => {
    presentAlert({
      header: 'Bonuspunkte löschen',
      message: `Bonuspunkte "${bonus.description}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/konfis/${konfiId}/bonus-points/${bonus.id}`);
              setSuccess(`Bonuspunkte "${bonus.description}" gelöscht`);
              await loadKonfiData();
              window.dispatchEvent(new CustomEvent('konfis-updated'));
            } catch (err) {
              setError('Fehler beim Löschen der Bonuspunkte');
            }
          }
        }
      ]
    });
  };

  const handlePasswordReset = async () => {
    try {
      const response = await api.post(`/admin/konfis/${konfiId}/regenerate-password`);
      const tempPassword = response.data.temporaryPassword;
      presentAlert({
        header: 'Einmalpasswort erstellt',
        subHeader: tempPassword,
        message: 'Kopiere das Passwort und gib es dem Konfi weiter.',
        buttons: [
          {
            text: 'Kopieren',
            handler: () => {
              navigator.clipboard.writeText(tempPassword);
              setSuccess('Passwort kopiert');
              return false;
            }
          },
          { text: 'Fertig', role: 'cancel' }
        ]
      });
      window.dispatchEvent(new CustomEvent('konfis-updated'));
    } catch (err) {
      setError('Fehler beim Zurücksetzen des Passworts');
    }
  };

  const handlePhotoClick = async (activity: Activity) => {
    if (activity.hasPhoto && (activity as any).requestId) {
      try {
        const response = await api.get(`/admin/activities/requests/${(activity as any).requestId}/photo`, {
          responseType: 'blob'
        });
        const photoUrl = URL.createObjectURL(response.data);
        setSelectedPhoto(photoUrl);
        presentPhotoModalHook({
          presentingElement: presentingElement || undefined
        });
      } catch (error) {
        setError('Foto konnte nicht geladen werden');
      }
    }
  };

  const handlePromoteToTeamer = async () => {
    if (!currentKonfi) return;
    presentAlert({
      header: 'Zum Teamer befördern',
      message: `<strong>${currentKonfi.name}</strong> wirklich zum Teamer befördern?<br><br>` +
        `<strong>Punkte:</strong> ${getGottesdienstPoints()} Gottesdienst, ${getGemeindePoints()} Gemeinde<br>` +
        `<strong>Badges:</strong> ${currentKonfi.badgeCount || 0}<br><br>` +
        `Konfi-Punkte und Badges bleiben als Historie erhalten. ` +
        `Event-Buchungen und offene Anträge werden gelöscht.<br><br>` +
        `<strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong>`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Befördern',
          handler: async () => {
            try {
              await api.post(`/admin/konfis/${konfiId}/promote-teamer`);
              setSuccess(`${currentKonfi.name} wurde zum Teamer befördert`);
              window.dispatchEvent(new CustomEvent('konfis-updated'));
              onBack();
            } catch (err: any) {
              setError(err.response?.data?.error || 'Fehler beim Befördern');
            }
          }
        }
      ]
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{currentKonfi?.name || 'Konfi Details'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handlePasswordAction}>
              <IonIcon icon={key} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            loadKonfiData();
            e.detail.complete();
          }}
        >
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Konfi Header mit Activity Rings - Apple Health Style */}
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
          {/* Überschrift - groß und überlappend */}
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
              marginBottom: '16px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.85rem'
            }}
          >
            {currentKonfi?.jahrgang_name || currentKonfi?.jahrgang} - @{currentKonfi?.username}
          </div>

          {/* Activity Rings */}
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

          {/* Badge Count */}
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
        </div>

        {/* Bonuspunkte - iOS26 Pattern - Orange als Hauptfarbe */}
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
                          {/* Corner Badge für Punkte */}
                          <div
                            className="app-corner-badge"
                            style={{
                              backgroundColor: bonus.type === 'gottesdienst' ? '#3b82f6' : '#059669'
                            }}
                          >
                            +{bonus.points}P
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
                  presentBonusModalHook({
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

        {/* Event Points - iOS26 Pattern - Rot als Hauptfarbe */}
        <IonList className="app-section-inset" inset={true}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={podium} />
            </div>
            <IonLabel>Events ({eventPoints.reduce((sum, ep) => sum + (ep.points || 0), 0)})</IonLabel>
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
                      {/* Corner Badge für Punkte */}
                      <div
                        className="app-corner-badge"
                        style={{
                          backgroundColor: eventPoint.point_type === 'gottesdienst' ? '#3b82f6' : '#059669'
                        }}
                      >
                        +{eventPoint.points}P
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

        {/* Anwesenheit - Pflicht-Events */}
        {attendanceStats && attendanceStats.total_mandatory > 0 && (
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
                            marginBottom: index < attendanceStats!.missed_events.length - 1 ? '8px' : '0',
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
        )}

        {/* Aktivitäten - iOS26 Pattern - Grün als Hauptfarbe */}
        <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={flash} />
            </div>
            <IonLabel>Aktivitäten ({activities.filter((a) => !a.isPending).reduce((sum, a) => sum + (a.points || 0), 0)})</IonLabel>
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
                          {/* Corner Badge für Punkte */}
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
                  presentActivityModalHook({
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
        {/* Teamer-Beförderung */}
        <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={ribbon} />
            </div>
            <IonLabel>Rolle ändern</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-card-content">
              <IonButton
                expand="block"
                style={{ '--background': '#5b21b6', '--background-hover': '#4c1d95' }}
                onClick={handlePromoteToTeamer}
              >
                <IonIcon icon={ribbon} slot="start" />
                Zum Teamer befördern
              </IonButton>
              <p style={{ fontSize: '0.8rem', color: 'var(--ion-color-medium)', textAlign: 'center', marginTop: '8px' }}>
                Konfi-Rolle wird dauerhaft gewechselt
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>

      </IonContent>

    </IonPage>
  );
};

export default KonfiDetailView;
