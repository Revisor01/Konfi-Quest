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
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonBadge,
  IonChip,
  IonList,
  IonListHeader,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonAlert,
  useIonActionSheet,
  useIonModal,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/react';
import { 
  arrowBack,
  arrowBackOutline, 
  trophy, 
  star, 
  flash, 
  calendar,
  school,
  checkmark,
  add,
  time,
  ribbon,
  key,
  gift,
  trash,
  image,
  eye,
  close,
  podium
} from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import ActivityModal from '../modals/ActivityModal';
import BonusModal from '../modals/BonusModal';

interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang?: string;
  jahrgang_name?: string; // Backend liefert jahrgang_name
  password?: string;
  // Backend liefert diese Felder:
  gottesdienst_points?: number;
  gemeinde_points?: number;
  // Legacy support für alte Struktur:
  points?: {
    gottesdienst: number;
    gemeinde: number;
  };
  bonus?: number;
  bonusPoints?: number;
  totalBonus?: number;
  badgeCount?: number;
  activities_count?: number;
}

interface Activity {
  id: number | string;
  name: string;
  points: number;
  type: string; // 'gottesdienst', 'gemeinde' oder 'pending'
  date: string;
  admin?: string;
  isPending?: boolean;
  photo_filename?: string;
  requestId?: number; // Original request ID für Photo-Endpoint
  hasPhoto?: boolean;
}


interface KonfiDetailViewProps {
  konfiId: number;
  onBack: () => void;
}

