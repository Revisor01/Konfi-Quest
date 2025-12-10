import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonButtons,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonSegment,
  IonSegmentButton
} from '@ionic/react';
import {
  closeOutline,
  starOutline,
  flashOutline,
  giftOutline,
  calendarOutline
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
  source_type: 'activity' | 'bonus';
}

interface PointsTotals {
  gottesdienst: number;
  gemeinde: number;
  bonus: number;
  total: number;
}

const PointsHistoryModal: React.FC<PointsHistoryModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointEntry[]>([]);
  const [totals, setTotals] = useState<PointsTotals>({ gottesdienst: 0, gemeinde: 0, bonus: 0, total: 0 });
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.get('/konfi/points-history');
      setHistory(response.data.history || []);
      setTotals(response.data.totals || { gottesdienst: 0, gemeinde: 0, bonus: 0, total: 0 });
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
    switch (category) {
      case 'gottesdienst': return '#3b82f6';
      case 'gemeinde': return '#22c55e';
      default: return '#8b5cf6';
    }
  };

  const getCategoryIcon = (category: string, sourceType: string) => {
    if (sourceType === 'bonus') return giftOutline;
    switch (category) {
      case 'gottesdienst': return starOutline;
      case 'gemeinde': return flashOutline;
      default: return starOutline;
    }
  };

  const getCategoryLabel = (category: string, sourceType: string) => {
    if (sourceType === 'bonus') return 'Bonus';
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
      : history.filter(h => h.category === filter && h.source_type !== 'bonus');

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

      <IonContent style={{ '--padding-top': '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Totals Overview */}
            <div style={{ padding: '0 16px 16px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                    Gottesdienst
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                    {totals.gottesdienst}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                    Gemeinde
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                    {totals.gemeinde}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                    Bonus
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                    {totals.bonus}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
                    Gesamt
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                    {totals.total}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Segment */}
            <div style={{ padding: '0 16px 16px 16px' }}>
              <IonSegment value={filter} onIonChange={e => setFilter(e.detail.value as string)}>
                <IonSegmentButton value="all">
                  <IonLabel>Alle</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="gottesdienst">
                  <IonLabel>Gottesdienst</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="gemeinde">
                  <IonLabel>Gemeinde</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="bonus">
                  <IonLabel>Bonus</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            {/* History List */}
            <IonCard style={{ margin: '0 16px 16px 16px', borderRadius: '12px' }}>
              <IonCardContent style={{ padding: '8px' }}>
                {filteredHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    Noch keine Eintraege vorhanden
                  </div>
                ) : (
                  <IonList lines="none" style={{ background: 'transparent' }}>
                    {filteredHistory.map((entry, index) => (
                      <IonItem
                        key={`${entry.source_type}-${entry.id}`}
                        lines="none"
                        style={{
                          '--min-height': '64px',
                          '--background': index % 2 === 0 ? '#fbfbfb' : 'white',
                          '--border-radius': '8px',
                          margin: '4px 0',
                          borderRadius: '8px'
                        }}
                      >
                        <div slot="start" style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: getCategoryColor(entry.category, entry.source_type),
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '12px'
                        }}>
                          <IonIcon
                            icon={getCategoryIcon(entry.category, entry.source_type)}
                            style={{ fontSize: '1.2rem', color: 'white' }}
                          />
                        </div>
                        <IonLabel>
                          <h2 style={{ fontWeight: '500', fontSize: '0.95rem', margin: '0 0 4px 0' }}>
                            {entry.title}
                          </h2>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <IonChip style={{
                              height: '22px',
                              fontSize: '0.7rem',
                              margin: '0',
                              '--background': getCategoryColor(entry.category, entry.source_type) + '20',
                              '--color': getCategoryColor(entry.category, entry.source_type)
                            }}>
                              {getCategoryLabel(entry.category, entry.source_type)}
                            </IonChip>
                            <span style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IonIcon icon={calendarOutline} style={{ fontSize: '0.8rem' }} />
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          {entry.comment && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                              {entry.comment}
                            </p>
                          )}
                        </IonLabel>
                        <div slot="end" style={{
                          fontWeight: '700',
                          fontSize: '1.1rem',
                          color: getCategoryColor(entry.category, entry.source_type)
                        }}>
                          +{entry.points}
                        </div>
                      </IonItem>
                    ))}
                  </IonList>
                )}
              </IonCardContent>
            </IonCard>

            {/* Info Text */}
            <div style={{ padding: '0 16px 32px 16px', textAlign: 'center', color: '#999', fontSize: '0.8rem' }}>
              {filteredHistory.length} {filteredHistory.length === 1 ? 'Eintrag' : 'Eintraege'} gefunden
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PointsHistoryModal;
