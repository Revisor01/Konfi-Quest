import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonTextarea,
  IonItem,
  IonLabel,
  IonList,
  IonAvatar,
  IonProgressBar,
  IonChip,
  IonFooter,
  IonInput,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonActionSheet,
  useIonModal
} from '@ionic/react';
import { 
  arrowBack, 
  send, 
  attach, 
  camera, 
  document, 
  image,
  barChart,
  download,
  trash,
  checkmark,
  chatbubbles,
  people,
  images,
  folder,
  chevronForward
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import api from '../../services/api';
import PollModal from './modals/PollModal';
import MembersModal from './modals/MembersModal';
import LoadingSpinner from '../common/LoadingSpinner';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { FileOpener } from '@capacitor-community/file-opener';

// Utility function für Dateigröße
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// VideoPreview Komponente mit Blob-URLs und korrektem MIME-Type
const VideoPreview: React.FC<{
  message: Message;
  onError: (error: string) => void;
}> = ({ message, onError }) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const loadVideoBlob = async () => {
      try {
        console.log('🎥 Loading video:', message.file_name, 'from path:', message.file_path);
        setLoading(true);
        setHasError(false);
        
        // Download video als Blob mit korrekter Authentication
        const response = await api.get(`/chat/files/${message.file_path}`, {
          responseType: 'blob'
        });
        
        const blob = response.data;
        console.log('✅ Video blob loaded:', blob.type, blob.size, 'bytes');
        
        // Korrekten MIME-Type basierend auf Dateiendung setzen
        const fileName = message.file_name?.toLowerCase() || '';
        let mimeType = blob.type;
        
        // Fallback für korrekte MIME-Types wenn Server "application/octet-stream" sendet
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
            mimeType = 'video/mp4'; // Default fallback
          }
        }
        
        // Neue Blob mit korrektem MIME-Type erstellen
        const correctedBlob = new Blob([blob], { type: mimeType });
        const blobUrl = URL.createObjectURL(correctedBlob);
        
        console.log('🔗 Video URL created:', blobUrl);
        console.log('📋 MIME-Type corrected from', blob.type, 'to', mimeType);
        
        setVideoUrl(blobUrl);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading video blob:', error);
        setHasError(true);
        setLoading(false);
        onError('Fehler beim Laden des Videos');
      }
    };
    
    if (message.file_path) {
      loadVideoBlob();
    }
    
    // Cleanup: Revoke object URL when component unmounts
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
          
          // Hide controls after 3 seconds
          setTimeout(() => {
            if (isPlaying) {
              setShowControls(false);
            }
          }, 3000);
        }
      }
    } catch (error) {
      console.error('❌ Video play error:', error);
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
          console.error('🚫 Video element error for:', message.file_name, e);
          console.log('Video src:', e.currentTarget.src);
          console.log('Is MOV video:', message.file_name?.toLowerCase().includes('.mov'));
          setHasError(true);
          onError('Video kann nicht abgespielt werden');
        }}
        onLoadedMetadata={async (e) => {
          const video = e.currentTarget;
          console.log('✅ Video metadata loaded for:', message.file_name, {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            networkState: video.networkState,
            poster: video.poster,
            currentSrc: video.currentSrc
          });
          
          // Trick: Video kurz abspielen und sofort pausieren um Thumbnail zu zeigen
          try {
            video.currentTime = 0.1; // Gehe zu 0.1 Sekunden für ersten Frame
            await video.play();
            video.pause();
            video.currentTime = 0; // Zurück zum Anfang
            console.log('🖼️ Thumbnail generated for:', message.file_name);
          } catch (error) {
            console.log('⚠️ Thumbnail generation failed for:', message.file_name, error);
          }
        }}
        onLoadedData={() => {
          console.log('📊 Video data loaded for:', message.file_name);
        }}
        onCanPlay={() => {
          console.log('▶️ Video can play for:', message.file_name);
        }}
        onLoadStart={() => {
          console.log('🎬 Video load started for:', message.file_name);
        }}
        onProgress={(e) => {
          const video = e.currentTarget;
          if (video.buffered.length > 0) {
            console.log('📡 Video buffering progress for:', message.file_name, 
              'buffered:', video.buffered.end(0), 'of', video.duration);
          }
        }}
      />
      
      {/* Play/Pause Button Overlay - nur wenn nicht abgespielt wird */}
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
      
      {/* File Size Badge */}
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

