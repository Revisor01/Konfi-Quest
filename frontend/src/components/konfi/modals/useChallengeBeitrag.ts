// „Dein Beitrag" zu einer Challenge -- als Logik ohne Darstellung (Simon,
// 15.10.2026: Im Browser bekommt jedes Formular, das noch ein Modal der App
// öffnet, ein kompaktes Fenster der Web-Fassung). Die App zeigt es im Modal
// (ChallengeSubmitModal), der Browser ab 992 px im Dialog
// (shared/web/challenges/WebBeitragDialog) -- für Konfis und fürs Team.
// Medienart, Aufnahme, Dateiauswahl, Verkleinerung, Prüfung, Senden mit
// Fortschritt, Messung und die Texte stehen nur hier, damit beide nicht
// auseinanderlaufen.
//
// Nur die von der Challenge erlaubten Medienarten (allowed_media). Bei
// visibility='konfi_choice' entscheidet, wer einreicht, selbst über die
// Sichtbarkeit -- Voreinstellung „Öffentlich, mit deinem Namen".
//
// Senden: POST /challenges/konfi/:id/submissions
//   Text und Link als JSON { media_type, text_content, link_url, konfi_consent },
//   Foto, Video und Aufnahme als multipart (Feld 'file') über das
//   Medien-System: Dateiauswahl über die Hülle (services/systemDialoge),
//   Verkleinern und Grenze über fuerUploadVorbereiten
//   (services/mediaCompression) -- derselbe Weg wie im Chat.
//
// Fehler meldet der Hook über `meldeFehler`: in der App oben (setError), im
// Dialog des Browsers im Fenster selbst. Die Senke heißt bewusst setError --
// an ihr erkennt die Positivliste der Fehlertexte die Aufrufstellen
// (__tests__/utils/bekannteFehlertexte.test.ts). Die Erfolgsmeldung steht in
// beiden oben (setSuccess), nachdem das Fenster zu ist.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ICON_BILD,
  ICON_LINK,
  ICON_MIKROFON,
  ICON_PROFIL,
  ICON_SPERRE,
  ICON_TEXTDOKUMENT,
  ICON_VERBORGEN,
  ICON_VIDEO,
} from '../../shared/icons';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import api from '../../../services/api';
import { track } from '../../../services/analytics';
import { fuerUploadVorbereiten, DateiZuGrossFehler, UPLOAD_GRENZE, zuGrossText } from '../../../services/mediaCompression';
import { dateiAuswaehlen } from '../../../services/systemDialoge';
import { fehlerTextOderMessage } from '../../../utils/fehler';
import { pruefeMusikLink, ERLAUBTE_DIENSTE_TEXT } from '../../../utils/musikLinks';
import { getVisibilityInfo, getSuccessMessage } from '../../../utils/challengeTexte';
import type {
  KonfiChallenge,
  ChallengeMediaType,
  ChallengeConsent
} from '../../../types/challenges';

export const MEDIA_OPTIONS: { value: ChallengeMediaType; label: string; icon: string; hint: string }[] = [
  { value: 'text', label: 'Text', icon: ICON_TEXTDOKUMENT, hint: 'Schreib deine Gedanken auf' },
  { value: 'photo', label: 'Foto', icon: ICON_BILD, hint: 'Aufnehmen oder aus der Galerie' },
  { value: 'audio', label: 'Audio', icon: ICON_MIKROFON, hint: 'Direkt aufnehmen' },
  { value: 'video', label: 'Video', icon: ICON_VIDEO, hint: 'Aufnehmen oder aus der Galerie' },
  { value: 'link', label: 'Link', icon: ICON_LINK, hint: 'Ein Lied von Spotify, Apple Music, YouTube Music oder Deezer' }
];

