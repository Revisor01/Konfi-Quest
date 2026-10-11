import React from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons, IonItem, IonLabel, IonList, IonListHeader, IonIcon, IonTextarea, IonCard, IonCardContent, IonSpinner, IonDatetime, IonDatetimeButton, IonModal, useIonAlert } from '@ionic/react';
import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_AKTION_GEFUELLT,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_HAKEN,
  ICON_KATEGORIE_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_TERMIN_GEFUELLT,
} from '../../shared/icons';
import type { PunkteartFlags } from '../../../utils/punktearten';
import { tastaturKlick } from '../../../utils/tastatur';
import { useAktivitaetEintragen } from './useAktivitaetEintragen';

// Laden, Vorbelegung, Speichern und Warteschlange stehen in
// useAktivitaetEintragen -- dieselbe Logik wie im Dialog der Web-Fassung
// (web/leitung/WebAktivitaetDialog).

interface ActivityModalProps {
  konfiId: number;
  /**
   * Punktearten-Schalter des Jahrgangs. Ohne die Angabe gelten beide Arten als
   * aktiv -- die Liste bot dann auch Aktivitaeten einer abgeschalteten Art an,
   * und das Zuweisen scheiterte erst beim Speichern am Server (Befund 24.08.2026:
   * damals wurde nur die Fehlermeldung ergaenzt, nicht die Ursache behoben).
   */
  punkteartFlags?: PunkteartFlags;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
  targetRole?: string;
}

const ActivityModal: React.FC<ActivityModalProps> = ({ konfiId, onClose, onSave, dismiss, targetRole, punkteartFlags }) => {
  const [presentAlert] = useIonAlert();

  const doClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const {
    aktivitaetenSortiert, selectedActivity, setSelectedActivity, comment, setComment,
    selectedDate, setSelectedDate, isSubmitting, isDirty, handleSave,
  } = useAktivitaetEintragen({ konfiId, targetRole, punkteartFlags, onSave, schliessen: doClose });

  const handleClose = () => {
    if (isDirty) {
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Verwerfen', role: 'destructive', handler: () => doClose() }
        ]
      });
    } else {
      doClose();
    }
  };

  // Farben für Aktivitäten (CSS-Variablen statt Hex)
  const gottesdienstColor = 'var(--app-color-gottesdienst)';
  const gemeindeColor = 'var(--app-color-gemeinde)';
  const isTeamer = targetRole === 'teamer';
  const teamerColor = 'var(--app-color-teamer)';
  const sectionClass = isTeamer ? 'teamer' : 'activities';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Aktivität hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={handleClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Aktivität speichern" onClick={handleSave} disabled={!selectedActivity || isSubmitting} className={`app-modal-submit-btn app-modal-submit-btn--${sectionClass}`}>
              {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Datum & Kommentar */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={ICON_TERMIN_GEFUELLT} />
            </div>
            <IonLabel>Datum & Kommentar</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              <p className="app-text-sub" style={{ marginBottom: 'var(--app-abstand-mini)' }}>Datum *</p>
              <IonDatetimeButton datetime="activity-date" style={{ justifyContent: 'flex-start' }} />
              <IonModal aria-label="Datum wählen" keepContentsMounted={true}>
                <IonDatetime aria-label="Datum" aria-required="true"
                  id="activity-date"
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

              <p className="app-text-sub" style={{ marginTop: 'var(--app-abstand-basis)', marginBottom: 'var(--app-abstand-mini)' }}>Kommentar (optional)</p>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea aria-label="Zusätzliche Informationen"
                    value={comment}
                    onIonInput={(e) => setComment(e.detail.value!)}
                    placeholder="Zusätzliche Informationen..."
                    rows={3}
                    disabled={isSubmitting}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Aktivität auswählen */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={ICON_AKTION_GEFUELLT} />
            </div>
            <IonLabel>Aktivität auswählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                {aktivitaetenSortiert
                  .map(activity => {
                    const isSelected = selectedActivity === activity.id;
                    // Bei Teamer einheitlich Pink, sonst Gottesdienst blau / Gemeinde dunkelgrün
                    const typeColor = isTeamer
                      ? teamerColor
                      : (activity.type === 'gottesdienst' ? gottesdienstColor : gemeindeColor);
                    // Selected-Background als rgba mit -rgb Variable
                    const typeColorRgb = isTeamer
                      ? 'var(--app-color-teamer-rgb)'
                      : (activity.type === 'gottesdienst' ? 'var(--app-color-gottesdienst-rgb)' : 'var(--app-color-gemeinde-rgb)');

                    return (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                        key={activity.id}
                        className={`app-list-item app-list-item--${sectionClass}`}
                        onClick={() => !isSubmitting && setSelectedActivity(activity.id)}
                        style={{
                          cursor: isSubmitting ? 'default' : 'pointer',
                          opacity: isSubmitting ? 0.6 : 1,
                          marginBottom: '0',
                          borderLeftColor: typeColor,
                          backgroundColor: isSelected ? `rgba(${typeColorRgb}, 0.08)` : undefined,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Corner Badge - nur bei Nicht-Teamer anzeigen */}
                        {targetRole !== 'teamer' && (
                          <div className="app-corner-badges">
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: typeColor }}
                            >
                              +{activity.points}P
                            </div>
                          </div>
                        )}

                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div
                              className="app-icon-circle app-icon-circle--lg"
                              style={{ backgroundColor: typeColor }}
                            >
                              {/* Teamer-Aktivitaeten haben keinen Typ — sonst
                                  bekaemen sie immer das Gemeinde-Icon.
                                  Gleiches Symbol wie in ActivitiesView. */}
                              <IonIcon icon={isTeamer ? ICON_ABZEICHEN_GEFUELLT : activity.type === 'gottesdienst' ? ICON_GOTTESDIENST_GEFUELLT : ICON_GEMEINDE_GEFUELLT} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title" style={{ paddingRight: isTeamer ? '0' : 'var(--app-freiraum-aktion-m)', whiteSpace: 'normal' }}>
                                {activity.name}
                              </div>
                              {activity.categories && activity.categories.length > 0 && (
                                <div className="app-list-item__meta">
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={ICON_KATEGORIE_GEFUELLT} style={{ color: 'var(--app-text-categories)' }} />
                                    {activity.categories.map(cat => cat.name).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityModal;
