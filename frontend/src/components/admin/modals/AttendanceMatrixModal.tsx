import React, { useState, useMemo } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonListHeader,
  IonLabel,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  checkmarkCircle,
  closeCircle,
  ellipseOutline,
  peopleOutline,
  calendarOutline
} from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import EmptyState from '../../shared/EmptyState';

interface Jahrgang {
  id: number;
  name: string;
}

interface KonfiRow {
  user_id: number;
  display_name: string;
  username?: string;
}

interface EventCol {
  id: number;
  name: string;
  event_date: string;
}

interface Booking {
  event_id: number;
  user_id: number;
  status: string | null;
  attendance_status: 'present' | 'absent' | null;
}

interface MatrixResponse {
  jahrgang: { id: number; name: string };
  konfis: KonfiRow[];
  events: EventCol[];
  bookings: Booking[];
}

interface AttendanceMatrixModalProps {
  jahrgaenge: Jahrgang[];
  initialJahrgangId?: number;
  onClose: () => void;
}

const formatShortDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
};

const AttendanceMatrixModal: React.FC<AttendanceMatrixModalProps> = ({
  jahrgaenge,
  initialJahrgangId,
  onClose
}) => {
  const { setError } = useApp();
  const [jahrgangId, setJahrgangId] = useState<number | null>(
    initialJahrgangId ?? (jahrgaenge.length > 0 ? jahrgaenge[0].id : null)
  );
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MatrixResponse | null>(null);

  const loadMatrix = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/jahrgaenge/${id}/attendance-matrix`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Fehler beim Laden der Anwesenheit');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (jahrgangId) loadMatrix(jahrgangId);
  }, [jahrgangId]);

  // Schneller Lookup: bookings nach (user, event) gruppieren
  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>();
    if (data) {
      data.bookings.forEach(b => map.set(`${b.user_id}-${b.event_id}`, b));
    }
    return map;
  }, [data]);

  const getCellStatus = (userId: number, eventId: number): 'present' | 'absent' | 'open' => {
    const b = bookingMap.get(`${userId}-${eventId}`);
    if (!b) return 'open';
    if (b.attendance_status === 'present') return 'present';
    if (b.attendance_status === 'absent') return 'absent';
    return 'open';
  };

  // Pro-Konfi-Statistik
  const konfiStats = useMemo(() => {
    if (!data) return new Map<number, { present: number; absent: number; open: number }>();
    const stats = new Map<number, { present: number; absent: number; open: number }>();
    data.konfis.forEach(k => {
      const counts = { present: 0, absent: 0, open: 0 };
      data.events.forEach(e => {
        const s = getCellStatus(k.user_id, e.id);
        counts[s]++;
      });
      stats.set(k.user_id, counts);
    });
    return stats;
  }, [data, bookingMap]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Anwesenheit</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        {/* Jahrgang-Selector */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={peopleOutline} />
            </div>
            <IonLabel>Jahrgang</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0 12px' }}>
              <IonSelect
                value={jahrgangId}
                placeholder="Jahrgang wählen"
                onIonChange={(e) => setJahrgangId(e.detail.value)}
                interface="popover"
                style={{ width: '100%' }}
              >
                {jahrgaenge.map(j => (
                  <IonSelectOption key={j.id} value={j.id}>{j.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Matrix */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : !data ? (
          <EmptyState
            icon={calendarOutline}
            title="Keine Daten"
            message="Wähle einen Jahrgang."
          />
        ) : data.events.length === 0 ? (
          <EmptyState
            icon={calendarOutline}
            title="Keine Pflichtevents"
            message="Für diesen Jahrgang gibt es keine Pflichtevents."
          />
        ) : data.konfis.length === 0 ? (
          <EmptyState
            icon={peopleOutline}
            title="Keine Konfis"
            message="Dieser Jahrgang hat noch keine Konfis."
          />
        ) : (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--events">
                <IonIcon icon={calendarOutline} />
              </div>
              <IonLabel>
                {data.events.length} Pflichtevent{data.events.length === 1 ? '' : 's'} · {data.konfis.length} Konfi{data.konfis.length === 1 ? '' : 's'}
              </IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '0', overflowX: 'auto' }}>
                <table className="attendance-matrix">
                  <thead>
                    <tr>
                      <th className="attendance-matrix__th-konfi">Konfi</th>
                      {data.events.map(e => (
                        <th key={e.id} className="attendance-matrix__th-event" title={e.name}>
                          <div className="attendance-matrix__event-label">
                            <div className="attendance-matrix__event-date">{formatShortDate(e.event_date)}</div>
                            <div className="attendance-matrix__event-name">{e.name}</div>
                          </div>
                        </th>
                      ))}
                      <th className="attendance-matrix__th-summary">Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.konfis.map(k => {
                      const stats = konfiStats.get(k.user_id) || { present: 0, absent: 0, open: 0 };
                      return (
                        <tr key={k.user_id}>
                          <td className="attendance-matrix__td-konfi">{k.display_name}</td>
                          {data.events.map(e => {
                            const s = getCellStatus(k.user_id, e.id);
                            return (
                              <td key={e.id} className="attendance-matrix__td-cell">
                                <span className={`attendance-matrix__dot attendance-matrix__dot--${s}`}>
                                  <IonIcon
                                    icon={s === 'present' ? checkmarkCircle : s === 'absent' ? closeCircle : ellipseOutline}
                                  />
                                </span>
                              </td>
                            );
                          })}
                          <td className="attendance-matrix__td-summary">
                            <span className="attendance-matrix__summary-text">
                              {stats.present}/{data.events.length}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Legende */}
        {data && data.events.length > 0 && data.konfis.length > 0 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonCard className="app-card">
              <IonCardContent>
                <div className="attendance-matrix__legend">
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--present">
                      <IonIcon icon={checkmarkCircle} />
                    </span>
                    <span>Anwesend</span>
                  </div>
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--absent">
                      <IonIcon icon={closeCircle} />
                    </span>
                    <span>Fehlt</span>
                  </div>
                  <div className="attendance-matrix__legend-item">
                    <span className="attendance-matrix__dot attendance-matrix__dot--open">
                      <IonIcon icon={ellipseOutline} />
                    </span>
                    <span>Offen</span>
                  </div>
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <div className="ion-padding-bottom" />
      </IonContent>
    </IonPage>
  );
};

export default AttendanceMatrixModal;
