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
  IonLabel,
  IonGrid,
  IonRow,
  IonCol
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

  // Icon basierend auf category
  const getCategoryIcon = (category: string) => {
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
            {/* Header - Kompakter Dashboard-Style */}
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
                  fontSize: '4rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.1)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  PUNKTE
                </h2>
              </div>

              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '70px 24px 24px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <IonGrid style={{ padding: '0', margin: '0 4px' }}>
                  {/* Erste Reihe: Gesamt, Gottesdienst, Gemeinde */}
                  <IonRow>
                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={trophyOutline}
                          style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            display: 'block',
                            margin: '0 auto 8px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                          {calculatedTotals.total}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                          Gesamt
                        </div>
                      </div>
                    </IonCol>
                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={starOutline}
                          style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            display: 'block',
                            margin: '0 auto 8px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                          {calculatedTotals.gottesdienst}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                          Gottesdienst
                        </div>
                      </div>
                    </IonCol>
                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={flashOutline}
                          style={{
                            fontSize: '1.5rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            display: 'block',
                            margin: '0 auto 8px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                          {calculatedTotals.gemeinde}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                          Gemeinde
                        </div>
                      </div>
                    </IonCol>
                  </IonRow>
                  {/* Zweite Reihe: Events, Bonus */}
                  <IonRow style={{ marginTop: '8px' }}>
                    <IonCol size="2" style={{ padding: '0 4px' }}></IonCol>
                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '12px 8px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={calendarOutline}
                          style={{
                            fontSize: '1.2rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            display: 'block',
                            margin: '0 auto 4px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                          {calculatedTotals.eventCount}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                          Events
                        </div>
                      </div>
                    </IonCol>
                    <IonCol size="4" style={{ padding: '0 4px' }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '12px',
                        padding: '12px 8px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <IonIcon
                          icon={giftOutline}
                          style={{
                            fontSize: '1.2rem',
                            color: 'rgba(255, 255, 255, 0.9)',
                            display: 'block',
                            margin: '0 auto 4px auto'
                          }}
                        />
                        <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                          {calculatedTotals.bonusCount}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                          Bonus
                        </div>
                      </div>
                    </IonCol>
                    <IonCol size="2" style={{ padding: '0 4px' }}></IonCol>
                  </IonRow>
                </IonGrid>
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
                            {/* Corner Badge für Punkte - Eselsohr oben rechts */}
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: categoryColor }}
                            >
                              +{entry.points}
                            </div>

                            {/* Zweites Eselsohr für Typ (Bonus/Event) - darunter */}
                            {typeBadgeColor && typeBadgeLabel && (
                              <div
                                className="app-corner-badge"
                                style={{
                                  backgroundColor: typeBadgeColor,
                                  top: '32px'
                                }}
                              >
                                {typeBadgeLabel}
                              </div>
                            )}

                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className={`app-icon-circle ${iconCircleClass}`}>
                                  <IonIcon icon={getCategoryIcon(entry.category)} />
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
