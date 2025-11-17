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
          background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
          borderRadius: '24px',
          padding: '0',
          margin: '16px',
          marginBottom: '16px',
          boxShadow: '0 20px 40px rgba(91, 33, 182, 0.3)',
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
                <IonCol size="6" style={{ padding: '0 4px' }}>
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
                      <span style={{ fontSize: '1.5rem' }}>{currentKonfi?.badgeCount || 0}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      Badges
                    </div>
                  </div>
                </IonCol>
                <IonCol size="6" style={{ padding: '0 4px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={flash}
                      style={{
                        fontSize: '1.5rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '8px',
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }}
                    />
                    <div style={{ fontSize: '1.3rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '1.5rem' }}>{getTotalPoints()}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
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
            <IonCardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={gift} style={{ color: '#f59e0b', fontSize: '1.2rem' }} />
              Bonus ({getBonusPoints()})
            </IonCardTitle>
          </IonCardHeader>
          {bonusEntries.length > 0 && (
            <IonCardContent style={{ padding: '8px 0' }}>
              <IonList lines="none" style={{ background: 'transparent' }}>
                  {bonusEntries.map((bonus: any, index: number) => (
                    <IonItemSliding key={index}>
                      <IonItem
                        style={{
                          '--min-height': '80px',
                          '--padding-start': '16px',
                          '--padding-top': '0px',
                          '--padding-bottom': '0px',
                          '--background': '#fbfbfb',
                          '--border-radius': '12px',
                          margin: '6px 8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px'
                        }}
                      >
                        <IonLabel>
                          {/* Header mit Icon und Badge */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '4px',
                            position: 'relative'
                          }}>
                            {/* Bonus Icon */}
                            <div style={{
                              width: '28px',
                              height: '28px',
                              backgroundColor: '#ff9800',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={gift}
                                style={{
                                  fontSize: '0.9rem',
                                  color: 'white'
                                }}
                              />
                            </div>

                            {/* Bonus Description */}
                            <h3 style={{
                              fontWeight: '600',
                              fontSize: '1rem',
                              margin: '0',
                              color: '#333',
                              lineHeight: '1.3',
                              flex: 1,
                              minWidth: 0,
                              maxWidth: 'calc(100% - 100px)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {bonus.description || 'Bonuspunkte'}
                            </h3>

                            {/* Points Badge */}
                            <span style={{
                              fontSize: '0.7rem',
                              color: bonus.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              fontWeight: '600',
                              backgroundColor: bonus.type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: bonus.type === 'gottesdienst' ? '1px solid rgba(0, 122, 255, 0.3)' : '1px solid rgba(45, 211, 111, 0.3)',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              position: 'absolute',
                              right: '0px',
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}>
                              +{bonus.points}
                            </span>
                          </div>

                          {/* Date, Admin and Type */}
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#666',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginLeft: '40px'
                          }}>
                            <span>{formatDate(bonus.completed_date || bonus.date)} • {bonus.admin || 'Admin'}</span>
                          </div>
                        </IonLabel>
                      </IonItem>
                      <IonItemOptions side="end">
                        <IonItemOption
                          color="danger"
                          onClick={() => handleDeleteBonus(bonus)}
                          style={{ paddingRight: '8px' }}
                        >
                          <IonIcon icon={trash} />
                        </IonItemOption>
                      </IonItemOptions>
                    </IonItemSliding>
                  ))}
              </IonList>
            </IonCardContent>
          )}
          {bonusEntries.length === 0 && (
            <IonCardContent style={{ padding: '16px' }}>
              <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                Noch keine Bonuspunkte erhalten
              </p>
            </IonCardContent>
          )}
          <IonCardContent style={{ padding: '16px' }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => presentBonusModalHook({
                presentingElement: presentingElement || undefined
              })}
            >
              <IonIcon icon={add} style={{ marginRight: '8px' }} />
              Bonuspunkte hinzufügen
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Event Points */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={podium} style={{ color: '#eb445a', fontSize: '1.2rem' }} />
              Events ({eventPoints.reduce((sum, ep) => sum + (ep.points || 0), 0)})
            </IonCardTitle>
          </IonCardHeader>
          {eventPoints.length > 0 && (
            <IonCardContent style={{ padding: '8px 0' }}>
              <IonList lines="none" style={{ background: 'transparent' }}>
                  {eventPoints.map((eventPoint: any, index: number) => (
                    <IonItem
                      key={index}
                      detail={false}
                      style={{
                        '--min-height': '80px',
                        '--padding-start': '16px',
                        '--padding-top': '0px',
                        '--padding-bottom': '0px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '6px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}
                    >
                      <IonLabel>
                        {/* Header mit Icon und Badge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '4px',
                          position: 'relative'
                        }}>
                          {/* Event Icon */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#eb445a',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <IonIcon
                              icon={podium}
                              style={{
                                fontSize: '0.9rem',
                                color: 'white'
                              }}
                            />
                          </div>

                          {/* Event Name */}
                          <h3 style={{
                            fontWeight: '600',
                            fontSize: '1rem',
                            margin: '0',
                            color: '#333',
                            lineHeight: '1.3',
                            paddingRight: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {eventPoint.event_name || 'Event'}
                          </h3>

                          {/* Points Badge */}
                          <span style={{
                            fontSize: '0.7rem',
                            color: eventPoint.point_type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                            fontWeight: '600',
                            backgroundColor: eventPoint.point_type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            border: eventPoint.point_type === 'gottesdienst' ? '1px solid rgba(0, 122, 255, 0.3)' : '1px solid rgba(45, 211, 111, 0.3)',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            position: 'absolute',
                            right: '0px',
                            top: '50%',
                            transform: 'translateY(-50%)'
                          }}>
                            +{eventPoint.points}
                          </span>
                        </div>

                        {/* Date and Admin */}
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: '40px'
                        }}>
                          <span>
                            {eventPoint.awarded_date && new Date(eventPoint.awarded_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • {eventPoint.admin_name || 'Admin'}
                          </span>
                        </div>
                      </IonLabel>
                    </IonItem>
                  ))}
              </IonList>
            </IonCardContent>
          )}
          {eventPoints.length === 0 && (
            <IonCardContent style={{ padding: '16px' }}>
              <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                Noch keine Event-Punkte erhalten
              </p>
            </IonCardContent>
          )}
        </IonCard>

        {/* Letzte Aktivitäten */}
        <IonCard style={{ margin: '16px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={flash} style={{ color: '#5b21b6', fontSize: '1.2rem' }} />
              Aktivitäten ({activities.filter(a => !a.isPending).reduce((sum, a) => sum + (a.points || 0), 0)})
            </IonCardTitle>
          </IonCardHeader>
          {activities.length > 0 && (
            <IonCardContent style={{ padding: '8px 0' }}>
              <IonList lines="none" style={{ background: 'transparent' }}>
                  {activities.slice(0, 10).map((activity) => (
                    <IonItemSliding key={activity.id}>
                      <IonItem
                        button={activity.hasPhoto}
                        onClick={async () => {
                          if (activity.hasPhoto && (activity as any).requestId) {
                            try {
                              console.log('Fetching photo for request:', (activity as any).requestId);
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
                        style={{
                          '--min-height': '80px',
                          '--padding-start': '16px',
                          '--padding-top': '0px',
                          '--padding-bottom': '0px',
                          '--background': '#fbfbfb',
                          '--border-radius': '12px',
                          margin: '6px 8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px'
                        }}
                      >
                        <IonLabel>
                          {/* Header mit Icon und Badge */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '4px',
                            position: 'relative'
                          }}>
                            {/* Status Icon */}
                            <div style={{
                              width: '28px',
                              height: '28px',
                              backgroundColor: activity.isPending ? '#f59e0b' :
                                             activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={activity.isPending ? time : activity.type === 'gottesdienst' ? school : star}
                                style={{
                                  fontSize: '0.9rem',
                                  color: 'white'
                                }}
                              />
                            </div>

                            {/* Activity Name */}
                            <h3 style={{
                              fontWeight: '600',
                              fontSize: '1rem',
                              margin: '0',
                              color: activity.isPending ? '#f59e0b' : '#333',
                              lineHeight: '1.3',
                              flex: 1,
                              minWidth: 0,
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {activity.name}
                              {activity.hasPhoto && (
                                <IonIcon
                                  icon={image}
                                  style={{
                                    fontSize: '0.8rem',
                                    color: '#5b21b6',
                                    opacity: 0.7
                                  }}
                                />
                              )}
                            </h3>

                            {/* Points Badge */}
                            <span style={{
                              fontSize: '0.7rem',
                              color: activity.isPending ? '#f59e0b' :
                                     activity.type === 'gottesdienst' ? '#007aff' : '#2dd36f',
                              fontWeight: '600',
                              backgroundColor: activity.isPending ? 'rgba(245, 158, 11, 0.15)' :
                                             activity.type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.15)' : 'rgba(45, 211, 111, 0.15)',
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: `1px solid ${activity.isPending ? 'rgba(245, 158, 11, 0.3)' :
                                                  activity.type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.3)' : 'rgba(45, 211, 111, 0.3)'}`,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                              position: 'absolute',
                              right: '0px',
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}>
                              {activity.isPending ? '?' : '+'}{activity.points}
                            </span>
                          </div>

                          {/* Date and Admin */}
                          <div style={{
                            fontSize: '0.8rem',
                            color: '#666',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginLeft: '40px'
                          }}>
                            <span>{formatDate(activity.date)} • {activity.admin}</span>
                          </div>
                        </IonLabel>
                      </IonItem>
                      {!activity.isPending && (
                        <IonItemOptions side="end">
                          <IonItemOption
                            color="danger"
                            onClick={() => handleDeleteActivity(activity)}
                            style={{ paddingRight: '8px' }}
                          >
                            <IonIcon icon={trash} />
                          </IonItemOption>
                        </IonItemOptions>
                      )}
                    </IonItemSliding>
                  ))}
                </IonList>
            </IonCardContent>
          )}
          {activities.length === 0 && (
            <IonCardContent style={{ padding: '16px' }}>
              <p style={{ color: '#666', margin: '0', fontSize: '0.9rem' }}>
                Noch keine Aktivitäten vorhanden
              </p>
            </IonCardContent>
          )}
          <IonCardContent style={{ padding: '16px' }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => presentActivityModalHook({
                presentingElement: presentingElement || undefined
              })}
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