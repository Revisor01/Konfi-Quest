// Das Modal der App für „Dein Konfispruch" (Konfis und Team). Die Logik --
// was zur Wahl steht, Prüfung, Aufruf, Messung, Meldungen -- steht in
// konfi/useKonfispruchWahl und gilt ebenso für den Dialog des Browsers
// (konfi/web/WebKonfispruchDialog).
import React from 'react';
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
  IonLabel,
  IonItem,
  IonInput,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
  IonText,
} from '@ionic/react';
import {
  ICON_BEARBEITEN,
  ICON_BUCH,
  ICON_HAKEN,
  ICON_HAKEN_GEFUELLT,
  ICON_OFFLINE,
  ICON_SCHLIESSEN,
} from '../../shared/icons';
import { tastaturKlick } from '../../../utils/tastatur';
import {
  EIGENER_SPRUCH_HINWEIS,
  SPRUCHLISTE_FEHLER,
  TRANSLATION_COPYRIGHT,
  TRANSLATION_KEYS,
  TRANSLATION_LABELS,
  useKonfispruchWahl,
  type CurrentKonfspruch,
  type KonfispruchModus,
  type Translation,
} from '../useKonfispruchWahl';

interface KonfispruchSelectModalProps {
  onClose: () => void;
  onSuccess: () => void;
  current?: CurrentKonfspruch | null;
  /** API-Prefix: '/konfi' (Default) oder '/teamer' — beide Seiten haben
   *  eigene, gleichförmige Endpunkte (GET .../konfsprueche, PATCH .../profile). */
  apiBasePath?: '/konfi' | '/teamer';
  /** Farbvariante des Speichern-Knopfs (Default: konfi). */
  variant?: 'konfi' | 'teamer';
}

