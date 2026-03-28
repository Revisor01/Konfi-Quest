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
import { SectionHeader } from '../../shared';

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

  // Punkte-Summen nach Quelle aus gefilterter History berechnen
  const eventPoints = filteredHistory.filter(h => h.source_type === 'event').reduce((sum, h) => sum + h.points, 0);
  const activityPoints = filteredHistory.filter(h => h.source_type === 'activity').reduce((sum, h) => sum + h.points, 0);
  const bonusPoints = filteredHistory.filter(h => h.source_type === 'bonus').reduce((sum, h) => sum + h.points, 0);
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
            <SectionHeader
              title="Deine Punkte"
              subtitle="Übersicht aller gesammelten Punkte"
              icon={trophyOutline}
              preset="konfis"
              stats={[
                ...(showBothTypes ? [{ value: filteredTotals.total, label: 'GESAMT' }] : []),
                ...(gottesdienstEnabled ? [{ value: filteredTotals.gottesdienst, label: 'GD' }] : []),
                ...(gemeindeEnabled ? [{ value: filteredTotals.gemeinde, label: 'GEMEINDE' }] : []),
                { value: eventPoints, label: 'EVENTS' },
                { value: activityPoints, label: 'AKTIONEN' },
                { value: bonusPoints, label: 'BONUS' }
              ]}
            />

            {/* Verlauf Sektion - iOS26 Pattern */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={timeOutline} />
                </div>
                <IonLabel>Verlauf ({filteredHistory.length} {filteredHistory.length === 1 ? 'Eintrag' : 'Einträge'})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: filteredHistory.length === 0 ? '16px' : '12px' }}>
                  {filteredHistory.length === 0 ? (
                    <div className="app-info-box app-info-box--neutral" style={{ textAlign: 'center' }}>
                      Noch keine Einträge vorhanden
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                            <div className="app-corner-badges">
                              {/* Typ-Badge (Bonus/Event) */}
                              {typeBadgeColor && typeBadgeLabel && (
                                <>
                                  <div className="app-corner-badge" style={{ backgroundColor: typeBadgeColor }}>
                                    {typeBadgeLabel}
                                  </div>
                                  <div className="app-corner-badges__separator" />
                                </>
                              )}
                              {/* Punkte-Badge */}
                              <div className="app-corner-badge" style={{ backgroundColor: categoryColor }}>
                                +{entry.points}P
                              </div>
                            </div>

                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className={`app-icon-circle ${iconCircleClass}`}>
                                  <IonIcon icon={getCategoryIcon(entry.category, entry.source_type)} />
                                </div>
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title" style={{ paddingRight: typeBadgeColor ? '120px' : '70px' }}>{entry.title}</div>
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