// Kurze Labels + kurzer Untertitel statt langer Erklaersaetze.
export const CONSENT_OPTIONS: { value: ChallengeConsent; label: string; hint: string; icon: string }[] = [
  { value: 'publish', label: 'Öffentlich', hint: 'mit deinem Namen', icon: ICON_PROFIL },
  { value: 'anonymous', label: 'Anonym', hint: 'ohne Namen', icon: ICON_VERBORGEN },
  { value: 'private', label: 'Nur Leitung', hint: 'nicht in der Galerie', icon: ICON_SPERRE }
];

/** Überschrift über der Eingabe je Medienart. */
export const EINGABE_TITEL: Record<ChallengeMediaType, string> = {
  text: 'Dein Text',
  link: 'Dein Link',
  photo: 'Dein Foto',
  audio: 'Deine Aufnahme',
  video: 'Dein Video',
};

/** Was unter dem Link-Feld steht -- bevor jemand einen Link einwirft und erst die Fehlermeldung es ihm sagt. */
export const LINK_HINWEIS = `Erlaubt sind Musik-Links von ${ERLAUBTE_DIENSTE_TEXT}. Titel und Interpret werden automatisch dazugeschrieben.`;

// Serverlimit laut Spec: 50 MB pro Datei — steht als UPLOAD_GRENZE.challenges
// neben der des Chats in services/mediaCompression (ein Weg für beide).
const MAX_UPLOAD_BYTES = UPLOAD_GRENZE.challenges;

// Bevorzugter MIME-Type für die Audioaufnahme: audio/mp4 läuft auf iOS-WebView
// zuverlaessig (AVFoundation-Unterbau), audio/webm ist der Chromium/Android-Fallback.
const AUDIO_MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

const pickSupportedAudioMime = (): string | null => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  return AUDIO_MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) || null;
};

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export interface ChallengeBeitragOptionen {
  challenge: KonfiChallenge;
  /** Eingereicht: Fenster zu, Galerie bzw. Beiträge neu laden. */
  onSuccess: () => void;
  /** Wohin ein Fehler geht; ohne Angabe oben in der App (setError). */
  meldeFehler?: (text: string) => void;
}

