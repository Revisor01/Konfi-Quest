import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  trash,
  checkmarkCircle,
  eyeOutline,
  eyeOffOutline,
  lockClosedOutline,
  personCircleOutline,
  shieldCheckmarkOutline,
  mic,
  stopOutline,
  playOutline,
  pauseOutline
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
// kompakten Hinweis-Chip im Kopf.

const MEDIA_OPTIONS: { value: ChallengeMediaType; label: string; icon: string; hint: string }[] = [
  { value: 'text', label: 'Text', icon: documentTextOutline, hint: 'Schreib deine Gedanken auf' },
  { value: 'photo', label: 'Foto', icon: imageOutline, hint: 'Aufnehmen oder aus der Galerie' },
  { value: 'audio', label: 'Audio', icon: micOutline, hint: 'Direkt aufnehmen' },
  { value: 'video', label: 'Video', icon: videocamOutline, hint: 'Aufnehmen oder aus der Galerie' },
  { value: 'link', label: 'Link', icon: linkOutline, hint: 'Ein Lied, ein Video, eine Seite' }
];

// Kurze Labels + kurzer Untertitel statt langer Erklaersaetze.
const CONSENT_OPTIONS: { value: ChallengeConsent; label: string; hint: string; icon: string }[] = [
  { value: 'publish', label: 'Öffentlich', hint: 'mit deinem Namen', icon: personCircleOutline },
  { value: 'anonymous', label: 'Anonym', hint: 'ohne Namen', icon: eyeOffOutline },
  { value: 'private', label: 'Nur Leitung', hint: 'nicht in der Galerie', icon: lockClosedOutline }
];

/** Kompakter Kopf-Chip: Icon + 2-4 Worte. Bei konfi_choice bewusst kein Chip
 *  (die Wahl steht unten im Consent-Picker). */
const getHeaderChip = (challenge: KonfiChallenge): { icon: string; label: string } | null => {
  if (challenge.visibility === 'private') {
    return { icon: lockClosedOutline, label: 'Nur Leitung' };
  }
  if (challenge.visibility === 'public') {
    return challenge.moderated
      ? { icon: shieldCheckmarkOutline, label: 'Öffentlich mit Moderation' }
      : { icon: eyeOutline, label: 'Öffentlich mit Name' };
  }
  return null;
};

/** Erfolgsmeldung nach dem Absenden — spiegelt den tatsaechlichen Behandlungsweg. */
const getSuccessMessage = (challenge: KonfiChallenge, consent: ChallengeConsent): string => {
  const willBePublic =
    challenge.visibility === 'public' ||
    (challenge.visibility === 'konfi_choice' && consent !== 'private');
  if (challenge.moderated && willBePublic) {
    return 'Eingereicht — dein Beitrag wartet auf Freigabe.';
  }
  if (willBePublic) {
    return 'Veröffentlicht!';
  }
  return 'Eingereicht — dein Beitrag ist nur für die Leitung sichtbar.';
};

// Serverlimit laut Spec: 50 MB pro Datei.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Bevorzugter MIME-Type fuer die Audioaufnahme: audio/mp4 laeuft auf iOS-WebView
// zuverlaessig (AVFoundation-Unterbau), audio/webm ist der Chromium/Android-Fallback.
const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

