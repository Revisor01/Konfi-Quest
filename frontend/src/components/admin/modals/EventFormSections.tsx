import React from 'react';
import {
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonList,
  IonListHeader,
  IonToggle,
  IonCard,
  IonCardContent,
  IonButton
} from '@ionic/react';
import {
  create, people, shieldCheckmark, scanOutline, copy,
  removeOutline, addOutline
} from 'ionicons/icons';
import { Category, Jahrgang } from '../../../types/event';

// ---- Shared form data type ----

export interface EventFormData {
  name: string;
  description: string;
  event_date: string;
  event_end_time: string;
  location: string;
  points: number;
  point_type: 'gottesdienst' | 'gemeinde';
  category_ids: number[];
  jahrgang_ids: number[];
  type: string;
  max_participants: number;
  registration_opens_at: string;
  registration_closes_at: string;
  has_timeslots: boolean;
  waitlist_enabled: boolean;
  max_waitlist_size: number;
  is_series: boolean;
  series_count: number;
  series_interval: string;
  mandatory: boolean;
  bring_items: string;
  checkin_window: number;
}

// ---- BasicInfoSection ----

interface BasicInfoSectionProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  loading: boolean;
}

export const BasicInfoSection = React.memo<BasicInfoSectionProps>(({
  formData, setFormData, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={create} />
      </div>
      <IonLabel>Event Grunddaten</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
    <IonCardContent>
      <IonList>
        <IonItem lines="inset">
          <IonLabel position="stacked">Event Name *</IonLabel>
          <IonInput
            value={formData.name}
            onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
            placeholder="z.B. Konfirmandenausflug"
            disabled={loading}
            clearInput={true}
          />
        </IonItem>
        <IonItem lines="inset">
          <IonLabel position="stacked">Beschreibung</IonLabel>
          <IonTextarea
            value={formData.description}
            onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
            placeholder="Beschreibung des Events..."
            rows={3}
            disabled={loading}
          />
        </IonItem>
        <IonItem lines="none">
          <IonLabel position="stacked">Ort</IonLabel>
          <IonInput
            value={formData.location}
            onIonInput={(e) => setFormData({ ...formData, location: e.detail.value! })}
            placeholder="z.B. Gemeindehaus"
            disabled={loading}
            clearInput={true}
          />
        </IonItem>
      </IonList>
    </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- MandatorySection ----

interface MandatorySectionProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  teamerAccess: string;
  setTeamerAccess: (value: 'normal' | 'teamer_needed' | 'teamer_only') => void;
  loading: boolean;
}

export const MandatorySection = React.memo<MandatorySectionProps>(({
  formData, setFormData, teamerAccess, setTeamerAccess, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={shieldCheckmark} />
      </div>
      <IonLabel>Pflicht-Event</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
    <IonCardContent>
      <IonList>
        <IonItem lines="inset">
          <IonLabel>Pflicht-Event</IonLabel>
          <IonToggle
            slot="end"
            checked={formData.mandatory}
            onIonChange={(e) => setFormData({ ...formData, mandatory: e.detail.checked })}
            disabled={loading}
          />
        </IonItem>
        <IonItem lines="inset">
          <IonLabel position="stacked">Was mitbringen (optional)</IonLabel>
          <IonTextarea
            value={formData.bring_items}
            onIonInput={(e) => setFormData({ ...formData, bring_items: e.detail.value || '' })}
            placeholder="z.B. Bibel, Stift, Block"
            rows={2}
            disabled={loading}
          />
        </IonItem>
        <IonItem lines="none">
          <IonSelect
            label="Teamer-Zugang"
            value={teamerAccess}
            onIonChange={(e) => setTeamerAccess(e.detail.value)}
            disabled={loading}
          >
            <IonSelectOption value="normal">Nur Konfis</IonSelectOption>
            <IonSelectOption value="teamer_needed">Teamer:innen gesucht</IonSelectOption>
            <IonSelectOption value="teamer_only">Nur Teamer:innen</IonSelectOption>
          </IonSelect>
        </IonItem>
      </IonList>
    </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- CheckinSection ----

interface CheckinSectionProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  loading: boolean;
}

export const CheckinSection = React.memo<CheckinSectionProps>(({
  formData, setFormData, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={scanOutline} />
      </div>
      <IonLabel>QR Check-in</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
    <IonCardContent>
      <IonList>
        <IonItem lines="none">
          <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Check-in-Fenster (Minuten)</IonLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <IonButton
              fill="outline" size="small"
              disabled={loading || formData.checkin_window <= 5}
              onClick={() => setFormData({ ...formData, checkin_window: Math.max(5, formData.checkin_window - 5) })}
              style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
            >
              <IonIcon icon={removeOutline} />
            </IonButton>
            <IonInput
              type="text" inputMode="numeric"
              value={formData.checkin_window.toString()}
              onIonInput={(e) => {
                const value = e.detail.value!;
                if (value === '') { setFormData({ ...formData, checkin_window: 30 }); }
                else {
                  const num = parseInt(value);
                  if (!isNaN(num) && num >= 5 && num <= 120) setFormData({ ...formData, checkin_window: num });
                }
              }}
              placeholder="30" disabled={loading}
              style={{ textAlign: 'center', flex: 1 }}
            />
            <IonButton
              fill="outline" size="small"
              disabled={loading || formData.checkin_window >= 120}
              onClick={() => setFormData({ ...formData, checkin_window: Math.min(120, formData.checkin_window + 5) })}
              style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
            >
              <IonIcon icon={addOutline} />
            </IonButton>
          </div>
        </IonItem>
        <p style={{ fontSize: '0.8rem', color: '#888', margin: '4px 16px 8px 16px', lineHeight: '1.4' }}>
          QR-Code Check-in ist {formData.checkin_window} Min. vor bis {formData.checkin_window} Min. nach Event-Start möglich
        </p>
      </IonList>
    </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- PointsParticipantsSection ----

interface PointsParticipantsSectionProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  loading: boolean;
}

export const PointsParticipantsSection = React.memo<PointsParticipantsSectionProps>(({
  formData, setFormData, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={people} />
      </div>
      <IonLabel>Punkte{!formData.has_timeslots ? ' & Teilnehmer' : ''}</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
    <IonCardContent>
      <IonList>
        {/* Max. Teilnehmer - nur anzeigen wenn KEINE Zeitfenster aktiv */}
        {!formData.has_timeslots && (
          <>
            <IonItem lines="none">
              <IonLabel>Unbegrenzte Teilnehmer</IonLabel>
              <IonToggle
                slot="end"
                checked={formData.max_participants === 0}
                onIonChange={(e) => setFormData({ ...formData, max_participants: e.detail.checked ? 0 : 5 })}
                disabled={loading}
                style={{ '--track-background-checked': '#dc2626' }}
              />
            </IonItem>
            {formData.max_participants !== 0 && (
              <IonItem lines="none">
                <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Max. Teilnehmer</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <IonButton fill="outline" size="small"
                    disabled={loading || formData.max_participants <= 1}
                    onClick={() => setFormData({ ...formData, max_participants: Math.max(1, formData.max_participants - 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
                    <IonIcon icon={removeOutline} />
                  </IonButton>
                  <IonInput type="text" inputMode="numeric"
                    value={formData.max_participants.toString()}
                    onIonInput={(e) => {
                      const value = e.detail.value!;
                      if (value === '') setFormData({ ...formData, max_participants: 1 });
                      else { const num = parseInt(value); if (!isNaN(num) && num >= 1 && num <= 999) setFormData({ ...formData, max_participants: num }); }
                    }}
                    placeholder="5" disabled={loading} style={{ textAlign: 'center', flex: 1 }} />
                  <IonButton fill="outline" size="small"
                    disabled={loading || formData.max_participants >= 999}
                    onClick={() => setFormData({ ...formData, max_participants: Math.min(999, formData.max_participants + 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
                    <IonIcon icon={addOutline} />
                  </IonButton>
                </div>
              </IonItem>
            )}
          </>
        )}

        {/* Punkte mit Stepper */}
        <IonItem lines="none">
          <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Punkte</IonLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <IonButton fill="outline" size="small"
              disabled={loading || formData.points <= 0}
              onClick={() => setFormData({ ...formData, points: Math.max(0, formData.points - 1) })}
              style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
              <IonIcon icon={removeOutline} />
            </IonButton>
            <IonInput type="text" inputMode="numeric"
              value={formData.points.toString()}
              onIonInput={(e) => {
                const value = e.detail.value!;
                if (value === '') setFormData({ ...formData, points: 0 });
                else { const num = parseInt(value); if (!isNaN(num) && num >= 0 && num <= 999) setFormData({ ...formData, points: num }); }
              }}
              placeholder="0" disabled={loading} style={{ textAlign: 'center', flex: 1 }} />
            <IonButton fill="outline" size="small"
              disabled={loading || formData.points >= 999}
              onClick={() => setFormData({ ...formData, points: Math.min(999, formData.points + 1) })}
              style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
              <IonIcon icon={addOutline} />
            </IonButton>
          </div>
        </IonItem>

        <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px', paddingTop: '16px' }}>
          <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Typ *</IonLabel>
        </IonItem>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="app-list-item"
            onClick={() => !loading && setFormData({ ...formData, point_type: 'gemeinde' })}
            style={{
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0',
              borderLeftColor: '#059669',
              backgroundColor: formData.point_type === 'gemeinde' ? 'rgba(5, 150, 105, 0.1)' : undefined
            }}>
            <span style={{ fontWeight: '500', color: '#333' }}>Gemeinde</span>
          </div>
          <div className="app-list-item"
            onClick={() => !loading && setFormData({ ...formData, point_type: 'gottesdienst' })}
            style={{
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0',
              borderLeftColor: '#3b82f6',
              backgroundColor: formData.point_type === 'gottesdienst' ? 'rgba(59, 130, 246, 0.1)' : undefined
            }}>
            <span style={{ fontWeight: '500', color: '#333' }}>Gottesdienst</span>
          </div>
        </div>
      </IonList>
    </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- CategoriesTargetSection ----

interface CategoriesTargetSectionProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  categories: Category[];
  jahrgaenge: Jahrgang[];
  teamerAccess: string;
  loading: boolean;
}

export const CategoriesTargetSection = React.memo<CategoriesTargetSectionProps>(({
  formData, setFormData, categories, jahrgaenge, teamerAccess, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={people} />
      </div>
      <IonLabel>Kategorien & Zielgruppe</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
    <IonCardContent>
      <IonList>
        {categories.length > 0 ? (
          <>
            <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px' }}>
              <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>
                Kategorien (mehrere möglich)
                {formData.category_ids.length > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#0ea5e9', fontWeight: 'normal' }}>
                    ({formData.category_ids.length} ausgewählt)
                  </span>
                )}
              </IonLabel>
            </IonItem>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((category) => {
                const isSelected = formData.category_ids.includes(category.id);
                return (
                  <div key={category.id} className="app-list-item app-list-item--categories"
                    onClick={() => {
                      if (!loading) {
                        setFormData(prev => ({
                          ...prev,
                          category_ids: prev.category_ids.includes(category.id)
                            ? prev.category_ids.filter(id => id !== category.id)
                            : [...prev.category_ids, category.id]
                        }));
                      }
                    }}
                    style={{
                      cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0',
                      background: isSelected ? 'rgba(14, 165, 233, 0.08)' : undefined
                    }}>
                    <span style={{ fontWeight: '500', color: '#333' }}>{category.name}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <IonItem lines="none">
            <IonLabel color="medium"><p>Keine Kategorien verfügbar</p></IonLabel>
          </IonItem>
        )}

        {teamerAccess !== 'teamer_only' && (<>
        <IonItem lines="none" style={{ '--background': 'transparent', paddingBottom: '8px', paddingTop: '16px' }}>
          <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: formData.mandatory && formData.jahrgang_ids.length === 0 ? '#dc3545' : '#666' }}>
            Jahrgänge (mehrere möglich) *{formData.mandatory && formData.jahrgang_ids.length === 0 ? ' (Pflicht bei Pflicht-Events)' : ''}
            {formData.jahrgang_ids.length > 0 && (
              <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 'normal' }}>
                ({formData.jahrgang_ids.length} ausgewählt)
              </span>
            )}
          </IonLabel>
        </IonItem>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {jahrgaenge.map((jahrgang) => {
            const isSelected = formData.jahrgang_ids.includes(jahrgang.id);
            return (
              <div key={jahrgang.id} className="app-list-item app-list-item--jahrgang"
                onClick={() => {
                  if (!loading) {
                    setFormData(prev => ({
                      ...prev,
                      jahrgang_ids: prev.jahrgang_ids.includes(jahrgang.id)
                        ? prev.jahrgang_ids.filter(id => id !== jahrgang.id)
                        : [...prev.jahrgang_ids, jahrgang.id]
                    }));
                  }
                }}
                style={{
                  cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0',
                  background: isSelected ? 'rgba(139, 92, 246, 0.08)' : undefined
                }}>
                <span style={{ fontWeight: '500', color: '#333' }}>{jahrgang.name}</span>
              </div>
            );
          })}
        </div>
        </>)}
      </IonList>
    </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- WaitlistSection ----

interface WaitlistSectionProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  loading: boolean;
}

export const WaitlistSection = React.memo<WaitlistSectionProps>(({
  formData, setFormData, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={people} />
      </div>
      <IonLabel>Warteliste</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
    <IonCardContent>
      <IonList>
        <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: formData.waitlist_enabled ? '12px' : '0' }}>
          <IonLabel>Warteliste aktivieren</IonLabel>
          <IonToggle
            slot="end"
            checked={formData.waitlist_enabled}
            onIonChange={(e) => setFormData({ ...formData, waitlist_enabled: e.detail.checked })}
            disabled={loading}
          />
        </IonItem>
        {formData.waitlist_enabled && (
          <IonItem lines="none">
            <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Max. Wartelisten-Plätze</IonLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <IonButton fill="outline" size="small"
                disabled={loading || formData.max_waitlist_size <= 0}
                onClick={() => setFormData({ ...formData, max_waitlist_size: Math.max(0, formData.max_waitlist_size - 1) })}
                style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
                <IonIcon icon={removeOutline} />
              </IonButton>
              <IonInput type="text" inputMode="numeric"
                value={formData.max_waitlist_size.toString()}
                onIonInput={(e) => {
                  const value = e.detail.value!;
                  if (value === '') setFormData({ ...formData, max_waitlist_size: 0 });
                  else { const num = parseInt(value); if (!isNaN(num) && num >= 0 && num <= 999) setFormData({ ...formData, max_waitlist_size: num }); }
                }}
                placeholder="10" disabled={loading} style={{ textAlign: 'center', flex: 1 }} />
              <IonButton fill="outline" size="small"
                disabled={loading || formData.max_waitlist_size >= 999}
                onClick={() => setFormData({ ...formData, max_waitlist_size: Math.min(999, formData.max_waitlist_size + 1) })}
                style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
                <IonIcon icon={addOutline} />
              </IonButton>
            </div>
          </IonItem>
        )}
      </IonList>
    </IonCardContent>
    </IonCard>
  </IonList>
));

// ---- SeriesSection ----

interface SeriesSectionProps {
  formData: EventFormData;
  setFormData: (data: EventFormData) => void;
  loading: boolean;
}

export const SeriesSection = React.memo<SeriesSectionProps>(({
  formData, setFormData, loading
}) => (
  <IonList inset={true} className="app-modal-section">
    <IonListHeader>
      <div className="app-section-icon app-section-icon--events">
        <IonIcon icon={copy} />
      </div>
      <IonLabel>Event-Serie (optional)</IonLabel>
    </IonListHeader>
    <IonCard className="app-card">
      <IonCardContent>
        <IonList>
          <IonItem lines="none">
            <IonLabel>Als Serie erstellen</IonLabel>
            <IonToggle
              slot="end"
              checked={formData.is_series}
              onIonChange={(e) => setFormData({ ...formData, is_series: e.detail.checked })}
              disabled={loading}
            />
          </IonItem>
          {formData.is_series && (
            <>
              <IonItem lines="none">
                <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Anzahl Events</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <IonButton fill="outline" size="small"
                    disabled={loading || formData.series_count <= 2}
                    onClick={() => setFormData({ ...formData, series_count: Math.max(2, formData.series_count - 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
                    <IonIcon icon={removeOutline} />
                  </IonButton>
                  <IonInput type="text" inputMode="numeric"
                    value={formData.series_count.toString()}
                    onIonInput={(e) => {
                      const value = e.detail.value!;
                      if (value === '') setFormData({ ...formData, series_count: 2 });
                      else { const num = parseInt(value); if (!isNaN(num) && num >= 2 && num <= 52) setFormData({ ...formData, series_count: num }); }
                    }}
                    placeholder="4" disabled={loading} style={{ textAlign: 'center', flex: 1 }} />
                  <IonButton fill="outline" size="small"
                    disabled={loading || formData.series_count >= 52}
                    onClick={() => setFormData({ ...formData, series_count: Math.min(52, formData.series_count + 1) })}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}>
                    <IonIcon icon={addOutline} />
                  </IonButton>
                </div>
              </IonItem>
              <IonItem lines="none">
                <IonLabel position="stacked">Intervall</IonLabel>
                <IonSelect
                  value={formData.series_interval}
                  onIonChange={(e) => setFormData({ ...formData, series_interval: e.detail.value })}
                  placeholder="Intervall wählen"
                  disabled={loading}
                  interface="action-sheet"
                  interfaceOptions={{ header: 'Intervall auswählen' }}
                >
                  <IonSelectOption value="day">Täglich</IonSelectOption>
                  <IonSelectOption value="week">Wöchentlich</IonSelectOption>
                  <IonSelectOption value="2weeks">Alle 2 Wochen</IonSelectOption>
                  <IonSelectOption value="month">Monatlich</IonSelectOption>
                </IonSelect>
              </IonItem>
            </>
          )}
          {!formData.is_series && (
            <IonItem lines="none" style={{ '--background': 'transparent', opacity: 0.6 }}>
              <IonLabel color="medium"><p>Einzelnes Event</p></IonLabel>
            </IonItem>
          )}
        </IonList>
      </IonCardContent>
    </IonCard>
  </IonList>
));
