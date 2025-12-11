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
  useIonModal,
  useIonAlert
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
  trashOutline,
  checkmark,
  chatbubbles,
  people,
  images,
  folder,
  chevronForward,
  time,
  returnUpBack,
  closeCircle,
  thumbsUpOutline,
  thumbsUp,
  heartOutline,
  heart,
  happyOutline,
  happy,
  alertCircleOutline,
  alertCircle,
  sadOutline,
  sad,
  handLeftOutline,
  handLeft,
  addOutline,
  arrowUndoOutline,
  shareOutline,
  arrowDownOutline
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import api from '../../services/api';
import { initializeWebSocket, getSocket, joinRoom, leaveRoom, disconnectWebSocket } from '../../services/websocket';
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


interface Reaction {
  id: number;
  emoji: string;
  user_id: number;
  user_type: 'admin' | 'konfi';
  user_name: string;
}

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
  message_type: 'text' | 'file' | 'poll' | 'image' | 'video';
  is_deleted?: number; // 1 if deleted, 0 if not
  // Poll-Daten direkt in der Message
  question?: string;
  options?: string[];
  votes?: any[];
  multiple_choice?: boolean;
  expires_at?: string;
  poll_id?: number;
  deleted?: boolean;
  // Reply-Daten
  reply_to?: number;
  reply_to_id?: number;
  reply_to_content?: string;
  reply_to_file_name?: string;
  reply_to_message_type?: string;
  reply_to_sender_name?: string;
  // Reaktionen
  reactions?: Reaction[];
}

