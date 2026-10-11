import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  IonListHeader,
  IonIcon,
  IonTextarea,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonRange,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
} from '@ionic/react';
import { ICON_BONUS_GEFUELLT, ICON_CHAT, ICON_HAKEN, ICON_SCHLIESSEN } from '../../shared/icons';
import { PUNKTEART_NAME, type PunkteartFlags } from '../../../utils/punktearten';
import { tastaturKlick } from '../../../utils/tastatur';
import { useBonusVergeben } from './useBonusVergeben';

// Vorbelegung, Prüfung, Speichern und Warteschlange stehen in
// useBonusVergeben -- dieselbe Logik wie im Dialog der Web-Fassung
// (web/leitung/WebBonusDialog).

interface BonusModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
  /**
   * Punktearten-Schalter des Jahrgangs, zu dem die Konfi gehoert. Ohne diese
   * Angabe gelten beide Arten als aktiv -- die Auswahl bot dann auch eine
   * abgeschaltete Art an, und das Speichern scheiterte am Server (400).
   */
  punkteartFlags?: PunkteartFlags;
}

const BonusModal: React.FC<BonusModalProps> = ({ konfiId, onClose, onSave, dismiss, punkteartFlags }) => {
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const {
    name, setName, points, setPoints, reason, setReason, type, setType, verfuegbareArten,
    selectedDate, setSelectedDate, isSubmitting, isValid, handleSave,
  } = useBonusVergeben({ konfiId, punkteartFlags, onSave, schliessen: handleClose });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Bonuspunkte hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={handleClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Bonuspunkte speichern" onClick={handleSave} disabled={!isValid || isSubmitting} className="app-modal-submit-btn app-modal-submit-btn--bonus">
              {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Bonuspunkt Detail */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--bonus">
              <IonIcon icon={ICON_BONUS_GEFUELLT} />
            </div>
            <IonLabel>Bonuspunkt Detail</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Bezeichnung *</IonLabel>
                  <IonInput aria-label="Bezeichnung" aria-required="true"
                    value={name}
                    onIonInput={(e) => setName(e.detail.value!)}
                    placeholder="z.B. Hilfe beim Aufräumen"
                    clearInput={true}
                    disabled={isSubmitting}
                  />
                </IonItem>

              </IonList>

              <p className="app-text-sub" style={{ marginTop: 'var(--app-abstand-basis)', marginBottom: 'var(--app-abstand-mini)' }}>Datum *</p>
              <IonDatetimeButton datetime="bonus-date" style={{ justifyContent: 'flex-start' }} />
              <IonModal aria-label="Datum wählen" keepContentsMounted={true}>
                <IonDatetime aria-label="Datum" aria-required="true"
                  id="bonus-date"
                  presentation="date"
                  firstDayOfWeek={1}
                  value={selectedDate}
                  onIonChange={(e) => {
                    const val = e.detail.value;
                    if (typeof val === 'string') {
                      setSelectedDate(val.split('T')[0]);
                    }
                  }}
                  locale="de-DE"
                />
              </IonModal>

              <p className="app-text-sub" style={{ marginTop: 'var(--app-abstand-basis)', marginBottom: 'var(--app-abstand-mini)' }}>
                Punkte * <span style={{ fontWeight: 'var(--app-schrift-fett)', color: 'var(--app-text-bonus)' }}>{points}</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', padding: '0 var(--app-abstand-eng)' }}>
                <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>1</span>
                <IonRange aria-label="Punkte" aria-required="true"
                  min={1} max={10} step={1}
                  pin={true} pinFormatter={(value: number) => `${value}`}
                  value={points}
                  onIonChange={(e) => setPoints(e.detail.value as number)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    '--bar-background': 'rgba(var(--app-color-bonus-rgb), 0.2)',
                    '--bar-background-active': 'var(--app-color-bonus)',
                    '--knob-background': 'var(--app-color-bonus)',
                    '--pin-background': 'var(--app-color-bonus)',
                  } as React.CSSProperties}
                />
                <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>10</span>
              </div>

              <div style={{ marginTop: 'var(--app-abstand-basis)', marginBottom: 'var(--app-abstand-eng)' }}>
                <span style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)' }}>Typ *</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                {verfuegbareArten.map((art) => {
                  // Farben wie bisher: Gemeinde gruen, Gottesdienst blau.
                  const rahmen = art === 'gemeinde' ? 'var(--app-color-gemeinde)' : 'var(--app-color-gottesdienst)';
                  const fuellung = art === 'gemeinde'
                    ? 'rgba(var(--app-color-success-strong-rgb), 0.1)'
                    : 'rgba(var(--app-color-gottesdienst-rgb), 0.1)';
                  return (
                    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                      key={art}
                      className="app-list-item"
                      onClick={() => !isSubmitting && setType(art)}
                      style={{
                        cursor: isSubmitting ? 'default' : 'pointer',
                        opacity: isSubmitting ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0',
                        borderLeftColor: rahmen,
                        backgroundColor: type === art ? fuellung : undefined
                      }}
                    >
                      <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>{PUNKTEART_NAME[art]}</span>
                    </div>
                  );
                })}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Begründung (optional) */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--bonus">
              <IonIcon icon={ICON_CHAT} />
            </div>
            <IonLabel>Begründung (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Begründung</IonLabel>
                  <IonTextarea aria-label="Begründung"
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value!)}
                    placeholder="Warum werden diese Bonuspunkte vergeben?"
                    rows={3}
                    disabled={isSubmitting}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default BonusModal;
