import React from 'react';
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
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonTextarea,
  IonInput,
  IonSpinner
} from '@ionic/react';
import {
  ICON_GALERIE,
  ICON_HAKEN_GEFUELLT,
  ICON_KAMERA_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_MIKROFON_GEFUELLT,
  ICON_MUSIK,
  ICON_SCHLIESSEN_GEFUELLT,
  ICON_SICHTBAR,
  ICON_TEXTDOKUMENT,
  ICON_VIDEO,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import SendeAnzeige from '../../shared/SendeAnzeige';
import { AudioPlayer } from '../../shared';
import type { KonfiChallenge } from '../../../types/challenges';
import { tastaturKlick } from '../../../utils/tastatur';
import {
  CONSENT_OPTIONS,
  EINGABE_TITEL,
  LINK_HINWEIS,
  formatDuration,
  useChallengeBeitrag,
} from './useChallengeBeitrag';

// Einreich-Modal für eine Challenge. Zeigt nur die von der Challenge erlaubten
// Medienarten (allowed_media). Bei visibility='konfi_choice' entscheidet der
// Konfi selbst über die Sichtbarkeit — Voreinstellung ist "Mit meinem Namen
// veroeffentlichen". Bei 'public'/'private' gibt es keine Wahl, sondern einen
// kompakten Hinweis-Chip im Kopf.
//
// Medienart, Aufnahme, Dateiauswahl, Verkleinerung, Prüfung und Senden stehen
// im Hook useChallengeBeitrag, den auch der Dialog der Web-Fassung
// (shared/web/challenges/WebBeitragDialog) liest.

interface ChallengeSubmitModalProps {
  // Kann im ersten Render-Frame null sein: useIonModal reicht die Props des
  // Renders durch, in dem present() gerufen wurde — die im selben Handler
  // gesetzte Challenge kommt erst im Folge-Render an (Ionic rendert den
  // Modal-Inhalt bei Prop-Änderung neu). Deshalb ueberall null-sicher.
  challenge: KonfiChallenge | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ChallengeSubmitFormProps {
  challenge: KonfiChallenge;
  onClose: () => void;
  onSuccess: () => void;
}

const ChallengeSubmitForm: React.FC<ChallengeSubmitFormProps> = ({
  challenge,
  onClose,
  onSuccess
}) => {
  const {
    availableOptions,
    mediaType,
    handleMediaTypeChange,
    textContent,
    setTextContent,
    linkUrl,
    setLinkUrl,
    mediaPreview,
    uploadProgress,
    pickingMedia,
    consent,
    setConsent,
    isRecording,
    recordSeconds,
    isChoice,
    visibilityInfo,
    pickPhoto,
    pickVideo,
    startRecording,
    stopRecording,
    removeFile,
    isSubmitting,
    handleSubmit,
    currentOption,
  } = useChallengeBeitrag({ challenge, onSuccess });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dein Beitrag</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={ICON_SCHLIESSEN_GEFUELLT} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Beitrag einreichen"
              className="app-modal-submit-btn app-modal-submit-btn--challenges"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <IonIcon icon={ICON_HAKEN_GEFUELLT} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {/* Dieselbe Anzeige wie beim Senden im Chat (27.09.2026): Prozent und
            Balken, bei 100 % "Wird verarbeitet…" — der Server verschlüsselt
            dann noch, bei einem 50-MB-Video spürbar lange. */}
        {isSubmitting && (
          <SendeAnzeige prozent={uploadProgress} was="Beitrag" farbe="var(--app-text-challenges)" />
        )}
      </IonHeader>

      <IonContent className="app-gradient-background">

        {/* Challenge-Kopf. Der Behandlungs-Hinweis steht als Untertitel DIREKT
            in der Überschrift (Muster: Banner der Challenge-Seite, KonfiChallengeDetailPage) statt in
            einem eigenen Hinweis-Kasten darüber — er erscheint weiterhin in
            JEDER Sichtbarkeits-Konstellation (Nutzerentscheid 24.08.2026). */}
        <div className="app-header-banner app-header-banner--challenges">
          <div className="app-header-banner__circle-top" />
          <div className="app-header-banner__circle-bottom" />
          <div className="app-header-banner__header">
            <div className="app-header-banner__icon">
              <IonIcon icon={ICON_TEXTDOKUMENT} />
            </div>
            <div>
              <h2 className="app-header-banner__title">{challenge.title}</h2>
              <p className="app-header-banner__subtitle">{visibilityInfo}</p>
            </div>
          </div>
        </div>

        {/* Medienart */}
        {availableOptions.length > 1 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={ICON_GALERIE} />
              </div>
              <IonLabel>Wie möchtest du antworten?</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {availableOptions.map((option) => {
                    const isSelected = option.value === mediaType;
                    return (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                        key={option.value}
                        className={`app-list-item app-list-item--challenges${isSelected ? ' app-list-item--selected' : ''}`}
                        onClick={() => handleMediaTypeChange(option.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-icon-circle app-icon-circle--challenges">
                              <IonIcon icon={option.icon} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title">{option.label}</div>
                              <div className="app-list-item__subtitle">{option.hint}</div>
                            </div>
                            {isSelected && (
                              <IonIcon
                                icon={ICON_ZUSAGE_GEFUELLT}
                                className="app-icon-color--challenges"
                                style={{ fontSize: 'var(--app-text-titel)', flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Eingabe je nach Medienart */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--challenges">
              <IonIcon icon={currentOption?.icon || ICON_TEXTDOKUMENT} />
            </div>
            <IonLabel>{EINGABE_TITEL[mediaType]}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>

              {mediaType === 'text' && (
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea aria-label="Schreib hier deinen Beitrag"
                    value={textContent}
                    onIonInput={(e) => setTextContent(e.detail.value || '')}
                    placeholder="Schreib hier deinen Beitrag..."
                    autoGrow={true}
                    rows={5}
                  />
                </IonItem>
              )}

              {mediaType === 'link' && (
                <>
                  {/* Was geht, steht HIER — bevor jemand einen Link einwirft
                      und erst die Fehlermeldung es ihm sagt. */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 'var(--app-abstand-kompakt)',
                      padding: 'var(--app-abstand-winzig) var(--app-abstand-basis) var(--app-abstand-kompakt) var(--app-abstand-basis)',
                      fontSize: 'var(--app-text-hinweis)', color: 'var(--ion-color-medium)', lineHeight: 1.4
                    }}
                  >
                    <IonIcon icon={ICON_MUSIK} style={{ flexShrink: 0, marginTop: 'var(--app-abstand-winzig)' }} />
                    <span>{LINK_HINWEIS}</span>
                  </div>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonInput aria-label="Link"
                      type="url"
                      inputmode="url"
                      value={linkUrl}
                      onIonInput={(e) => setLinkUrl(e.detail.value || '')}
                      placeholder="https://..."
                      autocapitalize="off"
                    />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonTextarea aria-label="Warum dieser Link? (optional)"
                      value={textContent}
                      onIonInput={(e) => setTextContent(e.detail.value || '')}
                      placeholder="Warum dieser Link? (optional)"
                      autoGrow={true}
                      rows={2}
                    />
                  </IonItem>
                </>
              )}

              {mediaType === 'photo' && (
                <>
                  <div role={mediaPreview ? undefined : 'button'} tabIndex={mediaPreview ? undefined : 0} onKeyDown={tastaturKlick}
                    onClick={() => !pickingMedia && !mediaPreview && pickPhoto()}
                    style={{
                      padding: mediaPreview ? '0' : 'var(--app-abstand-basis)',
                      backgroundColor: 'transparent',
                      borderRadius: 'var(--app-radius-knopf)',
                      border: mediaPreview ? 'none' : '1px dashed var(--app-border-strong)',
                      cursor: mediaPreview ? 'default' : 'pointer',
                      overflow: 'hidden'
                    }}
                  >
                    {mediaPreview ? (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={mediaPreview}
                          alt="Dein Foto"
                          style={{
                            width: '100%', maxHeight: '280px', objectFit: 'cover',
                            borderRadius: 'var(--app-radius-knopf)', display: 'block'
                          }}
                        />
                        <IonButton
                          fill="solid"
                          color="danger"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); removeFile(); }}
                          aria-label="Bild entfernen"
                          style={{ position: 'absolute', top: '8px', right: '8px', '--border-radius': 'var(--app-radius-klein)' }}
                        >
                          <IonIcon icon={ICON_LOESCHEN_GEFUELLT} slot="icon-only" />
                        </IonButton>
                      </div>
                    ) : (
                      <div className="app-settings-item" style={{ justifyContent: 'center' }}>
                        {pickingMedia ? (
                          <IonSpinner name="dots" />
                        ) : (
                          <>
                            <IonIcon
                              icon={ICON_KAMERA_GEFUELLT}
                              className="app-icon-color--challenges"
                              style={{ fontSize: 'var(--app-text-untertitel)' }}
                            />
                            <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)' }}>
                              Foto hinzufügen
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <IonItem lines="none" style={{ '--background': 'transparent', marginTop: 'var(--app-abstand-eng)' }}>
                    <IonTextarea aria-label="Etwas dazu sagen? (optional)"
                      value={textContent}
                      onIonInput={(e) => setTextContent(e.detail.value || '')}
                      placeholder="Etwas dazu sagen? (optional)"
                      autoGrow={true}
                      rows={2}
                    />
                  </IonItem>
                </>
              )}

              {mediaType === 'video' && (
                <>
                  <div role={mediaPreview ? undefined : 'button'} tabIndex={mediaPreview ? undefined : 0} onKeyDown={tastaturKlick}
                    onClick={() => !pickingMedia && !mediaPreview && pickVideo()}
                    style={{
                      padding: mediaPreview ? '0' : 'var(--app-abstand-basis)',
                      backgroundColor: 'transparent',
                      borderRadius: 'var(--app-radius-knopf)',
                      border: mediaPreview ? 'none' : '1px dashed var(--app-border-strong)',
                      cursor: mediaPreview ? 'default' : 'pointer',
                      overflow: 'hidden'
                    }}
                  >
                    {mediaPreview ? (
                      <div style={{ position: 'relative' }}>
                        <video
                          src={mediaPreview}
                          controls
                          style={{
                            width: '100%', maxHeight: '280px',
                            borderRadius: 'var(--app-radius-knopf)', display: 'block', background: 'var(--app-schwarz)'
                          }}
                        />
                        <IonButton
                          fill="solid"
                          color="danger"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); removeFile(); }}
                          aria-label="Video entfernen"
                          style={{ position: 'absolute', top: '8px', right: '8px', '--border-radius': 'var(--app-radius-klein)' }}
                        >
                          <IonIcon icon={ICON_LOESCHEN_GEFUELLT} slot="icon-only" />
                        </IonButton>
                      </div>
                    ) : (
                      <div className="app-settings-item" style={{ justifyContent: 'center' }}>
                        {pickingMedia ? (
                          <IonSpinner name="dots" />
                        ) : (
                          <>
                            <IonIcon
                              icon={ICON_VIDEO}
                              className="app-icon-color--challenges"
                              style={{ fontSize: 'var(--app-text-untertitel)' }}
                            />
                            <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)' }}>
                              Video hinzufügen
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <IonItem lines="none" style={{ '--background': 'transparent', marginTop: 'var(--app-abstand-eng)' }}>
                    <IonTextarea aria-label="Etwas dazu sagen? (optional)"
                      value={textContent}
                      onIonInput={(e) => setTextContent(e.detail.value || '')}
                      placeholder="Etwas dazu sagen? (optional)"
                      autoGrow={true}
                      rows={2}
                    />
                  </IonItem>
                </>
              )}

              {mediaType === 'audio' && (
                <>
                  <div role={mediaPreview ? undefined : 'button'} tabIndex={mediaPreview ? undefined : 0} onKeyDown={tastaturKlick}
                    onClick={() => {
                      if (mediaPreview) return;
                      if (isRecording) stopRecording();
                      else startRecording();
                    }}
                    style={{
                      padding: mediaPreview ? 'var(--app-abstand-schmal) var(--app-abstand-mittel)' : 'var(--app-abstand-basis)',
                      backgroundColor: mediaPreview
                        ? 'rgba(0, 0, 0, 0.04)'
                        : isRecording
                          ? 'rgba(var(--app-color-danger-rgb), 0.08)'
                          : 'transparent',
                      borderRadius: 'var(--app-radius-knopf)',
                      border: mediaPreview || isRecording ? 'none' : '1px dashed var(--app-border-strong)',
                      cursor: mediaPreview ? 'default' : 'pointer'
                    }}
                  >
                    {mediaPreview ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)' }}>
                          <span style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-ios)', flex: 1, fontSize: 'var(--app-text-basis)' }}>
                            Aufnahme bereit
                          </span>
                          <IonButton fill="clear" color="danger" size="small" onClick={(e) => { e.stopPropagation(); removeFile(); }} aria-label="Aufnahme entfernen">
                            <IonIcon icon={ICON_LOESCHEN_GEFUELLT} slot="icon-only" />
                          </IonButton>
                        </div>
                        <AudioPlayer src={mediaPreview} />
                      </>
                    ) : isRecording ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-schmal)', justifyContent: 'center' }}>
                        <span
                          style={{
                            width: '10px', height: '10px', borderRadius: 'var(--app-radius-kreis)',
                            background: 'var(--app-color-danger)', flexShrink: 0
                          }}
                          className="app-recording-dot"
                        />
                        <span style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-color-danger)' }}>
                          {formatDuration(recordSeconds)}
                        </span>
                        <span style={{ fontSize: 'var(--app-text-hinweis)', color: 'var(--app-color-danger)' }}>
                          Antippen zum Stoppen
                        </span>
                      </div>
                    ) : (
                      <div className="app-settings-item" style={{ justifyContent: 'center' }}>
                        <IonIcon
                          icon={ICON_MIKROFON_GEFUELLT}
                          className="app-icon-color--challenges"
                          style={{ fontSize: 'var(--app-text-untertitel)' }}
                        />
                        <span style={{ fontWeight: 'var(--app-schrift-mittel)', color: 'var(--app-text-secondary)' }}>
                          Tippen zum Aufnehmen
                        </span>
                      </div>
                    )}
                  </div>
                  <IonItem lines="none" style={{ '--background': 'transparent', marginTop: 'var(--app-abstand-eng)' }}>
                    <IonTextarea aria-label="Etwas dazu sagen? (optional)"
                      value={textContent}
                      onIonInput={(e) => setTextContent(e.detail.value || '')}
                      placeholder="Etwas dazu sagen? (optional)"
                      autoGrow={true}
                      rows={2}
                    />
                  </IonItem>
                </>
              )}

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Sichtbarkeit */}
        {isChoice && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={ICON_SICHTBAR} />
              </div>
              <IonLabel>Wer sieht deinen Beitrag?</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {CONSENT_OPTIONS.map((option) => {
                    const isSelected = option.value === consent;
                    return (
                      <div role="button" tabIndex={0} onKeyDown={tastaturKlick} aria-pressed={isSelected}
                        key={option.value}
                        className={`app-list-item app-list-item--challenges${isSelected ? ' app-list-item--selected' : ''}`}
                        onClick={() => setConsent(option.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-icon-circle app-icon-circle--challenges">
                              <IonIcon icon={option.icon} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title">{option.label}</div>
                              <div className="app-list-item__subtitle">{option.hint}</div>
                            </div>
                            {isSelected && (
                              <IonIcon
                                icon={ICON_ZUSAGE_GEFUELLT}
                                className="app-icon-color--challenges"
                                style={{ fontSize: 'var(--app-text-titel)', flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

      </IonContent>
    </IonPage>
  );
};

/**
 * Huelle um das Formular. Solange die Challenge noch nicht durchgereicht ist,
 * wird nur ein leerer Rahmen gezeigt; über den key remountet das Formular
 * sauber, sobald (bzw. wenn eine andere) Challenge ankommt — so starten
 * Medienauswahl und Sichtbarkeits-Vorauswahl mit den richtigen Werten.
 */
const ChallengeSubmitModal: React.FC<ChallengeSubmitModalProps> = ({
  challenge,
  onClose,
  onSuccess
}) => {
  if (!challenge) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Dein Beitrag</IonTitle>
            <IonButtons slot="start">
              <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose}>
                <IonIcon icon={ICON_SCHLIESSEN_GEFUELLT} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="app-gradient-background">
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-riesig)' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <ChallengeSubmitForm
      key={challenge.id}
      challenge={challenge}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
};

export default ChallengeSubmitModal;