// Emoji-Mapping: Interne IDs zu Ionicons
const REACTION_EMOJIS: { [key: string]: { outline: string; filled: string; label: string; color: string } } = {
  like: { outline: thumbsUpOutline, filled: thumbsUp, label: 'Gefaellt mir', color: '#3b82f6' },
  heart: { outline: heartOutline, filled: heart, label: 'Liebe', color: '#ef4444' },
  laugh: { outline: happyOutline, filled: happy, label: 'Lustig', color: '#f59e0b' },
  wow: { outline: alertCircleOutline, filled: alertCircle, label: 'Wow', color: '#8b5cf6' },
  sad: { outline: sadOutline, filled: sad, label: 'Traurig', color: '#6b7280' },
  pray: { outline: handLeftOutline, filled: handLeft, label: 'Beten', color: '#10b981' }
};

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
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetMessage, setReactionTargetMessage] = useState<Message | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLIonTextareaElement>(null);
  const scrollPositionRef = useRef<number>(0);


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
  const [presentAlert] = useIonAlert();

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

  // Load messages on mount and setup WebSocket for real-time updates
  useEffect(() => {
    if (!room?.id) return;
    loadMessages();
    markRoomAsRead();

    // WebSocket: Join room and listen for new messages
    const token = localStorage.getItem('konfi_token');
    if (token) {
      const socket = initializeWebSocket(token);

      // Join room when connected (or immediately if already connected)
      // WICHTIG: socket.on statt socket.once - damit bei JEDEM Reconnect joinRoom aufgerufen wird!
      const handleConnect = () => {
        joinRoom(room.id);
      };

      if (socket.connected) {
        joinRoom(room.id);
      }
      socket.on('connect', handleConnect);

      // Listen for new messages
      socket.on('newMessage', (data: { roomId: number; message: any }) => {
        if (data.roomId === room.id) {
          console.log('📡 WebSocket: New message received');
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      });

      // Listen for deleted messages
      socket.on('messageDeleted', (data: { roomId: number; messageId: number }) => {
        if (data.roomId === room.id) {
          console.log('📡 WebSocket: Message deleted');
          setMessages(prev => prev.map(m =>
            m.id === data.messageId ? { ...m, deleted_at: new Date().toISOString() } : m
          ));
        }
      });

      // Listen for typing indicators
      socket.on('userTyping', (data: { roomId: number; userId: number; userName: string }) => {
        if (data.roomId === room.id && data.userId !== user?.id) {
          // Could show typing indicator here
          console.log(`${data.userName} is typing...`);
        }
      });

      // Listen for reaction added
      socket.on('reactionAdded', (data: { roomId: number; messageId: number; reaction: Reaction }) => {
        if (data.roomId === room.id) {
          setMessages(prev => prev.map(m => {
            if (m.id !== data.messageId) return m;
            const reactions = m.reactions || [];
            // Avoid duplicates
            if (reactions.some(r => r.id === data.reaction.id)) return m;
            return { ...m, reactions: [...reactions, data.reaction] };
          }));
        }
      });

      // Listen for reaction removed
      socket.on('reactionRemoved', (data: { roomId: number; messageId: number; userId: number; userType: string; emoji: string }) => {
        if (data.roomId === room.id) {
          setMessages(prev => prev.map(m => {
            if (m.id !== data.messageId) return m;
            return {
              ...m,
              reactions: (m.reactions || []).filter(r =>
                !(r.user_id === data.userId && r.user_type === data.userType && r.emoji === data.emoji)
              )
            };
          }));
        }
      });
    }

    // Fallback: 30-second polling als Backup (falls WebSocket ausfaellt)
    const interval = setInterval(async () => {
      await loadMessages();
    }, 30000);

    return () => {
      clearInterval(interval);
      if (room?.id) {
        leaveRoom(room.id);
      }
      const socket = getSocket();
      if (socket) {
        socket.off('connect');
        socket.off('newMessage');
        socket.off('messageDeleted');
        socket.off('userTyping');
        socket.off('reactionAdded');
        socket.off('reactionRemoved');
      }
    };
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
    // Always scroll to bottom on initial load or new messages
    if (contentRef.current && messages.length > 0) {
      if (isInitialLoad) {
        // Initial load - scroll immediately without animation
        setTimeout(() => {
          contentRef.current?.scrollToBottom(0);
        }, 50);
        setIsInitialLoad(false);
      } else if (shouldAutoScroll && messages.length > prevMessageCountRef.current) {
        // New message - smooth scroll
        contentRef.current.scrollToBottom(300);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, shouldAutoScroll, isInitialLoad]);

  // Scroll listener fuer Scroll-to-Bottom Button
  useEffect(() => {
    const checkScrollPosition = async () => {
      if (!contentRef.current) return;
      const scrollElement = await contentRef.current.getScrollElement();
      const scrollTop = scrollElement.scrollTop;
      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = scrollElement.clientHeight;

      // Zeige Button wenn mehr als 300px vom Ende entfernt
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollToBottom(distanceFromBottom > 300);
    };

    const setupScrollListener = async () => {
      if (!contentRef.current) return;
      const scrollElement = await contentRef.current.getScrollElement();
      scrollElement.addEventListener('scroll', checkScrollPosition);
      return () => scrollElement.removeEventListener('scroll', checkScrollPosition);
    };

    const cleanup = setupScrollListener();
    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, []);

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
        console.log('Uploading file:', selectedFile.name, selectedFile.size, selectedFile.type);
      }
      // Reply-Referenz hinzufuegen wenn vorhanden
      if (replyToMessage) {
        formData.append('reply_to', replyToMessage.id.toString());
      }

      // Debug: Check what we're sending
      console.log('FormData contents:', {
        hasContent: !!messageText.trim(),
        hasFile: !!selectedFile,
        fileName: selectedFile?.name,
        fileSize: selectedFile?.size,
        replyTo: replyToMessage?.id
      });

      await api.post(`/chat/rooms/${room.id}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // Force multipart/form-data content type for file uploads

      setMessageText('');
      setReplyToMessage(null); // Reset reply after sending
      clearSelectedFile();

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

  const deleteMessage = (messageId: number) => {
    presentAlert({
      header: 'Nachricht löschen?',
      message: 'Diese Nachricht unwiderruflich löschen?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            api.delete(`/chat/messages/${messageId}`)
              .then(() => {
                loadMessages();
                setSuccess('Nachricht gelöscht');
              })
              .catch((err) => {
                setError('Fehler beim Löschen der Nachricht');
                console.error('Error deleting message:', err);
              });
          }
        }
      ]
    });
  };

  // Reaktion hinzufuegen/entfernen
  const toggleReaction = async (messageId: number, emoji: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      setShouldAutoScroll(false);

      const response = await api.post(`/chat/messages/${messageId}/reactions`, { emoji });

      // Optimistic update - direkt im State aktualisieren
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions || [];
        if (response.data.action === 'added') {
          // Prüfe ob Reaktion schon existiert (verhindert Duplikate durch WebSocket)
          const alreadyExists = reactions.some(r =>
            r.user_id === user!.id && r.user_type === user!.type && r.emoji === emoji
          );
          if (alreadyExists) return msg;

          // Reaktion hinzufügen
          return {
            ...msg,
            reactions: [...reactions, {
              id: response.data.id,
              emoji,
              user_id: user!.id,
              user_type: user!.type as 'admin' | 'konfi',
              user_name: user!.display_name || ''
            }]
          };
        } else {
          // Reaktion entfernen
          return {
            ...msg,
            reactions: reactions.filter(r =>
              !(r.user_id === user!.id && r.user_type === user!.type && r.emoji === emoji)
            )
          };
        }
      }));

      setShowReactionPicker(false);
      setReactionTargetMessage(null);
      setTimeout(() => setShouldAutoScroll(true), 500);
    } catch (err) {
      setError('Fehler beim Reagieren');
      console.error('Error toggling reaction:', err);
      setShouldAutoScroll(true);
    }
  };

  // Reaktion-Picker oeffnen
  const openReactionPicker = (message: Message) => {
    setReactionTargetMessage(message);
    setShowReactionPicker(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'No file');
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Datei ist zu groß (max. 10MB)');
        return;
      }
      setSelectedFile(file);

      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setSelectedFilePreview(previewUrl);
      } else {
        setSelectedFilePreview(null);
      }
      console.log('File set as selectedFile');
    }
  };

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (selectedFilePreview) {
        URL.revokeObjectURL(selectedFilePreview);
      }
    };
  }, [selectedFilePreview]);

  // Handle textarea focus to preserve scroll position on Android
  const handleTextareaFocus = async () => {
    // Save current scroll position before keyboard opens
    if (contentRef.current) {
      const scrollElement = await contentRef.current.getScrollElement();
      scrollPositionRef.current = scrollElement.scrollTop;

      // After keyboard animation completes, restore scroll position
      // Android keyboard animation takes ~300ms
      setTimeout(async () => {
        if (contentRef.current && scrollPositionRef.current > 0) {
          const scrollEl = await contentRef.current.getScrollElement();
          // Only restore if we were scrolled down and now we're at top
          if (scrollEl.scrollTop < scrollPositionRef.current * 0.5) {
            scrollEl.scrollTop = scrollPositionRef.current;
          }
        }
      }, 350);
    }
  };

  // Auto-capitalize function for text input
  const handleTextInputChange = (value: string) => {
    if (!value) {
      setMessageText('');
      return;
    }

    // Auto-capitalize first letter of new message
    if (value.length === 1) {
      setMessageText(value.toUpperCase());
      return;
    }

    // Auto-capitalize after period, question mark, exclamation mark followed by space
    const lastTwoChars = messageText.slice(-2);
    if ((lastTwoChars.endsWith('. ') || lastTwoChars.endsWith('? ') || lastTwoChars.endsWith('! ')) && value.length > messageText.length) {
      const newChar = value.slice(-1);
      if (newChar !== newChar.toUpperCase() && /[a-zäöü]/.test(newChar)) {
        setMessageText(value.slice(0, -1) + newChar.toUpperCase());
        return;
      }
    }

    setMessageText(value);
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
        setSelectedFilePreview(photo.dataUrl); // Set preview directly from dataUrl
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
        setSelectedFilePreview(photo.dataUrl); // Set preview directly from dataUrl
      }
    } catch (error) {
      console.error('Gallery error:', error);
      setError('Galerie-Zugriff fehlgeschlagen');
    }
  };

  const clearSelectedFile = () => {
    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFile(null);
    setSelectedFilePreview(null);
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

      // Toggle selection - zeige Inline-Aktionsleiste
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
        setShowReactionPicker(false);
      } else {
        setSelectedMessage(message);
        setShowReactionPicker(false);
      }
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
      <div key={message.id} id={`msg-${message.id}`} style={{
        display: 'flex',
        flexDirection: isOwnMessage ? 'row-reverse' : 'row',
        margin: '8px 16px',
        alignItems: 'flex-end',
        transition: 'background-color 0.3s ease'
      }}>
        {!isOwnMessage && room.type !== 'direct' && (
          <IonAvatar style={{
            width: '32px',
            height: '32px',
            marginRight: '8px',
            backgroundColor: '#06b6d4'
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
            backgroundColor: isOwnMessage ? '#06b6d4' : '#f8f9fa',
            color: isOwnMessage ? 'white' : '#1a1a1a',
            borderRadius: '18px',
            padding: '10px 14px',
            position: 'relative',
            cursor: 'pointer',
            boxShadow: isOwnMessage
              ? '0 2px 8px rgba(6, 182, 212, 0.25)'
              : '0 1px 4px rgba(0,0,0,0.08)'
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
              fontWeight: '600',
              marginBottom: '4px',
              color: '#06b6d4'
            }}>
              {message.sender_name || 'Unbekannter User'}
              {(message.sender_role_title || message.sender_role_display_name) && (
                <span style={{
                  fontWeight: 'normal',
                  color: '#8e8e93',
                  marginLeft: '6px',
                  fontSize: '0.7rem'
                }}>
                  ({message.sender_role_title || message.sender_role_display_name})
                </span>
              )}
            </div>
          )}

          {/* Reply Anzeige */}
          {message.reply_to_id && (
            <div
              onClick={(e) => {
                e.stopPropagation(); // Verhindere dass der Content-Click ausgelöst wird
                // Scroll zur zitierten Nachricht
                const replyElement = window.document.getElementById(`msg-${message.reply_to_id}`);
                if (replyElement) {
                  replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Kurz hervorheben
                  replyElement.style.backgroundColor = 'rgba(6, 182, 212, 0.15)';
                  setTimeout(() => {
                    replyElement.style.backgroundColor = '';
                  }, 1500);
                }
              }}
              style={{
                padding: '6px 10px',
                marginBottom: '6px',
                backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(6, 182, 212, 0.08)',
                borderRadius: '8px',
                borderLeft: `3px solid ${isOwnMessage ? 'rgba(255,255,255,0.5)' : '#06b6d4'}`,
                cursor: 'pointer'
              }}
            >
              <div style={{
                fontSize: '0.7rem',
                fontWeight: '600',
                color: isOwnMessage ? 'rgba(255,255,255,0.9)' : '#06b6d4',
                marginBottom: '2px'
              }}>
                {message.reply_to_sender_name}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {message.reply_to_message_type === 'image' || message.reply_to_message_type === 'video'
                  ? (message.reply_to_file_name || 'Medieninhalt')
                  : message.reply_to_message_type === 'file'
                    ? (message.reply_to_file_name || 'Datei')
                    : message.reply_to_message_type === 'poll'
                      ? 'Umfrage'
                      : (message.reply_to_content || '')}
              </div>
            </div>
          )}

          {message.is_deleted ? (
            <div style={{
              fontStyle: 'italic',
              opacity: 0.6,
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
            }}>
              {message.content}
            </div>
          ) : message.message_type === 'poll' && message.question && message.options ? (
            <div style={{
              background: isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(6, 182, 212, 0.06)',
              borderRadius: '14px',
              padding: '16px',
              marginTop: '4px',
              border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.25)' : 'rgba(6, 182, 212, 0.15)'}`,
            }}>
              {/* Frage mit Icon */}
              <div style={{
                fontWeight: '600',
                marginBottom: '12px',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                color: isOwnMessage ? 'white' : '#1a1a1a'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#06b6d4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <IonIcon icon={barChart} style={{ color: 'white', fontSize: '0.8rem' }} />
                </div>
                <span>{message.question}</span>
              </div>

              {/* Ablaufdatum */}
              {message.expires_at && (() => {
                const expiresDate = new Date(message.expires_at);
                const now = new Date();
                const isExpired = expiresDate < now;
                const timeRemaining = expiresDate.getTime() - now.getTime();
                const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
                const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

                return (
                  <div style={{
                    fontSize: '0.8rem',
                    marginBottom: '12px',
                    padding: '8px 12px',
                    background: isExpired ? 'rgba(220,53,69,0.12)' : 'rgba(6, 182, 212, 0.1)',
                    borderRadius: '8px',
                    color: isExpired ? '#dc3545' : (isOwnMessage ? 'rgba(255,255,255,0.9)' : '#06b6d4'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <IonIcon icon={time} style={{ fontSize: '0.9rem' }} />
                    {isExpired ? (
                      <span style={{ fontWeight: '500' }}>Beendet</span>
                    ) : (
                      <span>
                        Endet: {expiresDate.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {hoursRemaining < 24 && ` (${hoursRemaining > 0 ? `${hoursRemaining}h ` : ''}${minutesRemaining}min)`}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Optionen */}
              {message.options.map((option, index) => {
                const optionVotes = message.votes?.filter(vote => vote.option_index === index) || [];
                const totalVotes = message.votes?.length || 0;
                const percentage = totalVotes > 0 ? (optionVotes.length / totalVotes) * 100 : 0;
                const userVoted = message.votes?.some(vote =>
                  vote.user_id === user?.id && vote.user_type === user?.type && vote.option_index === index
                );

                return (
                  <div
                    key={index}
                    onClick={() => voteInPoll(message.id, index)}
                    style={{
                      background: userVoted
                        ? (isOwnMessage ? 'rgba(255,255,255,0.3)' : 'rgba(6, 182, 212, 0.12)')
                        : (isOwnMessage ? 'rgba(255,255,255,0.2)' : 'white'),
                      border: userVoted
                        ? (isOwnMessage ? '2px solid rgba(255,255,255,0.6)' : '2px solid #06b6d4')
                        : (isOwnMessage ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.08)'),
                      borderRadius: '10px',
                      padding: '12px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Fortschrittsbalken */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${percentage}%`,
                      background: isOwnMessage
                        ? 'rgba(255,255,255,0.15)'
                        : (userVoted ? 'rgba(6, 182, 212, 0.12)' : 'rgba(6, 182, 212, 0.06)'),
                      transition: 'width 0.4s ease',
                      borderRadius: '8px'
                    }} />

                    <div style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {userVoted && (
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: isOwnMessage ? 'white' : '#06b6d4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IonIcon icon={checkmark} style={{ color: isOwnMessage ? '#06b6d4' : 'white', fontSize: '0.75rem' }} />
                          </div>
                        )}
                        <span style={{
                          fontWeight: userVoted ? '600' : '500',
                          color: isOwnMessage ? 'white' : '#1a1a1a',
                          fontSize: '0.9rem'
                        }}>
                          {option}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: isOwnMessage ? 'white' : '#06b6d4',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{optionVotes.length}</span>
                        <span style={{ opacity: 0.7 }}>({percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Info Footer */}
              <div style={{
                marginTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#8e8e93'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={message.multiple_choice ? checkmark : chatbubbles} style={{ fontSize: '0.8rem' }} />
                  <span>{message.multiple_choice ? 'Mehrfachauswahl' : 'Einzelauswahl'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={people} style={{ fontSize: '0.8rem' }} />
                  <span>{message.votes?.length || 0} Stimme{(message.votes?.length || 0) !== 1 ? 'n' : ''}</span>
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

          {/* Reaktionen Anzeige */}
          {message.reactions && message.reactions.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginTop: '6px'
            }}>
              {Object.entries(
                message.reactions.reduce((acc, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = [];
                  acc[r.emoji].push(r);
                  return acc;
                }, {} as { [key: string]: Reaction[] })
              ).map(([emoji, reactions]) => {
                const emojiData = REACTION_EMOJIS[emoji];
                const userHasReacted = reactions.some(
                  r => r.user_id === user?.id && r.user_type === user?.type
                );
                return (
                  <div
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReaction(message.id, emoji);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: userHasReacted
                        ? (isOwnMessage ? 'rgba(255,255,255,0.25)' : 'rgba(6, 182, 212, 0.12)')
                        : (isOwnMessage ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'),
                      border: userHasReacted
                        ? `1.5px solid ${emojiData?.color || '#06b6d4'}`
                        : '1px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s ease'
                    }}
                    title={reactions.map(r => r.user_name).join(', ')}
                  >
                    <IonIcon
                      icon={userHasReacted ? emojiData?.filled : emojiData?.outline}
                      style={{
                        fontSize: '0.9rem',
                        color: emojiData?.color || '#06b6d4'
                      }}
                    />
                    <span style={{
                      fontWeight: userHasReacted ? '600' : '500',
                      color: isOwnMessage ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.75)'
                    }}>
                      {reactions.length}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline Aktionsleiste unter ausgewählter Nachricht */}
          {selectedMessage?.id === message.id && !showReactionPicker && (
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginTop: '8px',
                justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                onClick={() => openReactionPicker(message)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <IonIcon icon={addOutline} style={{ fontSize: '1.1rem', color: isOwnMessage ? 'white' : '#666' }} />
              </div>
              <div
                onClick={() => {
                  setReplyToMessage(message);
                  setSelectedMessage(null);
                  setTimeout(() => textareaRef.current?.setFocus(), 100);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <IonIcon icon={arrowUndoOutline} style={{ fontSize: '1rem', color: isOwnMessage ? 'white' : '#666' }} />
              </div>
              <div
                onClick={() => {
                  setSelectedMessage(message);
                  handleShare();
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <IonIcon icon={shareOutline} style={{ fontSize: '1rem', color: isOwnMessage ? 'white' : '#666' }} />
              </div>
              {user?.role_name && ['admin', 'org_admin', 'teamer'].includes(user.role_name) && (
                <div
                  onClick={() => {
                    deleteMessage(message.id);
                    setSelectedMessage(null);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(220, 53, 69, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <IonIcon icon={trashOutline} style={{ fontSize: '1rem', color: '#dc3545' }} />
                </div>
              )}
            </div>
          )}

          {/* Inline Reaktions-Picker */}
          {showReactionPicker && reactionTargetMessage?.id === message.id && (
            <div
              style={{
                display: 'flex',
                gap: '2px',
                marginTop: '8px',
                padding: '6px 10px',
                backgroundColor: 'white',
                borderRadius: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {Object.entries(REACTION_EMOJIS).map(([emoji, data]) => {
                const userHasThisReaction = message.reactions?.some(
                  r => r.user_id === user?.id && r.user_type === user?.type && r.emoji === emoji
                );
                return (
                  <div
                    key={emoji}
                    onClick={() => toggleReaction(message.id, emoji)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      backgroundColor: userHasThisReaction ? `${data.color}18` : 'transparent',
                      border: userHasThisReaction ? `2px solid ${data.color}` : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <IonIcon
                      icon={userHasThisReaction ? data.filled : data.outline}
                      style={{ fontSize: '1.2rem', color: data.color }}
                    />
                  </div>
                );
              })}
            </div>
          )}
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
      
      <IonContent
        ref={contentRef}
        className="app-gradient-background"
        fullscreen
        onClick={() => {
          // Schließe Aktionsleiste und Reaktions-Picker bei Klick außerhalb
          if (selectedMessage || showReactionPicker) {
            setSelectedMessage(null);
            setShowReactionPicker(false);
            setReactionTargetMessage(null);
          }
        }}
      >
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadMessages();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ paddingBottom: '120px' }}>
          {messages.map(renderMessage)}
        </div>

        {/* Floating Scroll-to-Bottom Button */}
        {showScrollToBottom && (
          <div
            onClick={() => {
              contentRef.current?.scrollToBottom(300);
              setShowScrollToBottom(false);
            }}
            style={{
              position: 'fixed',
              bottom: '100px',
              right: '20px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#06b6d4',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 1000,
              transition: 'transform 0.2s ease, opacity 0.2s ease',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <IonIcon icon={arrowDownOutline} style={{ color: 'white', fontSize: '1.4rem' }} />
          </div>
        )}
      </IonContent>


      <IonFooter style={{ backgroundColor: 'rgba(248, 249, 250, 0.95)', backdropFilter: 'blur(10px)' }}>
        {/* Reply Preview */}
        {replyToMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            borderTop: '1px solid rgba(6, 182, 212, 0.15)',
            borderLeft: '3px solid #06b6d4',
            gap: '8px'
          }}>
            <IonIcon icon={returnUpBack} style={{ fontSize: '1.2rem', color: '#06b6d4' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#06b6d4' }}>
                {replyToMessage.sender_name}
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {replyToMessage.message_type === 'image' || replyToMessage.message_type === 'video'
                  ? (replyToMessage.file_name || 'Medieninhalt')
                  : replyToMessage.message_type === 'file'
                    ? (replyToMessage.file_name || 'Datei')
                    : replyToMessage.message_type === 'poll'
                      ? 'Umfrage'
                      : (replyToMessage.content || '')}
              </div>
            </div>
            <IonButton
              fill="clear"
              size="small"
              onClick={() => setReplyToMessage(null)}
              style={{ '--padding-start': '4px', '--padding-end': '4px' }}
            >
              <IonIcon icon={closeCircle} style={{ fontSize: '1.2rem', color: '#8e8e93' }} />
            </IonButton>
          </div>
        )}

        {/* File Preview - direkt an Input angehängt wie Reply */}
        {selectedFile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            backgroundColor: 'rgba(6, 182, 212, 0.06)',
            borderTop: '1px solid rgba(6, 182, 212, 0.12)',
            borderLeft: '3px solid #06b6d4',
            gap: '10px'
          }}>
            {/* Image Preview or File Icon */}
            {selectedFilePreview ? (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                overflow: 'hidden',
                flexShrink: 0,
                border: '2px solid #06b6d4'
              }}>
                <img
                  src={selectedFilePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <IonIcon icon={attach} style={{ fontSize: '1.4rem', color: '#06b6d4' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: '600',
                fontSize: '0.9rem',
                color: '#1a1a1a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: '500' }}>
                {formatFileSize(selectedFile.size)}
              </div>
            </div>
            <IonButton
              fill="clear"
              size="small"
              onClick={clearSelectedFile}
              style={{ '--padding-start': '6px', '--padding-end': '6px' }}
            >
              <IonIcon icon={closeCircle} style={{ fontSize: '1.4rem', color: '#8e8e93' }} />
            </IonButton>
          </div>
        )}

        <IonToolbar style={{
          '--background': 'transparent',
          '--min-height': 'auto',
          '--padding-start': '12px',
          '--padding-end': '12px',
          '--padding-top': '8px',
          '--padding-bottom': '8px'
        }}>
          {/* Flex-Container fuer Input und Buttons - vertikal zentriert */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%'
          }}>
            <IonButton
              fill="clear"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              style={{
                '--padding-start': '4px',
                '--padding-end': '4px',
                '--color': '#06b6d4',
                '--height': '38px',
                '--min-height': '38px',
                fontSize: '22px'
              }}
            >
              <IonIcon icon={attach} />
            </IonButton>

            <div style={{
              flex: 1,
              backgroundColor: 'white',
              borderRadius: '20px',
              border: '1.5px solid rgba(6, 182, 212, 0.3)',
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(6, 182, 212, 0.1)',
              display: 'flex',
              alignItems: 'center'
            }}>
              <IonTextarea
                ref={textareaRef}
                value={messageText}
                onIonInput={(e) => handleTextInputChange(e.detail.value || '')}
                onIonFocus={handleTextareaFocus}
                placeholder="Nachricht schreiben..."
                autoGrow
                rows={1}
                autocapitalize="sentences"
                style={{
                  '--background': 'transparent',
                  '--border-radius': '0',
                  '--padding-start': '14px',
                  '--padding-end': '14px',
                  '--padding-top': '10px',
                  '--padding-bottom': '10px',
                  '--box-shadow': 'none',
                  margin: '0',
                  '--color': '#1a1a1a',
                  '--placeholder-color': '#8e8e93',
                  minHeight: '38px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
            </div>

            <IonButton
              fill="solid"
              shape="round"
              size="small"
              disabled={(!messageText.trim() && !selectedFile) || uploading}
              onClick={sendMessage}
              style={{
                '--background': '#06b6d4',
                '--background-activated': '#0891b2',
                '--background-hover': '#0891b2',
                '--height': '38px',
                '--min-height': '38px',
                '--border-radius': '19px',
                '--padding-start': '0',
                '--padding-end': '0',
                '--box-shadow': '0 2px 8px rgba(6, 182, 212, 0.35)',
                minWidth: '38px',
                maxWidth: '38px',
                fontSize: '15px'
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
          </div>
        </IonToolbar>
      </IonFooter>


    </>
  );
};

export default ChatRoom;