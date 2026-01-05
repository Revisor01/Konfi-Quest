import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButton,
  IonButtons,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonLabel
} from '@ionic/react';
import {
  closeOutline,
  starOutline,
  flashOutline,
  giftOutline,
  calendarOutline,
  timeOutline,
  trophyOutline
} from 'ionicons/icons';
import api from '../../../services/api';

interface PointsHistoryModalProps {
  onClose: () => void;
}

interface PointEntry {
  id: number;
  title: string;
  points: number;
  category: string;
  date: string;
  comment?: string;
  source_type: 'activity' | 'bonus' | 'event';
}

interface PointsTotals {
  gottesdienst: number;
  gemeinde: number;
  bonus: number;
  event: number;
  total: number;
}

const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointEntry[]>([]);
  const [totals, setTotals] = useState<PointsTotals>({ gottesdienst: 0, gemeinde: 0, bonus: 0, event: 0, total: 0 });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.get('/konfi/points-history');
      setHistory(response.data.history || []);
      setTotals(response.data.totals || { gottesdienst: 0, gemeinde: 0, bonus: 0, event: 0, total: 0 });
    } catch (err) {
      console.error('Error loading points history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unbekannt';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Ungültig';
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Farbe basierend auf category (gottesdienst=blau, gemeinde=grün)
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'gottesdienst': return '#3b82f6';
      case 'gemeinde': return '#059669';
      default: return '#8b5cf6';
    }
  };

  // Icon basierend auf category und source_type
  const getCategoryIcon = (category: string, sourceType?: string) => {
    if (sourceType === 'bonus') return giftOutline;
    if (sourceType === 'event') return calendarOutline;
    switch (category) {
      case 'gottesdienst': return starOutline;
      case 'gemeinde': return flashOutline;
      default: return starOutline;
    }
  };

  // Label für die Kategorie
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'gottesdienst': return 'Gottesdienst';
      case 'gemeinde': return 'Gemeinde';
      default: return category;
    }
  };

  // Typ-Badge Farbe (orange für Bonus, rot für Event)
  const getTypeBadgeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'bonus': return '#f59e0b';
      case 'event': return '#dc2626';
      default: return null;
    }
  };

  // Typ-Badge Label
  const getTypeBadgeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'bonus': return 'Bonus';
      case 'event': return 'Event';
      default: return null;
    }
  };

  // Berechne korrekte Punkte (Events und Bonus zählen zu ihrer category)
  const calculateTotals = () => {
    let gottesdienstTotal = 0;
    let gemeindeTotal = 0;
    let eventCount = 0;
    let bonusCount = 0;

    history.forEach(entry => {
      if (entry.category === 'gottesdienst') {
        gottesdienstTotal += entry.points;
      } else if (entry.category === 'gemeinde') {
        gemeindeTotal += entry.points;
      }

      if (entry.source_type === 'event') {
        eventCount++;
      } else if (entry.source_type === 'bonus') {
        bonusCount++;
      }
    });

    return {
      total: gottesdienstTotal + gemeindeTotal,
      gottesdienst: gottesdienstTotal,
      gemeinde: gemeindeTotal,
      eventCount,
      bonusCount
    };
  };

  const calculatedTotals = calculateTotals();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Punkte-Übersicht</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Header - Kompakter Style wie BadgesView */}
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '20px',
              padding: '24px',
              margin: '16px',
              marginBottom: '16px',
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }} />
              <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IonIcon icon={trophyOutline} style={{ fontSize: '1.6rem', color: 'white' }} />
                </div>
                <div>
                  <h2 style={{ margin: '0', fontSize: '1.4rem', fontWeight: '700', color: 'white' }}>Deine Punkte</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)' }}>Übersicht aller gesammelten Punkte</p>
                </div>
              </div>

              {/* Stats Boxen - 5 nebeneinander */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', position: 'relative', zIndex: 1 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center', flex: '1 1 0', maxWidth: '70px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{calculatedTotals.total}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GESAMT</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center', flex: '1 1 0', maxWidth: '70px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{calculatedTotals.gottesdienst}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GD</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center', flex: '1 1 0', maxWidth: '70px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{calculatedTotals.gemeinde}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GEM</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center', flex: '1 1 0', maxWidth: '70px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{calculatedTotals.eventCount}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>EVENTS</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '10px 8px', textAlign: 'center', flex: '1 1 0', maxWidth: '70px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{calculatedTotals.bonusCount}</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>BONUS</div>
                </div>
              </div>
            </div>

            {/* Verlauf Sektion - iOS26 Pattern */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={timeOutline} />
                </div>
                <IonLabel>Verlauf ({history.length} {history.length === 1 ? 'Eintrag' : 'Einträge'})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: history.length === 0 ? '16px' : '8px' }}>
                  {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                      Noch keine Einträge vorhanden
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {history.map((entry) => {
                        const categoryColor = getCategoryColor(entry.category);
                        const typeBadgeColor = getTypeBadgeColor(entry.source_type);
                        const typeBadgeLabel = getTypeBadgeLabel(entry.source_type);

                        // Farbe basiert auf category (blau/grün)
                        const listItemClass = entry.category === 'gottesdienst' ? 'app-list-item--info' : 'app-list-item--success';
                        const iconCircleClass = entry.category === 'gottesdienst' ? 'app-icon-circle--info' : 'app-icon-circle--success';

                        return (
                          <div
                            key={`${entry.source_type}-${entry.id}`}
                            className={`app-list-item ${listItemClass}`}
                            style={{ position: 'relative', overflow: 'hidden' }}
                          >
                            {/* Corner Badges Container - oben rechts */}
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              display: 'flex',
                              flexDirection: 'row',
                              zIndex: 10
                            }}>
                              {/* Typ-Badge zuerst (Bonus/Event) - links unten abgerundet */}
                              {typeBadgeColor && typeBadgeLabel && (
                                <div style={{
                                  backgroundColor: typeBadgeColor,
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '0 0 8px 8px'
                                }}>
                                  {typeBadgeLabel}
                                </div>
                              )}
                              {/* Weißer Abstand */}
                              {typeBadgeColor && (
                                <div style={{ width: '2px', background: 'white' }} />
                              )}
                              {/* Punkte-Badge - beide Ecken unten abgerundet */}
                              <div style={{
                                backgroundColor: categoryColor,
                                color: 'white',
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                padding: '4px 8px',
                                borderRadius: '0 0 8px 8px'
                              }}>
                                +{entry.points}
                              </div>
                            </div>

                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className={`app-icon-circle ${iconCircleClass}`}>
                                  <IonIcon icon={getCategoryIcon(entry.category, entry.source_type)} />
                                </div>
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title">{entry.title}</div>
                                  <div className="app-list-item__meta">
                                    <span className="app-list-item__meta-item">
                                      {getCategoryLabel(entry.category)}
                                    </span>
                                    <span className="app-list-item__meta-item">
                                      {formatDate(entry.date)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PointsHistoryModal;
