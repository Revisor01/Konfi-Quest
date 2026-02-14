import React, { useState, useEffect, useRef } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import api from '../../services/api';
import { Message } from '../../types/chat';
import { formatFileSize } from '../../utils/helpers';

interface VideoPreviewProps {
  message: Message;
  onError: (error: string) => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ message, onError }) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadVideoBlob = async () => {
      try {
        console.log('Loading video:', message.file_name, 'from path:', message.file_path);
        setLoading(true);
        setHasError(false);

        const response = await api.get(`/chat/files/${message.file_path}`, {
          responseType: 'blob'
        });

        const blob = response.data;
        console.log('Video blob loaded:', blob.type, blob.size, 'bytes');

        const fileName = message.file_name?.toLowerCase() || '';
        let mimeType = blob.type;

        if (!mimeType || mimeType === 'application/octet-stream') {
          if (fileName.endsWith('.mov')) {
            mimeType = 'video/quicktime';
          } else if (fileName.endsWith('.mp4')) {
            mimeType = 'video/mp4';
          } else if (fileName.endsWith('.webm')) {
            mimeType = 'video/webm';
          } else if (fileName.endsWith('.avi')) {
            mimeType = 'video/x-msvideo';
          } else if (fileName.endsWith('.m4v')) {
            mimeType = 'video/x-m4v';
          } else {
            mimeType = 'video/mp4';
          }
        }

        const correctedBlob = new Blob([blob], { type: mimeType });
        const blobUrl = URL.createObjectURL(correctedBlob);

        console.log('Video URL created:', blobUrl);
        console.log('MIME-Type corrected from', blob.type, 'to', mimeType);

        setVideoUrl(blobUrl);
        setLoading(false);
      } catch (error) {
        console.error('Error loading video blob:', error);
        setHasError(true);
        setLoading(false);
        onError('Fehler beim Laden des Videos');
      }
    };

    if (message.file_path) {
      loadVideoBlob();
    }

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [message.file_path]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoClick = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });

      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          await videoRef.current.play();
          setIsPlaying(true);
          setShowControls(true);

          setTimeout(() => {
            if (isPlaying) {
              setShowControls(false);
            }
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Video play error:', error);
      onError('Fehler beim Abspielen des Videos');
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setShowControls(false);
  };

  if (loading) {
    return (
      <div style={{
        position: 'relative',
        maxWidth: '280px',
        height: '200px',
        borderRadius: '12px',
        backgroundColor: '#1e1e1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: 'white', opacity: 0.7 }}>Video wird geladen...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div style={{
        position: 'relative',
        maxWidth: '280px',
        height: '200px',
        borderRadius: '12px',
        backgroundColor: '#1e1e1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: 'white', opacity: 0.7 }}>Fehler beim Laden</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', maxWidth: '280px', borderRadius: '12px', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        src={videoUrl}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '200px',
          minHeight: '120px',
          display: 'block',
          borderRadius: '12px',
          backgroundColor: '#000',
          cursor: 'pointer',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
        preload="metadata"
        muted={!isPlaying}
        playsInline
        controls={showControls}
        onClick={handleVideoClick}
        onEnded={handleVideoEnd}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={(e) => {
          console.error('Video element error for:', message.file_name, e);
          setHasError(true);
          onError('Video kann nicht abgespielt werden');
        }}
        onLoadedMetadata={async (e) => {
          const video = e.currentTarget;
          try {
            video.currentTime = 0.1;
            await video.play();
            video.pause();
            video.currentTime = 0;
            console.log('Thumbnail generated for:', message.file_name);
          } catch (error) {
            console.log('Thumbnail generation failed for:', message.file_name, error);
          }
        }}
      />

      {!isPlaying && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
            zIndex: 10
          }}
        >
          <div style={{
            width: '0',
            height: '0',
            borderLeft: '20px solid white',
            borderTop: '12px solid transparent',
            borderBottom: '12px solid transparent',
            marginLeft: '4px'
          }} />
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '500',
        pointerEvents: 'none',
        zIndex: 5
      }}>
        {message.file_size && formatFileSize(message.file_size)}
      </div>
    </div>
  );
};

export default VideoPreview;
