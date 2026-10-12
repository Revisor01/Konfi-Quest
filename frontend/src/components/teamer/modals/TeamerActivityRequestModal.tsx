import React, { useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonTextarea,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonList,
  IonListHeader,
  IonAccordion,
  IonAccordionGroup,
  useIonAlert
} from '@ionic/react';
import {
  ICON_AKTENTASCHE,
  ICON_AUFKLAPPEN,
  ICON_BILD,
  ICON_HAKEN_GEFUELLT,
  ICON_KAMERA_GEFUELLT,
  ICON_KATEGORIE_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_SCHLIESSEN_GEFUELLT,
  ICON_STERN,
  ICON_TERMIN,
  ICON_TEXT,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import SendeAnzeige from '../../shared/SendeAnzeige';
import { useAktivitaetMelden } from '../../shared/useAktivitaetMelden';
import { tastaturKlick } from '../../../utils/tastatur';

interface TeamerActivityRequestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const TeamerActivityRequestModal: React.FC<TeamerActivityRequestModalProps> = ({
  onClose,
  onSuccess
}) => {
  const [presentAlert] = useIonAlert();
  // Laden, Foto, Prüfen und Melden (mit Warteschlange) stehen in
  // useAktivitaetMelden -- dieselbe Logik wie im Dialog der Web-Fassung
  // (shared/web/termine/WebAktivitaetMeldenDialog).
  const {
    activities,
    loading,
    formData,
    aendern,
    selectedActivity,
    photoPreview,
    handlePhotoSelect,
    removePhoto,
    handleSubmit,
    isSubmitting,
    uploadProgress,
    ohneFotoFrage,
  } = useAktivitaetMelden({
    rolle: 'team',
    onSuccess,
    fragOhneFoto: (weiter) => {
      presentAlert({
        header: 'Kein Foto',
        message: ohneFotoFrage,
        buttons: [
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Ohne Foto fortfahren', handler: () => weiter() }
        ]
      });
    },
  });
  const accordionGroupRef = useRef<HTMLIonAccordionGroupElement>(null);

  const filteredActivities = activities;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Neue Aktivität</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={ICON_SCHLIESSEN_GEFUELLT} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Aktivität absenden" className="app-modal-submit-btn app-modal-submit-btn--teamer" onClick={() => { void handleSubmit(); }} disabled={isSubmitting || loading}>
              <IonIcon icon={ICON_HAKEN_GEFUELLT} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {/* Dieselbe Anzeige wie beim Einreichen eines Challenge-Beitrags
            (27.09.2026): Prozent und Balken, bei 100 % "Wird verarbeitet…" —
            der Server verschlüsselt das Foto dann noch. Vorher ein Balken
            ohne Zahl. */}
        {isSubmitting && (
          <SendeAnzeige prozent={uploadProgress} was="Foto" farbe="var(--app-text-requests)" />
        )}
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Aktivität Sektion - iOS26 Pattern mit Akkordeon */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={ICON_STERN} />
            </div>
            <IonLabel>Aktivität wählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '0' }}>
              <IonAccordionGroup ref={accordionGroupRef}>
                <IonAccordion value="activity-picker" toggleIcon={ICON_AUFKLAPPEN} toggleIconSlot="end">
                  <IonItem slot="header" lines="none" style={{ '--padding-start': 'var(--app-abstand-basis)', '--inner-padding-end': 'var(--app-abstand-mittel)' }}>
                    {selectedActivity ? (
                      // Gewaehlt: schlichte Header-Zeile (Icon + Name + Kategorie)
                      // — keine Card-im-Header-Optik (sah gequetscht aus).
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mittel)', width: '100%', pointerEvents: 'none' }}>
                        <div className="app-icon-circle app-icon-circle--teamer" style={{ flexShrink: 0 }}>
                          <IonIcon icon={ICON_AKTENTASCHE} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {selectedActivity.name}
                          </div>
                          {selectedActivity.category_names && (
                            <div style={{ fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-system)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {selectedActivity.category_names}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <IonLabel>
                        <h3 className="app-list-item__subtitle" style={{ margin: '0' }}>
                          Aktivität auswählen
                        </h3>
                      </IonLabel>
                    )}
                  </IonItem>
                  <div slot="content" style={{ padding: '0 var(--app-abstand-mittel) var(--app-abstand-mittel)' }}>
                    {/* Aktivitäten Liste */}
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {filteredActivities.length === 0 ? (
                        <div className="app-info-box app-info-box--neutral" style={{ textAlign: 'center' }}>
                          Keine Aktivitäten gefunden
                        </div>
                      ) : (
                        filteredActivities.map(activity => {
                          const isSelected = formData.activity_id === activity.id.toString();
                          return (
                            <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                              key={activity.id}
                              className={`app-list-item app-list-item--teamer${isSelected ? ' app-list-item--selected' : ''}`}
                              onClick={() => {
                                aendern({ activity_id: activity.id.toString() });
                                if (accordionGroupRef.current) {
                                  accordionGroupRef.current.value = undefined;
                                }
                              }}
                              style={{ cursor: 'pointer', position: 'relative' }}
                            >
                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  <div className="app-icon-circle app-icon-circle--teamer">
                                    <IonIcon icon={ICON_AKTENTASCHE} />
                                  </div>
                                  <div className="app-list-item__content">
                                    <div className="app-list-item__title">{activity.name}</div>
                                    {activity.category_names && (
                                      <div className="app-list-item__meta">
                                        <span className="app-list-item__meta-item">
                                          <IonIcon icon={ICON_KATEGORIE_GEFUELLT} className="app-icon-color--category" />
                                          {activity.category_names}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Datum Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={ICON_TERMIN} />
            </div>
            <IonLabel>Datum wählen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonDatetimeButton datetime="date-picker" />
                <IonModal aria-label="Datum wählen" keepContentsMounted={true}>
                  <IonDatetime aria-label="Datum wählen"
                    id="date-picker"
                    value={formData.requested_date}
                    onIonChange={(e) => aendern({ requested_date: e.detail.value as string })}
                    presentation="date"
                    locale="de-DE"
                    max={new Date().toISOString().split('T')[0]}
                    firstDayOfWeek={1}
                  />
                </IonModal>
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Anmerkungen Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={ICON_TEXT} />
            </div>
            <IonLabel>Anmerkungen (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonTextarea aria-label="Anmerkungen (optional)"
                  value={formData.description}
                  onIonInput={(e) => aendern({ description: e.detail.value! })}
                  placeholder="Anmerkungen... (optional)"
                  autoGrow={true}
                  rows={2}
                />
              </IonItem>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Foto Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--requests">
              <IonIcon icon={ICON_BILD} />
            </div>
            <IonLabel>Foto als Nachweis (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
              <div role="presentation"
                onClick={handlePhotoSelect}
                style={{
                  padding: 'var(--app-abstand-basis)',
                  backgroundColor: photoPreview ? 'rgba(var(--app-color-teamer-rgb), 0.08)' : 'transparent',
                  borderRadius: 'var(--app-radius-knopf)',
                  border: photoPreview ? '1px solid rgba(var(--app-color-teamer-rgb), 0.2)' : '1px dashed var(--app-border-strong)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {photoPreview ? (
                  <div className="app-settings-item" style={{ justifyContent: 'space-between' }}>
                    <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-label="Anderes Foto wählen" className="app-settings-item" style={{ gap: 'var(--app-abstand-eng)' }}>
                      <IonIcon
                        icon={ICON_ZUSAGE_GEFUELLT}
                        className="app-icon-color--teamer"
                        style={{ fontSize: 'var(--app-text-untertitel)' }}
                      />
                      <span style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-teamer)' }}>
                        Foto ausgewählt
                      </span>
                    </div>
                    <IonButton aria-label="Foto entfernen"
                      fill="clear"
                      color="danger"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto();
                      }}
                    >
                      <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                    </IonButton>
                  </div>
                ) : (
                  <div role="button" tabIndex={0} onKeyDown={tastaturKlick} className="app-settings-item" style={{ justifyContent: 'center' }}>
                    <IonIcon
                      icon={ICON_KAMERA_GEFUELLT}
                      className="app-icon-color--teamer"
                      style={{ fontSize: 'var(--app-text-untertitel)' }}
                    />
                    <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)' }}>
                      Foto hinzufügen
                    </span>
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

      </IonContent>
    </IonPage>
  );
};

export default TeamerActivityRequestModal;