export function useChallengeBeitrag({ challenge, onSuccess, meldeFehler }: ChallengeBeitragOptionen) {
  const app = useApp();
  const { setSuccess, isOnline } = app;
  const setError = meldeFehler ?? app.setError;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const isChoice = challenge.visibility === 'konfi_choice';
  const visibilityInfo = getVisibilityInfo(challenge);

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

  // Aufräumen beim Unmount (Modal geschlossen während Aufnahme läuft).
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

  // --- Gemeinsamer Datei-Picker für Foto und Video: die Hülle dateiAuswaehlen
  // (services/systemDialoge). Sie meldet den Ausflug der App-Sperre an — wer
  // länger in der Fotomediathek blättert, säße beim Zurückkommen sonst vor dem
  // Sperrbildschirm — und erkennt den Abbruch: sofort über das native
  // 'cancel', sonst über die Rückkehr des Fokus mit großzügiger Frist (15 s),
  // in der eine späte Auswahl (iOS-HEIC-Konvertierung, große Videos) noch
  // gewinnt. Früher löste hier nach 1 s pauschal "nichts gewählt" aus, und
  // die Auswahl ging still verloren.
  //
  // Der Spinner endet 1,2 s nach der Rückkehr ohne Auswahl, damit die
  // Oberfläche bei einem Abbruch nicht blockiert; das Warten auf die Datei
  // läuft davon unabhängig weiter.
  const openFilePicker = async (accept: string): Promise<File | null> => {
    const auswahl = await dateiAuswaehlen({
      accept,
      beiRueckkehrOhneAuswahl: () => setPickingMedia(false),
    });
    return auswahl?.[0] ?? null;
  };

  // --- Foto: Dateiauswahl des Systems statt Capacitor Camera.getPhoto.
  // Camera.getPhoto mit CameraSource.Prompt schlug in TestFlight beim Antippen
  // sofort mit "Foto konnte nicht ausgewaehlt werden" fehl. Die Anträge
  // (ActivityRequestModal) nutzen erwiesenermassen zuverlaessig dieses
  // input-file-Muster — iOS zeigt damit nativ Fotomediathek/Kamera/Datei an. ---
  const pickPhoto = async () => {
    setPickingMedia(true);
    try {
      const selected = await openFilePicker('image/*');
      if (!selected) return;
      // Spaet eingetroffene Auswahl: Spinner wieder anzeigen (der Fokus-Fallback
      // hat ihn ggf. schon beendet), das finally setzt ihn zuverlaessig zurück.
      setPickingMedia(true);
      // Derselbe Weg wie im Chat: verkleinern, dann gegen die Grenze prüfen.
      const { file: verkleinert, bildVorschau } = await fuerUploadVorbereiten(selected, MAX_UPLOAD_BYTES);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setFile(verkleinert);
      setMediaPreview(bildVorschau || URL.createObjectURL(verkleinert));
    } catch (err) {
      setError(err instanceof DateiZuGrossFehler ? err.message : 'Foto konnte nicht ausgewählt werden');
    } finally {
      setPickingMedia(false);
    }
  };

  // --- Video: natives Picker-Sheet (kein capture-Attribut, damit iOS die
  // volle Auswahl "Fotomediathek / Kamera aufnehmen / Datei waehlen" zeigt) ---
  const pickVideo = async () => {
    setPickingMedia(true);
    try {
      const selected = await openFilePicker('video/*');
      if (!selected) return;
      setPickingMedia(true);
      // Videos werden nicht neu kodiert (Begründung in mediaCompression);
      // es gilt dieselbe Grenze und derselbe Satz wie für Fotos und im Chat.
      const { file: geprueft } = await fuerUploadVorbereiten(selected, MAX_UPLOAD_BYTES);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setFile(geprueft);
      setMediaPreview(URL.createObjectURL(geprueft));
    } catch (err) {
      setError(err instanceof DateiZuGrossFehler ? err.message : 'Video konnte nicht ausgewählt werden');
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
        // Auch eine Aufnahme hat die Grenze des Servers; sonst scheiterte sie
        // erst beim Einreichen.
        if (audioFile.size > MAX_UPLOAD_BYTES) {
          setError(zuGrossText(MAX_UPLOAD_BYTES));
          return;
        }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
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
    // Vorab-Pruefung gegen die Erlaubnisliste — verbindlich prueft der Server
    // noch einmal dasselbe. So kommt die Rueckmeldung, ohne dass der Beitrag
    // erst abgeschickt werden muss.
    if (mediaType === 'link' && !pruefeMusikLink(linkUrl).ok) {
      setError(`Hier gehen nur Musik-Links: ${ERLAUBTE_DIENSTE_TEXT}. Bitte teile den Link direkt aus einer dieser Apps.`);
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
            // Medien-Uploads können auf Mobilfunk deutlich laenger dauern als
            // die globalen 20s.
            timeout: 180000,
            onUploadProgress: (event) => {
              if (event.total) {
                setUploadProgress(Math.round((event.loaded * 100) / event.total));
              }
            }
          });
        }

        // Anonyme Messung: WELCHE Medienart wird genutzt und wie entscheiden
        // sich die Konfis bei der Sichtbarkeit. Kein Inhalt, keine Kennung.
        track('challenge-beitrag', {
          medium: mediaType,
          sichtbarkeit: isChoice ? consent : 'publish'
        });
        setSuccess(getSuccessMessage(challenge, isChoice ? consent : 'publish'));
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        onSuccess();
      } catch (err) {
        setError(fehlerTextOderMessage(err, 'Fehler beim Einreichen'));
      } finally {
        setUploadProgress(0);
      }
    }).catch(() => {
      // guard wirft, wenn bereits eine Aktion läuft — bewusst ignorieren.
    });
  };

  return {
    availableOptions,
    mediaType,
    handleMediaTypeChange,
    textContent,
    setTextContent,
    linkUrl,
    setLinkUrl,
    file,
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
    currentOption: availableOptions.find((o) => o.value === mediaType),
  };
}

export type ChallengeBeitragZustand = ReturnType<typeof useChallengeBeitrag>;
