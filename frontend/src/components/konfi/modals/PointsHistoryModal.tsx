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
    if (sourceType === 'bonus') return 'Bonus';
    if (sourceType === 'event') return 'Event';
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
            {/* Punkte-Übersicht Header - iOS26 Pattern */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={starOutline} />
                </div>
                <IonLabel>Gesamt-Punkte</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    justifyContent: 'center'
                  }}>
                    <span style={{
                      fontSize: '3rem',
                      fontWeight: '900',
                      color: '#8b5cf6'
                    }}>
                      {totals.total}
                    </span>
                    <span style={{
                      fontSize: '1.2rem',
                      color: '#666'
                    }}>
                      Punkte
                    </span>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Kategorie-Aufschlüsselung - iOS26 Pattern */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={flashOutline} />
                </div>
                <IonLabel>Aufschlüsselung</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <IonIcon icon={starOutline} style={{ fontSize: '1.4rem', color: '#3b82f6', marginBottom: '4px', display: 'block' }} />
                      <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#3b82f6' }}>{totals.gottesdienst}</div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>Gottesdienst</div>
                    </div>
                    <div style={{
                      background: 'rgba(5, 150, 105, 0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center',
                      border: '1px solid rgba(5, 150, 105, 0.2)'
                    }}>
                      <IonIcon icon={flashOutline} style={{ fontSize: '1.4rem', color: '#059669', marginBottom: '4px', display: 'block' }} />
                      <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#059669' }}>{totals.gemeinde}</div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>Gemeinde</div>
                    </div>
                    <div style={{
                      background: 'rgba(220, 38, 38, 0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center',
                      border: '1px solid rgba(220, 38, 38, 0.2)'
                    }}>
                      <IonIcon icon={calendarOutline} style={{ fontSize: '1.4rem', color: '#dc2626', marginBottom: '4px', display: 'block' }} />
                      <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#dc2626' }}>{totals.event}</div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>Event</div>
                    </div>
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center',
                      border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}>
                      <IonIcon icon={giftOutline} style={{ fontSize: '1.4rem', color: '#f59e0b', marginBottom: '4px', display: 'block' }} />
                      <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#f59e0b' }}>{totals.bonus}</div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>Bonus</div>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>

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
                <IonLabel>Verlauf ({filteredHistory.length} {filteredHistory.length === 1 ? 'Eintrag' : 'Einträge'})</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: filteredHistory.length === 0 ? '16px' : '8px' }}>
                  {filteredHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                      Noch keine Einträge vorhanden
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredHistory.map((entry) => {
                        const color = getCategoryColor(entry.category, entry.source_type);
                        return (
                          <div
                            key={`${entry.source_type}-${entry.id}`}
                            className="app-list-item"
                            style={{
                              borderLeftColor: color,
                              padding: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                          >
                            {/* Icon */}
                            <div style={{
                              width: '40px',
                              height: '40px',
                              backgroundColor: color,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={getCategoryIcon(entry.category, entry.source_type)}
                                style={{ fontSize: '1.2rem', color: 'white' }}
                              />
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                color: '#333',
                                marginBottom: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {entry.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  backgroundColor: `${color}20`,
                                  color: color
                                }}>
                                  {getCategoryLabel(entry.category, entry.source_type)}
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#666',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <IonIcon icon={calendarOutline} style={{ fontSize: '0.75rem' }} />
                                  {formatDate(entry.date)}
                                </span>
                              </div>
                            </div>

                            {/* Points */}
                            <div style={{
                              fontWeight: '700',
                              fontSize: '1.1rem',
                              color: color,
                              flexShrink: 0
                            }}>
                              +{entry.points}
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
