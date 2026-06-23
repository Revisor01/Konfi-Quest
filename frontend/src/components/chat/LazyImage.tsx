import React, { useState, useEffect, useRef } from 'react';
import { getMediaObjectUrl } from '../../services/mediaCache';

interface LazyImageProps {
  filePath: string;
  fileName: string;
  onError: () => void;
  onClick: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({ filePath, fileName, onError, onClick }) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLDivElement>(null);
  // Aktuell vergebene Object-URL, damit wir sie beim Unmount/Wechsel freigeben
  // koennen (sonst Memory-Leak — das war der alte Bug).
  const objectUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !objectUrlRef.current) {
          setIsLoading(true);
          try {
            // Aus lokalem Cache laden (oder einmalig vom Server + cachen).
            const url = await getMediaObjectUrl(filePath);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            objectUrlRef.current = url;
            setImageSrc(url);
          } catch (error) {
            console.error('Error loading lazy image:', error);
            if (!cancelled) onError();
          } finally {
            if (!cancelled) setIsLoading(false);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      // Object-URL freigeben (Leak-Fix).
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [filePath, onError]);

  return (
    <div
      ref={imgRef}
      style={{
        maxWidth: '100%',
        maxHeight: '300px',
        borderRadius: '8px',
        backgroundColor: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: imageSrc ? 'pointer' : 'default',
        minHeight: '100px'
      }}
      onClick={imageSrc ? onClick : undefined}
    >
      {isLoading ? (
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          Bild wird geladen...
        </div>
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt={fileName}
          style={{
            maxWidth: '100%',
            maxHeight: '300px',
            borderRadius: '8px',
            objectFit: 'cover'
          }}
        />
      ) : (
        <div style={{ color: '#999', fontSize: '0.8rem' }}>
          Bild konnte nicht geladen werden
        </div>
      )}
    </div>
  );
};

export default LazyImage;
