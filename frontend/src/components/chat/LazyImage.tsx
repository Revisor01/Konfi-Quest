import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

interface LazyImageProps {
  filePath: string;
  fileName: string;
  onError: () => void;
  onClick: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({ filePath, fileName, onError, onClick }) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !imageSrc) {
          setIsLoading(true);
          try {
            const response = await api.get(`/chat/files/${filePath}`, {
              responseType: 'blob'
            });
            const blob = response.data;
            const imageUrl = URL.createObjectURL(blob);
            setImageSrc(imageUrl);
          } catch (error) {
            console.error('Error loading lazy image:', error);
            onError();
          } finally {
            setIsLoading(false);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [filePath, imageSrc, onError]);

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