// Lazy Loading Image Component
const LazyImage: React.FC<{
  filePath: string;
  fileName: string;
  onError: () => void;
  onClick: () => void;
}> = ({ filePath, fileName, onError, onClick }) => {
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
          📸 Bild wird geladen...
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
          ❌ Bild konnte nicht geladen werden
        </div>
      )}
    </div>
  );
};


interface Message {
  id: number;
  content: string;
  sender_id: number;
  sender_name: string;
  sender_role_title?: string; // z.B. "Pastor", "Diakonin"
  sender_role_display_name?: string; // z.B. "Admin", "Teamer"
  sender_type: 'admin' | 'konfi';
  created_at: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  message_type: 'text' | 'file' | 'poll';
  is_deleted?: number; // 1 if deleted, 0 if not
  // Poll-Daten direkt in der Message
  question?: string;
  options?: string[];
  votes?: any[];
  multiple_choice?: boolean;
  expires_at?: string;
  poll_id?: number;
  deleted?: boolean;
}

interface ChatRoom {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
  participants?: Array<{
    user_id: number;
    user_type: 'admin' | 'konfi';
    name: string;
    display_name?: string;
  }>;
}

interface ChatRoomProps {
  room: {
    id: number;
    name: string;
    type: 'group' | 'direct' | 'jahrgang' | 'admin';
    participants?: Array<{
      user_id: number;
      user_type: 'admin' | 'konfi';
      name: string;
      display_name?: string;
    }>;
  } | null;
  onBack: () => void;
  presentingElement: HTMLElement | undefined | null;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ room, onBack, presentingElement }) => {
  const { user, setError, setSuccess, markChatRoomAsRead } = useApp();
  const { refreshFromAPI } = useBadge();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Open image with FileOpener (like Activity Requests)
  const openImageWithFileOpener = async (filePath: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      
      // Download with authentication
      const response = await api.get(`/chat/files/${filePath}`, {
        responseType: 'blob'
      });
      
      const blob = response.data;
      const safeFileName = `chat_${filePath.substring(0, 8)}.jpg`;
      
      // Convert to base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
      
      // Ensure temp directory exists
      try {
        await Filesystem.mkdir({
          path: 'temp',
          directory: Directory.Documents,
          recursive: true
        });
      } catch (e) {
        // Directory might already exist
      }
      
      // Write file
      const path = `temp/${safeFileName}`;
      await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: Directory.Documents
      });
      
      // Get file URI
      const fileUri = await Filesystem.getUri({
        directory: Directory.Documents,
        path
      });
      
      // Open with FileOpener
      await FileOpener.open({
        filePath: fileUri.uri,
        contentType: 'image/jpeg'
      });
    } catch (error) {
      console.error('Error opening image:', error);
      setError('Fehler beim Öffnen des Bildes');
    }
  };

  // Hooks müssen vor conditional returns stehen!

  // Poll Modal mit useIonModal Hook (iOS Card Design)
  const [presentPollModalHook, dismissPollModalHook] = useIonModal(PollModal, {
    onClose: () => dismissPollModalHook(),
    onSuccess: () => {
      dismissPollModalHook();
      handlePollCreated();
    },
    roomId: room?.id ?? 0 // ?? statt || für klarere Intention
  });
  
  const openPollModal = () => {
    if (!room) return;
    presentPollModalHook({
      presentingElement: presentingElement || undefined // <-- Verwendet das Prop
    });
  };

  // Members Modal mit useIonModal Hook (iOS Card Design)
  const [presentMembersModalHook, dismissMembersModalHook] = useIonModal(MembersModal, {
    onClose: () => dismissMembersModalHook(),
    onSuccess: () => {
      dismissMembersModalHook();
      loadMessages();
    },
    roomId: room?.id ?? 0,
    roomType: room?.type ?? 'group' 
  });
  
  const openMembersModal = () => {
    if (!room) return;
    presentMembersModalHook({
      presentingElement: presentingElement || undefined // <-- Verwendet das Prop
    });
  };

  // Load messages on mount and setup polling for real-time updates
  useEffect(() => {
    if (!room?.id) return;
    loadMessages();
    markRoomAsRead();
    
    // 5-second polling für Real-time Updates - aber OHNE Auto-Scroll
    const interval = setInterval(async () => {
      // Load messages without auto-scrolling
      await loadMessages();
      // prevMessageCountRef wird vom useEffect für Scroll-Logic verwendet
    }, 5000);
    
    return () => clearInterval(interval);
  }, [room?.id]);

  // Mark as read only when new messages arrive (not every 5 seconds)
  useEffect(() => {
    if (messages.length > 0) {
      markRoomAsRead();
    }
  }, [messages.length]);


  // Track previous message count to only scroll on NEW messages
  const prevMessageCountRef = useRef(0);
  
  useEffect(() => {
    // Only scroll if we actually have new messages (not just reloads)
    if (contentRef.current && shouldAutoScroll && messages.length > prevMessageCountRef.current) {
      contentRef.current.scrollToBottom(300);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, shouldAutoScroll]);

  const loadMessages = async () => {
    // Kein eigener Loading State - ChatRoomView handled das Loading
    if (!room) return;
    try {
      const response = await api.get(`/chat/rooms/${room.id}/messages?limit=100`);
      setMessages(response.data);
      
      // Don't pre-load images anymore - use lazy loading instead for better performance
    } catch (err) {
      setError('Fehler beim Laden der Nachrichten');
      console.error('Error loading messages:', err);
    } finally {
      // Loading wird im ChatRoomView gehandhabt
    }
  };

  const markRoomAsRead = async () => {
    if (!room) return;
    try {
      await api.post(`/chat/rooms/${room.id}/mark-read`);
      // Update global chat notifications state
      markChatRoomAsRead(room.id);
      
      // Einfach: Badge Context neu laden für genaue Counts
      await refreshFromAPI();
      
      console.log('Room marked as read:', room.id);
    } catch (err) {
      // Silent fail - marking as read is not critical
      console.error('Error marking room as read:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!room) return;

    setUploading(true);
    try {
      const formData = new FormData();
      if (messageText.trim()) {
        formData.append('content', messageText.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
        console.log('📎 Uploading file:', selectedFile.name, selectedFile.size, selectedFile.type);
      }
      
      // Debug: Check what we're sending
      console.log('📤 FormData contents:', {
        hasContent: !!messageText.trim(),
        hasFile: !!selectedFile,
        fileName: selectedFile?.name,
        fileSize: selectedFile?.size
      });

      await api.post(`/chat/rooms/${room.id}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // Force multipart/form-data content type for file uploads

      setMessageText('');
      setSelectedFile(null);
      
      // Mark as read BEFORE loading messages to prevent badge increment
      if (room) markRoomAsRead();
      
      // Force scroll to bottom after sending message
      setShouldAutoScroll(true);
      await loadMessages();
      
      // Ensure scroll to bottom after message is loaded
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollToBottom(300);
        }
      }, 100);
    } catch (err) {
      setError('Fehler beim Senden der Nachricht');
      console.error('Error sending message:', err);
    } finally {
      setUploading(false);
    }
  };

  const handlePollCreated = async () => {
    await loadMessages();
  };


  const voteInPoll = async (messageId: number, optionIndex: number) => {
    try {
      setShouldAutoScroll(false); // Prevent auto-scroll when voting
      await api.post(`/chat/polls/${messageId}/vote`, { option_index: optionIndex });
      await loadMessages();
      // Re-enable auto-scroll after a short delay
      setTimeout(() => setShouldAutoScroll(true), 1000);
    } catch (err) {
      setError('Fehler beim Abstimmen');
      console.error('Error voting in poll:', err);
      setShouldAutoScroll(true); // Re-enable on error
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      await api.delete(`/chat/messages/${messageId}`);
      await loadMessages();
      setSuccess('Nachricht gelöscht');
    } catch (err) {
      setError('Fehler beim Löschen der Nachricht');
      console.error('Error deleting message:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('📁 File selected:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'No file');
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Datei ist zu groß (max. 10MB)');
        return;
      }
      setSelectedFile(file);
      console.log('✅ File set as selectedFile');
    }
  };

  const takePicture = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90
      });

      if (photo.dataUrl) {
        // Convert dataUrl to File
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          setError('Foto ist zu groß (max. 10MB)');
          return;
        }
        
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Kamera-Zugriff fehlgeschlagen');
    }
  };

  const selectFromGallery = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90
      });

      if (photo.dataUrl) {
        // Convert dataUrl to File
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          setError('Foto ist zu groß (max. 10MB)');
          return;
        }
        
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      setError('Galerie-Zugriff fehlgeschlagen');
    }
  };


  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleLongPress = async (message: Message) => {
    try {
      // Native haptic feedback
      await Haptics.impact({ style: ImpactStyle.Medium });
      
      // Show action sheet with options
      setSelectedMessage(message);
      setShowActionSheet(true);
    } catch (error) {
      console.error('Error with long press:', error);
    }
  };

  const handleShare = async () => {
    if (!selectedMessage) return;
    
    try {
      if (selectedMessage.file_path) {
        // For files, share the actual file natively
        const fileUrl = `${api.defaults.baseURL}/chat/files/${selectedMessage.file_path}`;
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const fileName = selectedMessage.file_name || 'file';
        
        // Write to Documents directory for sharing
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
        
        const path = `share/${fileName}`;
        await Filesystem.writeFile({
          path,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        
        // Get local file URI for sharing
        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path
        });
        
        await Share.share({
          title: 'Datei aus Konfi Quest',
          text: selectedMessage.content || fileName,
          url: fileUri.uri
        });
      } else {
        // For text messages, share text content
        await Share.share({
          text: selectedMessage.content,
          title: 'Nachricht aus Konfi Quest'
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      if (error instanceof Error && error.name !== 'AbortError') {
        setError('Fehler beim Teilen');
      }
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getDisplayRoomName = () => {
      if (!room) return 'Chat wird geladen...';
      if (room.type === 'direct' && room.participants) {
        const otherParticipant = room.participants.find(p => 
          !(p.user_id === user?.id && p.user_type === user?.type)
        );
        if (otherParticipant) {
          return otherParticipant.display_name || otherParticipant.name || 'Unbekannt';
        }
      }
      return room.name || 'Chat';
    };

  // Early return nach allen Hooks wenn room noch nicht geladen ist
  if (!room) {
    return (
      <>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onBack}>
                <IonIcon icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>Chat wird geladen...</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="app-gradient-background" fullscreen>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Chat wird geladen...</p>
          </div>
        </IonContent>
      </>
    );
  }

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.sender_id === user?.id && message.sender_type === user?.type;
    
    if (message.deleted) {
      return (
        <div key={message.id} style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '8px 16px'
        }}>
          <IonText color="medium" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
            Diese Nachricht wurde gelöscht
          </IonText>
        </div>
      );
    }

    return (
      <div key={message.id} style={{
        display: 'flex',
        flexDirection: isOwnMessage ? 'row-reverse' : 'row',
        margin: '8px 16px',
        alignItems: 'flex-end'
      }}>
        {!isOwnMessage && room.type !== 'direct' && (
          <IonAvatar style={{
            width: '32px',
            height: '32px',
            marginRight: '8px',
            backgroundColor: '#17a2b8'
          }}>
            <div style={{ 
              color: 'white', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              {(message.sender_name || 'U').charAt(0).toUpperCase()}
            </div>
          </IonAvatar>
        )}
        
        <div 
          style={{
            maxWidth: '70%',
            backgroundColor: isOwnMessage ? '#17a2b8' : '#e9ecef',
            color: isOwnMessage ? 'white' : 'black',
            borderRadius: '16px',
            padding: '12px',
            position: 'relative',
            cursor: 'pointer'
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            handleLongPress(message);
          }}
          onTouchStart={(e) => {
            const timeoutId = setTimeout(() => {
              handleLongPress(message);
            }, 500);
            
            const cleanup = () => {
              clearTimeout(timeoutId);
              e.target.removeEventListener('touchend', cleanup);
              e.target.removeEventListener('touchmove', cleanup);
              e.target.removeEventListener('touchcancel', cleanup);
            };
            
            e.target.addEventListener('touchend', cleanup);
            e.target.addEventListener('touchmove', cleanup);
            e.target.addEventListener('touchcancel', cleanup);
          }}
        >
          {!isOwnMessage && room.type !== 'direct' && (
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 'bold',
              marginBottom: '4px',
              color: '#17a2b8'
            }}>
              {message.sender_name || 'Unbekannter User'}
              {(message.sender_role_title || message.sender_role_display_name) && (
                <span style={{
                  fontWeight: 'normal',
                  color: '#6c757d',
                  marginLeft: '6px'
                }}>
                  ({message.sender_role_title || message.sender_role_display_name})
                </span>
              )}
            </div>
          )}
          
          {message.is_deleted ? (
            <div style={{
              fontStyle: 'italic',
              opacity: 0.6,
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
            }}>
              🗑️ {message.content}
            </div>
          ) : message.message_type === 'poll' && message.question && message.options ? (
            <div style={{
              background: 'rgba(128, 128, 128, 0.1)',
              borderRadius: '16px',
              padding: '20px',
              marginTop: '8px',
              border: '1px solid rgba(128, 128, 128, 0.2)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                fontWeight: '600', 
                marginBottom: '16px',
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: isOwnMessage ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)'
              }}>
                <span style={{
                  fontSize: '1.3rem',
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                }}>
                  📊
                </span>
                {message.question}
              </div>
              
              {message.expires_at && (
                <div style={{
                  fontSize: '0.85rem',
                  opacity: 0.8,
                  marginBottom: '16px',
                  padding: '8px 12px',
                  background: isOwnMessage 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'rgba(0,0,0,0.05)',
                  borderRadius: '8px',
                  border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)'
                }}>
                  ⏰ Läuft ab: {new Date(message.expires_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              )}
              
              {message.options.map((option, index) => {
                // Stimmen für diese Option zählen
                const optionVotes = message.votes?.filter(vote => vote.option_index === index) || [];
                const totalVotes = message.votes?.length || 0;
                const percentage = totalVotes > 0 ? (optionVotes.length / totalVotes) * 100 : 0;
                
                // Prüfen ob aktueller User abgestimmt hat
                const userVoted = message.votes?.some(vote => 
                  vote.user_id === user?.id && 
                  vote.user_type === user?.type && 
                  vote.option_index === index
                );
                
                return (
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <div
                      onClick={() => voteInPoll(message.id, index)}
                      style={{
                        background: userVoted 
                          ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.2) 0%, rgba(76, 175, 80, 0.1) 100%)' 
                          : isOwnMessage 
                            ? 'rgba(255,255,255,0.12)' 
                            : 'rgba(0,0,0,0.06)',
                        border: userVoted 
                          ? '2px solid #4caf50' 
                          : `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'}`,
                        borderRadius: '12px',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        boxShadow: userVoted 
                          ? '0 4px 16px rgba(76, 175, 80, 0.25)' 
                          : '0 2px 8px rgba(0,0,0,0.08)',
                        transform: 'translateZ(0)',
                      }}
                      onMouseEnter={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.transform = 'translateY(-1px)';
                        target.style.boxShadow = userVoted 
                          ? '0 6px 20px rgba(76, 175, 80, 0.3)' 
                          : '0 4px 12px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.transform = 'translateZ(0)';
                        target.style.boxShadow = userVoted 
                          ? '0 4px 16px rgba(76, 175, 80, 0.25)' 
                          : '0 2px 8px rgba(0,0,0,0.08)';
                      }}
                    >
                      {/* Progress Bar Background */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${percentage}%`,
                        background: userVoted 
                          ? 'linear-gradient(90deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.08) 100%)' 
                          : isOwnMessage 
                            ? 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                            : 'linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.03) 100%)',
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        borderRadius: '10px'
                      }} />
                      
                      {/* Content */}
                      <div style={{ 
                        position: 'relative', 
                        zIndex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {userVoted && (
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: 'linear-gradient(45deg, #4caf50, #66bb6a)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(76, 175, 80, 0.4)'
                            }}>
                              <IonIcon 
                                icon={checkmark} 
                                style={{ 
                                  color: 'white',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold'
                                }} 
                              />
                            </div>
                          )}
                          <span style={{ 
                            fontWeight: userVoted ? '600' : '500',
                            color: isOwnMessage ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)',
                            fontSize: '0.95rem'
                          }}>
                            {option}
                          </span>
                        </div>
                        
                        <div style={{ 
                          fontSize: '0.85rem',
                          opacity: 0.85,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isOwnMessage 
                            ? 'rgba(255,255,255,0.12)' 
                            : 'rgba(0,0,0,0.08)',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                        }}>
                          <span style={{ fontWeight: '600' }}>{optionVotes.length}</span>
                          <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                            ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Poll Info */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: isOwnMessage 
                  ? 'rgba(255,255,255,0.08)' 
                  : 'rgba(0,0,0,0.04)',
                borderRadius: '10px',
                border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                }}>
                  <span style={{ fontSize: '0.9rem' }}>
                    {message.multiple_choice ? '☑️' : '🔘'}
                  </span>
                  <span>
                    {message.multiple_choice ? 'Mehrfachauswahl möglich' : 'Nur eine Antwort'}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  opacity: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                }}>
                  <span>👥</span>
                  <span>
                    {message.votes?.length || 0} Stimme{(message.votes?.length || 0) !== 1 ? 'n' : ''} insgesamt
                  </span>
                </div>
              </div>
            </div>
          ) : message.file_path ? (
            <div>
              {message.content && (
                <div style={{ marginBottom: '8px' }}>{message.content}</div>
              )}
              {message.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                // Inline Bild-Anzeige mit Lazy Loading
                <div style={{ marginBottom: '8px' }}>
                  <LazyImage 
                    filePath={message.file_path}
                    fileName={message.file_name}
                    onError={() => setError('Fehler beim Laden des Bildes')}
                    onClick={async () => {
                      try {
                        await Haptics.impact({ style: ImpactStyle.Light });
                        
                        // Download image with authentication
                        const response = await api.get(`/chat/files/${message.file_path}`, {
                          responseType: 'blob'
                        });
                        const blob = response.data;
                        const fileName = message.file_name || 'image.jpg';
                        
                        // Write to Documents directory
                        const base64Data = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64 = (reader.result as string).split(',')[1];
                            resolve(base64);
                          };
                          reader.readAsDataURL(blob);
                        });
                        
                        // Ensure temp directory exists
                        try {
                          await Filesystem.mkdir({
                            path: 'temp',
                            directory: Directory.Documents,
                            recursive: true
                          });
                        } catch (e) {
                          // Directory might already exist
                        }
                        
                        const path = `temp/${fileName}`;
                        await Filesystem.writeFile({
                          path,
                          data: base64Data,
                          directory: Directory.Documents
                        });
                        
                        // Get local file URI and open with native viewer
                        const fileUri = await Filesystem.getUri({
                          directory: Directory.Documents,
                          path
                        });
                        
                        await FileOpener.open({
                          filePath: fileUri.uri,
                          contentType: 'image/jpeg'
                        });
                      } catch (error) {
                        console.error('Error opening image:', error);
                        setError('Fehler beim Öffnen des Bildes');
                      }
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px' }}>
                    {message.file_name} • {message.file_size && formatFileSize(message.file_size)}
                  </div>
                </div>
              ) : message.file_name?.match(/\.(mp4|mov|avi|webm|m4v)$/i) ? (
                // HTML5 Video mit Blob-URL und korrektem MIME-Type
                <VideoPreview 
                  message={message} 
                  onError={(error) => setError('Fehler beim Laden des Videos: ' + error)}
                />
              ) : (
                // Datei-Anhang für andere Dateitypen
                <div 
                  style={{
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onClick={async () => {
                    try {
                      await Haptics.impact({ style: ImpactStyle.Medium });
                      const fileUrl = `${api.defaults.baseURL}/chat/files/${message.file_path}`;
                      
                      // Für PDF und andere Dokumente: Native File Viewer verwenden
                      if (message.file_name?.match(/\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i)) {
                        try {
                          // Download file with authentication
                          const response = await api.get(`/chat/files/${message.file_path}`, {
                            responseType: 'blob'
                          });
                          const blob = response.data;
                          const fileName = message.file_name || 'document';
                          
                          // Write to Documents directory (not Cache)
                          const base64Data = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const base64 = (reader.result as string).split(',')[1];
                              resolve(base64);
                            };
                            reader.readAsDataURL(blob);
                          });
                          
                          const path = `temp/${fileName}`;
                          await Filesystem.writeFile({
                            path,
                            data: base64Data,
                            directory: Directory.Documents,
                            recursive: true
                          });
                          
                          // Get local file URI and open with native viewer
                          const fileUri = await Filesystem.getUri({
                            directory: Directory.Documents,
                            path
                          });
                          
                          await FileViewer.openDocumentFromLocalPath({
                            path: fileUri.uri
                          });
                        } catch (viewerError) {
                          console.warn('Native viewer failed, using fallback:', viewerError);
                          window.open(fileUrl, '_blank');
                        }
                      } else {
                        // Für andere Dateien: Standard Browser-Download
                        window.open(fileUrl, '_blank');
                      }
                    } catch (error) {
                      console.error('Error opening document:', error);
                      setError('Fehler beim Öffnen der Datei');
                    }
                  }}
                >
                  <IonIcon 
                    icon={message.file_name?.includes('.pdf') ? document : attach} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {message.file_name}
                    </div>
                    {message.file_size && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        {formatFileSize(message.file_size)}
                      </div>
                    )}
                  </div>
                  <IonIcon 
                    icon={chevronForward} 
                    style={{ 
                      fontSize: '1.2rem',
                      opacity: 0.7
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>{message.content}</div>
          )}
          
          <div style={{ 
            fontSize: '0.7rem', 
            opacity: 0.7, 
            marginTop: '4px',
            textAlign: 'right'
          }}>
            {formatMessageTime(message.created_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{getDisplayRoomName()}</IonTitle>
          {user?.type === 'admin' && (
            <IonButtons slot="end">
              <IonButton onClick={openMembersModal}>
                <IonIcon icon={people} />
              </IonButton>
              <IonButton onClick={openPollModal}>
                <IonIcon icon={barChart} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      
      <IonContent ref={contentRef} className="app-gradient-background" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadMessages();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ paddingBottom: '120px' }}>
          {messages.map(renderMessage)}
        </div>
      </IonContent>

      {/* File Preview außerhalb des Footers für bessere Sichtbarkeit */}
      {selectedFile && (
        <div style={{
          position: 'fixed',
          bottom: '80px', // Oberhalb des Footers
          left: '16px',
          right: '16px',
          backgroundColor: 'var(--ion-color-light-shade, #f8f9fa)',
          border: '1px solid var(--ion-color-step-150, #e0e0e0)',
          borderRadius: '8px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <IonIcon icon={attach} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedFile.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ion-color-medium)' }}>{formatFileSize(selectedFile.size)}</div>
          </div>
          <IonButton fill="clear" size="small" onClick={() => setSelectedFile(null)}>
            <IonIcon icon={trash} />
          </IonButton>
        </div>
      )}

      <IonFooter>
        <IonToolbar style={{
          '--min-height': 'auto', // Damit es sich an den Inhalt anpasst
          '--padding-start': '16px',
          '--padding-end': '16px'
        }}>
          {/* Dieses DIV ist der Flex-Container für Input und Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end', // Aligns items to the bottom, useful for autoGrow textarea
            gap: '8px',
            width: '100%' // Wichtig, damit es die volle Breite einnimmt
          }}>

            <IonButton
              fill="clear"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              style={{
                '--padding-start': '0',
                '--padding-end': '0',
                fontSize: '20px' // Attach Icon größer machen
              }}
            >
              <IonIcon icon={attach} />
            </IonButton>


            <IonTextarea
              value={messageText}
              onIonInput={(e) => setMessageText(e.detail.value!)}
              placeholder="Nachricht schreiben..."
              autoGrow
              rows={1}
              style={{
                flex: 1, // Nimmt den restlichen Platz ein
                // '--background': 'var(--ion-color-light-shade, #f8f9fa)',
                '--border-radius': '20px',
                '--padding-start': '12px',
                '--padding-end': '12px',
                '--box-shadow': 'none',
                // Adjust margin-bottom slightly if it conflicts with align-items: flex-end
                marginBottom: '0',
                // Ensure text color is readable on the background
                '--color': 'var(--ion-text-color)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <IonButton
              fill="solid"
              shape="round"
              size="small"
              disabled={(!messageText.trim() && !selectedFile) || uploading}
              onClick={sendMessage}
              style={{
                '--height': '36px',
                '--min-height': '36px',
                '--border-radius': '18px',
                '--padding-start': '0',
                '--padding-end': '0',
                minWidth: '36px',
                maxWidth: '36px',
                fontSize: '14px', // Send Icon kleiner machen
                // Adjust margin-bottom to align with the text area
              }}
            >
              {uploading ? <IonSpinner name="dots" /> : <IonIcon icon={send} />}
            </IonButton>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
          </div> {/* Ende des Flex-Containers */}
        </IonToolbar>
      </IonFooter>

      {/* Action Sheet für Longpress */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => {
          setShowActionSheet(false);
          setSelectedMessage(null);
        }}
        buttons={[
          {
            text: 'Teilen',
            icon: 'share-outline',
            handler: () => {
              handleShare();
            }
          },
          ...((user?.role_name && ['admin', 'org_admin', 'teamer'].includes(user.role_name)) ? [{
            text: 'Löschen',
            icon: 'trash-outline',
            role: 'destructive' as const,
            handler: () => {
              if (selectedMessage) {
                deleteMessage(selectedMessage.id);
              }
            }
          }] : []),
          {
            text: 'Abbrechen',
            icon: 'close-outline',
            role: 'cancel' as const
          }
        ]}
      />

    </>
  );
};

export default ChatRoom;