const KonfiDetailView: React.FC<KonfiDetailViewProps> = ({ konfiId, onBack }) => {
  const { setSuccess, setError } = useApp();
  const [presentActionSheet] = useIonActionSheet();
  const pageRef = React.useRef<HTMLElement>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bonusEntries, setBonusEntries] = useState<any[]>([]);
  const [eventPoints, setEventPoints] = useState<any[]>([]);
  const [currentKonfi, setCurrentKonfi] = useState<Konfi | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordAlert, setShowPasswordAlert] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [loadedPassword, setLoadedPassword] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Activity Modal mit useIonModal Hook
  const [presentActivityModalHook, dismissActivityModalHook] = useIonModal(ActivityModal, {
    konfiId: konfiId,
    onClose: () => dismissActivityModalHook(),
    onSave: async () => {
      await loadKonfiData();
      setSuccess('Aktivität hinzugefügt');
      // Event für Parent-Update
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
      // Event für Parent-Update
      window.dispatchEvent(new CustomEvent('konfis-updated'));
      dismissBonusModalHook();
    }
  });

  // Photo Modal Component
  const PhotoModal: React.FC<{onClose: () => void, photoUrl: string}> = ({ onClose, photoUrl }) => (
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
    // Setze das presentingElement nach dem ersten Mount
    setPresentingElement(pageRef.current);
  }, []);

  const loadKonfiData = async () => {
    setLoading(true);
    try {
      // Lade Konfi-Daten
      const konfiRes = await api.get(`/admin/konfis/${konfiId}`);
      
      // Versuche Activity-Requests zu laden (optional, falls Permissions vorhanden)
      let requestsRes = { data: [] };
      try {
        requestsRes = await api.get('/admin/activities/requests');
      } catch (requestsError) {
        console.warn('Could not load activity requests (permission denied):', requestsError);
        // Fallback: keine Requests anzeigen
      }
      
      console.log('Konfi data loaded:', konfiRes.data);
      console.log('Password from API:', konfiRes.data.password);
      const konfiData = konfiRes.data;
      const allActivities = konfiData.activities || [];
      
      // Konfi-Daten aktualisieren
      setCurrentKonfi({
        ...konfiData,
        bonus: konfiData.totalBonus || konfiData.bonus || 0,
        bonusPoints: konfiData.totalBonus || konfiData.bonus || 0,
        totalBonus: konfiData.totalBonus || konfiData.bonus || 0
      });
      
      // Bonuspunkte aus API-Response extrahieren
      setBonusEntries(konfiData.bonusPoints || []);
      
      // Event Points laden
      try {
        const eventPointsRes = await api.get(`/admin/konfis/${konfiId}/event-points`);
        console.log('Event points loaded:', eventPointsRes.data);
        setEventPoints(eventPointsRes.data || []);
      } catch (eventPointsError) {
        console.warn('Could not load event points:', eventPointsError);
        setEventPoints([]);
      }
      
      // Normale Aktivitäten haben keine Fotos - nur activity-requests haben Fotos
      const enhancedActivities = allActivities.map((activity: any) => ({
        ...activity,
        hasPhoto: false // Normale Aktivitäten haben keine Fotos
      }));
      
      // Schwebende Anträge hinzufügen (nur diese können Fotos haben)
      const pendingRequests = (requestsRes.data || []).filter(
        (req: any) => req.konfi_id === konfiId && req.status === 'pending'
      ).map((req: any) => {
        console.log('Request data:', req);
        console.log('Photo filename:', req.photo_filename);
        return {
          id: `request-${req.id}`,
          name: `${req.activity_name} (Antrag)`,
          points: req.activity_points,
          type: 'pending',
          date: req.requested_date,
          admin: 'Wartend auf Genehmigung',
          isPending: true,
          photo_filename: req.photo_filename,
          requestId: req.id, // Original request ID für Photo-Endpoint
          hasPhoto: !!(req.photo_filename)
        };
      });
      
      setActivities([...enhancedActivities, ...pendingRequests]);
    } catch (err) {
      setError('Fehler beim Laden der Konfi-Daten');
      console.error('Error loading konfi data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTotalPoints = () => {
    if (!currentKonfi) return 0;
    // Support both new backend structure and legacy structure
    const gottesdienst = currentKonfi.gottesdienst_points ?? currentKonfi.points?.gottesdienst ?? 0;
    const gemeinde = currentKonfi.gemeinde_points ?? currentKonfi.points?.gemeinde ?? 0;
    return gottesdienst + gemeinde;
  };

  const getBonusPoints = () => {
    if (!currentKonfi) return 0;
    // Bonuspunkte aus bonusEntries berechnen
    const bonusFromEntries = bonusEntries.reduce((sum, bonus) => sum + (bonus.points || 0), 0);
    // Fallback auf konfi-Objekt
    const bonusFromKonfi = currentKonfi.bonus || currentKonfi.bonusPoints || currentKonfi.totalBonus || 0;
    // Höheren Wert nehmen (meist bonusFromEntries)
    return Math.max(bonusFromEntries, bonusFromKonfi);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handlePasswordAction = () => {
    presentActionSheet({
      header: 'Passwort Optionen',
      buttons: [
        {
          text: 'Passwort anzeigen',
          handler: () => handleShowPassword()
        },
        {
          text: 'Neues Passwort generieren',
          handler: () => handlePasswordReset()
        },
        {
          text: 'Abbrechen',
          role: 'cancel'
        }
      ]
    });
  };

  const handleShowPassword = async () => {
    setShowPasswordAlert(true);
  };

  const handleDeleteActivity = async (activity: Activity) => {
    if (!window.confirm(`Aktivität "${activity.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/admin/konfis/${konfiId}/activities/${activity.id}`);
      setSuccess(`Aktivität "${activity.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadKonfiData();
      // Auch die Eltern-Komponente aktualisieren (falls vorhanden)
      if (window.location.pathname.includes('/konfis')) {
        window.dispatchEvent(new CustomEvent('konfis-updated'));
      }
    } catch (err) {
      setError('Fehler beim Löschen der Aktivität');
    }
  };

  const handleDeleteBonus = async (bonus: any) => {
    if (!window.confirm(`Bonuspunkte "${bonus.description}" wirklich löschen?`)) return;

    try {
      await api.delete(`/admin/konfis/${konfiId}/bonus-points/${bonus.id}`);
      setSuccess(`Bonuspunkte "${bonus.description}" gelöscht`);
      // Sofortige Aktualisierung
      await loadKonfiData();
      // Auch die Eltern-Komponente aktualisieren (falls vorhanden)
      if (window.location.pathname.includes('/konfis')) {
        window.dispatchEvent(new CustomEvent('konfis-updated'));
      }
    } catch (err) {
      setError('Fehler beim Löschen der Bonuspunkte');
    }
  };

  const handlePasswordReset = async () => {
    try {
      const response = await api.post(`/admin/konfis/${konfiId}/regenerate-password`);
      // Passwort sofort aktualisieren
      const newPassword = response.data.password;
      setCurrentKonfi(prev => prev ? { ...prev, password: newPassword } : null);
      setLoadedPassword(newPassword);
      setSuccess(`Neues Passwort: ${newPassword}`);
      // Parent-Update triggern
      window.dispatchEvent(new CustomEvent('konfis-updated'));
    } catch (err) {
      setError('Fehler beim Zurücksetzen des Passworts');
      console.error('Password reset error:', err);
    }
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
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadKonfiData();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>{currentKonfi?.name || 'Konfi Details'}</IonTitle>
          </IonToolbar>
        </IonHeader>


        {/* Konfi Header - Dashboard-Style */}
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(139, 92, 246, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Überschrift - groß und überlappend */}
          <div style={{
            position: 'absolute',
            top: '-5px',
            left: '12px',
            zIndex: 1
          }}>
            <h2 style={{
              fontSize: '3.5rem',
              fontWeight: '900',
              color: 'rgba(255, 255, 255, 0.1)',
              margin: '0',
              lineHeight: '0.8',
              letterSpacing: '-2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '280px'
            }}>
              {(currentKonfi?.name || 'KONFI').toUpperCase()}
            </h2>
          </div>

          {/* Konfi Info */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            padding: '60px 24px 24px 24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {/* Username und Jahrgang */}
            <div style={{
              textAlign: 'center',
              marginBottom: '16px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '0.9rem'
            }}>
              {currentKonfi?.jahrgang_name || currentKonfi?.jahrgang} • @{currentKonfi?.username}
            </div>

            <IonGrid style={{ padding: '0', margin: '0 4px' }}>
              <IonRow>
                <IonCol size="3" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 8px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={school}
                      style={{
                        fontSize: '1.2rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '4px',
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }}
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.2rem' }}>{currentKonfi?.gottesdienst_points ?? currentKonfi?.points?.gottesdienst ?? 0}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      G'dienst
                    </div>
                  </div>
                </IonCol>
                <IonCol size="3" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 8px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={star}
                      style={{
                        fontSize: '1.2rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '4px',
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }}
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.2rem' }}>{currentKonfi?.gemeinde_points ?? currentKonfi?.points?.gemeinde ?? 0}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      Gemeinde
                    </div>
                  </div>
                </IonCol>
                <IonCol size="3" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 8px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={trophy}
                      style={{
                        fontSize: '1.2rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '4px',
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }}
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.2rem' }}>{currentKonfi?.badgeCount || 0}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      Badges
                    </div>
                  </div>
                </IonCol>
                <IonCol size="3" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 8px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={flash}
                      style={{
                        fontSize: '1.2rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '4px',
                        display: 'block',
                        margin: '0 auto 4px auto'
                      }}
                    />
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.2rem' }}>{getTotalPoints()}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      Gesamt
                    </div>
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Bonuspunkte */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={gift} style={{ marginRight: '8px', color: '#f59e0b' }} />
              Bonus ({getBonusPoints()})
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {bonusEntries.length > 0 ? (
              <IonList>
                {bonusEntries.map((bonus: any, index: number) => (
                  <IonItemSliding key={index}>
                    <IonItem>
                      <IonLabel>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {bonus.description || 'Bonuspunkte'}
                          <IonChip 
                            color={bonus.type === 'gottesdienst' ? 'primary' : 'success'}
                            style={{ 
                              fontSize: '0.7rem', 
                              height: '18px',
                              opacity: 0.8,
                              '--background': bonus.type === 'gottesdienst' ? 'rgba(56, 128, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                              '--color': bonus.type === 'gottesdienst' ? '#3880ff' : '#2dd36f'
                            }}
                          >
                            {bonus.type === 'gottesdienst' ? 'G' : 'Gem'}
                          </IonChip>
                        </h3>
                        <p>{formatDate(bonus.completed_date || bonus.date)} • {bonus.admin || 'Admin'}</p>
                      </IonLabel>
                      <IonBadge 
                        style={{
                          '--background': 'rgba(255, 152, 0, 0.15)',
                          '--color': '#ff9800',
                          opacity: 0.8,
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}
                      >
                        +{bonus.points}
                      </IonBadge>
                    </IonItem>
                    <IonItemOptions side="end">
                      <IonItemOption 
                        color="danger" 
                        onClick={() => handleDeleteBonus(bonus)}
                      >
                        <IonIcon icon={trash} />
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </IonList>
            ) : (
              <p style={{ textAlign: 'center', color: '#666', margin: '20px 0' }}>
                Noch keine Bonuspunkte vorhanden
              </p>
            )}
            <IonButton 
              expand="block" 
              fill="outline" 
              onClick={() => presentBonusModalHook({
                presentingElement: presentingElement || undefined
              })}
              style={{ marginTop: '16px' }}
            >
              <IonIcon icon={add} style={{ marginRight: '8px' }} />
              Bonuspunkte hinzufügen
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Event Points */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={podium} style={{ marginRight: '8px', color: '#eb445a' }} />
              Events ({eventPoints.reduce((sum, ep) => sum + (ep.points || 0), 0)})
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {eventPoints.length > 0 ? (
              <IonList>
                {eventPoints.map((eventPoint: any, index: number) => (
                  <IonItem key={index}>
                    <IonLabel>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {eventPoint.event_name || 'Event'}
                        <IonChip 
                          color={eventPoint.point_type === 'gottesdienst' ? 'primary' : 'success'}
                          style={{ 
                            fontSize: '0.7rem', 
                            height: '18px',
                            opacity: 0.8,
                            '--background': eventPoint.point_type === 'gottesdienst' ? 'rgba(56, 128, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                            '--color': eventPoint.point_type === 'gottesdienst' ? '#3880ff' : '#2dd36f'
                          }}
                        >
                          {eventPoint.point_type === 'gottesdienst' ? 'G' : 'Gem'}
                        </IonChip>
                      </h3>
                      <p>
                        {eventPoint.event_date && formatDate(eventPoint.event_date)} • {eventPoint.admin_name || 'Admin'}
                        {eventPoint.awarded_date && ` • Vergeben: ${formatDate(eventPoint.awarded_date)}`}
                      </p>
                    </IonLabel>
                    <IonBadge 
                      style={{
                        '--background': 'rgba(235, 68, 90, 0.15)',
                        '--color': '#eb445a',
                        opacity: 0.8,
                        fontSize: '0.8rem',
                        fontWeight: '500'
                      }}
                    >
                      +{eventPoint.points}
                    </IonBadge>
                  </IonItem>
                ))}
              </IonList>
            ) : (
              <p style={{ textAlign: 'center', color: '#666', margin: '20px 0' }}>
                Noch keine Event-Punkte erhalten
              </p>
            )}
          </IonCardContent>
        </IonCard>

        {/* Letzte Aktivitäten */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={calendar} style={{ marginRight: '8px', color: '#667eea' }} />
              Aktivitäten ({activities.length})
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {activities.length > 0 ? (
              <IonList>
                {activities.slice(0, 10).map((activity) => (
                  <IonItemSliding key={activity.id}>
                    <IonItem 
                      button={activity.hasPhoto}
                      onClick={async () => {
                        if (activity.hasPhoto && (activity as any).requestId) {
                          try {
                            console.log('Fetching photo for request:', (activity as any).requestId);
                            // Photo über API mit Auth-Token laden
                            const response = await api.get(`/activity-requests/${(activity as any).requestId}/photo`, {
                              responseType: 'blob'
                            });
                            const photoUrl = URL.createObjectURL(response.data);
                            setSelectedPhoto(photoUrl);
                            presentPhotoModalHook({
              presentingElement: presentingElement || undefined
            });
                          } catch (error) {
                            console.error('Error loading photo:', error);
                            setError('Foto konnte nicht geladen werden');
                          }
                        } else {
                          console.log('No photo for activity:', activity.name, 'hasPhoto:', activity.hasPhoto, 'requestId:', (activity as any).requestId);
                        }
                      }}
                    >
                      <IonLabel>
                        <h3 style={{ 
                          color: activity.isPending ? '#f59e0b' : 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {activity.name}
                          {activity.hasPhoto && (
                            <IonIcon 
                              icon={image} 
                              style={{ 
                                fontSize: '0.9rem', 
                                color: '#667eea',
                                opacity: 0.7 
                              }} 
                            />
                          )}
                        </h3>
                        <p>{formatDate(activity.date)} • {activity.admin}</p>
                      </IonLabel>
                      <IonBadge 
                        style={{
                          '--background': activity.isPending ? 'rgba(255, 193, 7, 0.15)' :
                                         activity.type === 'gottesdienst' ? 'rgba(56, 128, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                          '--color': activity.isPending ? '#ffc107' :
                                    activity.type === 'gottesdienst' ? '#3880ff' : '#2dd36f',
                          opacity: 0.7,
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}
                      >
                        {activity.isPending ? '?' : '+'}{activity.points}
                      </IonBadge>
                    </IonItem>
                    {!activity.isPending && (
                      <IonItemOptions side="end">
                        <IonItemOption 
                          color="danger" 
                          onClick={() => handleDeleteActivity(activity)}
                        >
                          <IonIcon icon={trash} />
                        </IonItemOption>
                      </IonItemOptions>
                    )}
                  </IonItemSliding>
                ))}
              </IonList>
            ) : (
              <p style={{ textAlign: 'center', color: '#666', margin: '20px 0' }}>
                Noch keine Aktivitäten vorhanden
              </p>
            )}
            <IonButton 
              expand="block" 
              fill="outline" 
              onClick={() => presentActivityModalHook({
                presentingElement: presentingElement || undefined
              })}
              style={{ marginTop: '16px' }}
            >
              <IonIcon icon={add} style={{ marginRight: '8px' }} />
              Aktivität hinzufügen
            </IonButton>
          </IonCardContent>
        </IonCard>

      </IonContent>
      
      {/* Password Alert */}
      <IonAlert
        isOpen={showPasswordAlert}
        onDidDismiss={() => setShowPasswordAlert(false)}
        header="Passwort"
        message={`Aktuelles Passwort: ${loadedPassword || currentKonfi?.password || 'Nicht verfügbar'}`}
        buttons={['OK']}
      />



    </IonPage>
  );
};

export default KonfiDetailView;