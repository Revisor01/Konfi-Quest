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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader
} from '@ionic/react';
import {
  closeOutline,
  starOutline,
  flashOutline,
  giftOutline,
  calendarOutline,
  timeOutline
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
  const [filter, setFilter] = useState<string>('all');

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

  const getCategoryColor = (category: string, sourceType: string) => {
    if (sourceType === 'bonus') return '#f59e0b';
    if (sourceType === 'event') return '#dc2626';
    switch (category) {
      case 'gottesdienst': return '#3b82f6';
      case 'gemeinde': return '#059669';
      default: return '#8b5cf6';
    }
  };

  const getCategoryIcon = (category: string, sourceType: string) => {
    if (sourceType === 'bonus') return giftOutline;
    if (sourceType === 'event') return calendarOutline;
    switch (category) {
      case 'gottesdienst': return starOutline;
      case 'gemeinde': return flashOutline;
      default: return starOutline;
    }
  };

  const getCategoryLabel = (category: string, sourceType: string) => {
    const typeLabel = category === 'gottesdienst' ? 'GD' : category === 'gemeinde' ? 'Gem' : '';
    if (sourceType === 'bonus') return typeLabel ? `Bonus (${typeLabel})` : 'Bonus';
    if (sourceType === 'event') return typeLabel ? `Event (${typeLabel})` : 'Event';
    switch (category) {
      case 'gottesdienst': return 'Gottesdienst';
      case 'gemeinde': return 'Gemeinde';
      default: return category;
    }
  };

  const filteredHistory = filter === 'all'
    ? history
    : filter === 'bonus'
      ? history.filter(h => h.source_type === 'bonus')
      : filter === 'event'
        ? history.filter(h => h.source_type === 'event')
        : history.filter(h => h.category === filter && h.source_type !== 'bonus' && h.source_type !== 'event');

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
            {/* Header - Dashboard-Style */}
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              borderRadius: '24px',
              padding: '0',
              margin: '16px',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(139, 92, 246, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '200px',
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
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {/* Gesamt-Punkte groß */}
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '3.5rem',
                    fontWeight: '900',
                    color: 'white'
                  }}>
                    {totals.total}
                  </span>
                  <span style={{
                    fontSize: '1.2rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    Punkte
                  </span>
                </div>

                {/* Info-Badges */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={starOutline} style={{ fontSize: '0.85rem' }} />
                    {totals.gottesdienst} Gottesdienst
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={flashOutline} style={{ fontSize: '0.85rem' }} />
                    {totals.gemeinde} Gemeinde
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={calendarOutline} style={{ fontSize: '0.85rem' }} />
                    {history.filter(h => h.source_type === 'event').length} Events
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <IonIcon icon={giftOutline} style={{ fontSize: '0.85rem' }} />
                    {history.filter(h => h.source_type === 'bonus').length} Bonus
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Segment - iOS26 Pattern */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={timeOutline} />
                </div>
                <IonLabel>Filter</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '8px' }}>
                  <IonSegment value={filter} onIonChange={e => setFilter(e.detail.value as string)}>
                    <IonSegmentButton value="all">
                      <IonLabel>Alle</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="gottesdienst">
                      <IonLabel>GD</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="gemeinde">
                      <IonLabel>Gem</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="event">
                      <IonLabel>Event</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="bonus">
                      <IonLabel>Bonus</IonLabel>
                    </IonSegmentButton>
                  </IonSegment>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Verlauf Sektion - iOS26 Pattern */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={timeOutline} />
                </div>
                <IonLabel>Verlauf ({filteredHistory.length} {filteredHistory.length === 1 ? 'Eintrag' : 'Eintraege'})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: filteredHistory.length === 0 ? '16px' : '8px' }}>
                  {filteredHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                      Noch keine Eintraege vorhanden
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredHistory.map((entry) => {
                        const color = getCategoryColor(entry.category, entry.source_type);
                        const listItemClass = entry.category === 'gottesdienst' ? 'app-list-item--info' :
                                              entry.category === 'gemeinde' ? 'app-list-item--success' :
                                              entry.source_type === 'event' ? 'app-list-item--events' :
                                              entry.source_type === 'bonus' ? 'app-list-item--warning' : 'app-list-item--purple';
                        const iconCircleClass = entry.category === 'gottesdienst' ? 'app-icon-circle--info' :
                                                entry.category === 'gemeinde' ? 'app-icon-circle--success' :
                                                entry.source_type === 'event' ? 'app-icon-circle--events' :
                                                entry.source_type === 'bonus' ? 'app-icon-circle--warning' : 'app-icon-circle--purple';

                        return (
                          <div
                            key={`${entry.source_type}-${entry.id}`}
                            className={`app-list-item ${listItemClass}`}
                            style={{ position: 'relative', overflow: 'hidden' }}
                          >
                            {/* Corner Badge fuer Punkte - Eselsohr */}
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: color }}
                            >
                              +{entry.points}
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
                                      {getCategoryLabel(entry.category, entry.source_type)}
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