const KonfispruchSelectModal: React.FC<KonfispruchSelectModalProps> = ({ onClose, onSuccess, current, apiBasePath = '/konfi', variant = 'konfi' }) => {
  const {
    isOnline, isSubmitting, mode, setMode, loading, loadError, sprueche, translation, setTranslation,
    selectedSpruchId, setSelectedSpruchId, freitext, setFreitext, freitextReferenz, setFreitextReferenz, speichern,
  } = useKonfispruchWahl({ current, apiBasePath, onErfolg: onSuccess });
  const handleSave = () => { void speichern(); };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dein Konfispruch</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Konfispruch speichern"
              className={`app-modal-submit-btn app-modal-submit-btn--${variant}`}
              onClick={handleSave}
              disabled={isSubmitting || !isOnline}
            >
              {!isOnline ? (
                <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</>
              ) : isSubmitting ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={ICON_HAKEN} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Modus-Umschaltung: Aus Liste / Eigener Spruch (ohne Icons -> einzeilig) */}
        <div className="app-segment-wrapper">
          <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as KonfispruchModus)}>
            <IonSegmentButton value="liste">
              <IonLabel>Aus Liste</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="freitext">
              <IonLabel>Eigener Spruch</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {mode === 'liste' ? (
          <>
            {/* Uebersetzungs-Tabs (nur im Listen-Modus) */}
            <div className="app-segment-wrapper">
              <IonSegment
                value={translation}
                onIonChange={(e) => setTranslation(e.detail.value as Translation)}
                scrollable={true}
              >
                {TRANSLATION_KEYS.map((key) => (
                  <IonSegmentButton key={key} value={key}>
                    <IonLabel>{TRANSLATION_LABELS[key]}</IonLabel>
                  </IonSegmentButton>
                ))}
              </IonSegment>
            </div>

            {/* Spruchliste — gleiches Muster wie die Bibelübersetzungs-Liste:
                Auswahl = lila Strich links + matt-lila Hintergrund + Häkchen-Corner-Badge,
                kein Icon pro Listenelement, kein Inline-Häkchen. */}
            <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
              <IonListHeader>
                <div className="app-section-icon app-section-icon--purple">
                  <IonIcon icon={ICON_BUCH} />
                </div>
                <IonLabel>Spruch wählen</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: loading || loadError || sprueche.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-weit)' }}>
                      <IonSpinner name="crescent" />
                    </div>
                  ) : loadError ? (
                    <div className="app-info-box app-info-box--neutral" style={{ textAlign: 'center' }}>
                      <IonText color="danger">
                        {SPRUCHLISTE_FEHLER}
                      </IonText>
                    </div>
                  ) : sprueche.length === 0 ? (
                    <div className="app-info-box app-info-box--neutral" style={{ textAlign: 'center' }}>
                      Es sind noch keine Sprüche hinterlegt
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {sprueche.map((spruch) => {
                        const text = spruch.uebersetzungen?.[translation] || '';
                        const isSelected = selectedSpruchId === spruch.id;
                        return (
                          <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                            key={spruch.id}
                            className={`app-list-item app-list-item--purple ${isSelected ? 'app-list-item--selected' : ''}`}
                            onClick={() => setSelectedSpruchId(spruch.id)}
                            style={{
                              cursor: 'pointer',
                              position: 'relative',
                              overflow: 'hidden',
                              background: isSelected ? 'rgba(var(--app-color-konfis-rgb), 0.08)' : undefined
                            }}
                          >
                            {isSelected && (
                              <div className="app-corner-badges">
                                <div
                                  className="app-corner-badge"
                                  style={{ backgroundColor: 'var(--app-color-konfis)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--app-abstand-mini) var(--app-abstand-eng)' }}
                                  title="Ausgewählt"
                                  role="img"
                                  aria-label="Ausgewählt"
                                >
                                  <IonIcon icon={ICON_HAKEN_GEFUELLT} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)' }} />
                                </div>
                              </div>
                            )}
                            <div className="app-list-item__row">
                              <div className="app-list-item__main">
                                <div className="app-list-item__content">
                                  <div className="app-list-item__title" style={{ paddingRight: isSelected ? 'var(--app-abstand-riesig)' : '0' }}>{spruch.reference}</div>
                                  <div className="app-list-item__subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>
                                    {text
                                      ? text
                                      : <IonText color="medium"><em>Text wird noch ergänzt</em></IonText>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{
                    marginTop: 'var(--app-abstand-mittel)',
                    paddingTop: 'var(--app-abstand-mittel)',
                    borderTop: '1px solid var(--app-border)',
                    fontSize: 'var(--app-text-meta)',
                    lineHeight: '1.35',
                    color: 'var(--ion-color-medium)'
                  }}>
                    {TRANSLATION_COPYRIGHT[translation]}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        ) : (
          <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--purple">
                <IonIcon icon={ICON_BEARBEITEN} />
              </div>
              <IonLabel>Eigener Spruch</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-info-box">
                <IonList style={{ background: 'transparent' }}>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Spruchtext</IonLabel>
                    <IonTextarea aria-label="Spruchtext"
                      value={freitext}
                      onIonInput={(e) => setFreitext(e.detail.value || '')}
                      placeholder="Gib deinen Konfirmationsspruch ein"
                      autoGrow={true}
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonLabel position="stacked">Stelle (z.B. Joh 3,16)</IonLabel>
                    <IonInput aria-label="Bibelstelle"
                      value={freitextReferenz}
                      onIonInput={(e) => setFreitextReferenz(e.detail.value || '')}
                      placeholder="Stellenangabe (Pflicht)"
                      disabled={isSubmitting}
                      clearInput={true}
                    />
                  </IonItem>
                </IonList>
              </IonCardContent>
            </IonCard>
            <IonCard className="app-card app-info-box--purple">
              <IonCardContent className="app-info-box">
                <p style={{ margin: 0 }}>
                  {EIGENER_SPRUCH_HINWEIS}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfispruchSelectModal;