const pickSupportedAudioMime = (): string | null => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  return AUDIO_MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) || null;
};

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

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
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [consent, setConsent] = useState<ChallengeConsent>('publish');

  // --- Audio-Aufnahme (MediaRecorder) ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const isChoice = challenge.visibility === 'konfi_choice';
  const headerChip = getHeaderChip(challenge);

  const resetMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setFile(null);
    setLinkUrl('');
    setUploadProgress(0);
  };

  const stopRecordingTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const stopAudioStream = () => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  };

  // Aufraeumen beim Unmount (Modal geschlossen waehrend Aufnahme laeuft).
  useEffect(() => {
    return () => {
      stopRecordingTimer();
      stopAudioStream();
    };
  }, []);

  const handleMediaTypeChange = (value: ChallengeMediaType) => {
    if (value === mediaType) return;
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      stopAudioStream();
      stopRecordingTimer();
      setIsRecording(false);
    }
    resetMedia();
    setMediaType(value);
  };

  // --- Foto: Kamera / Galerie ---
  const pickPhoto = async (source: CameraSource) => {
    setPickingMedia(true);
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
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setFile(compressed);
      setMediaPreview(previewUrl);
    } catch (err: any) {
      // Abgebrochener Kamera-/Galerie-Dialog ist kein Fehler (Capacitor wirft
      // dabei "User cancelled photos app" bzw. eine leere Meldung).
      const message = String(err?.message || '');
      if (!message || /cancel/i.test(message)) return;
      setError('Foto konnte nicht ausgewählt werden');
    } finally {
      setPickingMedia(false);
    }
  };

  // --- Video: Aufnahme / Galerie ueber das native Video-Picker-Sheet ---
  const pickVideo = async (source: 'camera' | 'gallery') => {
    setPickingMedia(true);
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      if (source === 'camera') {
        input.capture = 'environment';
      }
      const selected = await new Promise<File | null>((resolve) => {
        input.onchange = (event: Event) => {
          const target = event.target as HTMLInputElement;
          resolve(target.files?.[0] || null);
        };
        // Manche WebViews feuern kein 'cancel'-Event — ohne Zeitlimit wuerde
        // pickingMedia sonst bei Abbruch haengen bleiben.
        window.addEventListener('focus', () => setTimeout(() => resolve(null), 1000), { once: true });
        input.click();
      });
      if (!selected) return;
      if (selected.size > MAX_UPLOAD_BYTES) {
        setError('Datei ist zu groß (max. 50 MB).');
        return;
      }
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setFile(selected);
      setMediaPreview(URL.createObjectURL(selected));
    } catch {
      setError('Video konnte nicht ausgewählt werden');
    } finally {
      setPickingMedia(false);
    }
  };

  // --- Audio: Direktaufnahme ---
  const startRecording = async () => {
    try {
      const mimeType = pickSupportedAudioMime();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopAudioStream();
        const usedMime = recorder.mimeType || mimeType || 'audio/mp4';
        const extension = usedMime.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(recordedChunksRef.current, { type: usedMime });
        const audioFile = new File([blob], `challenge-audio.${extension}`, { type: usedMime });
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setFile(audioFile);
        setMediaPreview(URL.createObjectURL(audioFile));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      stopRecordingTimer();
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      const message = String(err?.message || '');
      if (/permission|denied/i.test(message)) {
        setError('Zugriff aufs Mikrofon wurde nicht erlaubt.');
      } else {
        setError('Aufnahme konnte nicht gestartet werden');
      }
    }
  };

  const stopRecording = () => {
    stopRecordingTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleAudioPreview = () => {
    const audioEl = audioPreviewRef.current;
    if (!audioEl) return;
    if (isPlayingPreview) {
      audioEl.pause();
    } else {
      audioEl.play().catch(() => undefined);
    }
  };

  const removeFile = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setFile(null);
    setRecordSeconds(0);
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

        setSuccess(getSuccessMessage(challenge, isChoice ? consent : 'publish'));
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
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

        {/* Challenge-Kopf mit kompaktem Sichtbarkeits-Chip */}
        <div className="app-header-banner app-header-banner--challenges">
          <div className="app-header-banner__circle-top" />
          <div className="app-header-banner__circle-bottom" />
          <div className="app-header-banner__header">
            <div className="app-header-banner__icon">
              <IonIcon icon={documentTextOutline} />
            </div>
            <div>
              <h2 className="app-header-banner__title">{challenge.title}</h2>
              {headerChip && (
                <span className="app-chip app-chip--challenges" style={{ marginTop: '6px' }}>
                  <IonIcon icon={headerChip.icon} />
                  {headerChip.label}
                </span>
              )}
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
                : mediaType === 'audio' ? 'Deine Aufnahme'
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
                  {mediaPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={mediaPreview}
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
                        disabled={pickingMedia}
                      >
                        {pickingMedia ? <IonSpinner name="dots" /> : (
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
                        disabled={pickingMedia}
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

              {mediaType === 'video' && (
                <>
                  {mediaPreview ? (
                    <div style={{ position: 'relative' }}>
                      <video
                        src={mediaPreview}
                        controls
                        style={{
                          width: '100%', maxHeight: '280px',
                          borderRadius: '10px', display: 'block', background: '#000'
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
                        onClick={() => pickVideo('camera')}
                        disabled={pickingMedia}
                      >
                        {pickingMedia ? <IonSpinner name="dots" /> : (
                          <>
                            <IonIcon icon={videocamOutline} slot="start" />
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
                        onClick={() => pickVideo('gallery')}
                        disabled={pickingMedia}
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

              {mediaType === 'audio' && (
                <>
                  {mediaPreview ? (
                    <div
                      style={{
                        padding: '14px', borderRadius: '10px',
                        background: 'rgba(var(--app-color-challenges-rgb), 0.08)',
                        display: 'flex', alignItems: 'center', gap: '10px'
                      }}
                    >
                      <IonButton
                        fill="solid"
                        shape="round"
                        style={{ '--background': 'var(--app-color-challenges)', margin: 0 }}
                        onClick={toggleAudioPreview}
                      >
                        <IonIcon icon={isPlayingPreview ? pauseOutline : playOutline} slot="icon-only" />
                      </IonButton>
                      <span style={{ fontWeight: 600, color: 'var(--app-color-challenges)', flex: 1 }}>
                        Aufnahme bereit
                      </span>
                      <audio
                        ref={audioPreviewRef}
                        src={mediaPreview}
                        onPlay={() => setIsPlayingPreview(true)}
                        onPause={() => setIsPlayingPreview(false)}
                        onEnded={() => setIsPlayingPreview(false)}
                        style={{ display: 'none' }}
                      />
                      <IonButton fill="clear" color="danger" size="small" onClick={removeFile}>
                        <IonIcon icon={trash} slot="icon-only" />
                      </IonButton>
                    </div>
                  ) : isRecording ? (
                    <div
                      style={{
                        padding: '18px', borderRadius: '10px',
                        background: 'rgba(220, 53, 69, 0.08)',
                        display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center'
                      }}
                    >
                      <span
                        style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: '#dc3545', flexShrink: 0
                        }}
                        className="app-recording-dot"
                      />
                      <span style={{ fontWeight: 600, color: '#dc3545' }}>
                        {formatDuration(recordSeconds)}
                      </span>
                      <IonButton fill="solid" color="danger" size="small" onClick={stopRecording}>
                        <IonIcon icon={stopOutline} slot="start" />
                        Stopp
                      </IonButton>
                    </div>
                  ) : (
                    <IonButton
                      expand="block"
                      style={{
                        margin: 0,
                        '--background': 'var(--app-color-challenges)',
                        '--border-radius': '10px'
                      }}
                      onClick={startRecording}
                    >
                      <IonIcon icon={mic} slot="start" />
                      Aufnehmen
                    </IonButton>
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

            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Sichtbarkeit */}
        {isChoice && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={eyeOutline} />
              </div>
              <IonLabel>Wer sieht deinen Beitrag?</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '12px' }}>
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
                  {/* Moderations-Zusatz nur relevant, wenn der Beitrag ueberhaupt
                      veroeffentlicht werden soll (nicht bei 'private'). */}
                  {challenge.moderated && consent !== 'private' && (
                    <span className="app-chip app-chip--challenges" style={{ marginTop: '8px', alignSelf: 'flex-start' }}>
                      <IonIcon icon={shieldCheckmarkOutline} />
                      Mit Moderation
                    </span>
                  )}
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
