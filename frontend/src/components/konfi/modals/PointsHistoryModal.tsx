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
  IonLabel
} from '@ionic/react';
import {
  closeOutline,
  starOutline,
  flashOutline,
  giftOutline,
  calendarOutline,
  star,
  flash,
  gift,
  calendar
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
    if (isNaN(date.getTime())) return 'Ungueltig';
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
      case 'gemeinde': return '#22c55e';
      default: return '#8b5cf6';
    }
  };

  const getCategoryIcon = (category: string, sourceType: string) => {
    if (sourceType === 'bonus') return gift;
    if (sourceType === 'event') return calendar;
    switch (category) {
      case 'gottesdienst': return star;
      case 'gemeinde': return flash;
      default: return star;
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
          <IonTitle>Punkte-Historie</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            {/* Totals Card - im Dashboard-Style */}
            <div style={{
              background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
              borderRadius: '20px',
              padding: '0',
              marginBottom: '16px',
              boxShadow: '0 8px 32px rgba(91, 33, 182, 0.25)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '180px'
            }}>
              {/* Background Text */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '10px',
                zIndex: 1
              }}>
                <h2 style={{
                  fontSize: '2.8rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.08)',
                  margin: '0',
                  lineHeight: '0.9',
                  letterSpacing: '-2px'
                }}>
                  DEINE
                </h2>
                <h2 style={{
                  fontSize: '2.8rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.08)',
                  margin: '0',
                  lineHeight: '0.9',
                  letterSpacing: '-2px'
                }}>
                  PUNKTE
                </h2>
              </div>

              <div style={{ position: 'relative', zIndex: 2, padding: '60px 20px 20px 20px' }}>
                {/* Gesamt-Punkte gross */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    justifyContent: 'center'
                  }}>
                    <span style={{
                      fontSize: '3rem',
                      fontWeight: '900',
                      color: 'white'
                    }}>
                      {totals.total}
                    </span>
                    <span style={{
                      fontSize: '1.2rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Punkte
                    </span>
                  </div>
                </div>

                {/* Kategorie-Aufschluesselung */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 8px',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={star} style={{ fontSize: '1.2rem', color: 'white', marginBottom: '4px', display: 'block' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white' }}>{totals.gottesdienst}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.8)' }}>Gottesdienst</div>
                  </div>
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 8px',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={flash} style={{ fontSize: '1.2rem', color: 'white', marginBottom: '4px', display: 'block' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white' }}>{totals.gemeinde}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.8)' }}>Gemeinde</div>
                  </div>
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.3)',
                    borderRadius: '12px',
                    padding: '12px 8px',
                    textAlign: 'center'
                  }}>
                    <IonIcon icon={gift} style={{ fontSize: '1.2rem', color: 'white', marginBottom: '4px', display: 'block' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white' }}>{totals.bonus}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.8)' }}>Bonus</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Segment */}
            <div style={{ marginBottom: '16px' }}>
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
            </div>

            {/* History List - im Dashboard Card Style */}
            <div style={{
              background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
              borderRadius: '20px',
              padding: '0',
              boxShadow: '0 8px 32px rgba(31, 41, 55, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Background Text */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '10px',
                zIndex: 1
              }}>
                <h2 style={{
                  fontSize: '2.8rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.05)',
                  margin: '0',
                  lineHeight: '0.9',
                  letterSpacing: '-2px'
                }}>
                  VERLAUF
                </h2>
              </div>

              {/* Counter Badge oben rechts */}
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.7rem',
                color: 'white',
                fontWeight: '700',
                zIndex: 3
              }}>
                {filteredHistory.length} {filteredHistory.length === 1 ? 'EINTRAG' : 'EINTRAEGE'}
              </div>

              <div style={{ position: 'relative', zIndex: 2, padding: '50px 16px 16px 16px' }}>
                {filteredHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Noch keine Eintraege vorhanden
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredHistory.map((entry) => {
                      const color = getCategoryColor(entry.category, entry.source_type);
                      return (
                        <div
                          key={`${entry.source_type}-${entry.id}`}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            borderLeft: `4px solid ${color}`
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
                              color: 'white',
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
                                backgroundColor: `${color}30`,
                                color: color
                              }}>
                                {getCategoryLabel(entry.category, entry.source_type)}
                              </span>
                              <span style={{
                                fontSize: '0.75rem',
                                color: 'rgba(255, 255, 255, 0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <IonIcon icon={calendarOutline} style={{ fontSize: '0.75rem' }} />
                                {formatDate(entry.date)}
                              </span>
                            </div>
                            {entry.comment && (
                              <div style={{
                                marginTop: '4px',
                                fontSize: '0.75rem',
                                color: 'rgba(255, 255, 255, 0.5)',
                                fontStyle: 'italic'
                              }}>
                                {entry.comment}
                              </div>
                            )}
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
              </div>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PointsHistoryModal;
