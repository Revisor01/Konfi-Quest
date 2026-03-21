import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import { closeOutline, downloadOutline, shareOutline, documentOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import './FileViewerModal.css';

// --- Interfaces ---

export interface FileItem {
  url: string;
  fileName: string;
  mimeType: string;
}

interface FileViewerModalProps {
  // Multi-Datei-Modus
  files?: FileItem[];
  initialIndex?: number;
  // Einzel-Datei-Modus (Rueckwaerts-Kompatibilitaet)
  blobUrl?: string;
  fileName?: string;
  mimeType?: string;
  // Callback
  onClose: () => void;
}

// --- Hilfsfunktionen ---

const getFileCategory = (mimeType: string): 'image' | 'pdf' | 'video' | 'fallback' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  return 'fallback';
};

const getDistance = (t1: React.Touch, t2: React.Touch): number => {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// --- Komponente ---

const FileViewerModal: React.FC<FileViewerModalProps> = (props) => {
  const {
    files: filesProp,
    initialIndex = 0,
    blobUrl,
    fileName,
    mimeType,
    onClose
  } = props;

  // Einzel-Datei in Array wrappen wenn noetig
  const files: FileItem[] = (filesProp && filesProp.length > 0)
    ? filesProp
    : (blobUrl ? [{ url: blobUrl, fileName: fileName || 'Datei', mimeType: mimeType || 'application/octet-stream' }] : []);

  // State
  const [currentIndex, setCurrentIndex] = useState(Math.min(initialIndex, Math.max(files.length - 1, 0)));
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Refs fuer Touch-Handling
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Desktop Mouse-Refs
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null);
  const mousePanStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentFile = files[currentIndex];

  // Reset Zoom bei Index-Wechsel
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // --- Navigation ---
  const goToNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, files.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // --- Touch-Handler (Bild) ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch Start
      pinchStartDistRef.current = getDistance(e.touches[0], e.touches[1]);
      pinchStartScaleRef.current = scale;
      return;
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

      if (scale > 1) {
        // Pan-Modus wenn gezoomt
        panStartRef.current = { x: position.x, y: position.y };
        setIsDragging(true);
      } else {
        // Swipe-Modus
        swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch Zoom
      const dist = getDistance(e.touches[0], e.touches[1]);
      const newScale = Math.max(0.5, Math.min(5, pinchStartScaleRef.current * (dist / pinchStartDistRef.current)));
      setScale(newScale);
      return;
    }
    if (e.touches.length === 1 && isDragging && panStartRef.current && touchStartRef.current) {
      // Pan
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      setPosition({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy
      });
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Doppeltap-Erkennung
    const now = Date.now();
    if (touchStartRef.current && now - lastTapRef.current < 300) {
      // Doppeltap: Toggle Zoom
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2.5);
      }
      lastTapRef.current = 0;
      touchStartRef.current = null;
      setIsDragging(false);
      return;
    }
    lastTapRef.current = now;

    // Swipe-Erkennung (nur wenn nicht gezoomt)
    if (swipeStartRef.current && touchStartRef.current && scale <= 1) {
      const dx = (e.changedTouches[0]?.clientX ?? 0) - swipeStartRef.current.x;
      const dy = (e.changedTouches[0]?.clientY ?? 0) - swipeStartRef.current.y;
      const elapsed = now - touchStartRef.current.time;

      // Horizontaler Swipe fuer Navigation
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && elapsed < 500) {
        if (dx < 0) goToNext();
        else goToPrev();
      }

      // Vertikaler Swipe-Down zum Schliessen
      if (dy > 150 && Math.abs(dy) > Math.abs(dx)) {
        onClose();
      }
    }

    // Snap zurueck bei Zoom < 1
    if (scale < 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }

    touchStartRef.current = null;
    panStartRef.current = null;
    swipeStartRef.current = null;
    setIsDragging(false);
  }, [scale, goToNext, goToPrev, onClose]);

  // --- Desktop Mouse-Handler ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      mouseDownRef.current = { x: e.clientX, y: e.clientY };
      mousePanStartRef.current = { x: position.x, y: position.y };
      setIsDragging(true);
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && mouseDownRef.current && mousePanStartRef.current) {
      const dx = e.clientX - mouseDownRef.current.x;
      const dy = e.clientY - mouseDownRef.current.y;
      setPosition({
        x: mousePanStartRef.current.x + dx,
        y: mousePanStartRef.current.y + dy
      });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    mouseDownRef.current = null;
    mousePanStartRef.current = null;
    setIsDragging(false);
    if (scale < 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // --- Download ---
  const handleDownload = useCallback(async () => {
    if (!currentFile) return;

    if (Capacitor.isNativePlatform()) {
      try {
        // Datei als Blob laden
        const response = await fetch(currentFile.url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const result = await Filesystem.writeFile({
            path: currentFile.fileName,
            data: base64,
            directory: Directory.Cache
          });
          // Nach dem Speichern: Share oeffnen fuer "Speichern unter"
          await Share.share({
            title: currentFile.fileName,
            url: result.uri,
            dialogTitle: 'Datei speichern'
          });
        };
        reader.readAsDataURL(blob);
      } catch {
        // Fallback: Browser-Download
        triggerBrowserDownload(currentFile.url, currentFile.fileName);
      }
    } else {
      triggerBrowserDownload(currentFile.url, currentFile.fileName);
    }
  }, [currentFile]);

  const triggerBrowserDownload = (url: string, name: string) => {
    const a = window.document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  // --- Share (nur nativ) ---
  const handleShare = useCallback(async () => {
    if (!currentFile || !Capacitor.isNativePlatform()) return;

    try {
      const response = await fetch(currentFile.url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await Filesystem.writeFile({
          path: currentFile.fileName,
          data: base64,
          directory: Directory.Cache
        });
        await Share.share({
          title: currentFile.fileName,
          url: result.uri,
          dialogTitle: 'Datei teilen'
        });
      };
      reader.readAsDataURL(blob);
    } catch {
      // Share fehlgeschlagen — still ignorieren
    }
  }, [currentFile]);

  // --- Keyboard-Handler ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  // --- Rendering ---
  if (!currentFile) return null;

  const category = getFileCategory(currentFile.mimeType);
  const isNative = Capacitor.isNativePlatform();

  const renderContent = () => {
    switch (category) {
      case 'image':
        return (
          <div
            ref={containerRef}
            className="file-viewer-image-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={currentFile.url}
              alt={currentFile.fileName}
              className={`file-viewer-image${!isDragging ? ' transitioning' : ''}`}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
              }}
              draggable={false}
            />
          </div>
        );

      case 'pdf':
        return (
          <iframe
            src={currentFile.url}
            title={currentFile.fileName}
            className="file-viewer-pdf"
            allow="fullscreen"
          />
        );

      case 'video':
        return (
          <video
            src={currentFile.url}
            className="file-viewer-video"
            controls
            playsInline
            autoPlay={false}
          />
        );

      case 'fallback':
      default:
        return (
          <div className="file-viewer-fallback">
            <IonIcon icon={documentOutline} className="file-viewer-fallback-icon" />
            <p className="file-viewer-fallback-name">{currentFile.fileName}</p>
            <p className="file-viewer-fallback-type">
              {currentFile.mimeType || 'Unbekannter Dateityp'}
            </p>
            <button className="file-viewer-fallback-btn" onClick={handleDownload}>
              <IonIcon icon={downloadOutline} />
              Herunterladen
            </button>
          </div>
        );
    }
  };

  return (
    <div className="file-viewer-overlay">
      {/* Toolbar */}
      <div className="file-viewer-toolbar">
        <div className="file-viewer-toolbar-left">
          <button className="file-viewer-btn" onClick={onClose} aria-label="Schliessen">
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        <div className="file-viewer-toolbar-center">
          {currentFile.fileName}
        </div>

        <div className="file-viewer-toolbar-right">
          <button className="file-viewer-btn" onClick={handleDownload} aria-label="Herunterladen">
            <IonIcon icon={downloadOutline} />
          </button>
          {isNative && (
            <button className="file-viewer-btn" onClick={handleShare} aria-label="Teilen">
              <IonIcon icon={shareOutline} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="file-viewer-content">
        {renderContent()}
      </div>

      {/* Counter */}
      {files.length > 1 && (
        <div className="file-viewer-counter">
          {currentIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
};

export default FileViewerModal;
