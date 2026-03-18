import React, { useState, useEffect, useMemo } from 'react';
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
  pointConfig?: {
    gottesdienst_enabled: boolean;
    gemeinde_enabled: boolean;
  };
  apiEndpoint?: string;
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
  total: number;
}

const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({ onClose, pointConfig, apiEndpoint }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointEntry[]>([]);
  const [totals, setTotals] = useState<PointsTotals>({ gottesdienst: 0, gemeinde: 0, total: 0 });

  // Enabled-Flags mit Fallback (Abwaertskompatibilitaet)
  const gottesdienstEnabled = pointConfig?.gottesdienst_enabled !== false;
  const gemeindeEnabled = pointConfig?.gemeinde_enabled !== false;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.get(apiEndpoint || '/konfi/points-history');
      setHistory(response.data.history || []);
      setTotals(response.data.totals || { gottesdienst: 0, gemeinde: 0, total: 0 });
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

  // Gefilterte Historie: deaktivierte Typen ausblenden
  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      if (entry.category === 'gottesdienst' && !gottesdienstEnabled) return false;
      if (entry.category === 'gemeinde' && !gemeindeEnabled) return false;
      return true;
    });
  }, [history, gottesdienstEnabled, gemeindeEnabled]);

  // Angepasste Totals: nur aktive Typen
  const filteredTotals = useMemo(() => {
    const godi = gottesdienstEnabled ? totals.gottesdienst : 0;
    const gem = gemeindeEnabled ? totals.gemeinde : 0;
    return {
      gottesdienst: godi,
      gemeinde: gem,
      total: godi + gem
    };
  }, [totals, gottesdienstEnabled, gemeindeEnabled]);

  // Farbe basierend auf category (gottesdienst=blau, gemeinde=grün)
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'gottesdienst': return '#3b82f6';
      case 'gemeinde': return '#059669';
      default: return '#5b21b6';
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

  // Event-, Aktivitaeten- und Bonus-Anzahl aus gefilterter History berechnen
  const eventCount = filteredHistory.filter(h => h.source_type === 'event').length;
  const activityCount = filteredHistory.filter(h => h.source_type === 'activity').length;
  const bonusCount = filteredHistory.filter(h => h.source_type === 'bonus').length;
  const showBothTypes = gottesdienstEnabled && gemeindeEnabled;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Punkte-Übersicht</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {loading ? (
          <div className="app-settings-item" style={{ justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Header - Kompakter Style wie BadgesView */}
            <div className="app-detail-header" style={{
              background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(91, 33, 182, 0.25)',
              minHeight: 'auto'
            }}>
              <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }} />
              <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)' }} />

              <div className="app-settings-item" style={{ marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                <div className="app-icon-circle app-icon-circle--lg" style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '14px' }}>
                  <IonIcon icon={trophyOutline} style={{ fontSize: '1.6rem', color: 'white' }} />
                </div>
                <div>
                  <h2 className="app-detail-header__title" style={{ fontSize: '1.4rem', fontWeight: '700' }}>Deine Punkte</h2>
                  <p className="app-detail-header__subtitle">Übersicht aller gesammelten Punkte</p>
                </div>
              </div>

              {/* Stats Boxen - 3x2 Grid */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Reihe 1: Punkte-Typ-Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: showBothTypes ? 'repeat(3, 1fr)' : '1fr', gap: '8px' }}>
                  {showBothTypes && (
                    <div className="app-detail-header__info-chip" style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{filteredTotals.total}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GESAMT</div>
                    </div>
                  )}
                  {gottesdienstEnabled && (
                    <div className="app-detail-header__info-chip" style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{filteredTotals.gottesdienst}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GOTTESDIENST</div>
                    </div>
                  )}
                  {gemeindeEnabled && (
                    <div className="app-detail-header__info-chip" style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{filteredTotals.gemeinde}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GEMEINDE</div>
                    </div>
                  )}
                </div>
                {/* Reihe 2: Quellen-Stats (immer 3 Spalten) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                  {[
                    { value: eventCount, label: 'EVENTS' },
                    { value: activityCount, label: 'AKTIVITAETEN' },
                    { value: bonusCount, label: 'BONUS' }
                  ].map((stat) => (
                    <div key={stat.label} className="app-detail-header__info-chip" style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{stat.value}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Verlauf Sektion - iOS26 Pattern */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={timeOutline} />
                </div>
                <IonLabel>Verlauf ({filteredHistory.length} {filteredHistory.length === 1 ? 'Eintrag' : 'Einträge'})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: filteredHistory.length === 0 ? '16px' : '8px' }}>
                  {filteredHistory.length === 0 ? (
                    <div className="app-info-box app-info-box--neutral" style={{ textAlign: 'center' }}>
                      Noch keine Einträge vorhanden
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredHistory.map((entry) => {
                        const categoryColor = getCategoryColor(entry.category);
                        const typeBadgeColor = getTypeBadgeColor(entry.source_type);
                        const typeBadgeLabel = getTypeBadgeLabel(entry.source_type);

                        // Farbe basiert auf category (blau/gruen)
                        const listItemClass = entry.category === 'gottesdienst' ? 'app-list-item--info' : 'app-list-item--activities';
                        const iconCircleClass = entry.category === 'gottesdienst' ? 'app-icon-circle--info' : 'app-icon-circle--activities';

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
                              {/* Typ-Badge (Bonus/Event) */}
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
                              {typeBadgeColor && (
                                <div style={{ width: '2px', background: 'white' }} />
                              )}
                              {/* Punkte-Badge */}
                              <div className="app-corner-badge" style={{ backgroundColor: categoryColor, position: 'static' }}>
                                +{entry.points}P
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
