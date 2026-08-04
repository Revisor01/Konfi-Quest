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
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonLabel,
  IonItem,
  IonTextarea,
  IonInput,
  IonProgressBar,
  IonSpinner
} from '@ionic/react';
import {
  close,
  checkmark,
  documentTextOutline,
  imageOutline,
  micOutline,
  videocamOutline,
  linkOutline,
  cameraOutline,
  imagesOutline,
  cloudUploadOutline,
  trash,
  checkmarkCircle,
  eyeOutline,
  eyeOffOutline,
  lockClosedOutline,
  personCircleOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import { compressImage } from '../../../services/mediaCompression';
import type {
  KonfiChallenge,
  ChallengeMediaType,
  ChallengeConsent
} from '../../../types/challenges';

// Einreich-Modal fuer eine Challenge. Zeigt nur die von der Challenge erlaubten
// Medienarten (allowed_media). Bei visibility='konfi_choice' entscheidet der
// Konfi selbst ueber die Sichtbarkeit — Voreinstellung ist "Mit meinem Namen
// veroeffentlichen". Bei 'public'/'private' gibt es keine Wahl, sondern einen
// klaren Hinweistext.

const MEDIA_OPTIONS: { value: ChallengeMediaType; label: string; icon: string; hint: string }[] = [
  { value: 'text', label: 'Text', icon: documentTextOutline, hint: 'Schreib deine Gedanken auf' },
  { value: 'photo', label: 'Foto', icon: imageOutline, hint: 'Aufnehmen oder aus der Galerie' },
  { value: 'audio', label: 'Audio', icon: micOutline, hint: 'Eine Audiodatei auswählen' },
  { value: 'video', label: 'Video', icon: videocamOutline, hint: 'Eine Videodatei auswählen' },
  { value: 'link', label: 'Link', icon: linkOutline, hint: 'Ein Lied, ein Video, eine Seite' }
];

// Reihenfolge und Voreinstellung bewusst so: die Veroeffentlichung mit Namen
// steht vorne und ist vorausgewaehlt, "Nur fuer die Leitung" bleibt jederzeit
// als bewusste Entscheidung verfuegbar.
const CONSENT_OPTIONS: { value: ChallengeConsent; label: string; hint: string; icon: string }[] = [
  {
    value: 'publish',
    label: 'Mit meinem Namen veröffentlichen',
    hint: 'Deine Gruppe sieht deinen Beitrag zusammen mit deinem Namen.',
    icon: personCircleOutline
  },
  {
    value: 'anonymous',
    label: 'Anonym veröffentlichen',
    hint: 'Deine Gruppe sieht deinen Beitrag, aber ohne deinen Namen.',
    icon: eyeOffOutline
  },
  {
    value: 'private',
    label: 'Nur für die Leitung',
    hint: 'Nur die Leitung und du selbst sehen deinen Beitrag.',
    icon: lockClosedOutline
  }
];

const ACCEPT_BY_MEDIA: Record<string, string> = {
  audio: 'audio/*',
  video: 'video/*'
};

// Serverlimit laut Spec: 50 MB pro Datei.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

interface ChallengeSubmitModalProps {
  // Kann im ersten Render-Frame null sein: useIonModal reicht die Props des
  // Renders durch, in dem present() gerufen wurde — die im selben Handler
  // gesetzte Challenge kommt erst im Folge-Render an (Ionic rendert den
  // Modal-Inhalt bei Prop-Aenderung neu). Deshalb ueberall null-sicher.
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
  const { setSuccess, setError, isOnline } = useApp();
  const { isSubmitting, guard } = useActionGuard();

  const allowedMedia = useMemo<ChallengeMediaType[]>(() => {
    const list = Array.isArray(challenge.allowed_media) ? challenge.allowed_media : [];
    return list.length > 0 ? list : ['text'];
  }, [challenge.allowed_media]);

  const availableOptions = useMemo(
    () => MEDIA_OPTIONS.filter((o) => allowedMedia.includes(o.value)),
    [allowedMedia]
  );

  const [mediaType, setMediaType] = useState<ChallengeMediaType>(
    availableOptions[0]?.value || 'text'
  );
  const [textContent, setTextContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [consent, setConsent] = useState<ChallengeConsent>('publish');

  const isChoice = challenge.visibility === 'konfi_choice';

  const resetMedia = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setFile(null);
    setLinkUrl('');
    setUploadProgress(0);
  };

  const handleMediaTypeChange = (value: ChallengeMediaType) => {
    if (value === mediaType) return;
    resetMedia();
    setMediaType(value);
  };

  // --- Foto: Kamera / Galerie (Camera-Plugin wie im Chat) ---
  const pickPhoto = async (source: CameraSource) => {
    setPickingPhoto(true);
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source,
        quality: 90
      });
      if (!photo.dataUrl) return;
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const rawFile = new File(
        [blob],
        source === CameraSource.Camera ? 'challenge-foto.jpg' : 'challenge-galerie.jpg',
        { type: 'image/jpeg' }
      );
      const { file: compressed, previewUrl } = await compressImage(rawFile);
      if (compressed.size > MAX_UPLOAD_BYTES) {
        URL.revokeObjectURL(previewUrl);
        setError('Datei ist zu groß (max. 50 MB).');
        return;
      }
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setFile(compressed);
      setPhotoPreview(previewUrl);
    } catch (err: any) {
      // Abgebrochener Kamera-/Galerie-Dialog ist kein Fehler (Capacitor wirft
      // dabei "User cancelled photos app" bzw. eine leere Meldung).
      const message = String(err?.message || '');
      if (!message || /cancel/i.test(message)) return;
      setError('Foto konnte nicht ausgewählt werden');
    } finally {
      setPickingPhoto(false);
    }
  };

  // --- Audio/Video: klassische Dateiauswahl (keine In-App-Aufnahme) ---
  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_BY_MEDIA[mediaType] || '*/*';
    input.multiple = false;
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const selected = target.files?.[0];
      if (!selected) return;
      if (selected.size > MAX_UPLOAD_BYTES) {
        setError('Datei ist zu groß (max. 50 MB).');
        return;
      }
      setFile(selected);
    };
    input.click();
  };

  const removeFile = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setFile(null);
  };

  const isValid = (): boolean => {
    if (mediaType === 'text') return textContent.trim().length > 0;
    if (mediaType === 'link') return linkUrl.trim().length > 0;
    return !!file;
  };

  const handleSubmit = () => {
    if (!isOnline) {
      setError('Einreichen nicht möglich — du bist offline');
      return;
    }
    if (!isValid()) {
      if (mediaType === 'text') setError('Bitte schreib etwas, bevor du einreichst');
      else if (mediaType === 'link') setError('Bitte gib einen Link an');
      else setError('Bitte wähle eine Datei aus');
      return;
    }

    guard(async () => {
      setUploadProgress(0);
      try {
        if (mediaType === 'text' || mediaType === 'link') {
          // JSON-Pfad (kein Upload)
          await api.post(`/challenges/konfi/${challenge.id}/submissions`, {
            media_type: mediaType,
            text_content: textContent.trim() || null,
            link_url: mediaType === 'link' ? linkUrl.trim() : null,
            konfi_consent: isChoice ? consent : null
          });
        } else {
          // Multipart-Pfad (Feld 'file' laut API-Vertrag)
          const formData = new FormData();
          formData.append('file', file as File);
          formData.append('media_type', mediaType);
          if (textContent.trim()) formData.append('text_content', textContent.trim());
          if (isChoice) formData.append('konfi_consent', consent);

          await api.post(`/challenges/konfi/${challenge.id}/submissions`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            // Medien-Uploads koennen auf Mobilfunk deutlich laenger dauern als
            // die globalen 20s.
            timeout: 180000,
            onUploadProgress: (event) => {
              if (event.total) {
                setUploadProgress(Math.round((event.loaded * 100) / event.total));
              }
            }
          });
        }

        setSuccess('Dein Beitrag ist eingereicht!');
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        onSuccess();
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Fehler beim Einreichen');
      } finally {
        setUploadProgress(0);
      }
    }).catch(() => {
      // guard wirft, wenn bereits eine Aktion laeuft — bewusst ignorieren.
    });
  };

  const currentOption = availableOptions.find((o) => o.value === mediaType);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dein Beitrag</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              className="app-modal-submit-btn app-modal-submit-btn--challenges"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <IonIcon icon={checkmark} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        {isSubmitting && uploadProgress > 0 && (
          <IonProgressBar value={uploadProgress / 100} />
        )}
      </IonHeader>

      <IonContent className="app-gradient-background">

        {/* Challenge-Kopf */}
        <div className="app-header-banner app-header-banner--challenges">
          <div className="app-header-banner__circle-top" />
          <div className="app-header-banner__circle-bottom" />
          <div className="app-header-banner__header">
            <div className="app-header-banner__icon">
              <IonIcon icon={documentTextOutline} />
            </div>
            <div>
              <h2 className="app-header-banner__title">{challenge.title}</h2>
              <p className="app-header-banner__subtitle">
                {challenge.moderated
                  ? 'Dein Beitrag wird von der Leitung angeschaut'
                  : 'Dein Beitrag ist sofort da'}
              </p>
            </div>
          </div>
        </div>

        {/* Medienart */}
        {availableOptions.length > 1 && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={imagesOutline} />
              </div>
              <IonLabel>Wie möchtest du antworten?</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {availableOptions.map((option) => {
                    const isSelected = option.value === mediaType;
                    return (
                      <div
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
                                icon={checkmarkCircle}
                                className="app-icon-color--challenges"
                                style={{ fontSize: '1.3rem', flexShrink: 0 }}
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
              <IonIcon icon={currentOption?.icon || documentTextOutline} />
            </div>
            <IonLabel>
              {mediaType === 'text' ? 'Dein Text'
                : mediaType === 'link' ? 'Dein Link'
                : mediaType === 'photo' ? 'Dein Foto'
                : mediaType === 'audio' ? 'Deine Audiodatei'
                : 'Dein Video'}
            </IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '12px' }}>

              {mediaType === 'text' && (
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea
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
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonInput
                      type="url"
                      inputmode="url"
                      value={linkUrl}
                      onIonInput={(e) => setLinkUrl(e.detail.value || '')}
                      placeholder="https://..."
                      autocapitalize="off"
                    />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonTextarea
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
                  {photoPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={photoPreview}
                        alt="Dein Foto"
                        style={{
                          width: '100%', maxHeight: '280px', objectFit: 'cover',
                          borderRadius: '10px', display: 'block'
                        }}
                      />
                      <IonButton
                        fill="solid"
                        color="danger"
                        size="small"
                        onClick={removeFile}
                        style={{ position: 'absolute', top: '8px', right: '8px', '--border-radius': '8px' }}
                      >
                        <IonIcon icon={trash} slot="icon-only" />
                      </IonButton>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <IonButton
                        expand="block"
                        style={{
                          flex: 1, margin: 0,
                          '--background': 'var(--app-color-challenges)',
                          '--border-radius': '10px'
                        }}
                        onClick={() => pickPhoto(CameraSource.Camera)}
                        disabled={pickingPhoto}
                      >
                        {pickingPhoto ? <IonSpinner name="dots" /> : (
                          <>
                            <IonIcon icon={cameraOutline} slot="start" />
                            Aufnehmen
                          </>
                        )}
                      </IonButton>
                      <IonButton
                        expand="block"
                        fill="outline"
                        style={{
                          flex: 1, margin: 0,
                          '--color': 'var(--app-color-challenges)',
                          '--border-color': 'var(--app-color-challenges)',
                          '--border-radius': '10px'
                        }}
                        onClick={() => pickPhoto(CameraSource.Photos)}
                        disabled={pickingPhoto}
                      >
                        <IonIcon icon={imagesOutline} slot="start" />
                        Galerie
                      </IonButton>
                    </div>
                  )}
                  <IonItem lines="none" style={{ '--background': 'transparent', marginTop: '8px' }}>
                    <IonTextarea
                      value={textContent}
                      onIonInput={(e) => setTextContent(e.detail.value || '')}
                      placeholder="Etwas dazu sagen? (optional)"
                      autoGrow={true}
                      rows={2}
                    />
                  </IonItem>
                </>
              )}

              {(mediaType === 'audio' || mediaType === 'video') && (
                <>
                  <div
                    onClick={file ? undefined : pickFile}
                    style={{
                      padding: '18px',
                      borderRadius: '10px',
                      border: file
                        ? '1px solid rgba(var(--app-color-challenges-rgb), 0.25)'
                        : '1px dashed #c7c7cc',
                      background: file ? 'rgba(var(--app-color-challenges-rgb), 0.08)' : 'transparent',
                      cursor: file ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      justifyContent: file ? 'space-between' : 'center'
                    }}
                  >
                    {file ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <IonIcon
                            icon={checkmarkCircle}
                            className="app-icon-color--challenges"
                            style={{ fontSize: '1.2rem', flexShrink: 0 }}
                          />
                          <span
                            style={{
                              fontWeight: 600, color: 'var(--app-color-challenges)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}
                          >
                            {file.name}
                          </span>
                        </div>
                        <IonButton fill="clear" color="danger" size="small" onClick={removeFile}>
                          <IonIcon icon={trash} slot="icon-only" />
                        </IonButton>
                      </>
                    ) : (
                      <>
                        <IonIcon
                          icon={cloudUploadOutline}
                          className="app-icon-color--challenges"
                          style={{ fontSize: '1.3rem' }}
                        />
                        <span style={{ fontWeight: 500, color: '#666' }}>
                          {mediaType === 'audio' ? 'Audiodatei auswählen' : 'Videodatei auswählen'}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="app-info-box app-info-box--challenges" style={{ marginTop: '10px' }}>
                    Du kannst eine fertige Datei von deinem Gerät hochladen (max. 50 MB).
                  </div>
                  <IonItem lines="none" style={{ '--background': 'transparent', marginTop: '8px' }}>
                    <IonTextarea
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
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--challenges">
              <IonIcon icon={isChoice ? eyeOutline : informationCircleOutline} />
            </div>
            <IonLabel>Wer sieht deinen Beitrag?</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '12px' }}>
              {isChoice ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {CONSENT_OPTIONS.map((option) => {
                    const isSelected = option.value === consent;
                    return (
                      <div
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
                                icon={checkmarkCircle}
                                className="app-icon-color--challenges"
                                style={{ fontSize: '1.3rem', flexShrink: 0 }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="app-info-box app-info-box--challenges" style={{ marginTop: '8px' }}>
                    Du kannst deinen Beitrag jederzeit wieder zurückziehen.
                  </div>
                </div>
              ) : (
                <div className="app-info-box app-info-box--challenges">
                  {challenge.visibility === 'public'
                    ? 'Dein Beitrag wird für deine Gruppe sichtbar.'
                    : 'Dein Beitrag ist nur für die Leitung sichtbar.'}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

      </IonContent>
    </IonPage>
  );
};

/**
 * Huelle um das Formular. Solange die Challenge noch nicht durchgereicht ist,
 * wird nur ein leerer Rahmen gezeigt; ueber den key remountet das Formular
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
              <IonButton className="app-modal-close-btn" onClick={onClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="app-gradient-background">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
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
