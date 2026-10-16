import React from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonIcon, IonSpinner, IonList, IonListHeader, IonCard, IonCardContent, IonRange, useIonAlert } from '@ionic/react';
import {
  ICON_BEARBEITEN_GEFUELLT,
  ICON_GRUPPE,
  ICON_HAKEN,
  ICON_KATEGORIE_GEFUELLT,
  ICON_SCHLIESSEN,
} from '../../shared/icons';
import { tastaturKlick } from '../../../utils/tastatur';
import { TEAM_OHNE_PUNKTE, useAktivitaetKatalogFormular, type KatalogAktivitaet, type KatalogZielgruppe } from '../useAktivitaetKatalogFormular';

// Eine Aktivität des Katalogs anlegen oder bearbeiten -- das Modal der App.
// Laden, Vorbelegung, Zielgruppe und Speichern stehen seit 15.10.2026 in
// useAktivitaetKatalogFormular; der Browser ab 992 px zeigt dieselbe Logik im
// Dialog web/leitung/WebAktivitaetKatalogDialog (Simon, 15.10.2026).

interface ActivityManagementModalProps {
  activity?: KatalogAktivitaet | null;
  activityId?: number | null;
  targetRole?: KatalogZielgruppe;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const ActivityManagementModal: React.FC<ActivityManagementModalProps> = ({
  activity,
  activityId,
  targetRole = 'konfi',
  onClose,
  onSuccess,
  dismiss
}) => {
  const {
    formData,
    aendern,
    waehleZielgruppe,
    kategorieUmschalten,
    categories,
    currentActivity,
    initializing,
    loading,
    isSubmitting,
    isDirty,
    isFormValid,
    handleSubmit,
  } = useAktivitaetKatalogFormular({ activity, activityId, targetRole, onSuccess });
  const [presentAlert] = useIonAlert();

  const doClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {currentActivity ? 'Aktivität bearbeiten' : 'Neue Aktivität'}
          </IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen"
              onClick={handleClose}
              disabled={loading}
              className="app-modal-close-btn"
            >
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Aktivität speichern"
              onClick={handleSubmit}
              disabled={!isFormValid || loading || isSubmitting}
              className="app-modal-submit-btn app-modal-submit-btn--activities"
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={ICON_HAKEN} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* SEKTION: Zielgruppe (nur bei neuer Aktivität) */}
        {!currentActivity && (
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={ICON_GRUPPE} />
            </div>
            <IonLabel>Zielgruppe</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                  className="app-list-item"
                  onClick={() => waehleZielgruppe('konfi')}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: 'var(--app-color-success-strong)',
                    background: formData.target_role === 'konfi' ? 'rgba(var(--app-color-success-strong-rgb), 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>Konfis</span>
                </div>
                <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                  className="app-list-item"
                  onClick={() => waehleZielgruppe('teamer')}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: 'var(--app-color-success-strong)',
                    background: formData.target_role === 'teamer' ? 'rgba(var(--app-color-success-strong-rgb), 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>Team</span>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
        )}

        {/* SEKTION: Grunddaten */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={ICON_BEARBEITEN_GEFUELLT} />
            </div>
            <IonLabel>Grunddaten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput aria-label="Name" aria-required="true"
                    value={formData.name}
                    onIonInput={(e) => aendern({ name: e.detail.value! })}
                    placeholder="z.B. Sonntagsgottesdienst"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>

                {formData.target_role === 'teamer' && (
                  <div style={{ padding: 'var(--app-abstand-eng) var(--app-abstand-basis)', color: 'var(--app-text-secondary)', fontSize: 'var(--app-text-sekundaer)' }}>
                    {TEAM_OHNE_PUNKTE}
                  </div>
                )}

                {formData.target_role !== 'teamer' && (
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked" style={{ marginBottom: 'var(--app-abstand-eng)' }}>Punkte * <span style={{ fontWeight: 'var(--app-schrift-fett)', color: 'var(--ion-color-primary)' }}>{formData.points}</span></IonLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', width: '100%' }}>
                    <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>1</span>
                    <IonRange aria-label="Punkte" aria-required="true"
                      min={1} max={5} step={1}
                  /* Rastermarken: Bei 1-5 Punkten sind die Stufen abzaehlbar,
                     das trifft man schneller als per Ziehen. `ticks` zeigt sie,
                     `snaps` laesst den Regler einrasten — Ionic zeichnet die
                     Marken nur, wenn beides gesetzt ist. Bei den groesseren
                     Reglern (Level 1-40, Abzeichen 1-26) bewusst NICHT: Dort
                     stuenden die Marken zu dicht. */
                  ticks={true} snaps={true}
                      pin={true} pinFormatter={(value: number) => `${value}`}
                      value={formData.points}
                      onIonChange={(e) => aendern({ points: e.detail.value as number })}
                      disabled={loading}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 'var(--app-text-klein)', color: 'var(--app-text-system)', minWidth: '24px', textAlign: 'center' }}>5</span>
                  </div>
                </IonItem>
                )}

              </IonList>
              {formData.target_role !== 'teamer' && (
              <>
                <div style={{ padding: 'var(--app-abstand-eng) 0 0' }}>
                  <span style={{ fontSize: 'var(--app-text-basis)', fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)', padding: '0 var(--app-abstand-basis)' }}>Typ *</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                  <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                    className="app-list-item"
                    onClick={() => !loading && aendern({ type: 'gottesdienst' })}
                    style={{
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0',
                      borderLeftColor: 'var(--app-color-gottesdienst)',
                      background: formData.type === 'gottesdienst' ? 'rgba(var(--app-color-gottesdienst-rgb), 0.1)' : undefined
                    }}
                  >
                    <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>Gottesdienst</span>
                  </div>
                  <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                    className="app-list-item"
                    onClick={() => !loading && aendern({ type: 'gemeinde' })}
                    style={{
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0',
                      borderLeftColor: 'var(--app-color-success-strong)',
                      background: formData.type === 'gemeinde' ? 'rgba(var(--app-color-gemeinde-rgb), 0.1)' : undefined
                    }}
                  >
                    <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>Gemeinde</span>
                  </div>
                </div>
              </>
              )}
            </IonCardContent>
        </IonCard>
      </IonList>

        {/* SEKTION: Kategorien */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={ICON_KATEGORIE_GEFUELLT} />
            </div>
            <IonLabel>Kategorien</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
            {initializing ? (
              <div style={{ padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)', textAlign: 'center' }}>
                <IonSpinner name="crescent" />
              </div>
            ) : categories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {categories.map((category, index) => {
                  const isChecked = formData.category_ids.includes(category.id);
                  return (
                    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
                      key={category.id}
                      className="app-list-item app-list-item--categories"
                      onClick={() => kategorieUmschalten(category.id)}
                      style={{
                        cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: index < categories.length - 1 ? 'var(--app-abstand-eng)' : '0',
                        background: isChecked ? 'rgba(var(--app-color-categories-rgb), 0.08)' : undefined
                      }}
                    >
                      <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-primary)' }}>{category.name}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: 'var(--app-abstand-riesig) var(--app-abstand-gross)',
                textAlign: 'center',
                color: 'var(--app-text-secondary)'
              }}>
                <IonIcon icon={ICON_KATEGORIE_GEFUELLT} style={{ fontSize: 'var(--app-anzeige-riesig)', opacity: 0.3, marginBottom: 'var(--app-abstand-basis)' }} />
                <p style={{ margin: '0', fontSize: 'var(--app-text-standard)' }}>Keine Kategorien verfügbar</p>
              </div>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>

      </IonContent>
    </IonPage>
  );
};

export default ActivityManagementModal;
