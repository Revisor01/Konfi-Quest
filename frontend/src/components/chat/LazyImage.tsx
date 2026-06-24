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
  // Aktuell vergebene Object-URL, damit wir sie beim Unmount/filePath-Wechsel
  // freigeben koennen (sonst Memory-Leak).
  const objectUrlRef = useRef<string>('');
  // onError als Ref halten: MessageBubble uebergibt einen Inline-Arrow, der bei
  // JEDEM Render neu entsteht. Laege er in der useEffect-Dependency-Liste, wuerde
  // der Effekt staendig neu laufen, die Object-URL revoken und das Bild neu laden
  // -> Reload-Loop + Springen beim Scrollen. Ueber die Ref bleibt der Effekt an
  // `filePath` gebunden und laeuft pro Bild nur EINMAL.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    const loadOnce = async () => {
      // Schon geladen? Nichts tun (z.B. wenn das Bild raus- und wieder
      // reinscrollt — es ist bereits da, kein erneuter Cache-/Netz-Zugriff).
      if (objectUrlRef.current) return;
      setIsLoading(true);
      try {
        const url = await getMediaObjectUrl(filePath);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlRef.current = url;
        setImageSrc(url);
      } catch (error) {
        console.error('Error loading lazy image:', error);
        if (!cancelled) onErrorRef.current();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !objectUrlRef.current) {
          // Einmal sichtbar -> laden, danach nicht mehr beobachten. So gibt es
          // kein wiederholtes Re-Triggern beim Scrollen.
          observer.disconnect();
          loadOnce();
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
    };
    // NUR filePath — onError/onClick bewusst ausgeklammert (siehe onErrorRef).
  }, [filePath]);

  // Object-URL erst beim echten Unmount (oder filePath-Wechsel) freigeben.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [filePath]);

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
      {imageSrc ? (
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
      ) : isLoading ? (
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          Bild wird geladen...
        </div>
      ) : (
        <div style={{ color: '#999', fontSize: '0.8rem' }}>
          Bild konnte nicht geladen werden
        </div>
      )}
    </div>
  );
};

export default LazyImage;
