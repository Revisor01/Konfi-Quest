import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { play, pause } from 'ionicons/icons';

// Gestylter, kompakter Audio-Player fuer Challenge-Beitraege (Galerie, eigene
// Beitraege, Aufnahme-Vorschau). Ersetzt den nackten <audio controls>-Player.
//
// iOS-WebView-Falle: "duration" kann direkt nach dem Setzen von src erstmal
// Infinity oder NaN sein (kaputte/fehlende Content-Length bei Blob-URLs bzw.
// MediaRecorder-Output ohne Duration-Header). Deshalb wird die Dauer NICHT aus
// "loadedmetadata" uebernommen, wenn sie nicht endlich ist, sondern erst aus
// "durationchange", sobald ein brauchbarer Wert reinkommt. Bis dahin "-:--".

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '-:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface AudioPlayerProps {
  src: string;
  /** Akzentfarbe fuer Button und Fortschrittsbalken. */
  color?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, color = 'var(--app-color-challenges)' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  // Beim Quellenwechsel Zustand zuruecksetzen.
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(null);
  }, [src]);

  const handleDurationChange = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const value = audioEl.duration;
    if (Number.isFinite(value) && value > 0) {
      setDuration(value);
    }
  };

  const handleLoadedMetadata = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const value = audioEl.duration;
    if (Number.isFinite(value) && value > 0) {
      setDuration(value);
    }
    // Manche iOS-WebViews liefern bei Blob-Quellen erst Infinity und wuerden
    // erst durch kurzes Ans-Ende-Springen eine brauchbare Dauer preisgeben.
    // Der Trick funktioniert nicht ueberall zuverlaessig — daher nur als
    // best-effort Ergaenzung zu "durationchange", nicht als einzige Quelle.
    else if (value === Infinity) {
      const el = audioEl;
      const onTimeUpdate = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          setDuration(el.duration);
        }
        el.currentTime = 0;
        el.removeEventListener('timeupdate', onTimeUpdate);
      };
      el.addEventListener('timeupdate', onTimeUpdate);
      el.currentTime = 1e7;
    }
  };

  const handleTimeUpdate = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    setCurrentTime(audioEl.currentTime);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const togglePlay = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play().catch(() => undefined);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const value = Number(e.target.value);
    audioEl.currentTime = value;
    setCurrentTime(value);
  };

  const seekMax = duration && Number.isFinite(duration) ? duration : 0;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginTop: '8px', padding: '8px 10px', borderRadius: '10px',
        background: 'rgba(0,0,0,0.03)'
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onDurationChange={handleDurationChange}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Abspielen'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          border: 'none', background: color, color: '#fff', cursor: 'pointer',
          padding: 0
        }}
      >
        <IonIcon icon={isPlaying ? pause : play} style={{ fontSize: '1.05rem' }} />
      </button>

      <input
        type="range"
        min={0}
        max={seekMax}
        step={0.1}
        value={Math.min(currentTime, seekMax)}
        onChange={handleSeek}
        disabled={!seekMax}
        style={{
          flex: 1, minWidth: 0, accentColor: color, height: '4px', cursor: seekMax ? 'pointer' : 'default'
        }}
      />

      <span
        style={{
          fontSize: '0.75rem', color: '#8e8e93', flexShrink: 0,
          minWidth: '68px', textAlign: 'right', fontVariantNumeric: 'tabular-nums'
        }}
      >
        {formatTime(currentTime)} / {duration !== null ? formatTime(duration) : '-:--'}
      </span>
    </div>
  );
};

export default AudioPlayer;
